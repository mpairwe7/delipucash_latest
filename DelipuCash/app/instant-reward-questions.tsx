import {
    PrimaryButton,
    QuestionCard,
    SectionHeader,
    StatCard,
    UploadRewardQuestionModal,
} from "@/components";
import { formatCurrency } from "@/services";
import { useRewardQuestions } from "@/services/hooks";
import { useInstantRewardStore, REWARD_CONSTANTS } from "@/store";
import { useAuth } from "@/utils/auth/useAuth";
import { triggerHaptic } from "@/utils/quiz-utils";
import { InstantRewardListSkeleton } from "@/components/question/QuestionSkeletons";
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
import { LinearGradient } from "expo-linear-gradient";
import { Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, CheckCircle2, Circle, Plus, RefreshCcw, Trophy, Zap } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface RewardListItem {
  id: string;
  text: string;
  rewardAmount: number;
  expiryTime: string | null;
  maxWinners: number;
  winnersCount: number;
  isInstantReward: boolean;
  createdAt: string;
  isAnswered?: boolean;
  isCorrect?: boolean;
  rewardEarned?: number;
}

export default function InstantRewardQuestionsScreen(): React.ReactElement {
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: user } = useUser();
  const { isReady: authReady, isAuthenticated, auth } = useAuth();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'unanswered' | 'completed'>('unanswered');

  const { data: rewardQuestions, isLoading, error: rewardError, refetch, isFetching } = useRewardQuestions();

  // Access instant reward store for attempt tracking
  const {
    initializeAttemptHistory,
    hasAttemptedQuestion,
    getAttemptedQuestion,
  } = useInstantRewardStore();

  const userEmail = auth?.user?.email || user?.email;

  // Initialize attempt history for current user
  useEffect(() => {
    if (userEmail) {
      initializeAttemptHistory(userEmail);
    }
  }, [userEmail, initializeAttemptHistory]);

  /**
   * Role-based access control: Check user's role field from backend
   * instead of inferring from email address (which is insecure)
   */
  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";

  const activeQuestions = useMemo<RewardListItem[]>(() => {
    const now = new Date();
    return (rewardQuestions || [])
      .filter((q) => q.isInstantReward)
      .filter((q) => {
        if (!q.expiryTime) return true;
        return new Date(q.expiryTime) > now;
      })
      .map((q) => {
        const attemptedQuestion = getAttemptedQuestion(q.id);
        return {
          id: q.id,
          text: q.text,
          rewardAmount: REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT, // Fixed reward: 500 shs
          expiryTime: q.expiryTime,
          maxWinners: q.maxWinners,
          winnersCount: q.winnersCount,
          isInstantReward: true,
          createdAt: q.createdAt,
          isAnswered: hasAttemptedQuestion(q.id),
          isCorrect: attemptedQuestion?.isCorrect ?? false,
          rewardEarned: attemptedQuestion?.rewardEarned ?? 0,
        };
      });
  }, [rewardQuestions, hasAttemptedQuestion, getAttemptedQuestion]);

  // Separate questions into unanswered and completed
  const unansweredQuestions = useMemo(() => {
    return activeQuestions.filter(q => !q.isAnswered);
  }, [activeQuestions]);

  const completedQuestions = useMemo(() => {
    return activeQuestions.filter(q => q.isAnswered);
  }, [activeQuestions]);

  // Stats
  const totalRewardsEarned = useMemo(() => {
    return completedQuestions.reduce((sum, q) => sum + (q.rewardEarned || 0), 0);
  }, [completedQuestions]);

  const correctAnswersCount = useMemo(() => {
    return completedQuestions.filter(q => q.isCorrect).length;
  }, [completedQuestions]);

  const handleRefresh = useCallback(async () => {
    triggerHaptic('light');
    await refetch();
  }, [refetch]);

  const handleBack = useCallback(() => {
    triggerHaptic('light');
    router.back();
  }, []);

  const handleUpload = useCallback(() => {
    triggerHaptic('medium');
    setShowUploadModal(true);
  }, []);

  const handleOpenQuestion = useCallback((id: string) => {
    if (!authReady) return;
    triggerHaptic('medium');
    if (!isAuthenticated) {
      router.push("/(auth)/login" as Href);
      return;
    }
    router.push(`/instant-reward-answer/${id}` as Href);
  }, [authReady, isAuthenticated]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <StatusBar style={statusBarStyle} />
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}> 
        <Pressable
          style={[styles.iconButton, { backgroundColor: colors.secondary }]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
          hitSlop={8}
        >
          <ArrowLeft size={ICON_SIZE.base} color={colors.text} strokeWidth={1.5} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Instant Reward Questions</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.iconButton, { backgroundColor: colors.secondary }]}
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Refresh questions"
          >
            <RefreshCcw size={ICON_SIZE.base} color={isFetching ? colors.primary : colors.text} strokeWidth={1.5} />
          </Pressable>
          {isAdmin && (
            <Pressable
              style={[styles.iconButton, { backgroundColor: colors.primary }]}
              onPress={handleUpload}
              accessibilityRole="button"
              accessibilityLabel="Upload question"
            >
              <Plus size={ICON_SIZE.base} color={colors.primaryText} strokeWidth={1.5} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING['2xl'] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <LinearGradient
          colors={[withAlpha(colors.primary, 0.08), withAlpha(colors.warning, 0.04)]}
          style={[styles.hero, { borderColor: colors.border }]}
        >
          <View style={[styles.heroIcon, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
            <Zap size={ICON_SIZE['4xl']} color={colors.primary} strokeWidth={1.5} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Answer fast. Earn {formatCurrency(REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT)}</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>Earn {formatCurrency(REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT)} ({REWARD_CONSTANTS.INSTANT_REWARD_POINTS} points) per correct answer. One attempt only!</Text>
          <View style={styles.heroStats}>
            <StatCard
              icon={<Circle size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />}
              title="Unanswered"
              value={unansweredQuestions.length}
              subtitle="Questions available"
            />
            <StatCard
              icon={<Trophy size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />}
              title="Earned"
              value={formatCurrency(totalRewardsEarned)}
              subtitle={`${correctAnswersCount} correct`}
            />
          </View>
        </LinearGradient>

        {/* Tab Switcher */}
        <View style={[styles.tabContainer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Pressable
            style={[
              styles.tab,
              activeTab === 'unanswered' && { backgroundColor: colors.card },
            ]}
            onPress={() => { triggerHaptic('selection'); setActiveTab('unanswered'); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'unanswered' }}
          >
            <Circle size={ICON_SIZE.xs} color={activeTab === 'unanswered' ? colors.primary : colors.textMuted} strokeWidth={2} />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'unanswered' ? colors.text : colors.textMuted }
            ]}>
              Unanswered ({unansweredQuestions.length})
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              activeTab === 'completed' && { backgroundColor: colors.card },
            ]}
            onPress={() => { triggerHaptic('selection'); setActiveTab('completed'); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'completed' }}
          >
            <CheckCircle2 size={ICON_SIZE.xs} color={activeTab === 'completed' ? colors.success : colors.textMuted} strokeWidth={2} />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'completed' ? colors.text : colors.textMuted }
            ]}>
              Completed ({completedQuestions.length})
            </Text>
          </Pressable>
        </View>

        <SectionHeader
          title={activeTab === 'unanswered' ? "Answer to earn" : "Your completed questions"}
          subtitle={activeTab === 'unanswered'
            ? `${formatCurrency(REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT)} per correct answer`
            : `${correctAnswersCount} correct out of ${completedQuestions.length}`
          }
          icon={activeTab === 'unanswered'
            ? <Zap size={ICON_SIZE.sm} color={colors.warning} strokeWidth={1.5} />
            : <CheckCircle2 size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />
          }
        />

        {isLoading ? (
          <InstantRewardListSkeleton count={4} />
        ) : rewardError ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Zap size={ICON_SIZE['2xl']} color={colors.error} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Failed to load questions</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Please check your connection and try again.</Text>
            <PrimaryButton title="Retry" onPress={handleRefresh} loading={isFetching} style={{ marginTop: SPACING.md }} />
          </View>
        ) : activeTab === 'unanswered' ? (
          unansweredQuestions.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <CheckCircle2 size={ICON_SIZE['2xl']} color={colors.success} strokeWidth={1.5} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>All caught up! 🎉</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>You&apos;ve answered all available questions. Check back soon for new ones!</Text>
                <PrimaryButton title="Refresh" onPress={handleRefresh} loading={isFetching} style={{ marginTop: SPACING.md }} />
              </View>
            ) : (
              <View style={styles.list}>
                  {unansweredQuestions.map((q) => (
                    <QuestionCard
                      key={q.id}
                      question={{
                        id: q.id,
                        text: q.text,
                        userId: null,
                        createdAt: q.createdAt,
                        updatedAt: q.createdAt,
                        rewardAmount: REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT,
                        isInstantReward: true,
                        totalAnswers: q.winnersCount,
                        category: "Rewards",
                      }}
                      variant="default"
                      onPress={() => handleOpenQuestion(q.id)}
                    />
                  ))}
                </View>
            )
          ) : (
            completedQuestions.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Circle size={ICON_SIZE['2xl']} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No completed questions</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Answer some questions to see them here!</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {completedQuestions.map((q) => (
                  <Pressable
                    key={q.id}
                    style={[
                      styles.completedCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: withAlpha(q.isCorrect ? colors.success : colors.error, 0.3),
                      },
                    ]}
                    onPress={() => handleOpenQuestion(q.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${q.isCorrect ? 'correct' : 'incorrect'} answer for: ${q.text}`}
                  >
                    <View style={styles.completedCardHeader}>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: withAlpha(q.isCorrect ? colors.success : colors.error, 0.12) }
                      ]}>
                        {q.isCorrect ? (
                          <CheckCircle2 size={ICON_SIZE.sm} color={colors.success} strokeWidth={2} />
                        ) : (
                          <Circle size={ICON_SIZE.sm} color={colors.error} strokeWidth={2} />
                        )}
                        <Text style={[
                          styles.statusText,
                          { color: q.isCorrect ? colors.success : colors.error }
                        ]}>
                          {q.isCorrect ? 'Correct' : 'Incorrect'}
                        </Text>
                      </View>
                      {q.isCorrect && (q.rewardEarned ?? 0) > 0 && (
                        <View style={[styles.rewardBadge, { backgroundColor: withAlpha(colors.success, 0.12) }]}>
                          <Trophy size={ICON_SIZE.xs} color={colors.success} strokeWidth={2} />
                          <Text style={[styles.rewardText, { color: colors.success }]}>
                            +{formatCurrency(q.rewardEarned ?? REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.completedCardText, { color: colors.text }]} numberOfLines={2}>
                      {q.text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      <UploadRewardQuestionModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  iconButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  hero: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  heroIcon: {
    width: COMPONENT_SIZE.avatar.lg,
    height: COMPONENT_SIZE.avatar.lg,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  heroSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  heroStats: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  empty: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  list: {
    gap: SPACING.md,
  },
  headerActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  tabContainer: {
    flexDirection: "row",
    borderRadius: RADIUS.md,
    padding: SPACING.xs,
    marginBottom: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  tabText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  completedCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.sm,
  },
  completedCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  rewardText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  completedCardText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.4,
  },
});
