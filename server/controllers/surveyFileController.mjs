/**
 * Survey File Upload Controller
 *
 * Handles file uploads for survey questions of type 'file_upload'.
 * Reuses the R2 upload infrastructure from r2.mjs.
 *
 * Endpoints:
 * - POST   /api/surveys/:surveyId/files  — Upload file for a question
 * - GET    /api/surveys/:surveyId/files/:fileId — Presigned download URL
 * - DELETE /api/surveys/:surveyId/files/:fileId — Delete uploaded file
 */

import { PrismaClient } from '@prisma/client';
import { uploadFile, generateObjectKey, getSignedDownloadUrl, deleteFile } from '../lib/r2.mjs';

const prisma = new PrismaClient();

/** Max file size: 25 MB */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Allowed MIME types for survey file uploads */
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
];

// ============================================================================
// UPLOAD FILE
// ============================================================================

export async function uploadSurveyFile(req, res) {
  try {
    const { surveyId } = req.params;
    const { questionId } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    if (!questionId) {
      return res.status(400).json({ success: false, error: 'questionId is required' });
    }

    // Validate file size
    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: `File type "${req.file.mimetype}" is not allowed`,
      });
    }

    // Verify survey exists
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { uploads: { where: { id: questionId }, select: { id: true, type: true } } },
    });

    if (!survey) {
      return res.status(404).json({ success: false, error: 'Survey not found' });
    }

    // Verify question exists and is file_upload type
    if (survey.uploads.length === 0) {
      return res.status(400).json({ success: false, error: 'Question not found in this survey' });
    }

    if (survey.uploads[0].type !== 'file_upload') {
      return res.status(400).json({ success: false, error: 'Question is not a file upload type' });
    }

    // Upload to R2
    const r2Key = generateObjectKey('survey-files', req.file.originalname, userId);
    const uploadResult = await uploadFile(req.file.buffer, r2Key, req.file.mimetype, {
      surveyId,
      questionId,
      userId,
    });

    // Create database record
    const fileRecord = await prisma.surveyFileUpload.create({
      data: {
        surveyId,
        questionId,
        userId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        r2Key,
        r2Etag: uploadResult.etag || null,
        status: 'uploaded',
      },
    });

    // Generate download URL
    const downloadUrl = await getSignedDownloadUrl(r2Key, 3600);

    return res.status(201).json({
      success: true,
      data: {
        id: fileRecord.id,
        fileName: fileRecord.fileName,
        fileSize: fileRecord.fileSize,
        mimeType: fileRecord.mimeType,
        downloadUrl,
        uploadedAt: fileRecord.uploadedAt,
      },
    });
  } catch (error) {
    console.error('[surveyFileController] Upload error:', error);
    return res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
}

// ============================================================================
// GET DOWNLOAD URL
// ============================================================================

export async function getSurveyFileDownloadUrl(req, res) {
  try {
    const { surveyId, fileId } = req.params;
    const userId = req.user.id;

    const fileRecord = await prisma.surveyFileUpload.findFirst({
      where: { id: fileId, surveyId },
      include: { survey: { select: { userId: true } } },
    });

    if (!fileRecord) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Only the file uploader or survey owner can download
    if (fileRecord.userId !== userId && fileRecord.survey.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const downloadUrl = await getSignedDownloadUrl(fileRecord.r2Key, 3600);

    return res.json({
      success: true,
      data: {
        id: fileRecord.id,
        fileName: fileRecord.fileName,
        mimeType: fileRecord.mimeType,
        fileSize: fileRecord.fileSize,
        downloadUrl,
      },
    });
  } catch (error) {
    console.error('[surveyFileController] Download URL error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate download URL' });
  }
}

// ============================================================================
// DELETE FILE
// ============================================================================

export async function deleteSurveyFile(req, res) {
  try {
    const { surveyId, fileId } = req.params;
    const userId = req.user.id;

    const fileRecord = await prisma.surveyFileUpload.findFirst({
      where: { id: fileId, surveyId },
      include: { survey: { select: { userId: true } } },
    });

    if (!fileRecord) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Only the uploader or survey owner can delete
    if (fileRecord.userId !== userId && fileRecord.survey.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Delete from R2
    await deleteFile(fileRecord.r2Key);

    // Delete database record
    await prisma.surveyFileUpload.delete({ where: { id: fileId } });

    return res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    console.error('[surveyFileController] Delete error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete file' });
  }
}
