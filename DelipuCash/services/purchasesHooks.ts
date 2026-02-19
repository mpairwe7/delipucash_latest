/**
 * React Query hooks for RevenueCat Purchases
 * 
 * These hooks provide a clean React interface for:
 * - Fetching available subscription packages
 * - Checking subscription status
 * - Making purchases
 * - Restoring purchases
 * 
 * @module services/purchasesHooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useMemo } from 'react';
import { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { purchasesService, ENTITLEMENTS } from './purchasesService';
import { purchasesQueryKeys } from './purchasesQueryKeys';
import { useUnifiedSubscription } from './subscriptionPaymentHooks';
import {
  MAX_UPLOAD_SIZE_FREE,
  MAX_UPLOAD_SIZE_PREMIUM,
  MAX_RECORDING_DURATION,
  MAX_RECORDING_DURATION_PREMIUM,
  MAX_LIVESTREAM_DURATION,
  MAX_LIVESTREAM_DURATION_PREMIUM,
} from '@/utils/video-utils';

// Re-export query keys for backwards compatibility
export { purchasesQueryKeys } from './purchasesQueryKeys';

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to get available subscription offerings/packages
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error } = useOfferings();
 * 
 * // Display available packages
 * data?.current?.availablePackages.map(pkg => (
 *   <PackageCard key={pkg.identifier} package={pkg} />
 * ));
 * ```
 */
export function useOfferings() {
  return useQuery({
    queryKey: purchasesQueryKeys.offerings(),
    queryFn: () => purchasesService.getOfferings(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
    retryDelay: 1000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to check current subscription status
 * 
 * @example
 * ```tsx
 * const { data: subscription } = useSubscriptionStatus();
 * 
 * if (subscription?.isActive) {
 *   // Show premium content
 * }
 * ```
 */
export function useSubscriptionStatus() {
  return useQuery({
    queryKey: purchasesQueryKeys.subscription(),
    queryFn: () => purchasesService.checkSubscription(),
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/**
 * Hook to get full customer info
 */
export function useCustomerInfo() {
  return useQuery({
    queryKey: purchasesQueryKeys.customerInfo(),
    queryFn: () => purchasesService.getCustomerInfo(),
    staleTime: 1000 * 60, // 1 minute
    enabled: purchasesService.isReady(),
  });
}

/**
 * Hook to check if user has survey creator entitlement
 *
 * @example
 * ```tsx
 * const { canCreateSurvey } = useSurveyCreatorAccess();
 *
 * if (!canCreateSurvey) {
 *   return <SubscriptionPrompt />;
 * }
 * ```
 */
export function useSurveyCreatorAccess() {
  const premium = usePremiumStatus();
  const { data: rcSub, refetch } = useSubscriptionStatus();

  // Google Play subs have willRenew from RevenueCat; MoMo subs don't auto-renew
  const willRenew = premium.source === 'GOOGLE_PLAY'
    ? (rcSub?.willRenew ?? false)
    : false;

  return {
    canCreateSurvey: premium.isPremium,
    isLoading: premium.isLoading,
    subscription: premium.expirationDate ? {
      expirationDate: new Date(premium.expirationDate),
      willRenew,
      isActive: premium.isPremium,
    } : null,
    refetch,
  };
}

/**
 * Unified subscription status combining RevenueCat + Mobile Money
 *
 * Returns active if EITHER source has an active subscription.
 * Use this instead of `useSubscriptionStatus` when you need to
 * account for MoMo-purchased subscriptions.
 *
 * @example
 * ```tsx
 * const { isActive, source, remainingDays } = useUnifiedSubscriptionStatus();
 * ```
 */
export function useUnifiedSubscriptionStatus() {
  const { data: revenueCatSub, isLoading: rcLoading } = useSubscriptionStatus();

  const { data: momoSub, isLoading: momoLoading } = useUnifiedSubscription();

  const rcActive = revenueCatSub?.isActive ?? false;
  const momoActive = momoSub?.isActive ?? false;

  let source: 'GOOGLE_PLAY' | 'MOBILE_MONEY' | 'NONE' = 'NONE';
  if (rcActive) source = 'GOOGLE_PLAY';
  else if (momoActive) source = 'MOBILE_MONEY';

  // Use the latest expiration between the two
  let expirationDate: string | null = null;
  let remainingDays = 0;

  if (rcActive && revenueCatSub?.expirationDate) {
    expirationDate = revenueCatSub.expirationDate instanceof Date
      ? revenueCatSub.expirationDate.toISOString()
      : String(revenueCatSub.expirationDate);
    remainingDays = Math.max(0, Math.ceil(
      (new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));
  }

  if (momoActive && momoSub?.expirationDate) {
    const momoExpiry = new Date(momoSub.expirationDate);
    if (!expirationDate || momoExpiry.getTime() > new Date(expirationDate).getTime()) {
      expirationDate = momoSub.expirationDate;
      // Calculate client-side for consistency with RevenueCat path
      remainingDays = Math.max(0, Math.ceil(
        (momoExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ));
      source = 'MOBILE_MONEY';
    }
  }

  return {
    isActive: rcActive || momoActive,
    isLoading: rcLoading || momoLoading,
    source,
    expirationDate,
    remainingDays,
    planType: momoSub?.planType ?? null,
  };
}

/**
 * Unified premium status — single source of truth for all premium gating.
 *
 * Returns true if the user has ANY active subscription (RevenueCat OR MoMo).
 * Use this for survey creation access, video premium, and ad-free gating.
 *
 * @example
 * ```tsx
 * const { isPremium, source, remainingDays } = usePremiumStatus();
 * ```
 */
export function usePremiumStatus() {
  const unified = useUnifiedSubscriptionStatus();

  return useMemo(() => ({
    isPremium: unified.isActive,
    isLoading: unified.isLoading,
    source: unified.source,
    expirationDate: unified.expirationDate,
    remainingDays: unified.remainingDays,
    planType: unified.planType,
  }), [unified.isActive, unified.isLoading, unified.source, unified.expirationDate, unified.remainingDays, unified.planType]);
}

/**
 * Hook to detect billing issues (grace period, account hold, pending purchases)
 *
 * Checks BOTH RevenueCat (Google Play) and MoMo subscription sources.
 * RevenueCat: uses CustomerInfo entitlements for grace period / account hold.
 * MoMo: checks unified subscription for expired-with-prior-payment scenarios.
 */
export function useBillingIssueDetection() {
  const { data: customerInfo, isLoading: rcLoading } = useCustomerInfo();
  const { data: subscription } = useSubscriptionStatus();

  const { data: momoSub, isLoading: momoLoading } = useUnifiedSubscription();

  const billingIssue = (() => {
    // ── RevenueCat (Google Play) billing issues ──
    if (customerInfo && subscription) {
      const surveyEntitlement = customerInfo.entitlements.active[ENTITLEMENTS.SURVEY_CREATOR];
      if (surveyEntitlement) {
        // Grace period: subscription is active but billing retry is in progress
        if (surveyEntitlement.isActive && surveyEntitlement.billingIssueDetectedAt) {
          return {
            type: 'grace_period' as const,
            source: 'GOOGLE_PLAY' as const,
            detectedAt: new Date(surveyEntitlement.billingIssueDetectedAt),
            message: 'Your payment method needs updating. You still have access while we retry.',
          };
        }

        // Expired with billing issue — account hold (no access)
        if (!surveyEntitlement.isActive && surveyEntitlement.billingIssueDetectedAt) {
          return {
            type: 'account_hold' as const,
            source: 'GOOGLE_PLAY' as const,
            detectedAt: new Date(surveyEntitlement.billingIssueDetectedAt),
            message: 'Your subscription is on hold due to a payment issue. Update your payment method to restore access.',
          };
        }
      }
    }

    // ── MoMo billing issues ──
    // If MoMo subscription data exists (user had a plan) but is no longer active,
    // it means their MoMo subscription expired and needs renewal.
    if (momoSub && momoSub.planType && !momoSub.isActive) {
      return {
        type: 'expired' as const,
        source: 'MOBILE_MONEY' as const,
        detectedAt: momoSub.expirationDate ? new Date(momoSub.expirationDate) : null,
        message: 'Your mobile money subscription has expired. Renew to restore access to all premium features.',
      };
    }

    return null;
  })();

  return {
    billingIssue,
    hasBillingIssue: billingIssue !== null,
    isLoading: rcLoading || momoLoading,
  };
}

/**
 * Hook to check if user has video premium entitlement
 * 
 * Video premium allows:
 * - Upload videos larger than 40MB (up to 500MB)
 * - Livestream longer than 5 minutes (up to 2 hours)
 * 
 * This hook combines RevenueCat subscription status with backend API limits.
 * The backend is the source of truth for actual limits.
 * 
 * @example
 * ```tsx
 * const { hasVideoPremium, maxUploadSize, maxLivestreamDuration } = useVideoPremiumAccess();
 * 
 * if (!hasVideoPremium && fileSize > 40MB) {
 *   return <UpgradePrompt />;
 * }
 * ```
 */
export function useVideoPremiumAccess() {
  const { isPremium, isLoading } = usePremiumStatus();
  const { refetch } = useSubscriptionStatus();

  return {
    hasVideoPremium: isPremium,
    isLoading,
    refetch,
    // Limits from video-utils (single source of truth)
    maxUploadSize: isPremium ? MAX_UPLOAD_SIZE_PREMIUM : MAX_UPLOAD_SIZE_FREE,
    maxLivestreamDuration: isPremium ? MAX_LIVESTREAM_DURATION_PREMIUM : MAX_LIVESTREAM_DURATION,
    maxRecordingDuration: isPremium ? MAX_RECORDING_DURATION_PREMIUM : MAX_RECORDING_DURATION,
    // Formatted versions for display
    maxUploadSizeFormatted: isPremium ? '500 MB' : '40 MB',
    maxLivestreamDurationFormatted: isPremium ? '2 hours' : '5 minutes',
    maxRecordingDurationFormatted: isPremium ? '30 minutes' : '5 minutes',
  };
}

/**
 * Hook to purchase a package
 * 
 * @example
 * ```tsx
 * const { mutate: purchase, isLoading } = usePurchase();
 * 
 * const handlePurchase = (pkg: PurchasesPackage) => {
 *   purchase(pkg, {
 *     onSuccess: (result) => {
 *       if (result.success) {
 *         // Purchase successful
 *       } else if (result.userCancelled) {
 *         // User cancelled
 *       } else {
 *         // Show error
 *       }
 *     }
 *   });
 * };
 * ```
 */
export function usePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (packageToBuy: PurchasesPackage) =>
      purchasesService.purchasePackage(packageToBuy),
    onSuccess: (result) => {
      if (result.success && result.customerInfo) {
        // Optimistically update cache with returned customerInfo
        queryClient.setQueryData(
          purchasesQueryKeys.customerInfo(),
          result.customerInfo
        );
        // Invalidate to refetch fresh data from both sources
        queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.subscription() });
        // Also invalidate MoMo unified cache so premium status updates immediately
        queryClient.invalidateQueries({ queryKey: ['subscription-payment', 'unified'] });
      }
    },
  });
}

/**
 * Hook to restore purchases
 * 
 * @example
 * ```tsx
 * const { mutate: restore, isLoading } = useRestorePurchases();
 * 
 * <Button 
 *   onPress={() => restore()} 
 *   disabled={isLoading}
 * >
 *   Restore Purchases
 * </Button>
 * ```
 */
export function useRestorePurchases() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => purchasesService.restorePurchases(),
    onSuccess: () => {
      // Refresh subscription status after restore
      queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.subscription() });
      queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.customerInfo() });
    },
  });
}

/**
 * Hook to login to RevenueCat with user ID
 */
export function usePurchasesLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => purchasesService.login(userId),
    onSuccess: () => {
      // Refresh all purchase data after login
      queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all });
    },
  });
}

/**
 * Hook to logout from RevenueCat
 */
export function usePurchasesLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => purchasesService.logout(),
    onSuccess: () => {
      // Clear all purchase data
      queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all });
    },
  });
}

/**
 * Hook to listen for real-time subscription changes
 * 
 * @example
 * ```tsx
 * useSubscriptionListener((isActive) => {
 *   if (isActive) {
 *     showToast('Subscription activated!');
 *   }
 * });
 * ```
 */
export function useSubscriptionListener(
  onSubscriptionChange?: (isActive: boolean, customerInfo: CustomerInfo) => void
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const removeListener = purchasesService.addCustomerInfoListener(
      (customerInfo: CustomerInfo) => {
        const isActive = Boolean(
          customerInfo.entitlements.active[ENTITLEMENTS.SURVEY_CREATOR]?.isActive
        );

        // Update cache with new customer info
        queryClient.setQueryData(
          purchasesQueryKeys.customerInfo(),
          customerInfo
        );

        // Invalidate subscription status to refetch
        queryClient.invalidateQueries({
          queryKey: purchasesQueryKeys.subscription()
        });

        // Cross-source invalidation: also refresh MoMo unified cache
        queryClient.invalidateQueries({
          queryKey: ['subscription-payment', 'unified']
        });

        // Notify callback
        onSubscriptionChange?.(isActive, customerInfo);
      }
    );

    return typeof removeListener === 'function' ? removeListener : () => {};
  }, [queryClient, onSubscriptionChange]);
}

/**
 * Hook to format package price for display
 * 
 * @example
 * ```tsx
 * const { formatPrice, formatPeriod } = usePackageFormatter();
 * 
 * <Text>{formatPrice(pkg)} / {formatPeriod(pkg)}</Text>
 * // Output: "UGX 2,000 / week"
 * ```
 */
export function usePackageFormatter() {
  const formatPrice = useCallback((pkg: PurchasesPackage): string => {
    return pkg.product.priceString;
  }, []);

  const formatPeriod = useCallback((pkg: PurchasesPackage): string => {
    // RevenueCat PACKAGE_TYPE values:
    // UNKNOWN, CUSTOM, LIFETIME, ANNUAL, SIX_MONTH, THREE_MONTH, TWO_MONTH, MONTHLY, WEEKLY
    const packageType = pkg.packageType;
    
    switch (packageType) {
      case 'WEEKLY':
        return 'week';
      case 'MONTHLY':
        return 'month';
      case 'TWO_MONTH':
        return '2 months';
      case 'THREE_MONTH':
        return '3 months';
      case 'SIX_MONTH':
        return '6 months';
      case 'ANNUAL':
        return 'year';
      case 'LIFETIME':
        return 'lifetime';
      case 'CUSTOM':
        // For custom packages, try to infer from product identifier
        const productId = pkg.product.identifier.toLowerCase();
        if (productId.includes('daily')) return 'day';
        if (productId.includes('quarterly')) return '3 months';
        if (productId.includes('half_yearly') || productId.includes('half-yearly')) return '6 months';
        if (productId.includes('yearly')) return 'year';
        return '';
      default:
        return '';
    }
  }, []);

  const formatDescription = useCallback((pkg: PurchasesPackage): string => {
    const price = formatPrice(pkg);
    const period = formatPeriod(pkg);
    
    if (pkg.packageType === 'LIFETIME') {
      return `${price} - One time purchase`;
    }
    
    return period ? `${price} / ${period}` : price;
  }, [formatPrice, formatPeriod]);

  return {
    formatPrice,
    formatPeriod,
    formatDescription,
  };
}
