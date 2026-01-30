/**
 * Skeleton Loading Components
 * 
 * Shimmer-effect skeleton loaders for improved perceived performance.
 * Inspired by Facebook, LinkedIn, and modern apps.
 * 
 * Features:
 * - Smooth shimmer animation using reanimated
 * - Matches actual component layouts
 * - Accessible with proper labels
 * - Configurable count for lists
 * 
 * @example
 * ```tsx
 * {isLoading ? (
 *   <QuestionFeedSkeleton count={5} />
 * ) : (
 *   <FlatList data={questions} ... />
 * )}
 * ```
 */

import React, { memo, useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  useTheme,
  SPACING,
  RADIUS,
  SHADOWS,
  withAlpha,
} from "@/utils/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================================================
// SHIMMER WRAPPER
// ============================================================================

interface ShimmerProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}

const Shimmer = memo(function Shimmer({
  width,
  height,
  borderRadius = RADIUS.md,
  style,
}: ShimmerProps) {
  const { colors } = useTheme();
  const shimmerPosition = useSharedValue(-1);

  useEffect(() => {
    shimmerPosition.value = withRepeat(
      withTiming(1, {
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shimmerPosition.value,
          [-1, 1],
          [-SCREEN_WIDTH, SCREEN_WIDTH]
        ),
      },
    ],
  }));

  const baseColor = withAlpha(colors.textMuted, 0.1);
  const shimmerColor = withAlpha(colors.textMuted, 0.2);

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: "hidden",
        },
        style,
      ]}
      accessibilityLabel="Loading content"
      accessibilityRole="progressbar"
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={["transparent", shimmerColor, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
});

// ============================================================================
// QUESTION FEED ITEM SKELETON
// ============================================================================

export interface QuestionFeedSkeletonProps {
  /** Number of skeleton items to show */
  count?: number;
  /** Variant matching QuestionFeedItem */
  variant?: "default" | "compact";
}

function QuestionFeedSkeletonItemComponent({
  variant = "default",
}: {
  variant: "default" | "compact";
}) {
  const { colors } = useTheme();
  const isCompact = variant === "compact";

  return (
    <View
      style={[
        styles.questionCard,
        isCompact && styles.questionCardCompact,
        { backgroundColor: colors.card },
      ]}
    >
      {/* Header row - badges and time */}
      <View style={styles.headerRow}>
        <View style={styles.badgesRow}>
          <Shimmer width={70} height={22} borderRadius={RADIUS.full} />
          <Shimmer width={55} height={22} borderRadius={RADIUS.full} />
        </View>
        <Shimmer width={40} height={14} />
      </View>

      {/* Question text */}
      <View style={styles.textContainer}>
        <Shimmer width="100%" height={18} style={styles.textLine} />
        <Shimmer width="85%" height={18} style={styles.textLine} />
        {!isCompact && <Shimmer width="60%" height={18} />}
      </View>

      {/* Reward row (for non-compact) */}
      {!isCompact && (
        <Shimmer 
          width="100%" 
          height={40} 
          borderRadius={RADIUS.md} 
          style={styles.rewardRow}
        />
      )}

      {/* Author row (for non-compact) */}
      {!isCompact && (
        <View style={styles.authorRow}>
          <Shimmer width={32} height={32} borderRadius={RADIUS.full} />
          <View style={styles.authorInfo}>
            <Shimmer width={100} height={14} />
            <Shimmer width={70} height={12} style={styles.authorRep} />
          </View>
        </View>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Shimmer width={24} height={24} borderRadius={RADIUS.full} />
          <Shimmer width={60} height={12} />
        </View>
        <View style={styles.statItem}>
          <Shimmer width={24} height={24} borderRadius={RADIUS.full} />
          <Shimmer width={50} height={12} />
        </View>
        <Shimmer width={18} height={18} style={styles.arrowSkeleton} />
      </View>
    </View>
  );
}

const QuestionFeedSkeletonItem = memo(QuestionFeedSkeletonItemComponent);

function QuestionFeedSkeletonComponent({
  count = 3,
  variant = "default",
}: QuestionFeedSkeletonProps): React.ReactElement {
  return (
    <View accessibilityLabel={`Loading ${count} questions`}>
      {Array.from({ length: count }).map((_, index) => (
        <QuestionFeedSkeletonItem key={index} variant={variant} />
      ))}
    </View>
  );
}

export const QuestionFeedSkeleton = memo(QuestionFeedSkeletonComponent);

// ============================================================================
// GAMIFICATION SKELETON
// ============================================================================

export interface GamificationSkeletonProps {
  showStreak?: boolean;
  showPoints?: boolean;
  showProgress?: boolean;
  showLeaderboard?: boolean;
}

function GamificationSkeletonComponent({
  showStreak = true,
  showPoints = true,
  showProgress = true,
  showLeaderboard = true,
}: GamificationSkeletonProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.gamificationContainer}>
      {/* Header row - streak and points */}
      {(showStreak || showPoints) && (
        <View style={styles.gamificationHeaderRow}>
          {showStreak && (
            <Shimmer width={80} height={36} borderRadius={RADIUS.full} />
          )}
          {showPoints && (
            <Shimmer width={100} height={36} borderRadius={RADIUS.full} />
          )}
        </View>
      )}

      {/* Daily progress */}
      {showProgress && (
        <View style={styles.progressRow}>
          <View style={styles.progressItem}>
            <Shimmer width={80} height={80} borderRadius={RADIUS.full} />
            <Shimmer width={60} height={12} style={styles.progressLabel} />
          </View>
          <View style={styles.progressItem}>
            <Shimmer width={80} height={80} borderRadius={RADIUS.full} />
            <Shimmer width={60} height={12} style={styles.progressLabel} />
          </View>
          <View style={styles.progressItem}>
            <Shimmer width={80} height={80} borderRadius={RADIUS.full} />
            <Shimmer width={60} height={12} style={styles.progressLabel} />
          </View>
        </View>
      )}

      {/* Leaderboard */}
      {showLeaderboard && (
        <View 
          style={[
            styles.leaderboardSkeleton,
            { backgroundColor: colors.card },
          ]}
        >
          <View style={styles.leaderboardHeader}>
            <Shimmer width={140} height={20} />
            <Shimmer width={18} height={18} />
          </View>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.leaderboardItem}>
              <Shimmer width={20} height={20} />
              <Shimmer width={32} height={32} borderRadius={RADIUS.full} />
              <Shimmer width={100} height={14} style={styles.flex1} />
              <Shimmer width={50} height={14} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export const GamificationSkeleton = memo(GamificationSkeletonComponent);

// ============================================================================
// FEED TABS SKELETON
// ============================================================================

function FeedTabsSkeletonComponent(): React.ReactElement {
  return (
    <View style={styles.tabsContainer}>
      <Shimmer width={70} height={36} borderRadius={RADIUS.full} />
      <Shimmer width={60} height={36} borderRadius={RADIUS.full} />
      <Shimmer width={90} height={36} borderRadius={RADIUS.full} />
      <Shimmer width={70} height={36} borderRadius={RADIUS.full} />
    </View>
  );
}

export const FeedTabsSkeleton = memo(FeedTabsSkeletonComponent);

// ============================================================================
// STATS ROW SKELETON
// ============================================================================

function StatsRowSkeletonComponent(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.statsRowContainer}>
      <View style={[styles.statCard, { backgroundColor: colors.card }]}>
        <Shimmer width={36} height={36} borderRadius={RADIUS.md} />
        <Shimmer width={60} height={20} />
        <Shimmer width={80} height={12} />
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.card }]}>
        <Shimmer width={36} height={36} borderRadius={RADIUS.md} />
        <Shimmer width={70} height={20} />
        <Shimmer width={90} height={12} />
      </View>
    </View>
  );
}

export const StatsRowSkeleton = memo(StatsRowSkeletonComponent);

// ============================================================================
// ACTION CARD SKELETON
// ============================================================================

function ActionCardSkeletonComponent(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View 
      style={[
        styles.actionCardSkeleton,
        { backgroundColor: colors.card },
      ]}
    >
      <Shimmer width={56} height={56} borderRadius={RADIUS.lg} />
      <View style={styles.actionCardContent}>
        <Shimmer width="80%" height={18} />
        <Shimmer width="60%" height={14} style={styles.actionCardSubtitle} />
        <View style={styles.actionCardBadges}>
          <Shimmer width={70} height={24} borderRadius={RADIUS.full} />
          <Shimmer width={80} height={24} borderRadius={RADIUS.full} />
        </View>
      </View>
      <Shimmer width={70} height={36} borderRadius={RADIUS.md} />
    </View>
  );
}

export const ActionCardSkeleton = memo(ActionCardSkeletonComponent);

// ============================================================================
// SECTION HEADER SKELETON
// ============================================================================

function SectionHeaderSkeletonComponent(): React.ReactElement {
  return (
    <View style={styles.sectionHeaderSkeleton}>
      <View style={styles.sectionHeaderLeft}>
        <Shimmer width={18} height={18} borderRadius={RADIUS.sm} />
        <View>
          <Shimmer width={140} height={18} />
          <Shimmer width={100} height={12} style={styles.sectionSubtitle} />
        </View>
      </View>
      <Shimmer width={60} height={14} />
    </View>
  );
}

export const SectionHeaderSkeleton = memo(SectionHeaderSkeletonComponent);

// ============================================================================
// COMBINED FEED SKELETON (Full screen skeleton)
// ============================================================================

export interface FeedSkeletonProps {
  showHeader?: boolean;
  showTabs?: boolean;
  showGamification?: boolean;
  showStats?: boolean;
  showActionCard?: boolean;
  questionCount?: number;
}

function FeedSkeletonComponent({
  showHeader = true,
  showTabs = true,
  showGamification = false,
  showStats = true,
  showActionCard = true,
  questionCount = 5,
}: FeedSkeletonProps): React.ReactElement {
  return (
    <View style={styles.feedSkeleton}>
      {/* Header */}
      {showHeader && (
        <View style={styles.headerSkeleton}>
          <View>
            <Shimmer width={120} height={28} />
            <Shimmer width={180} height={14} style={styles.headerSubtitle} />
          </View>
          <View style={styles.headerActions}>
            <Shimmer width={44} height={44} borderRadius={RADIUS.base} />
            <Shimmer width={44} height={44} borderRadius={RADIUS.base} />
          </View>
        </View>
      )}

      {/* Search */}
      <Shimmer 
        width="100%" 
        height={48} 
        borderRadius={RADIUS.md} 
        style={styles.searchSkeleton}
      />

      {/* Tabs */}
      {showTabs && <FeedTabsSkeleton />}

      {/* Gamification */}
      {showGamification && <GamificationSkeleton />}

      {/* Action card */}
      {showActionCard && <ActionCardSkeleton />}

      {/* Stats */}
      {showStats && <StatsRowSkeleton />}

      {/* Section header */}
      <SectionHeaderSkeleton />

      {/* Questions */}
      <QuestionFeedSkeleton count={questionCount} />
    </View>
  );
}

export const FeedSkeleton = memo(FeedSkeletonComponent);

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Question card skeleton
  questionCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  questionCardCompact: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  badgesRow: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  textContainer: {
    marginBottom: SPACING.sm,
  },
  textLine: {
    marginBottom: SPACING.xs,
  },
  rewardRow: {
    marginBottom: SPACING.sm,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  authorInfo: {
    gap: SPACING.xs,
  },
  authorRep: {
    marginTop: SPACING.xxs,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  arrowSkeleton: {
    marginLeft: "auto",
  },

  // Gamification skeleton
  gamificationContainer: {
    gap: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  gamificationHeaderRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  progressItem: {
    alignItems: "center",
    gap: SPACING.sm,
  },
  progressLabel: {
    marginTop: SPACING.xs,
  },
  leaderboardSkeleton: {
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
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  flex1: {
    flex: 1,
  },

  // Tabs skeleton
  tabsContainer: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
    marginBottom: SPACING.md,
  },

  // Stats row skeleton
  statsRowContainer: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },

  // Action card skeleton
  actionCardSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  actionCardContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  actionCardSubtitle: {
    marginTop: SPACING.xxs,
  },
  actionCardBadges: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },

  // Section header skeleton
  sectionHeaderSkeleton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  sectionSubtitle: {
    marginTop: SPACING.xxs,
  },

  // Feed skeleton
  feedSkeleton: {
    paddingHorizontal: SPACING.base,
  },
  headerSkeleton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  headerSubtitle: {
    marginTop: SPACING.xs,
  },
  headerActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  searchSkeleton: {
    marginBottom: SPACING.lg,
  },
});

export default {
  Shimmer,
  QuestionFeedSkeleton,
  GamificationSkeleton,
  FeedTabsSkeleton,
  StatsRowSkeleton,
  ActionCardSkeleton,
  SectionHeaderSkeleton,
  FeedSkeleton,
};
