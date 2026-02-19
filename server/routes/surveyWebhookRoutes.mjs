/**
 * Survey Webhook Routes
 *
 * CRUD for survey webhooks + test delivery.
 * All routes require authentication (verifyToken).
 */

import express from 'express';
import { verifyToken } from '../utils/verifyUser.mjs';
import {
  createWebhook,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  testWebhook,
} from '../controllers/surveyWebhookController.mjs';

const router = express.Router();

// POST /api/surveys/:surveyId/webhooks — Create webhook
router.post('/:surveyId/webhooks', verifyToken, createWebhook);

// GET /api/surveys/:surveyId/webhooks — List webhooks
router.get('/:surveyId/webhooks', verifyToken, listWebhooks);

// PUT /api/surveys/:surveyId/webhooks/:webhookId — Update webhook
router.put('/:surveyId/webhooks/:webhookId', verifyToken, updateWebhook);

// DELETE /api/surveys/:surveyId/webhooks/:webhookId — Delete webhook
router.delete('/:surveyId/webhooks/:webhookId', verifyToken, deleteWebhook);

// POST /api/surveys/:surveyId/webhooks/:webhookId/test — Test webhook
router.post('/:surveyId/webhooks/:webhookId/test', verifyToken, testWebhook);

export default router;
