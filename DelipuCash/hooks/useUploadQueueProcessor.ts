/**
 * useUploadQueueProcessor
 *
 * Global hook that processes pending video uploads when the device
 * comes back online. Mount once in _layout.tsx.
 *
 * - Processes uploads sequentially (one at a time to avoid bandwidth contention)
 * - Max 3 retries per item; permanently failed items are discarded with toast
 * - Cross-user guard: skips uploads from a different userId
 * - Race condition guard: skips items already being processed
 *
 * Follows the same architecture as useOfflineQueueProcessor (reward answers).
 */

import { useEffect, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import { useVideoStore } from '@/store/VideoStore';
import { useAuthStore } from '@/utils/auth/store';
import { useToast } from '@/components/ui/Toast';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import {
  uploadVideoViaPresignedUrl,
  uploadThumbnailViaPresignedUrl,
  finalizeVideoUploadOnly,
} from '@/services/r2UploadService';

const MAX_RETRIES = 3;

export function useUploadQueueProcessor() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const processingRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    const processQueue = async () => {
      // Prevent concurrent processing
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        const auth = useAuthStore.getState().auth;
        if (!auth?.user?.id) return;

        const currentUserId = auth.user.id;
        const pending = [...useVideoStore.getState().pendingUploads];
        if (pending.length === 0) return;

        // Let the user know queued work is being retried (silent-retry UX gap:
        // previously the only signal was the eventual success/failure toast).
        const retryable = pending.filter(
          (u) => u.userId === currentUserId && u.retryCount < MAX_RETRIES,
        );
        if (retryable.length > 0) {
          showToastRef.current({
            message: `Retrying ${retryable.length} queued upload${retryable.length === 1 ? '' : 's'}…`,
            type: 'info',
          });
        }

        for (const upload of pending) {
          // Skip if already being processed (race condition guard)
          if (processingRef.current.has(upload.id)) continue;

          // Skip if upload belongs to a different user (stale data)
          if (upload.userId !== currentUserId) {
            useVideoStore.getState().removePendingUpload(upload.id);
            continue;
          }

          // Discard if max retries exceeded
          if (upload.retryCount >= MAX_RETRIES) {
            useVideoStore.getState().removePendingUpload(upload.id);
            showToastRef.current({
              message: `Upload of "${upload.title}" failed after multiple attempts.`,
              type: 'error',
            });
            continue;
          }

          processingRef.current.add(upload.id);

          try {
            // Finalize-only recovery: the file is already in R2 — just
            // re-send the (idempotent) finalize call; never re-upload.
            if (upload.finalizePayload) {
              await finalizeVideoUploadOnly(upload.finalizePayload);
              useVideoStore.getState().removePendingUpload(upload.id);
              queryClient.invalidateQueries({ queryKey: ['videos'] });
              showToastRef.current({
                message: `"${upload.title}" published!`,
                type: 'success',
              });
              continue;
            }

            // Validate the video file still exists — the OS may purge cache
            // files between queueing and retry (especially across restarts).
            // A missing file can never succeed, so drop it with a specific
            // message instead of burning retries on a generic failure.
            const videoInfo = await FileSystem.getInfoAsync(upload.videoUri).catch(() => null);
            if (!videoInfo?.exists) {
              useVideoStore.getState().removePendingUpload(upload.id);
              showToastRef.current({
                message: `"${upload.title}" can't be uploaded — the video file no longer exists on this device.`,
                type: 'error',
              });
              continue;
            }

            // Validate thumbnail file still exists (may be cleaned up after app restart)
            let thumbnailUri = upload.thumbnailUri;
            if (thumbnailUri) {
              try {
                const info = await FileSystem.getInfoAsync(thumbnailUri);
                if (!info.exists) thumbnailUri = undefined;
              } catch {
                thumbnailUri = undefined;
              }
            }

            // Upload thumbnail first if available, then video via presigned URL
            let thumbnailData: { key: string; publicUrl: string; mimeType: string } | undefined;
            if (thumbnailUri) {
              const thumbFileName = thumbnailUri.split('/').pop() || 'thumbnail.jpg';
              thumbnailData = await uploadThumbnailViaPresignedUrl(
                thumbnailUri, upload.userId, thumbFileName, 'image/jpeg'
              );
            }

            const result = await uploadVideoViaPresignedUrl(
              upload.videoUri,
              upload.userId,
              { title: upload.title, description: upload.description, duration: upload.duration },
              {}, // no progress tracking for background retry
              thumbnailData
            );

            if (!result.success) {
              throw new Error('Upload failed');
            }

            // Remove from queue on success
            useVideoStore.getState().removePendingUpload(upload.id);

            // The queue bypasses the upload hooks, so invalidate the feed
            // caches here — otherwise the new video only appears after
            // staleTime expiry.
            queryClient.invalidateQueries({ queryKey: ['videos'] });

            showToastRef.current({
              message: `"${upload.title}" uploaded successfully!`,
              type: 'success',
            });
          } catch (error) {
            // Single increment per failed attempt (a second pre-attempt
            // increment used to double-count, halving the real retry budget)
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            useVideoStore.getState().incrementUploadRetry(upload.id, errorMsg);
            // Stays in queue for next online event
          } finally {
            processingRef.current.delete(upload.id);
          }
        }
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Subscribe to TanStack Query's online manager for authoritative online status
    const unsubscribe = onlineManager.subscribe((isOnline) => {
      if (isOnline) {
        processQueue();
      }
    });

    // Also process on mount if already online (handles app restart with stale queue items)
    if (onlineManager.isOnline()) {
      processQueue();
    }

    return unsubscribe;
  }, [queryClient]);
}
