# Serverless Hardening — Audit & Production Roadmap

**Status:** Implemented (working tree) — pending Upstash provisioning for full effect
**Date:** 2026-05-26
**Scope:** Express + Prisma backend on Vercel serverless

This document is the audit trail for a round of serverless robustness, correctness,
and performance fixes, plus the remaining work needed for full production readiness.
It reconciles an external architecture analysis with the actual codebase — two of the
original recommendations were based on premises that did not hold (noted below).

## Context

The backend runs as Vercel serverless functions (`maxDuration: 60`) with Prisma over a
PgBouncer-pooled connection (the `@prisma/adapter-pg` driver adapter — **not** Prisma
Accelerate). An external review flagged six issues. All six were verified in code and
addressed. Two framing corrections shaped the fixes:

1. **Client SSE was already disabled.** `DelipuCash/store/SSEStore.ts` sets
   `isEnabled: false` (the "2026 cutover" to Expo Push + TanStack polling). The server's
   per-instance `LISTEN` connection and 25s-TTL SSE stream therefore served no clients —
   so Issues 1 & 2 were resolved by gating that machinery off, not by adopting a new
   real-time provider.
2. **`cacheStrategy` was a no-op.** It is an Accelerate-only feature; with the pg driver
   adapter it is silently ignored. The pre-existing `lib/cacheStrategies.mjs` did nothing.
   Real caching needed an actual cache layer (in-process TTL cache).

## What changed (per issue)

| # | Issue | Fix | Key files |
|---|-------|-----|-----------|
| 1 | Direct-connection exhaustion: `initListener()` opened a dedicated `DIRECT_DATABASE_URL` connection **per serverless instance** | Gated the `LISTEN` connection + SSE routes behind `REALTIME_SSE_ENABLED` (default **off**). No direct connection is opened on serverless. | `lib/realtimeFlag.mjs` (new), `index.js`, `lib/eventBus.mjs` |
| 2 | SSE reconnection storms (25s TTL → constant client reconnects) | Same gate — SSE endpoints unmounted when disabled; clients fall back to polling (already their default). | `index.js` |
| 3 | In-memory circuit breaker, token caches, and Play Integrity nonces fragment across stateless containers | Added **Upstash Redis** as a shared L2 layer (fail-open) for breaker state, MTN/Airtel token cache + refresh locks, and nonce replay-protection. In-memory remains the L1/fallback. | `lib/redis.mjs` (new), `lib/circuitBreaker.mjs`, `lib/mtnConfig.mjs`, `lib/airtelConfig.mjs`, `lib/playIntegrity.mjs` |
| 4 | Configured-but-unused query caching (`cacheStrategy` no-op) | Built a dependency-free **in-process TTL + LRU cache** and applied it to the heavy read endpoints. Removed the dead `cacheStrategies` imports. | `lib/memoryCache.mjs` (new), `controllers/videoController.mjs`, `controllers/AdController.mjs`, `controllers/surveyController.mjs` |
| 5 | High-precision `groupBy(['createdAt'])` returned one group per row | DB-side `DATE_TRUNC('day', …)` via parameterized `$queryRaw` (≤ ~30 rows). | `controllers/surveyController.mjs` (`getSurveyAnalytics`) |
| 6 | Lost reward points: response saved, points awarded separately; a failed award + the `@@unique([userId, surveyId])` constraint permanently blocked retry | Wrapped response-create + points-increment in a single `prisma.$transaction` — a failed award rolls back the response so the user can retry. | `controllers/surveyController.mjs` (`submitSurveyResponse`) |

### Issue 1 & 2 — Real-time gated off

`lib/realtimeFlag.mjs` exports `REALTIME_ENABLED = process.env.REALTIME_SSE_ENABLED === 'true'`
(default `false`). When disabled:

- `initListener()` is not called → **no direct DB connection per instance**.
- `/api/sse` and `/api/realtime` are not mounted → no 25s-TTL reconnect loop.
- `publishEvent` / `publishEventToMany` early-return → no dead `SSEEvent` writes.

To bring real-time back, set `REALTIME_SSE_ENABLED=true` **only on a dedicated
long-running (non-serverless) instance**, or migrate to a managed provider (see roadmap).

### Issue 3 — Upstash Redis shared state (fail-open)

`lib/redis.mjs` wraps `@upstash/redis` (REST-based; no persistent socket). Design
guarantees:

- **Lazy dynamic import** — the package is only loaded when `UPSTASH_*` is configured; the
  server boots fine without it.
- **Every helper is guarded and never throws.** On any error/timeout/missing-config it
  returns `null` (or `{ ok: false }`), and callers fall back to in-memory state.
- **Bounded latency** — a timeout race (~800 ms on the payment path) caps any awaited call.

| Concern | Redis keys | Fallback when Redis down/unset |
|---------|-----------|-------------------------------|
| Circuit breaker | `cb:{provider}:open` (TTL=reset), `cb:{provider}:fails` (INCR+EXPIRE window), `cb:{provider}:probe` (SET-NX single probe) | L1 in-memory breaker (per instance) — **payments never blocked** |
| Token cache + lock | `tok:{key}` (TTL=buffered lifetime), `tok:{key}:lock` (SET-NX, poll-or-proceed) | L1 token cache + in-flight coalescing (per instance) |
| Nonce replay | `nonce:{value}` (SET-NX EX 300 on issue, atomic `GETDEL` on consume) | In-memory map (per instance) — degrades, never fails closed |

The breaker keeps L1 authoritative for its own OPEN state (no Redis call when already open
locally); it consults Redis only when L1 is CLOSED, so the happy path adds **at most one
awaited GET**. All breaker writes are fire-and-forget.

> **Note (Play Integrity ordering):** `verifyIntegrityToken` now runs the nonce/replay
> check *before* the "not configured" early-return, so a replayed/unknown nonce is rejected
> even when integrity verification is disabled (defence in depth).

### Issue 4 — In-process TTL cache

`lib/memoryCache.mjs` provides `TTLCache` (lazy TTL eviction + insertion-order LRU cap),
`getStore(ns, max)`, `cached(store, key, ttlMs, producer)`, and `mediaCacheMaxMs(...)`.

| Endpoint | Caching | Key | TTL |
|----------|---------|-----|-----|
| `getAllAds` | global | all query params | 5 min |
| `getAllSurveys`, `getSurveysByStatus` | global (notification side-effect kept outside cache) | status + page + limit | 90 s |
| `getVideosByUser` | global | `userId` | 5 min |
| `getAllVideos` | **split** — caches global rows + signed URLs; overlays per-user like/bookmark flags live | `sortBy:page:limit` | 5 min |
| `getTrendingVideos` | per-user (filtering is user-specific); `anon` shared | `country:language:page:limit:userId` | 3 min |

Media payloads embed signed R2 URLs (`DOWNLOAD_URL_EXPIRY = 24h`), so the short TTLs are
far under the validity ceiling. **`getVideoById` is intentionally never cached** — it exists
to mint fresh signed URLs on playback error (the client's stale-URL safety net).

Caches are **per-instance** and **TTL-only** (no cross-instance invalidation yet — see
roadmap).

## Operational requirements

Add to the server environment (documented in `server/.env.example` and
[Environment Variables](../deployment/environment-variables.md)):

| Variable | Default | Effect |
|----------|---------|--------|
| `REALTIME_SSE_ENABLED` | `false` | Leave unset/false on Vercel. `true` enables `LISTEN` + SSE (dedicated instances only). |
| `UPSTASH_REDIS_REST_URL` | — | Enables shared breaker/token/nonce state. Unset → per-instance fallback. |
| `UPSTASH_REDIS_REST_TOKEN` | — | Paired with the URL. Provision via the Vercel Upstash Marketplace integration. |

**Behavior without Upstash:** everything works exactly as before this change (per-instance
state). Provisioning Upstash upgrades it to cluster-wide coordination with zero code change.

## Verification

- **Tests:** `cd server && bun test` → **31 pass**. New: `test/memoryCache.test.js` (TTL,
  LRU, prefix-delete, read-through), `test/circuitBreaker.test.js` (threshold trip, 4xx does
  not trip, short-circuit, reset, fail-open with Redis unset). Updated:
  `test/playIntegrity.test.js` (async nonce + replay-before-env ordering).
- **Imports:** all edited modules load cleanly (no circular deps).
- **Fail-open proven:** with `UPSTASH_*` set to an unreachable host, `rGet`/`rGetDel`/`rSetNX`
  return `null`/`{ok:false}` within ~130 ms and never throw.

What was **not** unit-tested (needs a live DB) and should be covered by integration tests:

- Issue 6 transaction rollback (failed award → response not persisted → retry succeeds).
- Issue 5 `DATE_TRUNC` day-bucketing correctness across a timezone boundary.

## Next stages for full production

### P0 — required before relying on the fixes at scale

1. **Provision Upstash Redis** and set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
   in Vercel (Production + Preview). Until then the breaker/token/nonce are per-instance
   (functional, but failure counts fragment and nonces don't coordinate cross-instance).
2. **Confirm `REALTIME_SSE_ENABLED` is unset/false** in Vercel; verify (DB dashboard) that
   direct (port 5432) connections no longer scale with traffic.
3. **Integration tests** for Issue 5 and Issue 6 against a test database (see above).
4. **Smoke-test redemption end-to-end** with Play Integrity + a real nonce round-trip on
   Upstash (issue on one request, consume on another → must succeed; replay → must fail).

### P1 — robustness & observability

5. **Breaker/Redis monitoring:** expose fleet breaker status (add an `async getFleetStatus()`
   reading `cb:*` keys) on an admin/health route; alert on OPEN events and on Redis
   unavailability (fail-open masks outages otherwise).
6. **Cache invalidation on writes (optional):** add best-effort local `deleteByPrefix`
   busting in create/delete handlers (video/ad/survey), or a Redis cache-version key for
   cross-instance freshness. Currently TTL-only (≤5 min staleness window).
7. **Load test** the payment path with the provider forced down to confirm the fleet breaker
   trips once (not per-instance) and recovers via a single probe.
8. **Tune breaker thresholds** for production traffic (currently 5 failures / 60 s / 30 s
   reset in prod, fixed-window approximation in Redis; L1 keeps a sliding window).

### P2 — cleanup & decommission

9. **Remove dead code:** `lib/cacheStrategies.mjs` is now orphaned (no importers) and the
   `@prisma/extension-accelerate` dependency is unused — drop both. (Left in place for now;
   harmless.)
10. **SSEEvent table:** with SSE off, `publishEvent` is a no-op and the table no longer grows;
    `cleanupOldEvents` is moot. If real-time is not coming back, plan a migration to drop the
    `SSEEvent` table and its `pg_notify` triggers.
11. **Decide the real-time strategy:** if a future feature needs live updates, either enable
    `REALTIME_SSE_ENABLED` on a dedicated always-on service, or adopt a serverless-native
    provider (Supabase Realtime / Pusher / Ably) and re-point `SSEManager` on the client.

## Related docs

- [Real-time (SSE)](realtime.md) — now disabled by default
- [Payments](payments.md) — circuit breaker + token cache (now Redis-backed)
- [Database](database.md) — caching reality (in-process, not Accelerate)
- [Environment Variables](../deployment/environment-variables.md)
