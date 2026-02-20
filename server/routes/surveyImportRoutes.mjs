/**
 * Survey Import Routes
 * Handles file upload for import preview and sample template downloads.
 *
 * Routes:
 * - POST /api/surveys/import/preview  — Upload and parse a survey file (protected)
 * - GET  /api/surveys/import/samples/:format — Download sample template (public)
 */

import express from 'express';
import multer from 'multer';
import { verifyToken } from '../utils/verifyUser.mjs';
import { previewImport, getSampleTemplate } from '../controllers/surveyImportController.mjs';

const router = express.Router();

// Multer config: memory storage, 5MB limit, restricted MIME types
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/json',
      'text/csv',
      'text/comma-separated-values',
      'text/tab-separated-values',
      'text/plain', // Some systems report .tsv/.csv as text/plain
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(`Unsupported file type: ${file.mimetype}. Please upload JSON, CSV, or TSV.`);
      err.statusCode = 400;
      cb(err);
    }
  },
});

// Multer error handler (follows r2UploadRoutes.mjs pattern)
const handleMulterError = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'File size exceeds 5MB limit. Please reduce the file size.',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'TOO_MANY_FILES',
        message: 'Only one file can be uploaded at a time.',
      });
    }
    return res.status(400).json({
      success: false,
      error: 'UPLOAD_ERROR',
      message: err.message,
    });
  }
  // Preserve auth errors (pass through)
  if (err && err.statusCode) return next(err);
  // Generic file errors (e.g., MIME filter rejection)
  if (err) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_FILE',
      message: err.message || 'Invalid file upload.',
    });
  }
  next();
};

// Protected: parse and preview uploaded file
router.post(
  '/import/preview',
  verifyToken,
  importUpload.single('file'),
  handleMulterError,
  previewImport,
);

// Public: download sample template
router.get('/import/samples/:format', getSampleTemplate);

export default router;
