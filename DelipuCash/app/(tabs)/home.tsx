import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Href } from "expo-router";
import {
  Wallet,
  TrendingUp,
  Gift,
  Play,
  Award,
  Target,
  BarChart3,
  Zap,
  Calendar,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
} from "@/utils/theme";
import useUser from "@/utils/useUser";
import {
  StatCard,
  SurveyCard,
  QuestionCard,
  VideoCard,
  DailyRewardCard,
  SectionHeader,
  SearchBar,
  ProgressCard,
  NotificationBell,
} from "@/components";
import {
  useTrendingVideos,
  useRecentQuestions,
  useRunningSurveys,
  useUpcomingSurveys,
  useDailyReward,
  useDashboardStats,
  useClaimDailyReward,
  useUnreadCount,
} from "@/services/hooks";

/**
 * Home screen component (Dashboard)
 * Displays comprehensive user dashboard with all essential features
 *
 * Sections:
 * - Search bar
 * - Daily rewards card
 * - Wallet & quick stats
 * - Trending videos
 * - Questions & rewards section
 * - Recent questions
 * - Running surveys
 * - Upcoming surveys
 * - Statistics cards (Earnings, Engagement, Rewards progress)
 */
export default function HomePage(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { data: user, loading, refetch } = useUser();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Data hooks
  const { data: trendingVideos, refetch: refetchVideos } = useTrendingVideos(5);
  const { data: recentQuestions, refetch: refetchQuestions } = useRecentQuestions(5);
  const { data: runningSurveys, refetch: refetchRunningSurveys } = useRunningSurveys();
  const { data: upcomingSurveys, refetch: refetchUpcomingSurveys } = useUpcomingSurveys();
  const { data: dailyReward, refetch: refetchDailyReward } = useDailyReward();
  const { data: dashboardStats, refetch: refetchStats } = useDashboardStats();
  const { data: unreadCount } = useUnreadCount();
  const claimDailyReward = useClaimDailyReward();

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      refetchVideos(),
      refetchQuestions(),
      refetchRunningSurveys(),
      refetchUpcomingSurveys(),
      refetchDailyReward(),
      refetchStats(),
    ]);
    setRefreshing(false);
  }, [refetch, refetchVideos, refetchQuestions, refetchRunningSurveys, refetchUpcomingSurveys, refetchDailyReward, refetchStats]);

  const handleClaimDailyReward = useCallback(async () => {
    try {
      await claimDailyReward.mutateAsync();
    } catch (error) {
      console.error("Failed to claim daily reward:", error);
    }
  }, [claimDailyReward]);

  const handleSearch = useCallback((query: string) => {
    // Navigate to search results or filter content
    console.log("Search:", query);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>
              Welcome back,
            </Text>
            <Text style={[styles.username, { color: colors.text }]}>
              {user?.firstName || "User"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell
              count={unreadCount ?? 0}
              onPress={() => router.push("/notifications" as Href)}
            />
          </View>
        </View>

        {/* Search Bar */}
        <SearchBar
          placeholder="Search videos, surveys, questions..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmit={handleSearch}
          style={styles.searchBar}
        />

        {/* Daily Rewards Card */}
        {dailyReward && (
          <DailyRewardCard
            isAvailable={dailyReward.isAvailable}
            nextRewardIn={dailyReward.nextRewardIn}
            currentStreak={dailyReward.currentStreak}
            todayReward={dailyReward.todayReward}
            streakBonus={dailyReward.streakBonus}
            onClaim={handleClaimDailyReward}
            isLoading={claimDailyReward.isPending}
          />
        )}

        {/* Wallet Card */}
        <View style={[styles.walletCard, { backgroundColor: colors.primary }]}>
          <View style={styles.walletHeader}>
            <Wallet size={24} color="#FFFFFF" strokeWidth={1.5} />
            <Text style={styles.walletLabel}>Wallet Balance</Text>
          </View>
          <Text style={styles.walletBalance}>
            ${user?.walletBalance?.toLocaleString() || "0.00"}
          </Text>
          <View style={styles.walletActions}>
            <TouchableOpacity
              style={styles.walletButton}
              onPress={() => router.push("/(tabs)/withdraw")}
              accessibilityRole="button"
              accessibilityLabel="Withdraw funds"
            >
              <Text style={styles.walletButtonText}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.walletButton, styles.walletButtonSecondary]}
              onPress={() => router.push("/(tabs)/transactions")}
              accessibilityRole="button"
              accessibilityLabel="View transactions"
            >
              <Text style={styles.walletButtonText}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            icon={<TrendingUp size={20} color={colors.success} strokeWidth={1.5} />}
            title="Total Earnings"
            value={`$${dashboardStats?.totalEarnings?.toLocaleString() || "0"}`}
            subtitle={`+$${dashboardStats?.weeklyEarnings || 0} this week`}
            subtitleColor={colors.success}
            onPress={() => router.push("/(tabs)/transactions")}
          />
          <StatCard
            icon={<Gift size={20} color={colors.warning} strokeWidth={1.5} />}
            title="Rewards Earned"
            value={dashboardStats?.rewardsProgress || 0}
            subtitle={`Goal: ${dashboardStats?.rewardsGoal || 2000}`}
            onPress={() => router.push("/(tabs)/transactions")}
          />
        </View>

        {/* Trending Videos Section */}
        <SectionHeader
          title="Trending Videos"
          subtitle="Most watched this week"
          icon={<Play size={20} color={colors.error} strokeWidth={1.5} />}
          onSeeAll={() => router.push("/(tabs)/videos")}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          {trendingVideos?.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              variant="compact"
              onPress={() => router.push(`/(tabs)/videos`)}
            />
          ))}
        </ScrollView>

        {/* Questions & Rewards Section */}
        <SectionHeader
          title="Questions & Rewards"
          subtitle="Answer and earn"
          icon={<Award size={20} color={colors.primary} strokeWidth={1.5} />}
          onSeeAll={() => router.push("/(tabs)/questions")}
        />
        
        {/* Recent Questions */}
        <View style={styles.questionsContainer}>
          {recentQuestions?.slice(0, 3).map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              variant="compact"
              onPress={() => router.push(`/question/${question.id}`)}
            />
          ))}
        </View>

        {/* Running Surveys Section */}
        <SectionHeader
          title="Running Surveys"
          subtitle="Complete and earn rewards"
          icon={<Zap size={20} color={colors.success} strokeWidth={1.5} />}
          onSeeAll={() => router.push("/(tabs)/surveys")}
        />
        <View style={styles.surveysContainer}>
          {runningSurveys?.slice(0, 2).map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onPress={() => router.push(`/survey/${survey.id}`)}
            />
          ))}
          {(!runningSurveys || runningSurveys.length === 0) && (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
                No running surveys at the moment
              </Text>
            </View>
          )}
        </View>

        {/* Upcoming Surveys Section */}
        <SectionHeader
          title="Upcoming Surveys"
          subtitle="Don't miss out"
          icon={<Calendar size={20} color={colors.warning} strokeWidth={1.5} />}
          onSeeAll={() => router.push("/(tabs)/surveys")}
        />
        <View style={styles.surveysContainer}>
          {upcomingSurveys?.slice(0, 2).map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              variant="compact"
              onPress={() => router.push(`/survey/${survey.id}`)}
            />
          ))}
          {(!upcomingSurveys || upcomingSurveys.length === 0) && (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
                No upcoming surveys scheduled
              </Text>
            </View>
          )}
        </View>

        {/* Statistics Section */}
        <SectionHeader
          title="Your Statistics"
          subtitle="Track your progress"
          icon={<BarChart3 size={20} color={colors.info} strokeWidth={1.5} />}
        />
        
        {/* Earnings Card */}
        <ProgressCard
          title="Weekly Earnings Goal"
          current={dashboardStats?.weeklyEarnings || 0}
          goal={200}
          unit="$"
          icon={<TrendingUp size={20} color={colors.success} strokeWidth={1.5} />}
          progressColor={colors.success}
          style={styles.progressCard}
        />

        {/* Engagement Stats */}
        <View style={styles.engagementRow}>
          <StatCard
            icon={<Award size={18} color={colors.primary} strokeWidth={1.5} />}
            title="Questions"
            value={dashboardStats?.questionsAnswered || 0}
            variant="compact"
            style={styles.engagementCard}
          />
          <StatCard
            icon={<Zap size={18} color={colors.success} strokeWidth={1.5} />}
            title="Surveys"
            value={dashboardStats?.surveysCompleted || 0}
            variant="compact"
            style={styles.engagementCard}
          />
          <StatCard
            icon={<Play size={18} color={colors.error} strokeWidth={1.5} />}
            title="Videos"
            value={dashboardStats?.videosWatched || 0}
            variant="compact"
            style={styles.engagementCard}
          />
        </View>

        {/* Rewards Progress */}
        <ProgressCard
          title="Rewards Progress"
          current={dashboardStats?.rewardsProgress || 0}
          goal={dashboardStats?.rewardsGoal || 2000}
          unit="points"
          icon={<Target size={20} color={colors.warning} strokeWidth={1.5} />}
          progressColor={colors.warning}
          showPercentage
          style={styles.progressCard}
        />

        {/* Bottom Spacing */}
        <View style={{ height: insets.bottom + SPACING.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.base,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.base,
  },
  greeting: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  username: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["3xl"],
    marginTop: SPACING.xs,
  },
  headerActions: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  searchBar: {
    marginBottom: SPACING.lg,
  },
  walletCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  walletHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  walletLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: "rgba(255, 255, 255, 0.8)",
    marginLeft: SPACING.sm,
  },
  walletBalance: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["6xl"],
    color: "#FFFFFF",
    marginBottom: SPACING.base,
  },
  walletActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  walletButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md + 2,
  },
  walletButtonSecondary: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  walletButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: "#FFFFFF",
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  horizontalScrollContent: {
    paddingRight: SPACING.base,
  },
  questionsContainer: {
    marginBottom: SPACING.sm,
  },
  surveysContainer: {
    marginBottom: SPACING.sm,
  },
  emptyState: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  emptyStateText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  progressCard: {
    marginBottom: SPACING.md,
  },
  engagementRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  engagementCard: {
    flex: 1,
  },
});
