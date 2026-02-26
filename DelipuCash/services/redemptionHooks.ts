/**
 * Unified Redemption Hooks — Single source of truth for all reward redemption flows.
 *
 * Replaces the divergent paths:
 * - useWithdraw (hooks.ts) for the Withdraw tab
 * - Direct rewardsApi.redeem() calls in reward answer screens
 *
 * Features:
 * - Optimistic TanStack cache + Zustand wallet deduction with rollback
 * - Unified cache invalidation (transactions, rewards, user, userStats)
 * - Burst polling trigger for quick transaction visibility when SSE is down
 * - Durable idempotency key management (survives retry, cleared on success)
 * - Rich error extraction from backend { error, message } responses
 */

import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rewardsApi } from './api';
import { queryKeys } from './hooks';
import { transactionQueryKeys } from './transactionHooks';
import { configKeys, pointsToUgx, type RewardConfig } from './configHooks';
import { useInstantRewardStore } from '@/store/InstantRewardStore';
import { useSSEStore } from '@/store/SSEStore';

// ─── Error Extraction Utility (Issue #7) ─────────────────────────────────────

/**
 * Extract a user-friendly error message from backend responses.
 * Checks both `message` and `error` fields, falling back gracefully.
 */
export function extractErrorMessage(err: unknown): string {
  // Standard Error objects (most common in mutation onError)
  if (err instanceof Error) return err.message;
  // API response objects with `message` (user-friendly) or `error` (machine-readable)
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message) return obj.message;
    if (typeof obj.error === 'string' && obj.error) return obj.error;
  }
  // Raw string errors (e.g. throw "something")
  if (typeof err === 'string' && err) return err;
  return 'Something went wrong. Please try again.';
}

// ─── Idempotency Key Generation ──────────────────────────────────────────────

function generateRedemptionKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `rdm-${globalThis.crypto.randomUUID()}`;
  }
  return `rdm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RedeemParams {
  /** Points to redeem (universal canonical unit) */
  pointsToRedeem: number;
  /** UGX cash value (derived from points via config rate) */
  cashValue: number;
  /** Mobile money provider */
  provider: 'MTN' | 'AIRTEL';
  /** Phone number for disbursement */
  phoneNumber: string;
  /** Redemption type */
  type: 'CASH' | 'AIRTIME';
  /** Caller-supplied idempotency key for retry persistence */
  idempotencyKey?: string;
}

export interface RedeemResult {
  success: boolean;
  transactionRef?: string;
  message?: string;
  pointsDeducted?: number;
  cashValue?: number;
  provider?: string;
  status?: 'SUCCESSFUL' | 'PENDING' | 'FAILED';
}

// ─── Optimistic Context ──────────────────────────────────────────────────────

interface OptimisticContext {
  previousUser: unknown;
  previousZustandBalance: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRedeem() {
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);

  const mutation = useMutation<RedeemResult, Error, RedeemParams, OptimisticContext>({
    mutationKey: ['rewards', 'redeem'],

    mutationFn: async (data) => {
      // Reuse caller-supplied key on retry; generate fresh only on first attempt
      const key = data.idempotencyKey || idempotencyKeyRef.current || generateRedemptionKey();
      idempotencyKeyRef.current = key;

      const response = await rewardsApi.redeem({
        pointsToRedeem: data.pointsToRedeem,
        cashValue: data.cashValue,
        provider: data.provider.toUpperCase(),
        phoneNumber: data.phoneNumber,
        type: data.type,
        idempotencyKey: key,
      });

      if (!response.success) {
        // Extract the best error message from the response payload
        throw new Error(extractErrorMessage(response.data || response));
      }

      return response.data as RedeemResult;
    },

    // Optimistic update: immediately deduct points from UI
    onMutate: async (variables) => {
      // Cancel in-flight refetches so they don't overwrite our optimistic value
      await queryClient.cancelQueries({ queryKey: queryKeys.user });

      // Snapshot the previous user data for rollback
      const previousUser = queryClient.getQueryData(queryKeys.user);

      // Optimistically deduct points from TanStack user cache
      queryClient.setQueryData(queryKeys.user, (old: any) => {
        if (!old) return old;
        const newPoints = Math.max(0, (old.points ?? 0) - variables.pointsToRedeem);
        return { ...old, points: newPoints };
      });

      // Optimistically update Zustand wallet (stored in UGX)
      const store = useInstantRewardStore.getState();
      const previousZustandBalance = store.walletBalance;
      store.updateWalletBalance(Math.max(0, previousZustandBalance - variables.cashValue));

      return { previousUser, previousZustandBalance };
    },

    onError: (_err, _variables, context) => {
      // Rollback TanStack cache
      if (context?.previousUser) {
        queryClient.setQueryData(queryKeys.user, context.previousUser);
      }
      // Rollback Zustand wallet
      if (context?.previousZustandBalance != null) {
        useInstantRewardStore.getState().updateWalletBalance(context.previousZustandBalance);
      }
    },

    onSuccess: (data) => {
      // Clear idempotency key on success (next redemption gets a fresh key)
      idempotencyKeyRef.current = null;

      // Sync Zustand store from server-confirmed values
      if (data?.pointsDeducted != null) {
        const currentUser = queryClient.getQueryData(queryKeys.user) as any;
        const rewardConfig = queryClient.getQueryData(configKeys.rewards()) as RewardConfig | undefined;
        if (currentUser?.points != null && rewardConfig) {
          useInstantRewardStore.getState().syncWalletFromServer(
            pointsToUgx(Math.max(0, currentUser.points), rewardConfig),
          );
        }
      }

      // Unified cache invalidation — covers ALL redemption consumers
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.rewards });
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
      queryClient.invalidateQueries({ queryKey: transactionQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionQueryKeys.summary() });

      // Trigger burst polling so the new transaction appears quickly when SSE is down
      useSSEStore.getState().startBurstPolling(120_000);
    },

    onSettled: () => {
      // Always refetch user to ensure final consistency regardless of outcome
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });

  // Helper to reset the idempotency key for a fresh redemption flow
  const resetIdempotencyKey = useCallback(() => {
    idempotencyKeyRef.current = null;
  }, []);

  return { ...mutation, resetIdempotencyKey, idempotencyKeyRef };
}
