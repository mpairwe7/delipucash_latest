/**
 * Reward Redemption Modal — 2026 Redesign
 *
 * Multi-step wizard for redeeming quiz earnings to Cash or Airtime.
 * Improvements over v1:
 * - Step progress indicator (dots + labels)
 * - Richer provider cards with colour branding
 * - Amount selection with visual emphasis & description
 * - Receipt-style confirmation card
 * - Success confetti burst
 * - Full WCAG 2.2 AA accessibility (roles, labels, hints, live regions)
 * - Haptic feedback at every decision point
 * - BlurView backdrop, bottom-sheet presentation (Reanimated 4)
 * - Keyboard-aware layout with smooth transitions
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import {
  X,
  Banknote,
  Smartphone,
  Check,
  AlertCircle,
  Phone,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  CircleCheck,
  CircleX,
  Shield,
  Sparkles,
} from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  SHADOWS,
  withAlpha,
  ICON_SIZE,
  COMPONENT_SIZE,
} from '@/utils/theme';
import { formatCurrency } from '@/services';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  REWARD_CONSTANTS,
  RewardRedemptionType,
  PaymentProvider,
  pointsToCash,
  getRedemptionOptions,
  type RewardConfig,
} from '@/store/InstantRewardStore';
import { useRewardConfig } from '@/services/configHooks';
import { triggerHaptic } from '@/utils/quiz-utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RedemptionModalProps {
  visible: boolean;
  availableAmount: number;
  onClose: () => void;
  onRedeem: (
    amount: number,
    type: RewardRedemptionType,
    provider: PaymentProvider,
    phoneNumber: string,
  ) => Promise<{ success: boolean; message?: string }>;
  isLoading?: boolean;
  /** Pre-fill type and skip to CONFIRM for quick-redeem flow */
  initialType?: RewardRedemptionType;
  /** Pre-fill provider for quick-redeem */
  initialProvider?: PaymentProvider;
  /** Pre-fill phone for quick-redeem */
  initialPhone?: string;
  /** User's profile phone number — pre-filled into phone input, editable */
  userPhone?: string;
}

type RedemptionStep =
  | 'SELECT_TYPE'
  | 'SELECT_AMOUNT'
  | 'ENTER_DETAILS'
  | 'CONFIRM'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'ERROR';

const ORDERED_STEPS: RedemptionStep[] = [
  'SELECT_TYPE',
  'SELECT_AMOUNT',
  'ENTER_DETAILS',
  'CONFIRM',
];

// ─── Step Progress Indicator ─────────────────────────────────────────────────

interface StepIndicatorProps {
  currentStep: RedemptionStep;
}

const STEP_LABELS: Record<string, string> = {
  SELECT_TYPE: 'Type',
  SELECT_AMOUNT: 'Amount',
  ENTER_DETAILS: 'Details',
  CONFIRM: 'Confirm',
};

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const { colors } = useTheme();
  const currentIndex = ORDERED_STEPS.indexOf(currentStep);

  if (currentIndex < 0) return null; // Processing / Success / Error — hide indicator

  return (
    <View
      style={stepStyles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${currentIndex + 1} of ${ORDERED_STEPS.length}: ${STEP_LABELS[currentStep]}`}
      accessibilityValue={{ min: 1, max: ORDERED_STEPS.length, now: currentIndex + 1 }}
    >
      {ORDERED_STEPS.map((s, i) => {
        const isActive = i === currentIndex;
        const isCompleted = i < currentIndex;
        const dotColor = isActive
          ? colors.primary
          : isCompleted
            ? colors.success
            : colors.border;

        return (
          <View key={s} style={stepStyles.step}>
            <View
              style={[
                stepStyles.dot,
                {
                  backgroundColor: dotColor,
                  width: isActive ? 24 : 8,
                },
              ]}
            />
            {isActive && (
              <Text style={[stepStyles.label, { color: colors.primary }]}>
                {STEP_LABELS[s]}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

const stepStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  step: { alignItems: 'center', gap: SPACING.xxs },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

// ─── Confetti (reused lightweight pattern) ───────────────────────────────────

// Deterministic seeded random — stable across re-renders (replaces Math.random())
const seededRandom = (seed: number): number => {
  const val = Math.sin(seed) * 10000;
  return val - Math.floor(val);
};

const ConfettiParticle: React.FC<{
  color: string;
  index: number;
  total: number;
}> = ({ color, index, total }) => {
  const y = useSharedValue(0);
  const x = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0);

  // Pre-compute deterministic values from index — stable across re-renders
  const seed = React.useMemo(() => {
    const r1 = seededRandom(index * 9301 + 49297);
    const r2 = seededRandom(index * 7919 + 31337);
    const r3 = seededRandom(index * 6571 + 17389);
    const r4 = seededRandom(index * 4231 + 21013);
    const ang = (index / total) * 2 * Math.PI;
    const spd = 250 + r1 * 200;
    const dxVal = Math.cos(ang) * (30 + r2 * 60);
    const sz = 5 + r3 * 5;
    return {
      speed: spd,
      dx: dxVal,
      sz,
      borderRadius: r4 > 0.5 ? sz / 2 : 1,
      rotDir: r1 > 0.5 ? 1 : -1,
    };
  }, [index, total]);

  useEffect(() => {
    const d = index * 25;
    scale.value = withDelay(d, withSpring(1, { damping: 4, stiffness: 200 }));
    y.value = withDelay(d, withTiming(-seed.speed, { duration: 1200, easing: Easing.out(Easing.quad) }));
    x.value = withDelay(d, withTiming(seed.dx, { duration: 1200, easing: Easing.out(Easing.quad) }));
    rotate.value = withDelay(
      d,
      withTiming(360 * seed.rotDir, { duration: 1200 }),
    );
    opacity.value = withDelay(d + 700, withTiming(0, { duration: 500 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { translateX: x.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: seed.sz,
          height: seed.sz,
          borderRadius: seed.borderRadius,
          backgroundColor: color,
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
};

const MiniConfetti: React.FC<{ particleColors: string[] }> = ({ particleColors }) => (
  <View
    style={{
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    }}
    pointerEvents="none"
    importantForAccessibility="no"
  >
    {Array.from({ length: 18 }).map((_, i) => (
      <ConfettiParticle key={i} index={i} total={18} color={particleColors[i % particleColors.length]} />
    ))}
  </View>
);

// ─── Provider Detection ─────────────────────────────────────────────────────

/** Detect MTN or Airtel from Ugandan phone prefix (07x, 256xx, +256xx) */
function detectProviderFromPhone(phone: string): PaymentProvider | null {
  const cleaned = phone.replace(/[^0-9]/g, '');
  let local = cleaned;
  if (local.startsWith('256') && local.length >= 12) {
    local = '0' + local.slice(3);
  }
  if (local.length < 3 || !local.startsWith('0')) return null;
  if (/^07[678]/.test(local)) return 'MTN';
  if (/^07[05]/.test(local)) return 'AIRTEL';
  return null;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const RedemptionModal: React.FC<RedemptionModalProps> = ({
  visible,
  availableAmount,
  onClose,
  onRedeem,
  isLoading = false,
  initialType,
  initialProvider,
  initialPhone,
  userPhone,
}) => {
  const { colors, isDark } = useTheme();
  const { height: screenHeight } = useWindowDimensions();

  // State
  const [step, setStep] = useState<RedemptionStep>('SELECT_TYPE');
  const [selectedType, setSelectedType] = useState<RewardRedemptionType | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('MTN');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Track whether the phone was pre-filled from profile (for UI hint)
  const [isPhonePrefilled, setIsPhonePrefilled] = useState(false);

  // Reset on open — if quick-redeem props provided, skip to SELECT_AMOUNT with pre-fills
  useEffect(() => {
    if (visible) {
      setError(null);
      setSuccessMessage(null);

      if (initialType && initialProvider && initialPhone) {
        // Quick-redeem flow: pre-fill and start at amount selection
        setSelectedType(initialType);
        setSelectedProvider(initialProvider);
        setPhoneNumber(initialPhone);
        setIsPhonePrefilled(false);
        setSelectedAmount(0);
        setStep('SELECT_AMOUNT');
      } else {
        setStep('SELECT_TYPE');
        setSelectedType(null);
        setSelectedAmount(0);

        // Pre-fill phone from user profile if available
        const prefillPhone = userPhone || '';
        setPhoneNumber(prefillPhone);
        setIsPhonePrefilled(!!prefillPhone);

        // Auto-detect provider from pre-filled phone
        if (prefillPhone) {
          const detected = detectProviderFromPhone(prefillPhone);
          if (detected) setSelectedProvider(detected);
        }
      }
    }
  }, [visible, initialType, initialProvider, initialPhone, userPhone]);

  const { data: rewardConfig } = useRewardConfig();
  const availablePoints = availableAmount; // availableAmount is now the raw points count
  const redemptionOptions = rewardConfig
    ? getRedemptionOptions(rewardConfig).filter((opt) => opt.points <= availablePoints)
    : [];

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectType = useCallback((type: RewardRedemptionType) => {
    triggerHaptic('selection');
    setSelectedType(type);
    setStep('SELECT_AMOUNT');
  }, []);

  const handleSelectAmount = useCallback((points: number) => {
    triggerHaptic('selection');
    setSelectedAmount(points);
    // Quick-redeem: if phone already filled, skip to confirm
    if (initialPhone && phoneNumber) {
      setStep('CONFIRM');
    } else {
      setStep('ENTER_DETAILS');
    }
  }, [initialPhone, phoneNumber]);

  const handleConfirm = useCallback(async () => {
    if (!selectedType || !selectedAmount || !phoneNumber) {
      setError('Please fill in all details');
      return;
    }
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 12) {
      setError('Please enter a valid phone number');
      return;
    }

    triggerHaptic('medium');
    setStep('PROCESSING');
    setError(null);

    try {
      const cashValue = pointsToCash(selectedAmount, rewardConfig ?? undefined);
      const result = await onRedeem(cashValue, selectedType, selectedProvider, cleanPhone);
      if (result.success) {
        triggerHaptic('success');
        setSuccessMessage(
          result.message || `${formatCurrency(cashValue)} sent to your ${selectedProvider} number!`,
        );
        setStep('SUCCESS');
        AccessibilityInfo.announceForAccessibility(
          `Redemption successful. ${formatCurrency(cashValue)} sent.`,
        );
      } else {
        triggerHaptic('error');
        setError(result.message || 'Redemption failed. Please try again.');
        setStep('ERROR');
      }
    } catch (err) {
      triggerHaptic('error');
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('ERROR');
    }
  }, [selectedType, selectedAmount, phoneNumber, selectedProvider, onRedeem]);

  const handleBack = useCallback(() => {
    triggerHaptic('light');
    switch (step) {
      case 'SELECT_AMOUNT':
        setStep('SELECT_TYPE');
        break;
      case 'ENTER_DETAILS':
      case 'CONFIRM':
        setStep('SELECT_AMOUNT');
        break;
      case 'ERROR':
        setStep('ENTER_DETAILS');
        break;
    }
  }, [step]);

  const handleClose = useCallback(() => {
    triggerHaptic('light');
    onClose();
  }, [onClose]);

  const showBackButton = ['SELECT_AMOUNT', 'ENTER_DETAILS', 'CONFIRM', 'ERROR'].includes(step);

  // ── Step Renderers ─────────────────────────────────────────────────────────

  const renderSelectType = () => (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>How do you want to redeem?</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
        Choose your preferred payout method
      </Text>

      <View style={styles.typeOptions}>
        <TouchableOpacity
          style={[
            styles.typeCard,
            {
              backgroundColor: withAlpha(colors.success, 0.06),
              borderColor: withAlpha(colors.success, 0.25),
            },
          ]}
          onPress={() => handleSelectType('CASH')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Cash — receive money to mobile money account"
        >
          <View style={[styles.typeIconWrap, { backgroundColor: withAlpha(colors.success, 0.15) }]}>
            <Banknote size={28} color={colors.success} strokeWidth={1.5} />
          </View>
          <View style={styles.typeInfo}>
            <Text style={[styles.typeLabel, { color: colors.text }]}>Mobile Money</Text>
            <Text style={[styles.typeDesc, { color: colors.textMuted }]}>
              Withdraw directly to your MTN or Airtel account
            </Text>
          </View>
          <ChevronRight size={ICON_SIZE.md} color={colors.textMuted} strokeWidth={1.5} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeCard,
            {
              backgroundColor: withAlpha(colors.info, 0.06),
              borderColor: withAlpha(colors.info, 0.25),
            },
          ]}
          onPress={() => handleSelectType('AIRTIME')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Airtime — get instant phone top-up"
        >
          <View style={[styles.typeIconWrap, { backgroundColor: withAlpha(colors.info, 0.15) }]}>
            <Smartphone size={28} color={colors.info} strokeWidth={1.5} />
          </View>
          <View style={styles.typeInfo}>
            <Text style={[styles.typeLabel, { color: colors.text }]}>Airtime</Text>
            <Text style={[styles.typeDesc, { color: colors.textMuted }]}>
              Instant phone credit top-up
            </Text>
          </View>
          <ChevronRight size={ICON_SIZE.md} color={colors.textMuted} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderSelectAmount = () => (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Select Amount</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
        Available: {formatCurrency(availableAmount)} ({availablePoints} pts)
      </Text>

      <View style={styles.amountOptions}>
        {redemptionOptions.length > 0 ? (
          redemptionOptions.map((option) => {
            const isSelected = selectedAmount === option.points;
            return (
              <TouchableOpacity
                key={option.points}
                style={[
                  styles.amountCard,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected
                      ? withAlpha(colors.primary, 0.08)
                      : colors.card,
                  },
                ]}
                onPress={() => handleSelectAmount(option.points)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${option.points} points, ${formatCurrency(option.cashValue)}`}
              >
                <View style={styles.amountLeft}>
                  <Text
                    style={[
                      styles.amountPoints,
                      { color: isSelected ? colors.primary : colors.text },
                    ]}
                  >
                    {option.points} pts
                  </Text>
                  <Text style={[styles.amountCash, { color: colors.textMuted }]}>
                    {formatCurrency(option.cashValue)}
                  </Text>
                </View>
                {isSelected ? (
                  <View style={[styles.radioChecked, { borderColor: colors.primary, backgroundColor: colors.primary }]}>
                    <Check size={12} color="#fff" strokeWidth={3} />
                  </View>
                ) : (
                  <View style={[styles.radioUnchecked, { borderColor: colors.border }]} />
                )}
              </TouchableOpacity>
            );
          })
        ) : (
          <View
            style={[styles.noOptions, { backgroundColor: withAlpha(colors.warning, 0.1) }]}
            accessible
            accessibilityRole="alert"
          >
            <AlertCircle size={ICON_SIZE.lg} color={colors.warning} strokeWidth={1.5} />
            <Text style={[styles.noOptionsText, { color: colors.text }]}>
              You need {REWARD_CONSTANTS.MIN_REDEMPTION_POINTS - availablePoints} more points to redeem
            </Text>
            <Text style={[styles.noOptionsHint, { color: colors.textMuted }]}>
              Answer more questions to earn rewards!
            </Text>
            <PrimaryButton
              title="Earn More"
              onPress={handleClose}
              variant="secondary"
              style={{ marginTop: SPACING.sm }}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );

  const renderEnterDetails = () => (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Payment Details</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
        {selectedType === 'CASH' ? 'Mobile Money' : 'Airtime'} — {formatCurrency(pointsToCash(selectedAmount, rewardConfig ?? undefined))}
      </Text>

      {/* Provider pills */}
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Network Provider</Text>
      <View style={styles.providerRow}>
        {(['MTN', 'AIRTEL'] as PaymentProvider[]).map((provider) => {
          const isActive = selectedProvider === provider;
          const providerBg = provider === 'MTN' ? '#FFCC00' : '#FF0000';
          const providerFg = provider === 'MTN' ? '#000' : '#fff';
          return (
            <TouchableOpacity
              key={provider}
              style={[
                styles.providerPill,
                isActive
                  ? { backgroundColor: providerBg, borderColor: providerBg }
                  : { borderColor: colors.border, backgroundColor: colors.card },
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setSelectedProvider(provider);
              }}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={`${provider} network`}
            >
              <Text
                style={[
                  styles.providerText,
                  { color: isActive ? providerFg : colors.text },
                ]}
              >
                {provider}
              </Text>
              {isActive && <Check size={14} color={providerFg} strokeWidth={2.5} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Phone input */}
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Phone Number</Text>

      {/* Pre-fill indicator */}
      {isPhonePrefilled && phoneNumber === userPhone && (
        <View
          style={[styles.prefillHint, { backgroundColor: withAlpha(colors.success, 0.08) }]}
          accessibilityRole="text"
          accessibilityLabel="Phone number pre-filled from your profile"
        >
          <Check size={14} color={colors.success} strokeWidth={2} />
          <Text style={[styles.prefillHintText, { color: colors.success }]}>
            From your profile
          </Text>
        </View>
      )}

      <View
        style={[
          styles.phoneContainer,
          {
            borderColor: phoneNumber.length >= 9
              ? withAlpha(colors.success, 0.5)
              : colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <View style={[styles.phonePrefix, { borderRightColor: colors.border }]}>
          <Text style={[styles.phonePrefixText, { color: colors.textMuted }]}>+256</Text>
        </View>
        <TextInput
          style={[styles.phoneInput, { color: colors.text }]}
          placeholder="7XX XXX XXX"
          placeholderTextColor={colors.textMuted}
          value={phoneNumber}
          onChangeText={(text) => {
            setPhoneNumber(text);
            setIsPhonePrefilled(false);
            // Auto-detect provider as user types
            const detected = detectProviderFromPhone(text);
            if (detected) setSelectedProvider(detected);
          }}
          keyboardType="phone-pad"
          maxLength={12}
          autoComplete="tel"
          textContentType="telephoneNumber"
          accessibilityLabel="Phone number"
          accessibilityHint={
            isPhonePrefilled
              ? 'Pre-filled from your profile. Tap to edit.'
              : 'Enter your mobile money or airtime phone number'
          }
        />
        {phoneNumber.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setPhoneNumber('');
              setIsPhonePrefilled(false);
              triggerHaptic('light');
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Clear phone number"
          >
            <CircleX size={ICON_SIZE.md} color={colors.textMuted} strokeWidth={1.5} />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View
          style={[styles.inlineError, { backgroundColor: withAlpha(colors.error, 0.1) }]}
          accessibilityRole="alert"
        >
          <AlertCircle size={ICON_SIZE.sm} color={colors.error} strokeWidth={1.5} />
          <Text style={[styles.inlineErrorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      <PrimaryButton
        title="Review & Confirm"
        onPress={() => {
          if (!phoneNumber || phoneNumber.length < 9) {
            setError('Please enter a valid phone number');
            return;
          }
          setError(null);
          triggerHaptic('selection');
          setStep('CONFIRM');
        }}
        disabled={!phoneNumber || phoneNumber.length < 9}
      />
    </Animated.View>
  );

  const renderConfirm = () => (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Review & Confirm</Text>

      {/* Receipt card */}
      <View
        style={[styles.receiptCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`Redeeming ${formatCurrency(pointsToCash(selectedAmount, rewardConfig ?? undefined))} via ${selectedType === 'CASH' ? 'mobile money' : 'airtime'} to ${selectedProvider} ${phoneNumber}`}
      >
        <View style={styles.receiptRow}>
          <Text style={[styles.receiptLabel, { color: colors.textMuted }]}>Payout Type</Text>
          <Text style={[styles.receiptValue, { color: colors.text }]}>
            {selectedType === 'CASH' ? 'Mobile Money' : 'Airtime'}
          </Text>
        </View>
        <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />
        <View style={styles.receiptRow}>
          <Text style={[styles.receiptLabel, { color: colors.textMuted }]}>Amount</Text>
          <Text style={[styles.receiptValue, { color: colors.success }]}>
            {formatCurrency(pointsToCash(selectedAmount, rewardConfig ?? undefined))}
          </Text>
        </View>
        <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />
        <View style={styles.receiptRow}>
          <Text style={[styles.receiptLabel, { color: colors.textMuted }]}>Points Used</Text>
          <Text style={[styles.receiptValue, { color: colors.text }]}>{selectedAmount} pts</Text>
        </View>
        <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />
        <View style={styles.receiptRow}>
          <Text style={[styles.receiptLabel, { color: colors.textMuted }]}>Provider</Text>
          <Text style={[styles.receiptValue, { color: colors.text }]}>{selectedProvider}</Text>
        </View>
        <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />
        <View style={styles.receiptRow}>
          <Text style={[styles.receiptLabel, { color: colors.textMuted }]}>Phone</Text>
          <Text style={[styles.receiptValue, { color: colors.text }]}>{phoneNumber}</Text>
        </View>
      </View>

      {/* Security notice */}
      <View
        style={[
          styles.securityNotice,
          { backgroundColor: withAlpha(colors.info, 0.06), borderColor: withAlpha(colors.info, 0.2) },
        ]}
      >
        <Shield size={ICON_SIZE.md} color={colors.info} strokeWidth={1.5} />
        <Text style={[styles.securityText, { color: colors.textMuted }]}>
          Your transaction is encrypted and secure
        </Text>
      </View>

      <PrimaryButton
        title="Confirm & Redeem"
        onPress={handleConfirm}
        loading={isLoading}
      />
    </Animated.View>
  );

  const renderProcessing = () => (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.stepContent, styles.centerContent]}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.statusTitle, { color: colors.text }]}>
        Processing Redemption...
      </Text>
      <Text style={[styles.statusSubtext, { color: colors.textMuted }]}>
        Sending {selectedType === 'CASH' ? 'money' : 'airtime'} to your {selectedProvider} number
      </Text>
    </Animated.View>
  );

  const renderSuccess = () => (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.stepContent, styles.centerContent]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={[styles.statusCircle, { backgroundColor: withAlpha(colors.success, 0.12) }]}>
        <MiniConfetti
          particleColors={[colors.success, colors.primary, colors.warning, '#A78BFA', '#38BDF8']}
        />
        <CircleCheck size={56} color={colors.success} strokeWidth={1.5} />
      </View>
      <Text style={[styles.statusTitle, { color: colors.success }]}>Redemption Successful!</Text>
      <Text style={[styles.statusSubtext, { color: colors.text }]}>{successMessage}</Text>
      <PrimaryButton title="Done" onPress={handleClose} />
    </Animated.View>
  );

  const renderError = () => (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.stepContent, styles.centerContent]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={[styles.statusCircle, { backgroundColor: withAlpha(colors.error, 0.12) }]}>
        <CircleX size={56} color={colors.error} strokeWidth={1.5} />
      </View>
      <Text style={[styles.statusTitle, { color: colors.error }]}>Redemption Failed</Text>
      <Text style={[styles.statusSubtext, { color: colors.text }]}>{error}</Text>
      <View style={styles.errorActions}>
        <PrimaryButton title="Try Again" onPress={handleBack} variant="primary" />
        <PrimaryButton title="Close" onPress={handleClose} variant="secondary" />
      </View>
    </Animated.View>
  );

  const renderStepContent = () => {
    switch (step) {
      case 'SELECT_TYPE':
        return renderSelectType();
      case 'SELECT_AMOUNT':
        return renderSelectAmount();
      case 'ENTER_DETAILS':
        return renderEnterDetails();
      case 'CONFIRM':
        return renderConfirm();
      case 'PROCESSING':
        return renderProcessing();
      case 'SUCCESS':
        return renderSuccess();
      case 'ERROR':
        return renderError();
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <BlurView
        intensity={isDark ? 50 : 70}
        tint={isDark ? 'dark' : 'light'}
        style={styles.overlay}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.keyboardView}
        >
          <Animated.View
            entering={SlideInDown.springify().damping(18).stiffness(120)}
            style={[
              styles.sheet,
              { backgroundColor: colors.background, maxHeight: screenHeight * 0.9 },
            ]}
          >
            {/* Drag indicator */}
            <View style={[styles.dragIndicator, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              {showBackButton ? (
                <TouchableOpacity
                  style={[styles.headerBtn, { backgroundColor: colors.secondary }]}
                  onPress={handleBack}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <ChevronLeft size={ICON_SIZE.lg} color={colors.text} strokeWidth={1.5} />
                </TouchableOpacity>
              ) : (
                <View style={styles.headerBtnPlaceholder} />
              )}

              <Text style={[styles.headerTitle, { color: colors.text }]}>Redeem Rewards</Text>

              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: colors.secondary }]}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close redemption"
              >
                <X size={ICON_SIZE.lg} color={colors.text} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>

            {/* Step indicator */}
            <StepIndicator currentStep={step} />

            {/* Content */}
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {renderStepContent()}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  keyboardView: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    ...SHADOWS.lg,
    overflow: 'hidden',
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxs,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER_WIDTH.thin,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  headerBtn: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnPlaceholder: { width: COMPONENT_SIZE.touchTarget },

  // Content — no flex:1 on ScrollView; sheet is content-sized (maxHeight constrains)
  content: {},
  contentContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
  },

  // Step content
  stepContent: { gap: SPACING.lg },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['2xl'],
    minHeight: 320,
  },
  stepTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  stepSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: -SPACING.sm,
  },

  // Type selection
  typeOptions: { gap: SPACING.sm },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
    minHeight: COMPONENT_SIZE.touchTarget + 16,
  },
  typeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeInfo: { flex: 1, gap: 2 },
  typeLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  typeDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
  },

  // Amount selection
  amountOptions: { gap: SPACING.sm },
  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  amountLeft: { gap: 2 },
  amountPoints: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  amountCash: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  radioChecked: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioUnchecked: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  noOptions: {
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  noOptionsText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
  },
  noOptionsHint: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },

  // Enter details
  fieldLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
    marginTop: -SPACING.xs,
  },
  providerRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  providerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.base,
    borderWidth: BORDER_WIDTH.thin,
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  providerText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  prefillHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    marginBottom: SPACING.xs,
    marginTop: -SPACING.sm,
  },
  prefillHintText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.base,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  phonePrefix: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRightWidth: BORDER_WIDTH.thin,
  },
  phonePrefixText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  phoneInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  inlineErrorText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Confirm / receipt
  receiptCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.sm,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  receiptValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  receiptDivider: {
    height: StyleSheet.hairlineWidth,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.base,
    borderWidth: BORDER_WIDTH.thin,
  },
  securityText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Status screens (processing / success / error)
  statusCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  statusTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  statusSubtext: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
  },
  errorActions: { gap: SPACING.sm, width: '100%' },
});

export default RedemptionModal;
