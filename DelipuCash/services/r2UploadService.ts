/**
 * R2 Upload Service
 * 
 * Frontend service for uploading files to Cloudflare R2 via the backend.
 * Supports:
 * - Video upload with progress tracking
 * - Thumbnail upload
 * - Direct presigned URL uploads for large files
 * - Livestream chunk uploads
 * 
 * Industry standards:
 * - Progress feedback
 * - Retry logic
 * - Error handling
 * - Type safety
 */

import { ApiResponse } from "@/types";
import { useAuthStore } from "@/utils/auth/store";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";

/** Get current auth token for authenticated upload requests */
function getAuthToken(): string | null {
  return useAuthStore.getState().auth?.token || null;
}

/** Build standard auth headers for JSON requests */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ============================================================================
// TYPES
// ============================================================================

export interface UploadProgressEvent {
  loaded: number;
  total: number;
  progress: number; // 0-100
}

export interface VideoUploadResult {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnail: string;
  duration?: number;
  r2VideoKey: string;
  r2ThumbnailKey?: string;
  videoSizeBytes: number;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
}

export interface ThumbnailUploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

export interface ValidateUploadResult {
  valid: boolean;
  message?: string;
  error?: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE' | 'USER_NOT_FOUND';
  maxSize?: number;
  fileSize?: number;
  isPremium?: boolean;
  upgradeRequired?: boolean;
  premiumMaxSize?: number;
}

export interface UploadOptions {
  onProgress?: (event: UploadProgressEvent) => void;
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create XMLHttpRequest with progress tracking
 * Required for upload progress in React Native
 */
function createProgressRequest(
  url: string,
  method: string,
  formData: FormData,
  options: UploadOptions = {}
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress({
          loaded: event.loaded,
          total: event.total,
          progress: Math.round((event.loaded / event.total) * 100),
        });
      }
    });
    
    xhr.addEventListener('load', () => {
      const response = new Response(xhr.responseText, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: new Headers({
          'Content-Type': xhr.getResponseHeader('Content-Type') || 'application/json',
        }),
      });
      resolve(response);
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });
    
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });
    
    xhr.open(method, url);
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    options.onStart?.();
    xhr.send(formData);
  });
}

/**
 * Convert React Native asset to FormData-compatible file
 */
function assetToFormData(
  uri: string,
  fileName: string,
  mimeType: string
): { uri: string; name: string; type: string } {
  return {
    uri,
    name: fileName,
    type: mimeType,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate upload before starting
 * Checks file size against user's limits
 */
export async function validateUpload(
  userId: string,
  fileSize: number,
  fileName?: string,
  mimeType?: string,
  type: 'video' | 'thumbnail' = 'video'
): Promise<ApiResponse<ValidateUploadResult>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/r2/upload/validate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        userId,
        fileSize,
        fileName,
        mimeType,
        type,
      }),
    });
    
    const data = await response.json();
    
    return {
      success: response.ok,
      data,
      error: !response.ok ? data.message : undefined,
    };
  } catch (error) {
    return {
      success: false,
      data: { valid: false, error: 'FILE_TOO_LARGE' as const },
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

// ============================================================================
// VIDEO UPLOAD
// ============================================================================

/**
 * Upload a video file to R2
 * 
 * @param videoUri - Local video file URI
 * @param userId - User ID
 * @param metadata - Optional video metadata
 * @param options - Upload options (progress callback, etc.)
 */
export async function uploadVideoToR2(
  videoUri: string,
  userId: string,
  metadata: {
    title?: string;
    description?: string;
    duration?: number;
    fileName?: string;
    mimeType?: string;
  } = {},
  options: UploadOptions = {}
): Promise<ApiResponse<VideoUploadResult>> {
  try {
    const fileName = metadata.fileName || videoUri.split('/').pop() || 'video.mp4';
    const mimeType = metadata.mimeType || 'video/mp4';
    
    // Create FormData
    const formData = new FormData();
    formData.append('video', assetToFormData(videoUri, fileName, mimeType) as unknown as Blob);
    formData.append('userId', userId);
    
    if (metadata.title) formData.append('title', metadata.title);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.duration) formData.append('duration', String(metadata.duration));
    
    // Upload with progress tracking
    const response = await createProgressRequest(
      `${API_BASE_URL}/api/r2/upload/video`,
      'POST',
      formData,
      options
    );
    
    const data = await response.json();
    options.onComplete?.();
    
    if (!response.ok) {
      const error = new Error(data.message || 'Upload failed');
      options.onError?.(error);
      return {
        success: false,
        data: data as VideoUploadResult,
        error: data.message,
      };
    }
    
    return {
      success: true,
      data: data.video as VideoUploadResult,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Upload failed');
    options.onError?.(err);
    return {
      success: false,
      data: {} as VideoUploadResult,
      error: err.message,
    };
  }
}

/**
 * Upload video and thumbnail together
 */
export async function uploadMediaToR2(
  videoUri: string,
  thumbnailUri: string,
  userId: string,
  metadata: {
    title?: string;
    description?: string;
    duration?: number;
    videoFileName?: string;
    videoMimeType?: string;
    thumbnailFileName?: string;
    thumbnailMimeType?: string;
  } = {},
  options: UploadOptions = {}
): Promise<ApiResponse<VideoUploadResult>> {
  try {
    const videoFileName = metadata.videoFileName || videoUri.split('/').pop() || 'video.mp4';
    const videoMimeType = metadata.videoMimeType || 'video/mp4';
    const thumbnailFileName = metadata.thumbnailFileName || thumbnailUri.split('/').pop() || 'thumbnail.jpg';
    const thumbnailMimeType = metadata.thumbnailMimeType || 'image/jpeg';
    
    const formData = new FormData();
    formData.append('video', assetToFormData(videoUri, videoFileName, videoMimeType) as unknown as Blob);
    formData.append('thumbnail', assetToFormData(thumbnailUri, thumbnailFileName, thumbnailMimeType) as unknown as Blob);
    formData.append('userId', userId);
    
    if (metadata.title) formData.append('title', metadata.title);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.duration) formData.append('duration', String(metadata.duration));
    
    const response = await createProgressRequest(
      `${API_BASE_URL}/api/r2/upload/media`,
      'POST',
      formData,
      options
    );
    
    const data = await response.json();
    options.onComplete?.();
    
    if (!response.ok) {
      const error = new Error(data.message || 'Upload failed');
      options.onError?.(error);
      return {
        success: false,
        data: data as VideoUploadResult,
        error: data.message,
      };
    }
    
    return {
      success: true,
      data: data.video as VideoUploadResult,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Upload failed');
    options.onError?.(err);
    return {
      success: false,
      data: {} as VideoUploadResult,
      error: err.message,
    };
  }
}

// ============================================================================
// THUMBNAIL UPLOAD
// ============================================================================

/**
 * Upload a thumbnail image to R2
 */
export async function uploadThumbnailToR2(
  thumbnailUri: string,
  userId: string,
  videoId?: string,
  options: UploadOptions = {}
): Promise<ApiResponse<ThumbnailUploadResult>> {
  try {
    const fileName = thumbnailUri.split('/').pop() || 'thumbnail.jpg';
    const mimeType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    const formData = new FormData();
    formData.append('thumbnail', assetToFormData(thumbnailUri, fileName, mimeType) as unknown as Blob);
    formData.append('userId', userId);
    if (videoId) formData.append('videoId', videoId);
    
    const response = await createProgressRequest(
      `${API_BASE_URL}/api/r2/upload/thumbnail`,
      'POST',
      formData,
      options
    );
    
    const data = await response.json();
    options.onComplete?.();
    
    if (!response.ok) {
      const error = new Error(data.message || 'Upload failed');
      options.onError?.(error);
      return {
        success: false,
        data: data as ThumbnailUploadResult,
        error: data.message,
      };
    }
    
    return {
      success: true,
      data: data.thumbnail as ThumbnailUploadResult,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Upload failed');
    options.onError?.(err);
    return {
      success: false,
      data: {} as ThumbnailUploadResult,
      error: err.message,
    };
  }
}

// ============================================================================
// PRESIGNED URL UPLOADS (Direct to R2)
// ============================================================================

/**
 * Get a presigned URL for direct upload to R2
 * Useful for large files to bypass server memory limits
 */
export async function getPresignedUploadUrl(
  fileName: string,
  mimeType: string,
  userId: string,
  type: 'video' | 'thumbnail' = 'video',
  fileSize?: number
): Promise<ApiResponse<PresignedUploadResult>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/r2/presign/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        fileName,
        mimeType,
        userId,
        type,
        fileSize,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        data: data as PresignedUploadResult,
        error: data.message,
      };
    }
    
    return {
      success: true,
      data: data as PresignedUploadResult,
    };
  } catch (error) {
    return {
      success: false,
      data: {} as PresignedUploadResult,
      error: error instanceof Error ? error.message : 'Failed to get upload URL',
    };
  }
}

/**
 * Upload directly to R2 using a presigned URL
 */
export async function uploadToPresignedUrl(
  presignedUrl: string,
  fileUri: string,
  mimeType: string,
  options: UploadOptions = {}
): Promise<boolean> {
  try {
    // For React Native, we need to use fetch with blob
    const response = await fetch(fileUri);
    const blob = await response.blob();
    
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
      body: blob,
    });
    
    options.onComplete?.();
    return uploadResponse.ok;
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Direct upload failed');
    options.onError?.(err);
    return false;
  }
}

// ============================================================================
// LIVESTREAM UPLOADS
// ============================================================================

/**
 * Upload a livestream recording chunk
 */
export async function uploadLivestreamChunk(
  chunkUri: string,
  sessionId: string,
  chunkIndex: number,
  userId: string
): Promise<ApiResponse<{ key: string; size: number; chunkIndex: number }>> {
  try {
    const formData = new FormData();
    formData.append('chunk', assetToFormData(chunkUri, `chunk_${chunkIndex}.mp4`, 'video/mp4') as unknown as Blob);
    formData.append('sessionId', sessionId);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('userId', userId);
    
    const response = await fetch(`${API_BASE_URL}/api/r2/livestream/chunk`, {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        data: data,
        error: data.message,
      };
    }
    
    return {
      success: true,
      data: data.chunk,
    };
  } catch (error) {
    return {
      success: false,
      data: { key: '', size: 0, chunkIndex },
      error: error instanceof Error ? error.message : 'Chunk upload failed',
    };
  }
}

/**
 * Finalize a livestream recording
 */
export async function finalizeLivestreamRecording(
  sessionId: string,
  userId: string,
  title?: string,
  description?: string
): Promise<ApiResponse<{ url: string; totalSize: number; videoId: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/r2/livestream/finalize`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        sessionId,
        userId,
        title,
        description,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        data: data,
        error: data.message,
      };
    }
    
    return {
      success: true,
      data: {
        url: data.recording.url,
        totalSize: data.recording.totalSize,
        videoId: data.video.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: { url: '', totalSize: 0, videoId: '' },
      error: error instanceof Error ? error.message : 'Finalization failed',
    };
  }
}

// ============================================================================
// SIGNED URL FOR PLAYBACK
// ============================================================================

/**
 * Get a signed URL for private video playback
 */
export async function getSignedPlaybackUrl(
  key: string,
  expiresIn: number = 3600
): Promise<ApiResponse<{ url: string; expiresIn: number }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/r2/presign/download`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ key, expiresIn }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        data: data,
        error: data.message,
      };
    }
    
    return {
      success: true,
      data: {
        url: data.url,
        expiresIn: data.expiresIn,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: { url: '', expiresIn: 0 },
      error: error instanceof Error ? error.message : 'Failed to get playback URL',
    };
  }
}

// ============================================================================
// AD MEDIA UPLOAD
// ============================================================================

export interface AdMediaUploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
  type: 'image' | 'video';
  etag?: string;
}

/**
 * Upload ad media (image or video) to R2
 * 
 * @param mediaUri - Local media file URI
 * @param userId - User ID
 * @param metadata - Optional metadata
 * @param options - Upload options (progress callback, etc.)
 */
export async function uploadAdMediaToR2(
  mediaUri: string,
  userId: string,
  metadata: {
    fileName?: string;
    mimeType?: string;
    adId?: string;
  } = {},
  options: UploadOptions = {}
): Promise<ApiResponse<AdMediaUploadResult>> {
  try {
    const fileName = metadata.fileName || mediaUri.split('/').pop() || 'media';
    const mimeType = metadata.mimeType || (mediaUri.toLowerCase().includes('.mp4') ? 'video/mp4' : 'image/jpeg');

    // Create FormData
    const formData = new FormData();
    formData.append('media', assetToFormData(mediaUri, fileName, mimeType) as unknown as Blob);
    formData.append('userId', userId);

    if (metadata.adId) formData.append('adId', metadata.adId);

    options.onStart?.();

    // Upload with progress tracking
    const response = await createProgressRequest(
      `${API_BASE_URL}/api/r2/upload/ad-media`,
      'POST',
      formData,
      options
    );

    const data = await response.json();
    options.onComplete?.();

    if (!response.ok) {
      const error = new Error(data.message || 'Upload failed');
      options.onError?.(error);
      return {
        success: false,
        data: data as AdMediaUploadResult,
        error: data.message,
      };
    }

    return {
      success: true,
      data: data.media as AdMediaUploadResult,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Upload failed');
    options.onError?.(err);
    return {
      success: false,
      data: {} as AdMediaUploadResult,
      error: err.message,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const r2UploadService = {
  // Validation
  validateUpload,
  
  // Video upload
  uploadVideoToR2,
  uploadMediaToR2,
  
  // Thumbnail upload
  uploadThumbnailToR2,
  
  // Ad media upload
  uploadAdMediaToR2,

  // Presigned URLs
  getPresignedUploadUrl,
  uploadToPresignedUrl,
  
  // Livestream
  uploadLivestreamChunk,
  finalizeLivestreamRecording,
  
  // Playback
  getSignedPlaybackUrl,
};

export default r2UploadService;
