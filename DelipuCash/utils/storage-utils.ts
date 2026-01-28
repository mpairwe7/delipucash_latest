/**
 * Storage Utilities
 * File upload and storage management utilities with Firebase Storage support
 * Design System Compliant - Uses consistent error handling and logging
 * 
 * Features:
 * - Firebase Storage integration for production
 * - Mock storage for development/testing
 * - Progress tracking with callbacks
 * - File validation (size, type)
 * - Retry logic with exponential backoff
 * - Comprehensive error handling
 * - TypeScript strict mode compliant
 */

import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject, getMetadata } from "firebase/storage";
import { storage } from "@/firebaseConfig";

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
  useFirebase?: boolean;
  customFileName?: string;
  metadata?: Record<string, string>;
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
// Set to false to use Firebase Storage in production
const IS_DEVELOPMENT = __DEV__ || false;

const DEFAULT_CONFIG: StorageConfig = {
  useMockStorage: IS_DEVELOPMENT, // Use mock in development, Firebase in production
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
 * Force use Firebase Storage (useful for testing)
 */
export const useFirebaseStorage = (): void => {
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
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
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

// ============================================================================
// FIREBASE STORAGE FUNCTIONS
// ============================================================================

/**
 * Upload file to Firebase Storage with progress tracking
 * Production-ready implementation with retry logic
 */
export const uploadToFirebase = async (
  uri: string,
  fileType: string,
  options?: UploadOptions
): Promise<UploadResult> => {
  const { onProgress, maxSizeMB = MAX_FILE_SIZE_MB, customFileName, metadata = {} } = options || {};

  console.log(`[Storage/Firebase] Starting upload for: ${uri}`);
  console.log(`[Storage/Firebase] File type: ${fileType}`);

  try {
    // Step 1: Fetch the file from URI and convert to Blob
    console.log(`[Storage/Firebase] Fetching file from URI...`);
    const response = await fetch(uri);

    if (!response.ok) {
      console.error(`[Storage/Firebase] Network response failed. Status: ${response.status}`);
      throw new Error(`Network response was not ok: ${response.status}`);
    }

    const blob = await response.blob();
    console.log(`[Storage/Firebase] Blob created - Size: ${blob.size} bytes, Type: ${blob.type}`);

    // Step 2: Validate file size
    const fileSizeMB = blob.size / (1024 * 1024);
    if (!validateFileSize(blob.size, maxSizeMB)) {
      throw new Error(`File size (${fileSizeMB.toFixed(2)}MB) exceeds maximum allowed (${maxSizeMB}MB)`);
    }

    // Step 3: Get file metadata
    const extension = getFileExtension(uri) || getExtensionFromMimeType(blob.type);
    const mimeType = blob.type || getMimeType(extension);
    const fileName = customFileName || generateFileName(extension);

    // Step 4: Validate file type
    const allowedTypes = getAllowedTypes(fileType);
    if (!validateFileType(mimeType, allowedTypes)) {
      console.warn(`[Storage/Firebase] File type ${mimeType} may not be optimal for ${fileType}`);
    }

    // Step 5: Create storage reference
    const storagePath = `${fileType}/${fileName}`;
    const storageRef = ref(storage, storagePath);
    console.log(`[Storage/Firebase] Storage path: ${storagePath}`);

    // Step 6: Upload with progress tracking using uploadBytesResumable
    let downloadURL: string;

    if (onProgress) {
      // Use resumable upload for progress tracking
      const uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: mimeType,
        customMetadata: metadata,
      });

      downloadURL = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const percentage = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress({
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              percentage,
              state: snapshot.state === 'running' ? 'running' :
                snapshot.state === 'paused' ? 'paused' : 'running',
            });
            console.log(`[Storage/Firebase] Upload progress: ${percentage}%`);
          },
          (error) => {
            console.error('[Storage/Firebase] Upload error:', error);
            reject(error);
          },
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              onProgress({
                bytesTransferred: uploadTask.snapshot.totalBytes,
                totalBytes: uploadTask.snapshot.totalBytes,
                percentage: 100,
                state: 'success',
              });
              resolve(url);
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    } else {
      // Simple upload without progress tracking
      const uploadResult = await uploadBytes(storageRef, blob, {
        contentType: mimeType,
        customMetadata: metadata,
      });
      console.log(`[Storage/Firebase] Upload completed. Bytes: ${uploadResult.metadata.size}`);
      downloadURL = await getDownloadURL(storageRef);
    }

    console.log(`[Storage/Firebase] Download URL obtained: ${downloadURL}`);

    return {
      type: fileType,
      downloadURL,
      fileName,
      size: blob.size,
      mimeType,
      storagePath,
    };
  } catch (error) {
    console.error('[Storage/Firebase] Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
    console.log(`[Storage/Firebase] Error details:
      URI: ${uri}
      File Type: ${fileType}
      Error: ${errorMessage}
    `);
    throw new Error(`Firebase upload failed: ${errorMessage}`);
  }
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
 * Main upload function - automatically chooses between Firebase and Mock
 * Based on configuration settings
 */
export const uploadFile = async (
  uri: string,
  fileType: string,
  options?: UploadOptions
): Promise<UploadResult> => {
  const useFirebase = options?.useFirebase ?? !currentConfig.useMockStorage;

  console.log(`[Storage] Upload mode: ${useFirebase ? 'Firebase' : 'Mock'}`);

  if (useFirebase) {
    // Use retry logic for Firebase uploads
    return retryWithBackoff(() => uploadToFirebase(uri, fileType, options));
  } else {
    return uploadToMock(uri, fileType, options);
  }
};

/**
 * Upload multiple files with progress tracking
 * Works with both Firebase and Mock storage
 */
export const uploadMultipleFiles = async (
  files: { uri: string; fileType: string; options?: UploadOptions }[],
  onOverallProgress?: (completed: number, total: number, results: UploadResult[]) => void,
  options?: { useFirebase?: boolean; parallel?: boolean }
): Promise<UploadResult[]> => {
  const results: UploadResult[] = [];
  const total = files.length;
  const { parallel = false } = options || {};
  
  console.log(`[Storage] Uploading ${total} files ${parallel ? 'in parallel' : 'sequentially'}`);

  if (parallel) {
    // Parallel upload (faster but may hit rate limits)
    const uploadPromises = files.map(async ({ uri, fileType, options: fileOptions }, index) => {
      const result = await uploadFile(uri, fileType, { ...fileOptions, useFirebase: options?.useFirebase });
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
      const result = await uploadFile(uri, fileType, { ...fileOptions, useFirebase: options?.useFirebase });
      results.push(result);

      if (onOverallProgress) {
        onOverallProgress(i + 1, total, results);
      }
    }

    return results;
  }
};

// ============================================================================
// FIREBASE DELETE & METADATA FUNCTIONS
// ============================================================================

/**
 * Delete a file from Firebase Storage
 */
export const deleteFromFirebase = async (filePathOrUrl: string): Promise<boolean> => {
  console.log(`[Storage/Firebase] Deleting file: ${filePathOrUrl}`);
  
  try {
    // Extract storage path from URL if needed
    let storagePath = filePathOrUrl;

    if (filePathOrUrl.includes('firebasestorage.googleapis.com')) {
      // Extract path from Firebase URL
      const url = new URL(filePathOrUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);
      if (pathMatch) {
        storagePath = decodeURIComponent(pathMatch[1]);
      }
    }

    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);

    console.log(`[Storage/Firebase] File deleted successfully: ${storagePath}`);
    return true;
  } catch (error) {
    console.error('[Storage/Firebase] Delete error:', error);
    return false;
  }
};

/**
 * Delete a file from storage (unified - chooses Firebase or Mock)
 */
export const deleteFile = async (fileUrl: string, useFirebase?: boolean): Promise<boolean> => {
  const shouldUseFirebase = useFirebase ?? !currentConfig.useMockStorage;

  if (shouldUseFirebase) {
    return deleteFromFirebase(fileUrl);
  }

  // Mock deletion
  console.log(`[Storage/Mock] Deleting file: ${fileUrl}`);
  await sleep(300); // Simulate network delay
  console.log(`[Storage/Mock] File deleted successfully`);
  return true;
};

/**
 * Get file metadata from Firebase Storage
 */
export const getMetadataFromFirebase = async (filePathOrUrl: string): Promise<{
  size?: number;
  contentType?: string;
  lastModified?: Date;
  customMetadata?: Record<string, string>;
} | null> => {
  try {
    // Extract storage path from URL if needed
    let storagePath = filePathOrUrl;

    if (filePathOrUrl.includes('firebasestorage.googleapis.com')) {
      const url = new URL(filePathOrUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);
      if (pathMatch) {
        storagePath = decodeURIComponent(pathMatch[1]);
      }
    }

    const storageRef = ref(storage, storagePath);
    const metadata = await getMetadata(storageRef);

    return {
      size: metadata.size,
      contentType: metadata.contentType,
      lastModified: metadata.updated ? new Date(metadata.updated) : undefined,
      customMetadata: metadata.customMetadata,
    };
  } catch (error) {
    console.error('[Storage/Firebase] Metadata fetch error:', error);
    return null;
  }
};

/**
 * Get file metadata (unified - chooses Firebase or Mock)
 */
export const getFileMetadata = async (fileUrl: string, useFirebase?: boolean): Promise<{
  size?: number;
  contentType?: string;
  lastModified?: Date;
  customMetadata?: Record<string, string>;
} | null> => {
  const shouldUseFirebase = useFirebase ?? !currentConfig.useMockStorage;

  if (shouldUseFirebase) {
    return getMetadataFromFirebase(fileUrl);
  }

  // Mock metadata
  return {
    size: Math.floor(Math.random() * 10000000) + 1000000,
    contentType: fileUrl.includes('video') ? 'video/mp4' : 'image/jpeg',
    lastModified: new Date(),
  };
};

/**
 * Check if a file exists in storage
 */
export const fileExists = async (filePathOrUrl: string, useFirebase?: boolean): Promise<boolean> => {
  const metadata = await getFileMetadata(filePathOrUrl, useFirebase);
  return metadata !== null;
};

/**
 * Get download URL for a storage path
 */
export const getDownloadUrl = async (storagePath: string): Promise<string | null> => {
  if (currentConfig.useMockStorage) {
    return `${MOCK_STORAGE_BASE_URL}/${storagePath}`;
  }

  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('[Storage/Firebase] Get download URL error:', error);
    return null;
  }
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Main upload functions
  uploadFile,
  uploadToFirebase,
  uploadToMock,
  uploadMultipleFiles,

  // Delete functions
  deleteFile,
  deleteFromFirebase,

  // Metadata functions
  getFileMetadata,
  getMetadataFromFirebase,
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
  useFirebaseStorage,
  useMockStorage,
};
