/**
 * Storage Utilities
 * File upload and storage management utilities
 * Design System Compliant - Uses consistent error handling and logging
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UploadResult {
  type: string;
  downloadURL: string;
  fileName: string;
  size?: number;
  mimeType?: string;
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

export interface UploadOptions {
  fileType?: string;
  onProgress?: UploadProgressCallback;
  maxSizeMB?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_FILE_SIZE_MB = 100; // 100MB default max
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_THUMBNAIL_TYPES = ['image/jpeg', 'image/png'];

// Mock storage URL for development
const MOCK_STORAGE_BASE_URL = 'https://storage.delipucash.com';

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

// ============================================================================
// MOCK UPLOAD FUNCTION (Development)
// ============================================================================

/**
 * Mock file upload for development
 * Simulates upload progress and returns a mock URL
 */
export const uploadFile = async (
  uri: string,
  fileType: string,
  options?: UploadOptions
): Promise<UploadResult> => {
  const { onProgress } = options || {};
  
  console.log(`[Storage] Starting upload for: ${uri}`);
  console.log(`[Storage] File type: ${fileType}`);
  
  try {
    // Simulate fetching file info
    const extension = getFileExtension(uri);
    const mimeType = getMimeType(extension);
    const fileName = generateFileName(extension);
    
    // Validate file type based on category
    const allowedTypes = fileType === 'videos' 
      ? ALLOWED_VIDEO_TYPES 
      : fileType === 'thumbnails' 
        ? ALLOWED_THUMBNAIL_TYPES 
        : ALLOWED_IMAGE_TYPES;
    
    if (extension && !validateFileType(mimeType, allowedTypes)) {
      console.warn(`[Storage] File type ${mimeType} may not be allowed for ${fileType}`);
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
        });
      }
    }
    
    // Generate mock download URL
    const storagePath = `${fileType}/${fileName}`;
    const downloadURL = `${MOCK_STORAGE_BASE_URL}/${storagePath}`;
    
    console.log(`[Storage] Upload complete: ${downloadURL}`);
    
    return {
      type: fileType,
      downloadURL,
      fileName,
      size: mockFileSize,
      mimeType,
    };
  } catch (error) {
    console.error('[Storage] Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
    throw new Error(`File upload failed: ${errorMessage}`);
  }
};

/**
 * Upload multiple files with progress tracking
 */
export const uploadMultipleFiles = async (
  files: { uri: string; fileType: string }[],
  onOverallProgress?: (completed: number, total: number) => void
): Promise<UploadResult[]> => {
  const results: UploadResult[] = [];
  const total = files.length;
  
  for (let i = 0; i < files.length; i++) {
    const { uri, fileType } = files[i];
    const result = await uploadFile(uri, fileType);
    results.push(result);
    
    if (onOverallProgress) {
      onOverallProgress(i + 1, total);
    }
  }
  
  return results;
};

/**
 * Delete a file from storage (mock)
 */
export const deleteFile = async (fileUrl: string): Promise<boolean> => {
  console.log(`[Storage] Deleting file: ${fileUrl}`);
  
  try {
    // Simulate deletion delay
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log(`[Storage] File deleted successfully`);
    return true;
  } catch (error) {
    console.error('[Storage] Delete error:', error);
    return false;
  }
};

/**
 * Get file metadata from URL
 */
export const getFileMetadata = async (fileUrl: string): Promise<{
  size?: number;
  contentType?: string;
  lastModified?: Date;
} | null> => {
  try {
    // Mock metadata
    return {
      size: Math.floor(Math.random() * 10000000) + 1000000,
      contentType: fileUrl.includes('video') ? 'video/mp4' : 'image/jpeg',
      lastModified: new Date(),
    };
  } catch (error) {
    console.error('[Storage] Metadata fetch error:', error);
    return null;
  }
};

export default {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  getFileMetadata,
  generateFileName,
  getFileExtension,
  getMimeType,
  validateFileSize,
  validateFileType,
  formatFileSize,
};
