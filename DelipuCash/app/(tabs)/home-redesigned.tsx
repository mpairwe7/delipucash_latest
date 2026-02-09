/**
 * Home Screen (Dashboard) - 2025/2026 Modern Redesign
 * 
 * A radically enhanced home experience following industry-leading patterns:
 * - TikTok/Instagram: Engaging visual feed, quick actions
 * - Cash App: Clear wallet/earnings display, premium feel
 * - Duolingo: Gamification (streaks, progress rings, milestones)
 * - Swagbucks: Clear earning pathways
 * 
 * Key improvements:
 * 1. FlatList-based virtualization for performance
 * 2. Personalized header with greeting, streak ring, wallet preview
 * 3. Hero daily reward card with confetti celebration
 * 4. Quick actions row for primary earning activities
 * 5. "For You" style earning opportunities feed
 * 6. Skeleton loading states
 * 7. Full WCAG 2.2 AA accessibility compliance
 * 8. Smooth micro-interactions and animations
 * 
 * @accessibility WCAG 2.2 AA compliant
 * - Dynamic type scaling with maxFontSizeMultiplier
 * - Touch targets ≥44x44dp
 * - Proper heading hierarchy
 * - Screen reader optimized (labels, hints, roles)
 * - High contrast ratios (≥4.5:1)
 * - Reduced motion support via system settings
 */

import React, { useCallback, useState, useMemo, useRef, memo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Platform,
  Dimensions,
  Alert,
  ListRenderItem,
  AccessibilityInfo,
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
  Sparkles,
  Clock,
  Zap,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useStatusBar } from "@/hooks/useStatusBar";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
  COMPONENT_SIZE,
} from "@/utils/theme";
import useUser from "@/utils/useUser";
import {
  StatCard,
  SurveyCard,
  VideoCard,
  SearchBar,
  ProgressCard,
  ExploreCard,
  Section,
  ExploreModal,
  ExploreFeature,
} from "@/components";
import {
  // Home-specific components
  PersonalizedHeader,
  HeroRewardCard,
  QuickActions,
  DashboardSkeleton,
  EarningOpportunitiesList,
  type EarningOpportunity,
} from "@/components/home";
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
  useBannerAds,
  useAdsForPlacement,
  useFeaturedAds,
  useRecordAdClick,
  useRecordAdImpression,
} from "@/services/adHooksRefactored";
import {
  BannerAd,
  NativeAd,
  InFeedAd,
  BetweenContentAd,
  AdPlacementWrapper,
} from "@/components/ads";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Responsive breakpoints
const isTablet = SCREEN_WIDTH >= 768;
const isSmallScreen = SCREEN_WIDTH < 375;

// Section identifiers for FlatList
type SectionType =
  | "header"
  | "hero-reward"
  | "quick-actions"
  | "wallet-stats"
  | "trending-videos"
  | "earning-opportunities"
  | "running-surveys"
  | "upcoming-surveys"
  | "statistics"
  | "explore"
  | "ad-banner"
  | "ad-native"
  | "ad-featured"
  | "ad-in-feed"
  | "ad-between-content"
  | "footer-spacer";

interface DashboardSection {
  id: SectionType;
  type: SectionType;
  data?: any;
}

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

/**
 * Animated FlatList for scroll-based animations
 */
const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList<DashboardSection>
);

/**
 * Memoized video item to prevent unnecessary re-renders
 */
const MemoizedVideoItem = memo(function VideoItem({
  video,
  onPress,
}: {
  video: any;
  onPress: () => void;
}) {
  return (
    <VideoCard
      video={video}
      variant="compact"
      onPress={onPress}
    />
  );
});

/**
 * Memoized survey item to prevent unnecessary re-renders
 */
const MemoizedSurveyItem = memo(function SurveyItem({
  survey,
  onPress,
  variant,
}: {
  survey: any;
  onPress: () => void;
  variant?: "default" | "compact";
}) {
  return (
    <SurveyCard
      survey={survey}
      variant={variant}
      onPress={onPress}
    />
  );
});

/**
 * Horizontal list separator - memoized to avoid recreation
 */
const HorizontalSeparator = memo(function HorizontalSeparator() {
  return <View style={{ width: SPACING.md }} />;
});

export default function HomePage(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, style: statusBarStyle } = useStatusBar(); // Industry-standard status bar with focus tracking
  const { data: user, loading: userLoading, refetch } = useUser();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Scroll animation value
  const scrollY = useSharedValue(0);
  const flatListRef = useRef<FlatList<DashboardSection>>(null);

  // Data hooks with loading states
  const { 
    data: trendingVideos, 
    refetch: refetchVideos, 
    isLoading: videosLoading 
  } = useTrendingVideos(6);
  const { 
    data: recentQuestions, 
    refetch: refetchQuestions, 
    isLoading: questionsLoading 
  } = useRecentQuestions(5);
  const { 
    data: runningSurveys, 
    refetch: refetchRunningSurveys, 
    isLoading: runningSurveysLoading 
  } = useRunningSurveys();
  const { 
    data: upcomingSurveys, 
    refetch: refetchUpcomingSurveys, 
    isLoading: upcomingSurveysLoading 
  } = useUpcomingSurveys();
  const { data: dailyReward, refetch: refetchDailyReward } = useDailyReward();
  const { data: dashboardStats, refetch: refetchStats } = useDashboardStats();
  const { data: unreadCount } = useUnreadCount();
  const claimDailyReward = useClaimDailyReward();

  // Ad hooks - TanStack Query for intelligent ad loading
  // Following industry best practices: ads are contextually placed and non-intrusive
  const { data: bannerAds, refetch: refetchBannerAds } = useBannerAds(3);
  const { data: homeAds, refetch: refetchHomeAds } = useAdsForPlacement("home", 4);
  const { data: featuredAds, refetch: refetchFeaturedAds } = useFeaturedAds(2);
  const recordAdClick = useRecordAdClick();
  const recordAdImpression = useRecordAdImpression();

  // Responsive padding
  const horizontalPadding = useMemo(() => {
    if (isTablet) return SPACING["2xl"];
    if (isSmallScreen) return SPACING.base;
    return SPACING.lg;
  }, []);

  // Check if initial data is loading
  const isInitialLoading = userLoading && !user;

  // Build sections array for FlatList
  const sections: DashboardSection[] = useMemo(() => {
    const sectionsList: DashboardSection[] = [
      { id: "header", type: "header" },
      { id: "hero-reward", type: "hero-reward" },
      { id: "quick-actions", type: "quick-actions" },
      { id: "wallet-stats", type: "wallet-stats" },
    ];

    // Smart Banner Ad - Non-intrusive placement after stats (Industry Standard)
    if (bannerAds && bannerAds.length > 0) {
      sectionsList.push({ id: "ad-banner", type: "ad-banner", data: bannerAds[0] });
    }

    // Trending videos
    if (!videosLoading && trendingVideos && trendingVideos.length > 0) {
      sectionsList.push({ id: "trending-videos", type: "trending-videos" });
    }

    // Earning opportunities (questions transformed)
    if (!questionsLoading && recentQuestions && recentQuestions.length > 0) {
      sectionsList.push({ id: "earning-opportunities", type: "earning-opportunities" });
    }

    // In-Feed Native Ad - Blends with content between sections (Industry Standard)
    if (homeAds && homeAds.length > 0) {
      sectionsList.push({ id: "ad-native", type: "ad-native", data: homeAds[0] });
    }

    // Running surveys
    if (!runningSurveysLoading) {
      sectionsList.push({ id: "running-surveys", type: "running-surveys" });
    }

    // Featured Ad - Premium placement for high-value ads (Industry Standard)
    if (featuredAds && featuredAds.length > 0) {
      sectionsList.push({ id: "ad-featured", type: "ad-featured", data: featuredAds[0] });
    }

    // Upcoming surveys
    if (!upcomingSurveysLoading) {
      sectionsList.push({ id: "upcoming-surveys", type: "upcoming-surveys" });
    }

    // Compact In-Feed Ad - Minimal footprint before statistics (Industry Standard)
    if (bannerAds && bannerAds.length > 1) {
      sectionsList.push({ id: "ad-in-feed", type: "ad-in-feed", data: bannerAds[1] });
    }

    // Statistics
    sectionsList.push({ id: "statistics", type: "statistics" });

    // Between Content Ad - Natural content boundary placement
    if (homeAds && homeAds.length > 1) {
      sectionsList.push({ id: "ad-between-content", type: "ad-between-content", data: homeAds[1] });
    }

    // Explore section
    sectionsList.push({ id: "explore", type: "explore" });

    // Footer spacer
    sectionsList.push({ id: "footer-spacer", type: "footer-spacer" });

    return sectionsList;
  }, [
    bannerAds,
    homeAds,
    featuredAds,
    trendingVideos,
    videosLoading,
    recentQuestions,
    questionsLoading,
    runningSurveysLoading,
    upcomingSurveysLoading,
  ]);

  // Scroll handler for animations
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Header opacity based on scroll
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 100],
      [1, 0.95],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // Refresh handler
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
      refetchBannerAds(),
      refetchHomeAds(),
      refetchFeaturedAds(),
    ]);
    
    setRefreshing(false);
    
    // Announce refresh completion for screen readers
    AccessibilityInfo.announceForAccessibility("Dashboard refreshed");
  }, [
    refetch, refetchVideos, refetchQuestions, refetchRunningSurveys,
    refetchUpcomingSurveys, refetchDailyReward, refetchStats,
    refetchBannerAds, refetchHomeAds, refetchFeaturedAds,
  ]);

  // Claim daily reward handler
  const handleClaimDailyReward = useCallback(async () => {
    if (!user) {
      Alert.alert("Authentication Required", "Please log in to claim rewards.");
      router.push("/(auth)/login");
      return;
    }
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await claimDailyReward.mutateAsync();
      AccessibilityInfo.announceForAccessibility("Daily reward claimed successfully!");
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Failed to claim daily reward:", error);
    }
  }, [claimDailyReward, user]);

  // Quick action handlers
  const handleAnswerQuestion = useCallback(() => {
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

  const handleWatchVideo = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(tabs)/videos-new");
  }, []);

  const handleTakeSurvey = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(tabs)/surveys-new");
  }, []);

  const handleSearch = useCallback((query: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log("Search:", query);
  }, []);

  // Ad handlers
  const handleAdClick = useCallback((ad: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    recordAdClick.mutate({
      adId: ad.id,
      placement: "home",
      deviceInfo: { platform: Platform.OS, version: Platform.Version.toString() },
    });
  }, [recordAdClick]);

  const handleAdImpression = useCallback((ad: any, duration: number = 1000) => {
    recordAdImpression.mutate({
      adId: ad.id,
      placement: "home",
      duration,
      wasVisible: true,
      viewportPercentage: 100,
    });
  }, [recordAdImpression]);

  // Explore modal handlers
  const handleExplorePress = useCallback((itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveModal(itemId);
  }, []);

  const handleModalAction = useCallback((route: string) => {
    setActiveModal(null);
    router.push(route as Href);
  }, []);

  // Transform data for earning opportunities
  const earningOpportunities: EarningOpportunity[] = useMemo(() => {
    const opportunities: EarningOpportunity[] = [];

    // Add videos as opportunities
    if (trendingVideos) {
      trendingVideos.slice(0, 3).forEach((video: any) => {
        opportunities.push({
          id: `video-${video.id}`,
          type: "video",
          title: video.title || "Watch & Earn",
          description: video.description,
          reward: video.reward || 10,
          rewardType: "points",
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          participants: video.views,
          isHot: video.isPopular,
        });
      });
    }

    // Add questions as opportunities
    if (recentQuestions) {
      recentQuestions.slice(0, 3).forEach((question: any) => {
        opportunities.push({
          id: `question-${question.id}`,
          type: "question",
          title: question.title || question.content,
          reward: question.reward || 50,
          rewardType: "points",
          category: question.category,
          isNew: question.isNew,
          participants: question.answersCount,
        });
      });
    }

    return opportunities.slice(0, 5);
  }, [trendingVideos, recentQuestions]);

  // Handle earning opportunity press
  const handleOpportunityPress = useCallback((opportunity: EarningOpportunity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    switch (opportunity.type) {
      case "video":
        router.push("/(tabs)/videos-new");
        break;
      case "question":
        const questionId = opportunity.id.replace("question-", "");
        router.push(`/question/${questionId}` as Href);
        break;
      case "survey":
        router.push("/(tabs)/surveys-new");
        break;
      case "instant-reward":
        router.push("/instant-reward-questions");
        break;
    }
  }, []);

  // Get active explore item for modal
  const activeExploreItem = EXPLORE_ITEMS.find((item) => item.id === activeModal);

  // Render section item
  const renderSection: ListRenderItem<DashboardSection> = useCallback(
    ({ item, index }) => {
      switch (item.type) {
        case "header":
          return (
            <Animated.View style={[styles.sectionContainer, headerAnimatedStyle]}>
              <PersonalizedHeader
                userName={user?.firstName || "User"}
                walletBalance={user?.walletBalance || 0}
                currentStreak={dailyReward?.currentStreak || 0}
                streakGoal={30}
                unreadNotifications={unreadCount || 0}
                onNotificationPress={() => router.push("/notifications" as Href)}
                onWalletPress={() => router.push("/(tabs)/withdraw")}
                onStreakPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // Could open streak details modal
                }}
              />
              
              {/* Search Bar */}
              <Animated.View entering={FadeInDown.delay(100).duration(300)}>
                <SearchBar
                  placeholder="Search videos, surveys, questions..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmit={handleSearch}
                  style={styles.searchBar}
                />
              </Animated.View>
            </Animated.View>
          );

        case "hero-reward":
          if (!dailyReward) return null;
          return (
            <View style={styles.sectionContainer}>
              <HeroRewardCard
                isAvailable={dailyReward.isAvailable}
                nextRewardIn={dailyReward.nextRewardIn}
                currentStreak={dailyReward.currentStreak}
                todayReward={dailyReward.todayReward}
                streakBonus={dailyReward.streakBonus}
                onClaim={handleClaimDailyReward}
                isLoading={claimDailyReward.isPending}
              />
            </View>
          );

        case "quick-actions":
          return (
            <View style={styles.sectionContainer}>
              <QuickActions
                onAnswerQuestion={handleAnswerQuestion}
                onWatchVideo={handleWatchVideo}
                onTakeSurvey={handleTakeSurvey}
                onClaimReward={handleClaimDailyReward}
                dailyRewardAvailable={dailyReward?.isAvailable}
                availableQuestions={recentQuestions?.length || 0}
                runningSurveys={runningSurveys?.length || 0}
              />
            </View>
          );

        case "wallet-stats":
          return (
            <View style={styles.sectionContainer}>
              {/* Wallet Card */}
              <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                <LinearGradient
                  colors={[colors.primary, withAlpha(colors.primary, 0.8)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.walletCard}
                >
                  <View style={styles.walletHeader}>
                    <Wallet size={20} color="#FFFFFF" strokeWidth={1.5} />
                    <Text
                      style={styles.walletLabel}
                      accessibilityRole="text"
                      allowFontScaling
                      maxFontSizeMultiplier={1.2}
                    >
                      Wallet Balance
                    </Text>
                  </View>
                  <Text
                    style={styles.walletBalance}
                    accessibilityLabel={`Wallet balance: ${user?.walletBalance?.toLocaleString() || 0} Ugandan shillings`}
                    allowFontScaling
                    maxFontSizeMultiplier={1.3}
                  >
                    UGX {user?.walletBalance?.toLocaleString() || "0"}
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
                      accessibilityHint="Tap to withdraw money from your wallet"
                    >
                      <Text style={styles.walletButtonText}>Withdraw</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.walletButton, styles.walletButtonSecondary]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push("/(tabs)/transactions");
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="View transaction history"
                    >
                      <Text style={styles.walletButtonText}>History</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Decorative elements */}
                  <View style={styles.walletDecor1} />
                  <View style={styles.walletDecor2} />
                </LinearGradient>
              </Animated.View>

              {/* Quick Stats Row */}
              <View style={styles.statsRow}>
                <StatCard
                  icon={<TrendingUp size={18} color={colors.success} strokeWidth={1.5} />}
                  title="Total Earnings"
                  value={`UGX ${dashboardStats?.totalEarnings?.toLocaleString() || "0"}`}
                  subtitle={`+UGX ${dashboardStats?.weeklyEarnings?.toLocaleString() || "0"} this week`}
                  subtitleColor={colors.success}
                  onPress={() => router.push("/(tabs)/transactions")}
                />
                <StatCard
                  icon={<Gift size={18} color={colors.warning} strokeWidth={1.5} />}
                  title="Rewards Earned"
                  value={dashboardStats?.rewardsProgress || 0}
                  subtitle={`Goal: ${dashboardStats?.rewardsGoal || 2000}`}
                  onPress={() => router.push("/(tabs)/transactions")}
                />
              </View>
            </View>
          );

        case "ad-banner":
          if (!item.data) return null;
          return (
            <Animated.View
              entering={FadeIn.delay(100).duration(300)}
              style={[styles.sectionContainer, styles.adContainer]}
            >
              <BannerAd
                ad={item.data}
                onAdClick={handleAdClick}
                onAdLoad={() => handleAdImpression(item.data)}
                style={styles.bannerAd}
              />
            </Animated.View>
          );

        case "trending-videos":
          return (
            <View style={styles.sectionContainer}>
              <Section
                title="Trending Videos"
                icon="play-circle"
                seeAllAction={() => router.push("/(tabs)/videos-new")}
              >
                <FlatList
                  horizontal
                  data={trendingVideos}
                  keyExtractor={(video) => video.id}
                  renderItem={({ item: video }) => (
                    <MemoizedVideoItem
                      video={video}
                      onPress={() => router.push("/(tabs)/videos-new")}
                    />
                  )}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  ItemSeparatorComponent={HorizontalSeparator}
                  removeClippedSubviews
                  maxToRenderPerBatch={4}
                  windowSize={5}
                  initialNumToRender={3}
                />
              </Section>
            </View>
          );

        case "earning-opportunities":
          return (
            <View style={styles.sectionContainer}>
              <Section
                title="For You"
                icon="star"
                seeAllAction={() => router.push("/instant-reward-questions")}
              >
                <View style={styles.opportunitiesHeader}>
                  <Sparkles size={14} color={colors.warning} />
                  <Text
                    style={[styles.opportunitiesSubtitle, { color: colors.textSecondary }]}
                    allowFontScaling
                    maxFontSizeMultiplier={1.2}
                  >
                    Personalized earning opportunities
                  </Text>
                </View>
                <EarningOpportunitiesList
                  opportunities={earningOpportunities}
                  onOpportunityPress={handleOpportunityPress}
                  variant="compact"
                />
              </Section>
            </View>
          );

        case "ad-native":
          if (!item.data) return null;
          return (
            <Animated.View
              entering={FadeIn.delay(100).duration(300)}
              style={[styles.sectionContainer, styles.adContainer]}
            >
              <NativeAd
                ad={item.data}
                onAdClick={handleAdClick}
                onAdLoad={() => handleAdImpression(item.data)}
                style={styles.nativeAd}
              />
            </Animated.View>
          );

        case "ad-featured":
          if (!item.data) return null;
          return (
            <Animated.View
              entering={FadeIn.delay(100).duration(300)}
              style={[styles.sectionContainer, styles.adContainer]}
            >
              <AdPlacementWrapper
                ad={item.data}
                placement="between-content"
                onAdClick={handleAdClick}
                onAdLoad={() => handleAdImpression(item.data)}
                style={styles.featuredAdPlacement}
              />
            </Animated.View>
          );

        case "ad-in-feed":
          if (!item.data) return null;
          return (
            <Animated.View
              entering={FadeIn.delay(100).duration(300)}
              style={[styles.sectionContainer, styles.adContainer]}
            >
              <InFeedAd
                ad={item.data}
                index={1}
                onAdClick={handleAdClick}
                onAdLoad={() => handleAdImpression(item.data)}
                style={styles.inFeedAd}
              />
            </Animated.View>
          );

        case "ad-between-content":
          if (!item.data) return null;
          return (
            <Animated.View
              entering={FadeIn.delay(100).duration(300)}
              style={[styles.sectionContainer, styles.adContainer]}
            >
              <BetweenContentAd
                ad={item.data}
                onAdClick={handleAdClick}
                onAdLoad={() => handleAdImpression(item.data)}
                variant="native"
                style={styles.betweenContentAd}
              />
            </Animated.View>
          );

        case "running-surveys":
          return (
            <View style={styles.sectionContainer}>
              <Section
                title="Live Surveys"
                icon="clipboard-text"
                seeAllAction={() => router.push("/(tabs)/surveys-new")}
              >
                <View style={styles.surveyStatusHeader}>
                  <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                  <Text
                    style={[styles.surveyStatusText, { color: colors.textMuted }]}
                    allowFontScaling
                    maxFontSizeMultiplier={1.2}
                  >
                    Active now
                  </Text>
                </View>
                {runningSurveys && runningSurveys.length > 0 ? (
                  <FlatList
                    horizontal
                    data={runningSurveys.slice(0, 4)}
                    keyExtractor={(survey) => survey.id}
                    renderItem={({ item: survey }) => (
                      <MemoizedSurveyItem
                        survey={survey}
                        onPress={() => router.push(`/survey/${survey.id}` as Href)}
                      />
                    )}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalList}
                    ItemSeparatorComponent={HorizontalSeparator}
                    removeClippedSubviews
                    maxToRenderPerBatch={3}
                    windowSize={5}
                    initialNumToRender={2}
                  />
                ) : (
                  <View style={[styles.emptyState, { backgroundColor: colors.elevated }]}>
                    <MaterialCommunityIcons
                      name="clipboard-off"
                      size={28}
                      color={colors.textMuted}
                    />
                    <Text
                      style={[styles.emptyStateText, { color: colors.textMuted }]}
                      accessibilityRole="text"
                      allowFontScaling
                      maxFontSizeMultiplier={1.2}
                    >
                      No live surveys — check back soon!
                    </Text>
                  </View>
                )}
              </Section>
            </View>
          );

        case "upcoming-surveys":
          if (!upcomingSurveys || upcomingSurveys.length === 0) return null;
          return (
            <View style={styles.sectionContainer}>
              <Section
                title="Coming Soon"
                icon="clipboard-clock"
                seeAllAction={() => router.push("/(tabs)/surveys-new")}
              >
                <View style={styles.surveyStatusHeader}>
                  <Clock size={12} color={colors.warning} />
                  <Text
                    style={[styles.surveyStatusText, { color: colors.warning }]}
                    allowFontScaling
                    maxFontSizeMultiplier={1.2}
                  >
                    Upcoming
                  </Text>
                </View>
                <FlatList
                  horizontal
                  data={upcomingSurveys.slice(0, 4)}
                  keyExtractor={(survey) => survey.id}
                  renderItem={({ item: survey }) => (
                    <MemoizedSurveyItem
                      survey={survey}
                      variant="compact"
                      onPress={() => router.push(`/survey/${survey.id}` as Href)}
                    />
                  )}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  ItemSeparatorComponent={HorizontalSeparator}
                  removeClippedSubviews
                  maxToRenderPerBatch={3}
                  windowSize={5}
                  initialNumToRender={2}
                />
              </Section>
            </View>
          );

        case "statistics":
          return (
            <View style={styles.sectionContainer}>
              <Section title="Your Progress" icon="chart-bar">
                {/* Weekly Earnings Progress */}
                <ProgressCard
                  title="Weekly Earnings Goal"
                  current={dashboardStats?.weeklyEarnings || 0}
                  goal={200}
                  unit="UGX"
                  icon={<TrendingUp size={18} color={colors.success} strokeWidth={1.5} />}
                  progressColor={colors.success}
                  style={styles.progressCard}
                />

                {/* Engagement Stats */}
                <View style={styles.engagementRow}>
                  <StatCard
                    icon={<Award size={16} color={colors.primary} strokeWidth={1.5} />}
                    title="Questions"
                    value={dashboardStats?.questionsAnswered || 0}
                    variant="compact"
                    style={styles.engagementCard}
                  />
                  <StatCard
                    icon={<Zap size={16} color={colors.success} strokeWidth={1.5} />}
                    title="Surveys"
                    value={dashboardStats?.surveysCompleted || 0}
                    variant="compact"
                    style={styles.engagementCard}
                  />
                  <StatCard
                    icon={<Play size={16} color={colors.error} strokeWidth={1.5} />}
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
                  icon={<Target size={18} color={colors.warning} strokeWidth={1.5} />}
                  progressColor={colors.warning}
                  showPercentage
                  style={styles.progressCard}
                />
              </Section>
            </View>
          );

        case "explore":
          return (
            <View style={styles.sectionContainer}>
              <Section title="Explore" icon="compass">
                <View style={styles.exploreGrid}>
                  {EXPLORE_ITEMS.map((item, idx) => (
                    <View
                      key={item.id}
                      style={[
                        styles.exploreItemWrapper,
                        { width: isTablet ? "23%" : "48%" },
                      ]}
                    >
                      <ExploreCard
                        icon={item.icon}
                        title={item.title}
                        description={item.description}
                        colors={item.colors}
                        onPress={() => handleExplorePress(item.id)}
                        index={idx}
                        variant={isSmallScreen ? "compact" : "default"}
                      />
                    </View>
                  ))}
                </View>
              </Section>
            </View>
          );

        case "footer-spacer":
          return <View style={{ height: insets.bottom + SPACING["3xl"] }} />;

        default:
          return null;
      }
    },
    [
      colors,
      user,
      dailyReward,
      dashboardStats,
      unreadCount,
      trendingVideos,
      recentQuestions,
      runningSurveys,
      upcomingSurveys,
      earningOpportunities,
      searchQuery,
      claimDailyReward.isPending,
      headerAnimatedStyle,
      handleClaimDailyReward,
      handleAnswerQuestion,
      handleWatchVideo,
      handleTakeSurvey,
      handleSearch,
      handleAdClick,
      handleAdImpression,
      handleExplorePress,
      handleOpportunityPress,
      insets.bottom,
    ]
  );

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: DashboardSection) => item.id, []);

  // Show skeleton during initial load
  if (isInitialLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Status bar with translucent for edge-to-edge design */}
        <StatusBar style={statusBarStyle} translucent animated />
        <View
          style={[
            styles.skeletonContainer,
            { paddingTop: insets.top + SPACING.sm, paddingHorizontal: horizontalPadding },
          ]}
        >
          <DashboardSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Status bar with translucent for edge-to-edge design */}
      <StatusBar style={statusBarStyle} translucent animated />
      
      <AnimatedFlatList
        ref={flatListRef}
        data={sections}
        keyExtractor={keyExtractor}
        renderItem={renderSection}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.flatListContent,
          { paddingTop: insets.top + SPACING.sm, paddingHorizontal: horizontalPadding },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressViewOffset={insets.top}
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === "android"}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={100}
        windowSize={7}
        initialNumToRender={4}
        // Performance optimizations
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        // Accessibility
        accessibilityLabel="Dashboard"
        accessibilityRole="scrollbar"
      />

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
  skeletonContainer: {
    flex: 1,
  },
  flatListContent: {
    flexGrow: 1,
  },
  sectionContainer: {
    marginBottom: SPACING.sm,
  },
  searchBar: {
    marginBottom: SPACING.md,
  },

  // Wallet card
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
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: "rgba(255, 255, 255, 0.85)",
    marginLeft: SPACING.sm,
  },
  walletBalance: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: isSmallScreen ? TYPOGRAPHY.fontSize["4xl"] : TYPOGRAPHY.fontSize["5xl"],
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
    minWidth: COMPONENT_SIZE.touchTarget,
    minHeight: COMPONENT_SIZE.touchTarget,
    justifyContent: "center",
    alignItems: "center",
  },
  walletButtonSecondary: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  walletButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: "#FFFFFF",
  },
  walletDecor1: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  walletDecor2: {
    position: "absolute",
    bottom: -20,
    right: 40,
    width: 60,
    height: 60,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },

  // Horizontal lists
  horizontalList: {
    paddingRight: SPACING.base,
  },

  // Opportunities
  opportunitiesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  opportunitiesSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Surveys
  surveyStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.xs,
  },
  surveyStatusText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Empty state
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
    textAlign: "center",
  },

  // Statistics
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

  // Explore
  exploreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  exploreItemWrapper: {
    marginBottom: SPACING.sm,
  },

  // Ad Containers - Industry Standard: Non-intrusive, clearly labeled, smooth transitions
  adContainer: {
    marginVertical: SPACING.lg,
    marginHorizontal: -SPACING.xs,
  },
  bannerAd: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  nativeAd: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  // In-feed Ad - Minimal footprint
  inFeedAd: {
    marginVertical: SPACING.sm,
  },
  // Between content Ad - Natural content boundaries
  betweenContentAd: {
    marginVertical: SPACING.lg,
    marginHorizontal: -SPACING.sm,
  },
  // Banner Ad Placement
  bannerAdPlacement: {
    marginVertical: SPACING.md,
  },
  // Featured Ad Placement - Premium positioning
  featuredAdPlacement: {
    marginVertical: SPACING.lg,
  },
  // Banner Ad Container
  bannerAdContainer: {
    marginVertical: SPACING.md,
    alignItems: "center",
  },
});
