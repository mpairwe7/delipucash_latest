/**
 * MoMo Processing Status Component
 *
 * Shows real-time status while waiting for STK push confirmation.
 * Displays animated phone icon, countdown timer, and contextual messaging.
 *
 * @module components/payment/MoMoProcessingStatus
 */

import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Smartphone, CheckCircle, XCircle, Clock } from 'lucide-react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
} from '@/utils/theme';

interface MoMoProcessingStatusProps {
  provider: 'MTN' | 'AIRTEL';
  phoneNumber: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'TIMEOUT' | null;
  onCancel: () => void;
  onRetry: () => void;
  onGooglePlayFallback?: () => void;
  onContinue?: () => void;
}

const PROVIDER_COLORS = {
  MTN: '#FFCC00',
  AIRTEL: '#FF0000',
};

const TIMEOUT_SECONDS = 5 * 60; // 5 minutes

export const MoMoProcessingStatus = memo<MoMoProcessingStatusProps>(({
  provider,
  phoneNumber,
  status,
  onCancel,
  onRetry,
  onGooglePlayFallback,
  onContinue,
}) => {
  const { colors } = useTheme();
  const providerColor = PROVIDER_COLORS[provider];
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS);

  // Pulsing animation for pending state
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (status === 'PENDING') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 1000, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1000 }),
          withTiming(0.2, { duration: 1000 }),
        ),
        -1,
        false,
      );
    }
  }, [status, pulseScale, pulseOpacity]);

  // Countdown timer with haptic + a11y feedback at key milestones
  useEffect(() => {
    if (status !== 'PENDING') return;
    setSecondsLeft(TIMEOUT_SECONDS);

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === 61) {
          // Warn at 1 minute remaining
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          AccessibilityInfo.announceForAccessibility('1 minute remaining');
        }
        if (prev <= 1) {
          clearInterval(interval);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const maskedPhone =
    phoneNumber.length > 6
      ? `${phoneNumber.slice(0, 4)}****${phoneNumber.slice(-3)}`
      : phoneNumber;

  // ── PENDING ──
  if (status === 'PENDING') {
    return (
      <View
        style={styles.container}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Waiting for payment confirmation. Expires in ${formatTime(secondsLeft)}`}
      >
        {/* Animated phone icon */}
        <View style={styles.iconWrapper}>
          <Animated.View
            style={[
              styles.pulseRing,
              { borderColor: providerColor },
              pulseStyle,
            ]}
          />
          <View style={[styles.iconCircle, { backgroundColor: withAlpha(providerColor, 0.15) }]}>
            <Smartphone size={32} color={providerColor} />
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          Check your phone
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          A payment prompt has been sent to your {provider === 'MTN' ? 'MTN Mobile Money' : 'Airtel Money'} number ({maskedPhone}).
          Please enter your PIN to confirm.
        </Text>

        {/* Timer */}
        <View style={[styles.timerContainer, { backgroundColor: withAlpha(colors.text, 0.05) }]}>
          <Clock size={14} color={colors.textMuted} />
          <Text style={[styles.timerText, { color: colors.textMuted }]}>
            Expires in {formatTime(secondsLeft)}
          </Text>
        </View>

        <PrimaryButton
          title="Cancel"
          onPress={onCancel}
          variant="ghost"
          size="medium"
          style={styles.cancelButton}
        />
      </View>
    );
  }

  // ── SUCCESS ──
  if (status === 'SUCCESSFUL') {
    return (
      <View
        style={styles.container}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        accessibilityLabel="Payment successful. Your subscription is now active."
      >
        <View style={[styles.iconCircle, { backgroundColor: withAlpha(colors.success, 0.15) }]}>
          <CheckCircle size={40} color={colors.success} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          Payment Successful
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your subscription is now active. Enjoy full access to all premium features.
        </Text>

        {onContinue && (
          <PrimaryButton
            title="Continue"
            onPress={onContinue}
            variant="primary"
            size="large"
            style={styles.actionButton}
          />
        )}
      </View>
    );
  }

  // ── FAILED / TIMEOUT ──
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={status === 'TIMEOUT' ? 'Payment timed out. Please try again.' : 'Payment failed. Please try again or use a different payment method.'}
    >
      <View style={[styles.iconCircle, { backgroundColor: withAlpha(colors.error, 0.15) }]}>
        <XCircle size={40} color={colors.error} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        {status === 'TIMEOUT' ? 'Payment Timed Out' : 'Payment Failed'}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {status === 'TIMEOUT'
          ? 'The payment confirmation was not received in time. Please try again.'
          : 'We could not process your payment. Please try again or use a different payment method.'}
      </Text>

      <PrimaryButton
        title="Try Again"
        onPress={onRetry}
        variant="primary"
        size="large"
        style={styles.actionButton}
      />

      {onGooglePlayFallback && (
        <PrimaryButton
          title="Use Google Play Instead"
          onPress={onGooglePlayFallback}
          variant="outline"
          size="medium"
          style={styles.fallbackButton}
        />
      )}
    </View>
  );
});

MoMoProcessingStatus.displayName = 'MoMoProcessingStatus';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    borderWidth: 2,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.base,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.base,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.base,
    marginBottom: SPACING.xl,
  },
  timerText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  cancelButton: {
    alignSelf: 'stretch',
  },
  actionButton: {
    alignSelf: 'stretch',
    marginBottom: SPACING.sm,
  },
  fallbackButton: {
    alignSelf: 'stretch',
  },
});

export default MoMoProcessingStatus;
