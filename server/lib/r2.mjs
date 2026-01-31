/**
 * Cloudflare R2 Storage Client
 * 
 * Industry-standard S3-compatible storage integration for:
 * - Video uploads (multipart for large files)
 * - Thumbnail uploads
 * - Livestream recordings
 * 
 * Features:
 * - Signed URL generation for secure access
 * - Multipart upload support for large files
 * - MIME type validation
 * - File size limits enforcement
 * - CDN-friendly public URLs
 * 
 * @see https://developers.cloudflare.com/r2/api/s3/
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g., https://cdn.yourdomain.com or R2 public bucket URL

// Validate required environment variables
const requiredEnvVars = {
  CLOUDFLARE_ACCOUNT_ID: R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: R2_BUCKET_NAME,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0 && process.env.NODE_ENV !== 'test') {
  console.warn(`[R2] Warning: Missing environment variables: ${missingVars.join(', ')}`);
}

// ============================================================================
// R2 CLIENT SETUP
// ============================================================================

/**
 * S3-compatible client for Cloudflare R2
 * Uses the official AWS SDK with R2 endpoint
 */
export const r2Client = new S3Client({
  region: 'auto', // R2 uses 'auto' region
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
});

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

/** Allowed video MIME types */
export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/webm',
  'video/x-matroska', // .mkv
  'video/3gpp',
  'video/x-m4v',
];

/** Allowed image MIME types for thumbnails */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/** File size limits */
export const FILE_LIMITS = {
  FREE_VIDEO_MAX_SIZE: 20 * 1024 * 1024, // 20MB
  PREMIUM_VIDEO_MAX_SIZE: 500 * 1024 * 1024, // 500MB
  THUMBNAIL_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  LIVESTREAM_CHUNK_SIZE: 5 * 1024 * 1024, // 5MB per chunk
  MULTIPART_THRESHOLD: 10 * 1024 * 1024, // Use multipart for files > 10MB
};

/** URL expiry times */
export const URL_EXPIRY = {
  SIGNED_URL_EXPIRY: 3600, // 1 hour for signed URLs
  UPLOAD_URL_EXPIRY: 900, // 15 minutes for upload URLs
  DOWNLOAD_URL_EXPIRY: 86400, // 24 hours for download URLs
};

/** Storage paths/prefixes */
export const STORAGE_PATHS = {
  VIDEOS: 'videos',
  THUMBNAILS: 'thumbnails',
  LIVESTREAMS: 'livestreams',
  TEMP: 'temp',
};

/**
 * @typedef {Object} UploadResult
 * @property {string} key - R2 object key
 * @property {string} url - Public or signed URL
 * @property {string} bucket - Bucket name
 * @property {number} size - File size in bytes
 * @property {string} mimeType - File MIME type
 * @property {string} etag - ETag for cache validation
 */

/**
 * @typedef {Object} MultipartUploadSession
 * @property {string} uploadId - Multipart upload ID
 * @property {string} key - Object key
 * @property {Array<{PartNumber: number, ETag: string}>} parts - Uploaded parts
 */

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique object key for storage
 * @param {string} prefix - Storage path prefix (videos, thumbnails, etc.)
 * @param {string} originalName - Original filename
 * @param {string} [userId] - Optional user ID for namespacing
 * @returns {string} Unique object key
 */
export function generateObjectKey(prefix, originalName, userId = null) {
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString('hex');
  const extension = originalName.split('.').pop()?.toLowerCase() || 'bin';
  const sanitizedName = originalName
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Sanitize
    .substring(0, 50); // Limit length
  
  const userPrefix = userId ? `${userId}/` : '';
  return `${prefix}/${userPrefix}${timestamp}_${randomId}_${sanitizedName}.${extension}`;
}

/**
 * Get public URL for an object
 * @param {string} key - Object key
 * @returns {string} Public URL
 */
export function getPublicUrl(key) {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  // Fallback to R2 public URL format (requires public bucket)
  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

/**
 * Validate file type against allowed types
 * @param {string} mimeType - File MIME type
 * @param {'video' | 'image'} type - Expected file type
 * @returns {{valid: boolean, error?: string}}
 */
export function validateFileType(mimeType, type) {
  const allowedTypes = type === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
  
  if (!allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid ${type} type. Allowed: ${allowedTypes.join(', ')}`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate file size against limits
 * @param {number} size - File size in bytes
 * @param {'video' | 'thumbnail'} type - File type
 * @param {boolean} isPremium - Whether user has premium access
 * @returns {{valid: boolean, error?: string, maxSize?: number}}
 */
export function validateFileSize(size, type, isPremium = false) {
  let maxSize;
  
  if (type === 'thumbnail') {
    maxSize = FILE_LIMITS.THUMBNAIL_MAX_SIZE;
  } else {
    maxSize = isPremium 
      ? FILE_LIMITS.PREMIUM_VIDEO_MAX_SIZE 
      : FILE_LIMITS.FREE_VIDEO_MAX_SIZE;
  }
  
  if (size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
      maxSize,
    };
  }
  
  return { valid: true, maxSize };
}

// ============================================================================
// CORE UPLOAD FUNCTIONS
// ============================================================================

/**
 * Upload a file to R2 (single-part upload for small files)
 * @param {Buffer} buffer - File data
 * @param {string} key - Object key
 * @param {string} mimeType - File MIME type
 * @param {Object} [metadata] - Optional metadata
 * @returns {Promise<UploadResult>}
 */
export async function uploadFile(buffer, key, mimeType, metadata = {}) {
  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        ...metadata,
        uploadedAt: new Date().toISOString(),
      },
      // Enable CDN caching
      CacheControl: 'public, max-age=31536000, immutable',
    });

    const result = await r2Client.send(command);

    return {
      key,
      url: getPublicUrl(key),
      bucket: R2_BUCKET_NAME,
      size: buffer.length,
      mimeType,
      etag: result.ETag?.replace(/"/g, '') || '',
    };
  } catch (error) {
    console.error('[R2] Upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Upload a video file with automatic multipart for large files
 * @param {Buffer} buffer - Video data
 * @param {string} originalName - Original filename
 * @param {string} mimeType - File MIME type
 * @param {string} [userId] - User ID for namespacing
 * @param {Object} [options] - Additional options
 * @returns {Promise<UploadResult>}
 */
export async function uploadVideo(buffer, originalName, mimeType, userId = null, options = {}) {
  // Validate file type
  const typeValidation = validateFileType(mimeType, 'video');
  if (!typeValidation.valid) {
    throw new Error(typeValidation.error);
  }
  
  // Validate file size
  const sizeValidation = validateFileSize(buffer.length, 'video', options.isPremium);
  if (!sizeValidation.valid) {
    throw new Error(sizeValidation.error);
  }
  
  const key = generateObjectKey(STORAGE_PATHS.VIDEOS, originalName, userId);
  
  // Use multipart for large files
  if (buffer.length > FILE_LIMITS.MULTIPART_THRESHOLD) {
    return uploadMultipart(buffer, key, mimeType, options.metadata);
  }
  
  return uploadFile(buffer, key, mimeType, options.metadata);
}

/**
 * Upload a thumbnail image
 * @param {Buffer} buffer - Image data
 * @param {string} originalName - Original filename
 * @param {string} mimeType - File MIME type
 * @param {string} [userId] - User ID for namespacing
 * @returns {Promise<UploadResult>}
 */
export async function uploadThumbnail(buffer, originalName, mimeType, userId = null) {
  // Validate file type
  const typeValidation = validateFileType(mimeType, 'image');
  if (!typeValidation.valid) {
    throw new Error(typeValidation.error);
  }
  
  // Validate file size
  const sizeValidation = validateFileSize(buffer.length, 'thumbnail');
  if (!sizeValidation.valid) {
    throw new Error(sizeValidation.error);
  }
  
  const key = generateObjectKey(STORAGE_PATHS.THUMBNAILS, originalName, userId);
  return uploadFile(buffer, key, mimeType);
}

/**
 * Upload a livestream recording or chunk
 * @param {Buffer} buffer - Recording data
 * @param {string} sessionId - Livestream session ID
 * @param {string} [chunkIndex] - Optional chunk index for chunked uploads
 * @param {string} mimeType - File MIME type
 * @returns {Promise<UploadResult>}
 */
export async function uploadLivestreamRecording(buffer, sessionId, chunkIndex = null, mimeType = 'video/mp4') {
  const filename = chunkIndex !== null 
    ? `${sessionId}_chunk_${chunkIndex}.mp4`
    : `${sessionId}_recording.mp4`;
  
  const key = `${STORAGE_PATHS.LIVESTREAMS}/${sessionId}/${filename}`;
  return uploadFile(buffer, key, mimeType, { sessionId });
}

// ============================================================================
// MULTIPART UPLOAD (For large files > 10MB)
// ============================================================================

/**
 * Upload a large file using multipart upload
 * @param {Buffer} buffer - File data
 * @param {string} key - Object key
 * @param {string} mimeType - File MIME type
 * @param {Object} [metadata] - Optional metadata
 * @returns {Promise<UploadResult>}
 */
export async function uploadMultipart(buffer, key, mimeType, metadata = {}) {
  const chunkSize = FILE_LIMITS.LIVESTREAM_CHUNK_SIZE;
  let uploadId;
  
  try {
    // 1. Initiate multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: mimeType,
      Metadata: {
        ...metadata,
        uploadedAt: new Date().toISOString(),
      },
      CacheControl: 'public, max-age=31536000, immutable',
    });
    
    const createResult = await r2Client.send(createCommand);
    uploadId = createResult.UploadId;
    
    // 2. Upload parts
    const parts = [];
    const totalParts = Math.ceil(buffer.length / chunkSize);
    
    for (let i = 0; i < totalParts; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, buffer.length);
      const chunk = buffer.slice(start, end);
      
      const uploadPartCommand = new UploadPartCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        PartNumber: i + 1,
        Body: chunk,
      });
      
      const partResult = await r2Client.send(uploadPartCommand);
      parts.push({
        PartNumber: i + 1,
        ETag: partResult.ETag,
      });
      
      console.log(`[R2] Uploaded part ${i + 1}/${totalParts}`);
    }
    
    // 3. Complete multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });
    
    const completeResult = await r2Client.send(completeCommand);
    
    return {
      key,
      url: getPublicUrl(key),
      bucket: R2_BUCKET_NAME,
      size: buffer.length,
      mimeType,
      etag: completeResult.ETag?.replace(/"/g, '') || '',
    };
  } catch (error) {
    // Abort multipart upload on failure
    if (uploadId) {
      try {
        await r2Client.send(new AbortMultipartUploadCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          UploadId: uploadId,
        }));
        console.log('[R2] Aborted multipart upload due to error');
      } catch (abortError) {
        console.error('[R2] Failed to abort multipart upload:', abortError);
      }
    }
    
    console.error('[R2] Multipart upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

// ============================================================================
// SIGNED URL GENERATION
// ============================================================================

/**
 * Generate a signed URL for private content access
 * @param {string} key - Object key
 * @param {number} [expiresIn] - URL expiry in seconds (default: 1 hour)
 * @returns {Promise<string>} Signed URL
 */
export async function getSignedDownloadUrl(key, expiresIn = URL_EXPIRY.SIGNED_URL_EXPIRY) {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    
    return await getSignedUrl(r2Client, command, { expiresIn });
  } catch (error) {
    console.error('[R2] Signed URL generation error:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

/**
 * Generate a signed URL for direct upload (presigned PUT)
 * @param {string} key - Object key
 * @param {string} mimeType - Expected MIME type
 * @param {number} [expiresIn] - URL expiry in seconds (default: 15 minutes)
 * @returns {Promise<{url: string, key: string}>} Presigned upload URL and key
 */
export async function getSignedUploadUrl(key, mimeType, expiresIn = URL_EXPIRY.UPLOAD_URL_EXPIRY) {
  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    });
    
    const url = await getSignedUrl(r2Client, command, { expiresIn });
    
    return { url, key };
  } catch (error) {
    console.error('[R2] Presigned upload URL generation error:', error);
    throw new Error(`Failed to generate upload URL: ${error.message}`);
  }
}

// ============================================================================
// FILE MANAGEMENT
// ============================================================================

/**
 * Delete a file from R2
 * @param {string} key - Object key
 * @returns {Promise<boolean>}
 */
export async function deleteFile(key) {
  try {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch (error) {
    console.error('[R2] Delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Check if a file exists in R2
 * @param {string} key - Object key
 * @returns {Promise<boolean>}
 */
export async function fileExists(key) {
  try {
    await r2Client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Get file metadata from R2
 * @param {string} key - Object key
 * @returns {Promise<{size: number, mimeType: string, lastModified: Date, etag: string} | null>}
 */
export async function getFileMetadata(key) {
  try {
    const result = await r2Client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
    
    return {
      size: result.ContentLength || 0,
      mimeType: result.ContentType || 'application/octet-stream',
      lastModified: result.LastModified || new Date(),
      etag: result.ETag?.replace(/"/g, '') || '',
    };
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * List files in a prefix/folder
 * @param {string} prefix - Path prefix
 * @param {number} [maxKeys] - Maximum number of keys to return
 * @returns {Promise<Array<{key: string, size: number, lastModified: Date}>>}
 */
export async function listFiles(prefix, maxKeys = 1000) {
  try {
    const result = await r2Client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: maxKeys,
    }));
    
    return (result.Contents || []).map(item => ({
      key: item.Key,
      size: item.Size || 0,
      lastModified: item.LastModified || new Date(),
    }));
  } catch (error) {
    console.error('[R2] List files error:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }
}

// ============================================================================
// LIVESTREAM HELPERS
// ============================================================================

/**
 * Create a livestream upload session
 * @param {string} sessionId - Session ID
 * @returns {Promise<{sessionId: string, uploadPrefix: string}>}
 */
export async function createLivestreamSession(sessionId) {
  const uploadPrefix = `${STORAGE_PATHS.LIVESTREAMS}/${sessionId}`;
  
  // Create a placeholder to mark the session
  await uploadFile(
    Buffer.from(JSON.stringify({ 
      sessionId, 
      startedAt: new Date().toISOString(),
      status: 'active',
    })),
    `${uploadPrefix}/_session.json`,
    'application/json'
  );
  
  return { sessionId, uploadPrefix };
}

/**
 * Finalize a livestream session (merge chunks if needed)
 * @param {string} sessionId - Session ID
 * @returns {Promise<{recordingUrl: string, totalSize: number}>}
 */
export async function finalizeLivestreamSession(sessionId) {
  const prefix = `${STORAGE_PATHS.LIVESTREAMS}/${sessionId}`;
  const files = await listFiles(prefix);
  
  // Find all chunk files
  const chunks = files
    .filter(f => f.key.includes('_chunk_') || f.key.endsWith('_recording.mp4'))
    .sort((a, b) => a.key.localeCompare(b.key));
  
  if (chunks.length === 0) {
    throw new Error('No recording found for session');
  }
  
  // If single recording, return it directly
  if (chunks.length === 1) {
    return {
      recordingUrl: getPublicUrl(chunks[0].key),
      totalSize: chunks[0].size,
    };
  }
  
  // Multiple chunks - return the final merged file URL
  // Note: For production, you'd want to merge chunks server-side or use a video processing service
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  
  return {
    recordingUrl: getPublicUrl(chunks[chunks.length - 1].key),
    totalSize,
    chunkCount: chunks.length,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Client
  r2Client,
  
  // Upload functions
  uploadFile,
  uploadVideo,
  uploadThumbnail,
  uploadLivestreamRecording,
  uploadMultipart,
  
  // URL generation
  getPublicUrl,
  getSignedDownloadUrl,
  getSignedUploadUrl,
  
  // File management
  deleteFile,
  fileExists,
  getFileMetadata,
  listFiles,
  
  // Validation
  validateFileType,
  validateFileSize,
  generateObjectKey,
  
  // Livestream
  createLivestreamSession,
  finalizeLivestreamSession,
  
  // Constants
  ALLOWED_VIDEO_TYPES,
  ALLOWED_IMAGE_TYPES,
  FILE_LIMITS,
  URL_EXPIRY,
  STORAGE_PATHS,
};
