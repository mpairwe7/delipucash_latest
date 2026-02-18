/**
 * LeaderboardCard Component
 * Inline Duolingo-inspired podium widget for the home screen explore section.
 * Shows top 3 users with a visual podium and the current user's rank.
 *
 * @example
 * ```tsx
 * <LeaderboardCard
 *   users={leaderboard.users}
 *   currentUserRank={leaderboard.currentUserRank}
 *   totalUsers={leaderboard.totalUsers}
 *   onViewAll={() => router.push('/leaderboard')}
 *   isLoading={isLoading}
 * />
 * ```
 */

import React, { memo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
  StyleProp,
  ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInUp,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";
import {
  Trophy,
  Crown,
  Medal,
  ChevronRight,
  Users,
  Star,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from "@/utils/theme";
import type { LeaderboardUser } from "@/services/questionHooks";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isTablet = SCREEN_WIDTH >= 768;
const isSmallScreen = SCREEN_WIDTH < 375;

// ─── Podium medal colors ────────────────────────────────────────────────────
const MEDAL_COLORS = {
  gold: { primary: "#FFD700", secondary: "#FFA500", bg: "rgba(255, 215, 0, 0.12)" },
  silver: { primary: "#C0C0C0", secondary: "#A8A8A8", bg: "rgba(192, 192, 192, 0.12)" },
  bronze: { primary: "#CD7F32", secondary: "#A0522D", bg: "rgba(205, 127, 50, 0.12)" },
} as const;

// ─── Animation configs ──────────────────────────────────────────────────────
const SPRING_PRESS = { damping: 15, stiffness: 150, mass: 0.5 };

// ─── Responsive helpers ─────────────────────────────────────────────────────
const rs = (s: number, m: number, l: number) =>
  isTablet ? l : isSmallScreen ? s : m;

// ─── Props ──────────────────────────────────────────────────────────────────
export interface LeaderboardCardProps {
  /** Top users to display (needs at least 1, ideally 3) */
  users: LeaderboardUser[];
  /** Current user's overall rank */
  currentUserRank?: number;
  /** Total number of ranked users */
  totalUsers?: number;
  /** Navigate to full leaderboard screen */
  onViewAll: () => void;
  /** Show loading skeleton */
  isLoading?: boolean;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
}

// ─── Format helpers ─────────────────────────────────────────────────────────
function formatPoints(pts: number): string {
  if (pts >= 1_000_000) return `${(pts / 1_000_000).toFixed(1)}M`;
  if (pts >= 1_000) return `${(pts / 1_000).toFixed(1)}K`;
  return pts.toLocaleString();
}

function getInitial(name: string): string {
  return (name.charAt(0) || "?").toUpperCase();
}

// ─── Podium Position ────────────────────────────────────────────────────────
const PodiumPosition = memo(function PodiumPosition({
  user,
  rank,
  delay,
}: {
  user: LeaderboardUser;
  rank: 1 | 2 | 3;
  delay: number;
}) {
  const { colors } = useTheme();

  const medalConfig =
    rank === 1 ? MEDAL_COLORS.gold : rank === 2 ? MEDAL_COLORS.silver : MEDAL_COLORS.bronze;
  const RankIcon = rank === 1 ? Crown : Medal;
  const avatarSize = rank === 1 ? rs(44, 48, 56) : rs(36, 40, 48);
  const barHeight = rank === 1 ? rs(48, 56, 64) : rank === 2 ? rs(36, 42, 50) : rs(28, 34, 42);
  const nameSize = rank === 1 ? TYPOGRAPHY.fontSize.sm : TYPOGRAPHY.fontSize.xs;

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(400).springify().damping(14)}
      style={styles.podiumPosition}
      accessibilityLabel={`Rank ${rank}: ${user.name}, ${user.points} points`}
    >
      {/* Crown / Medal */}
      <RankIcon
        size={rank === 1 ? rs(18, 20, 24) : rs(14, 16, 20)}
        color={medalConfig.primary}
        fill={medalConfig.primary}
      />

      {/* Avatar with gradient ring */}
      <View style={[styles.avatarRingOuter, { padding: rank === 1 ? 2.5 : 2 }]}>
        <LinearGradient
          colors={[medalConfig.primary, medalConfig.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.avatarRing,
            {
              width: avatarSize + (rank === 1 ? 5 : 4),
              height: avatarSize + (rank === 1 ? 5 : 4),
              borderRadius: (avatarSize + 6) / 2,
            },
          ]}
        >
          <View
            style={[
              styles.avatarInner,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: medalConfig.bg,
              },
            ]}
          >
            {user.avatar ? (
              <ExpoImage
                source={{ uri: user.avatar }}
                style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }}
                cachePolicy="memory-disk"
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Text
                style={[
                  styles.avatarInitial,
                  {
                    fontSize: avatarSize * 0.4,
                    color: medalConfig.primary,
                  },
                ]}
              >
                {getInitial(user.name)}
              </Text>
            )}
          </View>
        </LinearGradient>
      </View>

      {/* Name */}
      <Text
        style={[styles.podiumName, { color: colors.text, fontSize: nameSize }]}
        numberOfLines={1}
      >
        {user.name.split(" ")[0]}
      </Text>

      {/* Points */}
      <Text style={[styles.podiumPoints, { color: medalConfig.primary }]}>
        {formatPoints(user.points)}
      </Text>

      {/* Podium bar */}
      <LinearGradient
        colors={[medalConfig.primary, medalConfig.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.podiumBar,
          {
            height: barHeight,
            borderTopLeftRadius: RADIUS.sm,
            borderTopRightRadius: RADIUS.sm,
          },
        ]}
      >
        <Text style={styles.podiumRankNumber}>
          {rank}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
});

// ─── Skeleton loader ────────────────────────────────────────────────────────
function LeaderboardSkeleton() {
  const { colors } = useTheme();
  const shimmerBg = withAlpha(colors.textMuted, 0.1);

  return (
    <View style={styles.skeletonContainer}>
      {[42, 56, 36].map((h, i) => (
        <View key={i} style={styles.skeletonPosition}>
          <View style={[styles.skeletonCircle, { backgroundColor: shimmerBg }]} />
          <View style={[styles.skeletonBar, { height: h, backgroundColor: shimmerBg }]} />
        </View>
      ))}
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
function LeaderboardCardComponent({
  users,
  currentUserRank,
  totalUsers,
  onViewAll,
  isLoading = false,
  style,
}: LeaderboardCardProps): React.ReactElement {
  const { colors } = useTheme();

  // View All press animation
  const viewAllScale = useSharedValue(1);
  const viewAllPressed = useSharedValue(0);

  const handleViewAllPressIn = useCallback(() => {
    viewAllScale.value = withSpring(0.96, SPRING_PRESS);
    viewAllPressed.value = withSpring(1, SPRING_PRESS);
  }, [viewAllScale, viewAllPressed]);

  const handleViewAllPressOut = useCallback(() => {
    viewAllScale.value = withSpring(1, SPRING_PRESS);
    viewAllPressed.value = withSpring(0, SPRING_PRESS);
  }, [viewAllScale, viewAllPressed]);

  const handleViewAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onViewAll();
  }, [onViewAll]);

  const viewAllAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: viewAllScale.value }],
    opacity: interpolate(viewAllPressed.value, [0, 1], [1, 0.85], Extrapolation.CLAMP),
  }));

  // Sort podium: #2 left, #1 center, #3 right
  const top3 = users.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  const showCurrentUser = currentUserRank !== undefined && currentUserRank > 3;

  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(400)}
      style={[styles.container, { backgroundColor: colors.card }, style]}
      accessibilityRole="summary"
      accessibilityLabel="Leaderboard showing top earners"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.trophyBg, { backgroundColor: withAlpha("#FFD700", 0.12) }]}>
            <Trophy size={rs(16, 18, 20)} color="#FFD700" fill="#FFD700" />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>
              Leaderboard
            </Text>
            {totalUsers !== undefined && totalUsers > 0 && (
              <View style={styles.totalUsersRow}>
                <Users size={10} color={colors.textMuted} />
                <Text style={[styles.totalUsersText, { color: colors.textMuted }]}>
                  {totalUsers.toLocaleString()} earners
                </Text>
              </View>
            )}
          </View>
        </View>
        <AnimatedPressable
          onPress={handleViewAll}
          onPressIn={handleViewAllPressIn}
          onPressOut={handleViewAllPressOut}
          style={[styles.viewAllBtn, viewAllAnimStyle]}
          accessibilityRole="button"
          accessibilityLabel="View full leaderboard"
          accessibilityHint="Opens the complete leaderboard rankings"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
          <ChevronRight size={14} color={colors.primary} />
        </AnimatedPressable>
      </View>

      {/* Podium or Loading or Empty */}
      {isLoading ? (
        <LeaderboardSkeleton />
      ) : top3.length === 0 ? (
        <View style={styles.emptyState}>
          <Star size={28} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Be the first to earn points!
          </Text>
        </View>
      ) : (
        <View style={styles.podiumContainer}>
          {podiumOrder.map((user) => {
            if (!user) return null;
            const rank = user.rank as 1 | 2 | 3;
            const delay = rank === 1 ? 150 : rank === 2 ? 250 : 350;
            return (
              <PodiumPosition
                key={user.id}
                user={user}
                rank={rank}
                delay={delay}
              />
            );
          })}
        </View>
      )}

      {/* Current user rank bar */}
      {showCurrentUser && !isLoading && (
        <Animated.View
          entering={FadeIn.delay(450).duration(300)}
          style={[
            styles.currentUserBar,
            {
              backgroundColor: withAlpha(colors.primary, 0.08),
              borderColor: withAlpha(colors.primary, 0.15),
            },
          ]}
          accessibilityLabel={`Your rank: number ${currentUserRank}`}
        >
          <Text style={[styles.currentUserLabel, { color: colors.text }]}>
            You
          </Text>
          <View style={[styles.currentUserRankBadge, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
            <Text style={[styles.currentUserRankText, { color: colors.primary }]}>
              #{currentUserRank}
            </Text>
          </View>
          <Text style={[styles.currentUserSuffix, { color: colors.textMuted }]}>
            {totalUsers ? `of ${totalUsers.toLocaleString()}` : ""}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

export const LeaderboardCard = memo(LeaderboardCardComponent);
LeaderboardCard.displayName = "LeaderboardCard";

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    ...SHADOWS.sm,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  trophyBg: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  totalUsersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
  },
  totalUsersText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  viewAllText: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.medium,
    fontWeight: "600",
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Podium
  podiumContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    gap: isSmallScreen ? SPACING.sm : SPACING.md,
  },
  podiumPosition: {
    alignItems: "center",
    flex: 1,
    maxWidth: isTablet ? 120 : 100,
  },
  avatarRingOuter: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  avatarRing: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarInitial: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
  },
  podiumName: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.medium,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: rs(60, 72, 90),
  },
  podiumPoints: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 1,
    marginBottom: SPACING.xs,
  },
  podiumBar: {
    width: "85%",
    alignItems: "center",
    justifyContent: "center",
  },
  podiumRankNumber: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: "rgba(255,255,255,0.9)",
  },

  // Current user bar
  currentUserBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  currentUserLabel: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.medium,
    fontWeight: "600",
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  currentUserRankBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  currentUserRankText: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  currentUserSuffix: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING["2xl"],
    gap: SPACING.sm,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
  },

  // Skeleton
  skeletonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingVertical: SPACING.lg,
    gap: SPACING.lg,
  },
  skeletonPosition: {
    alignItems: "center",
    gap: SPACING.sm,
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  skeletonBar: {
    width: 50,
    borderRadius: RADIUS.sm,
  },
});

export default LeaderboardCard;
