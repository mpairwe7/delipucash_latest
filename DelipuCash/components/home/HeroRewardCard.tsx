/**
 * HeroRewardCard Component
 * Large, prominent hero card for daily rewards with progress visualization
 * 
 * Design: Duolingo streak + Cash App rewards inspired
 * Features: Large CTA, progress ring, confetti on claim, premium feel
 * Accessibility: WCAG 2.2 AA compliant
 * 
 * @example
 * ```tsx
 * <HeroRewardCard
 *   isAvailable={true}
 *   currentStreak={7}
 *   todayReward={150}
 *   streakBonus={50}
 *   nextRewardIn={0}
 *   onClaim={() => claimReward()}
 *   isLoading={false}
 * />
 * ```
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';
import { Gift, Flame, Clock, ChevronRight, Sparkles, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  BORDER_WIDTH,
  withAlpha,
} from '@/utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;

// Progress ring dimensions
const RING_SIZE = isSmallScreen ? 80 : 100;
const RING_STROKE = 6;

export interface HeroRewardCardProps {
  /** Whether reward is available to claim */
  isAvailable: boolean;
  /** Hours until next reward (if not available) */
  nextRewardIn?: number;
  /** Current streak days */
  currentStreak: number;
  /** Today's reward amount (points) */
  todayReward: number;
  /** Bonus for streak */
  streakBonus?: number;
  /** Maximum streak for ring visualization */
  maxStreak?: number;
  /** Claim handler */
  onClaim?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Handler for streak info tap */
  onStreakInfoPress?: () => void;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Confetti particle component for celebration
 */
function ConfettiParticle({
  delay,
  color,
}: {
  delay: number;
  color: string;
}): React.ReactElement {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    const randomX = (Math.random() - 0.5) * 200;
    const randomRotation = Math.random() * 720 - 360;

    translateY.value = withDelay(
      delay,
      withTiming(-150, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );
    translateX.value = withDelay(
      delay,
      withTiming(randomX, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );
    opacity.value = withDelay(delay, withTiming(0, { duration: 1000 }));
    rotation.value = withDelay(delay, withTiming(randomRotation, { duration: 1000 }));
  }, [delay, translateY, translateX, opacity, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.confettiParticle, { backgroundColor: color }, animatedStyle]} />
  );
}

/**
 * Streak progress ring with gradient
 */
function StreakProgressRing({
  current,
  max,
  isAvailable,
}: {
  current: number;
  max: number;
  isAvailable: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  const progress = Math.min((current / max) * 100, 100);
  
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={styles.progressRingContainer}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Defs>
          <SvgLinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={isAvailable ? '#FFD700' : colors.textMuted} />
            <Stop offset="100%" stopColor={isAvailable ? '#FF8C00' : colors.textMuted} />
          </SvgLinearGradient>
        </Defs>
        <G rotation="-90" origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
          {/* Background circle */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke={withAlpha(isAvailable ? '#FFD700' : colors.border, 0.2)}
            strokeWidth={RING_STROKE}
            fill="transparent"
          />
          {/* Progress circle */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke="url(#ringGradient)"
            strokeWidth={RING_STROKE}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      {/* Center icon */}
      <View style={styles.ringCenter}>
        <Gift
          size={isSmallScreen ? 28 : 36}
          color={isAvailable ? '#FFFFFF' : colors.textMuted}
          strokeWidth={1.5}
        />
      </View>
    </View>
  );
}

/**
 * Format countdown timer
 */
function formatCountdown(hours: number): string {
  if (hours <= 0) return 'Now';
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function HeroRewardCard({
  isAvailable,
  nextRewardIn = 0,
  currentStreak,
  todayReward,
  streakBonus = 0,
  maxStreak = 30,
  onClaim,
  isLoading = false,
  onStreakInfoPress,
  testID = 'hero-reward-card',
}: HeroRewardCardProps): React.ReactElement {
  const { colors } = useTheme();
  const [showConfetti, setShowConfetti] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const totalReward = todayReward + streakBonus;

  // Respect reduced-motion accessibility setting (WCAG 2.2 §2.3.3)
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (isEnabled) => setReduceMotion(isEnabled)
    );
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    return () => subscription.remove();
  }, []);

  // Pulse animation for CTA button
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (isAvailable && !isLoading && !reduceMotion) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1200 }),
          withTiming(0.3, { duration: 1200 })
        ),
        -1,
        false
      );
    }
  }, [isAvailable, isLoading, reduceMotion, pulseScale, glowOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handleClaim = useCallback(() => {
    if (!isAvailable || isLoading) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowConfetti(true);
    
    // Hide confetti after animation
    setTimeout(() => setShowConfetti(false), 1500);
    
    onClaim?.();
  }, [isAvailable, isLoading, onClaim]);

  const handleStreakInfo = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onStreakInfoPress?.();
  }, [onStreakInfoPress]);

  // Gradient colors based on availability
  const gradientColors: [string, string, string] = isAvailable
    ? ['#667eea', '#764ba2', '#f093fb']
    : [colors.card, colors.card, colors.elevated];

  return (
    <Animated.View
      entering={FadeInDown.duration(500).springify()}
      style={styles.container}
      testID={testID}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.card,
          !isAvailable && { borderWidth: BORDER_WIDTH.thin, borderColor: colors.border },
        ]}
      >
        {/* Confetti overlay */}
        {showConfetti && (
          <View style={styles.confettiContainer}>
            {['#FFD700', '#FF6B6B', '#4ECDC4', '#667eea', '#f093fb', '#44A08D'].map(
              (color, index) => (
                <ConfettiParticle key={index} delay={index * 50} color={color} />
              )
            )}
          </View>
        )}

        {/* Decorative elements */}
        <View style={[styles.decorCircle1, { opacity: isAvailable ? 0.1 : 0.05 }]} />
        <View style={[styles.decorCircle2, { opacity: isAvailable ? 0.08 : 0.03 }]} />

        <View style={styles.content}>
          {/* Left: Progress ring */}
          <StreakProgressRing
            current={currentStreak}
            max={maxStreak}
            isAvailable={isAvailable}
          />

          {/* Right: Info & CTA */}
          <View style={styles.infoContainer}>
            {/* Title */}
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  { color: isAvailable ? '#FFFFFF' : colors.text },
                ]}
                allowFontScaling
                maxFontSizeMultiplier={1.2}
              >
                Daily Reward
              </Text>
              {isAvailable && (
                <Animated.View entering={ZoomIn.delay(200)}>
                  <Sparkles size={18} color="#FFD700" fill="#FFD700" />
                </Animated.View>
              )}
            </View>

            {/* Streak info */}
            <TouchableOpacity
              onPress={handleStreakInfo}
              style={styles.streakRow}
              accessibilityRole="button"
              accessibilityLabel={`${currentStreak} day streak`}
              accessibilityHint="Tap for streak details"
            >
              <Flame
                size={16}
                color={isAvailable ? '#FFD700' : colors.warning}
                fill={isAvailable ? '#FFD700' : colors.warning}
              />
              <Text
                style={[
                  styles.streakText,
                  { color: isAvailable ? 'rgba(255,255,255,0.9)' : colors.warning },
                ]}
                allowFontScaling
                maxFontSizeMultiplier={1.2}
              >
                {currentStreak} day streak
              </Text>
              <ChevronRight
                size={14}
                color={isAvailable ? 'rgba(255,255,255,0.7)' : colors.textMuted}
              />
            </TouchableOpacity>

            {/* Reward amount or countdown */}
            {isAvailable ? (
              <View style={styles.rewardRow}>
                <Text
                  style={styles.rewardAmount}
                  accessibilityLabel={`${totalReward} points reward`}
                  allowFontScaling
                  maxFontSizeMultiplier={1.2}
                >
                  +{totalReward}
                </Text>
                <Text style={styles.rewardLabel}>points</Text>
                {streakBonus > 0 && (
                  <View style={styles.bonusBadge}>
                    <Star size={10} color="#FFFFFF" fill="#FFFFFF" />
                    <Text style={styles.bonusText}>+{streakBonus} bonus</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.countdownRow}>
                <Clock size={14} color={colors.textMuted} />
                <Text
                  style={[styles.countdownText, { color: colors.textMuted }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.2}
                >
                  Next reward in {formatCountdown(nextRewardIn)}
                </Text>
              </View>
            )}

            {/* CTA Button */}
            {isAvailable && (
              <Animated.View style={pulseStyle}>
                <TouchableOpacity
                  onPress={handleClaim}
                  disabled={isLoading}
                  activeOpacity={0.85}
                  style={styles.claimButton}
                  accessibilityRole="button"
                  accessibilityLabel="Claim daily reward"
                  accessibilityState={{ disabled: isLoading }}
                >
                  {/* Glow effect */}
                  <Animated.View style={[styles.buttonGlow, glowStyle]} />
                  
                  <LinearGradient
                    colors={['#FFD700', '#FF8C00']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.claimButtonGradient}
                  >
                    {isLoading ? (
                      <Text style={styles.claimButtonText}>Claiming...</Text>
                    ) : (
                      <>
                        <Gift size={18} color="#1a1a2e" strokeWidth={2} />
                        <Text style={styles.claimButtonText}>Claim Now</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  card: {
    borderRadius: RADIUS['2xl'],
    padding: SPACING.lg,
    overflow: 'hidden',
    position: 'relative',
    ...SHADOWS.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressRingContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.base,
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: isSmallScreen ? TYPOGRAPHY.fontSize.lg : TYPOGRAPHY.fontSize.xl,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  streakText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  rewardAmount: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: isSmallScreen ? TYPOGRAPHY.fontSize['3xl'] : TYPOGRAPHY.fontSize['4xl'],
    color: '#FFFFFF',
  },
  rewardLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
    gap: SPACING.xxs,
  },
  bonusText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFD700',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  countdownText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  claimButton: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    overflow: 'visible',
  },
  buttonGlow: {
    position: 'absolute',
    top: -SPACING.xs,
    left: -SPACING.xs,
    right: -SPACING.xs,
    bottom: -SPACING.xs,
    backgroundColor: '#FFD700',
    borderRadius: RADIUS.full + 4,
    opacity: 0.3,
  },
  claimButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
  },
  claimButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#1a1a2e',
  },
  decorCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: RADIUS.full,
    backgroundColor: '#FFFFFF',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    backgroundColor: '#FFFFFF',
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  confettiParticle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: RADIUS.xs,
  },
});

export default HeroRewardCard;
