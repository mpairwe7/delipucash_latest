/**
 * Real-time (SSE + PostgreSQL LISTEN/NOTIFY) feature flag.
 *
 * As of the 2026 cutover, the mobile client no longer consumes SSE — it uses
 * Expo Push + TanStack Query polling (see DelipuCash/store/SSEStore.ts, where
 * `isEnabled: false`). Running the SSE machinery on Vercel serverless is pure
 * overhead and a liability:
 *   - pgNotify opens a dedicated DIRECT_DATABASE_URL connection PER serverless
 *     instance (bypasses PgBouncer) → exhausts Postgres direct-connection limits.
 *   - The 25s SSE connection TTL forces constant client reconnect storms.
 *
 * Therefore real-time is OFF by default. Set REALTIME_SSE_ENABLED=true ONLY on a
 * dedicated long-running (non-serverless) instance that can safely hold a LISTEN
 * connection and stream SSE. When disabled:
 *   - initListener() is not called (no direct connection opened),
 *   - the /api/sse and /api/realtime routes are not mounted,
 *   - eventBus publishEvent/publishEventToMany become no-ops (no dead writes).
 */
export const REALTIME_ENABLED = process.env.REALTIME_SSE_ENABLED === 'true';
