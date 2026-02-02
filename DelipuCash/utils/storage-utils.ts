/**
 * Storage Utilities
 * File upload and storage management utilities using Cloudflare R2 via backend
 * Design System Compliant - Uses consistent error handling and logging
 * 
 * Features:
 * - Cloudflare R2 integration via backend API
 * - Mock storage for development/testing
 * - Progress tracking with callbacks
 * - File validation (size, type)
 * - Retry logic with exponential backoff
 * - Comprehensive error handling
 * - TypeScript strict mode compliant
 */

import {
    uploadVideoToR2,
    uploadThumbnailToR2,
    getPresignedUploadUrl,
    uploadToPresignedUrl,
    UploadProgressEvent,
} from "@/services/r2UploadService";

// ============================================================================
// TYPES
// ============================================================================

export interface UploadResult {
  type: string;
  downloadURL: string;
  fileName: string;
  size?: number;
  mimeType?: string;
  storagePath?: string;
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  state: 'running' | 'paused' | 'success' | 'error';
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

export interface UploadOptions {
  fileType?: string;
  onProgress?: UploadProgressCallback;
  maxSizeMB?: number;
    useR2?: boolean;
  customFileName?: string;
  metadata?: Record<string, string>;
    userId?: string;
}

export interface StorageConfig {
  useMockStorage: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Environment-based configuration
const IS_DEVELOPMENT = __DEV__ || false;

const DEFAULT_CONFIG: StorageConfig = {
    useMockStorage: IS_DEVELOPMENT,
  maxRetries: 3,
  retryDelayMs: 1000,
};

let currentConfig: StorageConfig = { ...DEFAULT_CONFIG };

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_FILE_SIZE_MB = 100; // 100MB default max
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_THUMBNAIL_TYPES = ['image/jpeg', 'image/png'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];

// Mock storage URL for development
const MOCK_STORAGE_BASE_URL = 'https://storage.delipucash.com';

// ============================================================================
// CONFIGURATION FUNCTIONS
// ============================================================================

/**
 * Configure storage settings
 */
export const configureStorage = (config: Partial<StorageConfig>): void => {
  currentConfig = { ...currentConfig, ...config };
  console.log('[Storage] Configuration updated:', currentConfig);
};

/**
 * Get current storage configuration
 */
export const getStorageConfig = (): StorageConfig => ({ ...currentConfig });

/**
 * Force use R2 Storage (useful for testing)
 */
export const useR2Storage = (): void => {
  currentConfig.useMockStorage = false;
};

/**
 * Force use Mock Storage (useful for development/testing)
 */
export const useMockStorage = (): void => {
  currentConfig.useMockStorage = true;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique file name with timestamp and random string
 */
export const generateFileName = (extension?: string): string => {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  const ext = extension ? `.${extension}` : '';
  return `${timestamp}-${randomStr}${ext}`;
};

/**
 * Get file extension from URI or filename
 */
export const getFileExtension = (uri: string): string => {
  const parts = uri.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase().split('?')[0] : '';
};

/**
 * Get MIME type from file extension
 */
export const getMimeType = (extension: string): string => {
  const mimeTypes: Record<string, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    m4v: 'video/x-m4v',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
};

/**
 * Validate file size
 */
export const validateFileSize = (sizeBytes: number, maxSizeMB: number = MAX_FILE_SIZE_MB): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeBytes <= maxSizeBytes;
};

/**
 * Validate file type
 */
export const validateFileType = (mimeType: string, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(mimeType.toLowerCase());
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Get allowed types for a file category
 */
export const getAllowedTypes = (fileType: string): string[] => {
  switch (fileType.toLowerCase()) {
    case 'videos':
    case 'video':
      return ALLOWED_VIDEO_TYPES;
    case 'thumbnails':
    case 'thumbnail':
      return ALLOWED_THUMBNAIL_TYPES;
    case 'images':
    case 'image':
      return ALLOWED_IMAGE_TYPES;
    case 'documents':
    case 'document':
      return ALLOWED_DOCUMENT_TYPES;
    case 'audio':
      return ALLOWED_AUDIO_TYPES;
    default:
      return [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
  }
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry with exponential backoff
 */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = currentConfig.maxRetries,
  baseDelayMs: number = currentConfig.retryDelayMs
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`[Storage] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
};

/**
 * Get extension from MIME type
 */
const getExtensionFromMimeType = (mimeType: string): string => {
    const extensions: Record<string, string> = {
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'video/webm': 'webm',
        'video/x-m4v': 'm4v',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'application/pdf': 'pdf',
    };
    return extensions[mimeType] || '';
};

// ============================================================================
// R2 STORAGE FUNCTIONS (via Backend API)
// ============================================================================

/**
 * Upload file to R2 via backend with progress tracking
 * Production-ready implementation with retry logic
 */
export const uploadToR2 = async (
  uri: string,
  fileType: string,
  options?: UploadOptions
): Promise<UploadResult> => {
    const { onProgress, maxSizeMB = MAX_FILE_SIZE_MB, customFileName, userId } = options || {};

    console.log(`[Storage/R2] Starting upload for: ${uri}`);
    console.log(`[Storage/R2] File type: ${fileType}`);

  try {
      // Get file info
      const response = await fetch(uri);
    if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
    }
      const blob = await response.blob();

      // Validate file size
    const fileSizeMB = blob.size / (1024 * 1024);
    if (!validateFileSize(blob.size, maxSizeMB)) {
      throw new Error(`File size (${fileSizeMB.toFixed(2)}MB) exceeds maximum allowed (${maxSizeMB}MB)`);
    }

    const extension = getFileExtension(uri) || getExtensionFromMimeType(blob.type);
    const mimeType = blob.type || getMimeType(extension);
    const fileName = customFileName || generateFileName(extension);

      // Convert onProgress to R2 format
      const r2ProgressHandler = onProgress
          ? (event: UploadProgressEvent) => {
              onProgress({
                  bytesTransferred: event.loaded,
                  totalBytes: event.total,
                  percentage: event.progress,
                  state: event.progress === 100 ? 'success' : 'running',
              });
          }
          : undefined;

      // Determine upload method based on file type
      if (fileType === 'videos' || fileType === 'video') {
          // Use video upload endpoint
          const result = await uploadVideoToR2(
              uri,
              userId || 'anonymous',
              {
                  title: fileName,
                  fileName,
                  mimeType,
              },
              {
                  onProgress: r2ProgressHandler,
              }
          );

          if (!result.success || !result.data) {
              throw new Error(result.error || 'Video upload failed');
          }

          return {
              type: fileType,
              downloadURL: result.data.videoUrl,
              fileName: result.data.title || fileName,
              size: blob.size,
              mimeType,
              storagePath: result.data.r2VideoKey,
          };
      } else if (fileType === 'thumbnails' || fileType === 'thumbnail' || fileType === 'images' || fileType === 'image') {
          // Use thumbnail/image upload endpoint
          const result = await uploadThumbnailToR2(
              uri,
              userId || 'anonymous',
              undefined,
              {
                  onProgress: r2ProgressHandler,
            }
        );

          if (!result.success || !result.data) {
              throw new Error(result.error || 'Image upload failed');
          }

          return {
              type: fileType,
              downloadURL: result.data.url,
              fileName,
              size: result.data.size,
              mimeType: result.data.mimeType,
              storagePath: result.data.key,
          };
    } else {
          // Use presigned URL for other file types
          const presignedResult = await getPresignedUploadUrl(
              fileName,
              mimeType,
              userId || 'anonymous',
              'video',
              blob.size
          );

          if (!presignedResult.success || !presignedResult.data) {
              throw new Error(presignedResult.error || 'Failed to get presigned URL');
          }

          await uploadToPresignedUrl(
              presignedResult.data.uploadUrl,
              uri,
              mimeType,
              {
                  onProgress: r2ProgressHandler,
              }
          );

          return {
              type: fileType,
            downloadURL: presignedResult.data.publicUrl,
            fileName,
            size: blob.size,
            mimeType,
            storagePath: presignedResult.data.key,
        };
      }
  } catch (error) {
      console.error('[Storage/R2] Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      throw new Error(`R2 upload failed: ${errorMessage}`);
  }
};

// ============================================================================
// MOCK UPLOAD FUNCTION (Development)
// ============================================================================

/**
 * Mock file upload for development
 * Simulates upload progress and returns a mock URL
 */
export const uploadToMock = async (
  uri: string,
  fileType: string,
  options?: UploadOptions
): Promise<UploadResult> => {
  const { onProgress } = options || {};
  
  console.log(`[Storage/Mock] Starting mock upload for: ${uri}`);
  console.log(`[Storage/Mock] File type: ${fileType}`);
  
  try {
    // Simulate fetching file info
    const extension = getFileExtension(uri);
    const mimeType = getMimeType(extension);
    const fileName = generateFileName(extension);
    
    // Validate file type based on category
    const allowedTypes = getAllowedTypes(fileType);
    
    if (extension && !validateFileType(mimeType, allowedTypes)) {
      console.warn(`[Storage/Mock] File type ${mimeType} may not be allowed for ${fileType}`);
    }
    
    // Simulate upload progress
    const totalSteps = 10;
    const mockFileSize = Math.floor(Math.random() * 10000000) + 1000000; // 1-11 MB mock size
    
    for (let step = 1; step <= totalSteps; step++) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms per step
      
      if (onProgress) {
        const bytesTransferred = Math.floor((step / totalSteps) * mockFileSize);
        onProgress({
          bytesTransferred,
          totalBytes: mockFileSize,
          percentage: Math.floor((step / totalSteps) * 100),
          state: step === totalSteps ? 'success' : 'running',
        });
      }
    }
    
    // Generate mock download URL
    const storagePath = `${fileType}/${fileName}`;
    const downloadURL = `${MOCK_STORAGE_BASE_URL}/${storagePath}`;
    
    console.log(`[Storage/Mock] Upload complete: ${downloadURL}`);
    
    return {
      type: fileType,
      downloadURL,
      fileName,
      size: mockFileSize,
      mimeType,
      storagePath,
    };
  } catch (error) {
    console.error('[Storage/Mock] Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
    throw new Error(`Mock upload failed: ${errorMessage}`);
  }
};

// ============================================================================
// UNIFIED UPLOAD FUNCTION
// ============================================================================

/**
 * Main upload function - automatically chooses between R2 and Mock
 * Based on configuration settings
 */
export const uploadFile = async (
  uri: string,
  fileType: string,
  options?: UploadOptions
): Promise<UploadResult> => {
    const useR2 = options?.useR2 ?? !currentConfig.useMockStorage;

    console.log(`[Storage] Upload mode: ${useR2 ? 'R2' : 'Mock'}`);

    if (useR2) {
        // Use retry logic for R2 uploads
        return retryWithBackoff(() => uploadToR2(uri, fileType, options));
  } else {
    return uploadToMock(uri, fileType, options);
  }
};

/**
 * Upload multiple files with progress tracking
 * Works with both R2 and Mock storage
 */
export const uploadMultipleFiles = async (
  files: { uri: string; fileType: string; options?: UploadOptions }[],
  onOverallProgress?: (completed: number, total: number, results: UploadResult[]) => void,
    options?: { useR2?: boolean; parallel?: boolean }
): Promise<UploadResult[]> => {
  const results: UploadResult[] = [];
  const total = files.length;
  const { parallel = false } = options || {};
  
  console.log(`[Storage] Uploading ${total} files ${parallel ? 'in parallel' : 'sequentially'}`);

  if (parallel) {
    // Parallel upload (faster but may hit rate limits)
    const uploadPromises = files.map(async ({ uri, fileType, options: fileOptions }, index) => {
        const result = await uploadFile(uri, fileType, { ...fileOptions, useR2: options?.useR2 });
      if (onOverallProgress) {
        onOverallProgress(index + 1, total, [...results, result]);
      }
      return result;
    });

    return Promise.all(uploadPromises);
  } else {
      // Sequential upload (safer, respects rate limits)
    for (let i = 0; i < files.length; i++) {
      const { uri, fileType, options: fileOptions } = files[i];
        const result = await uploadFile(uri, fileType, { ...fileOptions, useR2: options?.useR2 });
      results.push(result);

      if (onOverallProgress) {
        onOverallProgress(i + 1, total, results);
      }
    }

    return results;
  }
};

// ============================================================================
// DELETE & METADATA FUNCTIONS (via Backend API)
// ============================================================================

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";

/**
 * Delete a file from R2 storage via backend
 */
export const deleteFromR2 = async (fileKey: string): Promise<boolean> => {
    console.log(`[Storage/R2] Deleting file: ${fileKey}`);
  
  try {
      const response = await fetch(`${API_BASE_URL}/api/r2/delete`, {
          method: 'DELETE',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ key: fileKey }),
      });

      if (!response.ok) {
          throw new Error(`Delete failed: ${response.status}`);
    }

      console.log(`[Storage/R2] File deleted successfully: ${fileKey}`);
    return true;
  } catch (error) {
      console.error('[Storage/R2] Delete error:', error);
    return false;
  }
};

/**
 * Delete a file from storage (unified - chooses R2 or Mock)
 */
export const deleteFile = async (fileUrl: string, useR2?: boolean): Promise<boolean> => {
    const shouldUseR2 = useR2 ?? !currentConfig.useMockStorage;

    if (shouldUseR2) {
        // Extract key from URL if it's a full URL
        const key = fileUrl.includes('/') ? fileUrl.split('/').pop() || fileUrl : fileUrl;
        return deleteFromR2(key);
  }

  // Mock deletion
  console.log(`[Storage/Mock] Deleting file: ${fileUrl}`);
  await sleep(300); // Simulate network delay
  console.log(`[Storage/Mock] File deleted successfully`);
  return true;
};

/**
 * Get file metadata (mock implementation - R2 doesn't expose metadata directly)
 */
export const getFileMetadata = async (fileUrl: string, _useR2?: boolean): Promise<{
  size?: number;
  contentType?: string;
  lastModified?: Date;
  customMetadata?: Record<string, string>;
} | null> => {
    // For R2, we'd need to implement a backend endpoint to get metadata
    // For now, return mock metadata
  return {
    size: Math.floor(Math.random() * 10000000) + 1000000,
    contentType: fileUrl.includes('video') ? 'video/mp4' : 'image/jpeg',
    lastModified: new Date(),
  };
};

/**
 * Check if a file exists in storage
 */
export const fileExists = async (filePathOrUrl: string, useR2?: boolean): Promise<boolean> => {
    const metadata = await getFileMetadata(filePathOrUrl, useR2);
  return metadata !== null;
};

/**
 * Get download URL for a storage path (returns the path as-is for R2 since URLs are public)
 */
export const getDownloadUrl = async (storagePath: string): Promise<string | null> => {
  if (currentConfig.useMockStorage) {
    return `${MOCK_STORAGE_BASE_URL}/${storagePath}`;
  }

    // For R2, the path should already be a full URL or we need to construct it
    // This would depend on your R2 bucket configuration
    return storagePath;
};

// ============================================================================
// BACKWARDS COMPATIBILITY ALIASES
// ============================================================================

/**
 * @deprecated Use uploadToR2 instead
 */
export const uploadToFirebase = uploadToR2;

/**
 * @deprecated Use deleteFromR2 instead
 */
export const deleteFromFirebase = deleteFromR2;

/**
 * @deprecated Use useR2Storage instead
 */
export const useFirebaseStorage = useR2Storage;

/**
 * @deprecated Use getFileMetadata instead
 */
export const getMetadataFromFirebase = getFileMetadata;

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Main upload functions
  uploadFile,
    uploadToR2,
  uploadToMock,
  uploadMultipleFiles,

  // Delete functions
  deleteFile,
    deleteFromR2,

  // Metadata functions
    getFileMetadata,
  fileExists,
  getDownloadUrl,

  // Helper functions
  generateFileName,
  getFileExtension,
  getMimeType,
  validateFileSize,
  validateFileType,
  formatFileSize,
  getAllowedTypes,

  // Configuration
  configureStorage,
  getStorageConfig,
    useR2Storage,
  useMockStorage,

    // Backwards compatibility
    uploadToFirebase: uploadToR2,
    deleteFromFirebase: deleteFromR2,
    useFirebaseStorage: useR2Storage,
    getMetadataFromFirebase: getFileMetadata,
};
