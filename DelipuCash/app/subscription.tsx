/**
 * Subscription Screen
 * 
 * A Google Play Billing compliant subscription screen using RevenueCat.
 * This replaces direct mobile money payments with proper in-app purchases.
 * 
 * In Uganda, users can pay with MTN/Airtel Mobile Money through Google Play's
 * carrier billing integration - no need to handle it directly.
 * 
 * @module app/subscription
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PurchasesPackage } from 'react-native-purchases';
import {
  CheckCircle,
  Shield,
  Zap,
  AlertTriangle,
  Crown,
  Video,
  Upload,
  Wifi,
  ExternalLink,
  Clock,
} from 'lucide-react-native';

// Components
import { PrimaryButton } from '@/components/PrimaryButton';
import { SubscriptionPackageCard, PaymentMethodSheet } from '@/components/payment';

// Services & Hooks
import {
  useOfferings,
  useSubscriptionStatus,
  usePurchase,
  useRestorePurchases,
  useSubscriptionListener,
  useBillingIssueDetection,
} from '@/services/purchasesHooks';
import { purchasesService } from '@/services/purchasesService';

// Theme & Utils
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';

// ============================================================================
// FEATURE LIST COMPONENT
// ============================================================================

interface FeatureItemProps {
  text: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ text }) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    icon: {
      marginRight: SPACING.sm,
    },
    text: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.text,
      flex: 1,
    },
  });

  return (
    <View style={styles.container}>
      <CheckCircle size={20} color={colors.success} style={styles.icon} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

// ============================================================================
// ACTIVE SUBSCRIPTION CARD
// ============================================================================

interface ActiveSubscriptionCardProps {
  expirationDate: Date | null;
  willRenew: boolean;
}

const ActiveSubscriptionCard: React.FC<ActiveSubscriptionCardProps> = ({
  expirationDate,
  willRenew,
}) => {
  const { colors } = useTheme();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const styles = StyleSheet.create({
    card: {
      backgroundColor: withAlpha(colors.success, 0.1),
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: BORDER_WIDTH.thin,
      borderColor: withAlpha(colors.success, 0.3),
      marginBottom: SPACING.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.base,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.full,
      backgroundColor: withAlpha(colors.success, 0.2),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.base,
    },
    title: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
      color: colors.success,
    },
    subtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
    },
    details: {
      backgroundColor: colors.elevated,
      borderRadius: RADIUS.base,
      padding: SPACING.base,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: SPACING.xs,
    },
    detailLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textMuted,
    },
    detailValue: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.text,
    },
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Crown size={24} color={colors.success} />
        </View>
        <View>
          <Text style={styles.title}>Active Subscription</Text>
          <Text style={styles.subtitle}>You have full access to all features</Text>
        </View>
      </View>

      <View style={styles.details}>
        {expirationDate && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {willRenew ? 'Renews on' : 'Expires on'}
            </Text>
            <Text style={styles.detailValue}>{formatDate(expirationDate)}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Auto-renew</Text>
          <Text style={styles.detailValue}>{willRenew ? 'Enabled' : 'Disabled'}</Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SubscriptionScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();

  // RevenueCat Hooks
  const {
    data: offerings,
    isLoading: isLoadingOfferings,
    error: offeringsError,
    refetch: refetchOfferings,
  } = useOfferings();

  const {
    data: subscription,
    isLoading: isLoadingSubscription,
    refetch: refetchSubscription,
  } = useSubscriptionStatus();

  const {
    mutateAsync: purchase,
    isPending: isPurchasing,
  } = usePurchase();

  const {
    mutateAsync: restorePurchases,
    isPending: isRestoring,
  } = useRestorePurchases();

  // Billing issue detection (grace period / account hold)
  const { billingIssue } = useBillingIssueDetection();

  // Local state
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasPendingPurchase, setHasPendingPurchase] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);

  // Show Google Play in-app messages on screen mount (grace period prompts, etc.)
  useEffect(() => {
    purchasesService.showInAppMessages();
  }, []);

  // Listen for subscription changes
  useSubscriptionListener((isActive) => {
    if (isActive) {
      setHasPendingPurchase(false);
      Alert.alert(
        'Subscription Activated!',
        'Thank you for subscribing! You now have access to all features.',
        [{ text: 'Continue', onPress: () => router.back() }]
      );
    }
  });

  // Get available packages from current offering
  const packages = useMemo(() => {
    return offerings?.current?.availablePackages ?? [];
  }, [offerings]);

  // Check if SDK is not initialized (no API key)
  const isNotConfigured = !purchasesService.isReady() && !isLoadingOfferings;

  // Select first package by default
  useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      // Try to select monthly as default, otherwise first
      const monthly = packages.find(p => p.packageType === 'MONTHLY');
      setSelectedPackage(monthly ?? packages[0]);
    }
  }, [packages, selectedPackage]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchOfferings(),
      refetchSubscription(),
    ]);
    setIsRefreshing(false);
  }, [refetchOfferings, refetchSubscription]);

  // Purchase handler
  const handlePurchase = useCallback(async () => {
    if (!selectedPackage) {
      Alert.alert('Select a Plan', 'Please select a subscription plan to continue.');
      return;
    }

    try {
      const result = await purchase(selectedPackage);

      if (result.success) {
        // Success is handled by subscription listener
      } else if (result.userCancelled) {
        // User cancelled, no action needed
      } else if (result.errorCode === 'PAYMENT_PENDING_ERROR') {
        // Payment pending — carrier billing (MTN/Airtel) confirmation in progress
        setHasPendingPurchase(true);
      } else {
        Alert.alert(
          'Purchase Failed',
          result.error || 'Something went wrong. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
        [{ text: 'OK' }]
      );
    }
  }, [selectedPackage, purchase]);

  // Restore handler — differentiate found vs. not found
  const handleRestore = useCallback(async () => {
    try {
      await restorePurchases();
      const updated = await refetchSubscription();
      const isActive = updated.data?.isActive ?? false;

      Alert.alert(
        isActive ? 'Purchases Restored' : 'No Purchases Found',
        isActive
          ? 'Your subscription has been restored. You have full access.'
          : 'We could not find any previous purchases linked to your account.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Restore Failed',
        error instanceof Error ? error.message : 'Failed to restore purchases.',
        [{ text: 'OK' }]
      );
    }
  }, [restorePurchases, refetchSubscription]);

  // Open Google Play subscription management
  const handleManageSubscription = useCallback(() => {
    if (Platform.OS === 'android') {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    } else {
      // iOS — opens App Store subscription settings
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    }
  }, []);

  // Get badge for package (RevenueCat uses PACKAGE_TYPE enum)
  const getPackageBadge = (pkg: PurchasesPackage): 'popular' | 'best-value' | 'recommended' | undefined => {
    const pkgType = pkg.packageType;
    // MONTHLY is most popular
    if (pkgType === 'MONTHLY') return 'popular';
    // SIX_MONTH (half yearly) is best value
    if (pkgType === 'SIX_MONTH') return 'best-value';
    // ANNUAL (yearly) is recommended for long-term
    if (pkgType === 'ANNUAL') return 'recommended';
    return undefined;
  };

  // Loading state
  const isLoading = isLoadingOfferings || isLoadingSubscription;

  // Styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: SPACING.lg,
      paddingBottom: insets.bottom + SPACING.xl,
    },
    header: {
      alignItems: 'center',
      marginBottom: SPACING.xl,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: RADIUS.full,
      backgroundColor: withAlpha(colors.primary, 0.1),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
    },
    title: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize['2xl'],
      color: colors.text,
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    subtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: SPACING.xl,
    },
    section: {
      marginBottom: SPACING.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.base,
    },
    sectionTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
      color: colors.text,
    },
    featuresCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      ...SHADOWS.sm,
    },
    videoPremiumHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.xs,
      gap: SPACING.sm,
    },
    videoPremiumTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.base,
    },
    videoPremiumDescription: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      marginBottom: SPACING.base,
    },
    videoPremiumFeatures: {
      gap: SPACING.sm,
    },
    videoPremiumFeatureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    videoPremiumFeatureText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      flex: 1,
    },
    footer: {
      marginTop: SPACING.lg,
    },
    restoreButton: {
      marginTop: SPACING.base,
    },
    secureNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.lg,
    },
    secureText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textMuted,
      marginLeft: SPACING.xs,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xl,
    },
    loadingText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.textSecondary,
      marginTop: SPACING.base,
    },
    errorContainer: {
      alignItems: 'center',
      padding: SPACING.xl,
      backgroundColor: withAlpha(colors.warning, 0.1),
      borderRadius: RADIUS.lg,
      marginBottom: SPACING.xl,
    },
    errorTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
      color: colors.warning,
      marginTop: SPACING.base,
      marginBottom: SPACING.sm,
    },
    errorText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    emptyPackages: {
      alignItems: 'center',
      padding: SPACING.xl,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
    },
    emptyText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  // Loading screen
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style={statusBarStyle} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading subscription options...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style={statusBarStyle} />
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Zap size={40} color={colors.primary} />
          </View>
          <Text style={styles.title}>Unlock Survey Creation</Text>
          <Text style={styles.subtitle}>
            Create unlimited surveys, get detailed analytics, and reach more respondents
          </Text>
        </View>

        {/* Active Subscription Status */}
        {subscription?.isActive && (
          <ActiveSubscriptionCard
            expirationDate={subscription.expirationDate}
            willRenew={subscription.willRenew}
          />
        )}

        {/* Billing Issue Banner (Grace Period / Account Hold) */}
        {billingIssue && (
          <Pressable
            onPress={handleManageSubscription}
            style={{
              backgroundColor: withAlpha(
                billingIssue.type === 'grace_period' ? colors.warning : colors.error,
                0.1
              ),
              borderRadius: RADIUS.lg,
              padding: SPACING.lg,
              borderWidth: BORDER_WIDTH.thin,
              borderColor: withAlpha(
                billingIssue.type === 'grace_period' ? colors.warning : colors.error,
                0.3
              ),
              marginBottom: SPACING.xl,
              flexDirection: 'row',
              alignItems: 'center',
              gap: SPACING.base,
            }}
            accessibilityRole="button"
            accessibilityLabel={`${billingIssue.message} Tap to manage subscription.`}
          >
            <AlertTriangle
              size={24}
              color={billingIssue.type === 'grace_period' ? colors.warning : colors.error}
            />
            <View style={{ flex: 1 }}>
              <Text style={{
                fontFamily: TYPOGRAPHY.fontFamily.bold,
                fontSize: TYPOGRAPHY.fontSize.sm,
                color: billingIssue.type === 'grace_period' ? colors.warning : colors.error,
                marginBottom: 2,
              }}>
                {billingIssue.type === 'grace_period' ? 'Payment Issue' : 'Subscription On Hold'}
              </Text>
              <Text style={{
                fontFamily: TYPOGRAPHY.fontFamily.regular,
                fontSize: TYPOGRAPHY.fontSize.sm,
                color: colors.textSecondary,
              }}>
                {billingIssue.message}
              </Text>
            </View>
            <ExternalLink size={16} color={colors.textMuted} />
          </Pressable>
        )}

        {/* Pending Purchase Banner */}
        {hasPendingPurchase && (
          <View style={{
            backgroundColor: withAlpha(colors.primary, 0.1),
            borderRadius: RADIUS.lg,
            padding: SPACING.lg,
            borderWidth: BORDER_WIDTH.thin,
            borderColor: withAlpha(colors.primary, 0.3),
            marginBottom: SPACING.xl,
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACING.base,
          }}>
            <Clock size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{
                fontFamily: TYPOGRAPHY.fontFamily.bold,
                fontSize: TYPOGRAPHY.fontSize.sm,
                color: colors.primary,
                marginBottom: 2,
              }}>
                Payment Pending
              </Text>
              <Text style={{
                fontFamily: TYPOGRAPHY.fontFamily.regular,
                fontSize: TYPOGRAPHY.fontSize.sm,
                color: colors.textSecondary,
              }}>
                Please complete the payment confirmation on your phone. Your subscription will activate automatically once confirmed.
              </Text>
            </View>
          </View>
        )}

        {/* Not Configured Warning */}
        {isNotConfigured && (
          <View style={styles.errorContainer}>
            <AlertTriangle size={32} color={colors.warning} />
            <Text style={styles.errorTitle}>Setup Required</Text>
            <Text style={styles.errorText}>
              RevenueCat API key not configured. Please add your API key to enable purchases.
            </Text>
          </View>
        )}

        {/* Error State */}
        {offeringsError && !isNotConfigured && (
          <View style={styles.errorContainer}>
            <AlertTriangle size={32} color={colors.warning} />
            <Text style={styles.errorTitle}>Unable to Load Plans</Text>
            <Text style={styles.errorText}>
              {offeringsError instanceof Error 
                ? offeringsError.message 
                : 'Failed to load subscription plans. Pull down to refresh.'}
            </Text>
          </View>
        )}

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{"What's Included"}</Text>
          <View style={styles.featuresCard}>
            <FeatureItem text="Create unlimited surveys" />
            <FeatureItem text="Advanced question types" />
            <FeatureItem text="Detailed response analytics" />
            <FeatureItem text="Export data to CSV/Excel" />
            <FeatureItem text="Priority support" />
            <FeatureItem text="No watermarks on surveys" />
          </View>
        </View>

        {/* Video Premium Features */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Video size={20} color={colors.warning} style={{ marginRight: SPACING.sm }} />
            <Text style={styles.sectionTitle}>Video Premium</Text>
          </View>
          <View style={[styles.featuresCard, { borderWidth: 1, borderColor: withAlpha(colors.warning, 0.3) }]}>
            <View style={styles.videoPremiumHeader}>
              <Crown size={24} color={colors.warning} />
              <Text style={[styles.videoPremiumTitle, { color: colors.warning }]}>
                Extended Video Features
              </Text>
            </View>
            <Text style={[styles.videoPremiumDescription, { color: colors.textSecondary }]}>
              Upgrade for more video capabilities
            </Text>
            <View style={styles.videoPremiumFeatures}>
              <View style={styles.videoPremiumFeatureRow}>
                <Upload size={16} color={colors.success} />
                <Text style={[styles.videoPremiumFeatureText, { color: colors.text }]}>
                  Upload videos up to 500MB (vs 40MB free)
                </Text>
              </View>
              <View style={styles.videoPremiumFeatureRow}>
                <Wifi size={16} color={colors.success} />
                <Text style={[styles.videoPremiumFeatureText, { color: colors.text }]}>
                  Livestream up to 2 hours (vs 5 min free)
                </Text>
              </View>
              <View style={styles.videoPremiumFeatureRow}>
                <Video size={16} color={colors.success} />
                <Text style={[styles.videoPremiumFeatureText, { color: colors.text }]}>
                  Record videos up to 30 minutes
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Subscription Plans */}
        {!subscription?.isActive && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Your Plan</Text>
            
            {packages.length === 0 ? (
              <View style={styles.emptyPackages}>
                <Text style={styles.emptyText}>
                  No subscription plans available at the moment.
                </Text>
              </View>
            ) : (
              packages.map((pkg) => (
                <SubscriptionPackageCard
                  key={pkg.identifier}
                  package={pkg}
                  isSelected={selectedPackage?.identifier === pkg.identifier}
                  onSelect={() => setSelectedPackage(pkg)}
                  badge={getPackageBadge(pkg)}
                  disabled={isPurchasing || isNotConfigured}
                />
              ))
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.footer}>
          {!subscription?.isActive && packages.length > 0 && (
            <PrimaryButton
              title={isPurchasing ? 'Processing...' : 'Unlock All Features'}
              onPress={() => setShowPaymentSheet(true)}
              disabled={isPurchasing || !selectedPackage || isNotConfigured}
              loading={isPurchasing}
              variant="primary"
              size="large"
            />
          )}

          {/* Manage Subscription — for active subscribers */}
          {subscription?.isActive && (
            <PrimaryButton
              title="Manage Subscription"
              onPress={handleManageSubscription}
              variant="outline"
              size="large"
            />
          )}

          <PrimaryButton
            title={isRestoring ? 'Restoring...' : 'Restore Purchases'}
            onPress={handleRestore}
            disabled={isRestoring || isNotConfigured}
            loading={isRestoring}
            variant="outline"
            size="large"
            style={styles.restoreButton}
          />

          {/* Secure Payment Note */}
          <View style={styles.secureNote}>
            <Shield size={16} color={colors.textMuted} />
            <Text style={styles.secureText}>
              Secure payment via {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Payment Method Selector Bottom Sheet */}
      <PaymentMethodSheet
        visible={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        selectedPackage={selectedPackage}
        selectedPlanType={selectedPackage?.packageType ?? 'MONTHLY'}
        planPrice={selectedPackage ? parseFloat(selectedPackage.product.price.toString()) : 0}
        planCurrency={selectedPackage?.product.currencyCode ?? 'UGX'}
        onGooglePlayPurchase={handlePurchase}
        onMoMoPurchaseComplete={() => {
          setShowPaymentSheet(false);
          refetchSubscription();
          Alert.alert(
            'Subscription Activated!',
            'Your subscription is now active. Enjoy full access to all premium features.',
            [{ text: 'OK' }],
          );
        }}
      />
    </SafeAreaView>
  );
};

export default SubscriptionScreen;
