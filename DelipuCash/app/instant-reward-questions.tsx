import {
    PrimaryButton,
    QuestionCard,
    SectionHeader,
    StatCard,
    UploadRewardQuestionModal,
} from "@/components";
import { formatCurrency } from "@/services";
import { rewardsApi } from "@/services/api";
import { useInstantRewardQuestions, useInstantRewardQuestionAttempts } from "@/services/hooks";
import type { UserAttemptRecord } from "@/services/hooks";
import { useInstantRewardStore, REWARD_CONSTANTS, cashToPoints, selectCanRedeem } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { useAuth } from "@/utils/auth/useAuth";
import { triggerHaptic } from "@/utils/quiz-utils";
import { useToast } from "@/components/ui/Toast";
import { RewardSessionSummary, RedemptionModal, SessionClosedModal } from "@/components/quiz";
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
import { ArrowLeft, CheckCircle2, Circle, Clock3, Lock, Plus, RefreshCcw, Trophy, Zap } from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    FlatList,
    Alert,
    Pressable,
    RefreshControl,
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
  spotsLeft: number;
  isFull: boolean;
  isExpiringSoon: boolean;
}

const ItemSeparator = memo(function ItemSeparator() {
  return <View style={{ height: SPACING.md }} />;
});

// ─── Urgency helpers ─────────────────────────────────────────────────────────

/** Return true when the question expires within 1 hour */
function checkExpiringSoon(expiryTime: string | null): boolean {
  if (!expiryTime) return false;
  const diff = new Date(expiryTime).getTime() - Date.now();
  return diff > 0 && diff < 3600_000; // <1 hour
}

/** Sort: open first (fewer spots = higher urgency), then expiring soon, then full */
function sortByOpportunity(a: RewardListItem, b: RewardListItem): number {
  // Answered items go last (shouldn't be in available, but safety net)
  if (a.isAnswered !== b.isAnswered) return a.isAnswered ? 1 : -1;
  // Full items sink to bottom
  if (a.isFull !== b.isFull) return a.isFull ? 1 : -1;
  // Expiring soon rises to top
  if (a.isExpiringSoon !== b.isExpiringSoon) return a.isExpiringSoon ? -1 : 1;
  // Fewer spots = more urgent  
  return a.spotsLeft - b.spotsLeft;
}

// ─── Spots Progress Indicator ────────────────────────────────────────────────

interface SpotsIndicatorProps {
  spotsLeft: number;
  maxWinners: number;
  winnersCount: number;
  isFull: boolean;
  isExpiringSoon: boolean;
  colors: {
    success: string;
    warning: string;
    error: string;
    textMuted: string;
    border: string;
  };
}

const SpotsIndicator = memo(function SpotsIndicator({
  spotsLeft,
  maxWinners,
  winnersCount,
  isFull,
  isExpiringSoon,
  colors,
}: SpotsIndicatorProps) {
  const fillPercent = maxWinners > 0 ? Math.min(winnersCount / maxWinners, 1) : 0;
  const barColor = isFull
    ? colors.error
    : spotsLeft <= 2
      ? colors.warning
      : colors.success;

  return (
    <View style={spotsStyles.container}>
      {/* Progress bar */}
      <View style={[spotsStyles.track, { backgroundColor: withAlpha(colors.border, 0.5) }]}>
        <View style={[spotsStyles.fill, { width: `${fillPercent * 100}%`, backgroundColor: barColor }]} />
      </View>
      {/* Labels row */}
      <View style={spotsStyles.labels}>
        {isFull ? (
          <View style={[spotsStyles.badge, { backgroundColor: withAlpha(colors.error, 0.12) }]}>
            <Lock size={10} color={colors.error} strokeWidth={2} />
            <Text style={[spotsStyles.badgeText, { color: colors.error }]}>Sold out</Text>
          </View>
        ) : spotsLeft <= 2 ? (
          <View style={[spotsStyles.badge, { backgroundColor: withAlpha(colors.warning, 0.12) }]}>
            <Zap size={10} color={colors.warning} strokeWidth={2} />
            <Text style={[spotsStyles.badgeText, { color: colors.warning }]}>
              {spotsLeft === 1 ? "Last spot!" : `${spotsLeft} spots left`}
            </Text>
          </View>
        ) : (
          <Text style={[spotsStyles.spotsText, { color: colors.textMuted }]}>
            {spotsLeft} of {maxWinners} spots left
          </Text>
        )}
        {isExpiringSoon && !isFull && (
          <View style={[spotsStyles.badge, { backgroundColor: withAlpha(colors.warning, 0.12) }]}>
            <Clock3 size={10} color={colors.warning} strokeWidth={2} />
            <Text style={[spotsStyles.badgeText, { color: colors.warning }]}>Expiring soon</Text>
          </View>
        )}
      </View>
    </View>
  );
});

const spotsStyles = StyleSheet.create({
  container: { gap: SPACING.xs, marginTop: SPACING.sm },
  track: { height: 4, borderRadius: 2, overflow: "hidden" as const },
  fill: { height: "100%" as unknown as number, borderRadius: 2 },
  labels: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  badge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeText: { fontFamily: TYPOGRAPHY.fontFamily.bold, fontSize: TYPOGRAPHY.fontSize.xs - 1 },
  spotsText: { fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.xs - 1 },
});

// ─── Memoized Completed Question Card ────────────────────────────────────────
// Extracted from renderItem to prevent re-creation on every render cycle.
// Props are shallow-compared — only re-renders when item data or theme changes.

interface CompletedQuestionCardProps {
  item: RewardListItem;
  colors: { card: string; success: string; error: string; text: string; textMuted: string };
  onPress: (id: string) => void;
}

const CompletedQuestionCard = memo(function CompletedQuestionCard({
  item,
  colors,
  onPress,
}: CompletedQuestionCardProps) {
  const handlePress = useCallback(() => onPress(item.id), [onPress, item.id]);

  return (
    <Pressable
      style={[
        styles.completedCard,
        {
          backgroundColor: colors.card,
          borderColor: withAlpha(item.isCorrect ? colors.success : colors.error, 0.3),
        },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.isCorrect ? 'correct' : 'incorrect'} answer for: ${item.text}`}
    >
      <View style={styles.completedCardHeader}>
        <View style={[
          styles.statusBadge,
          { backgroundColor: withAlpha(item.isCorrect ? colors.success : colors.error, 0.12) }
        ]}>
          {item.isCorrect ? (
            <CheckCircle2 size={ICON_SIZE.sm} color={colors.success} strokeWidth={2} />
          ) : (
            <Circle size={ICON_SIZE.sm} color={colors.error} strokeWidth={2} />
          )}
          <Text style={[
            styles.statusText,
            { color: item.isCorrect ? colors.success : colors.error }
          ]}>
            {item.isCorrect ? 'Correct' : 'Incorrect'}
          </Text>
        </View>
        {item.isCorrect && (item.rewardEarned ?? 0) > 0 && (
          <View style={[styles.rewardBadge, { backgroundColor: withAlpha(colors.success, 0.12) }]}>
            <Trophy size={ICON_SIZE.xs} color={colors.success} strokeWidth={2} />
            <Text style={[styles.rewardText, { color: colors.success }]}>
              +{formatCurrency(item.rewardEarned ?? REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT)}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.completedCardText, { color: colors.text }]} numberOfLines={2}>
        {item.text}
      </Text>
    </Pressable>
  );
});

// ─── Memoized Unanswered Question Item ───────────────────────────────────────
// Extracted from renderItem to prevent re-creation of question object and onPress
// closure on every FlatList render cycle. Props are shallow-compared by memo.

interface UnansweredQuestionItemProps {
  item: RewardListItem;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: (id: string) => void;
}

const dimmedItemStyle = { opacity: 0.55 } as const;

const UnansweredQuestionItem = memo(function UnansweredQuestionItem({
  item,
  colors,
  onPress,
}: UnansweredQuestionItemProps) {
  const question = useMemo(() => ({
    id: item.id,
    text: item.text,
    userId: null,
    createdAt: item.createdAt,
    updatedAt: item.createdAt,
    rewardAmount: item.rewardAmount,
    isInstantReward: true,
    totalAnswers: item.winnersCount,
    category: "Rewards",
  }), [item.id, item.text, item.createdAt, item.rewardAmount, item.winnersCount]);

  const handlePress = useCallback(() => onPress(item.id), [onPress, item.id]);

  return (
    <View style={item.isFull ? dimmedItemStyle : undefined}>
      <QuestionCard
        question={question}
        variant="default"
        onPress={handlePress}
      />
      <SpotsIndicator
        spotsLeft={item.spotsLeft}
        maxWinners={item.maxWinners}
        winnersCount={item.winnersCount}
        isFull={item.isFull}
        isExpiringSoon={item.isExpiringSoon}
        colors={colors}
      />
    </View>
  );
});

export default function InstantRewardQuestionsScreen(): React.ReactElement {
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: user } = useUser();
  const { isReady: authReady, isAuthenticated, auth } = useAuth();
  const { showToast } = useToast();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'unanswered' | 'completed'>('unanswered');

  const { data: rewardQuestions, isLoading, error: rewardError, refetch, isFetching } = useInstantRewardQuestions();

  // Server-provided attempt records (shares cache with useInstantRewardQuestions — no extra fetch)
  const { data: serverAttempts = [] } = useInstantRewardQuestionAttempts();

  // Access instant reward store for attempt tracking — individual selectors prevent over-subscription
  const initializeAttemptHistory = useInstantRewardStore((s) => s.initializeAttemptHistory);
  const hasAttemptedQuestion = useInstantRewardStore((s) => s.hasAttemptedQuestion);
  const getAttemptedQuestion = useInstantRewardStore((s) => s.getAttemptedQuestion);
  const markQuestionAttempted = useInstantRewardStore((s) => s.markQuestionAttempted);
  const updateWalletBalance = useInstantRewardStore((s) => s.updateWalletBalance);

  // Session + wallet state for summary/redemption modals
  const { walletBalance, sessionSummary } = useInstantRewardStore(
    useShallow((s) => ({
      walletBalance: s.walletBalance,
      sessionSummary: s.sessionSummary,
    }))
  );
  const canRedeemRewards = useInstantRewardStore(selectCanRedeem);
  const endSession = useInstantRewardStore((s) => s.endSession);
  const initiateRedemption = useInstantRewardStore((s) => s.initiateRedemption);
  const completeRedemption = useInstantRewardStore((s) => s.completeRedemption);
  const cancelRedemption = useInstantRewardStore((s) => s.cancelRedemption);

  // Last successful redemption for quick-redeem shortcut
  const redemptionHistory = useInstantRewardStore((s) => s.redemptionHistory);
  const lastRedemption = useMemo(() => {
    const last = [...redemptionHistory].reverse().find((r) => r.status === 'SUCCESSFUL');
    return last ? { provider: last.provider, phoneNumber: last.phoneNumber } : null;
  }, [redemptionHistory]);

  // Session summary / closed modal state
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [showSessionClosed, setShowSessionClosed] = useState(false);
  const [sessionClosedReason, setSessionClosedReason] = useState<'EXPIRED' | 'SLOTS_FULL' | 'COMPLETED'>('SLOTS_FULL');
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [quickRedeemProvider, setQuickRedeemProvider] = useState<'MTN' | 'AIRTEL' | undefined>(undefined);
  const [quickRedeemPhone, setQuickRedeemPhone] = useState<string | undefined>(undefined);
  const [quickRedeemType, setQuickRedeemType] = useState<'CASH' | 'AIRTIME' | undefined>(undefined);

  const userEmail = auth?.user?.email || user?.email;

  // Initialize attempt history for current user
  useEffect(() => {
    if (userEmail) {
      initializeAttemptHistory(userEmail);
    }
  }, [userEmail, initializeAttemptHistory]);

  // Sync Zustand wallet balance from server-side user points (prevents drift)
  useEffect(() => {
    if (user?.points != null) {
      updateWalletBalance(user.points * REWARD_CONSTANTS.POINTS_TO_UGX_RATE);
    }
  }, [user?.points, updateWalletBalance]);

  // Hydrate local store from server-provided attempts so the UI stays in sync
  // even after app restarts or store clears.
  useEffect(() => {
    if (!serverAttempts.length) return;
    for (const sa of serverAttempts) {
      if (!hasAttemptedQuestion(sa.rewardQuestionId)) {
        markQuestionAttempted({
          questionId: sa.rewardQuestionId,
          isCorrect: sa.isCorrect,
          selectedAnswer: sa.selectedAnswer,
          rewardEarned: 0,
          isWinner: false,
          position: null,
          paymentStatus: null,
        });
      }
    }
  }, [serverAttempts, hasAttemptedQuestion, markQuestionAttempted]);

  // Build a fast lookup of server-side attempted question IDs
  const serverAttemptMap = useMemo(() => {
    const map = new Map<string, UserAttemptRecord>();
    for (const a of serverAttempts) map.set(a.rewardQuestionId, a);
    return map;
  }, [serverAttempts]);

  /**
   * Role-based access control: Check user's role field from backend
   * instead of inferring from email address (which is insecure)
   */
  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";

  const activeQuestions = useMemo<RewardListItem[]>(() => {
    const now = new Date();
    return (rewardQuestions || [])
      .filter((q) => {
        if (!q.expiryTime) return true;
        return new Date(q.expiryTime) > now;
      })
      .map((q) => {
        const localAttempt = getAttemptedQuestion(q.id);
        const serverAttempt = serverAttemptMap.get(q.id);
        // Question is answered if EITHER the server or local store says so
        const isAnswered = hasAttemptedQuestion(q.id) || !!serverAttempt;
        const spots = Math.max(q.maxWinners - q.winnersCount, 0);
        return {
          id: q.id,
          text: q.text,
          rewardAmount: q.rewardAmount || REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT,
          expiryTime: q.expiryTime,
          maxWinners: q.maxWinners,
          winnersCount: q.winnersCount,
          isInstantReward: true,
          createdAt: q.createdAt,
          isAnswered,
          isCorrect: localAttempt?.isCorrect ?? serverAttempt?.isCorrect ?? false,
          rewardEarned: localAttempt?.rewardEarned ?? 0,
          spotsLeft: spots,
          isFull: spots <= 0 || q.isCompleted,
          isExpiringSoon: checkExpiringSoon(q.expiryTime),
        };
      });
  }, [rewardQuestions, hasAttemptedQuestion, getAttemptedQuestion, serverAttemptMap]);

  // Separate questions into unanswered (sorted by opportunity) and completed
  const unansweredQuestions = useMemo(() => {
    return activeQuestions.filter(q => !q.isAnswered).sort(sortByOpportunity);
  }, [activeQuestions]);

  const completedQuestions = useMemo(() => {
    return activeQuestions.filter(q => q.isAnswered);
  }, [activeQuestions]);

  // Derived counts for smart stats display
  const openQuestions = useMemo(() => unansweredQuestions.filter(q => !q.isFull), [unansweredQuestions]);
  const closedQuestions = useMemo(() => unansweredQuestions.filter(q => q.isFull), [unansweredQuestions]);

  // Refs for stable callback access — avoids recreating handleOpenQuestion on every data refetch
  const activeQuestionsRef = useRef(activeQuestions);
  activeQuestionsRef.current = activeQuestions;
  const openQuestionsRef = useRef(openQuestions);
  openQuestionsRef.current = openQuestions;

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

  // Stable callback — reads data from refs so it doesn't recreate on every refetch.
  // This is the #1 fix: previously, activeQuestions/openQuestions in deps caused
  // handleOpenQuestion → renderItem → ALL items to re-render on every data change.
  const handleOpenQuestion = useCallback((id: string) => {
    if (!authReady) return;
    triggerHaptic('medium');
    if (!isAuthenticated) {
      router.push("/(auth)/login" as Href);
      return;
    }
    // Check if question is full before navigating (read from ref for latest data)
    const item = activeQuestionsRef.current.find(q => q.id === id);
    if (item?.isFull && !item.isAnswered) {
      triggerHaptic('warning');
      const nextOpen = openQuestionsRef.current.find(q => q.id !== id);
      Alert.alert(
        'No Spots Left',
        'All winner spots have been filled for this question.',
        nextOpen
          ? [
              { text: 'OK', style: 'cancel' },
              {
                text: 'Try Another',
                onPress: () => router.push(`/instant-reward-answer/${nextOpen.id}` as Href),
              },
            ]
          : [{ text: 'OK' }]
      );
      return;
    }
    router.push(`/instant-reward-answer/${id}` as Href);
  }, [authReady, isAuthenticated]);

  // Dynamic reward amount from question model, fallback to constant
  const displayRewardAmount = useMemo(() => {
    if (activeQuestions.length > 0) return activeQuestions[0].rewardAmount;
    return REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT;
  }, [activeQuestions]);

  // Select data based on active tab for FlatList
  const displayedQuestions = useMemo(() => {
    return activeTab === 'unanswered' ? unansweredQuestions : completedQuestions;
  }, [activeTab, unansweredQuestions, completedQuestions]);

  const keyExtractor = useCallback((item: RewardListItem) => item.id, []);

  const renderItem = useCallback(({ item }: { item: RewardListItem }) => {
    // Use item.isAnswered instead of activeTab — displayedQuestions already
    // filters by tab, so this avoids recreating renderItem on tab switch
    // (which would force every visible cell to re-render).
    if (!item.isAnswered) {
      return (
        <UnansweredQuestionItem
          item={item}
          colors={colors}
          onPress={handleOpenQuestion}
        />
      );
    }

    return (
      <CompletedQuestionCard
        item={item}
        colors={colors}
        onPress={handleOpenQuestion}
      />
    );
  }, [handleOpenQuestion, colors]);

  // ── Memoized FlatList sub-components (stable refs prevent header/empty re-mount) ──

  const handleSelectUnanswered = useCallback(() => {
    triggerHaptic('selection');
    setActiveTab('unanswered');
  }, []);

  const handleSelectCompleted = useCallback(() => {
    triggerHaptic('selection');
    setActiveTab('completed');
  }, []);

  // ── Session detection: all questions done or all spots full ──

  // Track whether user has been shown the session-done prompt (avoid re-triggering)
  const sessionShownRef = useRef(false);

  // Detect when all questions are answered or all spots are full
  const allQuestionsDone = useMemo(() => {
    if (!rewardQuestions || rewardQuestions.length === 0 || isLoading) return false;
    // Every active question is either answered or full
    return activeQuestions.length > 0 && unansweredQuestions.length === 0;
  }, [rewardQuestions, activeQuestions, unansweredQuestions, isLoading]);

  const allSpotsFull = useMemo(() => {
    if (!rewardQuestions || rewardQuestions.length === 0 || isLoading) return false;
    return openQuestions.length === 0 && unansweredQuestions.length > 0;
  }, [rewardQuestions, openQuestions, unansweredQuestions, isLoading]);

  // Auto-show session summary when all questions done
  useEffect(() => {
    if (allQuestionsDone && completedQuestions.length > 0 && !sessionShownRef.current) {
      sessionShownRef.current = true;
      // Small delay so the list finishes rendering
      const timer = setTimeout(() => {
        triggerHaptic('success');
        endSession();
        setShowSessionSummary(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [allQuestionsDone, completedQuestions.length, endSession]);

  // Auto-show session-closed when all spots full but unanswered questions remain
  useEffect(() => {
    if (allSpotsFull && !allQuestionsDone && !sessionShownRef.current) {
      sessionShownRef.current = true;
      const timer = setTimeout(() => {
        triggerHaptic('warning');
        setSessionClosedReason('SLOTS_FULL');
        setShowSessionClosed(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [allSpotsFull, allQuestionsDone]);

  // Reset trigger when data refreshes and new questions appear
  useEffect(() => {
    if (openQuestions.length > 0 || unansweredQuestions.length > 0) {
      if (!allQuestionsDone && !allSpotsFull) {
        sessionShownRef.current = false;
      }
    }
  }, [openQuestions.length, unansweredQuestions.length, allQuestionsDone, allSpotsFull]);

  // ── Session summary average time ──
  const averageTimeSeconds = useMemo(() => {
    const { questionsAnswered, totalTimeSpentMs } = sessionSummary;
    if (questionsAnswered === 0) return 0;
    return Math.round(totalTimeSpentMs / questionsAnswered / 1000);
  }, [sessionSummary.questionsAnswered, sessionSummary.totalTimeSpentMs]);

  // ── Modal callbacks ──
  const handleRedeemCash = useCallback(() => {
    setQuickRedeemType(undefined);
    setQuickRedeemProvider(undefined);
    setQuickRedeemPhone(undefined);
    setShowSessionSummary(false);
    setShowRedemptionModal(true);
  }, []);

  const handleRedeemAirtime = useCallback(() => {
    setQuickRedeemType(undefined);
    setQuickRedeemProvider(undefined);
    setQuickRedeemPhone(undefined);
    setShowSessionSummary(false);
    setShowRedemptionModal(true);
  }, []);

  const handleQuickRedeem = useCallback((provider: 'MTN' | 'AIRTEL', phoneNumber: string) => {
    setQuickRedeemType('CASH');
    setQuickRedeemProvider(provider);
    setQuickRedeemPhone(phoneNumber);
    setShowSessionSummary(false);
    setShowRedemptionModal(true);
  }, []);

  const handleSessionContinue = useCallback(() => {
    setShowSessionSummary(false);
  }, []);

  const handleSessionClose = useCallback(() => {
    setShowSessionSummary(false);
    router.back();
  }, []);

  const handleCloseRedemption = useCallback(() => {
    setShowRedemptionModal(false);
    cancelRedemption();
  }, [cancelRedemption]);

  const handleRedeem = useCallback(async (
    amount: number,
    type: 'CASH' | 'AIRTIME',
    provider: 'MTN' | 'AIRTEL',
    phoneNumber: string
  ): Promise<{ success: boolean; message?: string }> => {
    initiateRedemption({
      points: cashToPoints(amount),
      cashValue: amount,
      type,
      provider,
      phoneNumber,
    });

    try {
      const response = await rewardsApi.redeem(amount, provider, phoneNumber, type);

      if (response.data?.success) {
        completeRedemption(response.data.transactionRef ?? `TXN-${Date.now()}`, true);
        return {
          success: true,
          message: response.data.message ?? `${formatCurrency(amount)} sent to your ${provider} number!`,
        };
      } else {
        const errorMsg = response.data?.error ?? response.error ?? 'Payment failed.';
        completeRedemption('', false, errorMsg);
        return { success: false, message: `${errorMsg} Points refunded.` };
      }
    } catch (err: any) {
      const errorMsg = err?.message ?? 'Something went wrong. Please try again.';
      completeRedemption('', false, errorMsg);
      return { success: false, message: errorMsg };
    }
  }, [initiateRedemption, completeRedemption]);

  // SessionClosedModal handlers
  const handleSessionClosedContinue = useCallback(async () => {
    triggerHaptic('light');
    setShowSessionClosed(false);
    sessionShownRef.current = false; // allow re-evaluation after fresh data
    await handleRefresh();
  }, [handleRefresh]);

  const handleSessionClosedRedeem = useCallback(() => {
    triggerHaptic('medium');
    setShowSessionClosed(false);
    setQuickRedeemType(undefined);
    setQuickRedeemProvider(undefined);
    setQuickRedeemPhone(undefined);
    setShowRedemptionModal(true);
  }, []);

  const handleSessionClosedExit = useCallback(() => {
    triggerHaptic('light');
    setShowSessionClosed(false);
    router.back();
  }, []);

  const listHeader = useMemo(() => (
    <>
      <LinearGradient
        colors={[withAlpha(colors.primary, 0.08), withAlpha(colors.warning, 0.04)]}
        style={[styles.hero, { borderColor: colors.border }]}
      >
        <View style={[styles.heroIcon, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
          <Zap size={ICON_SIZE['4xl']} color={colors.primary} strokeWidth={1.5} />
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Answer fast. Earn {formatCurrency(displayRewardAmount)}</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>Earn {formatCurrency(displayRewardAmount)} ({REWARD_CONSTANTS.INSTANT_REWARD_POINTS} points) per correct answer. One attempt only!</Text>
        <View style={styles.heroStats}>
          <StatCard
            icon={<Circle size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />}
            title="Open"
            value={openQuestions.length}
            subtitle="Spots available"
          />
          <StatCard
            icon={<Lock size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={1.5} />}
            title="Closed"
            value={closedQuestions.length}
            subtitle="Spots filled"
          />
          <StatCard
            icon={<Trophy size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />}
            title="Earned"
            value={formatCurrency(totalRewardsEarned)}
            subtitle={`${correctAnswersCount} correct`}
          />
        </View>
      </LinearGradient>

      <View style={[styles.tabContainer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Pressable
          style={[
            styles.tab,
            activeTab === 'unanswered' && { backgroundColor: colors.card },
          ]}
          onPress={handleSelectUnanswered}
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
          onPress={handleSelectCompleted}
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
        title={activeTab === 'unanswered'
          ? (closedQuestions.length > 0 ? `Answer to earn (${closedQuestions.length} closed)` : "Answer to earn")
          : "Your completed questions"}
        subtitle={activeTab === 'unanswered'
          ? `${openQuestions.length} open \u00B7 ${formatCurrency(displayRewardAmount)} per correct answer`
          : `${correctAnswersCount} correct out of ${completedQuestions.length}`
        }
        icon={activeTab === 'unanswered'
          ? <Zap size={ICON_SIZE.sm} color={colors.warning} strokeWidth={1.5} />
          : <CheckCircle2 size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />
        }
      />

      {isLoading && <InstantRewardListSkeleton count={4} />}
      {!isLoading && rewardError && (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Zap size={ICON_SIZE['2xl']} color={colors.error} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Failed to load questions</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Please check your connection and try again.</Text>
          <PrimaryButton title="Retry" onPress={handleRefresh} loading={isFetching} style={{ marginTop: SPACING.md }} />
        </View>
      )}
    </>
  ), [
    colors, displayRewardAmount, openQuestions.length, closedQuestions.length,
    unansweredQuestions.length, completedQuestions.length,
    totalRewardsEarned, correctAnswersCount, activeTab, isLoading, rewardError,
    isFetching, handleRefresh, handleSelectUnanswered, handleSelectCompleted,
  ]);

  const listEmpty = useMemo(() => {
    if (isLoading || rewardError) return null;
    if (activeTab === 'unanswered') {
      return (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <CheckCircle2 size={ICON_SIZE['2xl']} color={colors.success} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>All caught up!</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>You've answered all available questions. Check back soon for new ones!</Text>
          <PrimaryButton title="Refresh" onPress={handleRefresh} loading={isFetching} style={{ marginTop: SPACING.md }} />
        </View>
      );
    }
    return (
      <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Circle size={ICON_SIZE['2xl']} color={colors.textMuted} strokeWidth={1.5} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No completed questions</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Answer some questions to see them here!</Text>
      </View>
    );
  }, [isLoading, rewardError, activeTab, colors, handleRefresh, isFetching]);

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

      {/* ── Memoized list header (stable reference — prevents FlatList header re-mount) ── */}
      <FlatList
        style={{ flex: 1 }}
        data={displayedQuestions}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
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
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        removeClippedSubviews
        initialNumToRender={8}
        ItemSeparatorComponent={ItemSeparator}
      />

      <UploadRewardQuestionModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />

      {/* Session Closed Modal — all spots full */}
      <SessionClosedModal
        visible={showSessionClosed}
        reason={sessionClosedReason}
        questionsAnswered={sessionSummary.questionsAnswered}
        correctAnswers={sessionSummary.correctAnswers}
        totalEarned={sessionSummary.totalEarned}
        totalBalance={walletBalance}
        canRedeem={canRedeemRewards}
        onContinue={handleSessionClosedContinue}
        onExit={handleSessionClosedExit}
        onRedeem={handleSessionClosedRedeem}
        remainingQuestions={unansweredQuestions.length}
      />

      {/* Session Summary Modal — all questions answered */}
      <RewardSessionSummary
        visible={showSessionSummary}
        totalQuestions={sessionSummary.totalQuestions}
        correctAnswers={sessionSummary.correctAnswers}
        incorrectAnswers={sessionSummary.incorrectAnswers}
        totalEarned={sessionSummary.totalEarned}
        sessionEarnings={sessionSummary.totalEarned}
        totalBalance={walletBalance}
        canRedeemRewards={canRedeemRewards}
        onRedeemCash={handleRedeemCash}
        onRedeemAirtime={handleRedeemAirtime}
        onContinue={handleSessionContinue}
        onClose={handleSessionClose}
        maxStreak={sessionSummary.maxStreak}
        bonusPoints={sessionSummary.bonusPoints}
        averageTime={averageTimeSeconds}
        lastRedemption={lastRedemption}
        onQuickRedeem={handleQuickRedeem}
      />

      {/* Redemption Modal */}
      <RedemptionModal
        visible={showRedemptionModal}
        availableAmount={walletBalance}
        onClose={handleCloseRedemption}
        onRedeem={handleRedeem}
        initialType={quickRedeemType}
        initialProvider={quickRedeemProvider}
        initialPhone={quickRedeemPhone}
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
