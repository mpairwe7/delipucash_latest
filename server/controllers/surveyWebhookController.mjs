import prisma from '../lib/prisma.mjs';

const URL_REGEX = /^https?:\/\/.+/i;

/**
 * Verify that the requesting user owns the survey.
 * Returns the survey if ownership is confirmed, or null after sending an error response.
 */
async function verifySurveyOwnership(surveyId, userId, res) {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { id: true, userId: true },
  });

  if (!survey) {
    res.status(404).json({ success: false, message: 'Survey not found' });
    return null;
  }

  if (survey.userId !== userId) {
    res.status(403).json({ success: false, message: 'Access denied. You do not own this survey.' });
    return null;
  }

  return survey;
}

/**
 * Create a webhook for a survey.
 * Body: { url, events, secret }
 */
export async function createWebhook(req, res) {
  const { surveyId } = req.params;
  const { url, events, secret } = req.body;
  const userId = req.user.id;

  try {
    // Validate URL format
    if (!url || !URL_REGEX.test(url)) {
      return res.status(400).json({
        success: false,
        message: 'A valid HTTP or HTTPS URL is required.',
      });
    }

    // Validate events array
    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one event type is required.',
      });
    }

    // Verify ownership
    const survey = await verifySurveyOwnership(surveyId, userId, res);
    if (!survey) return;

    const webhook = await prisma.surveyWebhook.create({
      data: {
        surveyId,
        url,
        events,
        secret: secret || null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Webhook created successfully.',
      data: webhook,
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating webhook',
      error: error.message,
    });
  }
}

/**
 * List all webhooks for a survey.
 */
export async function listWebhooks(req, res) {
  const { surveyId } = req.params;
  const userId = req.user.id;

  try {
    // Verify ownership
    const survey = await verifySurveyOwnership(surveyId, userId, res);
    if (!survey) return;

    const webhooks = await prisma.surveyWebhook.findMany({
      where: { surveyId },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: webhooks,
    });
  } catch (error) {
    console.error('Error listing webhooks:', error);
    res.status(500).json({
      success: false,
      message: 'Error listing webhooks',
      error: error.message,
    });
  }
}

/**
 * Update a webhook by id.
 * Body: { url?, events?, secret?, isActive? }
 */
export async function updateWebhook(req, res) {
  const { webhookId } = req.params;
  const { url, events, secret, isActive } = req.body;
  const userId = req.user.id;

  try {
    // Find the webhook and verify ownership through its survey
    const webhook = await prisma.surveyWebhook.findUnique({
      where: { id: webhookId },
      include: { survey: { select: { userId: true } } },
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found.',
      });
    }

    if (webhook.survey.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this survey.',
      });
    }

    // Validate URL if provided
    if (url !== undefined && !URL_REGEX.test(url)) {
      return res.status(400).json({
        success: false,
        message: 'A valid HTTP or HTTPS URL is required.',
      });
    }

    // Validate events if provided
    if (events !== undefined && (!Array.isArray(events) || events.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Events must be a non-empty array.',
      });
    }

    // Build update data dynamically
    const updateData = {};
    if (url !== undefined) updateData.url = url;
    if (events !== undefined) updateData.events = events;
    if (secret !== undefined) updateData.secret = secret || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Reset failCount when re-activating
    if (isActive === true) {
      updateData.failCount = 0;
    }

    const updated = await prisma.surveyWebhook.update({
      where: { id: webhookId },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      message: 'Webhook updated successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating webhook',
      error: error.message,
    });
  }
}

/**
 * Delete a webhook by id.
 */
export async function deleteWebhook(req, res) {
  const { webhookId } = req.params;
  const userId = req.user.id;

  try {
    // Find the webhook and verify ownership through its survey
    const webhook = await prisma.surveyWebhook.findUnique({
      where: { id: webhookId },
      include: { survey: { select: { userId: true } } },
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found.',
      });
    }

    if (webhook.survey.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this survey.',
      });
    }

    await prisma.surveyWebhook.delete({
      where: { id: webhookId },
    });

    res.status(200).json({
      success: true,
      message: 'Webhook deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting webhook',
      error: error.message,
    });
  }
}

/**
 * Fire a test event to a webhook URL.
 * Makes a direct fetch call (does not use dispatchWebhooks).
 */
export async function testWebhook(req, res) {
  const { webhookId } = req.params;
  const userId = req.user.id;

  try {
    // Find the webhook and verify ownership through its survey
    const webhook = await prisma.surveyWebhook.findUnique({
      where: { id: webhookId },
      include: { survey: { select: { userId: true } } },
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found.',
      });
    }

    if (webhook.survey.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this survey.',
      });
    }

    const body = JSON.stringify({
      event: 'test',
      data: { message: 'Test webhook delivery' },
      timestamp: new Date().toISOString(),
      webhookId: webhook.id,
    });

    const headers = {
      'Content-Type': 'application/json',
    };

    // Sign the payload if a secret is configured
    if (webhook.secret) {
      const { createHmac } = await import('node:crypto');
      const signature = createHmac('sha256', webhook.secret)
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

      res.status(200).json({
        success: true,
        message: 'Test webhook delivered.',
        statusCode: response.status,
        statusText: response.statusText,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      const isTimeout = fetchError.name === 'AbortError';
      res.status(200).json({
        success: false,
        message: isTimeout
          ? 'Test webhook timed out (5s).'
          : `Test webhook delivery failed: ${fetchError.message}`,
        error: fetchError.message,
      });
    }
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing webhook',
      error: error.message,
    });
  }
}
