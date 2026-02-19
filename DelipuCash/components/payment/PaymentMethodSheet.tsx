/**
 * Payment Method Sheet
 *
 * Multi-step bottom sheet for selecting a payment method and completing
 * a subscription purchase via Google Play or Mobile Money.
 *
 * Steps:
 * 1. SELECT_METHOD — choose Google Play, MTN MoMo, or Airtel Money
 * 2. ENTER_PHONE — phone number input (MoMo only)
 * 3. CONFIRM — receipt card with plan + amount + phone
 * 4. PROCESSING — STK push polling with real-time status
 *
 * @module components/payment/PaymentMethodSheet
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  X,
  ShoppingBag,
  Smartphone,
  Shield,
  ChevronLeft,
} from 'lucide-react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';
import { PhoneInput } from '@/components/PhoneInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { PaymentMethodCard, type PaymentMethodType } from './PaymentMethodCard';
import { MoMoProcessingStatus } from './MoMoProcessingStatus';
import { useMoMoPaymentFlow, useMoMoPlans } from '@/services/subscriptionPaymentHooks';

// ============================================================================
// TYPES
// ============================================================================

interface PaymentMethodSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedPackage: PurchasesPackage | null;
  selectedPlanType: string;
  planPrice: number;
  planCurrency: string;
  onGooglePlayPurchase: () => void;
  onMoMoPurchaseComplete: () => void;
}

type Step = 'SELECT_METHOD' | 'ENTER_PHONE' | 'CONFIRM' | 'PROCESSING';

// RevenueCat package type → backend plan type mapping
const PACKAGE_TO_PLAN: Record<string, string> = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  TWO_MONTH: 'MONTHLY', // fallback
  THREE_MONTH: 'QUARTERLY',
  SIX_MONTH: 'HALF_YEARLY',
  ANNUAL: 'YEARLY',
  LIFETIME: 'LIFETIME',
};

// ============================================================================
// COMPONENT
// ============================================================================

export const PaymentMethodSheet: React.FC<PaymentMethodSheetProps> = ({
  visible,
  onClose,
  selectedPackage,
  selectedPlanType,
  planPrice,
  planCurrency,
  onGooglePlayPurchase,
  onMoMoPurchaseComplete,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const momoFlow = useMoMoPaymentFlow();
  const { data: momoPlans } = useMoMoPlans();

  // State
  const [step, setStep] = useState<Step>('SELECT_METHOD');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('GOOGLE_PLAY');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Resolve MoMo plan type from the selected package
  const momoPlanType = useMemo(() => {
    return PACKAGE_TO_PLAN[selectedPlanType] ?? selectedPlanType;
  }, [selectedPlanType]);

  // Resolve MoMo price from backend plans
  const momoPlan = useMemo(() => {
    return momoPlans?.find((p) => p.type === momoPlanType);
  }, [momoPlans, momoPlanType]);

  const displayPrice = momoPlan?.price ?? planPrice;
  const displayCurrency = momoPlan?.currency ?? planCurrency;

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (visible) {
      setStep('SELECT_METHOD');
      setSelectedMethod('GOOGLE_PLAY');
      setPhoneNumber('');
      setPhoneError(null);
      momoFlow.reset();
    }
  }, [visible]);

  // Watch MoMo flow status for completion
  useEffect(() => {
    if (momoFlow.status === 'SUCCESSFUL') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onMoMoPurchaseComplete();
    }
  }, [momoFlow.status, onMoMoPurchaseComplete]);

  // ── Handlers ──

  const handleMethodSelect = useCallback((method: PaymentMethodType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMethod(method);
  }, []);

  const handleContinueFromMethod = useCallback(() => {
    if (selectedMethod === 'GOOGLE_PLAY') {
      onClose();
      onGooglePlayPurchase();
    } else {
      setStep('ENTER_PHONE');
    }
  }, [selectedMethod, onClose, onGooglePlayPurchase]);

  const handleContinueFromPhone = useCallback(() => {
    const cleanPhone = phoneNumber.replace(/[\s-]/g, '');
    if (cleanPhone.length < 9) {
      setPhoneError('Please enter a valid phone number');
      return;
    }
    setPhoneError(null);
    setStep('CONFIRM');
  }, [phoneNumber]);

  const handleConfirmPayment = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const provider = selectedMethod === 'MTN_MOMO' ? 'MTN' : 'AIRTEL';
    momoFlow.initiate({
      phoneNumber,
      provider,
      planType: momoPlanType,
    });
    setStep('PROCESSING');
  }, [selectedMethod, phoneNumber, momoPlanType, momoFlow]);

  const handleRetry = useCallback(() => {
    momoFlow.reset();
    setStep('CONFIRM');
  }, [momoFlow]);

  const handleGooglePlayFallback = useCallback(() => {
    momoFlow.reset();
    onClose();
    onGooglePlayPurchase();
  }, [momoFlow, onClose, onGooglePlayPurchase]);

  const handleBack = useCallback(() => {
    if (step === 'ENTER_PHONE') setStep('SELECT_METHOD');
    else if (step === 'CONFIRM') setStep('ENTER_PHONE');
  }, [step]);

  const providerName = selectedMethod === 'MTN_MOMO' ? 'MTN Mobile Money' : 'Airtel Money';

  // ── Step indicator ──
  const stepIndex = ['SELECT_METHOD', 'ENTER_PHONE', 'CONFIRM', 'PROCESSING'].indexOf(step);
  const totalSteps = 4;

  // ── Render ──

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={step === 'PROCESSING' ? undefined : onClose}
    >
      <Pressable style={styles.overlay} onPress={step === 'PROCESSING' ? undefined : onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                paddingBottom: insets.bottom + SPACING.base,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.header}>
              {(step === 'ENTER_PHONE' || step === 'CONFIRM') && (
                <Pressable
                  onPress={handleBack}
                  hitSlop={12}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <ChevronLeft size={24} color={colors.text} />
                </Pressable>
              )}

              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {step === 'SELECT_METHOD' && 'Payment Method'}
                {step === 'ENTER_PHONE' && 'Enter Phone Number'}
                {step === 'CONFIRM' && 'Confirm Payment'}
                {step === 'PROCESSING' && 'Processing'}
              </Text>

              {step !== 'PROCESSING' && (
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <X size={22} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Step indicator */}
            <View style={styles.stepIndicator}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor:
                        i <= stepIndex ? colors.primary : withAlpha(colors.text, 0.15),
                      width: i === stepIndex ? 20 : 8,
                    },
                  ]}
                />
              ))}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {/* ── STEP 1: SELECT METHOD ── */}
              {step === 'SELECT_METHOD' && (
                <View style={styles.stepContent}>
                  <View style={styles.methodCards}>
                    <PaymentMethodCard
                      method="GOOGLE_PLAY"
                      name="Google Play"
                      description="Credit card, debit card, or carrier billing (MTN/Airtel)"
                      icon={<ShoppingBag size={22} color={colors.primary} />}
                      isSelected={selectedMethod === 'GOOGLE_PLAY'}
                      onSelect={handleMethodSelect}
                      badge="recommended"
                      brandColor={colors.primary}
                    />

                    <PaymentMethodCard
                      method="MTN_MOMO"
                      name="MTN Mobile Money"
                      description="Pay directly from your MTN MoMo wallet"
                      icon={<Smartphone size={22} color="#FFCC00" />}
                      isSelected={selectedMethod === 'MTN_MOMO'}
                      onSelect={handleMethodSelect}
                      brandColor="#FFCC00"
                    />

                    <PaymentMethodCard
                      method="AIRTEL_MONEY"
                      name="Airtel Money"
                      description="Pay directly from your Airtel Money wallet"
                      icon={<Smartphone size={22} color="#FF0000" />}
                      isSelected={selectedMethod === 'AIRTEL_MONEY'}
                      onSelect={handleMethodSelect}
                      brandColor="#FF0000"
                    />
                  </View>

                  <PrimaryButton
                    title={selectedMethod === 'GOOGLE_PLAY' ? 'Continue with Google Play' : 'Continue'}
                    onPress={handleContinueFromMethod}
                    variant="primary"
                    size="large"
                  />

                  {/* Security note */}
                  <View style={styles.securityNote}>
                    <Shield size={14} color={colors.textMuted} />
                    <Text style={[styles.securityText, { color: colors.textMuted }]}>
                      All payments are secure and encrypted
                    </Text>
                  </View>
                </View>
              )}

              {/* ── STEP 2: ENTER PHONE ── */}
              {step === 'ENTER_PHONE' && (
                <View style={styles.stepContent}>
                  <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
                    Enter the {providerName} number to receive the payment prompt.
                  </Text>

                  <PhoneInput
                    label="Phone Number"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    error={phoneError}
                    touched={Boolean(phoneError)}
                    placeholder="700 123 456"
                    defaultCountryCode="+256"
                  />

                  <PrimaryButton
                    title="Continue"
                    onPress={handleContinueFromPhone}
                    variant="primary"
                    size="large"
                    style={{ marginTop: SPACING.lg }}
                  />
                </View>
              )}

              {/* ── STEP 3: CONFIRM ── */}
              {step === 'CONFIRM' && (
                <View style={styles.stepContent}>
                  {/* Receipt card */}
                  <View style={[styles.receiptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.receiptRow}>
                      <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Plan</Text>
                      <Text style={[styles.receiptValue, { color: colors.text }]}>
                        {momoPlan?.name ?? momoPlanType}
                      </Text>
                    </View>
                    <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.receiptRow}>
                      <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Amount</Text>
                      <Text style={[styles.receiptValue, { color: colors.text }]}>
                        {displayPrice.toLocaleString()} {displayCurrency}
                      </Text>
                    </View>
                    <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.receiptRow}>
                      <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Provider</Text>
                      <Text style={[styles.receiptValue, { color: colors.text }]}>{providerName}</Text>
                    </View>
                    <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.receiptRow}>
                      <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Phone</Text>
                      <Text style={[styles.receiptValue, { color: colors.text }]}>{phoneNumber}</Text>
                    </View>
                  </View>

                  <PrimaryButton
                    title={`Confirm & Pay ${displayPrice.toLocaleString()} ${displayCurrency}`}
                    onPress={handleConfirmPayment}
                    loading={momoFlow.isInitiating}
                    variant="primary"
                    size="large"
                    style={{ marginTop: SPACING.lg }}
                  />

                  <View style={styles.securityNote}>
                    <Shield size={14} color={colors.textMuted} />
                    <Text style={[styles.securityText, { color: colors.textMuted }]}>
                      You will receive a prompt on your phone to confirm
                    </Text>
                  </View>
                </View>
              )}

              {/* ── STEP 4: PROCESSING ── */}
              {step === 'PROCESSING' && (
                <MoMoProcessingStatus
                  provider={selectedMethod === 'MTN_MOMO' ? 'MTN' : 'AIRTEL'}
                  phoneNumber={phoneNumber}
                  status={momoFlow.status}
                  onCancel={() => {
                    momoFlow.reset();
                    setStep('SELECT_METHOD');
                  }}
                  onRetry={handleRetry}
                  onGooglePlayFallback={handleGooglePlayFallback}
                  onContinue={() => {
                    onMoMoPurchaseComplete();
                  }}
                />
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    maxHeight: '85%',
    ...SHADOWS.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    minHeight: 48,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: 'center',
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    left: SPACING.lg,
    zIndex: 1,
    padding: SPACING.xs,
  },
  closeButton: {
    position: 'absolute',
    right: SPACING.lg,
    zIndex: 1,
    padding: SPACING.xs,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  stepDot: {
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  stepContent: {
    paddingTop: SPACING.base,
  },
  methodCards: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  stepDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },
  receiptCard: {
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.base,
    ...SHADOWS.sm,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  receiptLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  receiptValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  receiptDivider: {
    height: 1,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.base,
  },
  securityText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default PaymentMethodSheet;
