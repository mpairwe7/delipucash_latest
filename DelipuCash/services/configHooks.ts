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
import { subscriptionPaymentKeys } from './subscriptionPaymentHooks';

// ============================================================================
// TYPES
// ============================================================================

export interface RewardConfig {
  surveyCompletionPoints: number;
  pointsToCashNumerator: number;
  pointsToCashDenominator: number;
  minWithdrawalPoints: number;
  defaultRegularRewardAmount: number;
  defaultInstantRewardAmount: number;
  referralBonusPoints: number;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

export const configKeys = {
  all: ['config'] as const,
  rewards: () => [...configKeys.all, 'rewards'] as const,
  subscriptions: () => [...configKeys.all, 'subscriptions'] as const,
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
  pointsToCashNumerator: 2000,
  pointsToCashDenominator: 50,
  minWithdrawalPoints: 50,
  defaultRegularRewardAmount: 200,
  defaultInstantRewardAmount: 500,
  referralBonusPoints: 60,
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

// ============================================================================
// SUBSCRIPTION PRICE CONFIG
// ============================================================================

export interface SubscriptionPriceConfig {
  subSurveyOncePrice: number;
  subSurveyDailyPrice: number;
  subSurveyWeeklyPrice: number;
  subSurveyMonthlyPrice: number;
  subSurveyQuarterlyPrice: number;
  subSurveyHalfYearlyPrice: number;
  subSurveyYearlyPrice: number;
  subSurveyLifetimePrice: number;
  subVideoDailyPrice: number;
  subVideoWeeklyPrice: number;
  subVideoMonthlyPrice: number;
  subVideoQuarterlyPrice: number;
  subVideoHalfYearlyPrice: number;
  subVideoYearlyPrice: number;
  subVideoLifetimePrice: number;
}

const DEFAULT_SUB_CONFIG: SubscriptionPriceConfig = {
  subSurveyOncePrice: 500,
  subSurveyDailyPrice: 300,
  subSurveyWeeklyPrice: 1500,
  subSurveyMonthlyPrice: 5000,
  subSurveyQuarterlyPrice: 12000,
  subSurveyHalfYearlyPrice: 22000,
  subSurveyYearlyPrice: 40000,
  subSurveyLifetimePrice: 100000,
  subVideoDailyPrice: 200,
  subVideoWeeklyPrice: 1000,
  subVideoMonthlyPrice: 3500,
  subVideoQuarterlyPrice: 9000,
  subVideoHalfYearlyPrice: 16000,
  subVideoYearlyPrice: 28000,
  subVideoLifetimePrice: 70000,
};

/** Fetch subscription price config from backend. */
export function useSubscriptionPriceConfig() {
  return useQuery<SubscriptionPriceConfig>({
    queryKey: configKeys.subscriptions(),
    queryFn: async () => {
      const { data } = await api.get<SubscriptionPriceConfig>('/api/config/subscriptions');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: DEFAULT_SUB_CONFIG,
  });
}

/** Mutation to update subscription prices (admin/moderator only). */
export function useUpdateSubscriptionPriceConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<SubscriptionPriceConfig>) => {
      const { data: result } = await api.put('/api/config/subscriptions', data);
      return result as { success: boolean; data: SubscriptionPriceConfig };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: configKeys.subscriptions() });
      // Invalidate both feature-type plan caches so MoMoPlanCard picks up new prices
      queryClient.invalidateQueries({ queryKey: subscriptionPaymentKeys.plans('SURVEY') });
      queryClient.invalidateQueries({ queryKey: subscriptionPaymentKeys.plans('VIDEO') });
    },
  });
}
