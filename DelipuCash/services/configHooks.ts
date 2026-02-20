/**
 * React Query hooks for App Configuration
 *
 * Fetches and updates the global reward config (points per survey,
 * cash conversion rate, minimum withdrawal threshold).
 *
 * @module services/configHooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

// ============================================================================
// TYPES
// ============================================================================

export interface RewardConfig {
  surveyCompletionPoints: number;
  pointsToCashNumerator: number;
  pointsToCashDenominator: number;
  minWithdrawalPoints: number;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

export const configKeys = {
  all: ['config'] as const,
  rewards: () => [...configKeys.all, 'rewards'] as const,
};

// ============================================================================
// CONVERSION HELPERS
// ============================================================================

/** Convert points to UGX using config-driven integer rate. */
export function pointsToUgx(points: number, config: RewardConfig): number {
  return Math.floor(
    (points * config.pointsToCashNumerator) / config.pointsToCashDenominator,
  );
}

/** Convert UGX to points using config-driven integer rate. */
export function ugxToPoints(ugx: number, config: RewardConfig): number {
  return Math.ceil(
    (ugx * config.pointsToCashDenominator) / config.pointsToCashNumerator,
  );
}

/** Generate dynamic redemption options from config. */
export function getRedemptionOptions(config: RewardConfig) {
  const min = config.minWithdrawalPoints;
  return [
    { points: min, cashValue: pointsToUgx(min, config) },
    { points: min * 2, cashValue: pointsToUgx(min * 2, config) },
    { points: min * 5, cashValue: pointsToUgx(min * 5, config) },
    { points: min * 10, cashValue: pointsToUgx(min * 10, config) },
  ];
}

// ============================================================================
// DEFAULT CONFIG (used as placeholder while loading)
// ============================================================================

const DEFAULT_CONFIG: RewardConfig = {
  surveyCompletionPoints: 10,
  pointsToCashNumerator: 2500,
  pointsToCashDenominator: 20,
  minWithdrawalPoints: 50,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch the global reward config.
 * Config rarely changes so we use a long staleTime.
 */
export function useRewardConfig() {
  return useQuery<RewardConfig>({
    queryKey: configKeys.rewards(),
    queryFn: async () => {
      const { data } = await api.get<RewardConfig>('/api/config/rewards');
      return data;
    },
    staleTime: 5 * 60 * 1000,   // 5 minutes
    gcTime: 30 * 60 * 1000,     // 30 minutes
    placeholderData: DEFAULT_CONFIG,
  });
}

/**
 * Mutation to update the reward config (admin/moderator only).
 * Invalidates the config query on success.
 */
export function useUpdateRewardConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<RewardConfig>) => {
      const { data: result } = await api.put('/api/config/rewards', data);
      return result as { success: boolean; data: RewardConfig };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: configKeys.rewards() });
    },
  });
}
