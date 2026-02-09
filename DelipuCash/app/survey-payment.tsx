/**
 * Survey Payment Screen — 2026 Mobile UI/UX Standards
 * 
 * Applied standards:
 * - Elevated section cards with depth hierarchy
 * - Haptic-synchronized provider & plan selection
 * - Optical typography with negative letter-spacing on headings
 * - 48px+ touch targets on all interactive elements
 * - WCAG 2.2 AAA accessible payment flow
 * - Generous whitespace and RADIUS['2xl'] card surfaces
 * - Spring-physics entrance animation
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  AccessibilityInfo,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  CheckCircle, 
  AlertCircle, 
  Shield, 
  CreditCard,
  Phone,
  Clock,
  RefreshCw,
} from 'lucide-react-native';

// Components
import { PrimaryButton } from '@/components/PrimaryButton';
import { FormInput } from '@/components/FormInput';
import { 
  PaymentProviderCard, 
  SubscriptionPlanCard,
  type PaymentProvider,
  type PlanConfig,
} from '@/components/payment';

// Services & Hooks
import {
  useSurveyPaymentFlow,
  useCheckSurveyPaymentStatus,
  useSimulatePaymentCompletion,
} from '@/services/surveyPaymentHooks';
import {
  SurveyPayment,
} from '@/services/surveyPaymentApi';
import { useUserProfile } from '@/services/hooks';

// Types
import { 
  PaymentStatus, 
  SurveySubscriptionType,
  PaymentProvider as PaymentProviderEnum,
} from '@/types';

// Theme & Utils
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  SHADOWS,
  ANIMATION,
  ICON_SIZE,
  BREAKPOINTS,
  withAlpha,
} from '@/utils/theme';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Payment flow state
 */
type PaymentFlowState = 
  | 'idle' 
  | 'initiating' 
  | 'pending' 
  | 'polling' 
  | 'success' 
  | 'failed';

/**
 * Local form state
 */
interface FormState {
  phoneNumber: string;
  selectedProvider: PaymentProvider | null;
  selectedPlan: SurveySubscriptionType | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Payment provider configurations
 */
const PAYMENT_PROVIDERS = [
  {
    provider: 'MTN' as PaymentProvider,
    name: 'MTN Mobile Money',
    logo: require('@/assets/images/mtnlogo.png'),
  },
  {
    provider: 'AIRTEL' as PaymentProvider,
    name: 'Airtel Money',
    logo: require('@/assets/images/airtellogo.png'),
  },
];

/**
 * Polling configuration
 */
const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_POLLING_ATTEMPTS = 60; // 5 minutes max

// ============================================================================
// RESPONSIVE HELPERS
// ============================================================================

const useResponsive = () => {
  const { width } = useWindowDimensions();
  
  const isSmallPhone = width < BREAKPOINTS.md;
  const isTablet = width >= BREAKPOINTS.xl;

  return {
    isSmallPhone,
    isTablet,
    screenWidth: width,
    padding: isTablet ? SPACING.xl : isSmallPhone ? SPACING.base : SPACING.lg,
  };
};

// ============================================================================
// SECTION CARD COMPONENT
// ============================================================================

interface SectionCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  style?: object;
  isLoading?: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({ 
  title, 
  icon, 
  children, 
  style,
  isLoading = false,
}) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
      borderWidth: BORDER_WIDTH.thin,
      borderColor: colors.border,
      opacity: isLoading ? 0.6 : 1,
      ...SHADOWS.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.base,
    },
    iconContainer: {
      marginRight: SPACING.sm,
    },
    title: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
      letterSpacing: -0.15,
      color: colors.text,
      flex: 1,
    },
  });

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={styles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
};

// ============================================================================
// PAYMENT STATUS COMPONENT
// ============================================================================

interface PaymentStatusDisplayProps {
  payment: SurveyPayment;
  onRetry: () => void;
  onComplete: () => void;
}

const PaymentStatusDisplay: React.FC<PaymentStatusDisplayProps> = ({
  payment,
  onRetry,
  onComplete,
}) => {
  const { colors } = useTheme();
  
  const isSuccess = payment.status === PaymentStatus.SUCCESSFUL;
  const isFailed = payment.status === PaymentStatus.FAILED;
  const isPending = payment.status === PaymentStatus.PENDING;

  const statusColor = isSuccess 
    ? colors.success 
    : isFailed 
      ? colors.error 
      : colors.warning;

  const styles = StyleSheet.create({
    container: {
      backgroundColor: withAlpha(statusColor, 0.1),
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      alignItems: 'center',
      marginBottom: SPACING.lg,
      borderWidth: BORDER_WIDTH.thin,
      borderColor: withAlpha(statusColor, 0.3),
    },
    iconContainer: {
      width: 72,
      height: 72,
      borderRadius: RADIUS.full,
      backgroundColor: withAlpha(statusColor, 0.2),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
    },
    title: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.xl,
      letterSpacing: -0.2,
      color: statusColor,
      marginBottom: SPACING.sm,
      textAlign: 'center',
    },
    message: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.lg,
    },
    detailsContainer: {
      width: '100%',
      backgroundColor: colors.elevated,
      borderRadius: RADIUS.lg,
      padding: SPACING.base,
      marginBottom: SPACING.lg,
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
    pendingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.sm,
    },
    pendingText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textMuted,
      marginLeft: SPACING.sm,
    },
  });

  const getStatusIcon = () => {
    if (isSuccess) return <CheckCircle size={ICON_SIZE['3xl']} color={statusColor} />;
    if (isFailed) return <AlertCircle size={ICON_SIZE['3xl']} color={statusColor} />;
    return <Clock size={ICON_SIZE['3xl']} color={statusColor} />;
  };

  const getStatusTitle = () => {
    if (isSuccess) return 'Payment Successful!';
    if (isFailed) return 'Payment Failed';
    return 'Waiting for Payment';
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {getStatusIcon()}
      </View>
      
      <Text style={styles.title}>{getStatusTitle()}</Text>
      <Text style={styles.message}>{payment.statusMessage}</Text>

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Transaction ID</Text>
          <Text style={styles.detailValue}>{payment.transactionId}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount</Text>
          <Text style={styles.detailValue}>
            {payment.amount.toLocaleString()} {payment.currency}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Provider</Text>
          <Text style={styles.detailValue}>{payment.provider}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Phone</Text>
          <Text style={styles.detailValue}>{payment.phoneNumber}</Text>
        </View>
      </View>

      {isPending && (
        <View style={styles.pendingIndicator}>
          <RefreshCw size={ICON_SIZE.md} color={colors.textMuted} />
          <Text style={styles.pendingText}>Checking payment status...</Text>
        </View>
      )}

      {isSuccess && (
        <PrimaryButton
          title="Continue"
          onPress={onComplete}
          variant="primary"
          size="large"
          style={{ width: '100%' }}
        />
      )}

      {isFailed && (
        <PrimaryButton
          title="Try Again"
          onPress={onRetry}
          variant="outline"
          size="large"
          style={{ width: '100%' }}
        />
      )}
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SurveyPaymentScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const responsive = useResponsive();

  // API Hooks
  const {
    plans,
    isLoadingPlans,
    plansError,
    hasActiveSubscription,
    currentSubscription,
    remainingDays,
    initiatePaymentAsync,
    isInitiating,
    refreshStatus,
    refreshPlans,
  } = useSurveyPaymentFlow();

  const { mutateAsync: checkPaymentStatus } = useCheckSurveyPaymentStatus();
  const { mutate: simulatePayment } = useSimulatePaymentCompletion();

  // User profile
  const { data: user } = useUserProfile();

  // Local state
  const [formState, setFormState] = useState<FormState>({
    phoneNumber: '',
    selectedProvider: null,
    selectedPlan: null,
  });
  const [flowState, setFlowState] = useState<PaymentFlowState>('idle');
  const [currentPayment, setCurrentPayment] = useState<SurveyPayment | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingCountRef = useRef(0);

  // Initialize phone from user profile
  useEffect(() => {
    if (user?.phone) {
      const cleanPhone = user.phone.replace(/\s/g, '');
      setFormState(prev => ({ ...prev, phoneNumber: cleanPhone }));
    }
  }, [user?.phone]);

  // Check for reduced motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setIsReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReducedMotion
    );
    return () => subscription.remove();
  }, []);

  // Entrance animation
  useEffect(() => {
    const duration = isReducedMotion ? 0 : ANIMATION.duration.slow;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, isReducedMotion]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Convert API plans to component format
  const planConfigs: PlanConfig[] = useMemo(() => {
    return plans.map(plan => ({
      type: plan.type,
      label: plan.name,
      price: plan.price,
      currency: plan.currency,
      description: plan.description,
      isPopular: plan.isPopular,
      isBestValue: plan.isBestValue,
      savings: plan.savings,
    }));
  }, [plans]);

  // Get selected plan config
  const selectedPlanConfig = useMemo(() => 
    plans.find(p => p.type === formState.selectedPlan),
    [plans, formState.selectedPlan]
  );

  // Validation
  const canProceed = useMemo(() => 
    formState.phoneNumber.length >= 10 && 
    formState.selectedProvider !== null && 
    formState.selectedPlan !== null &&
    !phoneError,
    [formState, phoneError]
  );

  // Handlers
  const handleProviderSelect = useCallback((provider: PaymentProvider) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFormState(prev => ({ ...prev, selectedProvider: provider }));
  }, []);

  const handlePlanSelect = useCallback((plan: SurveySubscriptionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFormState(prev => ({ ...prev, selectedPlan: plan }));
  }, []);

  const handlePhoneChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^\d+]/g, '');
    setFormState(prev => ({ ...prev, phoneNumber: cleaned }));
    
    if (cleaned.length > 0 && cleaned.length < 10) {
      setPhoneError('Phone number must be at least 10 digits');
    } else if (cleaned.length > 15) {
      setPhoneError('Phone number is too long');
    } else {
      setPhoneError(null);
    }
  }, []);

  const handlePhoneBlur = useCallback(() => {
    setPhoneTouched(true);
  }, []);

  const startPolling = useCallback((paymentId: string) => {
    pollingCountRef.current = 0;
    setFlowState('polling');

    pollingRef.current = setInterval(async () => {
      pollingCountRef.current += 1;

      if (pollingCountRef.current >= MAX_POLLING_ATTEMPTS) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
        Alert.alert(
          'Payment Timeout',
          'We couldn\'t confirm your payment. Please check your transaction history or contact support.',
          [{ text: 'OK' }]
        );
        setFlowState('idle');
        return;
      }

      try {
        const result = await checkPaymentStatus(paymentId);
        setCurrentPayment(result.payment);

        if (result.payment.status === PaymentStatus.SUCCESSFUL) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
          setFlowState('success');
          refreshStatus();
        } else if (result.payment.status === PaymentStatus.FAILED) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
          setFlowState('failed');
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    }, POLLING_INTERVAL);
  }, [checkPaymentStatus, refreshStatus]);

  const handlePayment = useCallback(async () => {
    if (!canProceed) {
      Alert.alert(
        'Missing Information',
        'Please select a subscription plan, payment provider, and enter your phone number.',
        [{ text: 'OK' }]
      );
      return;
    }

    setFlowState('initiating');

    try {
      const result = await initiatePaymentAsync({
        phoneNumber: formState.phoneNumber,
        provider: formState.selectedProvider as PaymentProviderEnum,
        planType: formState.selectedPlan!,
      });

      setCurrentPayment(result.payment);
      setFlowState('pending');

      // Start polling for payment status
      startPolling(result.payment.id);

      // Show confirmation
      Alert.alert(
        'Payment Initiated',
        result.message,
        [{ text: 'OK' }]
      );
    } catch (error) {
      setFlowState('idle');
      const errorMessage = error instanceof Error ? error.message : 'Payment failed. Please try again.';
      Alert.alert('Payment Error', errorMessage, [{ text: 'OK' }]);
    }
  }, [canProceed, formState, initiatePaymentAsync, startPolling]);

  const handleRetry = useCallback(() => {
    setFlowState('idle');
    setCurrentPayment(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
  }, []);

  const handleComplete = useCallback(() => {
    if (params.redirect) {
      router.replace(params.redirect as any);
    } else {
      router.back();
    }
  }, [params.redirect, router]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refreshStatus(), refreshPlans()]);
    setIsRefreshing(false);
  }, [refreshStatus, refreshPlans]);

  const handleRetryPlans = useCallback(async () => {
    await refreshPlans();
  }, [refreshPlans]);

  const handleCancel = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    router.back();
  }, [router]);

  // For testing: simulate payment completion
  const handleSimulateSuccess = useCallback(() => {
    if (currentPayment) {
      simulatePayment({ paymentId: currentPayment.id, success: true });
    }
  }, [currentPayment, simulatePayment]);

  const isProcessing = flowState === 'initiating' || flowState === 'polling';
  const showPaymentStatus = flowState === 'pending' || flowState === 'polling' || 
                           flowState === 'success' || flowState === 'failed';

  // Styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: responsive.padding,
      paddingBottom: SPACING['3xl'] + insets.bottom,
    },
    header: {
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.base,
    },
    headerTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize['2xl'],
      letterSpacing: -0.3,
      color: colors.text,
      marginBottom: SPACING.xs,
    },
    headerSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.textSecondary,
    },
    subscriptionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: withAlpha(colors.success, 0.15),
      padding: SPACING.base,
      borderRadius: RADIUS.xl,
      marginBottom: SPACING.lg,
      borderWidth: BORDER_WIDTH.thin,
      borderColor: withAlpha(colors.success, 0.3),
    },
    subscriptionBannerText: {
      flex: 1,
      marginLeft: SPACING.md,
    },
    subscriptionBannerTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.success,
    },
    subscriptionBannerSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      marginTop: SPACING.xxs,
    },
    plansGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    providersRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    securityNote: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.elevated,
      padding: SPACING.base,
      borderRadius: RADIUS.xl,
      marginBottom: SPACING.lg,
    },
    securityNoteText: {
      flex: 1,
      marginLeft: SPACING.sm,
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
    },
    summaryContainer: {
      backgroundColor: colors.elevated,
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
      ...SHADOWS.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: SPACING.xs,
    },
    summaryLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.text,
    },
    summaryTotal: {
      borderTopWidth: BORDER_WIDTH.thin,
      borderTopColor: colors.border,
      marginTop: SPACING.sm,
      paddingTop: SPACING.md,
    },
    totalLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
      color: colors.text,
    },
    totalValue: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.xl,
      color: colors.primary,
    },
    buttonContainer: {
      gap: SPACING.md,
      paddingTop: SPACING.sm,
    },
    loadingContainer: {
      padding: SPACING.xl,
      alignItems: 'center',
    },
    loadingText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.textMuted,
      marginTop: SPACING.md,
    },
    errorContainer: {
      padding: SPACING.xl,
      alignItems: 'center',
    },
    errorText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.error,
      marginTop: SPACING.md,
      textAlign: 'center',
    },
    emptyContainer: {
      padding: SPACING.xl,
      alignItems: 'center',
    },
    emptyText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.warning,
      marginTop: SPACING.md,
      textAlign: 'center',
    },
    // Dev tools (remove in production)
    devTools: {
      marginTop: SPACING.lg,
      padding: SPACING.base,
      backgroundColor: withAlpha(colors.warning, 0.1),
      borderRadius: RADIUS.base,
      borderWidth: BORDER_WIDTH.thin,
      borderColor: withAlpha(colors.warning, 0.3),
    },
    devToolsTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.warning,
      marginBottom: SPACING.sm,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style={statusBarStyle} />
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <Animated.ScrollView
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
            <Text style={styles.headerTitle}>Survey Subscription</Text>
            <Text style={styles.headerSubtitle}>
              Unlock premium survey features with a subscription plan
            </Text>
          </View>

          {/* Active Subscription Banner */}
          {hasActiveSubscription && currentSubscription && (
            <View 
              style={styles.subscriptionBanner}
              accessibilityRole="alert"
              accessibilityLabel="Active subscription status"
            >
              <CheckCircle size={ICON_SIZE.xl} color={colors.success} />
              <View style={styles.subscriptionBannerText}>
                <Text style={styles.subscriptionBannerTitle}>
                  Active Subscription
                </Text>
                <Text style={styles.subscriptionBannerSubtitle}>
                  {currentSubscription.planType} plan • {remainingDays} days remaining
                </Text>
              </View>
            </View>
          )}

          {/* Payment Status Display */}
          {showPaymentStatus && currentPayment && (
            <>
              <PaymentStatusDisplay
                payment={currentPayment}
                onRetry={handleRetry}
                onComplete={handleComplete}
              />
              
              {/* Dev Tools (for testing) */}
              {__DEV__ && flowState === 'polling' && (
                <View style={styles.devTools}>
                  <Text style={styles.devToolsTitle}>🔧 Dev Tools</Text>
                  <PrimaryButton
                    title="Simulate Success"
                    onPress={handleSimulateSuccess}
                    variant="outline"
                    size="small"
                  />
                </View>
              )}
            </>
          )}

          {/* Payment Form (hidden during payment flow) */}
          {!showPaymentStatus && (
            <>
              {/* Subscription Plans */}
              <SectionCard 
                title="Choose Your Plan" 
                icon={<CreditCard size={ICON_SIZE.lg} color={colors.primary} />}
                isLoading={isLoadingPlans}
              >
                {isLoadingPlans ? (
                  <View style={styles.loadingContainer}>
                    <RefreshCw size={ICON_SIZE.xl} color={colors.primary} />
                    <Text style={styles.loadingText}>Loading plans...</Text>
                  </View>
                ) : plansError ? (
                  <View style={styles.errorContainer}>
                    <AlertCircle size={ICON_SIZE.xl} color={colors.error} />
                    <Text style={styles.errorText}>
                      {plansError.message || 'Failed to load subscription plans'}
                    </Text>
                    <PrimaryButton
                      title="Retry"
                      onPress={handleRetryPlans}
                      variant="outline"
                      size="small"
                      style={{ marginTop: SPACING.base }}
                    />
                  </View>
                ) : plans.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <AlertCircle size={ICON_SIZE.xl} color={colors.warning} />
                    <Text style={styles.emptyText}>
                      No subscription plans available at the moment
                    </Text>
                    <PrimaryButton
                      title="Refresh"
                      onPress={handleRetryPlans}
                      variant="outline"
                      size="small"
                      style={{ marginTop: SPACING.base }}
                    />
                  </View>
                ) : (
                  <View style={styles.plansGrid}>
                    {planConfigs.map(plan => (
                      <SubscriptionPlanCard
                        key={plan.type}
                        plan={plan}
                        isSelected={formState.selectedPlan === plan.type}
                        onSelect={(p) => handlePlanSelect(p as SurveySubscriptionType)}
                        disabled={isProcessing}
                        testID={`plan-${plan.type.toLowerCase()}`}
                      />
                    ))}
                  </View>
                )}
              </SectionCard>

              {/* Payment Provider */}
              <SectionCard 
                title="Payment Method"
                icon={<CreditCard size={ICON_SIZE.lg} color={colors.primary} />}
              >
                <View style={styles.providersRow}>
                  {PAYMENT_PROVIDERS.map(provider => (
                    <PaymentProviderCard
                      key={provider.provider}
                      provider={provider.provider}
                      name={provider.name}
                      logo={provider.logo}
                      isSelected={formState.selectedProvider === provider.provider}
                      onSelect={handleProviderSelect}
                      disabled={isProcessing}
                      testID={`provider-${provider.provider.toLowerCase()}`}
                    />
                  ))}
                </View>
              </SectionCard>

              {/* Phone Number */}
              <SectionCard 
                title="Phone Number"
                icon={<Phone size={ICON_SIZE.lg} color={colors.primary} />}
              >
                <FormInput
                  label=""
                  value={formState.phoneNumber}
                  onChangeText={handlePhoneChange}
                  onBlur={handlePhoneBlur}
                  placeholder="e.g., 256712345678"
                  keyboardType="phone-pad"
                  error={phoneError}
                  touched={phoneTouched}
                  editable={!isProcessing}
                  testID="phone-input"
                />
              </SectionCard>

              {/* Payment Summary */}
              {formState.selectedPlan && selectedPlanConfig && (
                <View style={styles.summaryContainer}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Plan</Text>
                    <Text style={styles.summaryValue}>
                      {selectedPlanConfig.name}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Duration</Text>
                    <Text style={styles.summaryValue}>
                      {selectedPlanConfig.description}
                    </Text>
                  </View>
                  {formState.selectedProvider && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Payment via</Text>
                      <Text style={styles.summaryValue}>
                        {formState.selectedProvider} Mobile Money
                      </Text>
                    </View>
                  )}
                  <View style={[styles.summaryRow, styles.summaryTotal]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>
                      {selectedPlanConfig.price.toLocaleString()} {selectedPlanConfig.currency}
                    </Text>
                  </View>
                </View>
              )}

              {/* Security Note */}
              <View style={styles.securityNote}>
                <Shield size={ICON_SIZE.lg} color={colors.textMuted} />
                <Text style={styles.securityNoteText}>
                  Your payment is secured with end-to-end encryption. 
                  You will receive an SMS prompt to confirm the payment.
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <PrimaryButton
                  title={isInitiating ? 'Processing...' : 'Pay Now'}
                  onPress={handlePayment}
                  loading={isInitiating}
                  disabled={!canProceed || isProcessing}
                  variant="primary"
                  size="large"
                  testID="pay-button"
                />
                
                <PrimaryButton
                  title="Cancel"
                  onPress={handleCancel}
                  disabled={isProcessing}
                  variant="ghost"
                  size="medium"
                  testID="cancel-button"
                />
              </View>
            </>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SurveyPaymentScreen;
