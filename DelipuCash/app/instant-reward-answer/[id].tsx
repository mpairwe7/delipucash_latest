import { PrimaryButton, StatCard } from "@/components";
import { RewardQuestionSkeleton } from "@/components/question/QuestionSkeletons";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, rewardsApi } from "@/services/api";
import { useRewardQuestion, useSubmitRewardAnswer, useUserProfile, useInstantRewardQuestions } from "@/services/hooks";
import { useAuth } from "@/utils/auth/useAuth";
import { useInstantRewardStore, REWARD_CONSTANTS, cashToPoints, selectCanRedeem } from "@/store";
import { useRewardConfig, pointsToUgx } from "@/services/configHooks";
import { useShallow } from "zustand/react/shallow";
import { RewardAnswerResult, RewardQuestionType, TextInputOptions } from "@/types";
import {
  TextAnswerInput,
  CountdownTimer,
  countdownStyles,
  WinnerRow,
  WinnersSection,
  TrustCard,
  formatTime,
} from "@/components/reward";
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
import {
  normalizeText,
  triggerHaptic,
} from "@/utils/quiz-utils";
import { lockPortrait } from "@/hooks/useScreenOrientation";
import { RewardSessionSummary, RedemptionModal, AnswerResultOverlay, QuestionTimer, SessionClosedModal } from "@/components/quiz";
import { useSSEEvent } from "@/services/sse";
import { PostQuestionAdSlot } from "@/components/ads/PostQuestionAdSlot";
import { SessionSummaryAd } from "@/components/ads/SessionSummaryAd";
import { useQuizAdPlacement } from "@/hooks/useQuizAdPlacement";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  AlertCircle,
    ArrowLeft,
    CheckCircle2,
  ChevronRight,
  Lock,
    RefreshCcw,
    ShieldCheck,
    Sparkles,
    Users,
    Zap,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
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
  const handlePress = useCallback(() => onPress(optionKey), [optionKey, onPress]);

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
      hitSlop={8}
      accessibilityRole="button"
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
            { color: isDisabled && !wasSelectedPreviously ? colors.textMuted : colors.text },
          ]}
        >
          {`${optionKey.toUpperCase()}. ${label}`}
        </Text>
      </View>
      {isCorrect && <CheckCircle2 size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />}
      {wasSelectedPreviously && !isCorrect && (
        <AlertCircle size={ICON_SIZE.sm} color={colors.error} strokeWidth={1.5} />
      )}
    </Pressable>
  );
});

// ─── Main Screen Component ───────────────────────────────────────────────────

export default function InstantRewardAnswerScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();

  // Lock to portrait — quiz layouts are designed exclusively for portrait orientation
  useEffect(() => { lockPortrait(); }, []);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<RewardAnswerResult | null>(null);
  const [revealedCorrectAnswer, setRevealedCorrectAnswer] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const [timerExpired, setTimerExpired] = useState(false);
  const [isOptimisticLocked, setIsOptimisticLocked] = useState(false);

  // M10: Grouped state to reduce cascading re-renders
  const [sessionClosed, setSessionClosed] = useState<{ show: boolean; reason: 'EXPIRED' | 'SLOTS_FULL' | 'COMPLETED' }>({ show: false, reason: 'EXPIRED' });
  const showSessionClosed = sessionClosed.show;
  const sessionClosedReason = sessionClosed.reason;
  const setShowSessionClosed = useCallback((show: boolean) => setSessionClosed(prev => ({ ...prev, show })), []);
  const setSessionClosedReason = useCallback((reason: 'EXPIRED' | 'SLOTS_FULL' | 'COMPLETED') => setSessionClosed(prev => ({ ...prev, reason })), []);

  const [quickRedeem, setQuickRedeem] = useState<{ provider?: 'MTN' | 'AIRTEL'; phone?: string; type?: 'CASH' | 'AIRTIME' }>({});
  const quickRedeemProvider = quickRedeem.provider;
  const quickRedeemPhone = quickRedeem.phone;
  const quickRedeemType = quickRedeem.type;
  const setQuickRedeemProvider = useCallback((v?: 'MTN' | 'AIRTEL') => setQuickRedeem(prev => ({ ...prev, provider: v })), []);
  const setQuickRedeemPhone = useCallback((v?: string) => setQuickRedeem(prev => ({ ...prev, phone: v })), []);
  const setQuickRedeemType = useCallback((v?: 'CASH' | 'AIRTIME') => setQuickRedeem(prev => ({ ...prev, type: v })), []);

  const [overlay, setOverlay] = useState<{ show: boolean; isCorrect: boolean; earned: number; earnedPoints: number }>({ show: false, isCorrect: false, earned: 0, earnedPoints: 0 });
  const showResultOverlay = overlay.show;
  const overlayIsCorrect = overlay.isCorrect;
  const overlayEarned = overlay.earned;
  const overlayEarnedPoints = overlay.earnedPoints;
  const setShowResultOverlay = useCallback((show: boolean) => setOverlay(prev => ({ ...prev, show })), []);
  const setOverlayIsCorrect = useCallback((v: boolean) => setOverlay(prev => ({ ...prev, isCorrect: v })), []);
  const setOverlayEarned = useCallback((v: number) => setOverlay(prev => ({ ...prev, earned: v })), []);
  const setOverlayEarnedPoints = useCallback((v: number) => setOverlay(prev => ({ ...prev, earnedPoints: v })), []);
  const submitGuardRef = useRef(false);
  const { showToast } = useToast();

  // Reanimated transition values (native thread)
  const transitionOpacity = useSharedValue(1);
  const transitionTranslateX = useSharedValue(0);

  // ── Auth — Zustand store (synchronous, already hydrated) ──
  const { isReady: authReady, isAuthenticated, auth } = useAuth();

  const questionId = id || "";

  // ── TanStack Query — server state ──
  const { data: question, isLoading, error, refetch, isFetching } = useRewardQuestion(questionId);
  const { data: allQuestions, refetch: refetchAllQuestions } = useInstantRewardQuestions();
  const { data: user, refetch: refetchProfile } = useUserProfile();
  const submitAnswer = useSubmitRewardAnswer();

  const userEmail = user?.email ?? auth?.user?.email ?? null;
  const userPhone = user?.phone ?? auth?.user?.phone ?? null;

  // ── Dynamic reward amount from question model ──
  const rewardAmount = question?.rewardAmount || REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT;

  // ── Zustand: state via useShallow (grouped — prevents re-renders) ──
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
  const { data: rewardConfig } = useRewardConfig();
  const rewardPoints = cashToPoints(rewardAmount, rewardConfig ?? undefined) || REWARD_CONSTANTS.INSTANT_REWARD_POINTS;
  const canRedeemRewards = useInstantRewardStore(selectCanRedeem(rewardConfig?.minWithdrawalPoints));

  // ── Last successful redemption for quick-redeem shortcut ──
  const redemptionHistory = useInstantRewardStore((s) => s.redemptionHistory);
  const lastRedemption = useMemo(() => {
    const last = [...redemptionHistory].reverse().find((r) => r.status === 'SUCCESSFUL');
    return last ? { provider: last.provider, phoneNumber: last.phoneNumber } : null;
  }, [redemptionHistory]);

  // ── Zustand: current streak for overlay ──
  const currentStreak = useInstantRewardStore((s) => s.sessionSummary.currentStreak);

  // ── Zustand: offline queue state ──
  const isOnline = useInstantRewardStore((s) => s.isOnline);
  const hasPendingSubmission = useInstantRewardStore((s) => s.hasPendingSubmission);

  // ── Zustand: actions (single subscription via useShallow — reduces overhead) ──
  const {
    initializeAttemptHistory,
    markQuestionAttempted,
    confirmReward,
    updateWalletBalance,
    startSession,
    endSession,
    goToNextQuestion,
    getSessionProgress,
    recordQuestionStart,
    updateSessionSummary,
    initiateRedemption,
    completeRedemption,
    cancelRedemption,
    addPendingSubmission,
    pruneSessionQuestions,
  } = useInstantRewardStore(
    useShallow((s) => ({
      initializeAttemptHistory: s.initializeAttemptHistory,
      markQuestionAttempted: s.markQuestionAttempted,
      confirmReward: s.confirmReward,
      updateWalletBalance: s.updateWalletBalance,
      startSession: s.startSession,
      endSession: s.endSession,
      goToNextQuestion: s.goToNextQuestion,
      getSessionProgress: s.getSessionProgress,
      recordQuestionStart: s.recordQuestionStart,
      updateSessionSummary: s.updateSessionSummary,
      initiateRedemption: s.initiateRedemption,
      completeRedemption: s.completeRedemption,
      cancelRedemption: s.cancelRedemption,
      addPendingSubmission: s.addPendingSubmission,
      pruneSessionQuestions: s.pruneSessionQuestions,
    }))
  );

  // ── Sync Zustand wallet with server-side points to prevent drift ──
  // (Duolingo/Cash App pattern: source of truth is always the server)
  useEffect(() => {
    if (user?.points != null && rewardConfig) {
      const serverBalanceUGX = pointsToUgx(user.points, rewardConfig);
      updateWalletBalance(serverBalanceUGX);
    }
  }, [user?.points, rewardConfig, updateWalletBalance]);

  // ── Soft auth check — user navigated from an auth-guarded screen,
  //    so only show a toast if auth expires mid-session (no hard redirect) ──
  useEffect(() => {
    if (authReady && !isAuthenticated) {
      showToast({
        message: 'Your session has expired. Please log in again.',
        type: 'warning',
        action: 'Login',
        onAction: () => router.push("/(auth)/login" as Href),
      });
    }
  }, [authReady, isAuthenticated, showToast]);

  // Initialize attempt history for the user
  useEffect(() => {
    if (userEmail) {
      initializeAttemptHistory(userEmail);
    }
  }, [userEmail, initializeAttemptHistory]);

  // Initialize session with ONLY eligible questions:
  // - instant reward, not completed, not already attempted, has open spots
  // (Duolingo / Kahoot! pattern: never queue dead-end questions)
  useEffect(() => {
    if (allQuestions && allQuestions.length > 0 && (sessionState === 'IDLE' || sessionType !== 'instant')) {
      const eligible = allQuestions.filter(q =>
        q.isInstantReward &&
        !q.isCompleted &&
        !attemptHistory?.attemptedQuestionIds.includes(q.id) &&
        q.maxWinners - q.winnersCount > 0
      );
      const questionIds = eligible.map(q => q.id);
      if (questionIds.length > 0) {
        startSession(questionIds, 'instant');
      }
    }
  }, [allQuestions, sessionState, sessionType, startSession, attemptHistory]);

  // ── Reset ALL local state when navigating to a new question ──
  useEffect(() => {
    setSelectedOption(null);
    setTextAnswer('');
    setResult(null);
    setRevealedCorrectAnswer(null);
    setIsExpired(false);
    setTimerExpired(false);
    setIsTransitioning(false);
    setShowResultOverlay(false);
    setIsOptimisticLocked(false);
    submitGuardRef.current = false;
    transitionOpacity.value = 1;
    transitionTranslateX.value = 0;
    recordQuestionStart();
  }, [questionId, transitionOpacity, transitionTranslateX, recordQuestionStart]);

  // Offline queue flush is handled globally by useOfflineQueueProcessor in _layout.tsx

  // Reactively prune session queue when spots fill mid-session
  // (e.g. another user claims the last spot while this user is answering)
  useEffect(() => {
    if (!allQuestions || sessionState === 'IDLE') return;
    const deadIds = allQuestions
      .filter(q => q.isCompleted || q.maxWinners - q.winnersCount <= 0)
      .map(q => q.id);
    if (deadIds.length > 0) {
      pruneSessionQuestions(deadIds);
    }
  }, [allQuestions, sessionState, pruneSessionQuestions]);

  // Get unanswered questions for auto-transition (reactive via attemptHistory)
  // Excludes full/completed questions so transitions never land on a dead-end.
  const unansweredQuestions = useMemo(() => {
    if (!allQuestions) return [];
    return allQuestions.filter(q =>
      q.id !== questionId &&
      !q.isCompleted &&
      q.isInstantReward === question?.isInstantReward &&
      !attemptHistory?.attemptedQuestionIds.includes(q.id) &&
      q.maxWinners - q.winnersCount > 0 // skip full questions
    );
  }, [allQuestions, questionId, attemptHistory, question?.isInstantReward]);

  // Check if user has already attempted this question (reactive via attemptHistory)
  const previousAttempt = useMemo(() => {
    if (!questionId || !attemptHistory) return null;
    return attemptHistory.attemptedQuestions.find(
      (a) => a.questionId === questionId
    ) ?? null;
  }, [questionId, attemptHistory]);

  const hasAlreadyAttempted = useMemo(() => {
    return attemptHistory?.attemptedQuestionIds.includes(questionId) ?? false;
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

  const spotsLeft = useMemo(() => {
    if (!question) return 0;
    return Math.max(question.maxWinners - question.winnersCount, 0);
  }, [question]);

  const isClosed = useMemo(
    () =>
      Boolean(
        isExpired ||
          question?.isCompleted ||
          spotsLeft <= 0 ||
          result?.isCorrect ||
          result?.isExpired ||
          result?.isCompleted ||
          hasAlreadyAttempted ||
          isOptimisticLocked
      ),
    [isExpired, question?.isCompleted, spotsLeft, result, hasAlreadyAttempted, isOptimisticLocked]
  );

  // Handle 60-second session timer expiration (UX enhancement)
  useEffect(() => {
    if (timerExpired && !result && !hasAlreadyAttempted) {
      triggerHaptic('error');
      setSessionClosed({ show: true, reason: 'EXPIRED' });
      showToast({
        message: 'Time\'s up! This question session has ended.',
        type: 'warning',
      });
    }
  }, [timerExpired, result, hasAlreadyAttempted, showToast]);

  // M8: Real-time disbursement status tracking via SSE
  useSSEEvent<{ type: string; status: string; amount?: number; reference?: string }>(
    'transaction.statusUpdate',
    useCallback((data) => {
      if (data.type !== 'instant_reward') return;
      if (data.status === 'SUCCESSFUL') {
        showToast({
          message: `Your reward of ${formatCurrency(data.amount ?? 0)} has been sent!`,
          type: 'success',
        });
      } else if (data.status === 'FAILED') {
        showToast({
          message: 'Reward disbursement failed. Please contact support.',
          type: 'error',
        });
      }
    }, [showToast])
  );

  // Auto-show SessionClosedModal when landing on a question with no spots left.
  // This catches the race condition where spots fill between navigation and render.
  // Also refetches the questions list so unansweredQuestions gets fresh winnersCount data.
  useEffect(() => {
    if (
      question &&
      !isLoading &&
      !hasAlreadyAttempted &&
      !result &&
      !showSessionClosed &&
      !showSessionSummary &&
      spotsLeft <= 0
    ) {
      // Refetch the list cache so unansweredQuestions recomputes with fresh data
      refetchAllQuestions();
      const timer = setTimeout(() => {
        triggerHaptic('warning');
        setSessionClosed({ show: true, reason: 'SLOTS_FULL' });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [question, isLoading, hasAlreadyAttempted, result, spotsLeft, showSessionClosed, showSessionSummary, refetchAllQuestions]);

  // Stable callback for CountdownTimer to signal expiry (no per-second parent re-render)
  const handleTimerExpired = useCallback(() => setIsExpired(true), []);

  // ── Question type detection ──
  const questionType: RewardQuestionType = (question?.questionType as RewardQuestionType) || 'multiple_choice';
  const isTextInput = questionType === 'text_input';
  const textInputMeta: TextInputOptions = isTextInput ? (question?.options as TextInputOptions ?? {}) : {};

  const options = useMemo(() => {
    if (!question?.options || isTextInput) return [] as { key: string; label: string }[];
    return Object.entries(question.options).map(([key, label]) => ({ key, label: String(label) }));
  }, [question?.options, isTextInput]);

  // ── Pre-computed option display props (avoid recalculating in render loop) ──
  const optionDisplayProps = useMemo(() => {
    return options.map((option) => {
      const isSelected =
        selectedOption === option.key ||
        previousAttempt?.selectedAnswer === option.key;
      const correctKey = revealedCorrectAnswer || previousAttempt?.selectedAnswer;
      const isCorrectOption = Boolean(
        (result?.isCorrect || previousAttempt?.isCorrect) &&
          correctKey &&
          normalizeText(correctKey) === normalizeText(option.key)
      );
      const wasSelectedPreviously = previousAttempt?.selectedAnswer === option.key;
      const isOptionDisabled = isClosed || hasAlreadyAttempted;

      return {
        key: option.key,
        label: option.label,
        isSelected,
        isCorrectOption,
        wasSelectedPreviously,
        isOptionDisabled,
      };
    });
  }, [
    options,
    selectedOption,
    previousAttempt?.selectedAnswer,
    previousAttempt?.isCorrect,
    revealedCorrectAnswer,
    result?.isCorrect,
    isClosed,
    hasAlreadyAttempted,
  ]);

  // ── Reanimated transition style (native thread) ──
  const transitionStyle = useAnimatedStyle(() => ({
    opacity: transitionOpacity.value,
    transform: [{ translateX: transitionTranslateX.value }],
  }));

  const handleBack = useCallback((): void => {
    triggerHaptic('light');
    router.back();
  }, []);

  // Navigate to next question after transition animation completes
  const executeTransition = useCallback(
    (nextId: string) => {
      goToNextQuestion();
      // Reset transition values before navigating so the next screen starts clean
      transitionOpacity.value = 1;
      transitionTranslateX.value = 0;
      setIsTransitioning(false);
      router.replace(`/instant-reward-answer/${nextId}` as Href);
    },
    [goToNextQuestion, transitionOpacity, transitionTranslateX]
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
      // No more questions - show session summary
      triggerHaptic('success');
      endSession();
      setShowSessionSummary(true);
    }
  }, [unansweredQuestions, transitionOpacity, transitionTranslateX, executeTransition, endSession]);

  const handleSelectOption = useCallback((optionKey: string) => {
    if (isClosed || hasAlreadyAttempted) return;
    triggerHaptic('selection');
    setSelectedOption(optionKey);
  }, [isClosed, hasAlreadyAttempted]);

  // ── Session progress (Duolingo-style X of Y tracker) ──
  const sessionProgress = useMemo(() => getSessionProgress(), [getSessionProgress]);

  const handleSubmit = useCallback((): void => {
    // Debounce guard: prevent double-tap rapid submissions (HQ Trivia / Swagbucks pattern)
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    // Release guard after 2s (safety net — also released on success/error)
    setTimeout(() => { submitGuardRef.current = false; }, 2000);

    const answer = isTextInput ? textAnswer.trim() : (selectedOption || "");

    if (!question) { submitGuardRef.current = false; return; }

    // Auth validation — checks Zustand auth state (synchronous, no race with profile fetch).
    // The server resolves userEmail from the JWT, so we only need auth presence here.
    if (!isAuthenticated) {
      triggerHaptic('warning');
      showToast({
        message: 'Please log in to submit answers and earn rewards.',
        type: 'warning',
        action: 'Login',
        onAction: () => router.push("/(auth)/login" as Href),
      });
      return;
    }

    // Warn about missing phone — but don't block submission.
    // The backend resolves phone from the user's DB profile via JWT as fallback.
    // Only warn when profile has definitively loaded (user !== undefined) with no phone.
    if (user && !userPhone) {
      showToast({
        message: 'Tip: update your profile with a phone number to receive reward payouts.',
        type: 'info',
        action: 'Update Profile',
        onAction: () => router.push('/(tabs)/profile-new' as Href),
      });
    }

    // Prevent re-attempts
    if (hasAlreadyAttempted) {
      triggerHaptic('warning');
      showToast({
        message: 'You have already attempted this question. Each question can only be attempted once.',
        type: 'warning',
      });
      return;
    }

    if (!answer) {
      triggerHaptic('warning');
      showToast({ message: isTextInput ? 'Type your answer before submitting.' : 'Select the option you think is correct.', type: 'warning' });
      return;
    }

    triggerHaptic('medium');

    // Optimistic lock: disable options immediately (Kahoot! / HQ Trivia pattern)
    // Prevents visual confusion while server round-trip is in flight
    setIsOptimisticLocked(true);

    // Offline queue: save submission for later retry if network unavailable
    if (!isOnline) {
      if (hasPendingSubmission(question.id)) {
        showToast({
          message: 'Your answer for this question is already queued for submission.',
          type: 'info',
        });
        return;
      }

      addPendingSubmission({
        questionId: question.id,
        answer,
        phoneNumber: userPhone || undefined,
      });
      showToast({
        message: 'You are offline. Your answer has been queued and will be submitted when you reconnect.',
        type: 'info',
      });
      return;
    }

    submitAnswer.mutate(
      {
        questionId: question.id,
        answer,
        phoneNumber: userPhone ?? undefined,
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

          // Show animated result overlay (batched — single re-render)
          setOverlay({ show: true, isCorrect: payload.isCorrect, earned: earnedAmount, earnedPoints: earnedPts });

          if (payload.isCorrect) {
            triggerHaptic('success');

            // Credit wallet with server-sent reward amount (single source of truth)
            confirmReward(earnedAmount);

            // Build payment status message for winners
            if (payload.isWinner) {
              const paymentStatus = payload.paymentStatus || 'PENDING';
              let paymentMessage = "";
              if (paymentStatus === "SUCCESSFUL") {
                paymentMessage = " Your reward has been credited!";
              } else if (paymentStatus === "PENDING") {
                paymentMessage = " Your reward is being processed.";
              }

              showToast({
                message: `Correct! +${formatCurrency(earnedAmount)} earned!${paymentMessage}`,
                type: 'success',
                action: unansweredQuestions.length > 0 ? 'Next Question' : 'View Summary',
                onAction: () => setTimeout(() => handleTransitionToNext(), 300),
              });
            } else {
              showToast({
                message: `Correct! +${formatCurrency(earnedAmount)} earned!`,
                type: 'success',
                action: unansweredQuestions.length > 0 ? 'Next Question' : 'View Summary',
                onAction: () => setTimeout(() => handleTransitionToNext(), 300),
              });
            }
          } else if (payload.isExpired || payload.isCompleted) {
            triggerHaptic('warning');
            showToast({
              message: payload.message || 'Rewards are no longer available.',
              type: 'warning',
              action: unansweredQuestions.length > 0 ? 'Try Another' : 'View Summary',
              onAction: () => setTimeout(() => handleTransitionToNext(), 300),
            });
          } else {
            triggerHaptic('error');
            showToast({
              message: payload.message || 'That was not correct.',
              type: 'error',
              action: unansweredQuestions.length > 0 ? 'Next Question' : 'View Summary',
              onAction: () => setTimeout(() => handleTransitionToNext(), 300),
            });
          }
        },
        onError: (error: Error & { code?: string }) => {
          triggerHaptic('error');
          submitGuardRef.current = false;
          setIsOptimisticLocked(false);
          const errorCode = error.code;
          const errorMessage = error?.message || "Unable to submit your answer. Please try again.";

          if (errorCode === 'ALREADY_ATTEMPTED') {
            // Sync local store so the question moves to "Attempted/Completed" tab
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
              message: 'You have already attempted this question.',
              type: 'warning',
              action: 'Go Back',
              onAction: () => router.back(),
            });
          } else if (errorCode === 'QUESTION_EXPIRED') {
            showToast({
              message: 'This question has expired and is no longer available.',
              type: 'info',
              action: 'Next',
              onAction: () => handleTransitionToNext(),
            });
          } else if (errorCode === 'QUESTION_COMPLETED') {
            showToast({
              message: 'All winners have been found for this question.',
              type: 'info',
              action: 'Try Another',
              onAction: () => handleTransitionToNext(),
            });
          } else {
            showToast({ message: errorMessage, type: 'error' });
          }
        },
      }
    );
  }, [question, selectedOption, textAnswer, isTextInput, isAuthenticated, userPhone, hasAlreadyAttempted, rewardAmount, rewardPoints, submitAnswer, markQuestionAttempted, confirmReward, updateSessionSummary, unansweredQuestions, handleTransitionToNext, showToast, addPendingSubmission, hasPendingSubmission, isOnline, user, recordAdQuestionAnswered]);

  // Handle redemption via real API
  // Persist idempotency key across ERROR → retry so the backend deduplicates
  const redemptionKeyRef = useRef<string | null>(null);

  const handleRedeem = useCallback(async (
    amount: number,
    type: 'CASH' | 'AIRTIME',
    provider: 'MTN' | 'AIRTEL',
    phoneNumber: string
  ): Promise<{ success: boolean; message?: string; transactionRef?: string }> => {
    const pointsNeeded = cashToPoints(amount, rewardConfig ?? undefined);
    initiateRedemption({
      points: pointsNeeded,
      cashValue: amount,
      type,
      provider,
      phoneNumber,
    });

    // Reuse key on retry; generate fresh only on first attempt
    if (!redemptionKeyRef.current) {
      redemptionKeyRef.current = `rdm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    }
    const idempotencyKey = redemptionKeyRef.current;

    try {
      const response = await rewardsApi.redeem({ pointsToRedeem: pointsNeeded, cashValue: amount, provider, phoneNumber, type, idempotencyKey });

      if (response.data?.success) {
        redemptionKeyRef.current = null; // Clear on success for next redemption
        const ref = response.data.transactionRef ?? idempotencyKey;
        completeRedemption(ref, true);
        // Re-sync wallet from server after successful payout (Robinhood pattern)
        refetchProfile();
        return {
          success: true,
          transactionRef: ref,
          message: response.data.message ?? `${formatCurrency(amount)} sent to your ${provider} number!`,
        };
      } else {
        const errorMsg = response.data?.error ?? response.error ?? 'Payment failed.';
        completeRedemption('', false, errorMsg);
        return { success: false, message: `${errorMsg} Points refunded.` };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      completeRedemption('', false, errorMsg);
      return { success: false, message: errorMsg };
    }
  }, [initiateRedemption, completeRedemption, refetchProfile, rewardConfig]);

  // ── Stable modal callbacks (avoid inline arrow fns in JSX) ──
  const handleRefresh = useCallback(async () => {
    triggerHaptic('light');
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

  // Continue after session summary: refetch fresh data, start new session
  // if open questions exist, otherwise gracefully exit (Instagram/TikTok pattern)
  const handleContinue = useCallback(async () => {
    setShowSessionSummary(false);

    // Refetch to get latest winnersCount / completion data
    const { data: freshQuestions } = await refetchAllQuestions();
    const freshOpen = (freshQuestions || []).filter(q =>
      q.isInstantReward &&
      !q.isCompleted &&
      !attemptHistory?.attemptedQuestionIds.includes(q.id) &&
      q.maxWinners - q.winnersCount > 0
    );

    if (freshOpen.length > 0) {
      // Start a fresh session with only eligible questions
      const freshIds = freshOpen.map(q => q.id);
      startSession(freshIds, 'instant');
      router.replace(`/instant-reward-answer/${freshOpen[0].id}` as Href);
    } else {
      // All spots filled — graceful fallback to list with informative toast
      showToast({
        message: 'All spots are currently filled. Check back soon for new questions!',
        type: 'info',
      });
      router.replace('/instant-reward-questions');
    }
  }, [refetchAllQuestions, attemptHistory, startSession, showToast]);

  const handleCloseSession = useCallback(() => {
    setShowSessionSummary(false);
    router.back();
  }, []);

  const handleOverlayDismiss = useCallback(() => {
    setShowResultOverlay(false);
  }, []);

  const handleCloseRedemption = useCallback(() => {
    setShowRedemptionModal(false);
    redemptionKeyRef.current = null; // Reset key when modal dismissed
    cancelRedemption();
  }, [cancelRedemption]);

  // SessionClosedModal handlers
  // Refetch fresh data before transitioning — stale cache may show questions as open
  // when all spots are actually full.
  const handleSessionClosedContinue = useCallback(async () => {
    triggerHaptic('light');
    setShowSessionClosed(false);

    // Refetch to get fresh winnersCount data before deciding next action
    const { data: freshQuestions } = await refetchAllQuestions();

    // Re-derive open questions from fresh data
    const freshOpen = (freshQuestions || []).filter(q =>
      q.id !== questionId &&
      !q.isCompleted &&
      q.isInstantReward === question?.isInstantReward &&
      !attemptHistory?.attemptedQuestionIds.includes(q.id) &&
      q.maxWinners - q.winnersCount > 0
    );

    if (freshOpen.length > 0) {
      setIsTransitioning(true);
      transitionOpacity.value = withTiming(0, { duration: 200 });
      transitionTranslateX.value = withTiming(-50, { duration: 200 }, () => {
        runOnJS(executeTransition)(freshOpen[0].id);
      });
    } else {
      // All questions truly full or answered — show session summary
      triggerHaptic('success');
      endSession();
      setShowSessionSummary(true);
    }
  }, [refetchAllQuestions, questionId, question?.isInstantReward, attemptHistory, transitionOpacity, transitionTranslateX, executeTransition, endSession]);

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

  const averageTimeSeconds = useMemo(() => {
    const { questionsAnswered, totalTimeSpentMs } = sessionSummary;
    if (questionsAnswered === 0) return 0;
    return Math.round(totalTimeSpentMs / questionsAnswered / 1000);
  }, [sessionSummary]);

  // When closed on arrival (spots full, not attempted, no result), allow
  // navigation forward instead of a dead-end disabled button.
  const isClosedOnArrival = isClosed && !hasAlreadyAttempted && !result;

  const handleFooterPress = useMemo(
    () => (result || hasAlreadyAttempted || isClosedOnArrival ? handleTransitionToNext : handleSubmit),
    [result, hasAlreadyAttempted, isClosedOnArrival, handleTransitionToNext, handleSubmit]
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}> 
        <StatusBar style={statusBarStyle} />
        <RewardQuestionSkeleton />
      </View>
    );
  }

  if (error || !question) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}> 
        <StatusBar style={statusBarStyle} />
        <AlertCircle size={ICON_SIZE['5xl']} color={colors.error} strokeWidth={1.5} style={{ marginBottom: SPACING.md }} />
        <Text style={[styles.errorText, { color: colors.error }]}>Instant reward not found</Text>
        <View style={styles.errorActions}>
          <PrimaryButton title="Retry" onPress={() => { triggerHaptic('light'); refetch(); }} />
          <PrimaryButton title="Go back" onPress={handleBack} variant="secondary" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <StatusBar style={statusBarStyle} />

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
          <ArrowLeft size={ICON_SIZE.md} color={colors.text} strokeWidth={1.5} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Instant reward</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Answer quickly. First correct wins.</Text>
        </View>

        <Pressable
          style={[styles.iconButton, { backgroundColor: colors.secondary }]}
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          accessibilityHint="Reload question data"
          hitSlop={8}
        >
          <RefreshCcw size={ICON_SIZE.md} color={isFetching ? colors.primary : colors.text} strokeWidth={1.5} />
        </Pressable>
      </View>

      {/* ── Session Progress Bar (Duolingo / Kahoot! style) ── */}
      {sessionProgress.total > 1 && (
        <View
          style={[styles.sessionProgressContainer, { borderBottomColor: colors.border }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Question progress: ${sessionProgress.total - sessionProgress.remaining} of ${sessionProgress.total} answered`}
          accessibilityValue={{
            min: 0,
            max: sessionProgress.total,
            now: sessionProgress.total - sessionProgress.remaining,
          }}
        >
          <View style={[styles.sessionProgressTrack, { backgroundColor: withAlpha(colors.border, 0.3) }]}>
            <View
              style={[
                styles.sessionProgressFill,
                {
                  width: `${Math.min((sessionProgress.total - sessionProgress.remaining) / sessionProgress.total, 1) * 100}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.sessionProgressLabel, { color: colors.textMuted }]}>
            {sessionProgress.total - sessionProgress.remaining} of {sessionProgress.total} answered
          </Text>
        </View>
      )}

      {/* ── Content (animated for transitions) ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 0}
      >
      <Animated.View style={[{ flex: 1 }, transitionStyle]}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING['2xl'] }}
          removeClippedSubviews={true}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
        <LinearGradient
          colors={[withAlpha(colors.primary, 0.14), withAlpha(colors.warning, 0.08)]}
          style={[styles.hero, { borderColor: colors.border }]}
        >
          <View style={styles.heroTop}>
            <View style={[styles.badge, { backgroundColor: withAlpha(isClosed ? colors.error : colors.success, 0.12) }]}> 
              <Zap size={ICON_SIZE.sm} color={isClosed ? colors.error : colors.success} strokeWidth={1.5} />
              <Text style={[styles.badgeText, { color: isClosed ? colors.error : colors.success }]}>{isClosed ? "Closed" : "Live"}</Text>
            </View>
            {!!question.expiryTime && (
              <CountdownTimer
                expiryTime={question.expiryTime}
                colors={colors}
                onExpired={handleTimerExpired}
              />
            )}
          </View>

          {/* 60-Second Session Timer */}
          {!hasAlreadyAttempted && !result && !isClosed && (
            <View style={styles.timerContainer}>
              <QuestionTimer
                timeLimit={60}
                onTimeExpired={() => setTimerExpired(true)}
                reset={false}
              />
            </View>
          )}

          <Text style={[styles.heroTitle, { color: colors.text }]}>{formatCurrency(rewardAmount)}</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
            Earn {rewardPoints} points per correct answer • One attempt only
          </Text>

          <View style={styles.heroStats}>
            <StatCard
              icon={<Users size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />}
              title="Spots left"
              value={spotsLeft}
              subtitle="Remaining winners"
            />
            <StatCard
              icon={<ShieldCheck size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />}
              title="Status"
              value={isClosed ? "Closed" : "Active"}
              subtitle={question.isCompleted ? "Completed" : "Live"}
            />
          </View>
        </LinearGradient>

        {/* No Spots Left Banner (full but not attempted) — always has a forward CTA */}
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
            <View style={styles.attemptedBannerContent}>
              <Text style={[styles.attemptedBannerTitle, { color: colors.error }]}>
                No Spots Left
              </Text>
              <Text style={[styles.attemptedBannerText, { color: colors.textMuted }]}>
                All {question.maxWinners} winner spots have been filled.
                {unansweredQuestions.length > 0
                  ? ' Try the next question instead!'
                  : ' Check back soon for new questions.'}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Already Attempted Warning */}
        {hasAlreadyAttempted && previousAttempt && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={[
              styles.attemptedBanner,
              {
                backgroundColor: withAlpha(previousAttempt.isCorrect ? colors.success : colors.warning, 0.12),
                borderColor: withAlpha(previousAttempt.isCorrect ? colors.success : colors.warning, 0.5),
              },
            ]}
          >
            <Lock size={ICON_SIZE.sm} color={previousAttempt.isCorrect ? colors.success : colors.warning} strokeWidth={1.5} />
            <View style={styles.attemptedBannerContent}>
              <Text style={[styles.attemptedBannerTitle, { color: previousAttempt.isCorrect ? colors.success : colors.warning }]}>
                {previousAttempt.isCorrect ? "You answered correctly!" : "Already attempted"}
              </Text>
              <Text style={[styles.attemptedBannerText, { color: colors.textMuted }]}>
                {previousAttempt.isCorrect
                  ? `You earned ${formatCurrency(previousAttempt.rewardEarned || rewardAmount)} (${previousAttempt.pointsEarned || rewardPoints} points)`
                  : "Each question can only be attempted once."}
              </Text>
            </View>
          </Animated.View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.cardHeader}>
            <View style={[styles.badge, { backgroundColor: withAlpha(colors.primary, 0.1) }]}> 
              <Sparkles size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>Instant reward</Text>
            </View>
            {!!question.createdAt && (
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                Added {new Date(question.createdAt).toLocaleDateString()}
              </Text>
            )}
          </View>

          <Text style={[styles.questionText, { color: colors.text }]}>{question.text}</Text>

          {/* Answer input — text input for text_input questions, radiogroup for MC */}
          {isTextInput ? (
            <TextAnswerInput
              value={textAnswer}
              onChangeText={setTextAnswer}
              placeholder={textInputMeta.placeholder}
              hint={textInputMeta.hint}
              maxLength={textInputMeta.maxLength}
              disabled={isClosed || hasAlreadyAttempted}
              previousAnswer={previousAttempt?.selectedAnswer}
              colors={colors}
            />
          ) : (
            <View style={styles.optionsList} accessibilityRole="radiogroup" accessibilityLabel="Answer options">
              {optionDisplayProps.map((op) => (
                <OptionItem
                  key={op.key}
                  optionKey={op.key}
                  label={op.label}
                  isSelected={op.isSelected}
                  isCorrect={op.isCorrectOption}
                  wasSelectedPreviously={op.wasSelectedPreviously}
                  isDisabled={op.isOptionDisabled}
                  onPress={handleSelectOption}
                  colors={colors}
                />
              ))}
            </View>
          )}

          {(result || previousAttempt) && (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={[
                styles.feedback,
                {
                  backgroundColor: withAlpha((result?.isCorrect || previousAttempt?.isCorrect) ? colors.success : colors.error, 0.12),
                  borderColor: withAlpha((result?.isCorrect || previousAttempt?.isCorrect) ? colors.success : colors.error, 0.5),
                },
              ]}
            >
              <View style={styles.feedbackRow}>
                <CheckCircle2 size={ICON_SIZE.sm} color={(result?.isCorrect || previousAttempt?.isCorrect) ? colors.success : colors.error} strokeWidth={1.5} />
                <Text
                  style={[
                    styles.feedbackTitle,
                    { color: (result?.isCorrect || previousAttempt?.isCorrect) ? colors.success : colors.error },
                  ]}
                >
                  {(result?.isCorrect || previousAttempt?.isCorrect)
                    ? "Correct answer"
                    : (result?.isExpired || result?.isCompleted)
                      ? "Unavailable"
                      : "Incorrect answer"}
                </Text>
              </View>
              <Text style={[styles.feedbackText, { color: colors.text }]}>
                {(result?.isCorrect || previousAttempt?.isCorrect)
                  ? `You answered correctly and earned ${formatCurrency(result?.isCorrect ? rewardAmount : (previousAttempt?.rewardEarned || rewardAmount))} (${result?.pointsAwarded ?? previousAttempt?.pointsEarned ?? rewardPoints} points)!`
                  : result && !previousAttempt
                    ? (result.message || "That was not the correct answer. Better luck next time!")
                    : "Each question can only be attempted once."}
              </Text>
              {result?.remainingSpots !== undefined && (
                <Text style={[styles.feedbackMeta, { color: colors.textMuted }]}>Remaining spots: {result.remainingSpots}</Text>
              )}
              {(result?.isCorrect || previousAttempt?.isCorrect) && (
                <Text style={[styles.feedbackReward, { color: colors.success }]}>
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

        {/* Winners — memoized, uses .map() (bounded to maxWinners) */}
        <WinnersSection winners={question.winners || []} colors={colors} cardStyle={styles.card} />

        {/* Trust & Fairness — static memo, never re-renders */}
        <TrustCard colors={colors} cardStyle={styles.card} />
      </ScrollView>
      </Animated.View>

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
        {/* Show progress indicator if more questions available */}
        {unansweredQuestions.length > 0 && !hasAlreadyAttempted && !result && (
          <View style={styles.progressIndicator}>
            <Text style={[styles.progressText, { color: colors.textMuted }]}>
              {unansweredQuestions.length} more question{unansweredQuestions.length > 1 ? 's' : ''} available
            </Text>
            <ChevronRight size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={1.5} />
          </View>
        )}

        <PrimaryButton
          title={
            hasAlreadyAttempted
              ? (unansweredQuestions.length > 0 ? "Next Question" : "View Summary")
              : result
                ? (unansweredQuestions.length > 0 ? "Next Question" : "View Summary")
                : isClosedOnArrival
                  ? (unansweredQuestions.length > 0 ? "Next Question" : "View Summary")
                  : isClosed
                    ? "Closed"
                    : "Submit Answer"
          }
          onPress={handleFooterPress}
          loading={submitAnswer.isPending || isTransitioning}
          disabled={false}
          variant={isClosedOnArrival ? "secondary" : hasAlreadyAttempted && !previousAttempt?.isCorrect ? "secondary" : "primary"}
        />
      </View>
      </KeyboardAvoidingView>

      {/* Answer Result Overlay */}
      <AnswerResultOverlay
        visible={showResultOverlay}
        isCorrect={overlayIsCorrect}
        earnedAmount={overlayEarned}
        earnedPoints={overlayEarnedPoints}
        streakCount={currentStreak}
        onDismiss={handleOverlayDismiss}
      />

      {/* Session Closed Modal - Shows when spots are full or session expires */}
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
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  heroTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  heroSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  heroStats: {
    flexDirection: "row",
    gap: SPACING.md,
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
  trustRules: {
    gap: SPACING.xs,
  },
  trustRule: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.6,
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.md,
  },
  // Session progress bar (Duolingo / Kahoot! style)
  sessionProgressContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER_WIDTH.hairline,
    gap: SPACING.xs,
  },
  sessionProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden' as const,
  },
  sessionProgressFill: {
    height: '100%' as unknown as number,
    borderRadius: 2,
  },
  sessionProgressLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center' as const,
  },
});

