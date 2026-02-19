/**
 * useOfflineQueueProcessor
 *
 * Global hook that processes ALL pending reward answer submissions
 * when the device comes back online. Mount once in _layout.tsx.
 *
 * - Processes entire queue (not just the current screen's question)
 * - Max 3 retries per item; permanently failed items are discarded
 * - Reconciles store state (markQuestionAttempted, updateSessionSummary, confirmReward)
 * - Race condition guard: skips items already being processed
 * - Discards submissions from a different user (stale cross-user data)
 * - Handles "already attempted" server response by silently removing from queue
 */

import { useEffect, useRef } from 'react';
import { useInstantRewardStore } from '@/store';
import { useAuthStore } from '@/utils/auth/store';
import { useToast } from '@/components/ui/Toast';
import { onlineManager } from '@tanstack/react-query';
import api from '@/services/api';

const MAX_RETRIES = 3;

export function useOfflineQueueProcessor() {
  const { showToast } = useToast();
  const processingRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);
  // Capture showToast in a ref so the subscription callback always sees the latest
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    const processQueue = async () => {
      // Prevent concurrent processing
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        const auth = useAuthStore.getState().auth;

        // Don't process if no user is authenticated
        if (!auth?.user?.email) return;

        const pending = [...useInstantRewardStore.getState().pendingSubmissions];
        if (pending.length === 0) return;

        for (const submission of pending) {
          // Skip if already being processed (race condition guard)
          if (processingRef.current.has(submission.id)) continue;

          // Skip if submission belongs to a different user (stale data)
          if (submission.userEmail && submission.userEmail !== auth.user.email) {
            useInstantRewardStore.getState().removePendingSubmission(submission.id);
            continue;
          }

          // Discard if max retries exceeded
          if (submission.retryCount >= MAX_RETRIES) {
            useInstantRewardStore.getState().removePendingSubmission(submission.id);
            showToastRef.current({
              message: 'A queued answer failed after multiple attempts and was discarded.',
              type: 'error',
            });
            continue;
          }

          processingRef.current.add(submission.id);

          try {
            // Increment retry count before attempting
            useInstantRewardStore.getState().updatePendingSubmissionRetry(submission.id);

            const response = await api.rewards.submitAnswer(
              submission.questionId,
              submission.answer,
              submission.phoneNumber,
              submission.userEmail,
            );

            if (!response.success) {
              throw new Error(response.error || 'Submission failed');
            }

            const result = response.data;
            const store = useInstantRewardStore.getState();
            const rewardAmount = result.isCorrect ? result.rewardEarned : 0;

            // Reconcile: mark question as attempted in local history
            if (!store.hasAttemptedQuestion(submission.questionId)) {
              store.markQuestionAttempted({
                questionId: submission.questionId,
                isCorrect: result.isCorrect,
                selectedAnswer: submission.answer,
                rewardEarned: rewardAmount,
                pointsEarned: result.pointsAwarded ?? 0,
                isWinner: result.isWinner || false,
                position: result.position || null,
                paymentStatus: result.paymentStatus || null,
              });
            }

            // Reconcile: update session summary if a session is active
            const currentState = useInstantRewardStore.getState();
            if (currentState.sessionState !== 'IDLE' && currentState.sessionState !== 'COMPLETED') {
              currentState.updateSessionSummary(result.isCorrect, rewardAmount, result.pointsAwarded ?? 0);
            }

            // Reconcile: credit wallet if correct
            if (result.isCorrect) {
              useInstantRewardStore.getState().confirmReward(rewardAmount);
            }

            // Remove from queue
            useInstantRewardStore.getState().removePendingSubmission(submission.id);

            showToastRef.current({
              message: result.isCorrect
                ? `Queued answer submitted: Correct! +${rewardAmount} UGX earned.`
                : 'Queued answer submitted successfully.',
              type: result.isCorrect ? 'success' : 'info',
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';

            // If server says "already attempted", remove from queue (no retry needed)
            if (errorMsg.includes('already attempted') || errorMsg.includes('already answered')) {
              useInstantRewardStore.getState().removePendingSubmission(submission.id);
            }
            // Otherwise: stays in queue for next online event (retry count already incremented)
          } finally {
            processingRef.current.delete(submission.id);
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
  }, []);
}
