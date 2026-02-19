/**
 * Gamification Components
 * 
 * Collection of gamification UI elements inspired by:
 * - Duolingo: Streak counter, XP progress, daily goals
 * - Swagbucks: Points display, redemption progress
 * - Brainly: Leaderboard snippets, achievement badges
 * - Stack Overflow: Reputation badges, progress bars
 * 
 * Components:
 * - StreakCounter: Daily streak with fire animation
 * - PointsDisplay: Animated points counter with level
 * - DailyProgress: Circular/linear progress to daily goal
 * - LeaderboardSnippet: Top 3 users mini-leaderboard
 * - AchievementBadge: Unlocked achievement display
 * - RewardProgress: Progress to next redemption tier
 */

import React, { memo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  SlideInRight,
} from "react-native-reanimated";
import {
  Flame,
  Star,
  Trophy,
  Crown,
  Zap,
  Gift,
  Award,
  CheckCircle2,
  ChevronRight,
  Medal,
  Sparkles,
} from "lucide-react-native";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from "@/utils/theme";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useReducedMotion } from "@/utils/accessibility";

// ============================================================================
// STREAK COUNTER
// ============================================================================

export interface StreakCounterProps {
  /** Current streak count */
  streak: number;
  /** Whether streak is active today */
  isActiveToday?: boolean;
  /** Press handler for streak details */
  onPress?: () => void;
  /** Size variant */
  size?: "compact" | "default" | "large";
}

function StreakCounterComponent({
  streak,
  isActiveToday = true,
  onPress,
  size = "default",
}: StreakCounterProps): React.ReactElement {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  
  // Animation values
  const flameScale = useSharedValue(1);
  const flameRotation = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      // Reset to static values when reduce motion is enabled
      flameScale.value = 1;
      flameRotation.value = 0;
      return;
    }

    if (isActiveToday && streak > 0) {
      // Subtle flame animation
      flameScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
      flameRotation.value = withRepeat(
        withSequence(
          withTiming(3, { duration: 600 }),
          withTiming(-3, { duration: 600 })
        ),
        -1,
        true
      );
    }
  }, [isActiveToday, streak, flameScale, flameRotation, reduceMotion]);

  const animatedFlameStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: flameScale.value },
      { rotate: `${flameRotation.value}deg` },
    ],
  }));

  const sizeConfig = {
    compact: { icon: 16, text: TYPOGRAPHY.fontSize.sm, container: 28 },
    default: { icon: 20, text: TYPOGRAPHY.fontSize.lg, container: 36 },
    large: { icon: 28, text: TYPOGRAPHY.fontSize["2xl"], container: 48 },
  }[size];

  const streakColor = streak > 0 ? colors.warning : colors.textMuted;
  const glowColor = isActiveToday ? withAlpha(colors.warning, 0.3) : "transparent";

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.streakContainer,
        { 
          backgroundColor: withAlpha(streakColor, 0.12),
          borderColor: glowColor,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${streak} day streak${isActiveToday ? ", active today" : ", not active today"}`}
      accessibilityHint="Double tap for streak details"
    >
      <Animated.View style={animatedFlameStyle}>
        <Flame 
          size={sizeConfig.icon} 
          color={streakColor} 
          fill={streak > 0 ? streakColor : "transparent"}
        />
      </Animated.View>
      <Text 
        style={[
          styles.streakText, 
          { 
            color: streakColor,
            fontSize: sizeConfig.text,
          },
        ]}
      >
        {streak}
      </Text>
    </Pressable>
  );
}

export const StreakCounter = memo(StreakCounterComponent);

// ============================================================================
// POINTS DISPLAY
// ============================================================================

export interface PointsDisplayProps {
  /** Current points */
  points: number;
  /** Points earned in current session (for animation) */
  sessionPoints?: number;
  /** User level */
  level?: number;
  /** Press handler */
  onPress?: () => void;
  /** Size variant */
  size?: "compact" | "default" | "large";
  /** Show level badge */
  showLevel?: boolean;
}

function PointsDisplayComponent({
  points,
  sessionPoints = 0,
  level,
  onPress,
  size = "default",
  showLevel = true,
}: PointsDisplayProps): React.ReactElement {
  const { colors } = useTheme();
  
  // Animation for points change
  const pointsScale = useSharedValue(1);

  useEffect(() => {
    if (sessionPoints > 0) {
      pointsScale.value = withSequence(
        withSpring(1.2, { damping: 8 }),
        withSpring(1, { damping: 12 })
      );
    }
  }, [sessionPoints, pointsScale]);

  const animatedPointsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pointsScale.value }],
  }));

  const formatPoints = (p: number): string => {
    if (p >= 1000000) return `${(p / 1000000).toFixed(1)}M`;
    if (p >= 1000) return `${(p / 1000).toFixed(1)}K`;
    return p.toString();
  };

  const sizeConfig = {
    compact: { icon: 14, text: TYPOGRAPHY.fontSize.sm },
    default: { icon: 18, text: TYPOGRAPHY.fontSize.lg },
    large: { icon: 24, text: TYPOGRAPHY.fontSize["2xl"] },
  }[size];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pointsContainer,
        { backgroundColor: withAlpha(colors.primary, 0.12) },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${points} points${level ? `, level ${level}` : ""}`}
      accessibilityHint="Double tap for points details"
    >
      <Star size={sizeConfig.icon} color={colors.primary} fill={colors.primary} />
      <Animated.Text
        style={[
          styles.pointsText,
          { color: colors.primary, fontSize: sizeConfig.text },
          animatedPointsStyle,
        ]}
      >
        {formatPoints(points)}
      </Animated.Text>
      {showLevel && level && (
        <View style={[styles.levelBadge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.levelText, { color: colors.primaryText }]}>
            Lv.{level}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export const PointsDisplay = memo(PointsDisplayComponent);

// ============================================================================
// DAILY PROGRESS (Circular)
// ============================================================================

export interface DailyProgressProps {
  /** Current progress value */
  current: number;
  /** Target/goal value */
  target: number;
  /** Label (e.g., "Questions", "Points") */
  label: string;
  /** Size of the circle */
  size?: number;
  /** Press handler */
  onPress?: () => void;
}

function DailyProgressComponent({
  current,
  target,
  label,
  size = 80,
  onPress,
}: DailyProgressProps): React.ReactElement {
  const { colors } = useTheme();
  
  const progress = Math.min(current / target, 1);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const isComplete = current >= target;

  return (
    <Pressable
      onPress={onPress}
      style={styles.dailyProgressContainer}
      accessibilityRole="progressbar"
      accessibilityLabel={`Daily ${label} progress: ${current} of ${target}`}
      accessibilityValue={{ min: 0, max: target, now: current }}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={colors.primary} />
              <Stop offset="100%" stopColor={colors.success} />
            </LinearGradient>
          </Defs>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={withAlpha(colors.textMuted, 0.2)}
            strokeWidth={6}
            fill="transparent"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#progressGradient)"
            strokeWidth={6}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={[styles.dailyProgressCenter, { width: size, height: size }]}>
          {isComplete ? (
            <CheckCircle2 size={24} color={colors.success} />
          ) : (
            <>
              <Text style={[styles.dailyProgressValue, { color: colors.text }]}>
                {current}
              </Text>
              <Text style={[styles.dailyProgressTarget, { color: colors.textMuted }]}>
                /{target}
              </Text>
            </>
          )}
        </View>
      </View>
      <Text style={[styles.dailyProgressLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export const DailyProgress = memo(DailyProgressComponent);

// ============================================================================
// LEADERBOARD SNIPPET
// ============================================================================

export interface LeaderboardUser {
  id: string;
  name: string;
  avatar?: string;
  points: number;
  rank: number;
}

export interface LeaderboardSnippetProps {
  /** Top users to display */
  users: LeaderboardUser[];
  /** Current user's rank (for highlighting) */
  currentUserRank?: number;
  /** Press handler for full leaderboard */
  onPress?: () => void;
  /** Title */
  title?: string;
}

function LeaderboardSnippetComponent({
  users,
  currentUserRank,
  onPress,
  title = "Top Earners Today",
}: LeaderboardSnippetProps): React.ReactElement {
  const { colors } = useTheme();

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return { icon: Crown, color: "#FFD700" };
      case 2: return { icon: Medal, color: "#C0C0C0" };
      case 3: return { icon: Medal, color: "#CD7F32" };
      default: return null;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={[styles.leaderboardContainer, { backgroundColor: colors.card }]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. Double tap to view full leaderboard`}
    >
      <View style={styles.leaderboardHeader}>
        <View style={styles.leaderboardTitleRow}>
          <Trophy size={18} color={colors.warning} />
          <Text style={[styles.leaderboardTitle, { color: colors.text }]}>
            {title}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </View>

      <View style={styles.leaderboardList}>
        {users.slice(0, 3).map((user, index) => {
          const rankInfo = getRankIcon(user.rank);
          const RankIcon = rankInfo?.icon;
          
          return (
            <Animated.View
              key={user.id}
              entering={SlideInRight.delay(index * 100).duration(300)}
              style={[
                styles.leaderboardItem,
                currentUserRank === user.rank && {
                  backgroundColor: withAlpha(colors.primary, 0.1),
                },
              ]}
            >
              {/* Rank */}
              <View style={styles.rankContainer}>
                {RankIcon ? (
                  <RankIcon size={18} color={rankInfo?.color} fill={rankInfo?.color} />
                ) : (
                  <Text style={[styles.rankText, { color: colors.textMuted }]}>
                    #{user.rank}
                  </Text>
                )}
              </View>

              {/* Avatar */}
              <View 
                style={[
                  styles.leaderboardAvatar,
                  { backgroundColor: withAlpha(colors.primary, 0.15) },
                ]}
              >
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* Name */}
              <Text 
                style={[styles.leaderboardName, { color: colors.text }]}
                numberOfLines={1}
              >
                {user.name}
              </Text>

              {/* Points */}
              <Text style={[styles.leaderboardPoints, { color: colors.primary }]}>
                {user.points.toLocaleString()}
              </Text>
            </Animated.View>
          );
        })}
      </View>

      {/* Current user rank (if not in top 3) */}
      {currentUserRank !== undefined && currentUserRank > 3 && (
        <View 
          style={[
            styles.currentUserRank,
            { borderTopColor: colors.border },
          ]}
        >
          <Text style={[styles.currentUserRankText, { color: colors.textMuted }]}>
            Your rank: #{currentUserRank}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export const LeaderboardSnippet = memo(LeaderboardSnippetComponent);

// ============================================================================
// ACHIEVEMENT BADGE
// ============================================================================

export interface AchievementBadgeProps {
  /** Achievement name */
  name: string;
  /** Achievement description */
  description: string;
  /** Icon name or component */
  icon: "first-answer" | "fast-responder" | "helpful" | "expert" | "streak" | "top-contributor";
  /** Whether unlocked */
  unlocked: boolean;
  /** Unlock date */
  unlockedAt?: string;
  /** Press handler */
  onPress?: () => void;
}

function AchievementBadgeComponent({
  name,
  description,
  icon,
  unlocked,
  unlockedAt,
  onPress,
}: AchievementBadgeProps): React.ReactElement {
  const { colors } = useTheme();

  const getAchievementIcon = () => {
    const iconProps = { 
      size: 24, 
      color: unlocked ? colors.warning : colors.textMuted,
      fill: unlocked ? colors.warning : "transparent",
    };
    
    switch (icon) {
      case "first-answer": return <Award {...iconProps} />;
      case "fast-responder": return <Zap {...iconProps} />;
      case "helpful": return <Star {...iconProps} />;
      case "expert": return <Crown {...iconProps} />;
      case "streak": return <Flame {...iconProps} />;
      case "top-contributor": return <Trophy {...iconProps} />;
      default: return <Award {...iconProps} />;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.achievementContainer,
        { 
          backgroundColor: colors.card,
          opacity: unlocked ? 1 : 0.6,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${name} achievement${unlocked ? ", unlocked" : ", locked"}`}
      accessibilityHint={description}
    >
      <View 
        style={[
          styles.achievementIconContainer,
          { 
            backgroundColor: unlocked 
              ? withAlpha(colors.warning, 0.15) 
              : withAlpha(colors.textMuted, 0.1),
          },
        ]}
      >
        {getAchievementIcon()}
      </View>
      <View style={styles.achievementInfo}>
        <Text style={[styles.achievementName, { color: colors.text }]}>
          {name}
        </Text>
        <Text style={[styles.achievementDesc, { color: colors.textMuted }]}>
          {description}
        </Text>
      </View>
      {unlocked && (
        <CheckCircle2 size={18} color={colors.success} />
      )}
    </Pressable>
  );
}

export const AchievementBadge = memo(AchievementBadgeComponent);

// ============================================================================
// REWARD PROGRESS
// ============================================================================

export interface RewardTier {
  points: number;
  cashValue: number;
  label: string;
}

export interface RewardProgressProps {
  /** Current points */
  currentPoints: number;
  /** Next tier to reach */
  nextTier: RewardTier;
  /** Press handler for redemption */
  onRedeem?: () => void;
  /** Whether user can redeem */
  canRedeem?: boolean;
}

function RewardProgressComponent({
  currentPoints,
  nextTier,
  onRedeem,
  canRedeem = false,
}: RewardProgressProps): React.ReactElement {
  const { colors } = useTheme();
  
  const progress = Math.min(currentPoints / nextTier.points, 1);
  const pointsRemaining = Math.max(nextTier.points - currentPoints, 0);
  const isComplete = progress >= 1;

  // Animated progress bar
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withSpring(progress, { damping: 15 });
  }, [progress, progressWidth]);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  const handleRedeem = useCallback(() => {
    if (canRedeem) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRedeem?.();
    }
  }, [canRedeem, onRedeem]);

  return (
    <View 
      style={[styles.rewardProgressContainer, { backgroundColor: colors.card }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Reward progress: ${currentPoints} of ${nextTier.points} points for ${nextTier.label}`}
      accessibilityValue={{ min: 0, max: nextTier.points, now: currentPoints }}
    >
      <View style={styles.rewardProgressHeader}>
        <View style={styles.rewardProgressTitleRow}>
          <Gift size={18} color={colors.success} />
          <Text style={[styles.rewardProgressTitle, { color: colors.text }]}>
            Next Reward
          </Text>
        </View>
        <Text style={[styles.rewardProgressValue, { color: colors.success }]}>
          {currentPoints.toLocaleString()} / {nextTier.points.toLocaleString()} pts
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.rewardProgressBarContainer}>
        <View 
          style={[
            styles.rewardProgressBarBg,
            { backgroundColor: withAlpha(colors.success, 0.15) },
          ]}
        >
          <Animated.View
            style={[
              styles.rewardProgressBar,
              { backgroundColor: colors.success },
              animatedProgressStyle,
            ]}
          />
        </View>
      </View>

      {/* Status text */}
      <View style={styles.rewardProgressFooter}>
        {isComplete ? (
          <Pressable
            onPress={handleRedeem}
            style={[
              styles.redeemButton,
              { backgroundColor: colors.success },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Redeem reward"
          >
            <Sparkles size={14} color={colors.primaryText} />
            <Text style={[styles.redeemButtonText, { color: colors.primaryText }]}>
              Redeem Now!
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.rewardProgressRemaining, { color: colors.textMuted }]}>
            {pointsRemaining.toLocaleString()} pts to UGX {nextTier.cashValue.toLocaleString()}
          </Text>
        )}
        <Text style={[styles.rewardProgressPercent, { color: colors.textMuted }]}>
          {Math.round(progress * 100)}%
        </Text>
      </View>
    </View>
  );
}

export const RewardProgress = memo(RewardProgressComponent);

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Streak Counter
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 2,
  },
  streakText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },

  // Points Display
  pointsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  pointsText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  levelBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    marginLeft: SPACING.xs,
  },
  levelText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Daily Progress
  dailyProgressContainer: {
    alignItems: "center",
    gap: SPACING.xs,
  },
  dailyProgressCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  dailyProgressValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  dailyProgressTarget: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  dailyProgressLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: "uppercase",
  },

  // Leaderboard
  leaderboardContainer: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    ...SHADOWS.sm,
  },
  leaderboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  leaderboardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  leaderboardTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  leaderboardList: {
    gap: SPACING.sm,
  },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  rankContainer: {
    width: 24,
    alignItems: "center",
  },
  rankText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  leaderboardAvatar: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  leaderboardName: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  leaderboardPoints: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  currentUserRank: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    alignItems: "center",
  },
  currentUserRankText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Achievement Badge
  achievementContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOWS.sm,
  },
  achievementIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  achievementDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  // Reward Progress
  rewardProgressContainer: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    ...SHADOWS.sm,
  },
  rewardProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  rewardProgressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  rewardProgressTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  rewardProgressValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  rewardProgressBarContainer: {
    marginBottom: SPACING.sm,
  },
  rewardProgressBarBg: {
    height: 8,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  rewardProgressBar: {
    height: "100%",
    borderRadius: RADIUS.full,
  },
  rewardProgressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rewardProgressRemaining: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  rewardProgressPercent: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  redeemButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  redeemButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default {
  StreakCounter,
  PointsDisplay,
  DailyProgress,
  LeaderboardSnippet,
  AchievementBadge,
  RewardProgress,
};
