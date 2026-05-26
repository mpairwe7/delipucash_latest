/**
 * In-process TTL + approximate-LRU cache for hot read endpoints.
 *
 * Per-serverless-instance (NOT shared across containers) — intended for
 * read-heavy, mostly-global data (video/ad/survey lists). Each entry carries its
 * own TTL; eviction is lazy on read plus an insertion-order ("oldest-out") cap on
 * write. No background timers (they waste serverless compute and can keep
 * instances warm pointlessly).
 *
 * Dependency-free on purpose: a Map with an entry cap is plenty for short-lived
 * serverless instances. Reach for `lru-cache` only if byte-size eviction is ever
 * needed.
 *
 * IMPORTANT: for data that embeds signed R2 URLs, keep the TTL well under the URL
 * expiry (URL_EXPIRY.DOWNLOAD_URL_EXPIRY = 24h) so cached URLs are still valid
 * when later served. The MEDIA_CACHE_MAX_MS helper below derives a safe ceiling.
 */

export class TTLCache {
  /** @param {number} max - max entries before the oldest is evicted */
  constructor(max = 500) {
    this.max = max;
    /** @type {Map<string, { val: any, exp: number }>} */
    this.map = new Map();
  }

  get(key) {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.exp <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Touch for approximate-LRU: re-insert moves the entry to the newest slot.
    this.map.delete(key);
    this.map.set(key, e);
    return e.val;
  }

  set(key, val, ttlMs) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { val, exp: Date.now() + ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }

  delete(key) {
    return this.map.delete(key);
  }

  /** Delete every key starting with `prefix` (best-effort local invalidation). */
  deleteByPrefix(prefix) {
    let n = 0;
    for (const k of this.map.keys()) {
      if (k.startsWith(prefix)) {
        this.map.delete(k);
        n++;
      }
    }
    return n;
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }
}

// Named stores so different namespaces get independent entry caps.
const stores = new Map();

/** Get (or lazily create) a named cache store. */
export function getStore(namespace, max = 500) {
  let s = stores.get(namespace);
  if (!s) {
    s = new TTLCache(max);
    stores.set(namespace, s);
  }
  return s;
}

/**
 * Read-through helper. Returns the cached value for `key`, otherwise runs
 * `producer()`, caches the resolved value for `ttlMs`, and returns it.
 *
 * Notes:
 *  - A rejected producer is NOT cached (the error propagates).
 *  - null/undefined results are not cached (treated as a miss next time).
 *  - Concurrent misses may both run the producer — acceptable for read caches
 *    (no herd lock); the last writer wins.
 */
export async function cached(store, key, ttlMs, producer) {
  const hit = store.get(key);
  if (hit !== undefined) return hit;
  const val = await producer();
  if (val !== undefined && val !== null) {
    store.set(key, val, ttlMs);
  }
  return val;
}

/**
 * Safe TTL ceiling for payloads embedding signed download URLs: a quarter of the
 * URL's lifetime, so a cached URL always has ample validity left when served.
 * Pass URL_EXPIRY.DOWNLOAD_URL_EXPIRY (seconds). Actual TTLs should sit well
 * under this (we use ~5 min for media lists).
 */
export function mediaCacheMaxMs(downloadUrlExpirySeconds) {
  return Math.floor((downloadUrlExpirySeconds * 1000) / 4);
}
