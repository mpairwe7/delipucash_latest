/**
 * Survey Template Routes
 *
 * CRUD for custom survey templates.
 * All routes require authentication (verifyToken).
 */

import express from 'express';
import { verifyToken } from '../utils/verifyUser.mjs';
import {
  createTemplate,
  listTemplates,
  getTemplate,
  deleteTemplate,
  useTemplate,
} from '../controllers/surveyTemplateController.mjs';

const router = express.Router();

// POST /api/surveys/templates — Create template
router.post('/templates', verifyToken, createTemplate);

// GET /api/surveys/templates — List templates
router.get('/templates', verifyToken, listTemplates);

// GET /api/surveys/templates/:id — Get template
router.get('/templates/:id', verifyToken, getTemplate);

// DELETE /api/surveys/templates/:id — Delete template
router.delete('/templates/:id', verifyToken, deleteTemplate);

// POST /api/surveys/templates/:id/use — Use template (increment count + return questions)
router.post('/templates/:id/use', verifyToken, useTemplate);

export default router;
