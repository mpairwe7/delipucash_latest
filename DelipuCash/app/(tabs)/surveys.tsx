import {
  NotificationBell,
  SearchBar,
  SurveyCard,
} from "@/components";
import { useRunningSurveys, useUnreadCount, useUpcomingSurveys } from "@/services/hooks";
import { useSurveySubscriptionStatus } from "@/services/surveyPaymentHooks";
import {
  useAdsForPlacement,
  useBannerAds,
  useRecordAdClick,
  useRecordAdImpression,
} from "@/services/adHooksRefactored";
import { NativeAd, BannerAd } from "@/components/ads";
import { useAuth, useAuthModal } from "@/utils/auth";
import { Survey, Ad } from "@/types";
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
  ArrowRight,
  BarChart3,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Lightbulb,
  ListPlus,
  Lock,
  PenLine,
  Play,
  Plus,
  ShieldCheck,
  SquareCheck,
  Star,
  Target,
  TrendingUp,
  Type,
  Zap,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface QuestionType {
  key: string;
  label: string;
  description: string;
  icon: React.ReactElement;
}

interface StatItem {
  label: string;
  value: string;
  icon: React.ReactElement;
  color: string;
}

export default function SurveysScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();

  // Auth state
  const { isAuthenticated, isReady: authReady, auth } = useAuth();
  const { open: openAuth } = useAuthModal();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  // Subscription status
  const {
    data: subscriptionStatus,
    isLoading: loadingSubscription,
    refetch: refetchSubscription,
  } = useSurveySubscriptionStatus();

  const hasActiveSubscription = subscriptionStatus?.hasActiveSubscription ?? false;
  const remainingDays = subscriptionStatus?.remainingDays ?? 0;

  const { data: runningSurveys = [], isLoading: loadingRunning, refetch: refetchRunning } = useRunningSurveys();
  const { data: upcomingSurveys = [], isLoading: loadingUpcoming, refetch: refetchUpcoming } = useUpcomingSurveys();
  const { data: unreadCount } = useUnreadCount();

  // Ad hooks - TanStack Query for intelligent ad loading
  // Following industry best practices: ads are contextually placed and non-intrusive
  const { data: surveyAds = [], refetch: refetchSurveyAds } = useAdsForPlacement('survey', 3);
  const { data: bannerAds = [], refetch: refetchBannerAds } = useBannerAds(2);
  const recordAdClick = useRecordAdClick();
  const recordAdImpression = useRecordAdImpression();

  const isLoading = loadingRunning || loadingUpcoming || loadingSubscription;

  // Stats for quick overview
  const stats: StatItem[] = useMemo(() => [
    {
      label: "Active",
      value: String(runningSurveys.length),
      icon: <Play size={18} color={colors.success} strokeWidth={2} />,
      color: colors.success,
    },
    {
      label: "Upcoming",
      value: String(upcomingSurveys.length),
      icon: <Clock size={18} color={colors.warning} strokeWidth={2} />,
      color: colors.warning,
    },
    {
      label: "Responses",
      value: "--",
      icon: <BarChart3 size={18} color={colors.info} strokeWidth={2} />,
      color: colors.info,
    },
  ], [runningSurveys.length, upcomingSurveys.length, colors]);

  // Question type chips for visual reference
  const questionTypes: QuestionType[] = useMemo(() => [
    {
      key: "multiple-choice",
      label: "Choice",
      description: "Single select",
      icon: <ListPlus size={18} color={colors.primary} strokeWidth={2} />,
    },
    {
      key: "checkbox",
      label: "Multi",
      description: "Many options",
      icon: <SquareCheck size={18} color={colors.secondary} strokeWidth={2} />,
    },
    {
      key: "text",
      label: "Text",
      description: "Open-ended",
      icon: <Type size={18} color={colors.info} strokeWidth={2} />,
    },
    {
      key: "rating",
      label: "Rating",
      description: "Scale 1-5",
      icon: <Star size={18} color={colors.warning} strokeWidth={2} />,
    },
  ], [colors]);

  const filteredRunning = useMemo(
    () => runningSurveys.filter((survey: Survey) => survey.title.toLowerCase().includes(search.toLowerCase())),
    [runningSurveys, search],
  );

  const filteredUpcoming = useMemo(
    () => upcomingSurveys.filter((survey: Survey) => survey.title.toLowerCase().includes(search.toLowerCase())),
    [upcomingSurveys, search],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchRunning(), refetchUpcoming(), refetchSubscription(), refetchSurveyAds(), refetchBannerAds()]);
    setRefreshing(false);
  }, [refetchRunning, refetchUpcoming, refetchSubscription, refetchSurveyAds, refetchBannerAds]);

  // Ad interaction handlers - Following IAB standards
  const handleAdClick = useCallback((ad: Ad) => {
    recordAdClick.mutate({
      adId: ad.id,
      placement: 'survey',
    });
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

  const handleSurveyPress = (id: string): void => {
    router.push(`/survey/${id}`);
  };

  /**
   * Handle create survey action with auth and subscription checks
   */
  const handleCreateSurvey = useCallback((): void => {
    // Check authentication first
    if (!isAuthenticated) {
      Alert.alert(
        "Login Required",
        "You need to be logged in to create surveys.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign In",
            onPress: () => openAuth({ mode: "signin" }),
          },
        ]
      );
      return;
    }

    // Check subscription status
    if (!hasActiveSubscription) {
      Alert.alert(
        "Subscription Required",
        "You need an active subscription to create surveys. Subscribe now to unlock survey creation.",
        [
          { text: "Maybe Later", style: "cancel" },
          {
            text: "Subscribe",
            onPress: () => router.push("/survey-payment" as Href),
            style: "default",
          },
        ]
      );
      return;
    }

  // Navigate to create survey
    router.push("/create-survey" as Href);
  }, [isAuthenticated, hasActiveSubscription, openAuth]);

  /**
   * Navigate to payment screen
   */
  const handleSubscribe = useCallback((): void => {
    if (!isAuthenticated) {
      openAuth({ mode: "signin" });
      return;
    }
    router.push("/survey-payment" as Href);
  }, [isAuthenticated, openAuth]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + SPACING.lg,
            paddingBottom: insets.bottom + SPACING["3xl"],
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
      >
        <View style={styles.pageWidth}>
        {/* ==================== HEADER ==================== */}
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

        {/* ==================== SEARCH & QUICK ACCESS ==================== */}
        <View
          style={[
            styles.searchPanel,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              ...SHADOWS.md,
            },
          ]}
        >
          <View style={styles.searchHeaderRow}>
            <Text style={[styles.searchTitle, { color: colors.text }]}>Find a survey</Text>
            <View style={[styles.searchBadge, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
              <Text style={[styles.searchBadgeText, { color: colors.primary }]}>Active {runningSurveys.length}</Text>
            </View>
          </View>
          <SearchBar
            placeholder="Search by title or topic"
            value={search}
            onChangeText={setSearch}
            style={styles.searchBar}
          />
          <View style={styles.searchMetaRow}>
            <Text style={[styles.searchHint, { color: colors.textMuted }]}>Tip: start with short surveys to boost completion.</Text>
            <TouchableOpacity onPress={handleCreateSurvey} accessibilityRole="button">
              <Text style={[styles.searchAction, { color: colors.primary }]}>New survey</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ==================== SUBSCRIPTION STATUS BANNER ==================== */}
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

        {/* ==================== QUICK STATS ==================== */}
        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.card,
                  borderColor: withAlpha(stat.color, 0.2),
                  ...SHADOWS.sm,
                },
              ]}
              accessibilityLabel={`${stat.label}: ${stat.value}`}
            >
              <View style={[styles.statIconBg, { backgroundColor: withAlpha(stat.color, 0.12) }]}>
                {stat.icon}
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ==================== CREATE NEW SURVEY CTA ==================== */}
        <TouchableOpacity
          style={[
            styles.ctaCard,
            {
              backgroundColor: hasActiveSubscription ? colors.primary : colors.card,
              borderWidth: hasActiveSubscription ? 0 : BORDER_WIDTH.thin,
              borderColor: colors.border,
              ...SHADOWS.md,
            },
          ]}
          onPress={handleCreateSurvey}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={
            hasActiveSubscription
              ? "Create new survey"
              : "Create new survey - subscription required"
          }
          accessibilityHint={
            !hasActiveSubscription
              ? "You need an active subscription to create surveys"
              : undefined
          }
        >
          <View style={styles.ctaContent}>
            <View style={[
              styles.ctaIconBg,
              {
                backgroundColor: hasActiveSubscription
                  ? withAlpha("#fff", 0.2)
                  : withAlpha(colors.primary, 0.12)
              }
            ]}>
              {hasActiveSubscription ? (
                <Plus size={24} color={colors.primaryText} strokeWidth={2.5} />
              ) : (
                <Lock size={24} color={colors.primary} strokeWidth={2} />
              )}
            </View>
            <View style={styles.ctaTextContainer}>
              <Text style={[
                styles.ctaTitle,
                { color: hasActiveSubscription ? colors.primaryText : colors.text }
              ]}>
                Create New Survey
              </Text>
              <Text style={[
                styles.ctaSubtitle,
                {
                  color: hasActiveSubscription
                    ? withAlpha(colors.primaryText, 0.8)
                    : colors.textMuted
                }
              ]}>
                {hasActiveSubscription
                  ? "Build from scratch or import JSON"
                  : "Subscription required • Tap to subscribe"
                }
              </Text>
            </View>
          </View>
          <ArrowRight
            size={22}
            color={hasActiveSubscription ? colors.primaryText : colors.primary}
            strokeWidth={2}
          />
        </TouchableOpacity>

        {/* ==================== QUESTION TYPES PREVIEW ==================== */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Target size={18} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Question Types</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Available in builder
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeChipsContainer}
        >
          {questionTypes.map((type) => (
            <View
              key={type.key}
              style={[
                styles.typeChip,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              accessibilityLabel={`${type.label}: ${type.description}`}
            >
              <View style={[styles.typeChipIcon, { backgroundColor: withAlpha(colors.primary, 0.08) }]}>
                {type.icon}
              </View>
              <View style={styles.typeChipText}>
                <Text style={[styles.typeChipLabel, { color: colors.text }]}>{type.label}</Text>
                <Text style={[styles.typeChipDesc, { color: colors.textMuted }]}>{type.description}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* ==================== RUNNING SURVEYS ==================== */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Play size={18} color={colors.success} strokeWidth={2} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Surveys</Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: withAlpha(colors.success, 0.12) }]}>
            <Text style={[styles.countText, { color: colors.success }]}>{filteredRunning.length}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredRunning.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FileText size={40} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No active surveys</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Create your first survey to start collecting responses
            </Text>
          </View>
        ) : (
          <View style={styles.surveyList}>
            {filteredRunning.map((survey: Survey) => (
              <SurveyCard
                key={survey.id}
                survey={survey}
                onPress={() => handleSurveyPress(survey.id)}
                isOwner={auth?.user?.id === survey.userId}
                onViewResponses={() => router.push(`/survey-responses/${survey.id}` as Href)}
              />
            ))}
          </View>
        )}

          {/* ==================== NATIVE AD - Between Sections ==================== */}
          {/* Industry Standard: Native ads blend with content, placed at natural break points */}
          {surveyAds.length > 0 && (
            <View style={styles.adContainer}>
              <NativeAd
                ad={surveyAds[0]}
                onAdClick={handleAdClick}
                onAdLoad={() => handleAdImpression(surveyAds[0])}
                style={styles.nativeAd}
              />
            </View>
          )}

        {/* ==================== UPCOMING SURVEYS ==================== */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Clock size={18} color={colors.warning} strokeWidth={2} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming</Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: withAlpha(colors.warning, 0.12) }]}>
            <Text style={[styles.countText, { color: colors.warning }]}>{filteredUpcoming.length}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredUpcoming.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Clock size={36} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No scheduled surveys</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Schedule surveys in advance to plan your research
            </Text>
          </View>
        ) : (
          <View style={styles.surveyList}>
            {filteredUpcoming.map((survey: Survey) => (
              <SurveyCard
                key={survey.id}
                survey={survey}
                variant="compact"
                onPress={() => handleSurveyPress(survey.id)}
                isOwner={auth?.user?.id === survey.userId}
                onViewResponses={() => router.push(`/survey-responses/${survey.id}` as Href)}
              />
            ))}
          </View>
        )}

          {/* ==================== COMPACT BANNER AD - Before Tips ==================== */}
          {/* Industry Standard: Banner ads at natural content boundaries, minimal disruption */}
          {bannerAds.length > 0 && (
            <View style={styles.bannerAdContainer}>
              <BannerAd
                ad={bannerAds[0]}
                onAdClick={handleAdClick}
                onAdLoad={() => handleAdImpression(bannerAds[0])}
                style={styles.bannerAd}
              />
            </View>
          )}

        {/* ==================== PRO TIPS ==================== */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Lightbulb size={18} color={colors.secondary} strokeWidth={2} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Pro Tips</Text>
          </View>
        </View>

        <View
          style={[
            styles.tipsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          accessibilityLabel="Survey creation tips"
        >
          {[
            { icon: <Target size={16} color={colors.primary} />, tip: "Keep surveys under 10 questions for 80%+ completion" },
            { icon: <Zap size={16} color={colors.warning} />, tip: "Use progress indicators to reduce abandonment" },
            { icon: <TrendingUp size={16} color={colors.success} />, tip: "Start with easy questions to build momentum" },
            { icon: <PenLine size={16} color={colors.info} />, tip: "Limit open-ended questions to 2-3 per survey" },
          ].map(({ icon, tip }, index) => (
            <View key={index} style={styles.tipItem}>
              <View style={[styles.tipIconBg, { backgroundColor: withAlpha(colors.primary, 0.08) }]}>
                {icon}
              </View>
              <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
            </View>
          ))}
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.base,
    alignItems: "center",
  },
  pageWidth: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
  },
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: SPACING.xl,
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

  // Stats Row
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  statLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xxs,
  },

  // CTA Card
  ctaCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.xl,
  },
  ctaContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: SPACING.md,
  },
  ctaIconBg: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTextContainer: {
    flex: 1,
  },
  ctaTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  ctaSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xxs,
  },

  // Search
  searchPanel: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  searchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  searchTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  searchBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  searchBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  searchBar: {
    marginBottom: SPACING.sm,
  },
  searchMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  searchHint: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  searchAction: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  sectionSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  countBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
    minWidth: 28,
    alignItems: "center",
  },
  countText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Question Type Chips
  typeChipsContainer: {
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
    minWidth: 120,
  },
  typeChipIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  typeChipText: {
    flex: 1,
  },
  typeChipLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  typeChipDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 1,
  },

  // Survey Lists
  surveyList: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },

  // Empty States
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING["2xl"],
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.md,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
    textAlign: "center",
    maxWidth: 240,
  },

  // Tips Card
  tipsCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  tipIconBg: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  tipText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },

  // Loading
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: "center",
    justifyContent: "center",
  },

  // Subscription Banner
  subscriptionBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.lg,
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

  // Ad Containers - Industry Standard: Non-intrusive, clearly labeled
  adContainer: {
    marginVertical: SPACING.lg,
    marginHorizontal: -SPACING.xs,
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
});
