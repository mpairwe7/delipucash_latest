/**
 * Home Screen (Dashboard)
 * Enhanced home screen with modern UI design following industry standards
 * Features responsive layouts, smooth animations, and proper authentication checks
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
 * - Explore section with modals
 * - Statistics cards
 */

import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
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
  Zap,
  Plus,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from "@/utils/theme";
import useUser from "@/utils/useUser";
import {
  StatCard,
  SurveyCard,
  VideoCard,
  DailyRewardCard,
  SearchBar,
  ProgressCard,
  NotificationBell,
  ExploreCard,
  Section,
  RecentQuestionCard,
  ExploreModal,
  ExploreFeature,
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
import {
  useFeaturedAds,
  useBannerAds,
  useAdsForPlacement,
  useRecordAdClick,
  useRecordAdImpression,
} from "@/services/adHooksRefactored";
import { BannerAd, FeaturedAd, NativeAd, CompactAd } from "@/components/ads";

const { width } = Dimensions.get("window");

// Enhanced responsive breakpoints
const isTablet = width >= 768;
const isLargeScreen = width >= 1024;
const isSmallScreen = width < 375;
const isMediumScreen = width >= 375 && width < 768;
// const isLandscape = width > height; // Reserved for future responsive layouts

// Responsive helper functions
const getResponsiveSize = (small: number, medium: number, large: number): number => {
  if (isLargeScreen) return large;
  if (isTablet) return medium;
  if (isMediumScreen) return medium;
  return small;
};

const getResponsivePadding = (): number => {
  if (isLargeScreen) return 32;
  if (isTablet) return 24;
  if (isSmallScreen) return 16;
  return 20;
};

// Explore items configuration
const EXPLORE_ITEMS = [
  {
    id: "discover",
    icon: "compass" as const,
    title: "Discover",
    description: "Find trending content",
    colors: ["#FF6B6B", "#FF8E53"] as const,
    features: [
      { icon: "trending-up" as const, title: "Trending Content", description: "Stay updated with the latest viral videos and popular topics" },
      { icon: "lightbulb" as const, title: "New Opportunities", description: "Find fresh surveys, videos, and earning opportunities" },
      { icon: "star" as const, title: "Personalized", description: "Content curated based on your interests and activity" },
    ],
    actionText: "Start Discovering",
    route: "/(tabs)/videos",
  },
  {
    id: "community",
    icon: "account-group" as const,
    title: "Community",
    description: "Connect & share",
    colors: ["#4ECDC4", "#44A08D"] as const,
    features: [
      { icon: "help-circle" as const, title: "Ask Questions", description: "Get answers from experienced community members" },
      { icon: "chat" as const, title: "Share Knowledge", description: "Help others and earn reputation points" },
      { icon: "heart" as const, title: "Build Connections", description: "Network with like-minded individuals" },
    ],
    actionText: "Join Community",
    route: "/(tabs)/questions",
  },
  {
    id: "trends",
    icon: "trending-up" as const,
    title: "Trends",
    description: "What's hot now",
    colors: ["#667eea", "#764ba2"] as const,
    features: [
      { icon: "fire" as const, title: "Hot Topics", description: "Discover the most popular discussions and topics" },
      { icon: "chart-line" as const, title: "Viral Content", description: "Watch videos that are gaining massive popularity" },
      { icon: "clock" as const, title: "Real-time Updates", description: "Get notifications about emerging trends" },
    ],
    actionText: "Explore Trends",
    route: "/(tabs)/videos",
  },
  {
    id: "leaderboard",
    icon: "trophy" as const,
    title: "Leaderboard",
    description: "See rankings",
    colors: ["#f093fb", "#f5576c"] as const,
    features: [
      { icon: "medal" as const, title: "Top Rankings", description: "See who's leading in earnings and activities" },
      { icon: "crown" as const, title: "Achievements", description: "Unlock badges and special recognition" },
      { icon: "gift" as const, title: "Rewards", description: "Get exclusive prizes for top performers" },
    ],
    actionText: "View Rankings",
    route: "/(tabs)/profile",
  },
] as const;

export default function HomePage(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { data: user, refetch } = useUser();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Explore modal states
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Data hooks
  const { data: trendingVideos, refetch: refetchVideos, isLoading: videosLoading } = useTrendingVideos(5);
  const { data: recentQuestions, refetch: refetchQuestions, isLoading: questionsLoading } = useRecentQuestions(5);
  const { data: runningSurveys, refetch: refetchRunningSurveys, isLoading: runningSurveysLoading } = useRunningSurveys();
  const { data: upcomingSurveys, refetch: refetchUpcomingSurveys, isLoading: upcomingSurveysLoading } = useUpcomingSurveys();
  const { data: dailyReward, refetch: refetchDailyReward } = useDailyReward();
  const { data: dashboardStats, refetch: refetchStats } = useDashboardStats();
  const { data: unreadCount } = useUnreadCount();
  const claimDailyReward = useClaimDailyReward();

  // Ad hooks - TanStack Query for intelligent ad loading
  const { data: featuredAds, refetch: refetchFeaturedAds } = useFeaturedAds(2);
  const { data: bannerAds, refetch: refetchBannerAds } = useBannerAds(3);
  const { data: homeAds, refetch: refetchHomeAds } = useAdsForPlacement('home', 4);
  const recordAdClick = useRecordAdClick();
  const recordAdImpression = useRecordAdImpression();

  // Ad click handler with analytics tracking
  const handleAdClick = useCallback((ad: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    recordAdClick.mutate({
      adId: ad.id,
      placement: 'home',
      deviceInfo: { platform: Platform.OS, version: Platform.Version.toString() },
    });
  }, [recordAdClick]);

  // Ad impression tracking
  const handleAdImpression = useCallback((ad: any, duration: number = 1000) => {
    recordAdImpression.mutate({
      adId: ad.id,
      placement: 'home',
      duration,
      wasVisible: true,
      viewportPercentage: 100,
    });
  }, [recordAdImpression]);

  // Animation for Answer Now button
  const pulseAnim = useSharedValue(1);

  // Pulse animation effect
  React.useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [pulseAnim]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const responsivePadding = useMemo(() => getResponsivePadding(), []);

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    if (!user) {
      Alert.alert("Authentication Required", "Please log in to claim rewards.");
      router.push("/(auth)/login");
      return;
    }
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await claimDailyReward.mutateAsync();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Failed to claim daily reward:", error);
    }
  }, [claimDailyReward, user]);

  const handleSearch = useCallback((query: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log("Search:", query);
  }, []);

  const handleAnswerNow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!user) {
      Alert.alert("Authentication Required", "Please log in to answer questions.", [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => router.push("/(auth)/login") },
      ]);
      return;
    }
    router.push("/instant-reward-questions");
  }, [user]);

  const handlePostQuestion = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!user) {
      Alert.alert("Authentication Required", "Please log in to post questions.", [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => router.push("/(auth)/login") },
      ]);
      return;
    }
    router.push("/(tabs)/questions");
  }, [user]);

  const handleExplorePress = useCallback((itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveModal(itemId);
  }, []);

  const handleModalAction = useCallback((route: string) => {
    setActiveModal(null);
    router.push(route as Href);
  }, []);

  // Get active explore item for modal
  const activeExploreItem = EXPLORE_ITEMS.find(item => item.id === activeModal);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { 
          paddingTop: insets.top + SPACING.sm,
          paddingHorizontal: responsivePadding,
        }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View 
          entering={FadeIn.duration(400)}
          style={styles.header}
        >
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
        </Animated.View>

        {/* Search Bar */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <SearchBar
            placeholder="Search videos, surveys, questions..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={handleSearch}
            style={styles.searchBar}
          />
        </Animated.View>

        {/* Daily Rewards Card */}
        {dailyReward && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <DailyRewardCard
              isAvailable={dailyReward.isAvailable}
              nextRewardIn={dailyReward.nextRewardIn}
              currentStreak={dailyReward.currentStreak}
              todayReward={dailyReward.todayReward}
              streakBonus={dailyReward.streakBonus}
              onClaim={handleClaimDailyReward}
              isLoading={claimDailyReward.isPending}
            />
          </Animated.View>
        )}

        {/* Smart Banner Ad - Non-intrusive placement after daily rewards */}
        {bannerAds && bannerAds.length > 0 && (
          <Animated.View entering={FadeInDown.delay(175).duration(400)} style={styles.adContainer}>
            <BannerAd
              ad={bannerAds[0]}
              onAdClick={handleAdClick}
              onAdLoad={() => handleAdImpression(bannerAds[0])}
              style={styles.bannerAd}
            />
          </Animated.View>
        )}

        {/* Wallet Card */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <LinearGradient
            colors={[colors.primary, withAlpha(colors.primary, 0.8)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.walletCard}
          >
            <View style={styles.walletHeader}>
              <Wallet size={getResponsiveSize(20, 22, 24)} color="#FFFFFF" strokeWidth={1.5} />
              <Text style={[styles.walletLabel, { fontSize: getResponsiveSize(13, 14, 15) }]}>
                Wallet Balance
              </Text>
            </View>
            <Text style={[styles.walletBalance, { fontSize: getResponsiveSize(32, 36, 40) }]}>
              \${user?.walletBalance?.toLocaleString() || "0.00"}
            </Text>
            <View style={styles.walletActions}>
              <TouchableOpacity
                style={styles.walletButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/(tabs)/withdraw");
                }}
                accessibilityRole="button"
                accessibilityLabel="Withdraw funds"
              >
                <Text style={[styles.walletButtonText, { fontSize: getResponsiveSize(13, 14, 15) }]}>
                  Withdraw
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.walletButton, styles.walletButtonSecondary]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/(tabs)/transactions");
                }}
                accessibilityRole="button"
                accessibilityLabel="View transactions"
              >
                <Text style={[styles.walletButtonText, { fontSize: getResponsiveSize(13, 14, 15) }]}>
                  History
                </Text>
              </TouchableOpacity>
            </View>
            {/* Decorative elements */}
            <View style={styles.walletDecor1} />
            <View style={styles.walletDecor2} />
          </LinearGradient>
        </Animated.View>

        {/* Quick Stats Row */}
        <Animated.View 
          entering={FadeInDown.delay(250).duration(400)}
          style={styles.statsRow}
        >
          <StatCard
            icon={<TrendingUp size={getResponsiveSize(18, 20, 22)} color={colors.success} strokeWidth={1.5} />}
            title="Total Earnings"
            value={`$${dashboardStats?.totalEarnings?.toLocaleString() || "0"}`}
            subtitle={`+$${dashboardStats?.weeklyEarnings || 0} this week`}
            subtitleColor={colors.success}
            onPress={() => router.push("/(tabs)/transactions")}
          />
          <StatCard
            icon={<Gift size={getResponsiveSize(18, 20, 22)} color={colors.warning} strokeWidth={1.5} />}
            title="Rewards Earned"
            value={dashboardStats?.rewardsProgress || 0}
            subtitle={`Goal: ${dashboardStats?.rewardsGoal || 2000}`}
            onPress={() => router.push("/(tabs)/transactions")}
          />
        </Animated.View>

        {/* Trending Videos Section */}
        <Section
          title="Trending Videos"
          icon="play-circle"
          seeAllAction={() => router.push("/(tabs)/videos")}
          delay={300}
        >
          {videosLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : trendingVideos && trendingVideos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {trendingVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  variant="compact"
                  onPress={() => router.push(`/(tabs)/videos`)}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.elevated }]}>
              <MaterialCommunityIcons
                name="video-off"
                size={getResponsiveSize(28, 32, 36)}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
                No videos available
              </Text>
            </View>
          )}
        </Section>

        {/* Featured Ad - Premium placement after trending content */}
        {featuredAds && featuredAds.length > 0 && (
          <Animated.View entering={FadeInDown.delay(325).duration(400)} style={styles.adContainer}>
            <FeaturedAd
              ad={featuredAds[0]}
              onAdClick={handleAdClick}
              onAdLoad={() => handleAdImpression(featuredAds[0])}
              style={styles.featuredAd}
            />
          </Animated.View>
        )}

        {/* Questions & Rewards Section */}
        <Section
          title="Questions & Rewards"
          icon="gift"
          delay={350}
        >
          <LinearGradient
            colors={[withAlpha(colors.primary, 0.1), withAlpha(colors.primary, 0.05)]}
            style={styles.rewardGradient}
          >
            <View style={styles.rewardContent}>
              <View style={[styles.rewardIconWrapper, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
                <MaterialCommunityIcons
                  name="gift"
                  size={getResponsiveSize(32, 40, 48)}
                  color={colors.primary}
                />
              </View>
              <View style={styles.rewardTextContainer}>
                <Text style={[styles.rewardTitle, { color: colors.text, fontSize: getResponsiveSize(14, 15, 16) }]}>
                  Answer today&apos;s question to earn rewards!
                </Text>
                <Text style={[styles.rewardPoints, { color: colors.primary, fontSize: getResponsiveSize(18, 20, 22) }]}>
                  +100 points
                </Text>
              </View>
            </View>
            <Animated.View style={pulseStyle}>
              <TouchableOpacity
                style={[styles.answerButton, { backgroundColor: colors.primary }]}
                onPress={handleAnswerNow}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Answer question now"
              >
                <Text style={[styles.answerButtonText, { fontSize: getResponsiveSize(14, 15, 16) }]}>
                  Answer Now
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </LinearGradient>
        </Section>

        {/* Recent Questions Section */}
        <Section
          title="Recent Questions"
          icon="comment-question"
          seeAllAction={() => router.push("/(tabs)/questions")}
          delay={400}
        >
          {questionsLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : recentQuestions && recentQuestions.length > 0 ? (
            <View style={styles.questionsContainer}>
              {recentQuestions.slice(0, isTablet ? 3 : 2).map((question, index) => (
                <RecentQuestionCard
                  key={question.id}
                  question={question}
                  index={index}
                  onPress={() => router.push(`/question/${question.id}`)}
                />
              ))}
              <TouchableOpacity
                style={[styles.postQuestionButton, { backgroundColor: colors.primary }]}
                onPress={handlePostQuestion}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Post a question"
              >
                <Plus size={getResponsiveSize(16, 18, 20)} color="#FFFFFF" strokeWidth={2} />
                <Text style={[styles.postQuestionText, { fontSize: getResponsiveSize(13, 14, 15) }]}>
                  Post a Question
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.elevated }]}>
              <MaterialCommunityIcons
                name="help-circle-outline"
                size={getResponsiveSize(28, 32, 36)}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
                No questions available
              </Text>
            </View>
          )}
        </Section>

        {/* Native Ad - Blends with content between sections */}
        {homeAds && homeAds.length > 1 && (
          <Animated.View entering={FadeInDown.delay(425).duration(400)} style={styles.adContainer}>
            <NativeAd
              ad={homeAds[1]}
              onAdClick={handleAdClick}
              onAdLoad={() => handleAdImpression(homeAds[1])}
              style={styles.nativeAd}
            />
          </Animated.View>
        )}

        {/* Running Surveys Section */}
        <Section
          title="Running Surveys"
          icon="clipboard-text"
          seeAllAction={() => router.push("/(tabs)/surveys")}
          delay={450}
        >
          <View style={styles.surveyStatusHeader}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.surveyStatusText, { color: colors.textMuted }]}>
              Live now
            </Text>
          </View>
          {runningSurveysLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : runningSurveys && runningSurveys.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {runningSurveys.slice(0, 4).map((survey) => (
                <SurveyCard
                  key={survey.id}
                  survey={survey}
                  onPress={() => router.push(`/survey/${survey.id}`)}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.elevated }]}>
              <MaterialCommunityIcons
                name="clipboard-off"
                size={getResponsiveSize(28, 32, 36)}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
                No running surveys
              </Text>
            </View>
          )}
        </Section>

        {/* Upcoming Surveys Section */}
        <Section
          title="Upcoming Surveys"
          icon="clipboard-clock"
          seeAllAction={() => router.push("/(tabs)/surveys")}
          delay={500}
        >
          <View style={styles.surveyStatusHeader}>
            <View style={[styles.statusDot, { backgroundColor: colors.warning }]} />
            <Text style={[styles.surveyStatusText, { color: colors.textMuted }]}>
              Coming soon
            </Text>
          </View>
          {upcomingSurveysLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : upcomingSurveys && upcomingSurveys.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {upcomingSurveys.slice(0, 4).map((survey) => (
                <SurveyCard
                  key={survey.id}
                  survey={survey}
                  variant="compact"
                  onPress={() => router.push(`/survey/${survey.id}`)}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.elevated }]}>
              <MaterialCommunityIcons
                name="clipboard-off"
                size={getResponsiveSize(28, 32, 36)}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
                No upcoming surveys
              </Text>
            </View>
          )}
        </Section>

        {/* Explore Section */}
        <Section
          title="Explore"
          icon="compass"
          delay={550}
        >
          <View style={[styles.exploreGrid, { justifyContent: isTablet ? "flex-start" : "space-between" }]}>
            {EXPLORE_ITEMS.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.exploreItemWrapper,
                  { width: isTablet ? "23%" : "48%", marginRight: isTablet ? "2%" : 0 },
                ]}
              >
                <ExploreCard
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                  colors={item.colors}
                  onPress={() => handleExplorePress(item.id)}
                  index={index}
                  variant={isSmallScreen ? "compact" : "default"}
                />
              </View>
            ))}
          </View>
        </Section>

        {/* Compact Ad - Minimal footprint before statistics */}
        {bannerAds && bannerAds.length > 1 && (
          <Animated.View entering={FadeInDown.delay(575).duration(400)} style={styles.adContainer}>
            <CompactAd
              ad={bannerAds[1]}
              onAdClick={handleAdClick}
              onAdLoad={() => handleAdImpression(bannerAds[1])}
              style={styles.compactAd}
            />
          </Animated.View>
        )}

        {/* Statistics Section */}
        <Section
          title="Your Statistics"
          icon="chart-bar"
          delay={600}
        >
          {/* Earnings Progress */}
          <ProgressCard
            title="Weekly Earnings Goal"
            current={dashboardStats?.weeklyEarnings || 0}
            goal={200}
            unit="\$"
            icon={<TrendingUp size={getResponsiveSize(18, 20, 22)} color={colors.success} strokeWidth={1.5} />}
            progressColor={colors.success}
            style={styles.progressCard}
          />

          {/* Engagement Stats */}
          <View style={styles.engagementRow}>
            <StatCard
              icon={<Award size={getResponsiveSize(16, 18, 20)} color={colors.primary} strokeWidth={1.5} />}
              title="Questions"
              value={dashboardStats?.questionsAnswered || 0}
              variant="compact"
              style={styles.engagementCard}
            />
            <StatCard
              icon={<Zap size={getResponsiveSize(16, 18, 20)} color={colors.success} strokeWidth={1.5} />}
              title="Surveys"
              value={dashboardStats?.surveysCompleted || 0}
              variant="compact"
              style={styles.engagementCard}
            />
            <StatCard
              icon={<Play size={getResponsiveSize(16, 18, 20)} color={colors.error} strokeWidth={1.5} />}
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
            icon={<Target size={getResponsiveSize(18, 20, 22)} color={colors.warning} strokeWidth={1.5} />}
            progressColor={colors.warning}
            showPercentage
            style={styles.progressCard}
          />
        </Section>

        {/* Bottom Spacing */}
        <View style={{ height: insets.bottom + SPACING["3xl"] }} />
      </ScrollView>

      {/* Explore Modals */}
      {activeExploreItem && (
        <ExploreModal
          visible={!!activeModal}
          onClose={() => setActiveModal(null)}
          title={activeExploreItem.title}
          subtitle={activeExploreItem.description}
          icon={activeExploreItem.icon}
          gradientColors={activeExploreItem.colors}
          features={[...activeExploreItem.features] as unknown as ExploreFeature[]}
          actionText={activeExploreItem.actionText}
          onAction={() => handleModalAction(activeExploreItem.route)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    overflow: "hidden",
    position: "relative",
    ...SHADOWS.md,
  },
  walletHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  walletLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: "rgba(255, 255, 255, 0.85)",
    marginLeft: SPACING.sm,
  },
  walletBalance: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
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
    color: "#FFFFFF",
  },
  walletDecor1: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  walletDecor2: {
    position: "absolute",
    bottom: -20,
    right: 40,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  horizontalScrollContent: {
    paddingRight: SPACING.base,
    paddingBottom: SPACING.xs,
  },
  loaderContainer: {
    padding: SPACING.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  emptyStateText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  rewardGradient: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
  },
  rewardContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.base,
  },
  rewardIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.lg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.base,
  },
  rewardTextContainer: {
    flex: 1,
  },
  rewardTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
    lineHeight: 22,
  },
  rewardPoints: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  answerButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
    alignSelf: "center",
    ...SHADOWS.sm,
  },
  answerButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: "#FFFFFF",
  },
  questionsContainer: {
    gap: SPACING.xs,
  },
  postQuestionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  postQuestionText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: "#FFFFFF",
  },
  surveyStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  surveyStatusText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  exploreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  exploreItemWrapper: {
    marginBottom: SPACING.xs,
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
  // Ad Styles - Non-intrusive, industry-standard spacing
  adContainer: {
    marginVertical: SPACING.sm,
  },
  bannerAd: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  featuredAd: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    ...SHADOWS.md,
  },
  nativeAd: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  compactAd: {
    borderRadius: RADIUS.base,
    overflow: "hidden",
  },
});
