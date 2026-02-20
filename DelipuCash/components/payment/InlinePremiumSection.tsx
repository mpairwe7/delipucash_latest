/**
 * Inline Premium Section Component
 *
 * A reusable expand/collapse premium purchase section that embeds directly
 * within tab screens (Surveys, Videos). Supports both Google Play and MoMo.
 *
 * Three states:
 * 1. Collapsed banner — shows active/inactive status, tap to expand
 * 2. Expanded — PaymentTabSwitcher + plan cards + purchase flow
 * 3. Processing — MoMo STK push polling (reuses MoMoProcessingStatus)
 *
 * @module components/payment/InlinePremiumSection
 */

import React, {
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  AccessibilityInfo,
  findNodeHandle,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
  FadeIn,
  FadeOut,
  Layout,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PurchasesPackage, PURCHASES_ERROR_CODE } from 'react-native-purchases';
import {
  Crown,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Shield,
  AlertTriangle,
  Smartphone,
} from 'lucide-react-native';

import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { PhoneInput } from '@/components/PhoneInput';
import { SubscriptionPackageCard } from './SubscriptionPackageCard';
import { MoMoPlanCard } from './MoMoPlanCard';
import { MoMoProcessingStatus } from './MoMoProcessingStatus';
import { PaymentTabSwitcher, type PaymentTab } from './PaymentTabSwitcher';
import { PaymentMethodCard, type PaymentMethodType } from './PaymentMethodCard';

import {
  useOfferings,
  usePurchase,
  useRestorePurchases,
  useSurveyPremium,
  useVideoPremium,
  useBillingIssueDetection,
} from '@/services/purchasesHooks';
import {
  useMoMoPlans,
  useMoMoPaymentFlow,
  type FeatureType,
} from '@/services/subscriptionPaymentHooks';
import {
  usePaymentFlowStore,
  selectLastUsedPhone,
  selectLastUsedProvider,
  selectSurveyPreferredTab,
  selectVideoPreferredTab,
} from '@/store/PaymentFlowStore';

// ============================================================================
// TYPES
// ============================================================================

export interface FeatureItem {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  text: string;
}

export interface InlinePremiumSectionProps {
  featureType: FeatureType;
  features: FeatureItem[];
  title: string;
  accentColor?: string;
  onPurchaseComplete?: () => void;
}

export interface InlinePremiumSectionRef {
  expand: () => void;
  collapse: () => void;
}

type MoMoStep = 'select_plan' | 'enter_phone' | 'confirm' | 'processing';

// ============================================================================
// CONSTANTS
// ============================================================================

const SPRING_CONFIG = { damping: 20, stiffness: 200 };

const PACKAGE_TO_PLAN: Record<string, string> = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  THREE_MONTH: 'QUARTERLY',
  SIX_MONTH: 'HALF_YEARLY',
  ANNUAL: 'YEARLY',
  LIFETIME: 'LIFETIME',
};

// ============================================================================
// COMPONENT
// ============================================================================

export const InlinePremiumSection = forwardRef<InlinePremiumSectionRef, InlinePremiumSectionProps>(({
  featureType,
  features,
  title,
  accentColor,
  onPurchaseComplete,
}, ref) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReducedMotion();
  const accent = accentColor ?? colors.primary;

  // ── Persisted tab preference ──
  const storedTab = usePaymentFlowStore(
    featureType === 'SURVEY' ? selectSurveyPreferredTab : selectVideoPreferredTab
  );
  const setFeaturePreferredTab = usePaymentFlowStore((s) => s.setFeaturePreferredTab);

  // ── State ──
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<PaymentTab>(storedTab ?? 'google_play');
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // MoMo state
  const [momoStep, setMoMoStep] = useState<MoMoStep>('select_plan');
  const [selectedMomoPlan, setSelectedMomoPlan] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'MTN' | 'AIRTEL' | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // ── Hooks ──
  const premium = featureType === 'SURVEY' ? useSurveyPremium() : useVideoPremium();
  const { data: offerings, isLoading: offeringsLoading } = useOfferings();
  const { mutate: purchase } = usePurchase();
  const { mutate: restore, isPending: isRestoring } = useRestorePurchases();
  const { data: momoPlans, isLoading: momoPlansLoading } = useMoMoPlans(featureType);
  const momoFlow = useMoMoPaymentFlow(featureType);
  const { billingIssue } = useBillingIssueDetection();

  const lastUsedPhone = usePaymentFlowStore(selectLastUsedPhone);
  const lastUsedProvider = usePaymentFlowStore(selectLastUsedProvider);
  const setLastUsedDetails = usePaymentFlowStore((s) => s.setLastUsedDetails);

  // Pre-fill phone from store
  useEffect(() => {
    if (lastUsedPhone && !phoneNumber) setPhoneNumber(lastUsedPhone);
    if (lastUsedProvider && !selectedProvider) setSelectedProvider(lastUsedProvider);
  }, [lastUsedPhone, lastUsedProvider]);

  // Refs for accessibility focus
  const expandedRef = useRef<View>(null);

  // ── Imperative handle ──
  useImperativeHandle(ref, () => ({
    expand: () => {
      setIsExpanded(true);
      setTimeout(() => {
        const node = findNodeHandle(expandedRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }, 300);
    },
    collapse: () => {
      setIsExpanded(false);
      resetMoMoState();
    },
  }), []);

  // ── Animations ──
  // FadeIn/FadeOut on the Animated.View handles opacity.
  // No manual opacity spring needed — avoids Reanimated layout animation conflict.

  // ── Derived state ──
  const featureOffering = useMemo(() => {
    if (!offerings) return null;
    const offeringKey = featureType === 'SURVEY' ? 'survey_premium' : 'video_premium';
    return offerings.all?.[offeringKey] ?? offerings.current;
  }, [offerings, featureType]);

  const packages = useMemo(() => {
    return featureOffering?.availablePackages ?? [];
  }, [featureOffering]);

  // ── Handlers ──
  const toggleExpand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded((prev) => {
      if (prev) resetMoMoState();
      return !prev;
    });
  }, []);

  const resetMoMoState = useCallback(() => {
    setMoMoStep('select_plan');
    setSelectedMomoPlan(null);
    setSelectedProvider(null);
    setPhoneError(null);
    momoFlow.reset();
  }, [momoFlow]);

  // Google Play purchase
  const handleGooglePlayPurchase = useCallback(() => {
    if (!selectedPackage || isPurchasing) return;
    setIsPurchasing(true);

    purchase(selectedPackage, {
      onSuccess: (result) => {
        setIsPurchasing(false);
        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          AccessibilityInfo.announceForAccessibility('Purchase successful!');
          setIsExpanded(false);
          onPurchaseComplete?.();
        } else if (result.userCancelled) {
          // Do nothing
        } else {
          const errorCode = (result as any).errorCode;
          if (errorCode === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
            Alert.alert('Payment Pending', 'Your payment is being processed. You\'ll get access once it completes.');
          } else {
            Alert.alert('Purchase Failed', result.error || 'Something went wrong. Please try again.');
          }
        }
      },
      onError: () => {
        setIsPurchasing(false);
        Alert.alert('Error', 'Something went wrong. Please try again.');
      },
    });
  }, [selectedPackage, isPurchasing, purchase, onPurchaseComplete]);

  // MoMo phone validation + initiate
  const handleMoMoConfirm = useCallback(() => {
    const cleanPhone = phoneNumber.replace(/[\s\-+()]/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      setPhoneError('Enter a valid phone number (10-13 digits)');
      return;
    }
    setPhoneError(null);
    setMoMoStep('confirm');
  }, [phoneNumber]);

  const handleMoMoInitiate = useCallback(() => {
    if (!selectedMomoPlan || !selectedProvider) return;
    const cleanPhone = phoneNumber.replace(/[\s\-+()]/g, '');

    // Save details for next time
    setLastUsedDetails(cleanPhone, selectedProvider);

    setMoMoStep('processing');
    momoFlow.initiate({
      phoneNumber: cleanPhone,
      provider: selectedProvider,
      planType: selectedMomoPlan,
    });
  }, [selectedMomoPlan, selectedProvider, phoneNumber, momoFlow, setLastUsedDetails]);

  // MoMo flow success
  useEffect(() => {
    if (momoFlow.status === 'SUCCESSFUL') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility('Payment successful!');
      setTimeout(() => {
        setIsExpanded(false);
        resetMoMoState();
        onPurchaseComplete?.();
      }, 1500);
    }
  }, [momoFlow.status]);

  const selectedPlanData = useMemo(() => {
    return momoPlans?.find((p) => p.type === selectedMomoPlan);
  }, [momoPlans, selectedMomoPlan]);

  // ── Render ──
  return (
    <View style={styles.wrapper}>
      {/* Collapsed Banner */}
      <Pressable
        onPress={toggleExpand}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={
          premium.isPremium
            ? `${title} active, ${premium.remainingDays} days remaining. Tap to view details.`
            : `${title} inactive. Tap to subscribe.`
        }
        style={[
          styles.banner,
          {
            backgroundColor: premium.isPremium
              ? withAlpha(colors.success, 0.08)
              : withAlpha(accent, 0.08),
            borderColor: premium.isPremium
              ? withAlpha(colors.success, 0.3)
              : withAlpha(accent, 0.3),
          },
        ]}
      >
        <View style={[styles.bannerIcon, { backgroundColor: withAlpha(accent, 0.15) }]}>
          {premium.isPremium ? (
            <CheckCircle size={20} color={colors.success} />
          ) : (
            <Crown size={20} color={accent} />
          )}
        </View>

        <View style={styles.bannerContent}>
          <Text style={[styles.bannerTitle, { color: premium.isPremium ? colors.success : accent }]}>
            {premium.isPremium ? `${title} Active` : title}
          </Text>
          <Text style={[styles.bannerSubtitle, { color: colors.textMuted }]}>
            {premium.isPremium
              ? `${premium.remainingDays} days remaining${premium.source === 'GOOGLE_PLAY' ? ' \u2022 Auto-renewing' : ''}`
              : 'Tap to unlock premium features'}
          </Text>
        </View>

        {!premium.isPremium && (
          <View style={[styles.subscribePill, { backgroundColor: accent }]}>
            <Text style={styles.subscribePillText}>Subscribe</Text>
          </View>
        )}

        {isExpanded ? (
          <ChevronUp size={18} color={colors.textMuted} />
        ) : (
          <ChevronDown size={18} color={colors.textMuted} />
        )}
      </Pressable>

      {/* Billing Issue Warning */}
      {billingIssue && (
        <View style={[styles.billingWarning, { backgroundColor: withAlpha(colors.warning, 0.1), borderColor: withAlpha(colors.warning, 0.3) }]}>
          <AlertTriangle size={16} color={colors.warning} />
          <Text style={[styles.billingWarningText, { color: colors.warning }]}>
            {billingIssue.message}
          </Text>
        </View>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <Animated.View
          ref={expandedRef}
          style={styles.expandedContainer}
          entering={reduceMotion ? undefined : FadeIn.duration(250)}
          exiting={reduceMotion ? undefined : FadeOut.duration(150)}
          accessibilityLabel={`${title} purchase options`}
        >
          {/* Feature list */}
          <View style={styles.featureList}>
            {features.map((feature, idx) => (
              <View key={idx} style={styles.featureRow}>
                <feature.icon size={16} color={accent} strokeWidth={2} />
                <Text style={[styles.featureText, { color: colors.text }]}>{feature.text}</Text>
              </View>
            ))}
          </View>

          {/* Payment Tab Switcher */}
          <PaymentTabSwitcher
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              setFeaturePreferredTab(featureType === 'SURVEY' ? 'SURVEY' : 'VIDEO', tab);
            }}
          />

          {/* Google Play Tab */}
          {activeTab === 'google_play' && (
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.duration(200)}
              style={styles.tabPanel}
            >
              {packages.length === 0 && !offeringsLoading ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No Google Play plans available yet. Try Mobile Money instead.
                </Text>
              ) : (
                <View accessibilityRole="radiogroup" accessibilityLabel="Google Play subscription plans">
                  {packages.map((pkg) => (
                    <SubscriptionPackageCard
                      key={pkg.identifier}
                      package={pkg}
                      isSelected={selectedPackage?.identifier === pkg.identifier}
                      onSelect={() => setSelectedPackage(pkg)}
                      badge={
                        pkg.packageType === 'MONTHLY' ? 'popular' :
                        pkg.packageType === 'ANNUAL' ? 'best-value' :
                        pkg.packageType === 'SIX_MONTH' ? 'recommended' :
                        undefined
                      }
                    />
                  ))}
                </View>
              )}

              {packages.length > 0 && (
                <PrimaryButton
                  title={isPurchasing ? 'Processing...' : 'Subscribe via Google Play'}
                  onPress={handleGooglePlayPurchase}
                  loading={isPurchasing}
                  disabled={!selectedPackage || isPurchasing}
                  style={{ marginTop: SPACING.md }}
                />
              )}

              {/* Restore purchases */}
              <Pressable
                onPress={() => restore()}
                disabled={isRestoring}
                accessibilityRole="button"
                accessibilityLabel="Restore previous purchases"
                style={styles.restoreBtn}
              >
                <Text style={[styles.restoreText, { color: colors.primary }]}>
                  {isRestoring ? 'Restoring...' : 'Restore Purchases'}
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Mobile Money Tab */}
          {activeTab === 'mobile_money' && (
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.duration(200)}
              style={styles.tabPanel}
            >
              {momoStep === 'select_plan' && (
                <>
                  {/* Plan Selection */}
                  <View accessibilityRole="radiogroup" accessibilityLabel="Mobile Money plans">
                    {momoPlans?.map((plan) => (
                      <MoMoPlanCard
                        key={plan.id}
                        plan={plan}
                        isSelected={selectedMomoPlan === plan.type}
                        onSelect={setSelectedMomoPlan}
                      />
                    ))}
                  </View>

                  {momoPlansLoading && (
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>Loading plans...</Text>
                  )}

                  {/* Provider Selection */}
                  {selectedMomoPlan && (
                    <Animated.View
                      entering={reduceMotion ? undefined : FadeIn.duration(200)}
                      style={styles.providerSection}
                    >
                      <Text style={[styles.sectionLabel, { color: colors.text }]}>
                        Select Provider
                      </Text>
                      <View style={styles.providerRow}>
                        <PaymentMethodCard
                          method="MTN_MOMO"
                          name="MTN Mobile Money"
                          description="Pay with your MTN MoMo wallet"
                          icon={<Smartphone size={22} color="#FFCC00" />}
                          isSelected={selectedProvider === 'MTN'}
                          onSelect={() => setSelectedProvider('MTN')}
                          brandColor="#FFCC00"
                        />
                        <PaymentMethodCard
                          method="AIRTEL_MONEY"
                          name="Airtel Money"
                          description="Pay with your Airtel Money wallet"
                          icon={<Smartphone size={22} color="#FF0000" />}
                          isSelected={selectedProvider === 'AIRTEL'}
                          onSelect={() => setSelectedProvider('AIRTEL')}
                          brandColor="#FF0000"
                        />
                      </View>
                    </Animated.View>
                  )}

                  {selectedMomoPlan && selectedProvider && (
                    <PrimaryButton
                      title="Continue"
                      onPress={() => setMoMoStep('enter_phone')}
                      style={{ marginTop: SPACING.md }}
                    />
                  )}
                </>
              )}

              {momoStep === 'enter_phone' && (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>
                    Enter your {selectedProvider} number
                  </Text>
                  <PhoneInput
                    value={phoneNumber}
                    onChangeText={(text) => {
                      setPhoneNumber(text);
                      if (phoneError) setPhoneError(null);
                    }}
                    error={phoneError ?? undefined}
                    placeholder="e.g. 0700 123 456"
                  />
                  <View style={styles.momoButtonRow}>
                    <Pressable onPress={() => setMoMoStep('select_plan')} style={styles.backBtn}>
                      <Text style={[styles.backBtnText, { color: colors.primary }]}>Back</Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        title="Continue"
                        onPress={handleMoMoConfirm}
                      />
                    </View>
                  </View>
                </KeyboardAvoidingView>
              )}

              {momoStep === 'confirm' && selectedPlanData && (
                <>
                  <View style={[styles.receipt, { backgroundColor: withAlpha(colors.card, 0.8), borderColor: withAlpha(colors.border, 0.3) }]}>
                    <Text style={[styles.receiptTitle, { color: colors.text }]}>Payment Summary</Text>
                    <ReceiptRow label="Plan" value={selectedPlanData.name} colors={colors} />
                    <ReceiptRow label="Amount" value={`UGX ${selectedPlanData.price.toLocaleString()}`} colors={colors} />
                    <ReceiptRow label="Provider" value={selectedProvider ?? ''} colors={colors} />
                    <ReceiptRow label="Phone" value={phoneNumber} colors={colors} />
                    <ReceiptRow label="Duration" value={`${selectedPlanData.durationDays} days`} colors={colors} />
                  </View>

                  <View style={styles.momoButtonRow}>
                    <Pressable onPress={() => setMoMoStep('enter_phone')} style={styles.backBtn}>
                      <Text style={[styles.backBtnText, { color: colors.primary }]}>Back</Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        title={`Pay UGX ${selectedPlanData.price.toLocaleString()}`}
                        onPress={handleMoMoInitiate}
                        loading={momoFlow.isInitiating}
                        disabled={momoFlow.isInitiating}
                      />
                    </View>
                  </View>

                  <View style={styles.securityNote}>
                    <Shield size={14} color={colors.textMuted} />
                    <Text style={[styles.securityText, { color: colors.textMuted }]}>
                      Secured by {selectedProvider} Mobile Money
                    </Text>
                  </View>
                </>
              )}

              {momoStep === 'processing' && (
                <MoMoProcessingStatus
                  status={momoFlow.status}
                  provider={selectedProvider ?? 'MTN'}
                  phoneNumber={phoneNumber}
                  onRetry={() => {
                    momoFlow.reset();
                    setMoMoStep('confirm');
                  }}
                  onCancel={() => {
                    momoFlow.reset();
                    setMoMoStep('select_plan');
                  }}
                  onContinue={() => {
                    // handled by useEffect on momoFlow.status
                  }}
                  onGooglePlayFallback={() => {
                    momoFlow.reset();
                    setMoMoStep('select_plan');
                    setActiveTab('google_play');
                  }}
                />
              )}
            </Animated.View>
          )}
        </Animated.View>
      )}
    </View>
  );
});

InlinePremiumSection.displayName = 'InlinePremiumSection';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const ReceiptRow = React.memo(({ label, value, colors }: { label: string; value: string; colors: any }) => (
  <View style={styles.receiptRow}>
    <Text style={[styles.receiptLabel, { color: colors.textMuted }]}>{label}</Text>
    <Text style={[styles.receiptValue, { color: colors.text }]}>{value}</Text>
  </View>
));

ReceiptRow.displayName = 'ReceiptRow';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  bannerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 1,
  },
  subscribePill: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  subscribePillText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
  },
  billingWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.xs,
  },
  billingWarningText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  expandedContainer: {
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  featureList: {
    marginBottom: SPACING.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs + 2,
  },
  featureText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  tabPanel: {
    marginTop: SPACING.md,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  restoreBtn: {
    alignSelf: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  restoreText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  providerSection: {
    marginTop: SPACING.md,
  },
  sectionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.sm,
  },
  providerRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  momoButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  backBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  backBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  receipt: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  receiptTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.sm,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  receiptLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  receiptValue: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  securityText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xxs,
  },
});
