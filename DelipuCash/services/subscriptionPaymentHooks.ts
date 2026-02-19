/**
 * React Query hooks for Mobile Money subscription payments
 *
 * Handles the MoMo payment lifecycle:
 * - Initiating collection (request-to-pay) via MTN or Airtel
 * - Polling payment status until resolved
 * - Fetching unified subscription status (MoMo + Google Play)
 * - Fetching available MoMo plans with pricing
 *
 * @module services/subscriptionPaymentHooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { purchasesQueryKeys } from './purchasesQueryKeys';

// ============================================================================
// TYPES
// ============================================================================

export interface MoMoPaymentInitiation {
  payment: {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    phoneNumber: string;
    provider: string;
    planType: string;
    transactionId: string;
    status: 'PENDING';
    statusMessage: string;
  };
  message: string;
  requiresConfirmation: boolean;
  expiresAt: string;
}

export interface MoMoPaymentStatus {
  payment: {
    id: string;
    status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
    statusMessage: string;
    amount: number;
    currency: string;
    provider: string;
    planType: string;
  };
  subscription: {
    planType: string;
    startDate: string;
    endDate: string;
  } | null;
}

export interface UnifiedSubscriptionStatus {
  isActive: boolean;
  source: 'GOOGLE_PLAY' | 'MOBILE_MONEY' | 'NONE';
  expirationDate: string | null;
  remainingDays: number;
  planType: string | null;
}

export interface MoMoPlan {
  id: string;
  type: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  durationDays: number;
  features: string[];
  isPopular?: boolean;
  isBestValue?: boolean;
  savings?: string;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

export const subscriptionPaymentKeys = {
  all: ['subscription-payment'] as const,
  status: (id: string) => [...subscriptionPaymentKeys.all, 'status', id] as const,
  unified: () => [...subscriptionPaymentKeys.all, 'unified'] as const,
  plans: () => [...subscriptionPaymentKeys.all, 'plans'] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to initiate a MoMo payment for subscription
 *
 * @example
 * ```tsx
 * const { mutate: initiate, isPending } = useMoMoPaymentInitiate();
 *
 * initiate({
 *   phoneNumber: '+256700123456',
 *   provider: 'MTN',
 *   planType: 'MONTHLY',
 * }, {
 *   onSuccess: (data) => setPaymentId(data.payment.id),
 * });
 * ```
 */
/**
 * Generate a client-side idempotency key.
 * Uses timestamp + random suffix — unique per payment attempt.
 */
function generateIdempotencyKey(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `idk_${ts}_${rand}`;
}

export function useMoMoPaymentInitiate() {
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  return useMutation({
    mutationFn: async (data: {
      phoneNumber: string;
      provider: 'MTN' | 'AIRTEL';
      planType: string;
    }) => {
      const response = await api.post<MoMoPaymentInitiation>(
        '/api/survey-payments/initiate',
        { ...data, idempotencyKey: idempotencyKeyRef.current },
      );
      return response.data;
    },
    onSettled: () => {
      // Generate a fresh key for the next attempt (retry or new payment)
      idempotencyKeyRef.current = generateIdempotencyKey();
    },
  });
}

/**
 * Hook to poll MoMo payment status
 * Polls every 3 seconds while PENDING, stops on SUCCESSFUL/FAILED
 *
 * @param paymentId - The payment ID to poll (null to disable)
 */
export function useMoMoPaymentStatus(paymentId: string | null) {
  return useQuery({
    queryKey: subscriptionPaymentKeys.status(paymentId ?? ''),
    queryFn: async () => {
      const response = await api.get<MoMoPaymentStatus>(
        `/api/survey-payments/${paymentId}/status`,
      );
      return response.data;
    },
    enabled: Boolean(paymentId),
    refetchInterval: (query) => {
      const status = query.state.data?.payment?.status;
      // Stop polling once resolved
      if (status === 'SUCCESSFUL' || status === 'FAILED') return false;
      return 3000; // Poll every 3 seconds while PENDING
    },
  });
}

/**
 * Hook to get unified subscription status (MoMo + Google Play)
 */
export function useUnifiedSubscription() {
  return useQuery({
    queryKey: subscriptionPaymentKeys.unified(),
    queryFn: async () => {
      const response = await api.get<UnifiedSubscriptionStatus>(
        '/api/survey-payments/unified-status',
      );
      return response.data;
    },
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to fetch available MoMo subscription plans with pricing
 */
export function useMoMoPlans() {
  return useQuery({
    queryKey: subscriptionPaymentKeys.plans(),
    queryFn: async () => {
      const response = await api.get<MoMoPlan[]>('/api/survey-subscriptions/plans');
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Custom hook managing the full MoMo payment polling lifecycle
 *
 * Combines initiation + polling + timeout into a single flow:
 * - Starts polling when a payment ID is set
 * - Auto-stops on SUCCESSFUL, FAILED, or 5-min timeout
 * - Invalidates subscription queries on success
 *
 * @example
 * ```tsx
 * const { initiate, status, isPolling, reset } = useMoMoPaymentFlow();
 *
 * // Start payment
 * initiate({ phoneNumber, provider, planType });
 *
 * // status will be: null | 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'TIMEOUT'
 * ```
 */
export function useMoMoPaymentFlow() {
  const queryClient = useQueryClient();
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const initiateMutation = useMoMoPaymentInitiate();
  const statusQuery = useMoMoPaymentStatus(timedOut ? null : paymentId);

  // 5-minute timeout — also clears paymentId to stop background polling
  useEffect(() => {
    if (!paymentId) return;
    setTimedOut(false);

    const timer = setTimeout(() => {
      setTimedOut(true);
      setPaymentId(null); // Stop polling query by disabling it
    }, 5 * 60 * 1000);

    return () => clearTimeout(timer);
  }, [paymentId]);

  // Invalidate subscription queries on success
  useEffect(() => {
    if (statusQuery.data?.payment?.status === 'SUCCESSFUL') {
      queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.subscription() });
      queryClient.invalidateQueries({ queryKey: subscriptionPaymentKeys.unified() });
    }
  }, [statusQuery.data?.payment?.status, queryClient]);

  const initiate = useCallback(
    (data: { phoneNumber: string; provider: 'MTN' | 'AIRTEL'; planType: string }) => {
      initiateMutation.mutate(data, {
        onSuccess: (result) => {
          setPaymentId(result.payment.id);
        },
      });
    },
    [initiateMutation],
  );

  const reset = useCallback(() => {
    setPaymentId(null);
    setTimedOut(false);
  }, []);

  // Derive unified status
  let status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'TIMEOUT' | null = null;
  if (timedOut) {
    status = 'TIMEOUT';
  } else if (statusQuery.data?.payment?.status) {
    status = statusQuery.data.payment.status;
  } else if (paymentId) {
    status = 'PENDING';
  }

  return {
    initiate,
    reset,
    status,
    paymentId,
    isInitiating: initiateMutation.isPending,
    isPolling: Boolean(paymentId) && !timedOut && status === 'PENDING',
    paymentData: statusQuery.data,
    initiationMessage: initiateMutation.data?.message ?? null,
    initiationError: initiateMutation.error,
    networkError: statusQuery.error, // Expose polling errors for UI feedback
  };
}
