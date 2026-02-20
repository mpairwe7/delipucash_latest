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
import { silentRefresh, isTokenExpiredResponse } from './tokenRefresh';

// Normalise the base URL the same way api.ts does:
// 1. Default to the deployed Vercel API if env var is unset
// 2. Strip trailing slashes and a trailing /api segment so that request
//    paths like /api/r2/upload/avatar aren't doubled to /api/api/...
const _rawApiUrl = process.env.EXPO_PUBLIC_API_URL || "https://delipucash-latest.vercel.app";
const API_BASE_URL = _rawApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '');

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
 * 2026 Pattern: Safe JSON parser with content-type validation
 * Handles non-JSON error responses gracefully
 */
async function safeParseJSON(response: Response): Promise<any> {
  const contentType = response.headers.get('Content-Type') || '';

  // Check if response is actually JSON
  if (!contentType.includes('application/json')) {
    const text = await response.text();

    // If it's an error response, try to extract meaningful message
    if (!response.ok) {
      // Common error patterns
      if (text.startsWith('Error:') || text.startsWith('ERROR')) {
        throw new Error(text);
      }
      if (text.includes('Request') || text.includes('timeout')) {
        throw new Error(`Server error: ${text.substring(0, 200)}`);
      }
      throw new Error(`Upload failed: ${text.substring(0, 100)}`);
    }

    // Non-JSON success response (unusual but possible)
    return { message: text };
  }

  // Read body as text first (can only be consumed once), then parse as JSON
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (parseError) {
    throw new Error(`Failed to parse server response. Got: ${text.substring(0, 100)}`);
  }
}

/**
 * Create XMLHttpRequest with progress tracking
 * 2026 Pattern: Clamped progress, better error handling
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
        // 2026: Clamp progress to 0-100 range to prevent overflow
        const rawProgress = (event.loaded / event.total) * 100;
        const clampedProgress = Math.min(Math.max(Math.round(rawProgress), 0), 100);

        options.onProgress({
          loaded: event.loaded,
          total: event.total,
          progress: clampedProgress,
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
      reject(new Error('Network error during upload. Please check your connection.'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was cancelled'));
    });

    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload timed out. Please try again.'));
    });

    xhr.open(method, url);

    // 2026: Set timeout for large uploads (10 minutes)
    xhr.timeout = 10 * 60 * 1000;

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

    // Factory: rebuild FormData for each attempt (required after token refresh)
    const buildFormData = () => {
      const fd = new FormData();
      fd.append('video', assetToFormData(videoUri, fileName, mimeType) as unknown as Blob);
      fd.append('userId', userId);
      if (metadata.title) fd.append('title', metadata.title);
      if (metadata.description) fd.append('description', metadata.description);
      if (metadata.duration) fd.append('duration', String(metadata.duration));
      return fd;
    };

    options.onStart?.();

    // Upload with progress tracking
    let response = await createProgressRequest(
      `${API_BASE_URL}/api/r2/upload/video`,
      'POST',
      buildFormData(),
      options
    );

    // If access token expired → silent refresh → retry once
    if (isTokenExpiredResponse(response.status)) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        response = await createProgressRequest(
          `${API_BASE_URL}/api/r2/upload/video`,
          'POST',
          buildFormData(),
          options
        );
      }
    }

    // 2026: Safe JSON parsing with content-type validation
    const data = await safeParseJSON(response);

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Upload failed';
      const error = new Error(errorMessage);
      options.onError?.(error);
      return {
        success: false,
        data: data as VideoUploadResult,
        error: errorMessage,
      };
    }

    // Only signal completion on actual success
    options.onComplete?.();

    return {
      success: true,
      data: data.video || data.data as VideoUploadResult,
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

    // Factory: rebuild FormData for each attempt (required after token refresh)
    const buildFormData = () => {
      const fd = new FormData();
      fd.append('video', assetToFormData(videoUri, videoFileName, videoMimeType) as unknown as Blob);
      fd.append('thumbnail', assetToFormData(thumbnailUri, thumbnailFileName, thumbnailMimeType) as unknown as Blob);
      fd.append('userId', userId);
      if (metadata.title) fd.append('title', metadata.title);
      if (metadata.description) fd.append('description', metadata.description);
      if (metadata.duration) fd.append('duration', String(metadata.duration));
      return fd;
    };

    options.onStart?.();

    let response = await createProgressRequest(
      `${API_BASE_URL}/api/r2/upload/media`,
      'POST',
      buildFormData(),
      options
    );

    // If access token expired → silent refresh → retry once
    if (isTokenExpiredResponse(response.status)) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        response = await createProgressRequest(
          `${API_BASE_URL}/api/r2/upload/media`,
          'POST',
          buildFormData(),
          options
        );
      }
    }

    // 2026: Safe JSON parsing with content-type validation
    const data = await safeParseJSON(response);

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Upload failed';
      const error = new Error(errorMessage);
      options.onError?.(error);
      return {
        success: false,
        data: data as VideoUploadResult,
        error: errorMessage,
      };
    }

    // Only signal completion on actual success
    options.onComplete?.();

    return {
      success: true,
      data: data.video || data.data as VideoUploadResult,
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

    // Factory: rebuild FormData for each attempt (required after token refresh)
    const buildFormData = () => {
      const fd = new FormData();
      fd.append('thumbnail', assetToFormData(thumbnailUri, fileName, mimeType) as unknown as Blob);
      fd.append('userId', userId);
      if (videoId) fd.append('videoId', videoId);
      return fd;
    };

    options.onStart?.();

    let response = await createProgressRequest(
      `${API_BASE_URL}/api/r2/upload/thumbnail`,
      'POST',
      buildFormData(),
      options
    );

    // If access token expired → silent refresh → retry once
    if (isTokenExpiredResponse(response.status)) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        response = await createProgressRequest(
          `${API_BASE_URL}/api/r2/upload/thumbnail`,
          'POST',
          buildFormData(),
          options
        );
      }
    }

    // 2026: Safe JSON parsing with content-type validation
    const data = await safeParseJSON(response);

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Thumbnail upload failed';
      const error = new Error(errorMessage);
      options.onError?.(error);
      return {
        success: false,
        data: data as ThumbnailUploadResult,
        error: errorMessage,
      };
    }

    // Only signal completion on actual success
    options.onComplete?.();

    return {
      success: true,
      data: data.thumbnail as ThumbnailUploadResult,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Thumbnail upload failed');
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
 * Upload directly to R2 using a presigned URL.
 * Uses XHR for progress tracking (fetch does not support upload progress).
 */
export async function uploadToPresignedUrl(
  presignedUrl: string,
  fileUri: string,
  mimeType: string,
  options: UploadOptions = {}
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && options.onProgress) {
        const rawProgress = (event.loaded / event.total) * 100;
        options.onProgress({
          loaded: event.loaded,
          total: event.total,
          progress: Math.min(Math.max(Math.round(rawProgress), 0), 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onComplete?.();
        resolve(true);
      } else {
        const err = new Error(`Direct upload failed with status ${xhr.status}`);
        options.onError?.(err);
        resolve(false);
      }
    });

    xhr.addEventListener('error', () => {
      const err = new Error('Network error during direct upload. Please check your connection.');
      options.onError?.(err);
      reject(err);
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Direct upload was cancelled'));
    });

    xhr.addEventListener('timeout', () => {
      const err = new Error('Direct upload timed out. Please try again.');
      options.onError?.(err);
      reject(err);
    });

    xhr.open('PUT', presignedUrl);
    xhr.timeout = 10 * 60 * 1000; // 10 minutes for large videos
    xhr.setRequestHeader('Content-Type', mimeType);

    options.onStart?.();

    // React Native: send file URI directly as a blob-like object
    xhr.send({ uri: fileUri, type: mimeType, name: 'upload' } as any);
  });
}

// ============================================================================
// PRESIGNED VIDEO UPLOAD ORCHESTRATOR
// ============================================================================

/**
 * Upload a thumbnail via presigned URL.
 * Returns the R2 key and public URL for use in the finalize call.
 */
export async function uploadThumbnailViaPresignedUrl(
  thumbnailUri: string,
  userId: string,
  fileName: string,
  mimeType: string
): Promise<{ key: string; publicUrl: string; mimeType: string }> {
  const presignResult = await getPresignedUploadUrl(fileName, mimeType, userId, 'thumbnail');
  if (!presignResult.success) {
    throw new Error(presignResult.error || 'Failed to get thumbnail upload URL');
  }

  const success = await uploadToPresignedUrl(
    presignResult.data.uploadUrl,
    thumbnailUri,
    mimeType
  );
  if (!success) {
    throw new Error('Thumbnail upload failed');
  }

  return {
    key: presignResult.data.key,
    publicUrl: presignResult.data.publicUrl,
    mimeType,
  };
}

/**
 * Upload a video via presigned URL (bypasses Vercel body size limit).
 *
 * Flow:
 * 1. Get presigned URL from server (small JSON request)
 * 2. Upload video directly to R2 via XHR (progress tracked)
 * 3. Finalize — tell server to create Video DB record (small JSON request)
 */
export async function uploadVideoViaPresignedUrl(
  videoUri: string,
  userId: string,
  metadata: {
    title?: string;
    description?: string;
    duration?: number;
    fileName?: string;
    mimeType?: string;
  } = {},
  options: UploadOptions = {},
  thumbnailData?: { key: string; publicUrl: string; mimeType: string }
): Promise<ApiResponse<VideoUploadResult>> {
  const fileName = metadata.fileName || videoUri.split('/').pop() || 'video.mp4';
  const mimeType = metadata.mimeType || 'video/mp4';

  // Step 1: Get presigned URL (small JSON — fits within Vercel limit)
  const presignResult = await getPresignedUploadUrl(fileName, mimeType, userId, 'video');
  if (!presignResult.success) {
    throw new Error(presignResult.error || 'Failed to get upload URL');
  }
  const { uploadUrl, key: r2VideoKey, publicUrl: videoPublicUrl } = presignResult.data;

  // Step 2: Upload directly to R2 (bypasses Vercel entirely)
  const uploadSuccess = await uploadToPresignedUrl(uploadUrl, videoUri, mimeType, options);
  if (!uploadSuccess) {
    throw new Error('Direct upload to storage failed');
  }

  // Step 3: Finalize — create DB record via server (small JSON request)
  let finalizeResponse: Response;
  try {
    finalizeResponse = await fetch(`${API_BASE_URL}/api/r2/upload/finalize-video`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        r2VideoKey,
        videoUrl: videoPublicUrl,
        videoMimeType: mimeType,
        r2ThumbnailKey: thumbnailData?.key || null,
        thumbnailUrl: thumbnailData?.publicUrl || '',
        thumbnailMimeType: thumbnailData?.mimeType || null,
        title: metadata.title,
        description: metadata.description,
        duration: metadata.duration,
      }),
    });
  } catch (networkErr) {
    throw new Error('Network error while finalizing upload. The video was uploaded but the record was not created.');
  }

  // If token expired on finalize, refresh and retry (finalize is cheap)
  if (isTokenExpiredResponse(finalizeResponse.status)) {
    const refreshed = await silentRefresh();
    if (refreshed) {
      finalizeResponse = await fetch(`${API_BASE_URL}/api/r2/upload/finalize-video`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          r2VideoKey,
          videoUrl: videoPublicUrl,
          videoMimeType: mimeType,
          r2ThumbnailKey: thumbnailData?.key || null,
          thumbnailUrl: thumbnailData?.publicUrl || '',
          thumbnailMimeType: thumbnailData?.mimeType || null,
          title: metadata.title,
          description: metadata.description,
          duration: metadata.duration,
        }),
      });
    }
  }

  const data = await safeParseJSON(finalizeResponse);
  if (!finalizeResponse.ok) {
    throw new Error(data.message || 'Failed to finalize upload');
  }

  options.onComplete?.();

  return {
    success: true,
    data: data.video || (data.data as VideoUploadResult),
  };
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
    // Factory: rebuild FormData for each attempt (required after token refresh)
    const buildFormData = () => {
      const fd = new FormData();
      fd.append('chunk', assetToFormData(chunkUri, `chunk_${chunkIndex}.mp4`, 'video/mp4') as unknown as Blob);
      fd.append('sessionId', sessionId);
      fd.append('chunkIndex', String(chunkIndex));
      fd.append('userId', userId);
      return fd;
    };

    let response = await createProgressRequest(
      `${API_BASE_URL}/api/r2/livestream/chunk`,
      'POST',
      buildFormData(),
      {}
    );

    // If access token expired → silent refresh → retry once
    if (isTokenExpiredResponse(response.status)) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        response = await createProgressRequest(
          `${API_BASE_URL}/api/r2/livestream/chunk`,
          'POST',
          buildFormData(),
          {}
        );
      }
    }

    const data = await safeParseJSON(response);

    if (!response.ok) {
      return {
        success: false,
        data: data,
        error: data.message || data.error || 'Chunk upload failed',
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
    let response = await fetch(`${API_BASE_URL}/api/r2/livestream/finalize`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ sessionId, userId, title, description }),
    });

    // If access token expired → silent refresh → retry once
    if (isTokenExpiredResponse(response.status)) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        response = await fetch(`${API_BASE_URL}/api/r2/livestream/finalize`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ sessionId, userId, title, description }),
        });
      }
    }

    const data = await safeParseJSON(response);

    if (!response.ok) {
      return {
        success: false,
        data: data,
        error: data.message || data.error || 'Finalization failed',
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
    let response = await fetch(`${API_BASE_URL}/api/r2/presign/download`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ key, expiresIn }),
    });

    // If access token expired → silent refresh → retry once
    if (isTokenExpiredResponse(response.status)) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        response = await fetch(`${API_BASE_URL}/api/r2/presign/download`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ key, expiresIn }),
        });
      }
    }

    const data = await safeParseJSON(response);

    if (!response.ok) {
      return {
        success: false,
        data: data,
        error: data.message || data.error || 'Failed to get playback URL',
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

    // Factory: rebuild FormData for each attempt (required after token refresh)
    const buildFormData = () => {
      const fd = new FormData();
      fd.append('media', assetToFormData(mediaUri, fileName, mimeType) as unknown as Blob);
      fd.append('userId', userId);
      if (metadata.adId) fd.append('adId', metadata.adId);
      return fd;
    };

    options.onStart?.();

    // Upload with progress tracking
    let response = await createProgressRequest(
      `${API_BASE_URL}/api/r2/upload/ad-media`,
      'POST',
      buildFormData(),
      options
    );

    // If access token expired → silent refresh → retry once
    if (isTokenExpiredResponse(response.status)) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        response = await createProgressRequest(
          `${API_BASE_URL}/api/r2/upload/ad-media`,
          'POST',
          buildFormData(),
          options
        );
      }
    }

    const data = await safeParseJSON(response);

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Ad media upload failed';
      const error = new Error(errorMessage);
      options.onError?.(error);
      return {
        success: false,
        data: data as AdMediaUploadResult,
        error: errorMessage,
      };
    }

    // Only signal completion on actual success
    options.onComplete?.();

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
// AVATAR UPLOAD
// ============================================================================

export interface AvatarUploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

/**
 * Upload a profile avatar image to R2
 *
 * @param avatarUri - Local image file URI (from expo-image-picker/manipulator)
 * @param options - Upload options (progress callback, etc.)
 */
export async function uploadAvatarToR2(
  avatarUri: string,
  options: UploadOptions = {}
): Promise<ApiResponse<AvatarUploadResult>> {
  try {
    const fileName = avatarUri.split('/').pop() || 'avatar.jpg';
    const mimeType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const buildFormData = () => {
      const fd = new FormData();
      fd.append('avatar', assetToFormData(avatarUri, fileName, mimeType) as unknown as Blob);
      return fd;
    };

    options.onStart?.();

    let response = await createProgressRequest(
      `${API_BASE_URL}/api/r2/upload/avatar`,
      'POST',
      buildFormData(),
      options
    );

    // If access token expired → silent refresh → retry once
    if (isTokenExpiredResponse(response.status)) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        response = await createProgressRequest(
          `${API_BASE_URL}/api/r2/upload/avatar`,
          'POST',
          buildFormData(),
          options
        );
      }
    }

    const data = await safeParseJSON(response);

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Avatar upload failed';
      const error = new Error(errorMessage);
      options.onError?.(error);
      return {
        success: false,
        data: data as AvatarUploadResult,
        error: errorMessage,
      };
    }

    options.onComplete?.();

    return {
      success: true,
      data: data.avatar as AvatarUploadResult,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Avatar upload failed');
    options.onError?.(err);
    return {
      success: false,
      data: {} as AvatarUploadResult,
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

  // Avatar upload
  uploadAvatarToR2,

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
