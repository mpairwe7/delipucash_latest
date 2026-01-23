import {
    NotificationBell,
    PrimaryButton,
    QuestionCard,
    SearchBar,
    SectionHeader,
    StatCard,
} from "@/components";
import { formatCurrency } from "@/data/mockData";
import {
    useInstantRewardQuestions,
    useQuestions,
    useRecentQuestions,
    useRewardQuestions,
    useUnreadCount,
    useUserStats,
} from "@/services/hooks";
import {
    useBannerAds,
    useAdsForPlacement,
    useRecordAdClick,
    useRecordAdImpression,
} from "@/services/adHooksRefactored";
import { BannerAd, NativeAd, CompactAd } from "@/components/ads";
import { SubscriptionStatus, UserRole } from "@/types";
import {
    BORDER_WIDTH,
    COMPONENT_SIZE,
    ICON_SIZE,
    RADIUS,
    SPACING,
    TYPOGRAPHY,
    useTheme,
    withAlpha,
} from "@/utils/theme";
import useUser from "@/utils/useUser";
import { Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  AlertCircle,
  Award,
    BadgeCheck,
    CheckCircle2,
    Clock3,
    Coins,
  CreditCard,
  Lock,
  MessageCircle,
    Plus,
    Search,
    ShieldCheck,
    Sparkles,
  TrendingUp,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
  Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Question Screen
 * - Ask a question form
 * - Instant reward questions
 * - Recent questions
 * - Answer & earn CTA
 */
export default function QuestionsScreen(): React.ReactElement {
    const insets = useSafeAreaInsets();
    const { colors, statusBarStyle } = useTheme();
  const { data: user, loading: userLoading } = useUser();
    const [refreshing, setRefreshing] = useState(false);
    const [questionText, setQuestionText] = useState("");
    const [category, setCategory] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

    const { data: questionsData, isLoading, refetch } = useQuestions();
    const { data: instantQuestions } = useInstantRewardQuestions(5);
    const { data: rewardQuestions, isLoading: rewardLoading } = useRewardQuestions();
    const { data: recentQuestions } = useRecentQuestions(6);
    const { data: userStats } = useUserStats();
    const { data: unreadCount } = useUnreadCount();

    // Ad hooks - TanStack Query for intelligent ad loading
    const { data: bannerAds, refetch: refetchBannerAds } = useBannerAds(2);
    const { data: questionAds, refetch: refetchQuestionAds } = useAdsForPlacement('question', 3);
    const recordAdClick = useRecordAdClick();
    const recordAdImpression = useRecordAdImpression();

    // Ad click handler with analytics tracking
    const handleAdClick = useCallback((ad: any) => {
      recordAdClick.mutate({
        adId: ad.id,
        placement: 'question',
        deviceInfo: { platform: 'ios', version: '1.0' },
      });
    }, [recordAdClick]);

    // Ad impression tracking
    const handleAdImpression = useCallback((ad: any, duration: number = 1000) => {
      recordAdImpression.mutate({
        adId: ad.id,
        placement: 'question',
        duration,
        wasVisible: true,
        viewportPercentage: 100,
      });
    }, [recordAdImpression]);

    const questions = useMemo(() => {
      const list = questionsData?.questions || [];
      if (!searchQuery) return list;
      const lower = searchQuery.toLowerCase();
      return list.filter((q) => q.text.toLowerCase().includes(lower));
    }, [questionsData, searchQuery]);

    const rewardQuestionCards = useMemo(() => {
      return (rewardQuestions || []).map((rq) => ({
        id: rq.id,
        text: rq.text,
        userId: rq.userId,
        createdAt: rq.createdAt,
        updatedAt: rq.updatedAt,
        category: "Rewards",
        rewardAmount: rq.rewardAmount,
        isInstantReward: true,
        totalAnswers: rq.winnersCount ?? 0,
      }));
    }, [rewardQuestions]);

  /**
   * Role-based access control: Check user's role field from backend
   * instead of inferring from email address (which is insecure)
   */
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;

  /**
   * Payment/Subscription status checks
   */
  const hasActiveSubscription = user?.subscriptionStatus === SubscriptionStatus.ACTIVE;
  const hasSurveySubscription = user?.surveysubscriptionStatus === SubscriptionStatus.ACTIVE;
  const isAuthenticated = !!user && !userLoading;

  /**
   * Payment check helper - shows payment modal if subscription is not active
   */
  const requiresPayment = useCallback((action: string): boolean => {
    if (!isAuthenticated) {
      Alert.alert(
        "Login Required",
        "Please log in to access this feature.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push("/(auth)/login" as Href) }
        ]
      );
      return true;
    }

    if (!hasActiveSubscription) {
      setPendingAction(action);
      setShowPaymentModal(true);
      return true;
    }

    return false;
  }, [isAuthenticated, hasActiveSubscription]);

  /**
   * Admin-only action helper with proper access control
   */
  const requiresAdmin = useCallback((action: string): boolean => {
    if (!isAuthenticated) {
      Alert.alert(
        "Login Required",
        "Please log in to access this feature.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push("/(auth)/login" as Href) }
        ]
      );
      return true;
    }

    if (!isAdmin) {
      Alert.alert(
        "Admin Access Required",
        "This feature is only available for administrators and moderators.",
        [{ text: "OK" }]
      );
      return true;
    }

    return false;
  }, [isAuthenticated, isAdmin]);

    const onRefresh = useCallback(async () => {
      setRefreshing(true);
      await Promise.all([refetch(), refetchBannerAds(), refetchQuestionAds()]);
      setRefreshing(false);
    }, [refetch]);

  /**
   * Navigate to question answer screen with proper checks
   */
    const handleQuestionPress = (id: string): void => {
      if (!isAuthenticated) {
        Alert.alert(
          "Login Required",
          "Please log in to answer questions.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Login", onPress: () => router.push("/(auth)/login" as Href) }
          ]
        );
        return;
      }
      router.push(`/question-answer/${id}` as Href);
    };

  /**
   * Navigate to question comments/discussion screen (Quora-like experience)
   */
  const handleRecentQuestionPress = (id: string): void => {
    if (!isAuthenticated) {
      Alert.alert(
        "Login Required",
        "Please log in to view discussions.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push("/(auth)/login" as Href) }
        ]
      );
      return;
    }
    router.push(`/question-comments/${id}` as Href);
  };

  /**
   * Navigate to instant reward answer screen with payment check
   */
    const handleRewardQuestionPress = (id: string): void => {
      if (!isAuthenticated) {
        Alert.alert(
          "Login Required",
          "Please log in to answer reward questions.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Login", onPress: () => router.push("/(auth)/login" as Href) }
          ]
        );
        return;
      }
      router.push(`/instant-reward-answer/${id}` as Href);
    };

  /**
   * Submit a new question - requires active subscription
   */
    const handleAskQuestion = (): void => {
      if (!questionText.trim()) {
        Alert.alert("Empty Question", "Please enter your question before submitting.");
        return;
      }

      if (requiresPayment("ask_question")) return;

      // TODO: Integrate with question submission API
      Alert.alert(
        "Question Submitted",
        "Your question has been submitted successfully!",
        [{
          text: "OK", onPress: () => {
            setQuestionText("");
            setCategory("");
          }
        }]
      );
    };

  /**
   * Browse instant reward questions - Available to all authenticated users
   */
  const handleInstantRewardBrowse = (): void => {
    if (!isAuthenticated) {
      Alert.alert(
        "Login Required",
        "Please log in to browse instant reward questions.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push("/(auth)/login" as Href) }
        ]
      );
      return;
    }
    router.push("/instant-reward-questions" as Href);
    };

  /**
   * Navigate to answer questions and earn screen
   */
  const handleAnswerEarn = (): void => {
    if (!isAuthenticated) {
      Alert.alert(
        "Login Required",
        "Please log in to start earning.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push("/(auth)/login" as Href) }
        ]
      );
      return;
    }
    router.push("/(tabs)/questions" as Href);
    };

    /**
     * Handle payment completion callback
     */
  const handlePaymentComplete = useCallback(() => {
    setShowPaymentModal(false);

    if (pendingAction === "ask_question") {
      // Re-attempt the ask question action
      handleAskQuestion();
    }

    setPendingAction(null);
  }, [pendingAction]);

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + SPACING.lg,
              paddingBottom: insets.bottom + SPACING['2xl'],
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
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Questions</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                Ask questions, share knowledge
              </Text>
            </View>
            <View style={styles.headerActions}>
              <NotificationBell
                count={unreadCount ?? 0}
                onPress={() => router.push("/notifications" as Href)}
              />
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Ask a question"
                onPress={handleAskQuestion}
              >
                <Plus size={24} color={colors.primaryText} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <SearchBar
            placeholder="Search questions..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ marginBottom: SPACING.lg }}
            onSubmit={() => {}}
            icon={<Search size={18} color={colors.textMuted} />}
          />

          {/* Action cards for core flows */}
          <View style={styles.actionGrid}>
            <ActionCard
              title="Answer questions & earn"
              subtitle="Browse open questions and share knowledge"
              icon={<Award size={18} color={colors.success} strokeWidth={1.5} />}
              onPress={() => {
                if (!isAuthenticated) {
                  Alert.alert(
                    "Login Required",
                    "Please log in to answer questions.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Login", onPress: () => router.push("/(auth)/login" as Href) }
                    ]
                  );
                  return;
                }
                // Navigate to questions list where they can pick one to answer
                if (questions.length > 0) {
                  router.push(`/question-answer/${questions[0].id}` as Href);
                }
              }}
              colors={colors}
            />
            <ActionCard
              title="Answer Instant Reward Questions!"
              subtitle="Earn instant payouts for quality answers"
              icon={<Sparkles size={18} color={colors.warning} strokeWidth={1.5} />}
              onPress={handleInstantRewardBrowse}
              colors={colors}
            />
          </View>

          {/* Ask Question Card */}
          <View style={[styles.askCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.askTitle, { color: colors.text }]}>Ask a question</Text>
            <Text style={[styles.askSubtitle, { color: colors.textMuted }]}>
              Get answers from the community and earn rewards for valuable contributions.
            </Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Write your question"
                placeholderTextColor={colors.textMuted}
                value={questionText}
                onChangeText={setQuestionText}
                multiline
                numberOfLines={3}
              />
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Category (optional)"
                placeholderTextColor={colors.textMuted}
                value={category}
                onChangeText={setCategory}
              />
            </View>
            <PrimaryButton
              title="Submit Question"
              onPress={handleAskQuestion}
              disabled={!questionText.trim()}
            />
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <StatCard
              icon={<Award size={18} color={colors.primary} strokeWidth={1.5} />}
              title="Answered"
              value={userStats?.totalAnswers || 0}
              subtitle="Total responses"
            />
            <StatCard
              icon={<TrendingUp size={18} color={colors.success} strokeWidth={1.5} />}
              title="Earned"
              value={formatCurrency(userStats?.totalEarnings || 0)}
              subtitle="Lifetime rewards"
            />
          </View>

          {/* Smart Banner Ad - Non-intrusive placement after stats */}
          {bannerAds && bannerAds.length > 0 && (
            <View style={styles.adContainer}>
              <BannerAd
                ad={bannerAds[0]}
                onAdClick={handleAdClick}
                onAdLoad={() => handleAdImpression(bannerAds[0])}
                style={styles.bannerAd}
              />
            </View>
          )}

          {/* Instant Reward Questions */}
          <SectionHeader
            title="Instant-reward questions"
            subtitle="Answer now and earn immediately"
            icon={<Sparkles size={18} color={colors.warning} strokeWidth={1.5} />}
            onSeeAll={handleInstantRewardBrowse}
          />
          <View style={styles.questionsList}>
            {instantQuestions?.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                variant="compact"
                onPress={() => handleRewardQuestionPress(q.id)}
              />
            ))}
            {(!instantQuestions || instantQuestions.length === 0) && (
              <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No instant questions right now</Text>
              </View>
            )}
          </View>

          {/* Reward Questions */}
          <SectionHeader
            title="Reward questions"
            subtitle="Answer curated questions for instant payouts"
            icon={<Award size={18} color={colors.success} strokeWidth={1.5} />}
            onSeeAll={() => router.push("/(tabs)/questions")}
          />
          <View style={styles.questionsList}>
            {rewardLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
            {!rewardLoading && rewardQuestionCards.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                variant="compact"
                onPress={() => handleRewardQuestionPress(question.id)}
              />
            ))}
            {!rewardLoading && rewardQuestionCards.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No reward questions available</Text>
              </View>
            )}
          </View>

          {/* Native Ad - Blends with content between sections */}
          {questionAds && questionAds.length > 0 && (
            <View style={styles.adContainer}>
              <NativeAd
                ad={questionAds[0]}
                onAdClick={handleAdClick}
                onAdLoad={() => handleAdImpression(questionAds[0])}
                style={styles.nativeAd}
              />
            </View>
          )}

          {/* Recent Questions - Quora-like discussion feed */}
          <SectionHeader
            title="Recent discussions"
            subtitle="Join the conversation"
            icon={<Clock3 size={18} color={colors.info} strokeWidth={1.5} />}
            onSeeAll={() => router.push("/(tabs)/questions")}
          />
          <View style={styles.questionsList}>
            {recentQuestions?.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                variant="compact"
                onPress={() => handleRecentQuestionPress(q.id)}
              />
            ))}
            {(!recentQuestions || recentQuestions.length === 0) && (
              <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recent discussions</Text>
              </View>
            )}
          </View>

          {/* Knowledge Sharing CTA - Quora-like */}
          <View style={[styles.earnCard, { backgroundColor: colors.card }]}
            accessibilityLabel="Share your knowledge with the community"
          >
            <View style={styles.earnLeft}>
              <Text style={[styles.earnTitle, { color: colors.text }]}>Share your knowledge</Text>
              <Text style={[styles.earnSubtitle, { color: colors.textMuted }]}>
                Answer questions from the community and help others learn from your expertise.
              </Text>
              <PrimaryButton
                title="Start Answering"
                onPress={() => router.push("/(tabs)/questions")}
                variant="secondary"
              />
            </View>
            <View style={[styles.earnBadge, { backgroundColor: withAlpha(colors.info, 0.15) }]}>
              <MessageCircle size={20} color={colors.info} strokeWidth={1.5} />
              <Text style={[styles.earnBadgeText, { color: colors.info }]}>Join discussion</Text>
            </View>
          </View>

          {/* Compact Ad - Minimal footprint before all questions */}
          {bannerAds && bannerAds.length > 1 && (
            <View style={styles.adContainer}>
              <CompactAd
                ad={bannerAds[1]}
                onAdClick={handleAdClick}
                onAdLoad={() => handleAdImpression(bannerAds[1])}
                style={styles.compactAd}
              />
            </View>
          )}

          {/* All Questions List */}
          <SectionHeader
            title="All questions"
            subtitle="Browse and discuss"
            icon={<Search size={18} color={colors.text} strokeWidth={1.5} />}
          />
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.questionsList}>
              {questions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  variant="default"
                  onPress={() => handleRecentQuestionPress(question.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Payment Required Modal */}
        <Modal
          visible={showPaymentModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPaymentModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconContainer, { backgroundColor: withAlpha(colors.warning, 0.15) }]}>
                  <CreditCard size={32} color={colors.warning} strokeWidth={1.5} />
                </View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Subscription Required</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  An active subscription is required to submit questions. Upgrade now to unlock all features.
                </Text>
              </View>

              <View style={styles.modalFeatures}>
                <View style={styles.featureRow}>
                  <CheckCircle2 size={16} color={colors.success} strokeWidth={1.5} />
                  <Text style={[styles.featureText, { color: colors.text }]}>Submit unlimited questions</Text>
                </View>
                <View style={styles.featureRow}>
                  <CheckCircle2 size={16} color={colors.success} strokeWidth={1.5} />
                  <Text style={[styles.featureText, { color: colors.text }]}>Access premium reward questions</Text>
                </View>
                <View style={styles.featureRow}>
                  <CheckCircle2 size={16} color={colors.success} strokeWidth={1.5} />
                  <Text style={[styles.featureText, { color: colors.text }]}>Priority customer support</Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <PrimaryButton
                  title="Subscribe Now"
                  onPress={() => {
                    setShowPaymentModal(false);
                    router.push("/(tabs)/withdraw" as Href);
                  }}
                />
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowPaymentModal(false);
                    setPendingAction(null);
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textMuted }]}>Maybe Later</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  interface StepPillProps {
    label: string;
    active?: boolean;
    color: string;
  }

  function StepPill({ label, active, color }: StepPillProps): React.ReactElement {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: SPACING.sm,
          paddingVertical: SPACING.xs,
          borderRadius: RADIUS.full,
          backgroundColor: active ? withAlpha(color, 0.15) : "transparent",
          borderWidth: active ? 0 : 1,
          borderColor: withAlpha(color, 0.4),
          gap: SPACING.xs,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
          }}
        />
        <Text
          style={{
            fontFamily: TYPOGRAPHY.fontFamily.medium,
            fontSize: TYPOGRAPHY.fontSize.xs,
            color: color,
          }}
        >
          {label}
        </Text>
      </View>
    );
  }

interface ActionCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactElement;
  badgeLabel?: string;
  badgeColor?: string;
  disabled?: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}

function ActionCard({
  title,
  subtitle,
  icon,
  badgeLabel,
  badgeColor,
  disabled,
  onPress,
  colors,
}: ActionCardProps): React.ReactElement {
  return (
    <View
      style={[
        styles.actionCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
      accessibilityState={{ disabled }}
    >
      <View style={styles.actionHeader}>
        <View style={[styles.actionIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
          {icon}
        </View>
        {badgeLabel && (
          <View style={[styles.actionBadge, { backgroundColor: withAlpha(badgeColor || colors.textMuted, 0.15) }]}>
            <Text style={[styles.actionBadgeText, { color: badgeColor || colors.textMuted }]}>{badgeLabel}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.actionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.actionSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      <PrimaryButton
        title={disabled ? "Admin only" : "Open"}
        onPress={onPress}
        disabled={disabled}
        style={styles.actionButton}
      />
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
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: SPACING.lg,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    headerTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize["3xl"],
    },
    headerSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      marginTop: SPACING.xs,
    },
    addButton: {
      width: COMPONENT_SIZE.touchTarget,
      height: COMPONENT_SIZE.touchTarget,
      borderRadius: RADIUS.base,
      alignItems: "center",
      justifyContent: "center",
    },
    iconButton: {
      width: COMPONENT_SIZE.touchTarget,
      height: COMPONENT_SIZE.touchTarget,
      borderRadius: RADIUS.base,
      alignItems: "center",
      justifyContent: "center",
    },
    askCard: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    askTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.xl,
      marginBottom: SPACING.xs,
    },
    askSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      marginBottom: SPACING.md,
    },
    inputGroup: {
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    input: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
    },
    statsRow: {
      flexDirection: "row",
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    questionsList: {
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    emptyState: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    actionGrid: {
      gap: SPACING.md,
      marginBottom: SPACING.xl,
    },
    actionCard: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      gap: SPACING.sm,
    },
    actionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    actionIcon: {
      width: ICON_SIZE.lg,
      height: ICON_SIZE.lg,
      borderRadius: RADIUS.md,
      alignItems: "center",
      justifyContent: "center",
    },
    actionBadge: {
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
    },
    actionBadgeText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.xs,
    },
    actionTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
    },
    actionSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      lineHeight: 20,
    },
    actionButton: {
      marginTop: SPACING.md,
    },
    earnCard: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
    },
    earnLeft: {
      flex: 1,
      gap: SPACING.sm,
    },
    earnTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
    },
    earnSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    earnBadge: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
    },
    earnBadgeText: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    adminCard: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    adminHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    adminTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
    },
    adminSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      marginBottom: SPACING.md,
    },
    uploadRow: {
      flexDirection: "row",
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    uploadButton: {
      flex: 1,
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    uploadText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    stepsRow: {
      flexDirection: "row",
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    noteBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    noteText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    workflowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      marginBottom: SPACING.md,
    },
    workflowText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    loadingContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: SPACING.lg,
    },
    // Upload form styles
    uploadForm: {
      padding: SPACING.lg,
      gap: SPACING.lg,
    },
    formGroup: {
      gap: SPACING.sm,
    },
    formRow: {
      flexDirection: "row",
    },
    label: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.base,
    },
    uploadInput: {
      borderWidth: BORDER_WIDTH.thin,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      minHeight: COMPONENT_SIZE.input.medium,
    },
    paymentProviderRow: {
      flexDirection: "row",
      gap: SPACING.sm,
    },
    paymentProviderOption: {
      flex: 1,
      borderWidth: BORDER_WIDTH.thin,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      alignItems: "center",
      justifyContent: "center",
    },
    paymentProviderText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.base,
    },
    // Payment Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: SPACING.lg,
    },
    modalContent: {
      width: "100%",
      maxWidth: 400,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      gap: SPACING.lg,
    },
    modalHeader: {
      alignItems: "center",
      gap: SPACING.sm,
    },
    modalIconContainer: {
      width: 64,
      height: 64,
      borderRadius: RADIUS.full,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: SPACING.sm,
    },
    modalTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.xl,
      textAlign: "center",
    },
    modalSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      textAlign: "center",
      lineHeight: 20,
    },
    modalFeatures: {
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    featureText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    modalActions: {
      gap: SPACING.sm,
    },
    cancelButton: {
      alignItems: "center",
      paddingVertical: SPACING.md,
    },
    cancelButtonText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    // Ad Styles
    adContainer: {
      marginVertical: SPACING.md,
      borderRadius: RADIUS.lg,
      overflow: "hidden",
    },
    bannerAd: {
      borderRadius: RADIUS.lg,
      overflow: "hidden",
    },
    nativeAd: {
      borderRadius: RADIUS.lg,
      overflow: "hidden",
    },
    compactAd: {
      borderRadius: RADIUS.md,
      overflow: "hidden",
    },
  });
