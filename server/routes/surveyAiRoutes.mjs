/**
 * Survey AI routes.
 *
 * - POST /api/surveys/ai/generate — generate draft questions from a prompt.
 *   Protected (auth), paywalled (survey-creator access), and rate-limited the
 *   same as survey creation. Returns a draft for the builder; never persists.
 */

import express from 'express';
import { verifyToken } from '../utils/verifyUser.mjs';
import { requireSurveyCreatorAccess } from '../utils/surveyAccess.mjs';
import { surveyCreateRateLimit } from '../utils/surveyRateLimit.mjs';
import { generateAiSurvey } from '../controllers/surveyAiController.mjs';

const router = express.Router();

router.post(
  '/ai/generate',
  surveyCreateRateLimit,
  verifyToken,
  requireSurveyCreatorAccess,
  generateAiSurvey,
);

export default router;
