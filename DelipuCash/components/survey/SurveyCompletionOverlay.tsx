/**
 * SurveyCompletionOverlay — Post-survey celebration + smart next-action screen
 *
 * Replaces the minimal success state with a rich, engaging overlay inspired by
 * Google Opinion Rewards, Duolingo, and Cash App:
 * - Confetti celebration (deterministic, seeded particles)
 * - Animated count-up earnings display
 * - Wallet balance + progress toward minimum withdrawal
 * - Smart CTAs: Withdraw Cash / Next Survey / Back to Surveys
 * - Inline next-survey preview card
 * - WCAG 2.2 AA accessible, reduced-motion aware
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  TrendingUp,
  Wallet,
} from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';

import { PrimaryButton } from '@/components';
import { formatCurrency } from '@/services/api';
import { queryKeys, useRunningSurveys } from '@/services/hooks';
import useUser from '@/utils/useUser';
import { useReducedMotion, announce, formatMoneyForAccessibility } from '@/utils/accessibility';
import {
  BORDER_WIDTH,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
} from '@/utils/theme';
import { useSurveyAttemptStore } from '@/store/SurveyAttemptStore';

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_WITHDRAWAL_UGX = 1000;
const CONFETTI_COUNT = 24;
const CONFETTI_COLORS = [
  '#10B981', // success green
  '#3B82F6', // primary blue
  '#F59E0B', // warning amber
  '#A78BFA', // purple
  '#38BDF8', // sky blue
  '#FF6B6B', // coral
];

// ============================================================================
// TYPES
// ============================================================================

export interface SurveyCompletionOverlayProps {
  visible: boolean;
  earnedAmount: number;
  payoutInitiated: boolean;
  completedSurveyId: string;
  onBackToSurveys: () => void;
}

// ============================================================================
// CONFETTI PARTICLE (deterministic, same pattern as AnswerResultOverlay)
// ============================================================================

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
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

  const seed = useMemo(() => {
    const r1 = seededRandom(index * 9301 + 49297);
    const r2 = seededRandom(index * 7919 + 31337);
    const r3 = seededRandom(index * 6571 + 17389);
    const r4 = seededRandom(index * 4231 + 21013);
    const ang = (index / total) * 2 * Math.PI;
    const spd = 220 + r1 * 200;
    const dxVal = Math.cos(ang) * (40 + r2 * 80);
    const size = 5 + r3 * 6;
    return {
      speed: spd,
      dx: dxVal,
      sz: size,
      borderRadius: r4 > 0.5 ? size / 2 : 2,
      rotDir: r1 > 0.5 ? 1 : -1,
    };
  }, [index, total]);

  useEffect(() => {
    const d = index * 15;
    scale.value = withDelay(d, withSpring(1, { damping: 5, stiffness: 200 }));
    y.value = withDelay(d, withTiming(-seed.speed, { duration: 1200, easing: Easing.out(Easing.quad) }));
    x.value = withDelay(d, withTiming(seed.dx, { duration: 1200, easing: Easing.out(Easing.quad) }));
    rotate.value = withDelay(d, withTiming(360 * seed.rotDir, { duration: 1200 }));
    opacity.value = withDelay(d + 800, withTiming(0, { duration: 400 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

// ============================================================================
// ANIMATED COUNT-UP (same pattern as AnswerResultOverlay)
// ============================================================================

const AnimatedCountUp: React.FC<{
  amount: number;
  color: string;
  delay?: number;
  reducedMotion: boolean;
}> = ({ amount, color, delay = 400, reducedMotion }) => {
  const animatedValue = useSharedValue(0);
  const translateY = useSharedValue(reducedMotion ? 0 : 16);
  const opacityVal = useSharedValue(reducedMotion ? 1 : 0);
  const [displayText, setDisplayText] = useState(
    reducedMotion ? `+${formatCurrency(amount)}` : '+0'
  );

  const updateDisplayText = useCallback((rounded: number) => {
    setDisplayText(`+${formatCurrency(rounded)}`);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayText(`+${formatCurrency(amount)}`);
      return;
    }
    opacityVal.value = withDelay(delay, withTiming(1, { duration: 200 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 140 }));
    animatedValue.value = withDelay(
      delay + 100,
      withTiming(amount, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, reducedMotion]);

  useDerivedValue(() => {
    if (!reducedMotion) {
      const rounded = Math.round(animatedValue.value);
      runOnJS(updateDisplayText)(rounded);
    }
    return 0;
  });

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacityVal.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Text
        style={[styles.countUpText, { color }]}
        accessibilityLabel={formatMoneyForAccessibility(amount)}
      >
        {displayText}
      </Text>
    </Animated.View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SurveyCompletionOverlay: React.FC<SurveyCompletionOverlayProps> = ({
  visible,
  earnedAmount,
  payoutInitiated,
  completedSurveyId,
  onBackToSurveys,
}) => {
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const navigatingRef = useRef(false);

  // Store reset action
  const storeReset = useSurveyAttemptStore((s) => s.reset);

  // Data hooks
  const { data: userData } = useUser();
  const { data: runningSurveys } = useRunningSurveys();

  // Invalidate user cache to get fresh balance
  useEffect(() => {
    if (visible) {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      navigatingRef.current = false;
    }
  }, [visible, queryClient]);

  // Computed values
  const walletBalance = userData?.walletBalance ?? 0;
  const canWithdraw = walletBalance >= MIN_WITHDRAWAL_UGX && !payoutInitiated;
  const withdrawalProgress = Math.min(walletBalance / MIN_WITHDRAWAL_UGX, 1);
  const amountToGo = Math.max(MIN_WITHDRAWAL_UGX - walletBalance, 0);

  const nextSurvey = useMemo(() => {
    if (!runningSurveys) return null;
    return runningSurveys.find((s) => s.id !== completedSurveyId) ?? null;
  }, [runningSurveys, completedSurveyId]);

  // Animations
  const iconScale = useSharedValue(reducedMotion ? 1 : 0);
  const titleOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const titleTranslateY = useSharedValue(reducedMotion ? 0 : 12);
  const balanceOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const progressWidth = useSharedValue(reducedMotion ? withdrawalProgress : 0);
  const bannerOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const ctaOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const ctaTranslateY = useSharedValue(reducedMotion ? 0 : 16);
  const nextCardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const nextCardTranslateY = useSharedValue(reducedMotion ? 0 : 16);
  const linkOpacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!visible || reducedMotion) return;

    // Staggered entrance animations
    iconScale.value = withDelay(100, withSpring(1, { damping: 12, stiffness: 120 }));
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 250 }));
    titleTranslateY.value = withDelay(300, withSpring(0, { damping: 14, stiffness: 140 }));
    balanceOpacity.value = withDelay(500, withTiming(1, { duration: 250 }));
    progressWidth.value = withDelay(600, withTiming(withdrawalProgress, { duration: 600, easing: Easing.out(Easing.cubic) }));
    bannerOpacity.value = withDelay(700, withTiming(1, { duration: 250 }));
    ctaOpacity.value = withDelay(800, withTiming(1, { duration: 250 }));
    ctaTranslateY.value = withDelay(800, withSpring(0, { damping: 14, stiffness: 140 }));
    nextCardOpacity.value = withDelay(900, withTiming(1, { duration: 250 }));
    nextCardTranslateY.value = withDelay(900, withSpring(0, { damping: 14, stiffness: 140 }));
    linkOpacity.value = withDelay(1000, withTiming(1, { duration: 250 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reducedMotion]);

  // Accessibility announcement
  useEffect(() => {
    if (!visible) return;
    const balanceMsg = canWithdraw
      ? 'You can now withdraw your earnings.'
      : `Earn ${formatCurrency(amountToGo)} more to cash out.`;
    const payoutMsg = payoutInitiated ? ' Mobile money payment is being sent to your phone.' : '';
    const msg = `Survey completed! You earned ${formatMoneyForAccessibility(earnedAmount)}. Your balance is ${formatMoneyForAccessibility(walletBalance)}. ${balanceMsg}${payoutMsg}`;
    setTimeout(() => announce(msg), 400);
  }, [visible, earnedAmount, walletBalance, canWithdraw, amountToGo, payoutInitiated]);

  // Navigation handlers (guarded against double-tap)
  const handleWithdraw = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    storeReset();
    router.replace('/(tabs)/withdraw');
  }, [storeReset]);

  const handleNextSurvey = useCallback(() => {
    if (navigatingRef.current || !nextSurvey) return;
    navigatingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    storeReset();
    router.replace(`/survey/${nextSurvey.id}`);
  }, [storeReset, nextSurvey]);

  const handleBack = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onBackToSurveys();
  }, [onBackToSurveys]);

  // Animated styles
  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));
  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));
  const balanceAnimStyle = useAnimatedStyle(() => ({
    opacity: balanceOpacity.value,
  }));
  const progressAnimStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%` as any,
  }));
  const bannerAnimStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
  }));
  const ctaAnimStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaTranslateY.value }],
  }));
  const nextCardAnimStyle = useAnimatedStyle(() => ({
    opacity: nextCardOpacity.value,
    transform: [{ translateY: nextCardTranslateY.value }],
  }));
  const linkAnimStyle = useAnimatedStyle(() => ({
    opacity: linkOpacity.value,
  }));

  // Determine primary CTA
  const primaryCTA = useMemo(() => {
    if (canWithdraw) {
      return {
        title: 'Withdraw Cash',
        icon: <Wallet size={18} color={colors.primaryText} strokeWidth={1.5} />,
        onPress: handleWithdraw,
      };
    }
    if (nextSurvey) {
      return {
        title: 'Start Next Survey',
        icon: <ChevronRight size={18} color={colors.primaryText} strokeWidth={1.5} />,
        onPress: handleNextSurvey,
      };
    }
    return {
      title: 'Back to Surveys',
      icon: <ChevronRight size={18} color={colors.primaryText} strokeWidth={1.5} />,
      onPress: handleBack,
    };
  }, [canWithdraw, nextSurvey, colors.primaryText, handleWithdraw, handleNextSurvey, handleBack]);

  // Show next survey card as secondary when primary is "Withdraw Cash"
  const showNextSurveyCard = canWithdraw && nextSurvey != null;

  if (!visible) return null;

  const estimatedTime = nextSurvey?.uploads?.length
    ? nextSurvey.uploads.length * 2
    : 0;

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <StatusBar style={statusBarStyle} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + SPACING.xl, paddingBottom: insets.bottom + SPACING['2xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Confetti Burst ── */}
        {!reducedMotion && (
          <View style={styles.confettiContainer} pointerEvents="none">
            {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
              <ConfettiParticle
                key={i}
                index={i}
                total={CONFETTI_COUNT}
                color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
              />
            ))}
          </View>
        )}

        {/* ── Award Icon ── */}
        <Animated.View
          style={[
            styles.iconCircle,
            { backgroundColor: withAlpha(colors.success, 0.12) },
            iconAnimStyle,
          ]}
        >
          <Award size={56} color={colors.success} strokeWidth={1.5} />
        </Animated.View>

        {/* ── Title ── */}
        <Animated.View style={titleAnimStyle}>
          <Text style={[styles.title, { color: colors.text }]}>
            Survey Completed!
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Thank you for your responses. Your feedback is valuable.
          </Text>
        </Animated.View>

        {/* ── Earnings Card ── */}
        {earnedAmount > 0 && (
          <View
            style={[
              styles.earningsCard,
              {
                backgroundColor: colors.card,
                borderColor: withAlpha(colors.border, 0.7),
              },
            ]}
          >
            {/* Earned amount */}
            <View style={styles.earningsRow}>
              <View style={[styles.earningsIconBg, { backgroundColor: withAlpha(colors.success, 0.12) }]}>
                <TrendingUp size={20} color={colors.success} strokeWidth={1.5} />
              </View>
              <View style={styles.earningsInfo}>
                <Text style={[styles.earningsLabel, { color: colors.textMuted }]}>
                  You earned
                </Text>
                <AnimatedCountUp
                  amount={earnedAmount}
                  color={colors.success}
                  delay={400}
                  reducedMotion={reducedMotion}
                />
              </View>
            </View>

            {/* Wallet balance */}
            <Animated.View style={[styles.balanceSection, balanceAnimStyle]}>
              <View style={[styles.divider, { backgroundColor: withAlpha(colors.border, 0.5) }]} />
              <View style={styles.balanceRow}>
                <Wallet size={16} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
                  Wallet Balance
                </Text>
                <Text style={[styles.balanceAmount, { color: colors.text }]}>
                  {formatCurrency(walletBalance)}
                </Text>
              </View>

              {/* Withdrawal progress */}
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel="Progress toward minimum withdrawal"
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: Math.round(withdrawalProgress * 100),
                }}
                style={styles.progressSection}
              >
                <View style={[styles.progressTrack, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      { backgroundColor: canWithdraw ? colors.success : colors.primary },
                      progressAnimStyle,
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: canWithdraw ? colors.success : colors.textMuted }]}>
                  {canWithdraw
                    ? 'Ready to withdraw!'
                    : `Earn ${formatCurrency(amountToGo)} more to cash out`}
                </Text>
              </View>
            </Animated.View>
          </View>
        )}

        {/* ── MoMo Status Banner ── */}
        {payoutInitiated && (
          <Animated.View
            style={[
              styles.momoBanner,
              { backgroundColor: withAlpha(colors.success, 0.1), borderColor: withAlpha(colors.success, 0.2) },
              bannerAnimStyle,
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <CheckCircle2 size={18} color={colors.success} strokeWidth={1.5} />
            <Text style={[styles.momoText, { color: colors.success }]}>
              Mobile money payment is being sent to your phone.
            </Text>
          </Animated.View>
        )}

        {/* ── Primary CTA ── */}
        <Animated.View style={[styles.ctaContainer, ctaAnimStyle]}>
          <PrimaryButton
            title={primaryCTA.title}
            onPress={primaryCTA.onPress}
            rightIcon={primaryCTA.icon}
            size="large"
            style={styles.primaryCta}
            accessibilityLabel={primaryCTA.title}
            accessibilityHint={
              canWithdraw
                ? 'Navigate to withdrawal screen'
                : nextSurvey
                  ? 'Start the next available survey'
                  : 'Return to surveys list'
            }
          />
        </Animated.View>

        {/* ── Next Survey Preview Card (secondary) ── */}
        {showNextSurveyCard && nextSurvey && (
          <Animated.View style={nextCardAnimStyle}>
            <Pressable
              style={[
                styles.nextSurveyCard,
                {
                  backgroundColor: colors.card,
                  borderColor: withAlpha(colors.primary, 0.2),
                },
              ]}
              onPress={handleNextSurvey}
              accessibilityRole="button"
              accessibilityLabel={`Start next survey: ${nextSurvey.title}. Reward: ${formatCurrency(nextSurvey.rewardAmount ?? 0)}`}
              accessibilityHint="Navigate to this survey"
            >
              <View style={styles.nextSurveyHeader}>
                <View style={[styles.nextSurveyBadge, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                  <FileText size={14} color={colors.primary} strokeWidth={1.5} />
                  <Text style={[styles.nextSurveyBadgeText, { color: colors.primary }]}>
                    Next Survey
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} strokeWidth={1.5} />
              </View>

              <Text
                style={[styles.nextSurveyTitle, { color: colors.text }]}
                numberOfLines={2}
              >
                {nextSurvey.title}
              </Text>

              <View style={styles.nextSurveyMeta}>
                {(nextSurvey.rewardAmount ?? 0) > 0 && (
                  <View style={[styles.metaChip, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
                    <CheckCircle2 size={12} color={colors.success} strokeWidth={1.5} />
                    <Text style={[styles.metaChipText, { color: colors.success }]}>
                      {formatCurrency(nextSurvey.rewardAmount ?? 0)}
                    </Text>
                  </View>
                )}
                {estimatedTime > 0 && (
                  <View style={[styles.metaChip, { backgroundColor: withAlpha(colors.textMuted, 0.08) }]}>
                    <Clock size={12} color={colors.textMuted} strokeWidth={1.5} />
                    <Text style={[styles.metaChipText, { color: colors.textMuted }]}>
                      ~{estimatedTime} min
                    </Text>
                  </View>
                )}
                {(nextSurvey.uploads?.length ?? 0) > 0 && (
                  <View style={[styles.metaChip, { backgroundColor: withAlpha(colors.textMuted, 0.08) }]}>
                    <FileText size={12} color={colors.textMuted} strokeWidth={1.5} />
                    <Text style={[styles.metaChipText, { color: colors.textMuted }]}>
                      {nextSurvey.uploads!.length} Q
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Back to Surveys link (always visible as tertiary) ── */}
        {primaryCTA.title !== 'Back to Surveys' && (
          <Animated.View style={[styles.linkContainer, linkAnimStyle]}>
            <Pressable
              onPress={handleBack}
              style={styles.backLink}
              accessibilityRole="button"
              accessibilityLabel="Back to surveys list"
            >
              <Text style={[styles.backLinkText, { color: colors.textMuted }]}>
                Back to Surveys
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },

  // Confetti
  confettiContainer: {
    position: 'absolute',
    top: '25%',
    left: '50%',
    width: 0,
    height: 0,
    overflow: 'visible',
    zIndex: 10,
  },

  // Icon
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: RADIUS['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },

  // Title
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: SPACING.xl,
  },

  // Earnings Card
  earningsCard: {
    width: '100%',
    borderRadius: RADIUS['2xl'],
    borderWidth: BORDER_WIDTH.hairline,
    padding: SPACING.lg,
    marginBottom: SPACING.base,
    ...SHADOWS.md,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  earningsIconBg: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningsInfo: {
    flex: 1,
    gap: SPACING.xxs,
  },
  earningsLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  countUpText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    letterSpacing: -0.2,
  },

  // Balance
  balanceSection: {
    marginTop: SPACING.sm,
  },
  divider: {
    height: 1,
    marginBottom: SPACING.md,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  balanceLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  balanceAmount: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },

  // Progress bar
  progressSection: {
    gap: SPACING.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
    minWidth: 4,
  },
  progressText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },

  // MoMo banner
  momoBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.base,
  },
  momoText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },

  // CTA
  ctaContainer: {
    width: '100%',
    marginBottom: SPACING.base,
  },
  primaryCta: {
    width: '100%',
  },

  // Next Survey Card
  nextSurveyCard: {
    width: '100%',
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.base,
    marginBottom: SPACING.base,
    ...SHADOWS.sm,
  },
  nextSurveyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  nextSurveyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  nextSurveyBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  nextSurveyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    letterSpacing: -0.1,
    marginBottom: SPACING.sm,
  },
  nextSurveyMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  metaChipText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Back link
  linkContainer: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  backLink: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLinkText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    textDecorationLine: 'underline',
  },
});
