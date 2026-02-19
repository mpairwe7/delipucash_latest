import {
  DailyRewardCard,
  NotificationBell,
  ProgressCard,
  QuestionCard,
  SearchBar,
  SearchOverlay,
  SectionHeader,
  StatCard,
  SurveyCard,
  VideoCard,
} from "@/components";
import {
  useClaimDailyReward,
  useDailyReward,
  useDashboardStats,
  useRecentQuestions,
  useRunningSurveys,
  useTrendingVideos,
  useUnreadCount,
  useUpcomingSurveys,
} from "@/services/hooks";
import {
  useBannerAds,
  useFeaturedAds,
  useAdsForPlacement,
  useRecordAdClick,
  useRecordAdImpression,
} from "@/services/adHooksRefactored";
import { useShouldShowAds } from "@/services/useShouldShowAds";
import {
  BannerAd,
  NativeAd,
  FeaturedAd,
  AdPlacementWrapper,
  AdCarousel,
  BetweenContentAd,
} from "@/components/ads";
import { useSearch } from "@/hooks/useSearch";
import type { Question, Survey, Video, Ad } from "@/types";
import {
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
} from "@/utils/theme";
import useUser from "@/utils/useUser";
import { Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Award,
  BarChart3,
  Calendar,
  Gift,
  Play,
  Target,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react-native";
import React, { useCallback, useState, useMemo } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

// Search result type for combined data
interface SearchableItem {
  id: string;
  type: 'video' | 'question' | 'survey';
  title: string;
  description?: string;
  data: Video | Question | Survey;
}

/**
 * Home screen component (Dashboard)
 * Displays comprehensive user dashboard with all essential features
 *
 * Sections:
 * - Search bar
 * - Daily rewards card
 * - Wallet & quick stats
 * - Featured ads carousel (industry standard placement)
 * - Trending videos
 * - Questions & rewards section
 * - Native ads between sections
 * - Recent questions
 * - Running surveys
 * - Upcoming surveys
 * - Statistics cards (Earnings, Engagement, Rewards progress)
 * 
 * Ad Placement Strategy (Industry Standards):
 * 1. Featured carousel after wallet (high visibility, non-intrusive)
 * 2. Native ad between trending videos and questions (blends with content)
 * 3. Banner ad between surveys sections (natural content break)
 * 4. Compact ad before statistics (minimal footprint)
 */
export default function HomePage(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { data: user, refetch } = useUser();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchOverlayVisible, setSearchOverlayVisible] = useState<boolean>(false);

  // Data hooks
  const { data: trendingVideos, refetch: refetchVideos } = useTrendingVideos(5);
  const { data: recentQuestions, refetch: refetchQuestions } = useRecentQuestions(5);
  const { data: runningSurveys, refetch: refetchRunningSurveys } = useRunningSurveys();
  const { data: upcomingSurveys, refetch: refetchUpcomingSurveys } = useUpcomingSurveys();
  const { data: dailyReward, refetch: refetchDailyReward } = useDailyReward();
  const { data: dashboardStats, refetch: refetchStats } = useDashboardStats();
  const { data: unreadCount } = useUnreadCount();
  const claimDailyReward = useClaimDailyReward();

  // Combine all searchable content for unified search
  const searchableData = useMemo<SearchableItem[]>(() => {
    const items: SearchableItem[] = [];

    // Add videos
    trendingVideos?.forEach((video: Video) => {
      items.push({
        id: video.id,
        type: 'video',
        title: video.title || 'Untitled Video',
        description: video.description || '',
        data: video,
      });
    });

    // Add questions
    recentQuestions?.forEach((question: Question) => {
      items.push({
        id: question.id,
        type: 'question',
        title: question.text || 'Question',
        description: question.category || '',
        data: question,
      });
    });

    // Add running surveys
    runningSurveys?.forEach((survey: Survey) => {
      items.push({
        id: survey.id,
        type: 'survey',
        title: survey.title,
        description: survey.description || '',
        data: survey,
      });
    });

    // Add upcoming surveys
    upcomingSurveys?.forEach((survey: Survey) => {
      items.push({
        id: survey.id,
        type: 'survey',
        title: survey.title,
        description: survey.description || '',
        data: survey,
      });
    });

    return items;
  }, [trendingVideos, recentQuestions, runningSurveys, upcomingSurveys]);

  // Use the search hook for home screen search
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filteredResults: searchResults,
    isSearching,
    recentSearches,
    removeFromHistory,
    clearHistory,
    submitSearch,
    suggestions,
  } = useSearch({
    data: searchableData,
    searchFields: ['title', 'description'],
    storageKey: '@home_search_history',
    debounceMs: 250,
  });

  // Ad hooks - gated by premium status (premium users see no ads)
  const { shouldShowAds } = useShouldShowAds();
  const { data: featuredAds, refetch: refetchFeaturedAds } = useFeaturedAds(3, { enabled: shouldShowAds });
  const { data: bannerAds, refetch: refetchBannerAds } = useBannerAds(2, { enabled: shouldShowAds });
  const { data: homeAds, refetch: refetchHomeAds } = useAdsForPlacement('home', 3, { enabled: shouldShowAds });
  const recordAdClick = useRecordAdClick();
  const recordAdImpression = useRecordAdImpression();

  // Ad interaction handlers with analytics
  const handleAdClick = useCallback((ad: Ad) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    recordAdClick.mutate({
      adId: ad.id,
      placement: 'home',
    });
  }, [recordAdClick]);

  const handleAdImpression = useCallback((ad: Ad) => {
    recordAdImpression.mutate({
      adId: ad.id,
      placement: 'home',
      duration: 0,
      wasVisible: true,
      viewportPercentage: 100,
    });
  }, [recordAdImpression]);

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
      refetchFeaturedAds(),
      refetchBannerAds(),
      refetchHomeAds(),
    ]);
    setRefreshing(false);
  }, [refetch, refetchVideos, refetchQuestions, refetchRunningSurveys, refetchUpcomingSurveys, refetchDailyReward, refetchStats, refetchFeaturedAds, refetchBannerAds, refetchHomeAds]);

  const handleClaimDailyReward = useCallback(async () => {
    try {
      await claimDailyReward.mutateAsync();
    } catch (error) {
      console.error("Failed to claim daily reward:", error);
    }
  }, [claimDailyReward]);

  // Handle search submission and navigation
  const handleSearchSubmit = useCallback((query: string) => {
    submitSearch(query);
    setSearchOverlayVisible(false);

    // If searching, filter and navigate based on results
    if (query.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [submitSearch]);

  // Stable navigation callbacks to preserve React.memo on child components
  const goToNotifications = useCallback(() => router.push("/notifications" as Href), []);
  const goToWithdraw = useCallback(() => router.push("/(tabs)/withdraw"), []);
  const goToTransactions = useCallback(() => router.push("/(tabs)/transactions"), []);
  const goToVideos = useCallback(() => router.push("/(tabs)/videos-new"), []);
  const goToQuestions = useCallback(() => router.push("/(tabs)/questions-new"), []);
  const goToSurveys = useCallback(() => router.push("/(tabs)/surveys-new"), []);
  const openSearchOverlay = useCallback(() => setSearchOverlayVisible(true), []);
  const closeSearchOverlay = useCallback(() => setSearchOverlayVisible(false), []);

  // Handle pressing on a search result
  const handleSearchResultPress = useCallback((item: SearchableItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchOverlayVisible(false);

    switch (item.type) {
      case 'video':
        router.push(`/(tabs)/videos-new`);
        break;
      case 'question':
        router.push(`/question-answer/${item.id}` as Href);
        break;
      case 'survey':
        router.push(`/survey/${item.id}` as Href);
        break;
    }
  }, []);

  // Generate suggestions from searchable data titles
  const searchSuggestions = useMemo(() => {
    if (!searchQuery) return recentSearches.slice(0, 5);
    const lowerQuery = searchQuery.toLowerCase();
    return searchableData
      .filter(item => item.title.toLowerCase().includes(lowerQuery))
      .map(item => item.title)
      .slice(0, 5);
  }, [searchQuery, searchableData, recentSearches]);

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
              {user?.firstName
                ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
                : "User"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell
              count={unreadCount ?? 0}
              onPress={goToNotifications}
            />
          </View>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          onPress={openSearchOverlay}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open search"
        >
          <SearchBar
            placeholder="Search videos, surveys, questions..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={handleSearchSubmit}
            onFocus={openSearchOverlay}
            style={styles.searchBar}
          />
        </TouchableOpacity>

        {/* Search Overlay for full-screen search experience */}
        <SearchOverlay
          visible={searchOverlayVisible}
          onClose={closeSearchOverlay}
          query={searchQuery}
          onChangeQuery={setSearchQuery}
          onSubmit={handleSearchSubmit}
          recentSearches={recentSearches}
          onRemoveFromHistory={removeFromHistory}
          onClearHistory={clearHistory}
          suggestions={searchSuggestions}
          placeholder="Search videos, surveys, questions..."
          searchContext="Home"
          trendingSearches={['Earn money', 'Surveys', 'Videos', 'Quiz rewards']}
        />

        {/* Search Results - Show when actively searching */}
        {isSearching && searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <Text style={[styles.searchResultsTitle, { color: colors.text }]}>
              Search Results ({searchResults.length})
            </Text>
            {searchResults.slice(0, 5).map((item) => (
              <TouchableOpacity
                key={`${item.type}-${item.id}`}
                style={[styles.searchResultItem, { backgroundColor: colors.card }]}
                onPress={() => handleSearchResultPress(item)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.searchResultBadge,
                  {
                    backgroundColor: item.type === 'video'
                      ? colors.error
                      : item.type === 'question'
                        ? colors.primary
                        : colors.success
                  }
                ]}>
                  <Text style={styles.searchResultBadgeText}>
                    {item.type.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.searchResultContent}>
                  <Text
                    style={[styles.searchResultTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.searchResultType, { color: colors.textMuted }]}
                  >
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {searchResults.length > 5 && (
              <Text style={[styles.moreResults, { color: colors.primary }]}>
                +{searchResults.length - 5} more results
              </Text>
            )}
          </View>
        )}

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
            UGX {user?.walletBalance?.toLocaleString() || "0"}
          </Text>
          <View style={styles.walletActions}>
            <TouchableOpacity
              style={styles.walletButton}
              onPress={goToWithdraw}
              accessibilityRole="button"
              accessibilityLabel="Withdraw funds"
            >
              <Text style={styles.walletButtonText}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.walletButton, styles.walletButtonSecondary]}
              onPress={goToTransactions}
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
            value={`UGX ${dashboardStats?.totalEarnings?.toLocaleString() || "0"}`}
            subtitle={`+UGX ${dashboardStats?.weeklyEarnings?.toLocaleString() || "0"} this week`}
            subtitleColor={colors.success}
            onPress={goToTransactions}
          />
          <StatCard
            icon={<Gift size={20} color={colors.warning} strokeWidth={1.5} />}
            title="Rewards Earned"
            value={dashboardStats?.rewardsProgress || 0}
            subtitle={`Goal: ${dashboardStats?.rewardsGoal || 2000}`}
            onPress={goToTransactions}
          />
        </View>

        {/* Featured Ad Carousel - Industry Standard: High visibility after key content */}
        {featuredAds && featuredAds.length > 0 && (
          <View style={styles.adSection}>
            <AdCarousel
              ads={featuredAds}
              onAdClick={handleAdClick}
              onAdLoad={() => featuredAds[0] && handleAdImpression(featuredAds[0])}
              autoScrollInterval={6000}
              style={styles.featuredAdCarousel}
            />
          </View>
        )}

        {/* Trending Videos Section */}
        <SectionHeader
          title="Trending Videos"
          subtitle="Most watched this week"
          icon={<Play size={20} color={colors.error} strokeWidth={1.5} />}
          onSeeAll={goToVideos}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          {trendingVideos?.map((video: Video) => (
            <VideoCard
              key={video.id}
              video={video}
              variant="compact"
              onPress={goToVideos}
            />
          ))}
        </ScrollView>

        {/* Questions & Rewards Section */}
        <SectionHeader
          title="Questions & Rewards"
          subtitle="Answer and earn"
          icon={<Award size={20} color={colors.primary} strokeWidth={1.5} />}
          onSeeAll={goToQuestions}
        />

        {/* Recent Questions */}
        <View style={styles.questionsContainer}>
          {recentQuestions?.slice(0, 3).map((question: Question) => (
            <QuestionCard
              key={question.id}
              question={question}
              variant="compact"
              onPress={() => router.push(`/question-answer/${question.id}` as Href)}
            />
          ))}
        </View>

        {/* Native Ad - Between Questions & Surveys (Industry Standard: Blends with content) */}
        {homeAds && homeAds.length > 0 && (
          <BetweenContentAd
            ad={homeAds[0]}
            onAdClick={handleAdClick}
            onAdLoad={() => handleAdImpression(homeAds[0])}
            variant="native"
            style={styles.betweenContentAd}
          />
        )}

        {/* Running Surveys Section */}
        <SectionHeader
          title="Running Surveys"
          subtitle="Complete and earn rewards"
          icon={<Zap size={20} color={colors.success} strokeWidth={1.5} />}
          onSeeAll={goToSurveys}
        />
        <View style={styles.surveysContainer}>
          {runningSurveys?.slice(0, 2).map((survey: Survey) => (
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
          onSeeAll={goToSurveys}
        />
        <View style={styles.surveysContainer}>
          {upcomingSurveys?.slice(0, 2).map((survey: Survey) => (
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

        {/* Banner Ad - Before Statistics (Industry Standard: Natural content break) */}
        {bannerAds && bannerAds.length > 0 && (
          <View style={styles.bannerAdContainer}>
            <BannerAd
              ad={bannerAds[0]}
              onAdClick={handleAdClick}
              onAdLoad={() => handleAdImpression(bannerAds[0])}
              style={styles.bannerAd}
            />
          </View>
        )}

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
          unit="UGX"
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
  searchResultsContainer: {
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  searchResultsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.md,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  searchResultBadge: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  searchResultBadgeText: {
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  searchResultType: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  moreResults: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginTop: SPACING.sm,
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
  // Ad placement styles - Industry standard spacing and presentation
  adSection: {
    marginVertical: SPACING.md,
  },
  featuredAdCarousel: {
    marginHorizontal: -SPACING.base,
  },
  betweenContentAd: {
    marginVertical: SPACING.lg,
    marginHorizontal: -SPACING.sm,
  },
  bannerAdContainer: {
    marginVertical: SPACING.md,
    marginHorizontal: -SPACING.sm,
  },
  bannerAd: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
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
