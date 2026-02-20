/**
 * R2 Upload Controller
 * 
 * Handles file uploads to Cloudflare R2 with:
 * - Video upload with automatic multipart for large files
 * - Thumbnail upload
 * - Livestream chunk upload and finalization
 * - Presigned URL generation
 * - Prisma transaction safety for metadata storage
 * 
 * Security:
 * - File type validation
 * - File size validation per user tier
 * - User authentication verification
 * 
 * Performance:
 * - Async uploads with progress support
 * - Edge caching via R2 CDN
 * - Multipart upload for large files
 */

import asyncHandler from 'express-async-handler';
import prisma from '../lib/prisma.mjs';
import r2, {
  uploadVideo,
  uploadThumbnail,
  uploadAvatar,
  uploadLivestreamRecording,
  getSignedUploadUrl,
  getSignedDownloadUrl,
  deleteFile,
  finalizeLivestreamSession,
  generateObjectKey,
  getPublicUrl,
  validateFileType,
  validateFileSize,
  STORAGE_PATHS,
  FILE_LIMITS,
} from '../lib/r2.mjs';

// ============================================================================
// HELPER: Check user premium status
// ============================================================================

async function getUserPremiumStatus(userId) {
  try {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionStatus: true,
      },
    });
    
    if (!user) {
      return { exists: false, isPremium: false };
    }
    
    const isPremium = user.subscriptionStatus === 'ACTIVE';
    return { exists: true, isPremium };
  } catch (error) {
    console.error('[R2Controller] Error checking user status:', error);
    return { exists: false, isPremium: false };
  }
}

// ============================================================================
// VIDEO UPLOAD
// ============================================================================

/**
 * Upload a video file to R2
 * Supports both single file upload and combined video+thumbnail
 */
export const uploadVideoToR2 = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // Get file(s) from request
  const videoFile = req.file || req.files?.video?.[0];
  const thumbnailFile = req.files?.thumbnail?.[0];
  
  if (!videoFile) {
    return res.status(400).json({
      success: false,
      error: 'NO_FILE',
      message: 'No video file provided',
    });
  }
  
  const { userId, title, description, duration } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_USER_ID',
      message: 'User ID is required',
    });
  }
  
  // Verify user exists and get premium status
  const { exists, isPremium } = await getUserPremiumStatus(userId);
  
  if (!exists) {
    return res.status(404).json({
      success: false,
      error: 'USER_NOT_FOUND',
      message: 'User not found',
    });
  }
  
  // Validate file size against user's limit
  const maxSize = isPremium 
    ? FILE_LIMITS.PREMIUM_VIDEO_MAX_SIZE 
    : FILE_LIMITS.FREE_VIDEO_MAX_SIZE;
  
  if (videoFile.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    return res.status(413).json({
      success: false,
      error: 'FILE_TOO_LARGE',
      message: `Video size exceeds ${maxSizeMB}MB limit`,
      maxSize,
      fileSize: videoFile.size,
      isPremium,
      upgradeRequired: !isPremium,
    });
  }
  
  try {
    // Upload video to R2
    console.log(`[R2Controller] Starting video upload: ${videoFile.originalname} (${(videoFile.size / 1024 / 1024).toFixed(2)}MB)`);
    
    const videoResult = await uploadVideo(
      videoFile.buffer,
      videoFile.originalname,
      videoFile.mimetype,
      userId,
      { isPremium }
    );
    
    console.log(`[R2Controller] Video uploaded to R2: ${videoResult.key}`);
    
    // Upload thumbnail if provided
    let thumbnailResult = null;
    if (thumbnailFile) {
      thumbnailResult = await uploadThumbnail(
        thumbnailFile.buffer,
        thumbnailFile.originalname,
        thumbnailFile.mimetype,
        userId
      );
      console.log(`[R2Controller] Thumbnail uploaded to R2: ${thumbnailResult.key}`);
    }
    
    // Create video record in database with transaction
    const video = await prisma.$transaction(async (tx) => {
      return tx.video.create({
        data: {
          title: title || videoFile.originalname,
          description: description || '',
          videoUrl: videoResult.url,
          thumbnail: thumbnailResult?.url || '',
          userId,
          duration: duration ? parseInt(duration, 10) : null,
          likes: 0,
          views: 0,
          commentsCount: 0,
          // R2 metadata
          r2VideoKey: videoResult.key,
          r2ThumbnailKey: thumbnailResult?.key || null,
          r2VideoEtag: videoResult.etag,
          r2ThumbnailEtag: thumbnailResult?.etag || null,
          videoMimeType: videoFile.mimetype,
          thumbnailMimeType: thumbnailFile?.mimetype || null,
          videoSizeBytes: BigInt(videoFile.size),
          thumbnailSizeBytes: thumbnailFile?.size || null,
          storageProvider: 'r2',
          isProcessed: true, // Mark as processed (no transcoding for now)
          processingStatus: 'completed',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      });
    });
    
    const uploadTime = Date.now() - startTime;
    console.log(`[R2Controller] Video upload complete in ${uploadTime}ms`);
    
    // Return signed URLs instead of public URLs
    const [signedVideoUrl, signedThumbnailUrl] = await Promise.all([
      video.r2VideoKey
        ? getSignedDownloadUrl(video.r2VideoKey)
        : Promise.resolve(video.videoUrl),
      video.r2ThumbnailKey
        ? getSignedDownloadUrl(video.r2ThumbnailKey)
        : Promise.resolve(video.thumbnail),
    ]);

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      video: {
        id: video.id,
        title: video.title,
        description: video.description,
        videoUrl: signedVideoUrl,
        thumbnail: signedThumbnailUrl,
        duration: video.duration,
        r2VideoKey: video.r2VideoKey,
        r2ThumbnailKey: video.r2ThumbnailKey,
        videoSizeBytes: Number(video.videoSizeBytes),
        createdAt: video.createdAt,
        user: video.user,
      },
      uploadTime,
    });
  } catch (error) {
    console.error('[R2Controller] Video upload error:', error);
    
    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: error.message || 'Failed to upload video',
    });
  }
});

// ============================================================================
// THUMBNAIL UPLOAD
// ============================================================================

/**
 * Upload a thumbnail image to R2
 * Can be standalone or associated with an existing video
 */
export const uploadThumbnailToR2 = asyncHandler(async (req, res) => {
  const thumbnailFile = req.file;
  
  if (!thumbnailFile) {
    return res.status(400).json({
      success: false,
      error: 'NO_FILE',
      message: 'No thumbnail file provided',
    });
  }
  
  const { userId, videoId } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_USER_ID',
      message: 'User ID is required',
    });
  }
  
  // Verify user exists
  const { exists } = await getUserPremiumStatus(userId);
  
  if (!exists) {
    return res.status(404).json({
      success: false,
      error: 'USER_NOT_FOUND',
      message: 'User not found',
    });
  }
  
  try {
    // Upload thumbnail to R2
    const result = await uploadThumbnail(
      thumbnailFile.buffer,
      thumbnailFile.originalname,
      thumbnailFile.mimetype,
      userId
    );
    
    console.log(`[R2Controller] Thumbnail uploaded: ${result.key}`);
    
    // If videoId provided, update the video record
    if (videoId) {
      await prisma.video.update({
        where: { id: videoId },
        data: {
          thumbnail: result.url,
          r2ThumbnailKey: result.key,
          r2ThumbnailEtag: result.etag,
          thumbnailMimeType: thumbnailFile.mimetype,
          thumbnailSizeBytes: thumbnailFile.size,
        },
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Thumbnail uploaded successfully',
      thumbnail: {
        url: result.url,
        key: result.key,
        size: result.size,
        mimeType: thumbnailFile.mimetype,
      },
    });
  } catch (error) {
    console.error('[R2Controller] Thumbnail upload error:', error);
    
    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: error.message || 'Failed to upload thumbnail',
    });
  }
});

// ============================================================================
// PRESIGNED URL GENERATION
// ============================================================================

/**
 * Generate a presigned URL for direct upload from client
 * Useful for large files to avoid server memory usage
 */
export const getPresignedUploadUrl = asyncHandler(async (req, res) => {
  const { fileName, mimeType, userId, type = 'video', fileSize } = req.body;
  
  if (!fileName || !mimeType || !userId) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_PARAMS',
      message: 'fileName, mimeType, and userId are required',
    });
  }
  
  // Verify user and get premium status
  const { exists, isPremium } = await getUserPremiumStatus(userId);
  
  if (!exists) {
    return res.status(404).json({
      success: false,
      error: 'USER_NOT_FOUND',
      message: 'User not found',
    });
  }
  
  // Validate file type
  const typeValidation = validateFileType(mimeType, type === 'video' ? 'video' : 'image');
  if (!typeValidation.valid) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_FILE_TYPE',
      message: typeValidation.error,
    });
  }
  
  // Validate file size if provided
  if (fileSize) {
    const sizeValidation = validateFileSize(
      parseInt(fileSize, 10),
      type === 'video' ? 'video' : 'thumbnail',
      isPremium
    );
    
    if (!sizeValidation.valid) {
      return res.status(413).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: sizeValidation.error,
        maxSize: sizeValidation.maxSize,
        fileSize: parseInt(fileSize, 10),
        isPremium,
        upgradeRequired: !isPremium && type === 'video',
      });
    }
  }
  
  try {
    const prefix = type === 'video' ? STORAGE_PATHS.VIDEOS : STORAGE_PATHS.THUMBNAILS;
    const key = generateObjectKey(prefix, fileName, userId);
    
    const { url } = await getSignedUploadUrl(key, mimeType);
    
    res.json({
      success: true,
      uploadUrl: url,
      key,
      publicUrl: getPublicUrl(key),
      expiresIn: 900, // 15 minutes
    });
  } catch (error) {
    console.error('[R2Controller] Presigned URL error:', error);
    
    res.status(500).json({
      success: false,
      error: 'URL_GENERATION_FAILED',
      message: error.message || 'Failed to generate upload URL',
    });
  }
});

/**
 * Generate a presigned URL for private content access
 */
export const getPresignedDownloadUrl = asyncHandler(async (req, res) => {
  const { key, expiresIn = 3600 } = req.body;
  
  if (!key) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_KEY',
      message: 'Object key is required',
    });
  }
  
  try {
    const url = await getSignedDownloadUrl(key, expiresIn);
    
    res.json({
      success: true,
      url,
      expiresIn,
    });
  } catch (error) {
    console.error('[R2Controller] Signed download URL error:', error);
    
    res.status(500).json({
      success: false,
      error: 'URL_GENERATION_FAILED',
      message: error.message || 'Failed to generate download URL',
    });
  }
});

// ============================================================================
// VALIDATE UPLOAD REQUEST
// ============================================================================

/**
 * Validate an upload request before uploading
 * Check file size and type against user's limits
 */
export const validateUploadRequest = asyncHandler(async (req, res) => {
  const { userId, fileSize, fileName, mimeType, type = 'video' } = req.body;
  
  if (!userId || fileSize === undefined) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_PARAMS',
      message: 'userId and fileSize are required',
    });
  }
  
  // Verify user and get premium status
  const { exists, isPremium } = await getUserPremiumStatus(userId);
  
  if (!exists) {
    return res.status(404).json({
      success: false,
      error: 'USER_NOT_FOUND',
      message: 'User not found',
    });
  }
  
  // Validate file type if provided
  if (mimeType) {
    const typeValidation = validateFileType(mimeType, type === 'video' ? 'video' : 'image');
    if (!typeValidation.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'INVALID_FILE_TYPE',
        message: typeValidation.error,
      });
    }
  }
  
  // Validate file size
  const sizeValidation = validateFileSize(
    parseInt(fileSize, 10),
    type === 'video' ? 'video' : 'thumbnail',
    isPremium
  );
  
  if (!sizeValidation.valid) {
    return res.status(413).json({
      success: false,
      valid: false,
      error: 'FILE_TOO_LARGE',
      message: sizeValidation.error,
      maxSize: sizeValidation.maxSize,
      fileSize: parseInt(fileSize, 10),
      isPremium,
      upgradeRequired: !isPremium && type === 'video',
      premiumMaxSize: FILE_LIMITS.PREMIUM_VIDEO_MAX_SIZE,
    });
  }
  
  res.json({
    success: true,
    valid: true,
    message: 'Upload is allowed',
    maxSize: sizeValidation.maxSize,
    fileSize: parseInt(fileSize, 10),
    isPremium,
  });
});

// ============================================================================
// LIVESTREAM CHUNK UPLOAD
// ============================================================================

/**
 * Upload a livestream recording chunk
 */
export const uploadLivestreamChunk = asyncHandler(async (req, res) => {
  const chunkFile = req.file;
  
  if (!chunkFile) {
    return res.status(400).json({
      success: false,
      error: 'NO_FILE',
      message: 'No chunk data provided',
    });
  }
  
  const { sessionId, chunkIndex, userId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_SESSION_ID',
      message: 'Livestream session ID is required',
    });
  }
  
  try {
    const result = await uploadLivestreamRecording(
      chunkFile.buffer,
      sessionId,
      chunkIndex ? parseInt(chunkIndex, 10) : null,
      chunkFile.mimetype || 'video/mp4'
    );
    
    console.log(`[R2Controller] Livestream chunk uploaded: ${result.key}`);
    
    // Update livestream record if it exists
    if (userId) {
      await prisma.livestream.updateMany({
        where: { sessionId },
        data: {
          r2RecordingKey: result.key,
          recordingSizeBytes: {
            increment: BigInt(chunkFile.size),
          },
        },
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Chunk uploaded successfully',
      chunk: {
        key: result.key,
        size: result.size,
        chunkIndex: chunkIndex ? parseInt(chunkIndex, 10) : 0,
      },
    });
  } catch (error) {
    console.error('[R2Controller] Livestream chunk upload error:', error);
    
    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: error.message || 'Failed to upload chunk',
    });
  }
});

/**
 * Finalize a livestream recording
 * Combines chunks and creates final video record
 */
export const finalizeLivestreamRecording = asyncHandler(async (req, res) => {
  const { sessionId, userId, title, description } = req.body;
  
  if (!sessionId || !userId) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_PARAMS',
      message: 'sessionId and userId are required',
    });
  }
  
  try {
    // Finalize the R2 session
    const result = await finalizeLivestreamSession(sessionId);
    
    console.log(`[R2Controller] Livestream finalized: ${result.recordingUrl}`);
    
    // Update or create livestream record
    const livestream = await prisma.livestream.upsert({
      where: { sessionId },
      update: {
        status: 'ended',
        endedAt: new Date(),
        recordingUrl: result.recordingUrl,
        recordingSizeBytes: BigInt(result.totalSize),
      },
      create: {
        sessionId,
        userId,
        title: title || 'Livestream Recording',
        description: description || '',
        status: 'ended',
        startedAt: new Date(),
        endedAt: new Date(),
        recordingUrl: result.recordingUrl,
        recordingSizeBytes: BigInt(result.totalSize),
      },
    });
    
    // Optionally create a video record for the recording
    const video = await prisma.video.create({
      data: {
        title: title || `Livestream Recording - ${new Date().toLocaleDateString()}`,
        description: description || 'Recorded livestream',
        videoUrl: result.recordingUrl,
        thumbnail: '', // Generate thumbnail later
        userId,
        duration: livestream.durationSeconds || 0,
        r2VideoKey: `${STORAGE_PATHS.LIVESTREAMS}/${sessionId}`,
        videoSizeBytes: BigInt(result.totalSize),
        storageProvider: 'r2',
        isProcessed: true,
        processingStatus: 'completed',
      },
    });
    
    const signedRecordingUrl = video.r2VideoKey
      ? await getSignedDownloadUrl(video.r2VideoKey)
      : video.videoUrl;

    res.json({
      success: true,
      message: 'Livestream recording finalized',
      recording: {
        url: result.recordingUrl,
        totalSize: result.totalSize,
        chunkCount: result.chunkCount,
      },
      video: {
        id: video.id,
        title: video.title,
        videoUrl: signedRecordingUrl,
      },
    });
  } catch (error) {
    console.error('[R2Controller] Livestream finalization error:', error);
    
    res.status(500).json({
      success: false,
      error: 'FINALIZATION_FAILED',
      message: error.message || 'Failed to finalize livestream',
    });
  }
});

// ============================================================================
// AD MEDIA UPLOAD
// ============================================================================

/**
 * Upload ad media (image or video) to R2
 * Supports both images and videos for ad campaigns
 */
export const uploadAdMediaToR2 = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  // Get file from request (can be image or video)
  const mediaFile = req.file;

  if (!mediaFile) {
    return res.status(400).json({
      success: false,
      error: 'NO_FILE',
      message: 'No media file provided',
    });
  }

  const { userId, adId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_USER_ID',
      message: 'User ID is required',
    });
  }

  // Verify user exists
  const { exists, isPremium } = await getUserPremiumStatus(userId);

  if (!exists) {
    return res.status(404).json({
      success: false,
      error: 'USER_NOT_FOUND',
      message: 'User not found',
    });
  }

  // Determine if this is an image or video
  const isVideo = mediaFile.mimetype.startsWith('video/');
  const isImage = mediaFile.mimetype.startsWith('image/');

  if (!isVideo && !isImage) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_FILE_TYPE',
      message: 'File must be an image or video',
    });
  }

  // Validate file size
  const maxSize = isVideo
    ? (isPremium ? FILE_LIMITS.PREMIUM_VIDEO_MAX_SIZE : FILE_LIMITS.FREE_VIDEO_MAX_SIZE)
    : FILE_LIMITS.THUMBNAIL_MAX_SIZE;

  if (mediaFile.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    return res.status(413).json({
      success: false,
      error: 'FILE_TOO_LARGE',
      message: `File size exceeds ${maxSizeMB}MB limit`,
      maxSize,
      fileSize: mediaFile.size,
      isPremium,
      upgradeRequired: !isPremium && isVideo,
    });
  }

  try {
    let result;
    const storagePath = isVideo ? 'ads/videos' : 'ads/images';
    const key = generateObjectKey(storagePath, mediaFile.originalname, userId);

    console.log(`[R2Controller] Starting ad media upload: ${mediaFile.originalname} (${(mediaFile.size / 1024 / 1024).toFixed(2)}MB)`);

    if (isVideo) {
      // Upload video to R2
      result = await uploadVideo(
        mediaFile.buffer,
        mediaFile.originalname,
        mediaFile.mimetype,
        userId,
        { isPremium }
      );
    } else {
      // Upload image to R2
      result = await uploadThumbnail(
        mediaFile.buffer,
        mediaFile.originalname,
        mediaFile.mimetype,
        userId
      );
    }

    console.log(`[R2Controller] Ad media uploaded to R2: ${result.key}`);

    // If adId is provided, update the ad record with R2 metadata (similar to Video model)
    if (adId) {
      const updateData = isVideo
        ? { 
            videoUrl: result.url, 
            thumbnailUrl: result.url,
            // R2 metadata for video
            r2VideoKey: result.key,
            r2VideoEtag: result.etag,
            videoMimeType: mediaFile.mimetype,
            videoSizeBytes: BigInt(mediaFile.size),
            storageProvider: 'r2',
          }
        : { 
            imageUrl: result.url,
            // R2 metadata for image
            r2ImageKey: result.key,
            r2ImageEtag: result.etag,
            imageMimeType: mediaFile.mimetype,
            imageSizeBytes: BigInt(mediaFile.size),
            storageProvider: 'r2',
          };

      await prisma.ad.update({
        where: { id: adId },
        data: updateData,
      });
    }

    const uploadTime = Date.now() - startTime;
    console.log(`[R2Controller] Ad media upload complete in ${uploadTime}ms`);

    res.status(201).json({
      success: true,
      message: 'Ad media uploaded successfully',
      media: {
        url: result.url,
        key: result.key,
        size: mediaFile.size,
        mimeType: mediaFile.mimetype,
        type: isVideo ? 'video' : 'image',
        etag: result.etag,
      },
      uploadTime,
    });
  } catch (error) {
    console.error('[R2Controller] Ad media upload error:', error);

    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: error.message || 'Failed to upload ad media',
    });
  }
});

// ============================================================================
// DELETE VIDEO
// ============================================================================

/**
 * Delete a video file from R2
 */
export const deleteVideoFromR2 = asyncHandler(async (req, res) => {
  const { key } = req.params;
  
  if (!key) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_KEY',
      message: 'Object key is required',
    });
  }
  
  try {
    await deleteFile(key);
    
    // Update database record if this is a video
    await prisma.video.updateMany({
      where: { r2VideoKey: key },
      data: {
        videoUrl: '',
        r2VideoKey: null,
        processingStatus: 'deleted',
      },
    });
    
    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('[R2Controller] Delete error:', error);
    
    res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: error.message || 'Failed to delete file',
    });
  }
});

// ============================================================================
// AVATAR UPLOAD
// ============================================================================

/**
 * Upload a user avatar to R2 and update the user record atomically.
 * Uses req.user.id from JWT — avatars are always self-uploads.
 */
export const uploadAvatarToR2 = asyncHandler(async (req, res) => {
  const avatarFile = req.file;

  if (!avatarFile) {
    return res.status(400).json({
      success: false,
      error: 'NO_FILE',
      message: 'No avatar file provided',
    });
  }

  const userId = req.user.id;

  try {
    // Upload avatar to R2
    const result = await uploadAvatar(
      avatarFile.buffer,
      avatarFile.originalname,
      avatarFile.mimetype,
      userId
    );

    console.log(`[R2Controller] Avatar uploaded: ${result.key} for user ${userId}`);

    // Atomically update AppUser.avatar with the R2 public URL
    const updatedUser = await prisma.appUser.update({
      where: { id: userId },
      data: {
        avatar: result.url,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        points: true,
        role: true,
        subscriptionStatus: true,
        surveysubscriptionStatus: true,
        twoFactorEnabled: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar: {
        url: result.url,
        key: result.key,
        size: result.size,
        mimeType: avatarFile.mimetype,
      },
      user: updatedUser,
    });
  } catch (error) {
    console.error('[R2Controller] Avatar upload error:', error);

    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: error.message || 'Failed to upload avatar',
    });
  }
});

export default {
  uploadVideoToR2,
  uploadThumbnailToR2,
  uploadAvatarToR2,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  validateUploadRequest,
  uploadLivestreamChunk,
  finalizeLivestreamRecording,
  deleteVideoFromR2,
  uploadAdMediaToR2,
};
