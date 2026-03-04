import prisma from './prisma.mjs';
import { isListenerActive } from './pgNotify.mjs';

/**
 * Publish an event to the SSE event log.
 * Called from controllers after successful mutations.
 * Fire-and-forget — never crashes the parent mutation.
 *
 * Flow:
 *   1. INSERT into SSEEvent table (persistence + seq number)
 *   2. SSEEvent trigger fires pg_notify('sse_events', ...) automatically
 *   3. pgNotify.mjs LISTEN connection receives it → pushes to SSE clients
 *
 * When the database trigger is not yet applied (fresh dev environment),
 * a belt-and-suspenders pg_notify call is made inline via Prisma.
 * When the trigger IS applied, this is skipped to avoid double-flush overhead.
 *
 * @param {string} userId - Target user UUID
 * @param {string} type - Dot-notation event type (e.g., "notification.new")
 * @param {Object} payload - Arbitrary JSON payload (kept under 7KB recommended)
 * @returns {Promise<{ id: string, seq: number } | null>}
 */
export async function publishEvent(userId, type, payload) {
  try {
    // Guard: validate payload won't cause issues downstream
    const payloadStr = JSON.stringify(payload);
    if (payloadStr.length > 65_536) {
      console.warn(`[SSE EventBus] Payload too large (${payloadStr.length} bytes) for event ${type}, truncating to metadata only`);
      payload = { _truncated: true, type };
    }

    const event = await prisma.sSEEvent.create({
      data: { userId, type, payload },
      select: { id: true, seq: true },
    });

    // Belt-and-suspenders: inline NOTIFY only when the DB trigger is missing.
    // When the LISTEN connection is active and receiving trigger-based notifications,
    // the inline call is skipped to avoid double-flush query overhead.
    // This check is a best-effort heuristic — if LISTEN is active, the trigger
    // is almost certainly applied. In dev environments without migrations, LISTEN
    // may not be active either, so both paths degrade gracefully.
    if (!isListenerActive()) {
      notifyInline(userId, type, event.seq).catch(() => {});
    }

    return event;
  } catch (error) {
    console.error('[SSE EventBus] Failed to publish event:', error.message);
    return null;
  }
}

/**
 * Publish an event to multiple users simultaneously.
 * Useful for broadcasting (e.g., new question to all followers).
 * Batches in chunks of 500 to avoid oversized INSERT statements.
 *
 * @param {string[]} userIds - Array of target user UUIDs
 * @param {string} type - Dot-notation event type
 * @param {Object} payload - Shared JSON payload
 */
export async function publishEventToMany(userIds, type, payload) {
  if (!userIds || userIds.length === 0) return;

  const BATCH_SIZE = 500;

  try {
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      await prisma.sSEEvent.createMany({
        data: batch.map((userId) => ({ userId, type, payload })),
      });
    }
    // Trigger-based NOTIFY fires per row automatically via the DB trigger.
  } catch (error) {
    console.error('[SSE EventBus] Failed to publish batch events:', error.message);
  }
}

/**
 * Delete events older than the specified minutes.
 * Debounced — runs at most once per minute to prevent excessive DELETE queries
 * under high SSE connection churn.
 *
 * @param {number} olderThanMinutes - TTL threshold (default 60 minutes)
 */
let lastCleanupTime = 0;
const CLEANUP_DEBOUNCE_MS = 60_000;

export async function cleanupOldEvents(olderThanMinutes = 60) {
  // Debounce: skip if cleanup ran within the last minute
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_DEBOUNCE_MS) return;
  lastCleanupTime = now;

  const cutoff = new Date(now - olderThanMinutes * 60 * 1000);
  try {
    const result = await prisma.sSEEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      console.log(`[SSE EventBus] Cleaned up ${result.count} expired events (older than ${olderThanMinutes}m)`);
    }
  } catch (error) {
    console.error('[SSE EventBus] Cleanup failed:', error.message);
  }
}

// ---------- Internal ----------

/**
 * Fire pg_notify via Prisma raw query (works through PgBouncer transaction mode).
 * This is a safety net for environments without the DB trigger.
 *
 * Note: $executeRawUnsafe with $1 parameterization IS SQL-injection-safe.
 * The "Unsafe" suffix means Prisma doesn't type-check the query, but the
 * parameterized form prevents injection. pg_notify works through PgBouncer
 * because it's a regular function call, not a session-level LISTEN command.
 *
 * Payload is kept to metadata only (userId, type, seq) — well under the
 * PostgreSQL 8KB pg_notify limit. Never include full event payloads here.
 */
async function notifyInline(userId, type, seq) {
  const payload = JSON.stringify({ userId, type, seq });
  await prisma.$executeRawUnsafe(
    `SELECT pg_notify('sse_events', $1)`,
    payload,
  );
}
