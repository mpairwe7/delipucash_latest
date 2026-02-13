/**
 * Survey Payment Hooks
 * 
 * React Query hooks for survey payment and subscription management.
 * Provides caching, loading states, error handling, and optimistic updates.
 * 
 * @module services/surveyPaymentHooks
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
  UseMutationResult,
} from "@tanstack/react-query";
import {
  surveyPaymentApi,
  SurveySubscriptionPlan,
  SurveySubscription,
  SurveyPayment,
  SubscriptionStatusResponse,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  PaymentStatusResponse,
} from "./surveyPaymentApi";
import { PaymentStatus } from "@/types";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const surveyPaymentQueryKeys = {
  all: ["surveyPayment"] as const,
  plans: () => [...surveyPaymentQueryKeys.all, "plans"] as const,
  subscriptionStatus: () => [...surveyPaymentQueryKeys.all, "subscriptionStatus"] as const,
  paymentHistory: () => [...surveyPaymentQueryKeys.all, "history"] as const,
  paymentStatus: (paymentId: string) => [...surveyPaymentQueryKeys.all, "payment", paymentId] as const,
};

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Hook to fetch available subscription plans
 * 
 * @example
 * ```tsx
 * const { data: plans, isLoading, error } = useSurveySubscriptionPlans();
 * ```
 */
export function useSurveySubscriptionPlans(): UseQueryResult<SurveySubscriptionPlan[], Error> {
  return useQuery({
    queryKey: surveyPaymentQueryKeys.plans(),
    queryFn: async () => {
      const response = await surveyPaymentApi.getPlans();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes - plans don't change often
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook to fetch current user's subscription status
 * 
 * @example
 * ```tsx
 * const { data: status, isLoading } = useSurveySubscriptionStatus();
 * if (status?.hasActiveSubscription) {
 *   console.log(`Subscription expires in ${status.remainingDays} days`);
 * }
 * ```
 */
export function useSurveySubscriptionStatus(): UseQueryResult<SubscriptionStatusResponse, Error> {
  return useQuery({
    queryKey: surveyPaymentQueryKeys.subscriptionStatus(),
    queryFn: async () => {
      const response = await surveyPaymentApi.getSubscriptionStatus();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch payment history
 * 
 * @example
 * ```tsx
 * const { data: payments, isLoading } = useSurveyPaymentHistory();
 * ```
 */
export function useSurveyPaymentHistory(): UseQueryResult<SurveyPayment[], Error> {
  return useQuery({
    queryKey: surveyPaymentQueryKeys.paymentHistory(),
    queryFn: async () => {
      const response = await surveyPaymentApi.getPaymentHistory();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 60 * 1, // 1 minute
  });
}

/**
 * Hook to check specific payment status
 * 
 * @param paymentId - The payment ID to check
 * @param options - Query options
 * 
 * @example
 * ```tsx
 * const { data: status } = useSurveyPaymentStatus(paymentId, {
 *   refetchInterval: 5000, // Poll every 5 seconds
 * });
 * ```
 */
export function useSurveyPaymentStatus(
  paymentId: string | null,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
): UseQueryResult<PaymentStatusResponse, Error> {
  return useQuery({
    queryKey: surveyPaymentQueryKeys.paymentStatus(paymentId || ""),
    queryFn: async () => {
      if (!paymentId) throw new Error("Payment ID is required");
      const response = await surveyPaymentApi.checkPaymentStatus(paymentId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    enabled: Boolean(paymentId) && (options?.enabled !== false),
    refetchInterval: options?.refetchInterval,
    staleTime: 0, // Always fetch fresh data for payment status
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Hook to initiate a payment
 * 
 * @example
 * ```tsx
 * const { mutate: initiatePayment, isPending } = useInitiateSurveyPayment();
 * 
 * const handlePay = () => {
 *   initiatePayment({
 *     phoneNumber: '+256700123456',
 *     provider: PaymentProvider.MTN,
 *     planType: SurveySubscriptionType.MONTHLY,
 *   }, {
 *     onSuccess: (data) => {
 *       console.log('Payment initiated:', data.payment.id);
 *     },
 *   });
 * };
 * ```
 */
export function useInitiateSurveyPayment(): UseMutationResult<
  InitiatePaymentResponse,
  Error,
  InitiatePaymentRequest
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['surveyPayment', 'initiate'],
    mutationFn: async (request: InitiatePaymentRequest) => {
      const response = await surveyPaymentApi.initiatePayment(request);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate payment history to include new payment
      queryClient.invalidateQueries({
        queryKey: surveyPaymentQueryKeys.paymentHistory(),
      });
    },
  });
}

/**
 * Hook to check and update payment status
 * Used for polling payment completion
 * 
 * @example
 * ```tsx
 * const { mutate: checkStatus } = useCheckSurveyPaymentStatus();
 * 
 * // Poll for completion
 * useEffect(() => {
 *   const interval = setInterval(() => {
 *     checkStatus(paymentId, {
 *       onSuccess: (data) => {
 *         if (data.payment.status !== 'PENDING') {
 *           clearInterval(interval);
 *         }
 *       },
 *     });
 *   }, 5000);
 *   return () => clearInterval(interval);
 * }, [paymentId]);
 * ```
 */
export function useCheckSurveyPaymentStatus(): UseMutationResult<
  PaymentStatusResponse,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['surveyPayment', 'checkStatus'],
    mutationFn: async (paymentId: string) => {
      const response = await surveyPaymentApi.checkPaymentStatus(paymentId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      // Update payment status in cache
      queryClient.setQueryData(
        surveyPaymentQueryKeys.paymentStatus(data.payment.id),
        data
      );

      // If payment completed successfully, invalidate subscription status
      if (data.payment.status === PaymentStatus.SUCCESSFUL) {
        queryClient.invalidateQueries({
          queryKey: surveyPaymentQueryKeys.subscriptionStatus(),
        });
        queryClient.invalidateQueries({
          queryKey: surveyPaymentQueryKeys.paymentHistory(),
        });
      }
    },
  });
}

/**
 * Hook to cancel subscription auto-renewal
 * 
 * @example
 * ```tsx
 * const { mutate: cancelSubscription, isPending } = useCancelSurveySubscription();
 * 
 * const handleCancel = () => {
 *   cancelSubscription(subscriptionId, {
 *     onSuccess: () => {
 *       Alert.alert('Success', 'Auto-renewal disabled');
 *     },
 *   });
 * };
 * ```
 */
export function useCancelSurveySubscription(): UseMutationResult<
  SurveySubscription,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['surveyPayment', 'cancelSubscription'],
    mutationFn: async (subscriptionId: string) => {
      const response = await surveyPaymentApi.cancelSubscription(subscriptionId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: surveyPaymentQueryKeys.subscriptionStatus(),
      });
    },
  });
}

/**
 * Hook to simulate payment completion (for testing only)
 * 
 * @example
 * ```tsx
 * const { mutate: simulate } = useSimulatePaymentCompletion();
 * simulate({ paymentId, success: true });
 * ```
 */
export function useSimulatePaymentCompletion(): UseMutationResult<
  PaymentStatusResponse,
  Error,
  { paymentId: string; success: boolean }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['surveyPayment', 'simulateCompletion'],
    mutationFn: async ({ paymentId, success }) => {
      const response = await surveyPaymentApi.simulatePaymentCompletion(paymentId, success);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        surveyPaymentQueryKeys.paymentStatus(data.payment.id),
        data
      );
      queryClient.invalidateQueries({
        queryKey: surveyPaymentQueryKeys.subscriptionStatus(),
      });
      queryClient.invalidateQueries({
        queryKey: surveyPaymentQueryKeys.paymentHistory(),
      });
    },
  });
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Combined hook for payment flow state management
 * 
 * @example
 * ```tsx
 * const {
 *   plans,
 *   subscriptionStatus,
 *   initiatePayment,
 *   isInitiating,
 *   currentPayment,
 *   paymentStatus,
 *   isPolling,
 * } = useSurveyPaymentFlow();
 * ```
 */
export function useSurveyPaymentFlow() {
  const plansQuery = useSurveySubscriptionPlans();
  const subscriptionStatusQuery = useSurveySubscriptionStatus();
  const initiateMutation = useInitiateSurveyPayment();
  const checkStatusMutation = useCheckSurveyPaymentStatus();

  return {
    // Plans
    plans: plansQuery.data || [],
    isLoadingPlans: plansQuery.isLoading,
    plansError: plansQuery.error,

    // Subscription status
    subscriptionStatus: subscriptionStatusQuery.data,
    isLoadingStatus: subscriptionStatusQuery.isLoading,
    statusError: subscriptionStatusQuery.error,
    hasActiveSubscription: subscriptionStatusQuery.data?.hasActiveSubscription || false,
    currentSubscription: subscriptionStatusQuery.data?.subscription,
    remainingDays: subscriptionStatusQuery.data?.remainingDays || 0,

    // Payment initiation
    initiatePayment: initiateMutation.mutate,
    initiatePaymentAsync: initiateMutation.mutateAsync,
    isInitiating: initiateMutation.isPending,
    initiateError: initiateMutation.error,
    initiatedPayment: initiateMutation.data?.payment,

    // Payment status check
    checkPaymentStatus: checkStatusMutation.mutate,
    checkPaymentStatusAsync: checkStatusMutation.mutateAsync,
    isCheckingStatus: checkStatusMutation.isPending,
    paymentStatusResult: checkStatusMutation.data,

    // Refresh functions
    refreshPlans: plansQuery.refetch,
    refreshStatus: subscriptionStatusQuery.refetch,
  };
}

export default {
  useSurveySubscriptionPlans,
  useSurveySubscriptionStatus,
  useSurveyPaymentHistory,
  useSurveyPaymentStatus,
  useInitiateSurveyPayment,
  useCheckSurveyPaymentStatus,
  useCancelSurveySubscription,
  useSimulatePaymentCompletion,
  useSurveyPaymentFlow,
  surveyPaymentQueryKeys,
};
