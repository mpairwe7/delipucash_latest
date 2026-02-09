/**
 * OTPVerificationModal Component
 * Reusable OTP/2FA verification modal with countdown timer
 * 
 * Design: Modern fintech verification flow (2025-2026 style)
 * Features:
 * - Animated countdown timer with visual feedback
 * - Auto-focus on OTP input
 * - Resend code functionality
 * - Loading states for verification
 * - Expiration handling
 * 
 * Accessibility: WCAG 2.2 AA compliant
 * - Modal focus management
 * - Screen reader announcements for timer
 * - Clear error states
 * 
 * @example
 * ```tsx
 * <OTPVerificationModal
 *   visible={show2FAModal}
 *   title="Verify Your Email"
 *   subtitle="Enter the 6-digit code sent to your email"
 *   maskedEmail="j***@example.com"
 *   expiresAt={otpExpiresAt}
 *   onVerify={(code) => verify2FA(code)}
 *   onResend={() => resend2FACode()}
 *   onClose={() => setShow2FAModal(false)}
 *   isVerifying={isLoading}
 * />
 * ```
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { Shield, KeyRound, X, RefreshCw } from 'lucide-react-native';
import Animated, {
  FadeInUp,
  ReduceMotion,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
  ICON_SIZE,
  COMPONENT_SIZE,
} from '@/utils/theme';
import { AccessibleText } from './AccessibleText';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type OTPModalVariant = 'enable2FA' | 'disable2FA' | 'verification' | 'passwordReset';

export interface OTPVerificationModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Modal variant/type */
  variant?: OTPModalVariant;
  /** Modal title */
  title?: string;
  /** Modal subtitle/description */
  subtitle?: string;
  /** Masked email for display */
  maskedEmail?: string;
  /** OTP expiration timestamp (Date.now() + ms) */
  expiresAt?: number | null;
  /** Code length (default: 6) */
  codeLength?: number;
  /** Verify callback with entered code */
  onVerify: (code: string) => void;
  /** Resend code callback */
  onResend?: () => void;
  /** Close modal callback */
  onClose: () => void;
  /** Whether verification is in progress */
  isVerifying?: boolean;
  /** Whether resend is in progress */
  isResending?: boolean;
  /** Custom icon */
  icon?: React.ReactNode;
  /** Test ID */
  testID?: string;
}

/**
 * Format countdown time as MM:SS
 */
function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function OTPVerificationModal({
  visible,
  variant = 'verification',
  title,
  subtitle,
  maskedEmail,
  expiresAt,
  codeLength = 6,
  onVerify,
  onResend,
  onClose,
  isVerifying = false,
  isResending = false,
  icon,
  testID,
}: OTPVerificationModalProps): React.ReactElement {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animation values
  const shakeX = useSharedValue(0);
  const iconPulse = useSharedValue(1);

  // Clear code on close
  useEffect(() => {
    if (!visible) {
      setCode('');
      setCountdown(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
  }, [visible]);

  // Countdown timer
  useEffect(() => {
    if (visible && expiresAt) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }

      countdownRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        setCountdown(remaining);

        if (remaining <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }, 1000);

      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      };
    }
  }, [visible, expiresAt]);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);

      // Icon pulse animation
      iconPulse.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        3,
        true
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const shakeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPulse.value }],
  }));

  const triggerShake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = useCallback(() => {
    if (code.length !== codeLength) {
      triggerShake();
      return;
    }

    if (expiresAt && Date.now() > expiresAt) {
      triggerShake();
      AccessibilityInfo.announceForAccessibility('Code expired. Please request a new one.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVerify(code);
  }, [code, codeLength, expiresAt, onVerify, triggerShake]);

  const handleResend = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCode('');
    onResend?.();
  }, [onResend]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  // Derive modal content based on variant
  const getVariantConfig = () => {
    switch (variant) {
      case 'enable2FA':
        return {
          icon: <Shield size={32} color={colors.primary} />,
          iconBg: withAlpha(colors.primary, 0.1),
          defaultTitle: 'Verify Your Email',
          defaultSubtitle: `We've sent a 6-digit code to ${maskedEmail || 'your email'}. Enter it below to enable two-factor authentication.`,
        };
      case 'disable2FA':
        return {
          icon: <KeyRound size={32} color={colors.warning} />,
          iconBg: withAlpha(colors.warning, 0.1),
          defaultTitle: 'Disable Two-Factor Authentication',
          defaultSubtitle: 'Enter your password to confirm disabling 2FA. This will make your account less secure.',
        };
      case 'passwordReset':
        return {
          icon: <KeyRound size={32} color={colors.info} />,
          iconBg: withAlpha(colors.info, 0.1),
          defaultTitle: 'Reset Password',
          defaultSubtitle: `Enter the verification code sent to ${maskedEmail || 'your email'}.`,
        };
      default:
        return {
          icon: <Shield size={32} color={colors.primary} />,
          iconBg: withAlpha(colors.primary, 0.1),
          defaultTitle: 'Verification Required',
          defaultSubtitle: 'Enter the verification code to continue.',
        };
    }
  };

  const config = getVariantConfig();
  const isExpired = expiresAt ? Date.now() > expiresAt : false;
  const canVerify = code.length === codeLength && !isExpired && !isVerifying;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      accessibilityViewIsModal
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
          accessibilityLabel="Close modal"
          accessibilityRole="button"
        />

        <Animated.View
          entering={FadeInUp.duration(300).springify().reduceMotion(ReduceMotion.System)}
          style={[styles.content, { backgroundColor: colors.card }]}
          accessible
          accessibilityRole="alert"
          accessibilityLabel={title || config.defaultTitle}
        >
          {/* Close Button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: withAlpha(colors.text, 0.05) }]}
            onPress={handleClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <X size={ICON_SIZE.lg} color={colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>

          {/* Icon */}
          <Animated.View
            style={[
              styles.iconWrapper,
              { backgroundColor: config.iconBg },
              iconAnimatedStyle,
            ]}
          >
            {icon || config.icon}
          </Animated.View>

          {/* Title */}
          <AccessibleText
            variant="h3"
            center
            style={styles.title}
            headingLevel={1}
          >
            {title || config.defaultTitle}
          </AccessibleText>

          {/* Subtitle */}
          <AccessibleText
            variant="body"
            color="textMuted"
            center
            style={styles.subtitle}
          >
            {subtitle || config.defaultSubtitle}
          </AccessibleText>

          {/* Countdown Timer */}
          {expiresAt && (
            <View
              style={[
                styles.countdownContainer,
                {
                  backgroundColor: isExpired
                    ? withAlpha(colors.error, 0.1)
                    : withAlpha(colors.primary, 0.1),
                },
              ]}
              accessibilityLiveRegion="polite"
            >
              <AccessibleText
                variant="bodySmall"
                medium
                customColor={isExpired ? colors.error : colors.primary}
                accessibilityLabel={
                  isExpired
                    ? 'Code expired. Please request a new one.'
                    : `Code expires in ${formatCountdown(countdown)}`
                }
              >
                {isExpired
                  ? 'Code expired — please request a new one'
                  : `Code expires in ${formatCountdown(countdown)}`}
              </AccessibleText>
            </View>
          )}

          {/* OTP Input */}
          <Animated.View style={[styles.inputContainer, shakeAnimatedStyle]}>
            <TextInput
              ref={inputRef}
              style={[
                styles.otpInput,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderColor: isExpired ? colors.error : colors.border,
                },
              ]}
              value={code}
              onChangeText={setCode}
              placeholder={`Enter ${codeLength}-digit code`}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={codeLength}
              autoFocus
              editable={!isExpired}
              accessibilityLabel={`${codeLength}-digit verification code`}
              accessibilityHint="Enter the code sent to your email"
            />
          </Animated.View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: withAlpha(colors.border, 0.6) }]}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              accessibilityHint="Close verification modal"
            >
              <AccessibleText variant="button" color="textMuted">
                Cancel
              </AccessibleText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: canVerify ? colors.primary : colors.border },
              ]}
              onPress={handleVerify}
              disabled={!canVerify}
              accessibilityRole="button"
              accessibilityLabel="Verify code"
              accessibilityState={{ disabled: !canVerify }}
            >
              {isVerifying ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <AccessibleText variant="button" customColor="#FFF">
                  Verify
                </AccessibleText>
              )}
            </TouchableOpacity>
          </View>

          {/* Resend Link */}
          {onResend && (
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResend}
              disabled={isResending}
              accessibilityRole="button"
              accessibilityLabel="Resend verification code"
            >
              {isResending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={styles.resendContent}>
                  <RefreshCw size={14} color={colors.primary} />
                  <AccessibleText variant="bodySmall" medium color="primary">
                    Resend Code
                  </AccessibleText>
                </View>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    width: Math.min(SCREEN_WIDTH - SPACING.xl * 2, 400),
    borderRadius: RADIUS['2xl'],
    padding: SPACING.xl,
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: COMPONENT_SIZE.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    marginTop: SPACING.sm,
  },
  title: {
    marginBottom: SPACING.sm,
  },
  subtitle: {
    marginBottom: SPACING.lg,
    lineHeight: 22,
    paddingHorizontal: SPACING.sm,
  },
  countdownContainer: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
  },
  inputContainer: {
    width: '100%',
    marginBottom: SPACING.lg,
  },
  otpInput: {
    width: '100%',
    height: 56,
    borderWidth: 1.5,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xl,
    textAlign: 'center',
    letterSpacing: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
});

export default OTPVerificationModal;
