/**
 * Reward Session Summary Component — 2026 Enhanced
 *
 * Premium session summary inspired by Duolingo, Kahoot, Cash App & HQ Trivia.
 * Enhancements over previous version:
 * - Animated count-up numbers (accuracy %, earnings, stat values)
 * - Streak celebration card when maxStreak >= 3
 * - Animated redemption progress bar with milestone markers
 * - Next-milestone indicator to keep users earning
 * - Quick-redeem shortcut for repeat redeemers
 * - Full WCAG 2.2 AA accessibility
 * - Haptic punctuation per tier
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  AccessibilityInfo,
  Share,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInDown,
  useDerivedValue,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CheckCircle2,
  XCircle,
  Target,
  Zap,
  Gift,
  ChevronRight,
  Banknote,
  Smartphone,
  TrendingUp,
  Share2,
  Sparkles,
  Flame,
  Timer,
  Trophy,
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
import { REWARD_CONSTANTS, type PaymentProvider } from '@/store/InstantRewardStore';
import { triggerHaptic } from '@/utils/quiz-utils';

// ─── Reanimated SVG wrapper ──────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedText = Animated.createAnimatedComponent(Text);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RewardSessionSummaryProps {
  visible: boolean;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  totalEarned: number;
  sessionEarnings: number;
  totalBalance: number;
  canRedeemRewards: boolean;
  onRedeemCash?: () => void;
  onRedeemAirtime?: () => void;
  onContinue?: () => void;
  onClose?: () => void;
  /** Best streak in this session (shows streak card when >= 3) */
  maxStreak?: number;
  /** Bonus points earned from streaks */
  bonusPoints?: number;
  /** Average time per question in seconds */
  averageTime?: number;
  /** Last successful redemption for quick-redeem shortcut */
  lastRedemption?: { provider: PaymentProvider; phoneNumber: string } | null;
  /** Quick-redeem handler — bypasses the full wizard */
  onQuickRedeem?: (provider: PaymentProvider, phoneNumber: string) => void;
}

// ─── Performance-tier system ─────────────────────────────────────────────────

interface PerformanceTier {
  label: string;
  emoji: string;
  message: string;
  gradient: [string, string];
  iconColor: string;
}

function getPerformanceTier(accuracy: number, isDark: boolean): PerformanceTier {
  if (accuracy >= 90) {
    return {
      label: 'Diamond',
      emoji: '💎',
      message: 'Legendary performance!',
      gradient: isDark ? ['#1a1a3e', '#2d2d6b'] : ['#E8EAF6', '#C5CAE9'],
      iconColor: '#7C4DFF',
    };
  }
  if (accuracy >= 75) {
    return {
      label: 'Gold',
      emoji: '🏆',
      message: 'Outstanding!',
      gradient: isDark ? ['#3e2f1a', '#5a4420'] : ['#FFF8E1', '#FFE082'],
      iconColor: '#FFB300',
    };
  }
  if (accuracy >= 50) {
    return {
      label: 'Silver',
      emoji: '🥈',
      message: 'Great job!',
      gradient: isDark ? ['#2a2a2a', '#3a3a3a'] : ['#F5F5F5', '#E0E0E0'],
      iconColor: '#78909C',
    };
  }
  return {
    label: 'Bronze',
    emoji: '🥉',
    message: 'Keep practicing!',
    gradient: isDark ? ['#2e2218', '#3d2e20'] : ['#FFF3E0', '#FFE0B2'],
    iconColor: '#BF8040',
  };
}

// ─── useCountUp — Animated number hook ───────────────────────────────────────

function useCountUp(target: number, delay: number = 0, duration: number = 900) {
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withDelay(
      delay,
      withTiming(target, { duration, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, delay, duration]);

  const display = useDerivedValue(() => Math.round(value.value));
  return display;
}

// ─── Animated Accuracy Ring ──────────────────────────────────────────────────

interface AccuracyRingProps {
  accuracy: number;
  tier: PerformanceTier;
  size?: number;
}

const RING_STROKE = 10;

const AccuracyRing: React.FC<AccuracyRingProps> = ({ accuracy, tier, size = 140 }) => {
  const { colors } = useTheme();
  const radius = (size - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useSharedValue(0);
  const displayValue = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      400,
      withTiming(accuracy / 100, { duration: 1200, easing: Easing.out(Easing.cubic) }),
    );
    displayValue.value = withDelay(
      400,
      withTiming(accuracy, { duration: 1200, easing: Easing.out(Easing.cubic) }),
    );
  }, [accuracy]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const percentText = useDerivedValue(() => `${Math.round(displayValue.value)}%`);

  const percentStyle = useAnimatedStyle(() => ({
    // Force re-render as value changes
    opacity: 1,
  }));

  return (
    <View
      style={[ringStyles.container, { width: size, height: size }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Accuracy ${accuracy} percent`}
      accessibilityValue={{ min: 0, max: 100, now: accuracy }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={withAlpha(colors.border, 0.3)}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={tier.iconColor}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={ringStyles.center}>
        <AnimatedCountDisplay
          value={displayValue}
          suffix="%"
          style={[ringStyles.percentage, { color: tier.iconColor }]}
        />
        <Text style={[ringStyles.label, { color: colors.textMuted }]}>Accuracy</Text>
      </View>
    </View>
  );
};

// ─── AnimatedCountDisplay — renders a count-up number ────────────────────────

const AnimatedCountDisplay: React.FC<{
  value: SharedValue<number>;
  suffix?: string;
  prefix?: string;
  style?: any;
  formatFn?: (n: number) => string;
}> = ({ value, suffix = '', prefix = '', style, formatFn }) => {
  const [displayText, setDisplayText] = React.useState(`${prefix}0${suffix}`);

  useDerivedValue(() => {
    const rounded = Math.round(value.value);
    const formatted = formatFn ? formatFn(rounded) : `${rounded}`;
    runOnJS(setDisplayText)(`${prefix}${formatted}${suffix}`);
    return rounded;
  });

  return <Text style={style}>{displayText}</Text>;
};

const ringStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentage: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['4xl'],
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: -2,
  },
});

// ─── Confetti Particles ──────────────────────────────────────────────────────

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
  const speed = 300 + Math.random() * 200;
  const dx = Math.cos(angle) * (40 + Math.random() * 80);

  useEffect(() => {
    const d = index * 30;
    scale.value = withDelay(d, withSpring(1, { damping: 4, stiffness: 200 }));
    y.value = withDelay(d, withTiming(-speed, { duration: 1400, easing: Easing.out(Easing.quad) }));
    x.value = withDelay(d, withTiming(dx, { duration: 1400, easing: Easing.out(Easing.quad) }));
    rotate.value = withDelay(
      d,
      withTiming(360 * (Math.random() > 0.5 ? 1 : -1), { duration: 1400 }),
    );
    opacity.value = withDelay(d + 800, withTiming(0, { duration: 600 }));
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

  const sz = 6 + Math.random() * 6;
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

const Confetti: React.FC<{ count?: number; particleColors: string[] }> = ({
  count = 24,
  particleColors,
}) => (
  <View style={confettiStyles.container} pointerEvents="none" importantForAccessibility="no">
    {Array.from({ length: count }).map((_, i) => (
      <ConfettiParticle
        key={i}
        index={i}
        total={count}
        color={particleColors[i % particleColors.length]}
      />
    ))}
  </View>
);

const confettiStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});

// ─── Stat Card with Count-Up ─────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  delay: number;
  suffix?: string;
  formatFn?: (n: number) => string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, color, delay, suffix, formatFn }) => {
  const { colors } = useTheme();
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withDelay(
      delay,
      withTiming(value, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );
  }, [value, delay]);

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify().damping(14)}
      style={[
        statStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: withAlpha(color, 0.2),
          borderWidth: BORDER_WIDTH.thin,
        },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${formatFn ? formatFn(value) : value}${suffix || ''}`}
    >
      <View style={[statStyles.iconWrap, { backgroundColor: withAlpha(color, 0.12) }]}>
        {icon}
      </View>
      <AnimatedCountDisplay
        value={animatedValue}
        suffix={suffix}
        style={[statStyles.value, { color: colors.text }]}
        formatFn={formatFn}
      />
      <Text style={[statStyles.label, { color: colors.textMuted }]}>{label}</Text>
    </Animated.View>
  );
};

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

// ─── Streak Celebration Card ─────────────────────────────────────────────────

interface StreakCardProps {
  streak: number;
  bonusPoints: number;
  tierColor: string;
  delay: number;
}

const StreakCard: React.FC<StreakCardProps> = ({ streak, bonusPoints, tierColor, delay }) => {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify().damping(14)}
      style={[
        streakStyles.card,
        {
          backgroundColor: withAlpha(tierColor, 0.08),
          borderColor: withAlpha(tierColor, 0.25),
        },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${streak} answer streak! Bonus ${bonusPoints} points earned`}
    >
      <View style={[streakStyles.iconWrap, { backgroundColor: withAlpha(tierColor, 0.15) }]}>
        <Flame size={ICON_SIZE.xl} color={tierColor} strokeWidth={1.5} />
      </View>
      <View style={streakStyles.content}>
        <View style={streakStyles.row}>
          <Text style={[streakStyles.streakCount, { color: tierColor }]}>
            {streak}x Streak!
          </Text>
          {bonusPoints > 0 && (
            <View style={[streakStyles.bonusBadge, { backgroundColor: withAlpha(tierColor, 0.15) }]}>
              <Text style={[streakStyles.bonusText, { color: tierColor }]}>
                +{bonusPoints} bonus pts
              </Text>
            </View>
          )}
        </View>
        <Text style={[streakStyles.subtext, { color: colors.textMuted }]}>
          {streak >= 10
            ? 'Incredible focus!'
            : streak >= 5
              ? 'You were on fire!'
              : 'Nice streak going!'}
        </Text>
      </View>
    </Animated.View>
  );
};

const streakStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, gap: SPACING.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  streakCount: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  bonusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  bonusText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  subtext: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

// ─── Redemption Progress Bar ─────────────────────────────────────────────────

interface RedemptionProgressBarProps {
  currentBalance: number;
  delay: number;
}

const RedemptionProgressBar: React.FC<RedemptionProgressBarProps> = ({ currentBalance, delay }) => {
  const { colors } = useTheme();
  const minCash = REWARD_CONSTANTS.MIN_REDEMPTION_POINTS * REWARD_CONSTANTS.POINTS_TO_UGX_RATE;
  const progress = Math.min(currentBalance / minCash, 1);
  const currentPts = Math.floor(currentBalance / REWARD_CONSTANTS.POINTS_TO_UGX_RATE);

  const barWidth = useSharedValue(0);
  useEffect(() => {
    barWidth.value = withDelay(
      delay + 200,
      withTiming(progress, { duration: 1000, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, delay]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as any,
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify().damping(14)}
      style={[
        progressStyles.card,
        {
          backgroundColor: withAlpha(colors.warning, 0.08),
          borderColor: withAlpha(colors.warning, 0.25),
        },
      ]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${currentPts} of ${REWARD_CONSTANTS.MIN_REDEMPTION_POINTS} points toward redemption`}
      accessibilityValue={{ min: 0, max: REWARD_CONSTANTS.MIN_REDEMPTION_POINTS, now: currentPts }}
    >
      <View style={progressStyles.header}>
        <TrendingUp size={ICON_SIZE.base} color={colors.warning} strokeWidth={1.8} />
        <Text style={[progressStyles.title, { color: colors.warning }]}>
          Keep Earning!
        </Text>
      </View>

      <Text style={[progressStyles.subtitle, { color: colors.textMuted }]}>
        {formatCurrency(minCash - currentBalance)} more to unlock redemption
      </Text>

      {/* Progress track */}
      <View style={[progressStyles.track, { backgroundColor: withAlpha(colors.warning, 0.15) }]}>
        <Animated.View
          style={[
            progressStyles.fill,
            { backgroundColor: colors.warning },
            barStyle,
          ]}
        />
        {/* Milestone markers */}
        {REWARD_CONSTANTS.REDEMPTION_OPTIONS.map((opt) => {
          const pos = (opt.points / REWARD_CONSTANTS.REDEMPTION_OPTIONS[REWARD_CONSTANTS.REDEMPTION_OPTIONS.length - 1].points) * 100;
          return (
            <View
              key={opt.points}
              style={[
                progressStyles.marker,
                {
                  left: `${pos}%` as any,
                  backgroundColor: currentPts >= opt.points ? colors.warning : withAlpha(colors.warning, 0.3),
                },
              ]}
            />
          );
        })}
      </View>

      <View style={progressStyles.progressLabels}>
        <Text style={[progressStyles.progressPts, { color: colors.text }]}>
          {currentPts} pts
        </Text>
        <Text style={[progressStyles.progressTarget, { color: colors.textMuted }]}>
          {REWARD_CONSTANTS.MIN_REDEMPTION_POINTS} pts
        </Text>
      </View>
    </Animated.View>
  );
};

const progressStyles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: -SPACING.xxs,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: SPACING.xs,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  marker: {
    position: 'absolute',
    top: -2,
    width: 4,
    height: 12,
    borderRadius: 2,
    marginLeft: -2,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPts: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  progressTarget: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

// ─── Next Milestone Indicator ────────────────────────────────────────────────

interface NextMilestoneProps {
  currentBalance: number;
}

const NextMilestone: React.FC<NextMilestoneProps> = ({ currentBalance }) => {
  const { colors } = useTheme();
  const currentPts = Math.floor(currentBalance / REWARD_CONSTANTS.POINTS_TO_UGX_RATE);

  const nextTier = REWARD_CONSTANTS.REDEMPTION_OPTIONS.find((opt) => opt.points > currentPts);
  if (!nextTier) return null; // Already at max tier

  const remaining = nextTier.points - currentPts;

  return (
    <View
      style={[
        milestoneStyles.container,
        { backgroundColor: withAlpha(colors.primary, 0.06), borderColor: withAlpha(colors.primary, 0.2) },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Next milestone: ${nextTier.points} points for ${formatCurrency(nextTier.cashValue)}`}
    >
      <Trophy size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.8} />
      <Text style={[milestoneStyles.text, { color: colors.textMuted }]}>
        <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.bold, color: colors.primary }}>
          {remaining} more pts{' '}
        </Text>
        to unlock {formatCurrency(nextTier.cashValue)} redemption
      </Text>
    </View>
  );
};

const milestoneStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.base,
    borderWidth: BORDER_WIDTH.thin,
  },
  text: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
  },
});

// ─── Quick Redeem Pill ───────────────────────────────────────────────────────

interface QuickRedeemProps {
  provider: PaymentProvider;
  phoneNumber: string;
  onPress: () => void;
}

const QuickRedeem: React.FC<QuickRedeemProps> = ({ provider, phoneNumber, onPress }) => {
  const { colors } = useTheme();
  const masked = phoneNumber.length > 4
    ? `${phoneNumber.slice(0, 3)}...${phoneNumber.slice(-2)}`
    : phoneNumber;
  const providerColor = provider === 'MTN' ? '#FFCC00' : '#FF0000';

  return (
    <TouchableOpacity
      style={[
        quickRedeemStyles.pill,
        {
          backgroundColor: withAlpha(providerColor, 0.1),
          borderColor: withAlpha(providerColor, 0.3),
        },
      ]}
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Quick redeem to ${provider} ${phoneNumber}`}
      accessibilityHint="Redeem instantly using your last payment details"
    >
      <Zap size={ICON_SIZE.sm} color={providerColor} strokeWidth={2} />
      <Text style={[quickRedeemStyles.text, { color: colors.text }]}>
        Quick Redeem to{' '}
        <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.bold, color: providerColor }}>
          {provider}
        </Text>{' '}
        {masked}
      </Text>
      <ChevronRight size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={1.5} />
    </TouchableOpacity>
  );
};

const quickRedeemStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: BORDER_WIDTH.thin,
  },
  text: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

// ─── Main Component ──────────────────────────────────────────────────────────

export const RewardSessionSummary: React.FC<RewardSessionSummaryProps> = ({
  visible,
  totalQuestions,
  correctAnswers,
  incorrectAnswers,
  totalEarned,
  sessionEarnings,
  totalBalance,
  canRedeemRewards,
  onRedeemCash,
  onRedeemAirtime,
  onContinue,
  onClose,
  maxStreak,
  bonusPoints,
  averageTime,
  lastRedemption,
  onQuickRedeem,
}) => {
  const { colors, isDark } = useTheme();
  const { height: screenHeight } = useWindowDimensions();

  const accuracy =
    totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  const tier = useMemo(() => getPerformanceTier(accuracy, isDark), [accuracy, isDark]);
  const showConfetti = accuracy >= 75;
  const showStreak = (maxStreak ?? 0) >= 3;

  // Announce results to screen readers
  useEffect(() => {
    if (visible) {
      triggerHaptic(accuracy >= 75 ? 'success' : 'medium');
      let msg = `Session complete. ${correctAnswers} out of ${totalQuestions} correct, ${accuracy} percent accuracy. ${tier.label} tier. You earned ${totalEarned} Ugandan shillings.`;
      if (showStreak) {
        msg += ` Best streak: ${maxStreak} in a row.`;
      }
      setTimeout(() => AccessibilityInfo.announceForAccessibility(msg), 600);
    }
  }, [visible]);

  const handleShare = useCallback(async () => {
    triggerHaptic('selection');
    try {
      let shareMsg = `🏆 I scored ${accuracy}% (${tier.label} tier) on DelipuCash and earned ${formatCurrency(totalEarned)}!`;
      if (showStreak) {
        shareMsg += ` 🔥 ${maxStreak}x streak!`;
      }
      shareMsg += ' Download the app and start earning too!';
      await Share.share({ message: shareMsg });
    } catch {
      // user cancelled
    }
  }, [accuracy, tier.label, totalEarned, maxStreak, showStreak]);

  const handleQuickRedeem = useCallback(() => {
    if (lastRedemption && onQuickRedeem) {
      onQuickRedeem(lastRedemption.provider, lastRedemption.phoneNumber);
    }
  }, [lastRedemption, onQuickRedeem]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <BlurView
        intensity={isDark ? 50 : 70}
        tint={isDark ? 'dark' : 'light'}
        style={styles.overlay}
      >
        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(120)}
          style={[
            styles.sheet,
            { backgroundColor: colors.background, maxHeight: screenHeight * 0.92 },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {/* Drag indicator */}
          <View style={[styles.dragIndicator, { backgroundColor: colors.border }]} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* ── Hero ────────────────────────────────────────── */}
            <Animated.View entering={FadeIn.delay(200).duration(500)}>
              <LinearGradient
                colors={tier.gradient as [string, string]}
                style={styles.heroSection}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {showConfetti && (
                  <Confetti
                    particleColors={[
                      colors.primary,
                      colors.success,
                      colors.warning,
                      '#FF6B6B',
                      '#A78BFA',
                      '#38BDF8',
                    ]}
                  />
                )}

                <Animated.View
                  entering={FadeInDown.delay(300).springify().damping(10)}
                  style={[
                    styles.tierBadge,
                    { backgroundColor: withAlpha(tier.iconColor, 0.15) },
                  ]}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`${tier.label} tier badge`}
                >
                  <Text style={styles.tierEmoji}>{tier.emoji}</Text>
                  <Text style={[styles.tierLabel, { color: tier.iconColor }]}>
                    {tier.label}
                  </Text>
                </Animated.View>

                <AccuracyRing accuracy={accuracy} tier={tier} />

                <Animated.View entering={FadeInUp.delay(500).duration(400)}>
                  <Text style={[styles.heroTitle, { color: colors.text }]}>
                    Session Complete!
                  </Text>
                  <Text style={[styles.heroMessage, { color: tier.iconColor }]}>
                    {tier.message}
                  </Text>
                </Animated.View>
              </LinearGradient>
            </Animated.View>

            {/* ── Stats Grid ──────────────────────────────────── */}
            <View style={styles.statsGrid}>
              <StatCard
                icon={<CheckCircle2 size={ICON_SIZE.lg} color={colors.success} strokeWidth={1.8} />}
                value={correctAnswers}
                label="Correct"
                color={colors.success}
                delay={600}
              />
              <StatCard
                icon={<XCircle size={ICON_SIZE.lg} color={colors.error} strokeWidth={1.8} />}
                value={incorrectAnswers}
                label="Incorrect"
                color={colors.error}
                delay={700}
              />
              <StatCard
                icon={<Target size={ICON_SIZE.lg} color={colors.info} strokeWidth={1.8} />}
                value={correctAnswers + incorrectAnswers}
                label="Attempted"
                color={colors.info}
                delay={800}
                suffix={`/${totalQuestions}`}
              />
              <StatCard
                icon={<Zap size={ICON_SIZE.lg} color={colors.warning} strokeWidth={1.8} />}
                value={totalEarned}
                label="Earned"
                color={colors.warning}
                delay={900}
                formatFn={(n) => formatCurrency(n)}
              />
            </View>

            {/* ── Streak Celebration ──────────────────────────── */}
            {showStreak && (
              <StreakCard
                streak={maxStreak!}
                bonusPoints={bonusPoints ?? 0}
                tierColor={tier.iconColor}
                delay={950}
              />
            )}

            {/* ── Earnings Breakdown ──────────────────────────── */}
            <Animated.View
              entering={FadeInDown.delay(1000).springify().damping(14)}
              style={[
                styles.earningsCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={`Session earnings ${formatCurrency(sessionEarnings)}, total balance ${formatCurrency(totalBalance)}`}
            >
              <View style={styles.earningsHeader}>
                <Sparkles size={ICON_SIZE.base} color={colors.primary} strokeWidth={1.8} />
                <Text style={[styles.earningsTitle, { color: colors.text }]}>Earnings</Text>
              </View>

              <View style={styles.earningsRows}>
                <View style={styles.earningsRow}>
                  <Text style={[styles.earningsLabel, { color: colors.textMuted }]}>
                    This Session
                  </Text>
                  <Text style={[styles.earningsValuePositive, { color: colors.success }]}>
                    +{formatCurrency(sessionEarnings)}
                  </Text>
                </View>

                {(bonusPoints ?? 0) > 0 && (
                  <>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <View style={styles.earningsRow}>
                      <Text style={[styles.earningsLabel, { color: colors.textMuted }]}>
                        Streak Bonus
                      </Text>
                      <Text style={[styles.earningsValuePositive, { color: tier.iconColor }]}>
                        +{bonusPoints} pts
                      </Text>
                    </View>
                  </>
                )}

                {averageTime != null && averageTime > 0 && (
                  <>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <View style={styles.earningsRow}>
                      <Text style={[styles.earningsLabel, { color: colors.textMuted }]}>
                        Avg. Time
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Timer size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={1.5} />
                        <Text style={[styles.earningsLabel, { color: colors.text, fontFamily: TYPOGRAPHY.fontFamily.bold }]}>
                          {averageTime}s
                        </Text>
                      </View>
                    </View>
                  </>
                )}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.earningsRow}>
                  <Text style={[styles.totalLabel, { color: colors.text }]}>Total Balance</Text>
                  <View style={styles.totalCol}>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatCurrency(totalBalance)}
                    </Text>
                    <Text style={[styles.pointsEquiv, { color: colors.textMuted }]}>
                      ≈ {Math.floor(totalBalance / REWARD_CONSTANTS.POINTS_TO_UGX_RATE)} pts
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* ── Redemption CTA ──────────────────────────────── */}
            {canRedeemRewards ? (
              <Animated.View
                entering={FadeInDown.delay(1100).springify().damping(14)}
                style={[
                  styles.redeemCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.redeemHeader}>
                  <Gift size={ICON_SIZE.base} color={colors.success} strokeWidth={1.8} />
                  <Text style={[styles.redeemTitle, { color: colors.text }]}>
                    Redeem Rewards
                  </Text>
                </View>
                <Text style={[styles.redeemSubtitle, { color: colors.textMuted }]}>
                  Convert your earnings to cash or airtime
                </Text>

                {/* Quick Redeem shortcut */}
                {lastRedemption && onQuickRedeem && (
                  <QuickRedeem
                    provider={lastRedemption.provider}
                    phoneNumber={lastRedemption.phoneNumber}
                    onPress={handleQuickRedeem}
                  />
                )}

                <View style={styles.redeemOptions}>
                  <TouchableOpacity
                    style={[
                      styles.redeemOption,
                      {
                        backgroundColor: withAlpha(colors.success, 0.08),
                        borderColor: withAlpha(colors.success, 0.3),
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      onRedeemCash?.();
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Redeem as cash via mobile money"
                    accessibilityHint="Opens the cash redemption flow"
                  >
                    <View
                      style={[
                        styles.redeemIconWrap,
                        { backgroundColor: withAlpha(colors.success, 0.15) },
                      ]}
                    >
                      <Banknote size={ICON_SIZE.xl} color={colors.success} strokeWidth={1.5} />
                    </View>
                    <View style={styles.redeemOptionText}>
                      <Text style={[styles.redeemOptionLabel, { color: colors.text }]}>
                        Mobile Money
                      </Text>
                      <Text style={[styles.redeemOptionDesc, { color: colors.textMuted }]}>
                        Withdraw to your account
                      </Text>
                    </View>
                    <ChevronRight size={ICON_SIZE.md} color={colors.textMuted} strokeWidth={1.5} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.redeemOption,
                      {
                        backgroundColor: withAlpha(colors.info, 0.08),
                        borderColor: withAlpha(colors.info, 0.3),
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      onRedeemAirtime?.();
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Redeem as airtime top-up"
                    accessibilityHint="Opens the airtime redemption flow"
                  >
                    <View
                      style={[
                        styles.redeemIconWrap,
                        { backgroundColor: withAlpha(colors.info, 0.15) },
                      ]}
                    >
                      <Smartphone size={ICON_SIZE.xl} color={colors.info} strokeWidth={1.5} />
                    </View>
                    <View style={styles.redeemOptionText}>
                      <Text style={[styles.redeemOptionLabel, { color: colors.text }]}>
                        Airtime
                      </Text>
                      <Text style={[styles.redeemOptionDesc, { color: colors.textMuted }]}>
                        Instant phone top-up
                      </Text>
                    </View>
                    <ChevronRight size={ICON_SIZE.md} color={colors.textMuted} strokeWidth={1.5} />
                  </TouchableOpacity>
                </View>

                {/* Next milestone motivator */}
                <NextMilestone currentBalance={totalBalance} />
              </Animated.View>
            ) : (
              <RedemptionProgressBar currentBalance={totalBalance} delay={1100} />
            )}

            {/* ── Actions ─────────────────────────────────────── */}
            <Animated.View
              entering={FadeInDown.delay(1200).springify().damping(14)}
              style={styles.actions}
            >
              <PrimaryButton
                title="Continue Answering"
                onPress={() => {
                  triggerHaptic('selection');
                  onContinue?.();
                }}
                variant="primary"
              />

              <View style={styles.secondaryRow}>
                <TouchableOpacity
                  style={[
                    styles.secondaryBtn,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={handleShare}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Share your quiz results"
                >
                  <Share2 size={ICON_SIZE.md} color={colors.primary} strokeWidth={1.5} />
                  <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.secondaryBtn,
                    { backgroundColor: colors.card, borderColor: colors.border, flex: 1 },
                  ]}
                  onPress={() => {
                    triggerHaptic('light');
                    onClose?.();
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Close session summary"
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
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
    marginBottom: SPACING.xs,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
    gap: SPACING.lg,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    gap: SPACING.md,
    overflow: 'hidden',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  tierEmoji: { fontSize: TYPOGRAPHY.fontSize.lg },
  tierLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    textAlign: 'center',
  },
  heroMessage: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: 'center',
    marginTop: -SPACING.xs,
  },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },

  // Earnings
  earningsCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
  },
  earningsHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  earningsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  earningsRows: { gap: SPACING.sm },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  earningsValuePositive: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: SPACING.xs },
  totalLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  totalCol: { alignItems: 'flex-end' },
  totalValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  pointsEquiv: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Redeem
  redeemCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
  },
  redeemHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  redeemTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  redeemSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: -SPACING.xs,
  },
  redeemOptions: { gap: SPACING.sm },
  redeemOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  redeemIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemOptionText: { flex: 1, gap: 2 },
  redeemOptionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  redeemOptionDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Actions
  actions: { gap: SPACING.md, marginTop: SPACING.sm },
  secondaryRow: { flexDirection: 'row', gap: SPACING.sm },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.base,
    borderWidth: BORDER_WIDTH.thin,
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  secondaryBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});

export default RewardSessionSummary;
