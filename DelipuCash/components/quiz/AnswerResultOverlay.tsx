/**
 * Answer Result Overlay — Duolingo/Kahoot-inspired post-answer celebration
 *
 * Appears as an absolute-positioned overlay (NOT a Modal) after submitting an answer.
 * - Correct: green gradient, animated checkmark, "+X UGX" count-up, streak badge, confetti
 * - Incorrect: red gradient, X icon, encouraging message
 * - Auto-dismisses after 1.8s or on tap
 * - WCAG 2.2 AA accessible
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, XCircle, Flame } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ICON_SIZE,
  Z_INDEX,
  withAlpha,
} from '@/utils/theme';
import { formatCurrency } from '@/services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnswerResultOverlayProps {
  visible: boolean;
  isCorrect: boolean;
  earnedAmount: number;
  streakCount: number;
  onDismiss: () => void;
}

// ─── Confetti Particle (lightweight, same pattern as RewardSessionSummary) ──

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

  const angle = (index / total) * 2 * Math.PI;
  const speed = 200 + Math.random() * 180;
  const dx = Math.cos(angle) * (30 + Math.random() * 60);

  useEffect(() => {
    const d = index * 20;
    scale.value = withDelay(d, withSpring(1, { damping: 5, stiffness: 200 }));
    y.value = withDelay(d, withTiming(-speed, { duration: 1000, easing: Easing.out(Easing.quad) }));
    x.value = withDelay(d, withTiming(dx, { duration: 1000, easing: Easing.out(Easing.quad) }));
    rotate.value = withDelay(
      d,
      withTiming(360 * (Math.random() > 0.5 ? 1 : -1), { duration: 1000 }),
    );
    opacity.value = withDelay(d + 600, withTiming(0, { duration: 400 }));
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

  const sz = 5 + Math.random() * 5;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: sz,
          height: sz,
          borderRadius: Math.random() > 0.5 ? sz / 2 : 2,
          backgroundColor: color,
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
};

// ─── Animated Count-Up Text ──────────────────────────────────────────────────

const AnimatedEarnings: React.FC<{ amount: number; color: string }> = ({ amount, color }) => {
  const animatedValue = useSharedValue(0);
  const translateY = useSharedValue(16);
  const opacity = useSharedValue(0);
  const [displayText, setDisplayText] = React.useState('+0');

  useEffect(() => {
    opacity.value = withDelay(200, withTiming(1, { duration: 200 }));
    translateY.value = withDelay(200, withSpring(-4, { damping: 14, stiffness: 140 }));
    animatedValue.value = withDelay(
      300,
      withTiming(amount, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [amount]);

  useDerivedValue(() => {
    const rounded = Math.round(animatedValue.value);
    runOnJS(setDisplayText)(`+${formatCurrency(rounded)}`);
    return rounded;
  });

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={style}>
      <Text style={[styles.earningsText, { color }]}>{displayText}</Text>
    </Animated.View>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const AnswerResultOverlay: React.FC<AnswerResultOverlayProps> = ({
  visible,
  isCorrect,
  earnedAmount,
  streakCount,
  onDismiss,
}) => {
  const { colors } = useTheme();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 16, stiffness: 160 });
      opacity.value = withTiming(1, { duration: 220 });

      // Announce to screen readers
      const msg = isCorrect
        ? `Correct! You earned ${earnedAmount} Ugandan shillings.${streakCount >= 2 ? ` ${streakCount} answer streak!` : ''}`
        : 'Incorrect answer. Keep going!';
      setTimeout(() => AccessibilityInfo.announceForAccessibility(msg), 300);

      // Auto-dismiss after 1.8s
      timerRef.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 180 });
        setTimeout(onDismiss, 200);
      }, 1800);
    } else {
      translateY.value = -80;
      opacity.value = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, isCorrect, earnedAmount, streakCount, onDismiss]);

  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handleTap = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    opacity.value = withTiming(0, { duration: 150 });
    setTimeout(onDismiss, 170);
  };

  if (!visible) return null;

  const gradientColors: [string, string] = isCorrect
    ? [withAlpha(colors.success, 0.96), withAlpha(colors.success, 0.88)]
    : [withAlpha(colors.error, 0.92), withAlpha(colors.error, 0.84)];

  const confettiColors = [
    colors.success,
    colors.primary,
    colors.warning,
    '#A78BFA',
    '#38BDF8',
    '#FF6B6B',
  ];

  return (
    <Animated.View
      style={[styles.container, overlayStyle]}
      pointerEvents="box-none"
    >
      <Pressable
        style={styles.pressable}
        onPress={handleTap}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        accessibilityLabel={
          isCorrect
            ? `Correct! Earned ${formatCurrency(earnedAmount)}`
            : 'Incorrect answer'
        }
        accessibilityHint="Tap to continue"
      >
        <LinearGradient
          colors={gradientColors}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Confetti burst for correct answers */}
          {isCorrect && (
            <View style={styles.confettiContainer} pointerEvents="none">
              {Array.from({ length: 16 }).map((_, i) => (
                <ConfettiParticle
                  key={i}
                  index={i}
                  total={16}
                  color={confettiColors[i % confettiColors.length]}
                />
              ))}
            </View>
          )}

          {/* Icon */}
          <View style={styles.iconContainer}>
            {isCorrect ? (
              <CheckCircle2 size={56} color="#fff" strokeWidth={1.5} />
            ) : (
              <XCircle size={56} color="#fff" strokeWidth={1.5} />
            )}
          </View>

          {/* Heading */}
          <Text style={styles.heading}>
            {isCorrect ? 'Correct!' : 'Not quite!'}
          </Text>

          {/* Earnings count-up (correct only) */}
          {isCorrect && earnedAmount > 0 && (
            <AnimatedEarnings amount={earnedAmount} color="#fff" />
          )}

          {/* Streak badge */}
          {isCorrect && streakCount >= 2 && (
            <View style={styles.streakBadge}>
              <Flame size={ICON_SIZE.base} color="#FFAB00" strokeWidth={2} />
              <Text style={styles.streakText}>
                {streakCount}x Streak!
              </Text>
            </View>
          )}

          {/* Encouraging message (incorrect only) */}
          {!isCorrect && (
            <Text style={styles.encourageText}>
              Keep going — every attempt counts!
            </Text>
          )}

          {/* Tap hint */}
          <Text style={styles.tapHint}>
            Tap to continue
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: Z_INDEX.modal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressable: {
    flex: 1,
    width: '100%',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  iconContainer: {
    marginBottom: SPACING.xs,
  },
  heading: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    color: '#fff',
    textAlign: 'center',
  },
  earningsText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    textAlign: 'center',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  streakText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: '#FFAB00',
  },
  encourageText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  tapHint: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    position: 'absolute',
    bottom: SPACING['3xl'],
  },
});

export default AnswerResultOverlay;
