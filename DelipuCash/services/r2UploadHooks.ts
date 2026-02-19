/**
 * R2 Upload React Hooks
 * 
 * TanStack Query hooks for R2 upload operations with:
 * - Upload progress tracking
 * - Optimistic updates
 * - Error handling
 * - Retry logic
 * - Cache invalidation
 * 
 * @example
 * ```tsx
 * const { mutate: uploadVideo, isPending, progress } = useUploadVideoToR2();
 * 
 * const handleUpload = async (videoUri: string) => {
 *   uploadVideo({
 *     videoUri,
 *     userId: 'user-123',
 *     title: 'My Video',
 *   });
 * };
 * ```
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import {
  validateUpload,
  uploadVideoToR2,
  uploadMediaToR2,
  uploadThumbnailToR2,
  getPresignedUploadUrl,
  uploadToPresignedUrl,
  uploadLivestreamChunk,
  finalizeLivestreamRecording,
  getSignedPlaybackUrl,
  uploadAdMediaToR2,
  VideoUploadResult,
  ThumbnailUploadResult,
  PresignedUploadResult,
  ValidateUploadResult,
  UploadProgressEvent,
  AdMediaUploadResult,
} from './r2UploadService';
import { ApiResponse } from '@/types';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const r2QueryKeys = {
  all: ['r2'] as const,
  uploads: () => [...r2QueryKeys.all, 'uploads'] as const,
  presigned: () => [...r2QueryKeys.all, 'presigned'] as const,
  validation: (userId: string) => [...r2QueryKeys.all, 'validation', userId] as const,
};

// ============================================================================
// TYPES
// ============================================================================

export interface UseUploadVideoParams {
  videoUri: string;
  userId: string;
  title?: string;
  description?: string;
  duration?: number;
  fileName?: string;
  mimeType?: string;
}

export interface UseUploadMediaParams extends UseUploadVideoParams {
  thumbnailUri: string;
  thumbnailFileName?: string;
  thumbnailMimeType?: string;
}

export interface UseUploadThumbnailParams {
  thumbnailUri: string;
  userId: string;
  videoId?: string;
}

export interface UploadHookResult {
  progress: number;
  isUploading: boolean;
  /** True after XHR completes (100%) while waiting for server response */
  isProcessing: boolean;
}

// ============================================================================
// VALIDATE UPLOAD HOOK
// ============================================================================

/**
 * Hook to validate R2 upload before starting
 */
export function useValidateR2Upload(): UseMutationResult<
  ApiResponse<ValidateUploadResult>,
  Error,
  {
    userId: string;
    fileSize: number;
    fileName?: string;
    mimeType?: string;
    type?: 'video' | 'thumbnail';
  }
> {
  return useMutation({
    mutationFn: async ({ userId, fileSize, fileName, mimeType, type }) => {
      return validateUpload(userId, fileSize, fileName, mimeType, type);
    },
  });
}

// ============================================================================
// VIDEO UPLOAD HOOK
// ============================================================================

/**
 * Hook to upload a video to R2 with progress tracking
 * 
 * @example
 * ```tsx
 * const { mutate, isPending, progress } = useUploadVideoToR2();
 * 
 * // Upload with progress
 * mutate({
 *   videoUri: 'file:///path/to/video.mp4',
 *   userId: 'user-123',
 *   title: 'My Video',
 * });
 * 
 * // Display progress
 * <ProgressBar progress={progress} />
 * ```
 */
export function useUploadVideoToR2(): UseMutationResult<
  ApiResponse<VideoUploadResult>,
  Error,
  UseUploadVideoParams
> & UploadHookResult {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: UseUploadVideoParams) => {
      setProgress(0);
      setIsUploading(true);
      setIsProcessing(false);

      try {
        const result = await uploadVideoToR2(
          params.videoUri,
          params.userId,
          {
            title: params.title,
            description: params.description,
            duration: params.duration,
            fileName: params.fileName,
            mimeType: params.mimeType,
          },
          {
            onProgress: (event: UploadProgressEvent) => {
              setProgress(event.progress);
              // XHR bytes fully sent — waiting for server response
              if (event.progress >= 100) {
                setIsProcessing(true);
              }
            },
            onComplete: () => {
              setProgress(100);
              setIsProcessing(false);
              setIsUploading(false);
            },
            onError: () => {
              setIsProcessing(false);
              setIsUploading(false);
            },
          }
        );

        // Throw on service-level failure so retry logic in UploadModal triggers
        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

        return result;
      } catch (error) {
        setIsProcessing(false);
        setIsUploading(false);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });

  return {
    ...mutation,
    progress,
    isUploading,
    isProcessing,
  };
}

// ============================================================================
// MEDIA (VIDEO + THUMBNAIL) UPLOAD HOOK
// ============================================================================

/**
 * Hook to upload video and thumbnail together
 */
export function useUploadMediaToR2(): UseMutationResult<
  ApiResponse<VideoUploadResult>,
  Error,
  UseUploadMediaParams
> & UploadHookResult {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: UseUploadMediaParams) => {
      setProgress(0);
      setIsUploading(true);
      setIsProcessing(false);

      try {
        const result = await uploadMediaToR2(
          params.videoUri,
          params.thumbnailUri,
          params.userId,
          {
            title: params.title,
            description: params.description,
            duration: params.duration,
            videoFileName: params.fileName,
            videoMimeType: params.mimeType,
            thumbnailFileName: params.thumbnailFileName,
            thumbnailMimeType: params.thumbnailMimeType,
          },
          {
            onProgress: (event: UploadProgressEvent) => {
              setProgress(event.progress);
              if (event.progress >= 100) {
                setIsProcessing(true);
              }
            },
            onComplete: () => {
              setProgress(100);
              setIsProcessing(false);
              setIsUploading(false);
            },
            onError: () => {
              setIsProcessing(false);
              setIsUploading(false);
            },
          }
        );

        // Throw on service-level failure so retry logic in UploadModal triggers
        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

        return result;
      } catch (error) {
        setIsProcessing(false);
        setIsUploading(false);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });

  return {
    ...mutation,
    progress,
    isUploading,
    isProcessing,
  };
}

// ============================================================================
// THUMBNAIL UPLOAD HOOK
// ============================================================================

/**
 * Hook to upload a thumbnail to R2
 */
export function useUploadThumbnailToR2(): UseMutationResult<
  ApiResponse<ThumbnailUploadResult>,
  Error,
  UseUploadThumbnailParams
> & UploadHookResult {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: async (params: UseUploadThumbnailParams) => {
      setProgress(0);
      setIsUploading(true);

      try {
        const result = await uploadThumbnailToR2(
          params.thumbnailUri,
          params.userId,
          params.videoId,
          {
            onProgress: (event: UploadProgressEvent) => {
              setProgress(event.progress);
            },
            onComplete: () => {
              setProgress(100);
              setIsUploading(false);
            },
            onError: () => {
              setIsUploading(false);
            },
          }
        );

        return result;
      } catch (error) {
        setIsUploading(false);
        throw error;
      }
    },
  });

  return {
    ...mutation,
    progress,
    isUploading,
  };
}

// ============================================================================
// PRESIGNED URL HOOKS
// ============================================================================

/**
 * Hook to get a presigned upload URL
 */
export function useGetPresignedUploadUrl(): UseMutationResult<
  ApiResponse<PresignedUploadResult>,
  Error,
  {
    fileName: string;
    mimeType: string;
    userId: string;
    type?: 'video' | 'thumbnail';
    fileSize?: number;
  }
> {
  return useMutation({
    mutationFn: async ({ fileName, mimeType, userId, type, fileSize }) => {
      return getPresignedUploadUrl(fileName, mimeType, userId, type, fileSize);
    },
  });
}

/**
 * Hook to upload directly to R2 using presigned URL
 */
interface PresignedUploadParams {
  presignedUrl: string;
  fileUri: string;
  mimeType: string;
}

type PresignedUrlUploadResult = UseMutationResult<
  boolean,
  Error,
  PresignedUploadParams
> & UploadHookResult;

export function useUploadToPresignedUrl(): PresignedUrlUploadResult {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const mutation = useMutation<boolean, Error, PresignedUploadParams>({
    mutationFn: async ({ presignedUrl, fileUri, mimeType }: PresignedUploadParams) => {
      setProgress(0);
      setIsUploading(true);

      try {
        const result = await uploadToPresignedUrl(presignedUrl, fileUri, mimeType, {
          onProgress: (event: UploadProgressEvent) => {
            setProgress(event.progress);
          },
          onComplete: () => {
            setProgress(100);
            setIsUploading(false);
          },
          onError: () => {
            setIsUploading(false);
          },
        });

        return result;
      } catch (error) {
        setIsUploading(false);
        throw error;
      }
    },
  });

  return {
    ...mutation,
    progress,
    isUploading,
  };
}

// ============================================================================
// LIVESTREAM HOOKS
// ============================================================================

/**
 * Hook to upload livestream chunks
 */
export function useUploadLivestreamChunk(): UseMutationResult<
  ApiResponse<{ key: string; size: number; chunkIndex: number }>,
  Error,
  {
    chunkUri: string;
    sessionId: string;
    chunkIndex: number;
    userId: string;
  }
> {
  return useMutation({
    mutationFn: async ({ chunkUri, sessionId, chunkIndex, userId }) => {
      return uploadLivestreamChunk(chunkUri, sessionId, chunkIndex, userId);
    },
  });
}

/**
 * Hook to finalize livestream recording
 */
export function useFinalizeLivestreamRecording(): UseMutationResult<
  ApiResponse<{ url: string; totalSize: number; videoId: string }>,
  Error,
  {
    sessionId: string;
    userId: string;
    title?: string;
    description?: string;
  }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, userId, title, description }) => {
      return finalizeLivestreamRecording(sessionId, userId, title, description);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['livestreams'] });
    },
  });
}

// ============================================================================
// SIGNED PLAYBACK URL HOOK
// ============================================================================

/**
 * Hook to get a signed URL for video playback
 */
export function useGetSignedPlaybackUrl(): UseMutationResult<
  ApiResponse<{ url: string; expiresIn: number }>,
  Error,
  {
    key: string;
    expiresIn?: number;
  }
> {
  return useMutation({
    mutationFn: async ({ key, expiresIn }) => {
      return getSignedPlaybackUrl(key, expiresIn);
    },
  });
}

// ============================================================================
// COMBINED UPLOAD HOOK (Convenience)
// ============================================================================

/**
 * Combined hook for complete video upload workflow
 * Validates, uploads, and handles errors
 */
export function useR2VideoUpload() {
  const validateMutation = useValidateR2Upload();
  const uploadMutation = useUploadVideoToR2();

  const upload = useCallback(
    async (params: UseUploadVideoParams & { fileSize: number }) => {
      // First validate
      const validation = await validateMutation.mutateAsync({
        userId: params.userId,
        fileSize: params.fileSize,
        fileName: params.fileName,
        mimeType: params.mimeType,
        type: 'video',
      });

      if (!validation.success || !validation.data.valid) {
        throw new Error(validation.data.message || validation.error || 'Validation failed');
      }

      // Then upload
      return uploadMutation.mutateAsync(params);
    },
    [validateMutation, uploadMutation]
  );

  return {
    upload,
    validate: validateMutation,
    uploadVideo: uploadMutation,
    progress: uploadMutation.progress,
    isUploading: uploadMutation.isUploading,
    isValidating: validateMutation.isPending,
    isPending: validateMutation.isPending || uploadMutation.isPending,
    error: validateMutation.error || uploadMutation.error,
  };
}

// ============================================================================
// AD MEDIA UPLOAD HOOK
// ============================================================================

export interface UseUploadAdMediaParams {
  mediaUri: string;
  userId: string;
  fileName?: string;
  mimeType?: string;
  adId?: string;
}

/**
 * Hook to upload ad media (image or video) to R2 with progress tracking
 * 
 * @example
 * ```tsx
 * const { mutate, isPending, progress } = useUploadAdMediaToR2();
 * 
 * // Upload with progress
 * mutate({
 *   mediaUri: 'file:///path/to/image.jpg',
 *   userId: 'user-123',
 * });
 * 
 * // Display progress
 * <ProgressBar progress={progress} />
 * ```
 */
export function useUploadAdMediaToR2(): UseMutationResult<
  ApiResponse<AdMediaUploadResult>,
  Error,
  UseUploadAdMediaParams
> & UploadHookResult {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: UseUploadAdMediaParams) => {
      setProgress(0);
      setIsUploading(true);

      try {
        const result = await uploadAdMediaToR2(
          params.mediaUri,
          params.userId,
          {
            fileName: params.fileName,
            mimeType: params.mimeType,
            adId: params.adId,
          },
          {
            onProgress: (event: UploadProgressEvent) => {
              setProgress(event.progress);
            },
            onComplete: () => {
              setProgress(100);
              setIsUploading(false);
            },
            onError: () => {
              setIsUploading(false);
            },
          }
        );

        return result;
      } catch (error) {
        setIsUploading(false);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate ads cache to refetch
      queryClient.invalidateQueries({ queryKey: ['ads'] });
    },
  });

  return {
    ...mutation,
    progress,
    isUploading,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Re-export types
  VideoUploadResult,
  ThumbnailUploadResult,
  PresignedUploadResult,
  ValidateUploadResult,
  UploadProgressEvent,
  AdMediaUploadResult,
};
