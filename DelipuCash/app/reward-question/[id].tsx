/**
 * Reward Question Answer Screen — Full Quiz Session
 *
 * Features:
 * - Zustand RewardStore with useShallow for grouped state reads
 * - TanStack Query for server state (question data, answer submission)
 * - Single-attempt enforcement via persistent attempt history
 * - Auto-transition to next unanswered question with reanimated native-thread animations
 * - Isolated CountdownTimer component (per-second renders don't touch parent)
 * - Memoized sub-components (OptionItem, WinnerRow) for performance
 * - Soft auth guard (toast, not hard redirect — source screen already verified)
 * - Dynamic reward amounts from question model
 * - Session progress bar (Question X of Y)
 * - Proper accessibility roles (radiogroup + radio)
 * - Session summary + redemption modals
 * - Haptic feedback & accessibility
 */

import { PrimaryButton, StatCard } from "@/components";
import { RewardQuestionSkeleton } from "@/components/question/QuestionSkeletons";
import { useToast } from "@/components/ui/Toast";
import { RewardSessionSummary, RedemptionModal, AnswerResultOverlay } from "@/components/quiz";
import { PostQuestionAdSlot } from "@/components/ads/PostQuestionAdSlot";
import { SessionSummaryAd } from "@/components/ads/SessionSummaryAd";
import { useQuizAdPlacement } from "@/hooks/useQuizAdPlacement";
import { formatCurrency, rewardsApi } from "@/services/api";
import {
  useRewardQuestion,
  useRegularRewardQuestions,
  useSubmitRewardAnswer,
  useUserProfile,
} from "@/services/hooks";
import { useAuth } from "@/utils/auth/useAuth";
import { useInstantRewardStore, REWARD_CONSTANTS, cashToPoints, selectCanRedeem } from "@/store";
import { useRewardConfig, pointsToUgx } from "@/services/configHooks";
import { useShallow } from "zustand/react/shallow";
import { RewardAnswerResult } from "@/types";
import {
  BORDER_WIDTH,
  COMPONENT_SIZE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  ThemeColors,
  useTheme,
  withAlpha,
} from "@/utils/theme";
import { normalizeText, triggerHaptic } from "@/utils/quiz-utils";
import { lockPortrait } from "@/hooks/useScreenOrientation";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Lock,
  PartyPopper,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Pure utility (stable — outside component) ──────────────────────────────

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
};

// ─── CountdownTimer (isolates per-second re-renders from parent) ─────────────

interface CountdownTimerProps {
  expiryTime: string;
  colors: { warning: string };
  onExpired?: () => void;
}

const CountdownTimer = memo(function CountdownTimer({
  expiryTime,
  colors,
  onExpired,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const diff = Math.max(
      0,
      Math.floor((new Date(expiryTime).getTime() - Date.now()) / 1000)
    );
    return diff;
  });

  useEffect(() => {
    const expiry = new Date(expiryTime).getTime();
    const update = (): void => {
      const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0) onExpired?.();
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiryTime, onExpired]);

  const isExpired = timeLeft <= 0;

  return (
    <View
      style={[
        countdownStyles.timerPill,
        { backgroundColor: withAlpha(colors.warning, 0.12) },
      ]}
    >
      <Clock3 size={ICON_SIZE.sm} color={colors.warning} strokeWidth={1.5} />
      <Text style={[countdownStyles.timerText, { color: colors.warning }]}>
        {isExpired ? "Expired" : formatTime(timeLeft)}
      </Text>
    </View>
  );
});

const countdownStyles = StyleSheet.create({
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  timerText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

// ─── Memoized sub-components ─────────────────────────────────────────────────

interface OptionItemProps {
  optionKey: string;
  label: string;
  isSelected: boolean;
  isCorrect: boolean;
  wasSelectedPreviously: boolean;
  isDisabled: boolean;
  onPress: (key: string) => void;
  colors: ThemeColors;
}

const OptionItem = memo(function OptionItem({
  optionKey,
  label,
  isSelected,
  isCorrect,
  wasSelectedPreviously,
  isDisabled,
  onPress,
  colors,
}: OptionItemProps) {
  const handlePress = useCallback(
    () => onPress(optionKey),
    [optionKey, onPress]
  );

  return (
    <Pressable
      style={[
        styles.option,
        {
          borderColor: isSelected ? colors.primary : colors.border,
          backgroundColor: isSelected
            ? withAlpha(colors.primary, 0.08)
            : isDisabled
              ? withAlpha(colors.secondary, 0.5)
              : colors.secondary,
          opacity: isDisabled && !wasSelectedPreviously ? 0.6 : 1,
        },
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
    >
      <View style={styles.optionLeft}>
        <View
          style={[
            styles.radio,
            {
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primary : "transparent",
            },
          ]}
        />
        <Text
          style={[
            styles.optionLabel,
            {
              color:
                isDisabled && !wasSelectedPreviously
                  ? colors.textMuted
                  : colors.text,
            },
          ]}
        >
          {`${optionKey.toUpperCase()}. ${label}`}
        </Text>
      </View>
      {isCorrect && (
        <CheckCircle2
          size={ICON_SIZE.sm}
          color={colors.success}
          strokeWidth={1.5}
        />
      )}
      {wasSelectedPreviously && !isCorrect && (
        <AlertCircle
          size={ICON_SIZE.sm}
          color={colors.error}
          strokeWidth={1.5}
        />
      )}
    </Pressable>
  );
});

interface WinnerRowProps {
  winner: {
    id: string;
    position: number;
    userEmail: string;
    paymentStatus: string;
    amountAwarded: number;
  };
  colors: ThemeColors;
}

const WinnerRow = memo(function WinnerRow({ winner, colors }: WinnerRowProps) {
  return (
    <View style={[styles.winnerRow, { borderColor: colors.border }]}>
      <View style={styles.winnerLeft}>
        <Text style={[styles.winnerPosition, { color: colors.primary }]}>
          {winner.position}.
        </Text>
        <View style={styles.winnerInfo}>
          <Text
            style={[styles.winnerEmail, { color: colors.text }]}
            numberOfLines={1}
          >
            {winner.userEmail}
          </Text>
          <Text style={[styles.winnerStatus, { color: colors.textMuted }]}>
            {winner.paymentStatus}
          </Text>
        </View>
      </View>
      <Text style={[styles.winnerAmount, { color: colors.success }]}>
        {formatCurrency(winner.amountAwarded)}
      </Text>
    </View>
  );
});

// ─── Main Screen Component ───────────────────────────────────────────────────

export default function RewardQuestionAnswerScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();

  // Lock to portrait — quiz layouts are designed exclusively for portrait orientation
  useEffect(() => { lockPortrait(); }, []);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<RewardAnswerResult | null>(null);
  const [revealedCorrectAnswer, setRevealedCorrectAnswer] = useState<
    string | null
  >(null);
  const [isExpired, setIsExpired] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [quickRedeemProvider, setQuickRedeemProvider] = useState<'MTN' | 'AIRTEL' | undefined>(undefined);
  const [quickRedeemPhone, setQuickRedeemPhone] = useState<string | undefined>(undefined);
  const [quickRedeemType, setQuickRedeemType] = useState<'CASH' | 'AIRTIME' | undefined>(undefined);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [overlayIsCorrect, setOverlayIsCorrect] = useState(false);
  const [overlayEarned, setOverlayEarned] = useState(0);
  const [overlayEarnedPoints, setOverlayEarnedPoints] = useState(0);
  const { showToast } = useToast();

  // Reanimated transition values (native thread)
  const transitionOpacity = useSharedValue(1);
  const transitionTranslateX = useSharedValue(0);

  const questionId = id || "";

  // ── Auth — Zustand store (synchronous, already hydrated) ──
  const { isReady: authReady, isAuthenticated, auth } = useAuth();

  // ── TanStack Query — server state ──
  const {
    data: question,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useRewardQuestion(questionId);
  // Server-side filtered — only non-instant reward questions
  const { data: rewardQuestionsOnly = [] } = useRegularRewardQuestions();
  const { data: user, refetch: refetchProfile } = useUserProfile();
  const submitAnswer = useSubmitRewardAnswer();

  // ── User data — auth store (instant) with profile enrichment (network) ──
  const userEmail = user?.email ?? auth?.user?.email ?? null;
  const userPhone = user?.phone ?? auth?.user?.phone ?? null;

  // ── Dynamic reward amount from question model ──
  const rewardAmount = question?.rewardAmount || REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT;
  const rewardPoints = cashToPoints(rewardAmount) || REWARD_CONSTANTS.INSTANT_REWARD_POINTS;

  // ── Zustand: grouped read-state via useShallow (prevents re-renders) ──
  // TODO: Extract shared reward session/wallet/redemption logic into a base RewardStore
  // to decouple regular reward flow from the instant reward store (separation-of-concerns).
  // Currently both flows share useInstantRewardStore via the sessionType field ('instant'|'regular').
  const { walletBalance, sessionState, sessionType, sessionSummary } = useInstantRewardStore(
    useShallow((s) => ({
      walletBalance: s.walletBalance,
      sessionState: s.sessionState,
      sessionType: s.sessionType,
      sessionSummary: s.sessionSummary,
    }))
  );

  // ── Zustand: reactive state (triggers re-render when attemptHistory changes) ──
  const attemptHistory = useInstantRewardStore((s) => s.attemptHistory);

  // ── Zustand: reactive selector for redemption eligibility ──
  const canRedeemRewards = useInstantRewardStore(selectCanRedeem);

  // ── Last successful redemption for quick-redeem shortcut ──
  const redemptionHistory = useInstantRewardStore((s) => s.redemptionHistory);
  const lastRedemption = useMemo(() => {
    const last = [...redemptionHistory].reverse().find((r) => r.status === 'SUCCESSFUL');
    return last ? { provider: last.provider, phoneNumber: last.phoneNumber } : null;
  }, [redemptionHistory]);

  // ── Zustand: actions (stable references — never cause re-renders) ──
  const initializeAttemptHistory = useInstantRewardStore(
    (s) => s.initializeAttemptHistory
  );
  const markQuestionAttempted = useInstantRewardStore(
    (s) => s.markQuestionAttempted
  );
  const confirmReward = useInstantRewardStore((s) => s.confirmReward);
  const startSession = useInstantRewardStore((s) => s.startSession);
  const endSession = useInstantRewardStore((s) => s.endSession);
  const goToNextQuestion = useInstantRewardStore((s) => s.goToNextQuestion);
  const recordQuestionStart = useInstantRewardStore((s) => s.recordQuestionStart);
  const updateSessionSummary = useInstantRewardStore(
    (s) => s.updateSessionSummary
  );
  const initiateRedemption = useInstantRewardStore(
    (s) => s.initiateRedemption
  );
  const completeRedemption = useInstantRewardStore(
    (s) => s.completeRedemption
  );
  const cancelRedemption = useInstantRewardStore((s) => s.cancelRedemption);

  // ── Zustand: current streak for overlay ──
  const currentStreak = useInstantRewardStore((s) => s.sessionSummary.currentStreak);

  // ── Zustand: wallet sync action ──
  const syncWalletFromServer = useInstantRewardStore((s) => s.syncWalletFromServer);

  // ── Sync Zustand wallet with server-side points to prevent drift ──
  // (Duolingo/Cash App pattern: source of truth is always the server)
  const { data: rewardConfig } = useRewardConfig();
  useEffect(() => {
    if (user?.points != null && rewardConfig) {
      syncWalletFromServer(pointsToUgx(user.points, rewardConfig));
    }
  }, [user?.points, rewardConfig, syncWalletFromServer]);

  // ── Soft auth check — user navigated from an auth-guarded screen,
  //    so only show a toast if auth expires mid-session (no hard redirect) ──
  useEffect(() => {
    if (authReady && !isAuthenticated) {
      showToast({
        message: "Your session has expired. Please log in again.",
        type: "warning",
        action: "Login",
        onAction: () => router.push("/(auth)/login" as Href),
      });
    }
  }, [authReady, isAuthenticated, showToast]);

  // ── Initialize attempt history — uses auth store (instant) with profile fallback ──
  useEffect(() => {
    if (userEmail) {
      initializeAttemptHistory(userEmail);
    }
  }, [userEmail, initializeAttemptHistory]);

  // ── Initialize session if not already started (or if switching from a different session type) ──
  useEffect(() => {
    if (rewardQuestionsOnly.length > 0 && (sessionState === "IDLE" || sessionType !== "regular")) {
      const questionIds = rewardQuestionsOnly.map((q) => q.id);
      startSession(questionIds, "regular");
    }
  }, [rewardQuestionsOnly, sessionState, sessionType, startSession]);

  // ── Reset ALL local state when navigating to a new question ──
  useEffect(() => {
    setSelectedOption(null);
    setResult(null);
    setRevealedCorrectAnswer(null);
    setIsExpired(false);
    setIsTransitioning(false);
    setShowResultOverlay(false);
    transitionOpacity.value = 1;
    transitionTranslateX.value = 0;
    recordQuestionStart();
  }, [questionId, transitionOpacity, transitionTranslateX, recordQuestionStart]);

  // ── Unanswered reward questions for auto-transition (excludes instant rewards) ──
  // Excludes full/completed questions so transitions never land on a dead-end.
  const unansweredQuestions = useMemo(() => {
    if (rewardQuestionsOnly.length === 0) return [];
    return rewardQuestionsOnly.filter(
      (q) =>
        q.id !== questionId &&
        !q.isCompleted &&
        !attemptHistory?.attemptedQuestionIds.includes(q.id) &&
        q.maxWinners - q.winnersCount > 0 // skip full questions
    );
  }, [rewardQuestionsOnly, questionId, attemptHistory]);

  // ── Session progress ──
  const sessionProgress = useMemo(() => {
    if (rewardQuestionsOnly.length === 0) return { current: 0, total: 0 };
    const total = rewardQuestionsOnly.length;
    const attempted = attemptHistory?.attemptedQuestionIds.filter((id) =>
      rewardQuestionsOnly.some((q) => q.id === id)
    ).length ?? 0;
    return { current: attempted + (result || hasAlreadyAttempted(attemptHistory, questionId) ? 0 : 1), total };

    function hasAlreadyAttempted(history: typeof attemptHistory, qId: string) {
      return history?.attemptedQuestionIds.includes(qId) ?? false;
    }
  }, [rewardQuestionsOnly, attemptHistory, questionId, result]);

  // ── Check if user has already attempted this question ──
  const previousAttempt = useMemo(() => {
    if (!questionId || !attemptHistory) return null;
    return (
      attemptHistory.attemptedQuestions.find(
        (a) => a.questionId === questionId
      ) ?? null
    );
  }, [questionId, attemptHistory]);

  const hasAlreadyAttempted = useMemo(() => {
    if (!attemptHistory) return false;
    return attemptHistory.attemptedQuestionIds.includes(questionId);
  }, [questionId, attemptHistory]);

  // ── Quiz ad placement (post-answer + session summary ads) ──
  const hasSubmittedOrAttempted = Boolean(result || hasAlreadyAttempted);
  const {
    postAnswerAd,
    sessionSummaryAd,
    shouldShowPostAnswerAd,
    shouldShowSessionAd,
    recordQuestionAnswered: recordAdQuestionAnswered,
    trackPostAnswerImpression,
    trackSessionImpression,
  } = useQuizAdPlacement({
    contextType: 'rewards',
    hasSubmitted: hasSubmittedOrAttempted,
  });

  // ── Stable callback for CountdownTimer to signal expiry ──
  const handleTimerExpired = useCallback(() => setIsExpired(true), []);

  // ── Derived state ──
  const options = useMemo(() => {
    if (!question?.options) return [] as { key: string; label: string }[];
    return Object.entries(question.options).map(([key, label]) => ({
      key,
      label: String(label),
    }));
  }, [question?.options]);

  const spotsLeft = useMemo(() => {
    if (!question) return 0;
    return Math.max(question.maxWinners - question.winnersCount, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.maxWinners, question?.winnersCount]);

  const isClosed = useMemo(
    () =>
      Boolean(
        isExpired ||
          question?.isCompleted ||
          spotsLeft <= 0 ||
          result?.isCorrect ||
          result?.isExpired ||
          result?.isCompleted ||
          hasAlreadyAttempted
      ),
    [isExpired, question?.isCompleted, spotsLeft, result, hasAlreadyAttempted]
  );

  // ── Reanimated transition style (native thread) ──
  const transitionStyle = useAnimatedStyle(() => ({
    opacity: transitionOpacity.value,
    transform: [{ translateX: transitionTranslateX.value }],
  }));

  // ── Handlers ──
  const handleBack = useCallback((): void => {
    triggerHaptic("light");
    router.back();
  }, []);

  // Navigate to next question after transition animation completes
  const executeTransition = useCallback(
    (nextId: string) => {
      goToNextQuestion();
      router.replace(`/reward-question/${nextId}` as Href);
    },
    [goToNextQuestion]
  );

  // Auto-transition to next question or show session summary
  const handleTransitionToNext = useCallback(() => {
    const nextQuestion = unansweredQuestions[0];

    if (nextQuestion) {
      setIsTransitioning(true);
      // Animate on native thread via reanimated
      transitionOpacity.value = withTiming(0, { duration: 200 });
      transitionTranslateX.value = withTiming(-50, { duration: 200 }, () => {
        runOnJS(executeTransition)(nextQuestion.id);
      });
    } else {
      triggerHaptic("success");
      endSession();
      setShowSessionSummary(true);
    }
  }, [
    unansweredQuestions,
    transitionOpacity,
    transitionTranslateX,
    executeTransition,
    endSession,
  ]);

  const handleSelectOption = useCallback(
    (optionKey: string) => {
      if (isClosed || hasAlreadyAttempted) return;
      triggerHaptic("selection");
      setSelectedOption(optionKey);
    },
    [isClosed, hasAlreadyAttempted]
  );

  const handleSubmit = useCallback((): void => {
    const answer = selectedOption || "";

    if (!question) return;

    // Auth validation — checks Zustand auth state (synchronous, no race with profile fetch).
    // The server resolves userEmail from the JWT, so we only need auth presence here.
    if (!isAuthenticated) {
      triggerHaptic("warning");
      showToast({
        message: "Please log in to submit answers and earn rewards.",
        type: "warning",
        action: "Login",
        onAction: () => router.push("/(auth)/login" as Href),
      });
      return;
    }

    // Warn about missing phone for instant reward payouts (not regular quiz points).
    // Non-blocking — the backend resolves phone from the user's DB profile via JWT.
    if (question?.isInstantReward && user && !userPhone) {
      showToast({
        message: "Tip: update your profile with a phone number to receive reward payouts.",
        type: "info",
        action: "Update Profile",
        onAction: () => router.push("/(tabs)/profile-new" as Href),
      });
    }

    // Prevent re-attempts
    if (hasAlreadyAttempted) {
      triggerHaptic("warning");
      showToast({
        message:
          "You have already attempted this question. Each question can only be attempted once.",
        type: "warning",
      });
      return;
    }

    if (!answer) {
      triggerHaptic("warning");
      showToast({
        message: "Select the option you think is correct.",
        type: "warning",
      });
      return;
    }

    triggerHaptic("medium");

    submitAnswer.mutate(
      {
        questionId: question.id,
        answer,
        phoneNumber: userPhone || undefined,
      },
      {
        onSuccess: (payload) => {
          setResult(payload);
          if (payload.correctAnswer) {
            setRevealedCorrectAnswer(payload.correctAnswer);
          }

          // Server always sends pointsAwarded (UGX value, despite the name).
          // Use server values as single source of truth — no client fallback.
          const earnedAmount = payload.rewardEarned ?? (payload.isCorrect ? rewardAmount : 0);
          const earnedPts = payload.pointsAwarded ?? 0;

          // Mark question as attempted (persisted — single attempt enforcement)
          markQuestionAttempted({
            questionId: question.id,
            isCorrect: payload.isCorrect,
            selectedAnswer: answer,
            rewardEarned: earnedAmount,
            pointsEarned: earnedPts,
            isWinner: payload.isWinner || false,
            position: payload.position || null,
            paymentStatus: payload.paymentStatus || null,
          });

          // Update session statistics (with backend-driven points)
          updateSessionSummary(payload.isCorrect, earnedAmount, earnedPts);

          // Track question answered for ad frequency capping
          recordAdQuestionAnswered();

          // Show animated result overlay
          setOverlayIsCorrect(payload.isCorrect);
          setOverlayEarned(earnedAmount);
          setOverlayEarnedPoints(earnedPts);
          setShowResultOverlay(true);

          if (payload.isCorrect) {
            triggerHaptic("success");

            // Credit wallet with question's actual reward amount
            confirmReward(rewardAmount);

            // Build payment status message for winners
            if (payload.isWinner) {
              const paymentStatus = payload.paymentStatus || "PENDING";
              let paymentMessage = "";
              if (paymentStatus === "SUCCESSFUL") {
                paymentMessage = " Your reward has been credited!";
              } else if (paymentStatus === "PENDING") {
                paymentMessage = " Your reward is being processed.";
              }

              showToast({
                message: `Correct! +${formatCurrency(rewardAmount)} earned!${paymentMessage}`,
                type: "success",
                action:
                  unansweredQuestions.length > 0
                    ? "Next Question"
                    : "View Summary",
                onAction: () =>
                  setTimeout(() => handleTransitionToNext(), 300),
              });
            } else {
              showToast({
                message: `Correct! +${formatCurrency(rewardAmount)} earned!`,
                type: "success",
                action:
                  unansweredQuestions.length > 0
                    ? "Next Question"
                    : "View Summary",
                onAction: () =>
                  setTimeout(() => handleTransitionToNext(), 300),
              });
            }
          } else if (payload.isExpired || payload.isCompleted) {
            triggerHaptic("warning");
            showToast({
              message:
                payload.message || "Rewards are no longer available.",
              type: "warning",
              action:
                unansweredQuestions.length > 0
                  ? "Try Another"
                  : "View Summary",
              onAction: () =>
                setTimeout(() => handleTransitionToNext(), 300),
            });
          } else {
            triggerHaptic("error");
            showToast({
              message: payload.message || "That was not correct.",
              type: "error",
              action:
                unansweredQuestions.length > 0
                  ? "Next Question"
                  : "View Summary",
              onAction: () =>
                setTimeout(() => handleTransitionToNext(), 300),
            });
          }
        },
        onError: (err) => {
          triggerHaptic("error");
          const errorMessage =
            err?.message || "Unable to submit your answer. Please try again.";

          if (errorMessage.includes("already attempted")) {
            // Sync local store so the question moves to "Attempted" tab
            markQuestionAttempted({
              questionId: question.id,
              isCorrect: false, // unknown — server didn't reveal
              selectedAnswer: answer || "",
              rewardEarned: 0,
              pointsEarned: 0,
              isWinner: false,
              position: null,
              paymentStatus: null,
            });
            showToast({
              message: "You have already attempted this question.",
              type: "warning",
              action: "Go Back",
              onAction: () => router.back(),
            });
          } else if (errorMessage.includes("expired")) {
            showToast({
              message:
                "This question has expired and is no longer available.",
              type: "info",
              action: "Next",
              onAction: () => handleTransitionToNext(),
            });
          } else if (errorMessage.includes("completed")) {
            showToast({
              message: "All winners have been found for this question.",
              type: "info",
              action: "Try Another",
              onAction: () => handleTransitionToNext(),
            });
          } else {
            showToast({ message: errorMessage, type: "error" });
          }
        },
      }
    );
  }, [
    question,
    selectedOption,
    isAuthenticated,
    userPhone,
    hasAlreadyAttempted,
    rewardAmount,
    rewardPoints,
    submitAnswer,
    markQuestionAttempted,
    confirmReward,
    updateSessionSummary,
    unansweredQuestions,
    handleTransitionToNext,
    showToast,
    user,
    recordAdQuestionAnswered,
  ]);

  // ── Redemption handler ──
  const handleRedeem = useCallback(
    async (
      amount: number,
      type: "CASH" | "AIRTIME",
      provider: "MTN" | "AIRTEL",
      phoneNumber: string
    ): Promise<{ success: boolean; message?: string }> => {
      initiateRedemption({
        points: cashToPoints(amount),
        cashValue: amount,
        type,
        provider,
        phoneNumber,
      });

      const idempotencyKey = `rdm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
      try {
        const response = await rewardsApi.redeem(amount, provider, phoneNumber, type, idempotencyKey);
        if (response.data?.success) {
          completeRedemption(response.data.transactionRef ?? idempotencyKey, true);
          // Re-sync wallet from server after successful payout (Robinhood pattern)
          refetchProfile();
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
    },
    [initiateRedemption, completeRedemption, refetchProfile]
  );

  // ── Stable modal callbacks ──
  const handleRefresh = useCallback(async () => {
    triggerHaptic("light");
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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

  const handleContinue = useCallback(() => {
    setShowSessionSummary(false);
    router.back();
  }, []);

  const handleCloseSession = useCallback(() => {
    setShowSessionSummary(false);
    router.back();
  }, []);

  const handleOverlayDismiss = useCallback(() => {
    setShowResultOverlay(false);
  }, []);

  const handleCloseRedemption = useCallback(() => {
    setShowRedemptionModal(false);
    cancelRedemption();
  }, [cancelRedemption]);

  const averageTimeSeconds = useMemo(() => {
    const { questionsAnswered, totalTimeSpentMs } = sessionSummary;
    if (questionsAnswered === 0) return 0;
    return Math.round(totalTimeSpentMs / questionsAnswered / 1000);
  }, [sessionSummary]);

  const handleFooterPress = useMemo(
    () =>
      result || hasAlreadyAttempted
        ? handleTransitionToNext
        : handleSubmit,
    [result, hasAlreadyAttempted, handleTransitionToNext, handleSubmit]
  );

  // ── Feedback text — distinguish fresh incorrect from previously attempted ──
  const feedbackText = useMemo(() => {
    const isCorrect = result?.isCorrect || previousAttempt?.isCorrect;
    if (isCorrect) {
      const pts = result?.pointsAwarded ?? previousAttempt?.pointsEarned ?? rewardPoints;
      const amt = result?.isCorrect ? rewardAmount : (previousAttempt?.rewardEarned || rewardAmount);
      return `You answered correctly and earned ${formatCurrency(amt)} (${pts} points)!`;
    }
    if (result && !previousAttempt) {
      // Fresh incorrect — just submitted
      return result.message || "That was not the correct answer. Better luck next time!";
    }
    // Returning to a previously attempted question
    return "Each question can only be attempted once.";
  }, [result, previousAttempt, rewardAmount, rewardPoints]);

  // ── Loading state ──
  if (isLoading) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: colors.background }]}
      >
        <StatusBar style={statusBarStyle} />
        <RewardQuestionSkeleton />
      </View>
    );
  }

  // ── Error state ──
  if (error || !question) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: colors.background }]}
      >
        <StatusBar style={statusBarStyle} />
        <AlertCircle
          size={ICON_SIZE["5xl"]}
          color={colors.error}
          strokeWidth={1.5}
          style={{ marginBottom: SPACING.md }}
        />
        <Text style={[styles.errorText, { color: colors.error }]}>
          Reward question not found
        </Text>
        <View style={styles.errorActions}>
          <PrimaryButton
            title="Retry"
            onPress={() => {
              triggerHaptic("light");
              refetch();
            }}
          />
          <PrimaryButton
            title="Go back"
            onPress={handleBack}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACING.md,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <Pressable
          style={[styles.iconButton, { backgroundColor: colors.secondary }]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to previous screen"
          hitSlop={8}
        >
          <ArrowLeft
            size={ICON_SIZE.md}
            color={colors.text}
            strokeWidth={1.5}
          />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Reward Question
          </Text>
          {sessionProgress.total > 0 && (
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              Question {sessionProgress.current} of {sessionProgress.total}
            </Text>
          )}
        </View>

        <Pressable
          style={[styles.iconButton, { backgroundColor: colors.secondary }]}
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          accessibilityHint="Reload question data"
          hitSlop={8}
        >
          <RefreshCcw
            size={ICON_SIZE.md}
            color={isFetching ? colors.primary : colors.text}
            strokeWidth={1.5}
          />
        </Pressable>
      </View>

      {/* ── Session Progress Bar ── */}
      {sessionProgress.total > 1 && (
        <View
          style={[styles.progressBar, { backgroundColor: colors.border }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Question ${sessionProgress.current} of ${sessionProgress.total}`}
          accessibilityValue={{
            min: 0,
            max: sessionProgress.total,
            now: sessionProgress.current,
          }}
        >
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: colors.primary,
                width: `${Math.min((sessionProgress.current / sessionProgress.total) * 100, 100)}%`,
              },
            ]}
          />
        </View>
      )}

      {/* ── Content (animated for transitions) ── */}
      <Animated.View style={[{ flex: 1 }, transitionStyle]}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING['2xl'] }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Hero — reward amount & live status */}
          <LinearGradient
            colors={[
              withAlpha(colors.primary, 0.14),
              withAlpha(colors.warning, 0.08),
            ]}
            style={[styles.hero, { borderColor: colors.border }]}
          >
            <View style={styles.heroTop}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: withAlpha(isClosed ? colors.error : colors.success, 0.12) },
                ]}
              >
                <Zap
                  size={ICON_SIZE.sm}
                  color={isClosed ? colors.error : colors.success}
                  strokeWidth={1.5}
                />
                <Text style={[styles.badgeText, { color: isClosed ? colors.error : colors.success }]}>
                  {isClosed ? "Closed" : "Live"}
                </Text>
              </View>
              {!!question.expiryTime && (
                <CountdownTimer
                  expiryTime={question.expiryTime}
                  colors={colors}
                  onExpired={handleTimerExpired}
                />
              )}
            </View>

            <Text style={[styles.heroTitle, { color: colors.text }]}>
              {formatCurrency(rewardAmount)}
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
              Earn {rewardPoints} points per correct answer • One attempt only
            </Text>

            <View style={styles.heroStats}>
              <StatCard
                icon={
                  <Users
                    size={ICON_SIZE.sm}
                    color={colors.primary}
                    strokeWidth={1.5}
                  />
                }
                title="Spots left"
                value={spotsLeft}
                subtitle="Remaining winners"
              />
              <StatCard
                icon={
                  <ShieldCheck
                    size={ICON_SIZE.sm}
                    color={colors.success}
                    strokeWidth={1.5}
                  />
                }
                title="Status"
                value={isClosed ? "Closed" : "Active"}
                subtitle={question.isCompleted ? "Completed" : "Live"}
              />
            </View>
          </LinearGradient>

          {/* No Spots Left Banner (full but not attempted) — always has forward guidance */}
          {isClosed && !hasAlreadyAttempted && spotsLeft <= 0 && !result && (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={[
                styles.attemptedBanner,
                {
                  backgroundColor: withAlpha(colors.error, 0.12),
                  borderColor: withAlpha(colors.error, 0.5),
                },
              ]}
            >
              <Lock
                size={ICON_SIZE.sm}
                color={colors.error}
                strokeWidth={2}
              />
              <View style={{ flex: 1, marginLeft: SPACING.xs }}>
                <Text style={[styles.attemptedBannerTitle, { color: colors.error }]}>
                  No Spots Left
                </Text>
                <Text style={[styles.attemptedBannerText, { color: colors.textMuted }]}>
                  All {question.maxWinners} winner spots have been filled.
                  {unansweredQuestions.length > 0
                    ? " Try the next question instead!"
                    : " Check back soon for new questions."}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Already Attempted Banner */}
          {hasAlreadyAttempted && previousAttempt && (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={[
                styles.attemptedBanner,
                {
                  backgroundColor: withAlpha(
                    previousAttempt.isCorrect ? colors.success : colors.warning,
                    0.12
                  ),
                  borderColor: withAlpha(
                    previousAttempt.isCorrect ? colors.success : colors.warning,
                    0.5
                  ),
                },
              ]}
            >
              <Lock
                size={ICON_SIZE.sm}
                color={
                  previousAttempt.isCorrect ? colors.success : colors.warning
                }
                strokeWidth={1.5}
              />
              <View style={styles.attemptedBannerContent}>
                <Text
                  style={[
                    styles.attemptedBannerTitle,
                    {
                      color: previousAttempt.isCorrect
                        ? colors.success
                        : colors.warning,
                    },
                  ]}
                >
                  {previousAttempt.isCorrect
                    ? "You answered correctly!"
                    : "Already attempted"}
                </Text>
                <Text
                  style={[
                    styles.attemptedBannerText,
                    { color: colors.textMuted },
                  ]}
                >
                  {previousAttempt.isCorrect
                    ? `You earned ${formatCurrency(previousAttempt.rewardEarned || rewardAmount)} (${previousAttempt.pointsEarned || rewardPoints} points)`
                    : "Each question can only be attempted once."}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Question Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: withAlpha(colors.primary, 0.1) },
                ]}
              >
                <Sparkles
                  size={ICON_SIZE.sm}
                  color={colors.primary}
                  strokeWidth={1.5}
                />
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  Reward question
                </Text>
              </View>
              {!!question.createdAt && (
                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                  Added {new Date(question.createdAt).toLocaleDateString()}
                </Text>
              )}
            </View>

            <Text style={[styles.questionText, { color: colors.text }]}>
              {question.text}
            </Text>

            {/* Options — radiogroup for accessibility */}
            <View
              style={styles.optionsList}
              accessibilityRole="radiogroup"
              accessibilityLabel="Answer options"
            >
              {options.map((option) => {
                const isSelected =
                  selectedOption === option.key ||
                  previousAttempt?.selectedAnswer === option.key;
                const correctKey =
                  revealedCorrectAnswer || previousAttempt?.selectedAnswer;
                const isCorrectOption = Boolean(
                  (result?.isCorrect || previousAttempt?.isCorrect) &&
                    correctKey &&
                    normalizeText(correctKey) === normalizeText(option.key)
                );
                const wasSelectedPreviously =
                  previousAttempt?.selectedAnswer === option.key;
                const isOptionDisabled = isClosed || hasAlreadyAttempted;

                return (
                  <OptionItem
                    key={option.key}
                    optionKey={option.key}
                    label={option.label}
                    isSelected={isSelected}
                    isCorrect={isCorrectOption}
                    wasSelectedPreviously={wasSelectedPreviously}
                    isDisabled={isOptionDisabled}
                    onPress={handleSelectOption}
                    colors={colors}
                  />
                );
              })}
            </View>

            {/* Feedback Card */}
            {(result || previousAttempt) && (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={[
                  styles.feedback,
                  {
                    backgroundColor: withAlpha(
                      result?.isCorrect || previousAttempt?.isCorrect
                        ? colors.success
                        : colors.error,
                      0.12
                    ),
                    borderColor: withAlpha(
                      result?.isCorrect || previousAttempt?.isCorrect
                        ? colors.success
                        : colors.error,
                      0.5
                    ),
                  },
                ]}
              >
                <View style={styles.feedbackRow}>
                  <CheckCircle2
                    size={ICON_SIZE.sm}
                    color={
                      result?.isCorrect || previousAttempt?.isCorrect
                        ? colors.success
                        : colors.error
                    }
                    strokeWidth={1.5}
                  />
                  <Text
                    style={[
                      styles.feedbackTitle,
                      {
                        color:
                          result?.isCorrect || previousAttempt?.isCorrect
                            ? colors.success
                            : colors.error,
                      },
                    ]}
                  >
                    {result?.isCorrect || previousAttempt?.isCorrect
                      ? "Correct answer"
                      : result?.isExpired || result?.isCompleted
                        ? "Unavailable"
                        : "Incorrect answer"}
                  </Text>
                </View>
                <Text style={[styles.feedbackText, { color: colors.text }]}>
                  {feedbackText}
                </Text>
                {result?.remainingSpots !== undefined && (
                  <Text
                    style={[styles.feedbackMeta, { color: colors.textMuted }]}
                  >
                    Remaining spots: {result.remainingSpots}
                  </Text>
                )}
                {(result?.isCorrect || previousAttempt?.isCorrect) && (
                  <Text
                    style={[styles.feedbackReward, { color: colors.success }]}
                  >
                    +{formatCurrency(result?.isCorrect ? rewardAmount : (previousAttempt?.rewardEarned || rewardAmount))} ({result?.pointsAwarded ?? previousAttempt?.pointsEarned ?? rewardPoints} points)
                  </Text>
                )}
              </Animated.View>
            )}
          </View>

          {/* Post-Answer Ad Slot — shown after submission, frequency-capped */}
          {shouldShowPostAnswerAd && (
            <PostQuestionAdSlot
              ad={postAnswerAd}
              onImpression={trackPostAnswerImpression}
            />
          )}

          {/* Winners Card */}
          {Boolean(question.winners && question.winners.length) && (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: withAlpha(colors.info, 0.12) },
                  ]}
                >
                  <PartyPopper
                    size={ICON_SIZE.sm}
                    color={colors.info}
                    strokeWidth={1.5}
                  />
                  <Text style={[styles.badgeText, { color: colors.info }]}>
                    Winners
                  </Text>
                </View>
                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                  Latest payouts
                </Text>
              </View>

              {(question.winners || []).map((winner) => (
                <WinnerRow key={winner.id} winner={winner} colors={colors} />
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* ── Footer ── */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + SPACING.md,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        {/* Progress indicator for remaining questions */}
        {unansweredQuestions.length > 0 &&
          !hasAlreadyAttempted &&
          !result && (
            <View style={styles.progressIndicator}>
              <Text
                style={[styles.progressText, { color: colors.textMuted }]}
              >
                {unansweredQuestions.length} more question
                {unansweredQuestions.length > 1 ? "s" : ""} available
              </Text>
              <ChevronRight
                size={ICON_SIZE.sm}
                color={colors.textMuted}
                strokeWidth={1.5}
              />
            </View>
          )}

        <PrimaryButton
          title={
            hasAlreadyAttempted
              ? unansweredQuestions.length > 0
                ? "Next Question"
                : "View Summary"
              : result
                ? unansweredQuestions.length > 0
                  ? "Next Question"
                  : "View Summary"
                : isClosed
                  ? "Closed"
                  : "Submit Answer"
          }
          onPress={handleFooterPress}
          loading={submitAnswer.isPending || isTransitioning}
          disabled={isClosed && !hasAlreadyAttempted && !result}
          variant={
            hasAlreadyAttempted && !previousAttempt?.isCorrect
              ? "secondary"
              : "primary"
          }
        />
      </View>

      {/* Answer Result Overlay */}
      <AnswerResultOverlay
        visible={showResultOverlay}
        isCorrect={overlayIsCorrect}
        earnedAmount={overlayEarned}
        earnedPoints={overlayEarnedPoints}
        streakCount={currentStreak}
        onDismiss={handleOverlayDismiss}
      />

      {/* Session Summary Modal */}
      <RewardSessionSummary
        visible={showSessionSummary}
        totalQuestions={sessionSummary.totalQuestions}
        correctAnswers={sessionSummary.correctAnswers}
        incorrectAnswers={sessionSummary.incorrectAnswers}
        totalEarned={sessionSummary.totalEarned}
        sessionEarnings={sessionSummary.totalEarned}
        sessionPoints={sessionSummary.totalPointsEarned}
        totalBalance={walletBalance}
        canRedeemRewards={canRedeemRewards}
        onRedeemCash={handleRedeemCash}
        onRedeemAirtime={handleRedeemAirtime}
        onContinue={handleContinue}
        onClose={handleCloseSession}
        maxStreak={sessionSummary.maxStreak}
        bonusPoints={sessionSummary.bonusPoints}
        averageTime={averageTimeSeconds}
        lastRedemption={lastRedemption}
        onQuickRedeem={handleQuickRedeem}
        adSlot={
          shouldShowSessionAd ? (
            <SessionSummaryAd
              ad={sessionSummaryAd}
              onImpression={trackSessionImpression}
            />
          ) : undefined
        }
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
        userPhone={userPhone || undefined}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  errorText: {
    marginBottom: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  errorActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  iconButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.full,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: SPACING.xs,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  headerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  progressBar: {
    height: 3,
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 1.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  hero: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
  },
  heroSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  heroStats: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  attemptedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.md,
  },
  attemptedBannerContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  attemptedBannerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  attemptedBannerText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    lineHeight: TYPOGRAPHY.fontSize.lg * 1.4,
  },
  optionsList: {
    gap: SPACING.sm,
  },
  option: {
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  radio: {
    width: COMPONENT_SIZE.avatar.sm,
    height: COMPONENT_SIZE.avatar.sm,
    borderRadius: RADIUS.full,
    borderWidth: BORDER_WIDTH.thin,
  },
  optionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    flexShrink: 1,
  },
  feedback: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  feedbackTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  feedbackText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.4,
  },
  feedbackMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  feedbackReward: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  winnerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER_WIDTH.hairline,
  },
  winnerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  winnerPosition: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  winnerInfo: {
    flex: 1,
  },
  winnerEmail: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  winnerStatus: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  winnerAmount: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  footer: {
    borderTopWidth: BORDER_WIDTH.thin,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  progressIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  progressText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
