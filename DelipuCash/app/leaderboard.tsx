/**
 * Full Leaderboard Screen
 *
 * Displays the complete ranking of top earners with a Duolingo-inspired
 * podium header for the top 3 and a scrollable list for ranks 4–50.
 * Features time-period tabs (architecture-ready), pull-to-refresh,
 * and a sticky current-user rank bar.
 *
 * Navigate here from LeaderboardCard "View All" on the home screen.
 */

import React, { memo, useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  Platform,
  Dimensions,
  ListRenderItem,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  Trophy,
  Crown,
  Medal,
  Users,
  Star,
  MessageCircle,
} from "lucide-react-native";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from "@/utils/theme";
import { useQuestionsLeaderboard, type LeaderboardUser } from "@/services/questionHooks";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isTablet = SCREEN_WIDTH >= 768;
const isSmallScreen = SCREEN_WIDTH < 375;

const rs = (s: number, m: number, l: number) =>
  isTablet ? l : isSmallScreen ? s : m;

// ─── Medal colors ───────────────────────────────────────────────────────────
const MEDAL_COLORS = {
  gold: { primary: "#FFD700", secondary: "#FFA500", bg: "rgba(255, 215, 0, 0.12)" },
  silver: { primary: "#C0C0C0", secondary: "#A8A8A8", bg: "rgba(192, 192, 192, 0.12)" },
  bronze: { primary: "#CD7F32", secondary: "#A0522D", bg: "rgba(205, 127, 50, 0.12)" },
} as const;

// ─── Time period tabs ───────────────────────────────────────────────────────
type TimePeriod = "all" | "weekly" | "today";
const TIME_TABS: { id: TimePeriod; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "weekly", label: "This Week" },
  { id: "today", label: "Today" },
];

const MAX_ANIMATED_INDEX = 15;

// ─── Format helpers ─────────────────────────────────────────────────────────
function formatPoints(pts: number): string {
  if (pts >= 1_000_000) return `${(pts / 1_000_000).toFixed(1)}M`;
  if (pts >= 1_000) return `${(pts / 1_000).toFixed(1)}K`;
  return pts.toLocaleString();
}

function getInitial(name: string): string {
  return (name.charAt(0) || "?").toUpperCase();
}

// ─── Podium Position (Hero) ─────────────────────────────────────────────────
const HeroPodiumPosition = memo(function HeroPodiumPosition({
  user,
  rank,
  delay,
}: {
  user: LeaderboardUser;
  rank: 1 | 2 | 3;
  delay: number;
}) {
  const { colors } = useTheme();
  const medal =
    rank === 1 ? MEDAL_COLORS.gold : rank === 2 ? MEDAL_COLORS.silver : MEDAL_COLORS.bronze;
  const RankIcon = rank === 1 ? Crown : Medal;
  const avatarSize = rank === 1 ? rs(56, 64, 76) : rs(44, 52, 60);
  const barHeight = rank === 1 ? rs(64, 72, 84) : rank === 2 ? rs(48, 56, 64) : rs(36, 44, 52);

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(450).springify().damping(14)}
      style={styles.heroPodiumPosition}
      accessibilityLabel={`Rank ${rank}: ${user.name}, ${user.points} points`}
    >
      {/* Medal icon */}
      <RankIcon
        size={rank === 1 ? rs(22, 24, 28) : rs(16, 18, 22)}
        color={medal.primary}
        fill={medal.primary}
      />

      {/* Avatar with gradient ring */}
      <View style={{ marginVertical: SPACING.xs }}>
        <LinearGradient
          colors={[medal.primary, medal.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroAvatarRing,
            {
              width: avatarSize + 6,
              height: avatarSize + 6,
              borderRadius: (avatarSize + 6) / 2,
            },
          ]}
        >
          <View
            style={[
              styles.heroAvatarInner,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: medal.bg,
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
                  styles.heroAvatarInitial,
                  { fontSize: avatarSize * 0.38, color: medal.primary },
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
        style={[
          styles.heroName,
          { color: colors.text, fontSize: rank === 1 ? TYPOGRAPHY.fontSize.base : TYPOGRAPHY.fontSize.sm },
        ]}
        numberOfLines={1}
      >
        {user.name.split(" ")[0]}
      </Text>

      {/* Points */}
      <Text style={[styles.heroPoints, { color: medal.primary }]}>
        {formatPoints(user.points)} pts
      </Text>

      {/* Podium bar */}
      <LinearGradient
        colors={[medal.primary, medal.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.heroPodiumBar,
          { height: barHeight },
        ]}
      >
        <Text style={styles.heroPodiumRank}>{rank}</Text>
      </LinearGradient>
    </Animated.View>
  );
});

// ─── Ranked list row ────────────────────────────────────────────────────────
const RankedRow = memo(function RankedRow({
  user,
  isCurrentUser,
  index,
}: {
  user: LeaderboardUser;
  isCurrentUser: boolean;
  index: number;
}) {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={index < MAX_ANIMATED_INDEX ? FadeIn.delay(index * 40).duration(300) : undefined}
      style={[
        styles.rankedRow,
        {
          backgroundColor: isCurrentUser
            ? withAlpha(colors.primary, 0.08)
            : colors.card,
          borderColor: isCurrentUser
            ? withAlpha(colors.primary, 0.15)
            : "transparent",
        },
      ]}
      accessibilityLabel={`Rank ${user.rank}: ${user.name}, ${user.points} points${isCurrentUser ? " (you)" : ""}`}
    >
      {/* Rank */}
      <View style={styles.rankColumn}>
        <Text
          style={[
            styles.rankNumber,
            {
              color: isCurrentUser ? colors.primary : colors.textMuted,
            },
          ]}
        >
          {user.rank}
        </Text>
      </View>

      {/* Avatar */}
      <View
        style={[
          styles.rowAvatar,
          { backgroundColor: withAlpha(colors.primary, 0.1) },
        ]}
      >
        {user.avatar ? (
          <ExpoImage
            source={{ uri: user.avatar }}
            style={styles.rowAvatarImage}
            cachePolicy="memory-disk"
            contentFit="cover"
          />
        ) : (
          <Text style={[styles.rowAvatarInitial, { color: colors.primary }]}>
            {getInitial(user.name)}
          </Text>
        )}
      </View>

      {/* Name + answers count */}
      <View style={styles.rowInfo}>
        <Text
          style={[
            styles.rowName,
            { color: isCurrentUser ? colors.primary : colors.text },
          ]}
          numberOfLines={1}
        >
          {user.name}
          {isCurrentUser && (
            <Text style={[styles.youBadge, { color: colors.primary }]}> (You)</Text>
          )}
        </Text>
        {(user as any).answersCount !== undefined && (
          <View style={styles.answersRow}>
            <MessageCircle size={10} color={colors.textMuted} />
            <Text style={[styles.answersText, { color: colors.textMuted }]}>
              {(user as any).answersCount} answers
            </Text>
          </View>
        )}
      </View>

      {/* Points */}
      <Text
        style={[
          styles.rowPoints,
          { color: isCurrentUser ? colors.primary : colors.text },
        ]}
      >
        {formatPoints(user.points)}
      </Text>
    </Animated.View>
  );
});

// ─── Main Screen ────────────────────────────────────────────────────────────
export default function LeaderboardScreen() {
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedTab, setSelectedTab] = useState<TimePeriod>("all");
  const [refreshing, setRefreshing] = useState(false);

  const { data: leaderboard, isLoading, refetch } = useQuestionsLeaderboard(50);

  const top3 = useMemo(() => (leaderboard?.users ?? []).slice(0, 3), [leaderboard]);
  const rest = useMemo(() => (leaderboard?.users ?? []).slice(3), [leaderboard]);
  const currentUserRank = leaderboard?.currentUserRank ?? 0;
  const totalUsers = leaderboard?.totalUsers ?? 0;

  // Podium order: #2 left, #1 center, #3 right
  const podiumOrder = useMemo(
    () => [top3[1], top3[0], top3[2]].filter(Boolean),
    [top3]
  );

  const showStickyFooter =
    currentUserRank > 3 && !rest.some((u) => u.rank === currentUserRank);

  // Handlers
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  const handleTabPress = useCallback((tab: TimePeriod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTab(tab);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // FlatList key extractor and render item
  const keyExtractor = useCallback((item: LeaderboardUser) => item.id, []);

  const renderItem: ListRenderItem<LeaderboardUser> = useCallback(
    ({ item, index }) => (
      <RankedRow
        user={item}
        isCurrentUser={item.rank === currentUserRank}
        index={index}
      />
    ),
    [currentUserRank]
  );

  // Header component for FlatList (podium + tabs)
  const ListHeader = useMemo(
    () => (
      <View>
        {/* Podium hero */}
        {top3.length > 0 && (
          <View style={[styles.podiumHero, { backgroundColor: colors.card }]}>
            <View style={styles.podiumRow}>
              {podiumOrder.map((user) => {
                if (!user) return null;
                const rank = user.rank as 1 | 2 | 3;
                return (
                  <HeroPodiumPosition
                    key={user.id}
                    user={user}
                    rank={rank}
                    delay={rank === 1 ? 100 : rank === 2 ? 200 : 300}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Time period tabs */}
        <View style={styles.tabsContainer}>
          {TIME_TABS.map((tab) => {
            const isActive = tab.id === selectedTab;
            return (
              <Pressable
                key={tab.id}
                onPress={() => handleTabPress(tab.id)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: isActive
                      ? colors.primary
                      : withAlpha(colors.textMuted, 0.08),
                  },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${tab.label} leaderboard`}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: isActive ? "#FFFFFF" : colors.textMuted },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Subheader */}
        {rest.length > 0 && (
          <Text style={[styles.subheader, { color: colors.textMuted }]}>
            Rankings #{top3.length + 1}–{top3.length + rest.length}
          </Text>
        )}
      </View>
    ),
    [top3, podiumOrder, selectedTab, rest.length, colors, handleTabPress]
  );

  // Empty / loading state
  const ListEmpty = useMemo(
    () =>
      isLoading ? (
        <View style={styles.emptyContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[styles.skeletonRow, { backgroundColor: withAlpha(colors.textMuted, 0.06) }]}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Star size={40} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No rankings yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Start earning points to appear on the leaderboard!
          </Text>
        </View>
      ),
    [isLoading, colors]
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACING.sm,
            backgroundColor: colors.background,
            borderBottomColor: withAlpha(colors.border, 0.5),
          },
        ]}
      >
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Trophy size={18} color="#FFD700" fill="#FFD700" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Leaderboard</Text>
        </View>
        {totalUsers > 0 && (
          <View style={styles.headerRight}>
            <Users size={12} color={colors.textMuted} />
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {totalUsers.toLocaleString()}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* List */}
      <FlatList
        data={rest}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: showStickyFooter ? 80 + insets.bottom : insets.bottom + SPACING.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        // Perf
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
      />

      {/* Sticky current user bar */}
      {showStickyFooter && (
        <Animated.View
          entering={FadeInUp.delay(400).duration(300)}
          style={[
            styles.stickyFooter,
            {
              backgroundColor: colors.card,
              borderTopColor: withAlpha(colors.border, 0.5),
              paddingBottom: insets.bottom + SPACING.sm,
            },
          ]}
        >
          <View
            style={[
              styles.stickyInner,
              {
                backgroundColor: withAlpha(colors.primary, 0.08),
                borderColor: withAlpha(colors.primary, 0.15),
              },
            ]}
            accessibilityLabel={`Your rank: number ${currentUserRank} of ${totalUsers}`}
          >
            <Text style={[styles.stickyLabel, { color: colors.text }]}>Your Rank</Text>
            <View style={[styles.stickyBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.stickyBadgeText}>#{currentUserRank}</Text>
            </View>
            <Text style={[styles.stickySuffix, { color: colors.textMuted }]}>
              of {totalUsers.toLocaleString()} earners
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  headerTitle: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 40,
  },
  headerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Podium hero
  podiumHero: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    marginHorizontal: SPACING.base,
    marginTop: SPACING.md,
    borderRadius: RADIUS.xl,
    ...SHADOWS.sm,
  },
  podiumRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: SPACING.md,
    gap: isSmallScreen ? SPACING.sm : SPACING.lg,
  },
  heroPodiumPosition: {
    alignItems: "center",
    flex: 1,
    maxWidth: isTablet ? 140 : 110,
  },
  heroAvatarRing: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatarInner: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroAvatarInitial: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
  },
  heroName: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.medium,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: rs(70, 85, 110),
  },
  heroPoints: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
    marginBottom: SPACING.xs,
  },
  heroPodiumBar: {
    width: "90%",
    borderTopLeftRadius: RADIUS.sm,
    borderTopRightRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPodiumRank: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    color: "rgba(255,255,255,0.9)",
  },

  // Tabs
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    alignItems: "center",
  },
  tabText: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.medium,
    fontWeight: "600",
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Subheader
  subheader: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.base,
    marginBottom: SPACING.sm,
  },

  // List
  listContent: {
    flexGrow: 1,
  },

  // Ranked rows
  rankedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.base,
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  rankColumn: {
    width: 28,
    alignItems: "center",
  },
  rankNumber: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  rowAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  rowAvatarInitial: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.medium,
    fontWeight: "600",
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  youBadge: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: "400",
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  answersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  answersText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  rowPoints: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.fontSize.base,
  },

  // Sticky footer
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.base,
    borderTopWidth: 1,
    ...SHADOWS.md,
  },
  stickyInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  stickyLabel: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.medium,
    fontWeight: "600",
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  stickyBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  stickyBadgeText: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: "#FFFFFF",
  },
  stickySuffix: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
    textAlign: "right",
  },

  // Empty / skeleton
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING["3xl"],
    gap: SPACING.md,
  },
  emptyTitle: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: "center",
    paddingHorizontal: SPACING["2xl"],
  },
  skeletonRow: {
    height: 52,
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
  },
});
