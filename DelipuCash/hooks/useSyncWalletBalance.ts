/**
 * useSyncWalletBalance — Centralized wallet balance synchronization hook
 *
 * Keeps Zustand's walletBalance (UGX) in sync with the server's authoritative
 * points value from TanStack Query's user cache.
 *
 * Architecture:
 * - Server source of truth: user.points (integer, stored in DB)
 * - TanStack Query cache: queryKeys.user → UserProfile { points, walletBalance }
 * - Zustand store: walletBalance in UGX (converted via pointsToUgx)
 *
 * This hook:
 * 1. Watches TanStack user cache for points changes
 * 2. Converts points → UGX using reward config
 * 3. Updates Zustand walletBalance to stay in sync
 * 4. Provides a manual `forceSync` for post-mutation reconciliation
 *
 * Usage:
 * ```tsx
 * const { userPoints, walletBalanceUgx, forceSync } = useSyncWalletBalance();
 * ```
 *
 * @module hooks/useSyncWalletBalance
 */

import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/hooks';
import { useRewardConfig, pointsToUgx } from '@/services/configHooks';
import { useInstantRewardStore } from '@/store/InstantRewardStore';
import useUser from '@/utils/useUser';

export interface SyncWalletBalanceResult {
  /** User's current points (server truth) */
  userPoints: number;
  /** Wallet balance in UGX (converted from points) */
  walletBalanceUgx: number;
  /** Force re-sync from server (refetches user profile) */
  forceSync: () => Promise<void>;
  /** Whether the user profile is loading */
  isLoading: boolean;
}

export function useSyncWalletBalance(): SyncWalletBalanceResult {
  const { data: user, loading } = useUser();
  const { data: rewardConfig } = useRewardConfig();
  const queryClient = useQueryClient();

  const syncWalletFromServer = useInstantRewardStore((s) => s.syncWalletFromServer);
  const walletBalanceUgx = useInstantRewardStore((s) => s.walletBalance);

  const userPoints = user?.points ?? 0;

  // Auto-sync Zustand when TanStack user cache updates
  useEffect(() => {
    if (user?.points != null && rewardConfig) {
      const ugx = pointsToUgx(user.points, rewardConfig);
      syncWalletFromServer(ugx);
    }
  }, [user?.points, rewardConfig, syncWalletFromServer]);

  // Force-sync: refetch user from server, then update Zustand
  const forceSync = useCallback(async () => {
    try {
      const result = await queryClient.fetchQuery({
        queryKey: queryKeys.user,
        staleTime: 0, // Force fresh fetch
      }) as any;

      if (result?.points != null && rewardConfig) {
        syncWalletFromServer(pointsToUgx(result.points, rewardConfig));
      }
    } catch {
      // If refetch fails, background invalidation will catch up
    }
  }, [queryClient, rewardConfig, syncWalletFromServer]);

  return {
    userPoints,
    walletBalanceUgx,
    forceSync,
    isLoading: loading,
  };
}

export default useSyncWalletBalance;
