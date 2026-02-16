/**
 * SSE React Hooks
 *
 * useSSEConnection() — Mount ONCE in app root. Manages SSE lifecycle
 * and routes events to targeted TanStack Query cache invalidations.
 *
 * useSSEEvent() — Subscribe to specific event types in any component.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSSEManager } from './SSEManager';
import { useSSEStore } from '@/store/SSEStore';
import { useAuthStore } from '@/utils/auth/store';
import { queryKeys } from '@/services/hooks';
import { questionQueryKeys } from '@/services/questionHooks';
import { videoQueryKeys } from '@/services/videoHooks';
import { useVideoStore } from '@/store/VideoStore';
import type { SSEEventType, LivestreamViewerCountPayload } from './types';

/**
 * Root-level hook that manages the SSE connection and routes events
 * to targeted TanStack Query cache invalidations.
 *
 * Mount this ONCE inside the SSEProvider component.
 */
export function useSSEConnection(): void {
  const queryClient = useQueryClient();
  const auth = useAuthStore((state) => state.auth);
  const isEnabled = useSSEStore((state) => state.isEnabled);
  const setStatus = useSSEStore((state) => state.setStatus);
  const cleanupRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!auth?.token || !isEnabled) {
      getSSEManager().disconnect();
      setStatus('disconnected');
      return;
    }

    const manager = getSSEManager();

    // Sync connection status to Zustand
    const unsubStatus = manager.onStatusChange((status) => {
      setStatus(status);
    });
    cleanupRef.current.push(unsubStatus);

    // --- Static event → query invalidation routes ---

    const routes: Array<[string, () => void]> = [
      [
        'notification.new',
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
          queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
        },
      ],
      [
        'notification.read',
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
        },
      ],
      [
        'notification.readAll',
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
          queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
        },
      ],
      [
        'question.new',
        () => {
          queryClient.invalidateQueries({ queryKey: questionQueryKeys.feeds() });
        },
      ],
      [
        'question.vote',
        () => {
          queryClient.invalidateQueries({ queryKey: questionQueryKeys.feeds() });
        },
      ],
      [
        'payment.status',
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
          queryClient.invalidateQueries({ queryKey: queryKeys.user });
          queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
        },
      ],
      [
        'survey.response',
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.surveys });
        },
      ],
      [
        'survey.completed',
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.surveys });
          queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
        },
      ],
      [
        'video.like',
        () => {
          queryClient.invalidateQueries({ queryKey: videoQueryKeys.all });
        },
      ],
      [
        'livestream.started',
        () => {
          queryClient.invalidateQueries({ queryKey: videoQueryKeys.livestreams() });
        },
      ],
      [
        'livestream.ended',
        () => {
          queryClient.invalidateQueries({ queryKey: videoQueryKeys.livestreams() });
          queryClient.invalidateQueries({ queryKey: videoQueryKeys.all });
        },
      ],
    ];

    for (const [eventType, handler] of routes) {
      cleanupRef.current.push(manager.on(eventType, handler));
    }

    // --- Dynamic event handlers that use payload data ---

    cleanupRef.current.push(
      manager.on('question.response', (data: unknown) => {
        const payload = data as { questionId?: string };
        if (payload?.questionId) {
          queryClient.invalidateQueries({
            queryKey: questionQueryKeys.detail(payload.questionId),
          });
          queryClient.invalidateQueries({
            queryKey: questionQueryKeys.responses(payload.questionId),
          });
        }
        queryClient.invalidateQueries({
          queryKey: questionQueryKeys.feeds(),
        });
      }),
    );

    cleanupRef.current.push(
      manager.on('response.like', (data: unknown) => {
        const payload = data as { questionId?: string };
        if (payload?.questionId) {
          queryClient.invalidateQueries({
            queryKey: questionQueryKeys.detail(payload.questionId),
          });
        }
      }),
    );

    cleanupRef.current.push(
      manager.on('response.dislike', (data: unknown) => {
        const payload = data as { questionId?: string };
        if (payload?.questionId) {
          queryClient.invalidateQueries({
            queryKey: questionQueryKeys.detail(payload.questionId),
          });
        }
      }),
    );

    cleanupRef.current.push(
      manager.on('response.reply', (data: unknown) => {
        const payload = data as { questionId?: string };
        if (payload?.questionId) {
          queryClient.invalidateQueries({
            queryKey: questionQueryKeys.detail(payload.questionId),
          });
        }
      }),
    );

    cleanupRef.current.push(
      manager.on('video.comment', (data: unknown) => {
        const payload = data as { videoId?: string };
        if (payload?.videoId) {
          queryClient.invalidateQueries({
            queryKey: videoQueryKeys.comments(payload.videoId),
          });
          queryClient.invalidateQueries({
            queryKey: videoQueryKeys.detail(payload.videoId),
          });
        }
      }),
    );

    // Livestream viewer count — update store directly for real-time display
    cleanupRef.current.push(
      manager.on('livestream.viewerCount', (data: unknown) => {
        const payload = data as LivestreamViewerCountPayload;
        if (payload?.viewerCount !== undefined) {
          useVideoStore.getState().updateViewerCount(payload.viewerCount);
        }
      }),
    );

    // Connect
    manager.connect();

    return () => {
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
      manager.disconnect();
    };
  }, [auth?.token, isEnabled, queryClient, setStatus]);
}

/**
 * Subscribe to a specific SSE event type in any component.
 * Side-effect only — returns nothing.
 *
 * @example
 * useSSEEvent('payment.status', (data) => {
 *   if (data.status === 'SUCCESSFUL') showToast('Payment complete!');
 * });
 */
export function useSSEEvent<T = unknown>(
  eventType: SSEEventType,
  handler: (data: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const manager = getSSEManager();
    const unsub = manager.on(eventType, (data) => {
      handlerRef.current(data as T);
    });
    return unsub;
  }, [eventType]);
}
