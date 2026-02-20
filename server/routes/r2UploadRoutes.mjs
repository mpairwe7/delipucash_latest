/**
 * R2 Upload Routes
 * 
 * Handles file uploads to Cloudflare R2:
 * - Video uploads (multipart/form-data)
 * - Thumbnail uploads
 * - Livestream recordings
 * - Presigned URL generation for direct uploads
 * 
 * Industry standards:
 * - Rate limiting
 * - File validation
 * - Secure signed URLs
 * - Progress-friendly chunked uploads
 */

import express from 'express';
import multer from 'multer';
import { verifyToken } from '../utils/verifyUser.mjs';
import {
  uploadVideoToR2,
  uploadThumbnailToR2,
  uploadAvatarToR2,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  finalizePresignedVideoUpload,
  deleteVideoFromR2,
  uploadLivestreamChunk,
  finalizeLivestreamRecording,
  validateUploadRequest,
  uploadAdMediaToR2,
} from '../controllers/r2UploadController.mjs';

const router = express.Router();

// ============================================================================
// MULTER CONFIGURATION
// Memory storage for processing before R2 upload
// ============================================================================

const memoryStorage = multer.memoryStorage();

// Video upload config
const videoUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max (will be validated per user tier)
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedVideoTypes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/x-matroska',
      'video/3gpp',
      'video/x-m4v',
    ];
    
    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid video type: ${file.mimetype}. Allowed: ${allowedVideoTypes.join(', ')}`));
    }
  },
});

// Thumbnail upload config
const thumbnailUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
    
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image type: ${file.mimetype}. Allowed: ${allowedImageTypes.join(', ')}`));
    }
  },
});

// Avatar upload config (profile photo)
const avatarUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max (already compressed client-side)
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image type: ${file.mimetype}. Allowed: ${allowedImageTypes.join(', ')}`));
    }
  },
});

// Combined video + thumbnail upload
const mediaUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 500 * 1024 * 1024,
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
      'video/x-matroska', 'video/3gpp', 'video/x-m4v',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  },
});

// Livestream chunk upload
const chunkUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per chunk
    files: 1,
  },
});

// ============================================================================
// ERROR HANDLER MIDDLEWARE
// ============================================================================

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'File size exceeds the maximum allowed limit',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'TOO_MANY_FILES',
        message: 'Too many files uploaded',
      });
    }
    return res.status(400).json({
      success: false,
      error: 'UPLOAD_ERROR',
      message: err.message,
    });
  }

  // Propagate non-multer errors (e.g. auth errors from verifyToken)
  // to the app-level error handler instead of masking them as INVALID_FILE.
  if (err) {
    // If the error has a statusCode (e.g. from errorHandler()), preserve it
    if (err.statusCode) {
      return next(err);
    }
    // Otherwise it's likely a file-filter rejection from multer's fileFilter callback
    return res.status(400).json({
      success: false,
      error: 'INVALID_FILE',
      message: err.message,
    });
  }
  
  next();
};

// ============================================================================
// UPLOAD ROUTES
// ============================================================================

/**
 * POST /api/r2/upload/video
 * Upload a video file to R2
 * 
 * Body (multipart/form-data):
 * - video: Video file
 * - userId: User ID
 * - title: Optional title
 * - description: Optional description
 * - duration: Optional duration in seconds
 */
router.post(
  '/upload/video',
  verifyToken,
  videoUpload.single('video'),
  handleMulterError,
  uploadVideoToR2
);

/**
 * POST /api/r2/upload/thumbnail
 * Upload a thumbnail image to R2
 *
 * Body (multipart/form-data):
 * - thumbnail: Image file
 * - userId: User ID
 * - videoId: Optional video ID to associate with
 */
router.post(
  '/upload/thumbnail',
  verifyToken,
  thumbnailUpload.single('thumbnail'),
  handleMulterError,
  uploadThumbnailToR2
);

/**
 * POST /api/r2/upload/avatar
 * Upload a profile avatar image to R2 and update user record
 *
 * Body (multipart/form-data):
 * - avatar: Image file (JPEG, PNG, WebP, GIF — max 2MB)
 * - No userId needed — uses JWT token
 */
router.post(
  '/upload/avatar',
  verifyToken,
  avatarUpload.single('avatar'),
  handleMulterError,
  uploadAvatarToR2
);

/**
 * POST /api/r2/upload/media
 * Upload video + thumbnail together
 *
 * Body (multipart/form-data):
 * - video: Video file
 * - thumbnail: Image file
 * - userId: User ID
 * - title: Optional title
 * - description: Optional description
 */
router.post(
  '/upload/media',
  verifyToken,
  mediaUpload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  handleMulterError,
  uploadVideoToR2
);

/**
 * POST /api/r2/upload/validate
 * Validate upload request before uploading
 * Check file size against user's limits
 */
router.post('/upload/validate', verifyToken, validateUploadRequest);

// ============================================================================
// AD MEDIA UPLOAD ROUTES
// ============================================================================

/**
 * POST /api/r2/upload/ad-media
 * Upload ad media (image or video) to R2
 *
 * Body (multipart/form-data):
 * - media: Image or video file
 * - userId: User ID
 * - adId: Optional ad ID to update
 */
router.post(
  '/upload/ad-media',
  verifyToken,
  mediaUpload.single('media'),
  handleMulterError,
  uploadAdMediaToR2
);

// ============================================================================
// PRESIGNED URL ROUTES (Direct upload from client)
// ============================================================================

/**
 * POST /api/r2/presign/upload
 * Get a presigned URL for direct upload from client
 *
 * Body:
 * - fileName: Original file name
 * - mimeType: File MIME type
 * - userId: User ID
 * - type: 'video' | 'thumbnail'
 * - fileSize: File size in bytes (for validation)
 */
router.post('/presign/upload', getPresignedUploadUrl);

/**
 * POST /api/r2/presign/download
 * Get a presigned URL for private content access
 * 
 * Body:
 * - key: R2 object key
 * - expiresIn: Optional expiry in seconds (default: 1 hour)
 */
router.post('/presign/download', getPresignedDownloadUrl);

/**
 * POST /api/r2/upload/finalize-video
 * Finalize a video uploaded via presigned URL.
 * Verifies the file exists in R2, then creates the Video DB record.
 *
 * Body (JSON):
 * - r2VideoKey: R2 object key for the uploaded video (required)
 * - videoUrl: Public URL of the video
 * - videoMimeType: Video MIME type
 * - r2ThumbnailKey: R2 key for thumbnail (optional)
 * - thumbnailUrl: Public URL of thumbnail (optional)
 * - thumbnailMimeType: Thumbnail MIME type (optional)
 * - title: Video title
 * - description: Video description
 * - duration: Video duration in seconds
 */
router.post('/upload/finalize-video', verifyToken, finalizePresignedVideoUpload);

// ============================================================================
// LIVESTREAM ROUTES
// ============================================================================

/**
 * POST /api/r2/livestream/chunk
 * Upload a livestream chunk
 * 
 * Body (multipart/form-data):
 * - chunk: Video chunk data
 * - sessionId: Livestream session ID
 * - chunkIndex: Chunk sequence number
 */
router.post(
  '/livestream/chunk',
  chunkUpload.single('chunk'),
  handleMulterError,
  uploadLivestreamChunk
);

/**
 * POST /api/r2/livestream/finalize
 * Finalize a livestream recording
 * 
 * Body:
 * - sessionId: Livestream session ID
 * - userId: User ID
 */
router.post('/livestream/finalize', finalizeLivestreamRecording);

// ============================================================================
// DELETE ROUTES
// ============================================================================

/**
 * DELETE /api/r2/delete/:key
 * Delete a file from R2
 */
router.delete('/delete/:key(*)', deleteVideoFromR2);

export default router;
