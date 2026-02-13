import prisma from './prisma.mjs';

/**
 * Publish an event to the SSE event log.
 * Called from controllers after successful mutations.
 * Fire-and-forget — never crashes the parent mutation.
 *
 * @param {string} userId - Target user UUID
 * @param {string} type - Dot-notation event type (e.g., "notification.new")
 * @param {Object} payload - Arbitrary JSON payload
 * @returns {Promise<{ id: string, seq: number } | null>}
 */
export async function publishEvent(userId, type, payload) {
  try {
    const event = await prisma.sSEEvent.create({
      data: { userId, type, payload },
      select: { id: true, seq: true },
    });
    return event;
  } catch (error) {
    console.error('[SSE EventBus] Failed to publish event:', error.message);
    return null;
  }
}

/**
 * Publish an event to multiple users simultaneously.
 * Useful for broadcasting (e.g., new question to all followers).
 *
 * @param {string[]} userIds - Array of target user UUIDs
 * @param {string} type - Dot-notation event type
 * @param {Object} payload - Shared JSON payload
 */
export async function publishEventToMany(userIds, type, payload) {
  if (!userIds || userIds.length === 0) return;
  try {
    await prisma.sSEEvent.createMany({
      data: userIds.map((userId) => ({ userId, type, payload })),
    });
  } catch (error) {
    console.error('[SSE EventBus] Failed to publish batch events:', error.message);
  }
}

/**
 * Delete events older than the specified minutes.
 * Called opportunistically on SSE connection close.
 *
 * @param {number} olderThanMinutes - TTL threshold (default 10 minutes)
 */
export async function cleanupOldEvents(olderThanMinutes = 10) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  try {
    const result = await prisma.sSEEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      console.log(`[SSE EventBus] Cleaned up ${result.count} expired events`);
    }
  } catch (error) {
    console.error('[SSE EventBus] Cleanup failed:', error.message);
  }
}
