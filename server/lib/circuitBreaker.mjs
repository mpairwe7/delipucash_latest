/**
 * Lightweight Circuit Breaker for Payment Provider APIs
 *
 * Prevents cascading failures when MTN or Airtel APIs are down by
 * short-circuiting requests after repeated failures.
 *
 * States:
 *  - **CLOSED** (normal) — requests pass through. Failures are counted.
 *  - **OPEN** — requests are immediately rejected with a clear error.
 *    After `resetTimeoutMs`, transitions to HALF_OPEN.
 *  - **HALF_OPEN** — a single probe request is allowed through.
 *    If it succeeds → CLOSED. If it fails → OPEN again.
 *
 * Environment-aware thresholds:
 *  - **Production**: strict (5 failures → open, 30s reset, 60s window)
 *  - **Sandbox**: lenient (10 failures → open, 15s reset, 120s window)
 *
 * Usage:
 * ```js
 * import { getBreaker } from '../lib/circuitBreaker.mjs';
 *
 * const breaker = getBreaker('mtn');
 * const result = await breaker.exec(() => axios.post(...));
 * ```
 *
 * @module lib/circuitBreaker
 */

import { redisEnabled, rGet, rSet, rIncr, rExpire, rDel, rSetNX, INSTANCE_ID } from './redis.mjs';

// Inline env check to avoid circular dependency with mtnConfig
const isSandbox = (process.env.X_TARGET_ENVIRONMENT || 'sandbox') === 'sandbox';

// Hard cap on the single awaited Redis read on the payment path (fail-open).
const REDIS_READ_TIMEOUT_MS = 800;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} BreakerConfig
 * @property {number} failureThreshold  - Failures before opening
 * @property {number} resetTimeoutMs    - How long to stay OPEN before probing
 * @property {number} failureWindowMs   - Sliding window for failure counting
 * @property {number} successThreshold  - Successes in HALF_OPEN before closing
 */

/** @type {BreakerConfig} */
const PRODUCTION_CONFIG = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,    // 30 seconds
  failureWindowMs: 60_000,   // 1 minute sliding window
  successThreshold: 2,       // 2 successes to close
};

/** @type {BreakerConfig} */
const SANDBOX_CONFIG = {
  failureThreshold: 10,      // More lenient for testing
  resetTimeoutMs: 15_000,    // 15 seconds (faster recovery for dev)
  failureWindowMs: 120_000,  // 2 minute window
  successThreshold: 1,       // 1 success to close
};

const config = isSandbox ? SANDBOX_CONFIG : PRODUCTION_CONFIG;

// ---------------------------------------------------------------------------
// Circuit Breaker states
// ---------------------------------------------------------------------------

const STATE = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

// ---------------------------------------------------------------------------
// Circuit Breaker class
// ---------------------------------------------------------------------------

class CircuitBreaker {
  /**
   * @param {string} name - Identifier (e.g. 'mtn', 'airtel')
   * @param {BreakerConfig} [cfg]
   */
  constructor(name, cfg = config) {
    this.name = name;
    this.cfg = cfg;
    this.state = STATE.CLOSED;
    /** @type {number[]} Timestamps of recent failures */
    this.failures = [];
    this.halfOpenSuccesses = 0;
    this.openedAt = 0;
    this.halfOpenInFlight = false;
  }

  /** Prune failures outside the sliding window */
  _pruneFailures() {
    const cutoff = Date.now() - this.cfg.failureWindowMs;
    this.failures = this.failures.filter((ts) => ts > cutoff);
  }

  /** Record a failure */
  _recordFailure() {
    this.failures.push(Date.now());
    this._pruneFailures();

    if (this.state === STATE.HALF_OPEN) {
      // Probe failed — re-open
      this._trip();
      return;
    }

    if (this.failures.length >= this.cfg.failureThreshold) {
      this._trip();
    }
  }

  /** Record a success */
  _recordSuccess() {
    if (this.state === STATE.HALF_OPEN) {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.cfg.successThreshold) {
        this._close();
      }
    } else {
      // In CLOSED state, a success resets the failure window
      this.failures = [];
    }
  }

  /** Transition to OPEN */
  _trip() {
    this.state = STATE.OPEN;
    this.openedAt = Date.now();
    this.halfOpenSuccesses = 0;
    this.halfOpenInFlight = false;
    console.warn(
      `[CircuitBreaker:${this.name}] OPENED — ${this.failures.length} failures in ${this.cfg.failureWindowMs}ms window. ` +
      `Will probe in ${this.cfg.resetTimeoutMs}ms.`
    );
  }

  /** Transition back to CLOSED */
  _close() {
    this.state = STATE.CLOSED;
    this.failures = [];
    this.halfOpenSuccesses = 0;
    this.halfOpenInFlight = false;
    console.log(`[CircuitBreaker:${this.name}] CLOSED — provider recovered.`);
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * @template T
   * @param {() => Promise<T>} fn - The async function to execute
   * @returns {Promise<T>}
   * @throws {Error} If the circuit is OPEN (with `err.circuitOpen = true`)
   */
  async exec(fn) {
    // --- OPEN ---
    if (this.state === STATE.OPEN) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed < this.cfg.resetTimeoutMs) {
        const err = new Error(
          `[CircuitBreaker:${this.name}] Circuit is OPEN — ${this.name.toUpperCase()} API is temporarily unavailable. ` +
          `Retry in ${Math.ceil((this.cfg.resetTimeoutMs - elapsed) / 1000)}s.`
        );
        err.circuitOpen = true;
        err.retryAfterMs = this.cfg.resetTimeoutMs - elapsed;
        throw err;
      }
      // Reset timeout elapsed → transition to HALF_OPEN
      this.state = STATE.HALF_OPEN;
      this.halfOpenSuccesses = 0;
      this.halfOpenInFlight = false;
      console.log(`[CircuitBreaker:${this.name}] HALF_OPEN — allowing probe request.`);
    }

    // --- HALF_OPEN: only allow one probe at a time ---
    if (this.state === STATE.HALF_OPEN && this.halfOpenInFlight) {
      const err = new Error(
        `[CircuitBreaker:${this.name}] HALF_OPEN probe in progress — please retry shortly.`
      );
      err.circuitOpen = true;
      err.retryAfterMs = 3000;
      throw err;
    }

    if (this.state === STATE.HALF_OPEN) {
      this.halfOpenInFlight = true;
    }

    // --- L2: fleet-wide state in Redis. Consulted ONLY when L1 is CLOSED, so we
    // add at most one awaited GET to the happy path. Fully fail-open: when Redis
    // is down/slow the GET returns null and we proceed as if CLOSED — a payment
    // is never blocked because Redis is unavailable. ---
    let isFleetProbe = false;
    if (redisEnabled && this.state === STATE.CLOSED) {
      const open = await rGet(`cb:${this.name}:open`, REDIS_READ_TIMEOUT_MS);
      if (open) {
        // The fleet has tripped this breaker. Claim the single probe slot; if we
        // don't win it (another instance is probing), short-circuit. Note: when
        // Redis is truly down the GET above already returned null, so we only get
        // here when Redis is reachable and the breaker is genuinely open.
        const won = await rSetNX(`cb:${this.name}:probe`, INSTANCE_ID, this._probeTtlSec(), REDIS_READ_TIMEOUT_MS);
        if (won !== 'OK') {
          const err = new Error(
            `[CircuitBreaker:${this.name}] Circuit is OPEN (fleet) — ${this.name.toUpperCase()} API is temporarily unavailable. Retry shortly.`
          );
          err.circuitOpen = true;
          err.retryAfterMs = 3000;
          throw err;
        }
        isFleetProbe = true; // we hold the probe → execute fn() as the probe
      }
    }

    // --- CLOSED, local HALF_OPEN probe, or fleet probe ---
    try {
      const result = await fn();
      this._recordSuccess();
      if (isFleetProbe) {
        void this._redisClose(); // probe succeeded → close the fleet breaker
      }
      return result;
    } catch (error) {
      // Only count network/timeout errors as circuit failures.
      // 4xx client errors (bad request, auth) should NOT trip the breaker.
      const status = error.response?.status;
      const isClientError = status && status >= 400 && status < 500;

      if (!isClientError) {
        this._recordFailure();
        if (redisEnabled) {
          // Fire-and-forget: never extend payment latency with breaker writes.
          if (isFleetProbe) {
            void this._redisReopen(); // probe failed → re-open across the fleet
          } else {
            void this._redisRecordFailure(); // count toward the fleet threshold
          }
        }
      }

      throw error;
    } finally {
      if (this.state === STATE.HALF_OPEN) {
        this.halfOpenInFlight = false;
      }
    }
  }

  // ---- Redis (L2) coordination helpers. All fire-and-forget & fail-open. ----

  /** Probe lock TTL — must outlast a provider call so two instances can't probe
   *  at once. Falls back to the open-state TTL but never under 20s. */
  _probeTtlSec() {
    return Math.max(20, Math.ceil(this.cfg.resetTimeoutMs / 1000));
  }

  /** Increment the fleet failure counter (fixed window via INCR+EXPIRE) and trip
   *  the fleet breaker once the threshold is crossed. */
  async _redisRecordFailure() {
    const failKey = `cb:${this.name}:fails`;
    const n = await rIncr(failKey);
    if (n === null) return; // Redis unavailable — L1 already recorded it locally
    if (n === 1) {
      await rExpire(failKey, Math.ceil(this.cfg.failureWindowMs / 1000));
    }
    if (n >= this.cfg.failureThreshold) {
      await rSet(`cb:${this.name}:open`, '1', { ex: Math.ceil(this.cfg.resetTimeoutMs / 1000) });
    }
  }

  /** Re-open the fleet breaker after a failed probe and release the probe slot. */
  async _redisReopen() {
    await rSet(`cb:${this.name}:open`, '1', { ex: Math.ceil(this.cfg.resetTimeoutMs / 1000) });
    await rDel(`cb:${this.name}:probe`);
  }

  /** Close the fleet breaker after a successful probe (clear all state). */
  async _redisClose() {
    await rDel([`cb:${this.name}:open`, `cb:${this.name}:fails`, `cb:${this.name}:probe`]);
  }

  /** Get current breaker state (for health checks / monitoring) */
  getStatus() {
    this._pruneFailures();
    return {
      name: this.name,
      state: this.state,
      recentFailures: this.failures.length,
      failureThreshold: this.cfg.failureThreshold,
      ...(this.state === STATE.OPEN
        ? { opensFor: Date.now() - this.openedAt, resetTimeoutMs: this.cfg.resetTimeoutMs }
        : {}),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton breakers per provider
// ---------------------------------------------------------------------------

/** @type {Map<string, CircuitBreaker>} */
const breakers = new Map();

/**
 * Get (or create) a circuit breaker for a named provider.
 *
 * @param {'mtn'|'airtel'|string} name - Provider name
 * @returns {CircuitBreaker}
 */
export const getBreaker = (name) => {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker(name));
  }
  return breakers.get(name);
};

/**
 * Get status of all circuit breakers (for /api/health or admin endpoints).
 * @returns {Object[]}
 */
export const getAllBreakerStatuses = () => {
  return Array.from(breakers.values()).map((b) => b.getStatus());
};

/**
 * Reset a specific breaker (for admin/testing).
 * @param {string} name
 */
export const resetBreaker = (name) => {
  const breaker = breakers.get(name);
  if (breaker) {
    breaker._close();
  }
};
