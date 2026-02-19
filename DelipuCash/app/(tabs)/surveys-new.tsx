/**
 * Surveys Screen - 2025/2026 Modern Redesign
 * 
 * Features:
 * - FlatList virtualization for performance
 * - Tabbed navigation (My Surveys, Discover, Running, Upcoming)
 * - FAB with creation flow options
 * - Skeleton loading states
 * - Integration with new survey components (Templates, Import, Share, etc.)
 * - Accessibility (WCAG 2.2 AA): semantic roles, labels, reduced-motion support
 * - Responsive tablet layout
 * 
 * Ad Placement Strategy (IAB Native Advertising Playbook):
 * - Ads interleaved after every 2 surveys for higher fill rate
 * - Rotating formats (native → in-feed → featured) to prevent banner blindness
 * - Clear "Sponsored" dividers before each ad (FTC/IAB transparency)
 * - Dismissible ads to respect user autonomy
 * - Viewability tracking (IAB MRC: 50% visible for 1s)
 * - Frequency capping via AdFrequencyManager
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
  Pressable,
} from "react-native";
import { X } from "lucide-react-native";
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

/** Ad frequency: show an ad after every N surveys */
const AD_INTERVAL = 2;

/**
 * Memoized ad divider with "Sponsored" label following IAB transparency guidelines.
 * Visually separates ad content from organic survey content.
 */
const AdDivider = memo(function AdDivider({ colors }: { colors: any }) {
  return (
    <View
      style={adDividerStyles.container}
      accessible
      accessibilityRole="none"
      importantForAccessibility="no"
    >
      <View style={[adDividerStyles.line, { backgroundColor: withAlpha(colors.border, 0.5) }]} />
      <Text style={[adDividerStyles.label, { color: colors.textMuted }]}>Sponsored</Text>
      <View style={[adDividerStyles.line, { backgroundColor: withAlpha(colors.border, 0.5) }]} />
    </View>
  );
});

const adDividerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: SPACING.sm,
  },
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
  type: 'survey' | 'ad' | 'banner-ad' | 'featured-ad' | 'in-feed-ad' | 'header' | 'empty' | 'skeleton' | 'discover-section' | 'ad-divider';
  data?: Survey | Ad;
  title?: string;
  key: string;
  adVariant?: 'native' | 'banner' | 'featured' | 'in-feed' | 'compact';
  /** Position index for staggered animation */
  adIndex?: number;
  /** Whether this ad is dismissible */
  dismissible?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SurveysScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Store state (individual selectors — avoid full-store subscriptions)
  const activeTab = useSurveyUIStore(s => s.activeTab);
  const setActiveTab = useSurveyUIStore(s => s.setActiveTab);
  const cardViewStyle = useSurveyUIStore(s => s.cardViewStyle);
  const setCardViewStyle = useSurveyUIStore(s => s.setCardViewStyle);

  // Local state for modals
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Auth state
  const { isAuthenticated, isReady: authReady, auth } = useAuth();
  const openAuth = useAuthModal(s => s.open);

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
  // Fetch enough ads for every-2-surveys placement pattern
  const { data: surveyAds = [], refetch: refetchSurveyAds } = useAdsForPlacement('survey', 8);
  const { data: bannerAds = [], refetch: refetchBannerAds } = useBannerAds(4);
  const { data: featuredAds = [], refetch: refetchFeaturedAds } = useFeaturedAds(3);
  const recordAdClick = useRecordAdClick();
  const recordAdImpression = useRecordAdImpression();

  // Track dismissed ads for non-intrusive UX
  const [dismissedAdKeys, setDismissedAdKeys] = useState<Set<string>>(new Set());
  const handleDismissAd = useCallback((key: string) => {
    setDismissedAdKeys(prev => new Set(prev).add(key));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check reduced motion preference (WCAG 2.3.3)
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setPrefersReducedMotion);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setPrefersReducedMotion);
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
        // Discover shows featured/popular surveys — deterministic sort by reward desc
        surveys = [...runningSurveys]
          .sort((a, b) => (b.rewardAmount || 0) - (a.rewardAmount || 0))
          .slice(0, 10);
        break;
    }

    // Apply search filter
    if (isSearching) {
      return surveys.filter((s) =>
        searchedSurveys.some((searched) => searched.id === s.id)
      );
    }

    return surveys;
  }, [activeTab, mySurveys, runningSurveys, upcomingSurveys, completedSurveys, isSearching, searchedSurveys]);

  // Build FlatList data with ads interleaved after every 2 surveys
  // Following IAB Native Advertising Playbook & Google AdMob best practices:
  // - Clear labeling ("Sponsored" divider before each ad)
  // - Non-intrusive placement at natural content breaks
  // - Rotating ad formats to prevent banner blindness
  // - Dismissible ads to respect user choice
  const listData: ListItem[] = useMemo(() => {
    const items: ListItem[] = [];

    if (isLoading) {
      for (let i = 0; i < 3; i++) {
        items.push({ type: 'skeleton', key: `skeleton-${i}` });
      }
      return items;
    }

    if (currentSurveys.length === 0) {
      items.push({ type: 'empty', key: 'empty' });
      return items;
    }

    // Merge all available ads into a pool, rotating formats
    // This follows the IAB recommendation to vary ad creative formats
    const adPool: { ad: Ad; variant: ListItem['adVariant']; type: ListItem['type'] }[] = [];
    
    // Interleave different ad types for format diversity
    const maxSlots = Math.floor(currentSurveys.length / AD_INTERVAL);
    for (let i = 0; i < maxSlots; i++) {
      const format = i % 3; // Rotate: native → in-feed → banner
      if (format === 0 && surveyAds[i % surveyAds.length]) {
        adPool.push({ ad: surveyAds[i % surveyAds.length], variant: 'native', type: 'ad' });
      } else if (format === 1 && bannerAds[i % bannerAds.length]) {
        adPool.push({ ad: bannerAds[i % bannerAds.length], variant: 'in-feed', type: 'in-feed-ad' });
      } else if (format === 2 && featuredAds[i % featuredAds.length]) {
        adPool.push({ ad: featuredAds[i % featuredAds.length], variant: 'featured', type: 'featured-ad' });
      } else if (surveyAds[i % (surveyAds.length || 1)]) {
        // Fallback to native ad if preferred format unavailable
        adPool.push({ ad: surveyAds[i % surveyAds.length], variant: 'native', type: 'ad' });
      }
    }

    let adIndex = 0;

    currentSurveys.forEach((survey, index) => {
      items.push({
        type: 'survey',
        data: survey,
        key: `survey-${survey.id}`,
      });

      // Insert ad after every AD_INTERVAL (2) surveys
      if ((index + 1) % AD_INTERVAL === 0 && adIndex < adPool.length) {
        const adEntry = adPool[adIndex];
        const adKey = `${adEntry.type}-${adEntry.ad.id}-${index}`;

        // Skip dismissed ads
        if (!dismissedAdKeys.has(adKey)) {
          // Insert a "Sponsored" divider before the ad for transparency (FTC/IAB guidelines)
          items.push({
            type: 'ad-divider',
            key: `ad-divider-${index}`,
          });

          items.push({
            type: adEntry.type,
            data: adEntry.ad,
            key: adKey,
            adVariant: adEntry.variant,
            adIndex,
            dismissible: true,
          });
        }

        adIndex++;
      }
    });

    // Featured ad at end for premium visibility (if not already placed inline)
    if (featuredAds.length > 0 && currentSurveys.length >= 3 && adIndex < 1) {
      const featuredAd = featuredAds[0];
      const featuredKey = `featured-end-${featuredAd.id}`;
      if (!dismissedAdKeys.has(featuredKey)) {
        items.push({ type: 'ad-divider', key: 'ad-divider-end' });
        items.push({
          type: 'featured-ad',
          data: featuredAd,
          key: featuredKey,
          adVariant: 'featured',
          dismissible: true,
        });
      }
    }

    return items;
  }, [currentSurveys, isLoading, surveyAds, bannerAds, featuredAds, dismissedAdKeys]);

  // Handle tab change with animation
  const handleTabChange = useCallback((key: TabKey, index: number) => {
    if (!prefersReducedMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveTab(key);

    const tabWidth = (width - SPACING.md * 2) / tabs.length;
    if (prefersReducedMotion) {
      tabIndicatorAnim.setValue(index * tabWidth);
    } else {
      Animated.spring(tabIndicatorAnim, {
        toValue: index * tabWidth,
        tension: 68,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }
  }, [setActiveTab, width, tabs.length, tabIndicatorAnim, prefersReducedMotion]);

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

  // Render list item — enhanced with WCAG 2.2 AA accessibility
  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    // Shared ad dismiss button for dismissible ads
    const renderDismissButton = (adKey: string) => {
      if (!item.dismissible) return null;
      return (
        <Pressable
          style={[styles.adDismissBtn, { backgroundColor: withAlpha(colors.text, 0.06) }]}
          onPress={() => handleDismissAd(adKey)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss this advertisement"
          accessibilityHint="Removes this ad from your feed"
          hitSlop={12}
        >
          <X size={14} color={colors.textMuted} />
        </Pressable>
      );
    };

    switch (item.type) {
      case 'survey':
        const survey = item.data as Survey;
        return (
          <View
            style={[styles.surveyCardWrapper, isTablet && styles.surveyCardWrapperTablet]}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Survey: ${survey.title}. ${survey.description || ''}`}
            accessibilityHint="Double tap to open this survey"
          >
            <SurveyCard
              survey={survey}
              onPress={() => handleSurveyPress(survey.id)}
              isOwner={auth?.user?.id === survey.userId}
              onViewResponses={() => router.push(`/survey-responses/${survey.id}` as Href)}
              variant={cardViewStyle === 'compact' ? 'compact' : undefined}
            />
          </View>
        );

      case 'ad-divider':
        return <AdDivider colors={colors} />;

      case 'ad':
        const ad = item.data as Ad;
        return (
          <View
            style={styles.adCardWrapper}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Sponsored: ${ad.title || 'Advertisement'}. ${ad.description || ''}`}
            accessibilityHint="Double tap to learn more about this advertisement"
          >
            {renderDismissButton(item.key)}
            <BetweenContentAd
              ad={ad}
              onAdClick={() => handleAdClick(ad)}
              variant="native"
              style={styles.betweenContentAd}
            />
          </View>
        );

      case 'banner-ad':
        const bannerAd = item.data as Ad;
        return (
          <View
            style={styles.adCardWrapper}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Sponsored banner: ${bannerAd.title || 'Advertisement'}`}
            accessibilityHint="Double tap to learn more"
          >
            {renderDismissButton(item.key)}
            <AdPlacementWrapper
              ad={bannerAd}
              placement="banner-bottom"
              onAdClick={() => handleAdClick(bannerAd)}
              onImpression={() => handleAdImpression(bannerAd)}
              trackViewability
              style={styles.bannerAdPlacement}
            />
          </View>
        );

      case 'featured-ad':
        const featuredAd = item.data as Ad;
        return (
          <View
            style={styles.adCardWrapper}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Featured sponsor: ${featuredAd.title || 'Premium advertisement'}`}
            accessibilityHint="Double tap to learn more about this featured sponsor"
          >
            {renderDismissButton(item.key)}
            <AdPlacementWrapper
              ad={featuredAd}
              placement="between-content"
              onAdClick={() => handleAdClick(featuredAd)}
              onImpression={() => handleAdImpression(featuredAd)}
              trackViewability
              style={styles.featuredAdPlacement}
            />
          </View>
        );

      case 'in-feed-ad':
        const inFeedAd = item.data as Ad;
        return (
          <View
            style={styles.adCardWrapper}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Sponsored content: ${inFeedAd.title || 'Advertisement'}`}
            accessibilityHint="Double tap to learn more"
          >
            {renderDismissButton(item.key)}
            <InFeedAd
              ad={inFeedAd}
              index={item.adIndex ?? 0}
              onAdClick={() => handleAdClick(inFeedAd)}
              onImpression={() => handleAdImpression(inFeedAd)}
              trackViewability
              style={styles.inFeedAd}
            />
          </View>
        );

      case 'skeleton':
        return <SurveyCardSkeleton variant={cardViewStyle === 'compact' ? 'compact' : 'detailed'} />;

      case 'empty':
        return (
          <View
            style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessible
            role="summary"
          >
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
  }, [auth, colors, activeTab, handleAdClick, handleAdImpression, handleCreationMode, handleSurveyPress, handleDismissAd, isTablet, cardViewStyle]);

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
          {/* Animated tab indicator */}
          <Animated.View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: 2.5,
              width: (width - SPACING.md * 2) / tabs.length,
              backgroundColor: colors.primary,
              borderRadius: 2,
              transform: [{ translateX: tabIndicatorAnim }],
            }}
          />
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
        windowSize={5}
        initialNumToRender={8}
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

  // Ad Card Wrapper — consistent container for all ad types
  adCardWrapper: {
    position: 'relative',
  },
  // Dismiss button — WCAG-compliant touch target (44×44 minimum)
  adDismissBtn: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ad Containers - Industry Standard: Non-intrusive, clearly labeled, smooth transitions
  adContainer: {
    marginVertical: SPACING.md,
    marginHorizontal: -SPACING.xs,
  },
  betweenContentAd: {
    marginVertical: SPACING.sm,
    marginHorizontal: -SPACING.sm,
  },
  bannerAdPlacement: {
    marginVertical: SPACING.sm,
  },
  // Featured Ad Placement - Premium positioning
  featuredAdPlacement: {
    marginVertical: SPACING.md,
  },
  // In-feed Ad - Minimal footprint
  inFeedAd: {
    marginVertical: SPACING.xs,
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
