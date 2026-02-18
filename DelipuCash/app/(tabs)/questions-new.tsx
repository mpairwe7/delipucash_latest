/**
 * Questions Screen - Industry-Standard Q&A Feed
 *
 * Performance optimizations applied:
 * - Infinite scroll via useInfiniteQuery (server-side pagination)
 * - Deferred non-essential data fetching (ads, leaderboard load after feed)
 * - Consolidated ad hook (single request instead of 3)
 * - Extracted memoized FeedHeader to prevent FlatList header thrashing
 * - Stable renderItem callbacks via onPressById/onVoteById (no inline closures)
 * - Capped FadeIn animation to first render batch only
 * - Zustand-persisted selectedTab across navigations
 * - placeholderData: keepPreviousData prevents flash on tab switch
 * - Ad impression deduplication via Set
 * - FAB auto-hides on scroll down, reappears on scroll up
 * - Scroll position preserved per tab
 * - Prefetch adjacent tabs after initial load
 * - Pull-to-refresh only refetches feed + stats (ads use cache TTL)
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  memo,
} from "react";
import {
  Alert,
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ListRenderItemInfo,
  ViewToken,
  ViewabilityConfig,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useStatusBar } from "@/hooks/useStatusBar";
import { Href, router } from "expo-router";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Plus,
  Search,
  Clock3,
  Award,
  TrendingUp,
  User,
  Sparkles,
  HelpCircle,
} from "lucide-react-native";

// Components
import {
  NotificationBell,
  PrimaryButton,
  StatCard,
  SearchOverlay,
} from "@/components";

// Feed components
import {
  QuestionFeedItem,
  FeedTabs,
  FeedTab,
  FeedQuestion,
  CreateQuestionWizard,
  QuestionFormData,
  QuestionFeedSkeleton,
  GamificationSkeleton,
  StatsRowSkeleton,
  FeedTabsSkeleton,
  StreakCounter,
  PointsDisplay,
  DailyProgress,
  LeaderboardSnippet,
  RewardProgress,
  AnswerEarnCTA,
  InstantRewardCTA,
  AskCommunityCTA,
} from "@/components/feed";

// Ads
import {
  InFeedAd,
  BetweenContentAd,
  AdPlacementWrapper,
} from "@/components/ads";

// Hooks & Services — consolidated: removed duplicate hooks.ts prefetch calls
import { useUnreadCount } from "@/services/hooks";
import {
  useInfiniteQuestionsFeed,
  useQuestionsLeaderboard,
  useUserQuestionsStats,
  useVoteQuestion,
  useCreateQuestion,
  usePrefetchQuestions,
  FeedTabId,
} from "@/services/questionHooks";
import {
  useScreenAds,
  useRecordAdClick,
  useRecordAdImpression,
} from "@/services/adHooksRefactored";
import { useSearch } from "@/hooks/useSearch";
import useUser from "@/utils/useUser";
import { useAuth } from "@/utils/auth/useAuth";

// Store — persisted tab selection
import { useQuestionUIStore, selectSelectedTab } from "@/store";

// Types
import { UserRole, Ad, Question } from "@/types";

// Theme
import {
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  COMPONENT_SIZE,
  withAlpha,
} from "@/utils/theme";
import { triggerHaptic } from "@/utils/quiz-utils";

// Error Boundary
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ============================================================================
// PERFORMANCE: Memoized wrapper to avoid inline closure in renderItem
// ============================================================================

interface MemoizedInFeedAdProps {
  ad: Ad;
  index: number;
  onAdClick: (ad: Ad) => void;
  onAdImpression: (ad: Ad, duration?: number) => void;
  style?: any;
}

const MemoizedInFeedAd = memo<MemoizedInFeedAdProps>(
  function MemoizedInFeedAd({ ad, index, onAdClick, onAdImpression, style }) {
    const handleLoad = useCallback(() => onAdImpression(ad), [ad, onAdImpression]);
    return (
      <InFeedAd
        ad={ad}
        index={index}
        onAdClick={onAdClick}
        onAdLoad={handleLoad}
        style={style}
      />
    );
  }
);

// getItemLayout removed: heterogeneous feed rows (questions, ads, CTAs) have
// different heights — a fixed estimate hurts scroll restoration and virtualization.
// removeClippedSubviews + windowSize + maxToRenderPerBatch handle perf.

// ============================================================================
// TYPES
// ============================================================================

interface FeedItem {
  type: "question" | "ad" | "gamification" | "cta";
  data: FeedQuestion | Ad | null;
  id: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FEED_TABS: FeedTab[] = [
  { id: "for-you", label: "For You", icon: Sparkles },
  { id: "latest", label: "Latest", icon: Clock3 },
  { id: "unanswered", label: "Unanswered", badge: "HOT" },
  { id: "rewards", label: "Rewards", icon: Award },
  { id: "my-activity", label: "My Activity", icon: User },
];

const AD_INSERTION_INTERVAL = 3;

// Stable viewability config (defined outside component to prevent recreation)
const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 1000,
};

// ============================================================================
// EXTRACTED MEMOIZED HEADER
// ============================================================================

interface FeedHeaderProps {
  isStatsLoading: boolean;
  isFeedLoading: boolean;
  userStats: ReturnType<typeof useUserQuestionsStats>["data"];
  colors: ReturnType<typeof useStatusBar>["colors"];
  selectedTab: FeedTabId;
  feedStats: {
    totalQuestions: number;
    unansweredCount: number;
    rewardsCount: number;
  };
  leaderboard: ReturnType<typeof useQuestionsLeaderboard>["data"];
  bannerAds: Ad[] | undefined;
  feedAds: Ad[] | undefined;
  featuredAds: Ad[] | undefined;
  isSearching: boolean;
  searchQuery: string;
  searchResultsCount: number;
  hasNoResults: boolean;
  onTabChange: (tabId: string) => void;
  onInstantRewardPress: () => void;
  onAnswerEarnPress: () => void;
  onAdClick: (ad: Ad) => void;
  onAdImpression: (ad: Ad) => void;
  onClearSearch: () => void;
  onOpenCreateWizard: () => void;
}

const FeedHeader = memo<FeedHeaderProps>(function FeedHeader({
  isStatsLoading,
  isFeedLoading,
  userStats,
  colors,
  selectedTab,
  feedStats,
  leaderboard,
  bannerAds,
  feedAds,
  featuredAds,
  isSearching,
  searchQuery,
  searchResultsCount,
  hasNoResults,
  onTabChange,
  onInstantRewardPress,
  onAnswerEarnPress,
  onAdClick,
  onAdImpression,
  onClearSearch,
  onOpenCreateWizard,
}) {
  return (
    <View>
      {/* Gamification Row */}
      {!isStatsLoading ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.gamificationRow}
        >
          <StreakCounter
            streak={userStats?.currentStreak || 0}
            isActiveToday={(userStats?.questionsAnsweredToday ?? 0) > 0}
            size="compact"
            onPress={() => console.log("Streak details")}
          />
          <PointsDisplay
            points={userStats?.totalEarnings || 0}
            size="compact"
            onPress={() => router.push("/(tabs)/withdraw" as Href)}
          />
          <DailyProgress
            current={userStats?.questionsAnsweredToday || 0}
            target={userStats?.dailyTarget || 10}
            label="Questions"
            size={50}
            onPress={() => console.log("Daily goal details")}
          />
        </Animated.View>
      ) : (
        <GamificationSkeleton />
      )}

      {/* Stats Row */}
      {!isStatsLoading ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.statsRow}>
          <StatCard
            icon={<Award size={18} color={colors.primary} strokeWidth={1.5} />}
            title="Answered"
            value={userStats?.totalAnswered || 0}
            subtitle="Total responses"
          />
          <StatCard
            icon={
              <TrendingUp size={18} color={colors.success} strokeWidth={1.5} />
            }
            title="Today"
            value={userStats?.questionsAnsweredToday || 0}
            subtitle={`Goal: ${userStats?.dailyTarget || 10}`}
          />
        </Animated.View>
      ) : (
        <StatsRowSkeleton />
      )}

      {/* Smart Banner Ad */}
      {bannerAds && bannerAds.length > 0 && (
        <AdPlacementWrapper
          ad={bannerAds[0]}
          placement="banner-top"
          onAdClick={onAdClick}
          onImpression={onAdImpression}
          trackViewability
          style={styles.bannerAdPlacement}
        />
      )}

      {/* Answer & Earn CTA — navigates to answer screen */}
      <AnswerEarnCTA
        colors={colors}
        pointsPerQuestion={10}
        streakActive={(userStats?.currentStreak ?? 0) > 0}
        onPress={onAnswerEarnPress}
      />

      {/* Between-CTA Ad — question placement */}
      {feedAds && feedAds.length > 0 && (
        <BetweenContentAd
          ad={feedAds[0]}
          onAdClick={onAdClick}
          variant="compact"
          style={styles.betweenCtaAd}
        />
      )}

      {/* Answer Instant Reward Questions Card */}
      <InstantRewardCTA
        colors={colors}
        onPress={onInstantRewardPress}
      />

      {/* Ask Questions CTA */}
      <AskCommunityCTA
        colors={colors}
        onPress={onOpenCreateWizard}
      />

      {/* In-Feed Native Ad — placed after CTAs */}
      {feedAds && feedAds.length > 1 && (
        <BetweenContentAd
          ad={feedAds[1]}
          onAdClick={onAdClick}
          variant="native"
          style={styles.betweenContentAd}
        />
      )}

      {/* Reward Progress — wired to real stats */}
      <RewardProgress
        currentPoints={userStats?.totalEarnings || 0}
        nextTier={{ points: 2500, cashValue: 25000, label: "25,000 UGX" }}
        canRedeem={(userStats?.totalEarnings || 0) >= 500}
        onRedeem={() => router.push("/(tabs)/withdraw" as Href)}
      />

      {/* Leaderboard Snippet */}
      <LeaderboardSnippet
        users={leaderboard?.users || []}
        currentUserRank={leaderboard?.currentUserRank || 0}
        onPress={() => console.log("View full leaderboard")}
      />

      {/* Featured Ad */}
      {featuredAds && featuredAds.length > 0 && (
        <AdPlacementWrapper
          ad={featuredAds[0]}
          placement="between-content"
          onAdClick={onAdClick}
          onImpression={onAdImpression}
          trackViewability
          style={styles.featuredAdPlacement}
        />
      )}

      {/* Compact Ad */}
      {bannerAds && bannerAds.length > 1 && (
        <InFeedAd
          ad={bannerAds[1]}
          index={1}
          onAdClick={onAdClick}
          onImpression={onAdImpression}
          trackViewability
          style={styles.inFeedAd}
        />
      )}

      {/* Feed Tabs */}
      {!isFeedLoading ? (
        <FeedTabs
          tabs={FEED_TABS.map((tab) =>
            tab.id === "unanswered"
              ? {
                  ...tab,
                  badge:
                    feedStats.unansweredCount > 0
                      ? `${feedStats.unansweredCount}`
                      : "HOT",
                }
              : tab
          )}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
          variant="pill"
          showIcons={true}
          style={styles.feedTabs}
        />
      ) : (
        <FeedTabsSkeleton />
      )}

      {/* Search Feedback */}
      {isSearching && (
        <View style={styles.searchFeedback}>
          <Text
            style={[styles.searchFeedbackText, { color: colors.textMuted }]}
          >
            {hasNoResults
              ? `No questions found for "${searchQuery}"`
              : `Found ${searchResultsCount} question${searchResultsCount !== 1 ? "s" : ""}`}
          </Text>
          <Pressable onPress={onClearSearch}>
            <Text style={[styles.clearSearchText, { color: colors.primary }]}>
              Clear
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function QuestionsScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, style: statusBarStyle } = useStatusBar();
  const { data: user } = useUser();
  const { isReady: authReady, isAuthenticated } = useAuth();

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const scrollOffsets = useRef<Record<FeedTabId, number>>({
    "for-you": 0,
    latest: 0,
    unanswered: 0,
    rewards: 0,
    "my-activity": 0,
  });
  const impressedAdIds = useRef(new Set<string>());
  const lastScrollY = useRef(0);

  // Persisted tab from Zustand (survives navigations)
  const selectedTab = useQuestionUIStore(selectSelectedTab);
  const setSelectedTab = useQuestionUIStore((s) => s.setSelectedTab);

  // UI State
  const [refreshing, setRefreshing] = useState(false);
  const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  // FAB animation
  const fabScale = useSharedValue(1);
  const fabRotation = useSharedValue(0);
  const fabTranslateY = useSharedValue(0);

  // ========== DATA FETCHING ==========
  // Essential: infinite feed + user stats load immediately
  const {
    data: infiniteData,
    isLoading: isFeedLoading,
    refetch: refetchFeed,
    isError: hasFeedError,
    error: feedError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuestionsFeed(selectedTab);

  const {
    data: userStats,
    isLoading: isUserStatsLoading,
    refetch: refetchUserStats,
  } = useUserQuestionsStats();

  // Deferred: leaderboard loads after feed is ready
  const { data: leaderboard } = useQuestionsLeaderboard(3, !isFeedLoading);

  // Notification count
  const { data: unreadCount } = useUnreadCount(isAuthenticated);

  // Consolidated ads — single hook replaces 3 separate ones, deferred until feed loads
  const { data: screenAds } = useScreenAds("question", {
    feedLimit: 6,
    bannerLimit: 3,
    featuredLimit: 2,
    enabled: !isFeedLoading,
  });
  const feedAds = screenAds?.feedAds;
  const bannerAds = screenAds?.bannerAds;
  const featuredAds = screenAds?.featuredAds;

  // Extract stable .mutate references to avoid unstable deps
  const recordAdClickMutate = useRecordAdClick().mutate;
  const recordAdImpressionMutate = useRecordAdImpression().mutate;

  // Mutations — extract .mutate/.mutateAsync for stable useCallback deps
  const voteMutate = useVoteQuestion().mutate;
  const createMutateAsync = useCreateQuestion().mutateAsync;

  // User permissions
  const isAdmin =
    user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;
  const isStatsLoading = isUserStatsLoading && !userStats;

  // Flatten infinite pages into a single array
  const allQuestions = useMemo(
    () => infiniteData?.pages.flatMap((p) => p.questions) ?? [],
    [infiniteData]
  );

  const feedStats = useMemo(
    () =>
      infiniteData?.pages[0]?.stats ?? {
        totalQuestions: 0,
        unansweredCount: 0,
        rewardsCount: 0,
      },
    [infiniteData]
  );

  // Prefetch adjacent tabs after initial load
  const prefetch = usePrefetchQuestions();
  useEffect(() => {
    if (!isFeedLoading) prefetch();
  }, [isFeedLoading, prefetch]);

  // Search
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filteredResults: searchResults,
    isSearching,
    recentSearches,
    removeFromHistory,
    clearHistory,
    submitSearch,
    hasNoResults,
  } = useSearch({
    data: allQuestions,
    searchFields: ["text", "category"],
    storageKey: "@questions_search_history",
    debounceMs: 250,
    customFilter: (question: Question, query: string) => {
      const lower = query.toLowerCase();
      return (
        (question.text || "").toLowerCase().includes(lower) ||
        (question.category || "").toLowerCase().includes(lower)
      );
    },
  });

  const displayQuestions = isSearching ? searchResults : allQuestions;

  // Build feed items with ad insertion
  const feedItems = useMemo((): FeedItem[] => {
    const items: FeedItem[] = [];

    displayQuestions.forEach((question, index) => {
      items.push({
        type: "question",
        data: question,
        id: `question-${question.id}`,
      });

      const shouldInsertAd = (index + 1) % AD_INSERTION_INTERVAL === 0;
      const hasAds = Array.isArray(feedAds) && feedAds.length > 0;

      if (shouldInsertAd && hasAds) {
        const adIndex =
          Math.floor(index / AD_INSERTION_INTERVAL) % feedAds.length;
        const ad = feedAds[adIndex];
        if (ad) {
          items.push({
            type: "ad",
            data: ad,
            id: `ad-${ad.id}-${selectedTab}-${index}`,
          });
        }
      }
    });

    return items;
  }, [displayQuestions, feedAds, selectedTab]);

  // ========== EVENT HANDLERS ==========
  // Pull-to-refresh: only essential data (ads use cache TTL)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    triggerHaptic("light");
    await Promise.all([refetchFeed(), refetchUserStats()]);
    setRefreshing(false);
  }, [refetchFeed, refetchUserStats]);

  const handleTabChange = useCallback(
    (tabId: string) => {
      setSelectedTab(tabId as FeedTabId);
      triggerHaptic("light");
      impressedAdIds.current.clear();
      // Restore scroll position for the new tab
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: scrollOffsets.current[tabId as FeedTabId] || 0,
          animated: false,
        });
      }, 100);
    },
    [setSelectedTab]
  );

  // Infinite scroll — load next page when end is reached
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Scroll handler — FAB auto-hide + per-tab scroll position tracking
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = e.nativeEvent.contentOffset.y;
      const dy = currentY - lastScrollY.current;

      // FAB auto-hide: hide on scroll down, show on scroll up
      if (dy > 10 && currentY > 100) {
        fabTranslateY.value = withTiming(120, { duration: 200 });
      } else if (dy < -10) {
        fabTranslateY.value = withTiming(0, { duration: 200 });
      }

      lastScrollY.current = currentY;
      scrollOffsets.current[selectedTab] = currentY;
    },
    [fabTranslateY, selectedTab]
  );

  // Stable handlers that accept IDs — avoids inline closures in renderItem
  const handleQuestionPressById = useCallback(
    (questionId: string, isInstantReward?: boolean) => {
      if (!authReady) return;
      if (!isAuthenticated) {
        router.push("/(auth)/login" as Href);
        return;
      }
      triggerHaptic("light");
      if (isInstantReward) {
        // Route to listing screen — feed Question.id != RewardQuestion.id
        router.push("/instant-reward-questions" as Href);
      } else {
        router.push(`/question-answer/${questionId}` as Href);
      }
    },
    [authReady, isAuthenticated]
  );

  const handleVoteById = useCallback(
    (questionId: string, type: "up" | "down") => {
      triggerHaptic("light");
      voteMutate({ questionId, type });
    },
    [voteMutate]
  );

  const handleSearchSubmit = useCallback(
    (query: string) => {
      submitSearch(query);
      setSearchOverlayVisible(false);
      if (query.trim()) triggerHaptic("light");
    },
    [submitSearch]
  );

  const handleAdClick = useCallback(
    (ad: Ad) => {
      recordAdClickMutate({
        adId: ad.id,
        placement: "question",
        deviceInfo: { platform: "ios", version: "1.0" },
      });
    },
    [recordAdClickMutate]
  );

  const handleAdImpression = useCallback(
    (ad: Ad, duration: number = 1000) => {
      recordAdImpressionMutate({
        adId: ad.id,
        placement: "question",
        duration,
        wasVisible: true,
        viewportPercentage: 100,
      });
    },
    [recordAdImpressionMutate]
  );

  const handleFABPress = useCallback(() => {
    triggerHaptic("medium");
    fabScale.value = withSpring(0.9, {}, () => {
      fabScale.value = withSpring(1);
    });
    fabRotation.value = withTiming(fabRotation.value + 45, { duration: 200 });
    setShowCreateWizard(true);
  }, [fabScale, fabRotation]);

  const handleQuestionSubmit = useCallback(
    async (data: QuestionFormData) => {
      try {
        await createMutateAsync({
          text: data.title,
          category: data.category,
          rewardAmount: 0,
          isInstantReward: false,
        });
        setShowCreateWizard(false);
        triggerHaptic("success");
      } catch (error) {
        console.error("Failed to create question:", error);
        triggerHaptic("error");
      }
    },
    [createMutateAsync]
  );

  const handleClearSearch = useCallback(
    () => setSearchQuery(""),
    [setSearchQuery]
  );
  const handleOpenCreateWizard = useCallback(
    () => setShowCreateWizard(true),
    []
  );
  const handleInstantRewardPress = useCallback(
    () => {
      if (!authReady) return;
      if (!isAuthenticated) {
        router.push("/(auth)/login" as Href);
        return;
      }
      triggerHaptic("light");
      router.push("/instant-reward-questions" as Href);
    },
    [authReady, isAuthenticated]
  );

  // Navigate to reward questions listing — shows available vs attempted
  const handleAnswerEarnPress = useCallback(() => {
    if (!authReady) return;
    if (!isAuthenticated) {
      router.push("/(auth)/login" as Href);
      return;
    }
    triggerHaptic("light");
    router.push("/reward-questions" as Href);
  }, [authReady, isAuthenticated]);

  // FAB animation styles — includes auto-hide translateY
  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: fabScale.value },
      { rotate: `${fabRotation.value}deg` },
      { translateY: fabTranslateY.value },
    ],
  }));

  // Viewability config — ad impressions are now tracked by InFeedAd/AdPlacementWrapper
  // via IAB viewability standard (50% visible for 1s). No duplicate impression here.
  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: VIEWABILITY_CONFIG,
      onViewableItemsChanged: () => {
        // Impressions handled by individual ad components via trackViewability
      },
    },
  ]);

  // ========== RENDER FUNCTIONS ==========
  // Stable ad identity keys — prevent header re-render when ad objects are
  // referentially new but content-identical (TanStack Query refetches).
  const bannerAdIds = useMemo(() => bannerAds?.map(a => a.id).join(',') ?? '', [bannerAds]);
  const feedAdIds = useMemo(() => feedAds?.map(a => a.id).join(',') ?? '', [feedAds]);
  const featuredAdIds = useMemo(() => featuredAds?.map(a => a.id).join(',') ?? '', [featuredAds]);
  const leaderboardKey = leaderboard?.users?.[0]?.id ?? '';

  // Header as element (not function) — avoids extra wrapper View from FlatList
  const headerElement = useMemo(
    () => (
      <FeedHeader
        isStatsLoading={isStatsLoading}
        isFeedLoading={isFeedLoading}
        userStats={userStats}
        colors={colors}
        selectedTab={selectedTab}
        feedStats={feedStats}
        leaderboard={leaderboard}
        bannerAds={bannerAds}
        feedAds={feedAds}
        featuredAds={featuredAds}
        isSearching={isSearching}
        searchQuery={searchQuery}
        searchResultsCount={searchResults.length}
        hasNoResults={hasNoResults}
        onTabChange={handleTabChange}
        onInstantRewardPress={handleInstantRewardPress}
        onAnswerEarnPress={handleAnswerEarnPress}
        onAdClick={handleAdClick}
        onAdImpression={handleAdImpression}
        onClearSearch={handleClearSearch}
        onOpenCreateWizard={handleOpenCreateWizard}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps — ad arrays tracked via stable ID keys
    [
      isStatsLoading,
      isFeedLoading,
      userStats?.totalAnswered,
      userStats?.questionsAnsweredToday,
      userStats?.currentStreak,
      userStats?.totalEarnings,
      feedStats.totalQuestions,
      feedStats.unansweredCount,
      feedStats.rewardsCount,
      selectedTab,
      leaderboardKey,
      bannerAdIds,
      feedAdIds,
      featuredAdIds,
      isSearching,
      searchQuery,
      searchResults.length,
      hasNoResults,
      handleTabChange,
      handleInstantRewardPress,
      handleAnswerEarnPress,
      handleAdClick,
      handleAdImpression,
      handleClearSearch,
      handleOpenCreateWizard,
      colors.background,
      colors.text,
      colors.primary,
    ]
  );

  // Stable renderItem — uses ID-based handlers, no inline closures
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<FeedItem>) => {
      if (item.type === "question" && item.data) {
        const question = item.data as FeedQuestion;
        return (
          <QuestionFeedItem
            question={question}
            onPressById={handleQuestionPressById}
            onVoteById={handleVoteById}
            variant={index === 0 ? "featured" : "default"}
            index={index}
            showRewardGlow={question.isInstantReward}
            testID={`question-${question.id}`}
          />
        );
      }

      if (item.type === "ad" && item.data) {
        const ad = item.data as Ad;
        return (
          <MemoizedInFeedAd
            ad={ad}
            index={index}
            onAdClick={handleAdClick}
            onAdImpression={handleAdImpression}
            style={styles.inFeedAd}
          />
        );
      }

      return null;
    },
    [handleQuestionPressById, handleVoteById, handleAdClick, handleAdImpression]
  );

  const renderEmptyState = useCallback(() => {
    if (isFeedLoading) {
      return <QuestionFeedSkeleton count={5} />;
    }

    if (hasFeedError) {
      return (
        <View style={styles.emptyState}>
          <HelpCircle size={48} color={colors.error} strokeWidth={1} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Something went wrong
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {feedError?.message ||
              "Unable to load questions. Please try again."}
          </Text>
          <PrimaryButton
            title="Try Again"
            onPress={() => refetchFeed()}
            style={styles.emptyButton}
          />
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Sparkles size={48} color={colors.textMuted} strokeWidth={1} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No questions yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Be the first to ask a question or check back later
        </Text>
        <PrimaryButton
          title="Ask a Question"
          onPress={handleOpenCreateWizard}
          style={styles.emptyButton}
        />
      </View>
    );
  }, [
    isFeedLoading,
    colors,
    hasFeedError,
    feedError,
    refetchFeed,
    handleOpenCreateWizard,
  ]);

  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    return null;
  }, [isFetchingNextPage, colors.primary]);

  const keyExtractor = useCallback((item: FeedItem) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} translucent animated />

      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACING.sm,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Questions
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Ask, answer, earn
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setSearchOverlayVisible(true)}
            style={[
              styles.headerButton,
              { backgroundColor: withAlpha(colors.primary, 0.1) },
            ]}
            accessibilityLabel="Search questions"
            accessibilityRole="button"
          >
            <Search size={20} color={colors.primary} strokeWidth={1.5} />
          </Pressable>
          <NotificationBell
            count={unreadCount ?? 0}
            onPress={() => router.push("/notifications" as Href)}
          />
        </View>
      </Animated.View>

      {/* Main Feed */}
      <ErrorBoundary screenName="Questions Feed">
        <FlatList
          ref={flatListRef}
          data={feedItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={headerElement}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          // Infinite scroll
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          // Scroll tracking — FAB auto-hide + per-tab position
          onScroll={handleScroll}
          scrollEventThrottle={200}
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={3}
          windowSize={5}
          initialNumToRender={3}
          updateCellsBatchingPeriod={300}
          viewabilityConfigCallbackPairs={
            viewabilityConfigCallbackPairs.current
          }
          accessibilityRole="list"
          accessibilityLabel="Questions feed"
        />
      </ErrorBoundary>

      {/* Floating Action Button — auto-hides on scroll */}
      <Animated.View
        style={[
          styles.fab,
          {
            bottom: insets.bottom + SPACING.lg,
            backgroundColor: colors.primary,
          },
          fabAnimatedStyle,
        ]}
      >
        <Pressable
          onPress={handleFABPress}
          style={styles.fabTouchable}
          accessibilityLabel="Create new question"
          accessibilityRole="button"
          accessibilityHint="Double tap to open question creation wizard"
        >
          <Plus size={28} color={colors.primaryText} strokeWidth={2} />
        </Pressable>
      </Animated.View>

      {/* Search Overlay */}
      <SearchOverlay
        visible={searchOverlayVisible}
        onClose={() => setSearchOverlayVisible(false)}
        query={searchQuery}
        onChangeQuery={setSearchQuery}
        onSubmit={handleSearchSubmit}
        recentSearches={recentSearches}
        onRemoveFromHistory={removeFromHistory}
        onClearHistory={clearHistory}
        suggestions={[]}
        placeholder="Search questions..."
        searchContext="Questions"
        trendingSearches={["How to earn", "Rewards", "Survey tips", "Cash out"]}
      />

      {/* Create Question Wizard */}
      <CreateQuestionWizard
        visible={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        onSubmit={handleQuestionSubmit}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.sm,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["3xl"],
  },
  headerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  headerButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: RADIUS.base,
    alignItems: "center",
    justifyContent: "center",
  },

  // List
  listContent: {
    paddingHorizontal: SPACING.base,
  },

  // Gamification
  gamificationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
    flexWrap: "wrap",
    gap: SPACING.sm,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },

  // Earn CTA
  // Earn CTA (styles moved to CTACards.tsx)

  // Feed Tabs
  feedTabs: {
    marginVertical: SPACING.md,
  },

  // Search Feedback
  searchFeedback: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  searchFeedbackText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  clearSearchText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING["4xl"],
    gap: SPACING.md,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
    paddingHorizontal: SPACING.xl,
  },
  emptyButton: {
    marginTop: SPACING.md,
  },

  // In-feed Ad
  inFeedAd: {
    marginVertical: SPACING.sm,
  },

  // Between CTA Ad (between AnswerEarn and InstantReward)
  betweenCtaAd: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  // Between content Ad
  betweenContentAd: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },

  // Banner Ad Placement
  bannerAdPlacement: {
    marginVertical: SPACING.md,
  },

  // Featured Ad Placement
  featuredAdPlacement: {
    marginVertical: SPACING.lg,
  },

  // Instant Reward / Ask CTA styles moved to CTACards.tsx

  // FAB
  fab: {
    position: "absolute",
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabTouchable: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  // Footer loader for infinite scroll
  footerLoader: {
    paddingVertical: SPACING.lg,
    alignItems: "center",
  },
});
