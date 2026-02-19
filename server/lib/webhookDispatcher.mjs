import crypto from 'node:crypto';
import prisma from './prisma.mjs';

/**
 * Dispatch webhooks for a survey event.
 * Fire-and-forget — callers should NOT await this function.
 * Uses Promise.allSettled so one failing webhook never blocks others.
 *
 * @param {string} surveyId - The survey UUID
 * @param {string} eventType - Dot-notation event type (e.g., "survey.response.created")
 * @param {Object} payload - Arbitrary JSON payload to send
 */
export async function dispatchWebhooks(surveyId, eventType, payload) {
  let webhooks;

  try {
    webhooks = await prisma.surveyWebhook.findMany({
      where: {
        surveyId,
        isActive: true,
        events: { has: eventType },
      },
    });
  } catch (error) {
    console.error('[WebhookDispatcher] Failed to query webhooks:', error.message);
    return;
  }

  if (!webhooks || webhooks.length === 0) return;

  const deliveries = webhooks.map((webhook) => deliverWebhook(webhook, eventType, payload));

  await Promise.allSettled(deliveries);
}

/**
 * Deliver a single webhook request.
 * - POST JSON body with event, data, timestamp, webhookId
 * - HMAC-SHA256 signature in X-Webhook-Signature header (if secret is set)
 * - 5 second timeout via AbortController
 * - On success: update lastFired and lastStatus
 * - On failure: increment failCount, update lastStatus. Deactivate if failCount >= 10
 *
 * @param {Object} webhook - The SurveyWebhook record
 * @param {string} eventType - The event type string
 * @param {Object} payload - The event payload
 */
async function deliverWebhook(webhook, eventType, payload) {
  const bodyObj = {
    data: payload,
    event: eventType,
    timestamp: new Date().toISOString(),
    webhookId: webhook.id,
  };
  // Sort keys for deterministic HMAC signature verification by receivers
  const body = JSON.stringify(bodyObj, Object.keys(bodyObj).sort());

  const headers = {
    'Content-Type': 'application/json',
  };

  // Sign the payload if a secret is configured
  if (webhook.secret) {
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');
    headers['X-Webhook-Signature'] = signature;
  }

  // 5 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Success — update lastFired, lastStatus, reset failCount
    await prisma.surveyWebhook.update({
      where: { id: webhook.id },
      data: {
        lastFired: new Date(),
        lastStatus: response.status,
        failCount: 0,
      },
    });
  } catch (error) {
    clearTimeout(timeoutId);

    const isTimeout = error.name === 'AbortError';
    console.error(
      `[WebhookDispatcher] Delivery failed for webhook ${webhook.id}:`,
      isTimeout ? 'Request timed out (5s)' : error.message
    );

    // Increment failCount and update lastStatus
    const newFailCount = webhook.failCount + 1;

    try {
      await prisma.surveyWebhook.update({
        where: { id: webhook.id },
        data: {
          failCount: newFailCount,
          lastStatus: isTimeout ? 408 : 0,
          // Deactivate if failCount reaches threshold
          ...(newFailCount >= 10 ? { isActive: false } : {}),
        },
      });

      if (newFailCount >= 10) {
        console.warn(
          `[WebhookDispatcher] Webhook ${webhook.id} deactivated after ${newFailCount} consecutive failures`
        );
      }
    } catch (updateError) {
      console.error(
        `[WebhookDispatcher] Failed to update webhook ${webhook.id} fail status:`,
        updateError.message
      );
    }
  }
}
