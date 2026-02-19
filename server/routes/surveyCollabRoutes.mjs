/**
 * Survey Collaboration Routes
 *
 * Real-time collaboration session management for survey editors.
 * All routes require authentication (verifyToken).
 */

import express from 'express';
import { verifyToken } from '../utils/verifyUser.mjs';
import {
  joinSession,
  leaveSession,
  lockQuestion,
  unlockQuestion,
  getActiveEditors,
} from '../controllers/surveyCollabController.mjs';

const router = express.Router();

// POST /api/surveys/:surveyId/collab/join — Join editing session
router.post('/:surveyId/collab/join', verifyToken, joinSession);

// POST /api/surveys/:surveyId/collab/leave — Leave editing session
router.post('/:surveyId/collab/leave', verifyToken, leaveSession);

// POST /api/surveys/:surveyId/collab/lock — Lock a question
router.post('/:surveyId/collab/lock', verifyToken, lockQuestion);

// POST /api/surveys/:surveyId/collab/unlock — Unlock a question
router.post('/:surveyId/collab/unlock', verifyToken, unlockQuestion);

// GET /api/surveys/:surveyId/collab/editors — Get active editors
router.get('/:surveyId/collab/editors', verifyToken, getActiveEditors);

export default router;
