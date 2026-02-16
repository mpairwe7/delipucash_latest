/**
 * Reward Session Summary Component — 2026 Redesign
 *
 * Premium session summary inspired by Duolingo, Kahoot & HQ Trivia.
 * - Animated SVG accuracy ring (Reanimated 4 + react-native-svg)
 * - Confetti burst on high scores (pure Reanimated particles)
 * - Performance-tier badge system (Bronze → Diamond)
 * - Staggered FadeInDown stat card reveals
 * - Full WCAG 2.2 AA accessibility (roles, labels, hints, live regions)
 * - Haptic punctuation per tier
 * - BlurView backdrop, bottom-sheet presentation
 * - Share-results action
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
import { REWARD_CONSTANTS } from '@/store/InstantRewardStore';
import { triggerHaptic } from '@/utils/quiz-utils';

// ─── Reanimated SVG wrapper ──────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RewardSessionSummaryProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Total number of questions in session */
  totalQuestions: number;
  /** Number of correct answers */
  correctAnswers: number;
  /** Number of incorrect answers */
  incorrectAnswers: number;
  /** Total amount earned in session (UGX) */
  totalEarned: number;
  /** Session-specific earnings breakdown (UGX) */
  sessionEarnings: number;
  /** Total wallet balance (UGX) */
  totalBalance: number;
  /** Whether user can redeem rewards */
  canRedeemRewards: boolean;
  /** Callback when user wants to redeem cash */
  onRedeemCash?: () => void;
  /** Callback when user wants to redeem airtime */
  onRedeemAirtime?: () => void;
  /** Callback when user wants to continue answering */
  onContinue?: () => void;
  /** Callback when user wants to close */
  onClose?: () => void;
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

  useEffect(() => {
    progress.value = withDelay(
      400,
      withTiming(accuracy / 100, { duration: 1200, easing: Easing.out(Easing.cubic) }),
    );
  }, [accuracy]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
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
        <Text style={[ringStyles.percentage, { color: tier.iconColor }]}>
          {accuracy}%
        </Text>
        <Text style={[ringStyles.label, { color: colors.textMuted }]}>Accuracy</Text>
      </View>
    </View>
  );
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

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
  delay: number;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, color, delay }) => {
  const { colors } = useTheme();
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
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={[statStyles.iconWrap, { backgroundColor: withAlpha(color, 0.12) }]}>
        {icon}
      </View>
      <Text style={[statStyles.value, { color: colors.text }]}>{value}</Text>
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
}) => {
  const { colors, isDark } = useTheme();
  const { height: screenHeight } = useWindowDimensions();

  const accuracy =
    totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  const tier = useMemo(() => getPerformanceTier(accuracy, isDark), [accuracy, isDark]);
  const showConfetti = accuracy >= 75;

  // Announce results to screen readers
  useEffect(() => {
    if (visible) {
      triggerHaptic(accuracy >= 75 ? 'success' : 'medium');
      const msg = `Session complete. ${correctAnswers} out of ${totalQuestions} correct, ${accuracy} percent accuracy. ${tier.label} tier. You earned ${totalEarned} Ugandan shillings.`;
      setTimeout(() => AccessibilityInfo.announceForAccessibility(msg), 600);
    }
  }, [visible]);

  const handleShare = useCallback(async () => {
    triggerHaptic('selection');
    try {
      await Share.share({
        message: `🏆 I scored ${accuracy}% (${tier.label} tier) on DelipuCash and earned ${formatCurrency(totalEarned)}! Download the app and start earning too!`,
      });
    } catch {
      // user cancelled
    }
  }, [accuracy, tier.label, totalEarned]);

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
                value={`${correctAnswers + incorrectAnswers}/${totalQuestions}`}
                label="Attempted"
                color={colors.info}
                delay={800}
              />
              <StatCard
                icon={<Zap size={ICON_SIZE.lg} color={colors.warning} strokeWidth={1.8} />}
                value={formatCurrency(totalEarned)}
                label="Earned"
                color={colors.warning}
                delay={900}
              />
            </View>

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
              </Animated.View>
            ) : (
              <Animated.View
                entering={FadeInDown.delay(1100).springify().damping(14)}
                style={[
                  styles.keepEarningCard,
                  {
                    backgroundColor: withAlpha(colors.warning, 0.08),
                    borderColor: withAlpha(colors.warning, 0.25),
                  },
                ]}
                accessible
                accessibilityRole="text"
                accessibilityLabel={`You need at least ${formatCurrency(
                  REWARD_CONSTANTS.MIN_REDEMPTION_POINTS * REWARD_CONSTANTS.POINTS_TO_UGX_RATE,
                )} to redeem`}
              >
                <TrendingUp size={ICON_SIZE.xl} color={colors.warning} strokeWidth={1.5} />
                <View style={styles.keepEarningContent}>
                  <Text style={[styles.keepEarningTitle, { color: colors.warning }]}>
                    Keep Earning!
                  </Text>
                  <Text style={[styles.keepEarningText, { color: colors.textMuted }]}>
                    Earn at least{' '}
                    {formatCurrency(
                      REWARD_CONSTANTS.MIN_REDEMPTION_POINTS * REWARD_CONSTANTS.POINTS_TO_UGX_RATE,
                    )}{' '}
                    to unlock redemption.
                  </Text>
                </View>
              </Animated.View>
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

  // Keep earning
  keepEarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
  },
  keepEarningContent: { flex: 1, gap: SPACING.xxs },
  keepEarningTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  keepEarningText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
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
