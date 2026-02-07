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
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Modal,
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
  Sparkles,
  Clock3,
  Award,
  TrendingUp,
  User,
  Gift,
  Play,
  Flame,
  Star,
  MessageCircle,
  HelpCircle,
  Zap,
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
  FeedTabsSkeleton,
  StreakCounter,
  PointsDisplay,
  DailyProgress,
  LeaderboardSnippet,
  RewardProgress,
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
import { formatCurrency } from "@/services";
import { triggerHaptic } from "@/utils/quiz-utils";

// Quiz Session
import QuizSessionScreen from "@/app/quiz-session";

// Error Boundary
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
  isLoading: boolean;
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
  onQuizStart: () => void;
  onAdClick: (ad: Ad) => void;
  onAdImpression: (ad: Ad) => void;
  onClearSearch: () => void;
  onOpenCreateWizard: () => void;
}

const FeedHeader = memo<FeedHeaderProps>(function FeedHeader({
  isLoading,
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
  onQuizStart,
  onAdClick,
  onAdImpression,
  onClearSearch,
  onOpenCreateWizard,
}) {
  return (
    <View>
      {/* Gamification Row */}
      {!isLoading ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.gamificationRow}
        >
          <StreakCounter
            streak={userStats?.currentStreak || 7}
            isActiveToday={true}
            size="compact"
            onPress={() => console.log("Streak details")}
          />
          <PointsDisplay
            points={userStats?.totalEarnings || 1250}
            size="compact"
            onPress={() => router.push("/(tabs)/withdraw" as Href)}
          />
          <DailyProgress
            current={userStats?.questionsAnsweredToday || 6}
            target={10}
            label="Questions"
            size={50}
            onPress={() => console.log("Daily goal details")}
          />
        </Animated.View>
      ) : (
        <GamificationSkeleton />
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
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
          title="Earned"
          value={formatCurrency(userStats?.totalEarnings || 0)}
          subtitle="Lifetime rewards"
        />
      </View>

      {/* Smart Banner Ad */}
      {bannerAds && bannerAds.length > 0 && (
        <AdPlacementWrapper
          ad={bannerAds[0]}
          placement="banner-top"
          onAdClick={onAdClick}
          onAdLoad={() => onAdImpression(bannerAds[0])}
          style={styles.bannerAdPlacement}
        />
      )}

      {/* Answer & Earn CTA */}
      <Pressable
        style={[styles.earnCta, { backgroundColor: colors.card }]}
        onPress={onQuizStart}
        accessibilityLabel="Start answering questions to earn rewards"
        accessibilityRole="button"
      >
        <View
          style={[
            styles.earnCtaIcon,
            { backgroundColor: withAlpha(colors.primary, 0.15) },
          ]}
        >
          <Gift size={28} color={colors.primary} strokeWidth={1.5} />
        </View>
        <View style={styles.earnCtaContent}>
          <Text style={[styles.earnCtaTitle, { color: colors.text }]}>
            Answer Questions & Earn!
          </Text>
          <Text style={[styles.earnCtaSubtitle, { color: colors.textMuted }]}>
            Complete quizzes to earn points and cash rewards
          </Text>
          <View style={styles.earnCtaStats}>
            <View
              style={[
                styles.earnCtaStat,
                { backgroundColor: withAlpha(colors.warning, 0.15) },
              ]}
            >
              <Star size={12} color={colors.warning} strokeWidth={2} />
              <Text
                style={[styles.earnCtaStatText, { color: colors.warning }]}
              >
                10 pts/question
              </Text>
            </View>
            <View
              style={[
                styles.earnCtaStat,
                { backgroundColor: withAlpha(colors.error, 0.15) },
              ]}
            >
              <Flame size={12} color={colors.error} strokeWidth={2} />
              <Text style={[styles.earnCtaStatText, { color: colors.error }]}>
                Streak bonus
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.startButton, { backgroundColor: colors.primary }]}>
          <Play size={16} color={colors.primaryText} strokeWidth={2} />
          <Text style={[styles.startButtonText, { color: colors.primaryText }]}>
            Start
          </Text>
        </View>
      </Pressable>

      {/* Answer Instant Reward Questions Card */}
      <Pressable
        style={[styles.instantRewardCard, { backgroundColor: colors.card }]}
        onPress={() => router.push("/instant-reward-questions" as Href)}
        accessibilityLabel="Browse instant reward questions for quick payouts"
        accessibilityRole="button"
      >
        <View
          style={[
            styles.instantRewardIcon,
            { backgroundColor: withAlpha(colors.warning, 0.15) },
          ]}
        >
          <Sparkles size={24} color={colors.warning} strokeWidth={1.5} />
        </View>
        <View style={styles.instantRewardContent}>
          <Text style={[styles.instantRewardTitle, { color: colors.text }]}>
            Answer Instant Reward Questions!
          </Text>
          <Text
            style={[
              styles.instantRewardSubtitle,
              { color: colors.textMuted },
            ]}
          >
            Earn instant payouts for quality answers
          </Text>
        </View>
        <Zap size={20} color={colors.warning} strokeWidth={2} />
      </Pressable>

      {/* In-Feed Native Ad */}
      {feedAds && feedAds.length > 0 && (
        <BetweenContentAd
          ad={feedAds[0]}
          onAdClick={onAdClick}
          onAdLoad={() => onAdImpression(feedAds[0])}
          variant="native"
          style={styles.betweenContentAd}
        />
      )}

      {/* Ask Questions CTA */}
      <Pressable
        style={[styles.askQuestionsCta, { backgroundColor: colors.card }]}
        onPress={onOpenCreateWizard}
        accessibilityLabel="Ask a question and get answers from the community"
        accessibilityRole="button"
      >
        <View
          style={[
            styles.askQuestionsIcon,
            { backgroundColor: withAlpha(colors.info, 0.15) },
          ]}
        >
          <HelpCircle size={24} color={colors.info} strokeWidth={1.5} />
        </View>
        <View style={styles.askQuestionsContent}>
          <Text style={[styles.askQuestionsTitle, { color: colors.text }]}>
            Ask the Community
          </Text>
          <Text
            style={[styles.askQuestionsSubtitle, { color: colors.textMuted }]}
          >
            Get answers from experts and community members
          </Text>
          <View style={styles.askQuestionsStats}>
            <View
              style={[
                styles.askQuestionsStat,
                { backgroundColor: withAlpha(colors.info, 0.15) },
              ]}
            >
              <MessageCircle size={12} color={colors.info} strokeWidth={2} />
              <Text
                style={[styles.askQuestionsStatText, { color: colors.info }]}
              >
                Quick responses
              </Text>
            </View>
            <View
              style={[
                styles.askQuestionsStat,
                { backgroundColor: withAlpha(colors.success, 0.15) },
              ]}
            >
              <TrendingUp size={12} color={colors.success} strokeWidth={2} />
              <Text
                style={[
                  styles.askQuestionsStatText,
                  { color: colors.success },
                ]}
              >
                Build reputation
              </Text>
            </View>
          </View>
        </View>
        <Plus size={20} color={colors.info} strokeWidth={2} />
      </Pressable>

      {/* Reward Progress */}
      <RewardProgress
        currentPoints={userStats?.totalEarnings || 1250}
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
          onAdLoad={() => onAdImpression(featuredAds[0])}
          style={styles.featuredAdPlacement}
        />
      )}

      {/* Compact Ad */}
      {bannerAds && bannerAds.length > 1 && (
        <InFeedAd
          ad={bannerAds[1]}
          index={1}
          onAdClick={onAdClick}
          onAdLoad={() => onAdImpression(bannerAds[1])}
          style={styles.inFeedAd}
        />
      )}

      {/* Feed Tabs */}
      {!isLoading ? (
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
  const { data: user, loading: userLoading } = useUser();

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
  const [showQuizSession, setShowQuizSession] = useState(false);
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

  const { data: userStats, refetch: refetchUserStats } =
    useUserQuestionsStats();

  // Deferred: leaderboard loads after feed is ready
  const { data: leaderboard } = useQuestionsLeaderboard(3);

  // Notification count
  const { data: unreadCount } = useUnreadCount();

  // Consolidated ads — single hook replaces 3 separate ones, deferred until feed loads
  const { data: screenAds } = useScreenAds("question", {
    feedLimit: 5,
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

  // Mutations — extract .mutate for stable useCallback deps
  const voteMutate = useVoteQuestion().mutate;
  const createMutation = useCreateQuestion();

  // User permissions
  const isAdmin =
    user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;
  const isAuthenticated = !!user;
  const isLoading = isFeedLoading || userLoading;

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
      if (!isAuthenticated) {
        router.push("/(auth)/login" as Href);
        return;
      }
      triggerHaptic("light");
      if (isInstantReward) {
        router.push(`/instant-reward-answer/${questionId}` as Href);
      } else {
        router.push({
          pathname: "/question-detail",
          params: { id: questionId },
        } as Href);
      }
    },
    [isAuthenticated]
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

  const handleQuizStart = useCallback(() => {
    if (!isAuthenticated) {
      router.push("/(auth)/login" as Href);
      return;
    }
    triggerHaptic("medium");
    setShowQuizSession(true);
  }, [isAuthenticated]);

  const handleQuestionSubmit = useCallback(
    async (data: QuestionFormData) => {
      try {
        await createMutation.mutateAsync({
          text: data.title,
          category: data.category,
          rewardAmount: data.rewardAmount,
          isInstantReward: data.isRewardQuestion,
        });
        setShowCreateWizard(false);
        triggerHaptic("success");
      } catch (error) {
        console.error("Failed to create question:", error);
        triggerHaptic("error");
      }
    },
    [createMutation]
  );

  const handleClearSearch = useCallback(
    () => setSearchQuery(""),
    [setSearchQuery]
  );
  const handleOpenCreateWizard = useCallback(
    () => setShowCreateWizard(true),
    []
  );

  // FAB animation styles — includes auto-hide translateY
  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: fabScale.value },
      { rotate: `${fabRotation.value}deg` },
      { translateY: fabTranslateY.value },
    ],
  }));

  // Viewability callback ref - stable reference to prevent FlatList recreation
  const handleAdImpressionRef = useRef(handleAdImpression);
  handleAdImpressionRef.current = handleAdImpression;

  // Ad impression deduplication — each ad fires at most once per tab session
  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: VIEWABILITY_CONFIG,
      onViewableItemsChanged: ({
        viewableItems,
      }: {
        viewableItems: ViewToken[];
      }) => {
        viewableItems.forEach((item) => {
          if (item.item?.type === "ad" && item.item.data) {
            const ad = item.item.data as Ad;
            if (!impressedAdIds.current.has(ad.id)) {
              impressedAdIds.current.add(ad.id);
              handleAdImpressionRef.current(ad);
            }
          }
        });
      },
    },
  ]);

  // ========== RENDER FUNCTIONS ==========
  // Header as element (not function) — avoids extra wrapper View from FlatList
  const headerElement = useMemo(
    () => (
      <FeedHeader
        isLoading={isLoading}
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
        onQuizStart={handleQuizStart}
        onAdClick={handleAdClick}
        onAdImpression={handleAdImpression}
        onClearSearch={handleClearSearch}
        onOpenCreateWizard={handleOpenCreateWizard}
      />
    ),
    [
      isLoading,
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
      searchResults.length,
      hasNoResults,
      handleTabChange,
      handleQuizStart,
      handleAdClick,
      handleAdImpression,
      handleClearSearch,
      handleOpenCreateWizard,
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
            index={0}
            showRewardGlow={question.isInstantReward}
            testID={`question-${question.id}`}
          />
        );
      }

      if (item.type === "ad" && item.data) {
        const ad = item.data as Ad;
        return (
          <InFeedAd
            ad={ad}
            index={index}
            onAdClick={handleAdClick}
            onAdLoad={() => handleAdImpression(ad)}
            style={styles.inFeedAd}
          />
        );
      }

      return null;
    },
    [handleQuestionPressById, handleVoteById, handleAdClick, handleAdImpression]
  );

  const renderEmptyState = useCallback(() => {
    if (isLoading) {
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
    isLoading,
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
  const getItemType = useCallback((item: FeedItem) => item.type, []);

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
          scrollEventThrottle={100}
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={6}
          windowSize={5}
          initialNumToRender={4}
          updateCellsBatchingPeriod={150}
          viewabilityConfigCallbackPairs={
            viewabilityConfigCallbackPairs.current
          }
          getItemType={getItemType}
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

      {/* Quiz Session Modal */}
      <Modal
        visible={showQuizSession}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowQuizSession(false)}
      >
        <QuizSessionScreen onClose={() => setShowQuizSession(false)} />
      </Modal>

      {/* Create Question Wizard */}
      <CreateQuestionWizard
        visible={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        onSubmit={handleQuestionSubmit}
        isAdmin={isAdmin}
        userPoints={userStats?.totalEarnings || 0}
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
  earnCta: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  earnCtaIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  earnCtaContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  earnCtaTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  earnCtaSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  earnCtaStats: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  earnCtaStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  earnCtaStatText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  startButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

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

  // Instant Reward Questions Card
  instantRewardCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  instantRewardIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  instantRewardContent: {
    flex: 1,
    gap: 2,
  },
  instantRewardTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  instantRewardSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Ask Questions CTA
  askQuestionsCta: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  askQuestionsIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  askQuestionsContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  askQuestionsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  askQuestionsSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  askQuestionsStats: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  askQuestionsStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  askQuestionsStatText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

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
