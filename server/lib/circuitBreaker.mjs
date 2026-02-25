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

// Inline env check to avoid circular dependency with mtnConfig
const isSandbox = (process.env.X_TARGET_ENVIRONMENT || 'sandbox') === 'sandbox';

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

    // --- CLOSED or HALF_OPEN probe ---
    try {
      const result = await fn();
      this._recordSuccess();
      return result;
    } catch (error) {
      // Only count network/timeout errors as circuit failures.
      // 4xx client errors (bad request, auth) should NOT trip the breaker.
      const status = error.response?.status;
      const isClientError = status && status >= 400 && status < 500;

      if (!isClientError) {
        this._recordFailure();
      }

      throw error;
    } finally {
      if (this.state === STATE.HALF_OPEN) {
        this.halfOpenInFlight = false;
      }
    }
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
