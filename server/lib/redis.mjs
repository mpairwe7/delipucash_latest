import 'dotenv/config';
import { randomUUID } from 'crypto';

/**
 * Upstash Redis wrapper for SHARED state across serverless instances:
 *   - payment circuit-breaker state (see lib/circuitBreaker.mjs)
 *   - MTN/Airtel OAuth token cache + refresh locks (lib/mtnConfig, lib/airtelConfig)
 *   - Play Integrity nonce replay-protection (lib/playIntegrity.mjs)
 *
 * Design goals:
 *   - REST-based (@upstash/redis) — no persistent socket, correct for Vercel.
 *   - FAIL-OPEN: every helper is guarded and NEVER throws. On any error, missing
 *     config, or even a missing package, it returns null and callers fall back to
 *     their in-memory behaviour. Redis being down must never block a payment.
 *   - Lazy dynamic import: the package is only loaded when env is configured, so
 *     the server boots fine without it and degrades gracefully if it can't load.
 *   - Bounded latency: a timeout race caps how long any awaited call can take.
 */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

/** True when Upstash credentials are configured. Callers use this to skip the
 *  async path entirely (avoid overhead) when Redis isn't set up. */
export const redisEnabled = Boolean(url && token);

/** Unique per serverless instance — used as the value of distributed locks so a
 *  holder can be identified (circuit-breaker probe, token-refresh lock). */
export const INSTANCE_ID = randomUUID();

const DEFAULT_TIMEOUT_MS = 1000;
// Token-refresh coordination knobs (fail-open: never deadlock a payment).
const TOKEN_TIMEOUT_MS = 800;
const TOKEN_LOCK_TTL_SEC = 20;
const TOKEN_POLL_ATTEMPTS = 3;
const TOKEN_POLL_INTERVAL_MS = 300;

let _disabled = !redisEnabled; // becomes true permanently if the import fails
let _clientPromise = null;
const _warned = new Set();

async function getClient() {
  if (_disabled) return null;
  if (_clientPromise) return _clientPromise;
  _clientPromise = (async () => {
    try {
      const { Redis } = await import('@upstash/redis');
      // Low retry budget — we never want Redis to add meaningful latency.
      return new Redis({ url, token, retry: { retries: 1, backoff: () => 50 } });
    } catch (err) {
      console.warn('[Redis] @upstash/redis unavailable — using in-memory state:', err.message);
      _disabled = true;
      return null;
    }
  })();
  return _clientPromise;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('redis-timeout')), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/**
 * Run a Redis operation, returning a discriminated result so callers can tell
 * "key genuinely absent" from "Redis errored" (the nonce path needs this).
 * @returns {Promise<{ ok: boolean, value: any }>} ok=false means Redis was
 *   unavailable/errored (fail-open); ok=true means the op ran (value may be null).
 */
async function run(op, fn, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const c = await getClient();
  if (!c) return { ok: false, value: null };
  try {
    const value = await withTimeout(Promise.resolve(fn(c)), timeoutMs);
    return { ok: true, value };
  } catch (err) {
    if (!_warned.has(op)) {
      console.warn(`[Redis] ${op} failed (fail-open):`, err.message);
      _warned.add(op);
    }
    return { ok: false, value: null };
  }
}

// --- Simple helpers: return the value, or null on absence/error (fail-open). ---
export async function rGet(key, timeoutMs) {
  return (await run('get', (c) => c.get(key), timeoutMs)).value;
}
export async function rSet(key, value, opts, timeoutMs) {
  return (await run('set', (c) => c.set(key, value, opts), timeoutMs)).value;
}
export async function rIncr(key, timeoutMs) {
  return (await run('incr', (c) => c.incr(key), timeoutMs)).value;
}
export async function rExpire(key, seconds, timeoutMs) {
  return (await run('expire', (c) => c.expire(key, seconds), timeoutMs)).value;
}
export async function rDel(keys, timeoutMs) {
  const arr = Array.isArray(keys) ? keys : [keys];
  if (arr.length === 0) return null;
  return (await run('del', (c) => c.del(...arr), timeoutMs)).value;
}
/** SET key value NX EX ttl → returns 'OK' if acquired, null if already held/errored. */
export async function rSetNX(key, value, ttlSeconds, timeoutMs) {
  return (await run('setnx', (c) => c.set(key, value, { nx: true, ex: ttlSeconds }), timeoutMs)).value;
}

/**
 * Atomic GET + DEL. Returns a discriminated result so the caller can distinguish
 * "absent" (value null, ok true) from "Redis errored" (ok false) — important for
 * nonce replay protection, which must fall back to its in-memory map on error
 * rather than wrongly rejecting.
 */
export async function rGetDel(key, timeoutMs) {
  return run('getdel', (c) => c.getdel(key), timeoutMs);
}

/**
 * Coordinate an OAuth token refresh across instances. Wins a SET-NX lock and
 * fetches; if it loses, polls the shared cache briefly, then fetches anyway —
 * never blocks the caller. Fail-open: with Redis down/unset, just calls fetchFn.
 *
 * @param {string} cacheKey logical token key (e.g. 'mtn:collection', 'airtel')
 * @param {() => Promise<string>} fetchFn fetches a fresh token AND writes it to
 *        the shared cache (`tok:{cacheKey}`) + the caller's in-memory cache
 * @param {(shared: any) => (string|null)} useShared given a shared
 *        `{token,expiresAt}` (or null), return the token if still valid (and
 *        hydrate the caller's in-memory cache), else null
 * @returns {Promise<string>} the token
 */
export async function sharedTokenRefresh(cacheKey, fetchFn, useShared) {
  if (!redisEnabled) return fetchFn();

  const lockKey = `tok:${cacheKey}:lock`;
  const won = await rSetNX(lockKey, INSTANCE_ID, TOKEN_LOCK_TTL_SEC, TOKEN_TIMEOUT_MS);
  if (won === 'OK') {
    try {
      return await fetchFn();
    } finally {
      await rDel(lockKey);
    }
  }

  // Another instance holds the lock — poll the shared cache for the fresh token.
  for (let i = 0; i < TOKEN_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, TOKEN_POLL_INTERVAL_MS));
    const tok = useShared(await rGet(`tok:${cacheKey}`, TOKEN_TIMEOUT_MS));
    if (tok) return tok;
  }
  // Lock holder is slow/dead — fetch ourselves rather than block the payment.
  return fetchFn();
}
