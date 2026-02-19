/**
 * Survey File Upload Routes
 *
 * All routes require authentication (verifyToken).
 * File uploads use multer with memory storage (max 25MB).
 */

import express from 'express';
import multer from 'multer';
import { verifyToken } from '../utils/verifyUser.mjs';
import {
  uploadSurveyFile,
  getSurveyFileDownloadUrl,
  deleteSurveyFile,
} from '../controllers/surveyFileController.mjs';

const router = express.Router();

// Multer: memory storage, 25MB limit, single file
const surveyFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

// Handle multer errors gracefully
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large. Maximum size is 25MB.' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  next(err);
};

// POST /api/surveys/:surveyId/files — Upload file
router.post(
  '/:surveyId/files',
  verifyToken,
  surveyFileUpload.single('file'),
  handleMulterError,
  uploadSurveyFile,
);

// GET /api/surveys/:surveyId/files/:fileId — Get presigned download URL
router.get('/:surveyId/files/:fileId', verifyToken, getSurveyFileDownloadUrl);

// DELETE /api/surveys/:surveyId/files/:fileId — Delete file
router.delete('/:surveyId/files/:fileId', verifyToken, deleteSurveyFile);

export default router;
