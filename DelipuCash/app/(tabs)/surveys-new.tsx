/**
 * Surveys Screen - 2025/2026 Modern Redesign
 * 
 * Features:
 * - FlatList virtualization for performance
 * - Tabbed navigation (My Surveys, Discover, Running, Upcoming)
 * - FAB with creation flow options
 * - Skeleton loading states
 * - Integration with new survey components (Templates, Import, Share, etc.)
 * - Accessibility (WCAG 2.2 AA)
 * - Responsive tablet layout
 */

import {
  NotificationBell,
  SearchOverlay,
  SurveyCard,
} from "@/components";
import {
  SurveyCreationFAB,
  SurveyTemplatesGallery,
  ImportWizard,
  SurveyCardSkeleton,
  type CreationMode,
} from "@/components/survey";
import { useRunningSurveys, useUnreadCount, useUpcomingSurveys, useCompletedSurveys } from "@/services/hooks";
import { useSurveySubscriptionStatus } from "@/services/surveyPaymentHooks";
import {
  useAdsForPlacement,
  useBannerAds,
  useFeaturedAds,
  useRecordAdClick,
  useRecordAdImpression,
} from "@/services/adHooksRefactored";
import {
  AdPlacementWrapper,
  BetweenContentAd,
  InFeedAd,
} from "@/components/ads";
import { useAuth, useAuthModal } from "@/utils/auth";
import { useSearch } from "@/hooks/useSearch";
import { Survey, Ad, UserRole } from "@/types";
import { useSurveyUIStore } from "@/store/SurveyUIStore";
import {
  BORDER_WIDTH,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
} from "@/utils/theme";
import { Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Grid3X3,
  List,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState, useRef, useEffect, memo } from "react";
import {
  Alert,
  Animated,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  AccessibilityInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

// ============================================================================
// MEMOIZED COMPONENTS
// ============================================================================

/**
 * Memoized item separator to prevent recreation on every render
 */
const MemoizedItemSeparator = memo(function ItemSeparator() {
  return <View style={{ height: SPACING.md }} />;
});

// ============================================================================
// TYPES
// ============================================================================

type TabKey = 'my-surveys' | 'discover' | 'running' | 'upcoming' | 'completed';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

interface ListItem {
  type: 'survey' | 'ad' | 'banner-ad' | 'featured-ad' | 'in-feed-ad' | 'header' | 'empty' | 'skeleton' | 'discover-section';
  data?: Survey | Ad;
  title?: string;
  key: string;
  adVariant?: 'native' | 'banner' | 'featured' | 'in-feed';
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SurveysScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Store state
  const {
    activeTab,
    setActiveTab,
    cardViewStyle,
    setCardViewStyle,
  } = useSurveyUIStore();

  // Local state for modals
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Auth state
  const { isAuthenticated, isReady: authReady, auth } = useAuth();
  const { open: openAuth } = useAuthModal();

  const [refreshing, setRefreshing] = useState(false);
  const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);

  // Tab indicator animation
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  // Subscription status
  const {
    data: subscriptionStatus,
    isLoading: loadingSubscription,
    refetch: refetchSubscription,
  } = useSurveySubscriptionStatus();

  const hasActiveSubscription = subscriptionStatus?.hasActiveSubscription ?? false;
  const remainingDays = subscriptionStatus?.remainingDays ?? 0;

  // Check if user is admin
  const isAdmin = useMemo(() => {
    return auth?.user?.role === UserRole.ADMIN || auth?.user?.role === UserRole.MODERATOR;
  }, [auth?.user?.role]);

  // Data queries - use runningSurveys filtered by user as mySurveys
  const { data: runningSurveys = [], isLoading: loadingRunning, refetch: refetchRunning } = useRunningSurveys();
  const { data: upcomingSurveys = [], isLoading: loadingUpcoming, refetch: refetchUpcoming } = useUpcomingSurveys();
  const { data: completedSurveys = [], isLoading: loadingCompleted, refetch: refetchCompleted } = useCompletedSurveys();
  const { data: unreadCount } = useUnreadCount();
  
  // Filter for user's surveys
  const mySurveys = useMemo(() => {
    if (!auth?.user?.id) return [];
    return runningSurveys.filter((s: Survey) => s.userId === auth.user?.id);
  }, [runningSurveys, auth?.user?.id]);
  const loadingMy = loadingRunning;

  // Ad hooks - TanStack Query for intelligent ad loading
  // Following industry best practices: ads are contextually placed and non-intrusive
  const { data: surveyAds = [], refetch: refetchSurveyAds } = useAdsForPlacement('survey', 4);
  const { data: bannerAds = [], refetch: refetchBannerAds } = useBannerAds(3);
  const { data: featuredAds = [], refetch: refetchFeaturedAds } = useFeaturedAds(2);
  const recordAdClick = useRecordAdClick();
  const recordAdImpression = useRecordAdImpression();

  // Check reduced motion
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', () => {});
    return () => listener.remove();
  }, []);

  // Combine all surveys for search
  const allSurveys = useMemo(() => {
    const combined = [...(mySurveys || []), ...(runningSurveys || []), ...(upcomingSurveys || []), ...(completedSurveys || [])];
    // Remove duplicates
    return Array.from(new Map(combined.map((s) => [s.id, s])).values());
  }, [mySurveys, runningSurveys, upcomingSurveys, completedSurveys]);

  // Search hook
  const {
    query: search,
    setQuery: setSearch,
    filteredResults: searchedSurveys,
    isSearching,
    recentSearches,
    removeFromHistory,
    clearHistory,
    submitSearch,
  } = useSearch({
    data: allSurveys,
    searchFields: ['title', 'description'],
    storageKey: '@surveys_search_history',
    debounceMs: 250,
    customFilter: (survey: Survey, query: string) => {
      const lower = query.toLowerCase();
      return (
        survey.title.toLowerCase().includes(lower) ||
        (survey.description || '').toLowerCase().includes(lower)
      );
    },
  });

  // Search suggestions
  const searchSuggestions = useMemo(() => {
    if (!search) return recentSearches.slice(0, 5);
    const lowerQuery = search.toLowerCase();
    return allSurveys
      .filter((s: Survey) => s.title.toLowerCase().includes(lowerQuery))
      .map((s: Survey) => s.title)
      .slice(0, 5);
  }, [search, allSurveys, recentSearches]);

  // Tabs configuration
  const tabs: Tab[] = useMemo(() => [
    {
      key: 'my-surveys',
      label: 'My Surveys',
      icon: <FileText size={16} />,
      count: mySurveys.length,
    },
    {
      key: 'discover',
      label: 'Discover',
      icon: <Sparkles size={16} />,
    },
    {
      key: 'running',
      label: 'Active',
      icon: <Play size={16} />,
      count: runningSurveys.length,
    },
    {
      key: 'upcoming',
      label: 'Upcoming',
      icon: <Clock size={16} />,
      count: upcomingSurveys.length,
    },
    {
      key: 'completed',
      label: 'Completed',
      icon: <CheckCircle size={16} />,
      count: completedSurveys.length,
    },
  ], [mySurveys.length, runningSurveys.length, upcomingSurveys.length, completedSurveys.length]);

  // Current loading state
  const isLoading = useMemo(() => {
    switch (activeTab) {
      case 'my-surveys': return loadingMy;
      case 'running': return loadingRunning;
      case 'upcoming': return loadingUpcoming;
      case 'completed': return loadingCompleted;
      default: return false;
    }
  }, [activeTab, loadingMy, loadingRunning, loadingUpcoming, loadingCompleted]);

  // Current surveys based on tab
  const currentSurveys = useMemo(() => {
    let surveys: Survey[] = [];
    
    switch (activeTab) {
      case 'my-surveys':
        surveys = mySurveys;
        break;
      case 'running':
        surveys = runningSurveys;
        break;
      case 'upcoming':
        surveys = upcomingSurveys;
        break;
      case 'completed':
        surveys = completedSurveys;
        break;
      case 'discover':
        // Discover shows featured/popular surveys from all
        surveys = [...runningSurveys].sort(() => Math.random() - 0.5).slice(0, 10);
        break;
    }

    // Apply search filter
    if (isSearching) {
      return surveys.filter((s) =>
        searchedSurveys.some((searched) => searched.id === s.id)
      );
    }

    return surveys;
  }, [activeTab, mySurveys, runningSurveys, upcomingSurveys, isSearching, searchedSurveys]);

  // Build FlatList data with ads and sections
  const listData: ListItem[] = useMemo(() => {
    const items: ListItem[] = [];

    if (isLoading) {
      // Show skeletons
      for (let i = 0; i < 3; i++) {
        items.push({ type: 'skeleton', key: `skeleton-${i}` });
      }
      return items;
    }

    if (currentSurveys.length === 0) {
      items.push({ type: 'empty', key: 'empty' });
      return items;
    }

    // Insert surveys with occasional ads
    // Industry Standard: Native ads blend with content, placed at natural break points
    currentSurveys.forEach((survey, index) => {
      items.push({
        type: 'survey',
        data: survey,
        key: `survey-${survey.id}`,
      });

      // Insert native ad every 4 surveys
      if ((index + 1) % 4 === 0 && surveyAds[Math.floor((index + 1) / 4) - 1]) {
        const ad = surveyAds[Math.floor((index + 1) / 4) - 1];
        items.push({
          type: 'ad',
          data: ad,
          key: `ad-${ad.id}`,
          adVariant: 'native',
        });
      }

      // Insert in-feed ad every 8 surveys for variety
      if ((index + 1) % 8 === 0 && bannerAds.length > 1) {
        items.push({
          type: 'in-feed-ad',
          data: bannerAds[1],
          key: `in-feed-ad-${index}`,
          adVariant: 'in-feed',
        });
      }
    });

    // Featured Ad - Premium placement for high-value ads (Industry Standard)
    if (featuredAds.length > 0 && currentSurveys.length >= 2) {
      items.push({
        type: 'featured-ad',
        data: featuredAds[0],
        key: `featured-ad-${featuredAds[0].id}`,
        adVariant: 'featured',
      });
    }

    // Insert banner ad at the end if available
    // Industry Standard: Banner ads at natural content boundaries, minimal disruption
    if (bannerAds.length > 0 && currentSurveys.length >= 3) {
      items.push({
        type: 'banner-ad',
        data: bannerAds[0],
        key: `banner-ad-${bannerAds[0].id}`,
        adVariant: 'banner',
      });
    }

    return items;
  }, [currentSurveys, isLoading, surveyAds, bannerAds, featuredAds]);

  // Handle tab change with animation
  const handleTabChange = useCallback((key: TabKey, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(key);
    
    const tabWidth = (width - SPACING.md * 2) / tabs.length;
    Animated.spring(tabIndicatorAnim, {
      toValue: index * tabWidth,
      tension: 68,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [setActiveTab, width, tabs.length, tabIndicatorAnim]);

  // Handle search
  const handleSearchSubmit = useCallback((query: string) => {
    submitSearch(query);
    setSearchOverlayVisible(false);
    if (query.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [submitSearch]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchRunning(),
      refetchUpcoming(),
      refetchCompleted(),
      refetchSubscription(),
      refetchSurveyAds(),
      refetchBannerAds(),
      refetchFeaturedAds(),
    ]);
    setRefreshing(false);
  }, [refetchRunning, refetchUpcoming, refetchCompleted, refetchSubscription, refetchSurveyAds, refetchBannerAds, refetchFeaturedAds]);

  // Ad handlers
  const handleAdClick = useCallback((ad: Ad) => {
    recordAdClick.mutate({ adId: ad.id, placement: 'survey' });
  }, [recordAdClick]);

  const handleAdImpression = useCallback((ad: Ad) => {
    recordAdImpression.mutate({
      adId: ad.id,
      placement: 'survey',
      duration: 0,
      wasVisible: true,
      viewportPercentage: 100,
    });
  }, [recordAdImpression]);

  // Navigation handlers
  const handleSurveyPress = useCallback((id: string) => {
    router.push(`/survey/${id}`);
  }, []);

  // Creation flow handlers
  const handleCreationMode = useCallback((mode: CreationMode) => {
    if (!isAuthenticated) {
      Alert.alert(
        "Login Required",
        "You need to be logged in to create surveys.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: () => openAuth({ mode: "signin" }) },
        ]
      );
      return;
    }

    if (!isAdmin && !hasActiveSubscription) {
      Alert.alert(
        "Subscription Required",
        "You need an active subscription to create surveys.",
        [
          { text: "Maybe Later", style: "cancel" },
          { text: "Subscribe", onPress: () => router.push("/survey-payment" as Href) },
        ]
      );
      return;
    }

    switch (mode) {
      case 'blank':
        router.push("/create-survey" as Href);
        break;
      case 'template':
        setShowTemplates(true);
        break;
      case 'import':
        setShowImportWizard(true);
        break;
      case 'conversational':
        // Navigate to conversational builder
        router.push({
          pathname: "/create-survey",
          params: { mode: "conversational" },
        } as Href);
        break;
    }
  }, [isAuthenticated, isAdmin, hasActiveSubscription, openAuth, setShowTemplates, setShowImportWizard]);

  // Template selection handler
  const handleTemplateSelect = useCallback((template: { id: string; name: string }) => {
    setShowTemplates(false);
    router.push({
      pathname: "/create-survey",
      params: { templateId: template.id },
    } as Href);
  }, []);

  // Import completion handler
  const handleImportComplete = useCallback((data: { questions: any[] }) => {
    setShowImportWizard(false);
    // Store questions temporarily and navigate
    router.push({
      pathname: "/create-survey",
      params: { importedQuestions: JSON.stringify(data.questions) },
    } as Href);
  }, []);

  // Subscribe handler
  const handleSubscribe = useCallback(() => {
    if (!isAuthenticated) {
      openAuth({ mode: "signin" });
      return;
    }
    router.push("/survey-payment" as Href);
  }, [isAuthenticated, openAuth]);

  // Render list item
  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    switch (item.type) {
      case 'survey':
        const survey = item.data as Survey;
        return (
          <View style={[styles.surveyCardWrapper, isTablet && styles.surveyCardWrapperTablet]}>
            <SurveyCard
              survey={survey}
              onPress={() => handleSurveyPress(survey.id)}
              isOwner={auth?.user?.id === survey.userId}
              onViewResponses={() => router.push(`/survey-responses/${survey.id}` as Href)}
              variant={cardViewStyle === 'compact' ? 'compact' : undefined}
            />
          </View>
        );

      case 'ad':
        const ad = item.data as Ad;
        return (
          <BetweenContentAd
            ad={ad}
            onAdClick={() => handleAdClick(ad)}
            onAdLoad={() => handleAdImpression(ad)}
            variant="native"
            style={styles.betweenContentAd}
          />
        );

      case 'banner-ad':
        const bannerAd = item.data as Ad;
        return (
          <AdPlacementWrapper
            ad={bannerAd}
            placement="banner-bottom"
            onAdClick={() => handleAdClick(bannerAd)}
            onAdLoad={() => handleAdImpression(bannerAd)}
            style={styles.bannerAdPlacement}
          />
        );

      case 'featured-ad':
        const featuredAd = item.data as Ad;
        return (
          <AdPlacementWrapper
            ad={featuredAd}
            placement="between-content"
            onAdClick={() => handleAdClick(featuredAd)}
            onAdLoad={() => handleAdImpression(featuredAd)}
            style={styles.featuredAdPlacement}
          />
        );

      case 'in-feed-ad':
        const inFeedAd = item.data as Ad;
        return (
          <InFeedAd
            ad={inFeedAd}
            index={1}
            onAdClick={() => handleAdClick(inFeedAd)}
            onAdLoad={() => handleAdImpression(inFeedAd)}
            style={styles.inFeedAd}
          />
        );

      case 'skeleton':
        return <SurveyCardSkeleton variant={cardViewStyle === 'compact' ? 'compact' : 'detailed'} />;

      case 'empty':
        return (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FileText size={48} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {activeTab === 'my-surveys' ? 'No surveys yet' :
               activeTab === 'running' ? 'No active surveys' :
               activeTab === 'upcoming' ? 'No upcoming surveys' :
               activeTab === 'completed' ? 'No completed surveys' :
               'No surveys to discover'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {activeTab === 'my-surveys'
                ? 'Create your first survey to start collecting insights'
                : activeTab === 'completed'
                ? 'Surveys you have completed will appear here'
                : 'Check back later for new surveys'
              }
            </Text>
            {activeTab === 'my-surveys' && (
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                onPress={() => handleCreationMode('blank')}
                accessibilityRole="button"
                accessibilityLabel="Create your first survey"
              >
                <Plus size={18} color={colors.primaryText} />
                <Text style={[styles.emptyButtonText, { color: colors.primaryText }]}>
                  Create Survey
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );

      default:
        return null;
    }
  }, [auth, colors, activeTab, handleAdClick, handleAdImpression, handleCreationMode, handleSurveyPress, isTablet, cardViewStyle]);

  // List header component
  const ListHeader = useMemo(() => (
    <View style={styles.listHeader}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleSection}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Surveys</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Create, manage & analyze
          </Text>
        </View>
        <NotificationBell
          count={unreadCount ?? 0}
          onPress={() => router.push("/notifications" as Href)}
        />
      </View>

      {/* Search */}
      <TouchableOpacity
        style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setSearchOverlayVisible(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Search surveys"
      >
        <Search size={18} color={colors.textMuted} />
        <Text style={[styles.searchPlaceholder, { color: colors.textMuted }]}>
          {search || 'Search surveys...'}
        </Text>
        {isSearching && (
          <View style={[styles.searchBadge, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
            <Text style={[styles.searchBadgeText, { color: colors.primary }]}>
              {searchedSurveys.length}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Subscription Banner */}
      {authReady && isAuthenticated && (
        <TouchableOpacity
          style={[
            styles.subscriptionBanner,
            {
              backgroundColor: hasActiveSubscription
                ? withAlpha(colors.success, 0.1)
                : withAlpha(colors.warning, 0.1),
              borderColor: hasActiveSubscription
                ? withAlpha(colors.success, 0.25)
                : withAlpha(colors.warning, 0.25),
            },
          ]}
          onPress={!hasActiveSubscription ? handleSubscribe : undefined}
          activeOpacity={hasActiveSubscription ? 1 : 0.8}
          accessibilityRole="button"
          accessibilityLabel={
            hasActiveSubscription
              ? `Active subscription with ${remainingDays} days remaining`
              : "No active subscription. Tap to subscribe"
          }
        >
          <View style={[
            styles.subscriptionIconBg,
            {
              backgroundColor: hasActiveSubscription
                ? withAlpha(colors.success, 0.15)
                : withAlpha(colors.warning, 0.15),
            }
          ]}>
            {hasActiveSubscription ? (
              <ShieldCheck size={20} color={colors.success} strokeWidth={2} />
            ) : (
              <CreditCard size={20} color={colors.warning} strokeWidth={2} />
            )}
          </View>
          <View style={styles.subscriptionContent}>
            <Text style={[
              styles.subscriptionTitle,
              { color: hasActiveSubscription ? colors.success : colors.warning }
            ]}>
              {hasActiveSubscription ? "Active Subscription" : "No Active Subscription"}
            </Text>
            <Text style={[styles.subscriptionSubtitle, { color: colors.textMuted }]}>
              {hasActiveSubscription
                ? `${remainingDays} days remaining • ${subscriptionStatus?.subscription?.planType ?? 'Standard'} plan`
                : "Subscribe to create unlimited surveys"
              }
            </Text>
          </View>
          {!hasActiveSubscription && (
            <View style={[styles.subscribeBtn, { backgroundColor: colors.warning }]}>
              <Text style={[styles.subscribeBtnText, { color: colors.card }]}>Subscribe</Text>
            </View>
          )}
          {hasActiveSubscription && (
            <CheckCircle size={20} color={colors.success} strokeWidth={2} />
          )}
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  isActive && { backgroundColor: withAlpha(colors.primary, 0.1) },
                ]}
                onPress={() => handleTabChange(tab.key, index)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${tab.label}${tab.count !== undefined ? `, ${tab.count} items` : ''}`}
              >
                {React.cloneElement(tab.icon as React.ReactElement<{ color: string }>, {
                  color: isActive ? colors.primary : colors.textMuted,
                })}
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isActive ? colors.primary : colors.textMuted },
                    isActive && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.count !== undefined && tab.count > 0 && (
                  <View
                    style={[
                      styles.tabBadge,
                      { backgroundColor: isActive ? colors.primary : withAlpha(colors.text, 0.1) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabBadgeText,
                        { color: isActive ? colors.primaryText : colors.textMuted },
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        
        {/* View mode toggle (tablet only) */}
        {isTablet && (
          <View style={styles.cardViewStyleToggle}>
            <TouchableOpacity
              style={[styles.cardViewStyleBtn, cardViewStyle === 'grid' && { backgroundColor: withAlpha(colors.primary, 0.1) }]}
              onPress={() => setCardViewStyle('grid')}
              accessibilityRole="button"
              accessibilityLabel="Grid view"
            >
              <Grid3X3 size={18} color={cardViewStyle === 'grid' ? colors.primary : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardViewStyleBtn, cardViewStyle === 'detailed' && { backgroundColor: withAlpha(colors.primary, 0.1) }]}
              onPress={() => setCardViewStyle('detailed')}
              accessibilityRole="button"
              accessibilityLabel="List view"
            >
              <List size={18} color={cardViewStyle === 'detailed' ? colors.primary : colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Section title */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {activeTab === 'my-surveys' ? 'Your Surveys' :
           activeTab === 'discover' ? 'Featured Surveys' :
           activeTab === 'running' ? 'Active Surveys' :
           activeTab === 'completed' ? 'Completed Surveys' :
           'Scheduled Surveys'}
        </Text>
        <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
          {currentSurveys.length} {currentSurveys.length === 1 ? 'survey' : 'surveys'}
        </Text>
      </View>
    </View>
  ), [
    authReady, colors, currentSurveys.length, activeTab, handleSubscribe, handleTabChange,
    hasActiveSubscription, isAuthenticated, isSearching, isTablet, remainingDays, search,
    searchedSurveys.length, setCardViewStyle, subscriptionStatus, tabs, unreadCount, cardViewStyle
  ]);

  // Key extractor
  const keyExtractor = useCallback((item: ListItem) => item.key, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      <FlatList
        ref={flatListRef}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ItemSeparatorComponent={MemoizedItemSeparator}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom + SPACING['3xl'] + 100, // Space for FAB
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        // Performance optimizations
        removeClippedSubviews
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={100}
        windowSize={7}
        initialNumToRender={4}
        getItemLayout={(_data, index) => ({
          length: 160, // Approximate item height
          offset: 160 * index,
          index,
        })}
        // Grid layout for tablet
        numColumns={isTablet && cardViewStyle === 'grid' ? 2 : 1}
        key={isTablet && cardViewStyle === 'grid' ? 'grid' : 'list'} // Force re-render on layout change
        columnWrapperStyle={isTablet && cardViewStyle === 'grid' ? styles.gridRow : undefined}
      />

      {/* FAB */}
      <SurveyCreationFAB
        onSelect={handleCreationMode}
        disabled={loadingSubscription}
      />

      {/* Search Overlay */}
      <SearchOverlay
        visible={searchOverlayVisible}
        onClose={() => setSearchOverlayVisible(false)}
        query={search}
        onChangeQuery={setSearch}
        onSubmit={handleSearchSubmit}
        recentSearches={recentSearches}
        onRemoveFromHistory={removeFromHistory}
        onClearHistory={clearHistory}
        suggestions={searchSuggestions}
        placeholder="Search surveys..."
        searchContext="Surveys"
        trendingSearches={['Market research', 'Customer feedback', 'Product survey', 'Opinion poll']}
      />

      {/* Templates Gallery Modal */}
      <SurveyTemplatesGallery
        visible={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelectTemplate={handleTemplateSelect}
        hasSubscription={hasActiveSubscription || isAdmin}
      />

      {/* Import Wizard Modal */}
      <ImportWizard
        visible={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onImport={handleImportComplete}
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
  listContent: {
    paddingHorizontal: SPACING.md,
  },
  listHeader: {
    paddingTop: SPACING.lg,
    marginBottom: SPACING.md,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  headerTitleSection: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["3xl"],
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xxs,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  searchBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
  },
  searchBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Subscription Banner
  subscriptionBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  subscriptionIconBg: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  subscriptionContent: {
    flex: 1,
  },
  subscriptionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  subscriptionSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xxs,
  },
  subscribeBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  subscribeBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Tabs
  tabsContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    overflow: "hidden",
  },
  tabsScroll: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    gap: SPACING.xs,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.xs,
  },
  tabLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  tabLabelActive: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  tabBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    minWidth: 20,
    alignItems: "center",
  },
  tabBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
  },
  cardViewStyleToggle: {
    flexDirection: "row",
    padding: SPACING.xs,
    gap: SPACING.xxs,
    marginLeft: "auto",
    marginRight: SPACING.xs,
  },
  cardViewStyleBtn: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  sectionCount: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Survey cards
  surveyCardWrapper: {
    flex: 1,
  },
  surveyCardWrapperTablet: {
    flex: 0.5,
    paddingHorizontal: SPACING.xs,
  },
  gridRow: {
    justifyContent: "space-between",
  },

  // Ad Containers - Industry Standard: Non-intrusive, clearly labeled, smooth transitions
  adContainer: {
    marginVertical: SPACING.lg,
    marginHorizontal: -SPACING.xs,
  },
  betweenContentAd: {
    marginVertical: SPACING.lg,
    marginHorizontal: -SPACING.sm,
  },
  bannerAdPlacement: {
    marginVertical: SPACING.md,
  },
  // Featured Ad Placement - Premium positioning
  featuredAdPlacement: {
    marginVertical: SPACING.lg,
  },
  // In-feed Ad - Minimal footprint
  inFeedAd: {
    marginVertical: SPACING.sm,
  },
  nativeAd: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  bannerAdContainer: {
    marginVertical: SPACING.md,
    alignItems: "center",
  },
  bannerAd: {
    borderRadius: RADIUS.md,
    overflow: "hidden",
    width: "100%",
  },

  // Empty state
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING["3xl"],
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginTop: SPACING.lg,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.sm,
    textAlign: "center",
    maxWidth: 280,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.xl,
    marginTop: SPACING.xl,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  emptyButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});
