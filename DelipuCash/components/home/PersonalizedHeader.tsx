/**
 * PersonalizedHeader Component
 * Modern dashboard header with greeting, streak indicator, and wallet preview
 * 
 * Design: TikTok + Instagram + Duolingo inspired header
 * Features: Dynamic greeting, streak ring, wallet balance, notification bell
 * Accessibility: WCAG 2.2 AA compliant
 * 
 * @example
 * ```tsx
 * <PersonalizedHeader
 *   userName="John"
 *   walletBalance={125.50}
 *   currentStreak={7}
 *   streakGoal={30}
 *   unreadNotifications={3}
 *   onNotificationPress={() => router.push('/notifications')}
 *   onWalletPress={() => router.push('/wallet')}
 *   onStreakPress={() => showStreakModal()}
 * />
 * ```
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Flame, Wallet } from 'lucide-react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  FadeIn,
  FadeInRight,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
} from '@/utils/theme';
import { NotificationBell } from '@/components/NotificationBell';
import { triggerHaptic } from '@/utils/quiz-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;

// Streak ring dimensions
const RING_SIZE = isSmallScreen ? 44 : 52;
const RING_STROKE = 3;

export interface PersonalizedHeaderProps {
  /** User's first name */
  userName?: string;
  /** Current wallet balance */
  walletBalance?: number;
  /** Current streak days */
  currentStreak?: number;
  /** Streak goal (for progress ring) */
  streakGoal?: number;
  /** Unread notification count */
  unreadNotifications?: number;
  /** XP/level info */
  level?: number;
  /** XP progress percentage (0-100) */
  xpProgress?: number;
  /** Handler for notification bell press */
  onNotificationPress?: () => void;
  /** Handler for wallet tap */
  onWalletPress?: () => void;
  /** Handler for streak tap */
  onStreakPress?: () => void;
  /** Handler for avatar/profile tap */
  onProfilePress?: () => void;
  /** User avatar URL */
  avatarUrl?: string;
  /** Whether user is premium */
  isPremium?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Test ID */
  testID?: string;
}

/**
 * Get time-based greeting message
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

/**
 * Get motivational subtitle based on streak
 */
function getMotivationalText(streak: number): string {
  if (streak === 0) return "Let's start your streak today!";
  if (streak === 1) return "Great start! Keep it going!";
  if (streak < 7) return "You're building momentum!";
  if (streak < 14) return "One week strong! 🔥";
  if (streak < 30) return "You're on fire! Amazing!";
  if (streak < 100) return "Incredible dedication! 🌟";
  return "Legendary streak! 👑";
}

/**
 * Streak Progress Ring Component
 */
function StreakRing({
  current,
  goal,
  onPress,
}: {
  current: number;
  goal: number;
  onPress?: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const progress = Math.min((current / goal) * 100, 100);
  
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    triggerHaptic('light');
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`${current} day streak, ${Math.round(progress)}% to goal`}
      accessibilityHint="Tap to view streak details"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Animated.View style={[styles.streakRingContainer, animatedStyle]}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <G rotation="-90" origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
            {/* Background circle */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke={withAlpha(colors.border, 0.3)}
              strokeWidth={RING_STROKE}
              fill="transparent"
            />
            {/* Progress circle */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke={colors.warning}
              strokeWidth={RING_STROKE}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </G>
        </Svg>
        {/* Center content */}
        <View style={styles.streakCenter}>
          <Flame
            size={isSmallScreen ? 16 : 18}
            color={colors.warning}
            fill={colors.warning}
          />
        </View>
        {/* Streak count badge */}
        <View style={[styles.streakBadge, { backgroundColor: colors.warning }]}>
          <Text style={styles.streakBadgeText}>{current}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Mini wallet balance display
 */
function WalletPreview({
  balance,
  onPress,
}: {
  balance: number;
  onPress?: () => void;
}): React.ReactElement {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => {
        triggerHaptic('light');
        onPress?.();
      }}
      style={[styles.walletPreview, { backgroundColor: withAlpha(colors.success, 0.12) }]}
      accessibilityRole="button"
      accessibilityLabel={`Wallet balance: UGX ${balance.toLocaleString()}`}
      accessibilityHint="Tap to view wallet details"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Wallet size={14} color={colors.success} strokeWidth={2} />
      <Text
        style={[styles.walletPreviewText, { color: colors.success }]}
        allowFontScaling
        maxFontSizeMultiplier={1.2}
      >
        UGX {balance.toLocaleString()}
      </Text>
    </Pressable>
  );
}

export function PersonalizedHeader({
  userName = 'User',
  walletBalance = 0,
  currentStreak = 0,
  streakGoal = 30,
  unreadNotifications = 0,
  level,
  xpProgress,
  onNotificationPress,
  onWalletPress,
  onStreakPress,
  onProfilePress,
  avatarUrl,
  isPremium = false,
  isLoading = false,
  testID = 'personalized-header',
}: PersonalizedHeaderProps): React.ReactElement {
  const { colors } = useTheme();
  
  const greeting = useMemo(() => getGreeting(), []);
  const motivationalText = useMemo(
    () => getMotivationalText(currentStreak),
    [currentStreak]
  );

  return (
    <View
      style={styles.container}
      accessibilityRole="header"
      testID={testID}
    >
      {/* Left side: Greeting & name */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={styles.greetingContainer}
      >
        <View style={styles.greetingRow}>
          <Text
            style={[styles.greeting, { color: colors.textMuted }]}
            allowFontScaling
            maxFontSizeMultiplier={1.3}
          >
            {greeting},
          </Text>
          {/* Level badge if provided */}
          {level !== undefined && (
            <Animated.View
              entering={ZoomIn.delay(200)}
              style={[styles.levelBadge, { backgroundColor: withAlpha(colors.primary, 0.15) }]}
            >
              <Text style={[styles.levelText, { color: colors.primary }]}>
                Lv. {level}
              </Text>
            </Animated.View>
          )}
        </View>
        
        <View style={styles.nameRow}>
          <Text
            style={[styles.userName, { color: colors.text }]}
            numberOfLines={1}
            allowFontScaling
            maxFontSizeMultiplier={1.2}
            accessibilityRole="text"
          >
            {userName}
            {isPremium && ' ✨'}
          </Text>
        </View>

        {/* Motivational subtitle */}
        <Text
          style={[styles.motivationalText, { color: colors.textSecondary }]}
          numberOfLines={1}
          allowFontScaling
          maxFontSizeMultiplier={1.2}
        >
          {motivationalText}
        </Text>

        {/* Quick wallet preview */}
        <Animated.View entering={FadeIn.delay(100).duration(300)}>
          <WalletPreview balance={walletBalance} onPress={onWalletPress} />
        </Animated.View>
      </Animated.View>

      {/* Right side: Streak ring & notifications */}
      <Animated.View
        entering={FadeInRight.delay(150).duration(400)}
        style={styles.actionsContainer}
      >
        {/* Streak ring */}
        <StreakRing
          current={currentStreak}
          goal={streakGoal}
          onPress={onStreakPress}
        />
        
        {/* Notification bell */}
        <View style={styles.notificationWrapper}>
          <NotificationBell
            count={unreadNotifications}
            onPress={onNotificationPress}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  greetingContainer: {
    flex: 1,
    marginRight: SPACING.md,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  greeting: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: isSmallScreen ? TYPOGRAPHY.fontSize.sm : TYPOGRAPHY.fontSize.base,
  },
  levelBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
  },
  levelText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xxs,
  },
  userName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: isSmallScreen ? TYPOGRAPHY.fontSize['2xl'] : TYPOGRAPHY.fontSize['3xl'],
    maxWidth: '100%',
  },
  motivationalText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xxs,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  streakRingContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakBadge: {
    position: 'absolute',
    bottom: -SPACING.xxs,
    right: -SPACING.xxs,
    minWidth: 18,
    height: 18,
    borderRadius: RADIUS.md + 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
  },
  streakBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
  },
  notificationWrapper: {
    marginLeft: SPACING.xs,
  },
  walletPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
  },
  walletPreviewText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default PersonalizedHeader;
