/**
 * Expo Push Service wrapper.
 *
 * Replaces the old SSE delivery model. Use `pushService.send(userId, payload)`
 * (or `sendToMany`) anywhere a controller needs to notify a user. Handles:
 *   - batching (Expo allows ≤100 messages per request)
 *   - receipt fetching to detect DeviceNotRegistered + clean stale tokens
 *   - graceful degradation when no token / no SDK is configured
 *
 * Env: EXPO_ACCESS_TOKEN (optional — only needed for paid Expo Push tier).
 */

import { Expo } from 'expo-server-sdk';
import prisma from './prisma.mjs';

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
  useFcmV1: true, // FCM HTTP v1 — required by Expo since 2024.
});

/** Build a normalized Expo push message from our internal notification shape. */
function buildMessage(token, payload) {
  return {
    to: token,
    sound: payload.sound ?? 'default',
    title: payload.title ?? 'DelipuCash',
    body: payload.body ?? '',
    data: {
      ...(payload.data ?? {}),
      // Keep deep-link target inside .data so the client can route on tap.
      ...(payload.actionUrl ? { actionUrl: payload.actionUrl } : {}),
      ...(payload.type ? { type: payload.type } : {}),
    },
    priority: payload.priority === 'URGENT' || payload.priority === 'HIGH' ? 'high' : 'default',
    channelId: payload.channelId ?? 'default',
    badge: payload.badge,
    categoryId: payload.categoryId,
  };
}

/**
 * Look up tokens for a list of userIds and return the valid Expo push tokens.
 * Skips deleted users and those without a token. Logs (but tolerates) malformed tokens.
 */
async function tokensForUsers(userIds) {
  if (!userIds.length) return [];
  const users = await prisma.appUser.findMany({
    where: { id: { in: userIds }, deletedAt: null, expoPushToken: { not: null } },
    select: { id: true, expoPushToken: true },
  });
  return users
    .filter((u) => Expo.isExpoPushToken(u.expoPushToken))
    .map((u) => ({ userId: u.id, token: u.expoPushToken }));
}

/**
 * Process Expo's per-message tickets.
 * - Tickets with status='error' DeviceNotRegistered → clear the token from the DB.
 * - Tickets with status='ok' carry an id we'll use for a later receipt poll.
 */
async function handleTickets(tickets, recipients) {
  const toClear = [];
  tickets.forEach((ticket, i) => {
    const recipient = recipients[i];
    if (!recipient) return;
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      toClear.push(recipient.userId);
    }
  });
  if (toClear.length) {
    await prisma.appUser.updateMany({
      where: { id: { in: toClear } },
      data: { expoPushToken: null, pushTokenUpdatedAt: new Date() },
    });
    console.log(`[push] Cleared ${toClear.length} stale Expo push tokens`);
  }
}

/**
 * Send a push to a single userId. No-op if no token registered.
 * Returns the ticket count actually queued (0 or 1).
 */
export async function sendPush(userId, payload) {
  const recipients = await tokensForUsers([userId]);
  if (recipients.length === 0) return 0;
  return sendToTokens(recipients, payload);
}

/**
 * Send the same payload to many users. Use this when a single event
 * (e.g. SYSTEM_UPDATE) targets a cohort.
 */
export async function sendPushToUsers(userIds, payload) {
  const recipients = await tokensForUsers(userIds);
  if (recipients.length === 0) return 0;
  return sendToTokens(recipients, payload);
}

async function sendToTokens(recipients, payload) {
  const messages = recipients.map((r) => buildMessage(r.token, payload));
  const chunks = expo.chunkPushNotifications(messages);

  let sentCount = 0;
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      // recipients line up 1:1 with messages, which line up 1:1 with the chunk.
      const startIndex = sentCount;
      const chunkRecipients = recipients.slice(startIndex, startIndex + chunk.length);
      await handleTickets(tickets, chunkRecipients);
      sentCount += chunk.length;
    } catch (err) {
      console.warn('[push] chunk send failed:', err.message);
    }
  }
  return sentCount;
}

/**
 * Convenience export so controllers can write `pushService.send(...)`.
 */
export const pushService = {
  send: sendPush,
  sendToMany: sendPushToUsers,
};

export default pushService;
