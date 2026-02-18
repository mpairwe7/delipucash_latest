/**
 * Question Timer Component - Enhanced UX for Instant Reward Questions
 * 
 * Features:
 * - 60-second countdown per question
 * - Visual progress ring with color transitions
 * - Animated urgency indicators (danger zone at <15 seconds)
 * - Haptic feedback when entering critical time
 * - Accessibility support
 */

import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AlertCircle, Clock } from 'lucide-react-native';
import {
  useTheme,
  TYPOGRAPHY,
  SPACING,
  ICON_SIZE,
  withAlpha,
  RADIUS,
  BORDER_WIDTH,
} from '@/utils/theme';
import { triggerHaptic } from '@/utils/quiz-utils';

// ─── Reanimated SVG wrapper ──────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Constants ───────────────────────────────────────────────────────────────

const QUESTION_TIME_LIMIT = 60; // seconds
const CRITICAL_TIME_THRESHOLD = 15; // seconds - enter danger zone
const WARNING_TIME_THRESHOLD = 30; // seconds - enter warning zone
const RING_RADIUS = 45;
const RING_STROKE = 4;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuestionTimerProps {
  /** Time limit in seconds (default: 60) */
  timeLimit?: number;
  /** Callback when time expires */
  onTimeExpired?: () => void;
  /** Manual reset trigger */
  reset?: boolean;
}

// ─── Question Timer Component ────────────────────────────────────────────────

export const QuestionTimer: React.FC<QuestionTimerProps> = ({
  timeLimit = QUESTION_TIME_LIMIT,
  onTimeExpired,
  reset = false,
}) => {
  const { colors } = useTheme();
  const [timeLeft, setTimeLeft] = React.useState(timeLimit);

  // Reanimated shared values
  const progress = useSharedValue(1);
  const scaleValue = useSharedValue(1);

  // Determine timer state
  const timerState = useMemo(() => {
    if (timeLeft <= 0) return 'expired';
    if (timeLeft <= CRITICAL_TIME_THRESHOLD) return 'critical';
    if (timeLeft <= WARNING_TIME_THRESHOLD) return 'warning';
    return 'normal';
  }, [timeLeft]);

  // Get colors based on state
  const timerColors = useMemo(() => {
    switch (timerState) {
      case 'expired':
        return {
          ring: colors.error,
          text: colors.error,
          background: withAlpha(colors.error, 0.12),
        };
      case 'critical':
        return {
          ring: colors.error,
          text: colors.error,
          background: withAlpha(colors.error, 0.12),
        };
      case 'warning':
        return {
          ring: colors.warning,
          text: colors.warning,
          background: withAlpha(colors.warning, 0.12),
        };
      default:
        return {
          ring: colors.primary,
          text: colors.primary,
          background: withAlpha(colors.primary, 0.08),
        };
    }
  }, [timerState, colors]);

  // Countdown effect
  useEffect(() => {
    if (reset) {
      setTimeLeft(timeLimit);
      progress.value = 1;
      scaleValue.value = 1;
      return;
    }

    if (timeLeft <= 0) {
      onTimeExpired?.();
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;

        // Haptic feedback at thresholds
        if (newTime === CRITICAL_TIME_THRESHOLD) {
          runOnJS(triggerHaptic)('warning');
        }
        if (newTime === 0) {
          runOnJS(triggerHaptic)('error');
          if (onTimeExpired) {
            runOnJS(onTimeExpired)();
          }
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, reset, timeLimit, onTimeExpired, progress, scaleValue]);

  // Animate progress ring
  useEffect(() => {
    const newProgress = Math.max(0, timeLeft) / timeLimit;
    progress.value = withTiming(newProgress, {
      duration: 900,
      easing: Easing.linear,
    });

    // Pulse animation on critical
    if (timerState === 'critical') {
      scaleValue.value = withSpring(1.08, {
        damping: 8,
        mass: 0.5,
        overshootClamping: true,
      });
    } else {
      scaleValue.value = withTiming(1, { duration: 300 });
    }
  }, [timeLeft, timerState, progress, scaleValue, timeLimit]);

  // Animated ring stroke
  const circumference = 2 * Math.PI * RING_RADIUS;

  const animatedRingProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  // Animated scale for pulse
  const animatedScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  // Format time display
  const displayTime = useMemo(() => {
    const seconds = Math.max(0, timeLeft);
    return `${seconds}s`;
  }, [timeLeft]);

  return (
    <View style={styles.container}>
      {/* Ring Progress */}
      <Animated.View style={[animatedScaleStyle, styles.ringWrapper]}>
        <Svg
          width={RING_RADIUS * 2 + RING_STROKE * 2}
          height={RING_RADIUS * 2 + RING_STROKE * 2}
          viewBox={`0 0 ${RING_RADIUS * 2 + RING_STROKE * 2} ${RING_RADIUS * 2 + RING_STROKE * 2}`}
        >
          {/* Background circle */}
          <Circle
            cx={RING_RADIUS + RING_STROKE}
            cy={RING_RADIUS + RING_STROKE}
            r={RING_RADIUS}
            stroke={withAlpha(timerColors.ring, 0.2)}
            strokeWidth={RING_STROKE}
            fill="none"
          />

          {/* Progress circle */}
          <AnimatedCircle
            cx={RING_RADIUS + RING_STROKE}
            cy={RING_RADIUS + RING_STROKE}
            r={RING_RADIUS}
            stroke={timerColors.ring}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            strokeLinecap="round"
            animatedProps={animatedRingProps}
          />
        </Svg>
      </Animated.View>

      {/* Center Time Display */}
      <View
        style={[
          styles.timeDisplay,
          {
            backgroundColor: timerColors.background,
            borderColor: timerColors.ring,
          },
        ]}
      >
        <Text
          style={[styles.timeText, { color: timerColors.text }]}
          accessibilityRole="timer"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${displayTime} remaining`}
        >
          {displayTime}
        </Text>
      </View>

      {/* Critical State Icon */}
      {timerState === 'critical' && (
        <View style={styles.criticalIcon}>
          <AlertCircle
            size={ICON_SIZE.xs}
            color={colors.error}
            strokeWidth={2}
          />
        </View>
      )}
    </View>
  );
};

/**
 * Compact Timer Badge - For header/status area
 * Shows time remaining without the large ring
 */
export const CompactQuestionTimer: React.FC<Omit<QuestionTimerProps, 'reset'>> = ({
  timeLimit = QUESTION_TIME_LIMIT,
  onTimeExpired,
}) => {
  const { colors } = useTheme();
  const [timeLeft, setTimeLeft] = React.useState(timeLimit);

  const timerState = useMemo(() => {
    if (timeLeft <= 0) return 'expired';
    if (timeLeft <= CRITICAL_TIME_THRESHOLD) return 'critical';
    if (timeLeft <= WARNING_TIME_THRESHOLD) return 'warning';
    return 'normal';
  }, [timeLeft]);

  const timerColors = useMemo(() => {
    switch (timerState) {
      case 'expired':
      case 'critical':
        return { text: colors.error, background: withAlpha(colors.error, 0.1) };
      case 'warning':
        return { text: colors.warning, background: withAlpha(colors.warning, 0.1) };
      default:
        return { text: colors.primary, background: withAlpha(colors.primary, 0.08) };
    }
  }, [timerState, colors]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeExpired?.();
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;
        if (newTime === CRITICAL_TIME_THRESHOLD) {
          triggerHaptic('warning');
        }
        if (newTime === 0) {
          triggerHaptic('error');
          onTimeExpired?.();
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, onTimeExpired]);

  const displayTime = `${Math.max(0, timeLeft)}s`;

  return (
    <View
      style={[
        styles.compactBadge,
        {
          backgroundColor: timerColors.background,
          borderColor: timerColors.text,
        },
      ]}
    >
      <Clock size={ICON_SIZE.xs} color={timerColors.text} strokeWidth={1.5} />
      <Text style={[styles.compactBadgeText, { color: timerColors.text }]}>
        {displayTime}
      </Text>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },

  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  timeDisplay: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDER_WIDTH.thin,
  },

  timeText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },

  criticalIcon: {
    position: 'absolute',
    right: -8,
    top: 0,
  },

  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: BORDER_WIDTH.thin,
  },

  compactBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: '600',
  },
});

export default QuestionTimer;
