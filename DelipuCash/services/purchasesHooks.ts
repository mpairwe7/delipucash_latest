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
import { useEffect, useCallback } from 'react';
import { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { purchasesService, ENTITLEMENTS } from './purchasesService';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const purchasesQueryKeys = {
  all: ['purchases'] as const,
  offerings: () => [...purchasesQueryKeys.all, 'offerings'] as const,
  subscription: () => [...purchasesQueryKeys.all, 'subscription'] as const,
  customerInfo: () => [...purchasesQueryKeys.all, 'customerInfo'] as const,
};

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
  const { data: subscription, isLoading, refetch } = useSubscriptionStatus();
  
  return {
    canCreateSurvey: subscription?.isActive ?? false,
    isLoading,
    subscription,
    refetch,
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
  const { data: subscription, isLoading, refetch } = useSubscriptionStatus();

  // Check if user has video_premium entitlement from RevenueCat
  // Also consider general premium/active subscription for video features
  const hasVideoPremium = (
    subscription?.entitlements?.includes(ENTITLEMENTS.VIDEO_PREMIUM) ||
    subscription?.entitlements?.includes(ENTITLEMENTS.PREMIUM) ||
    subscription?.isActive
  ) ?? false;

  // Constants for limits (synced with backend/VideoStore)
  const FREE_UPLOAD_LIMIT = 40 * 1024 * 1024; // 40MB
  const PREMIUM_UPLOAD_LIMIT = 500 * 1024 * 1024; // 500MB
  const FREE_DURATION_LIMIT = 300; // 5 minutes
  const PREMIUM_LIVESTREAM_LIMIT = 7200; // 2 hours
  const PREMIUM_RECORDING_LIMIT = 1800; // 30 minutes

  return {
    hasVideoPremium,
    isLoading,
    subscription,
    refetch,
    // Return limits based on premium status
    maxUploadSize: hasVideoPremium ? PREMIUM_UPLOAD_LIMIT : FREE_UPLOAD_LIMIT,
    maxLivestreamDuration: hasVideoPremium ? PREMIUM_LIVESTREAM_LIMIT : FREE_DURATION_LIMIT,
    maxRecordingDuration: hasVideoPremium ? PREMIUM_RECORDING_LIMIT : FREE_DURATION_LIMIT,
    // Formatted versions for display
    maxUploadSizeFormatted: hasVideoPremium ? '500 MB' : '40 MB',
    maxLivestreamDurationFormatted: hasVideoPremium ? '2 hours' : '5 minutes',
    maxRecordingDurationFormatted: hasVideoPremium ? '30 minutes' : '5 minutes',
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
      if (result.success) {
        // Invalidate queries to refresh subscription status
        queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.subscription() });
        queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.customerInfo() });
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

        // Notify callback
        onSubscriptionChange?.(isActive, customerInfo);
      }
    );

    return removeListener;
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
