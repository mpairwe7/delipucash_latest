import { PrimaryButton, StatCard } from "@/components";
import { RewardQuestionSkeleton } from "@/components/question/QuestionSkeletons";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/services/api";
import { useRewardQuestion, useSubmitRewardAnswer, useUserProfile, useRewardQuestions } from "@/services/hooks";
import { useAuth } from "@/utils/auth/useAuth";
import { useInstantRewardStore, REWARD_CONSTANTS, cashToPoints } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { RewardAnswerResult } from "@/types";
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
import {
  normalizeText,
  triggerHaptic,
} from "@/utils/quiz-utils";
import { RewardSessionSummary, RedemptionModal } from "@/components/quiz";
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
import React, { memo, useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Pure utility (stable — outside component) ──────────────────────────────

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
};

// ─── Countdown Timer (isolates per-second re-renders from parent) ────────────

interface CountdownTimerProps {
  expiryTime: string;
  colors: { warning: string };
  onExpired?: () => void;
}

const CountdownTimer = memo(function CountdownTimer({ expiryTime, colors, onExpired }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const diff = Math.max(0, Math.floor((new Date(expiryTime).getTime() - Date.now()) / 1000));
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
    <View style={[countdownStyles.timerPill, { backgroundColor: withAlpha(colors.warning, 0.12) }]}>
      <Clock3 size={ICON_SIZE.sm} color={colors.warning} strokeWidth={1.5} />
      <Text style={[countdownStyles.timerText, { color: colors.warning }]}>
        {isExpired ? "Expired" : formatTime(timeLeft)}
      </Text>
    </View>
  );
});

const countdownStyles = StyleSheet.create({
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  timerText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
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
  colors: Record<string, string>;
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

interface WinnerRowProps {
  winner: { id: string; position: number; userEmail: string; paymentStatus: string; amountAwarded: number };
  colors: Record<string, string>;
}

const WinnerRow = memo(function WinnerRow({ winner, colors }: WinnerRowProps) {
  return (
    <View style={[styles.winnerRow, { borderColor: colors.border }]}>
      <View style={styles.winnerLeft}>
        <Text style={[styles.winnerPosition, { color: colors.primary }]}>{winner.position}.</Text>
        <View style={styles.winnerInfo}>
          <Text style={[styles.winnerEmail, { color: colors.text }]} numberOfLines={1}>
            {winner.userEmail}
          </Text>
          <Text style={[styles.winnerStatus, { color: colors.textMuted }]}>{winner.paymentStatus}</Text>
        </View>
      </View>
      <Text style={[styles.winnerAmount, { color: colors.success }]}>{formatCurrency(winner.amountAwarded)}</Text>
    </View>
  );
});

// ─── Main Screen Component ───────────────────────────────────────────────────

export default function InstantRewardAnswerScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<RewardAnswerResult | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ── Auth — Zustand store (synchronous, already hydrated) ──
  const { isReady: authReady, isAuthenticated } = useAuth();

  const questionId = id || "";
  const { data: question, isLoading, error, refetch, isFetching } = useRewardQuestion(questionId);
  const { data: allQuestions } = useRewardQuestions();
  const { data: user, isLoading: isUserLoading } = useUserProfile();
  const submitAnswer = useSubmitRewardAnswer();

  // ── Zustand: state via useShallow (grouped — prevents re-renders) ──
  const { walletBalance, sessionState, sessionSummary } = useInstantRewardStore(
    useShallow((s) => ({
      walletBalance: s.walletBalance,
      sessionState: s.sessionState,
      sessionSummary: s.sessionSummary,
    }))
  );

  // ── Zustand: reactive state (triggers re-render when attemptHistory changes) ──
  const attemptHistory = useInstantRewardStore((s) => s.attemptHistory);

  // ── Zustand: actions (stable references — never cause re-renders) ──
  const initializeAttemptHistory = useInstantRewardStore((s) => s.initializeAttemptHistory);
  const markQuestionAttempted = useInstantRewardStore((s) => s.markQuestionAttempted);
  const confirmReward = useInstantRewardStore((s) => s.confirmReward);
  const startSession = useInstantRewardStore((s) => s.startSession);
  const endSession = useInstantRewardStore((s) => s.endSession);
  const goToNextQuestion = useInstantRewardStore((s) => s.goToNextQuestion);
  const updateSessionSummary = useInstantRewardStore((s) => s.updateSessionSummary);
  const initiateRedemption = useInstantRewardStore((s) => s.initiateRedemption);
  const completeRedemption = useInstantRewardStore((s) => s.completeRedemption);
  const cancelRedemption = useInstantRewardStore((s) => s.cancelRedemption);
  const canRedeem = useInstantRewardStore((s) => s.canRedeem);

  // ── Auth guard — uses Zustand store (instant) not useUserProfile (network) ──
  useEffect(() => {
    if (authReady && !isAuthenticated) {
      router.replace("/(auth)/login" as Href);
    }
  }, [authReady, isAuthenticated]);

  // Initialize attempt history for the user
  useEffect(() => {
    if (user?.email) {
      initializeAttemptHistory(user.email);
    }
  }, [user?.email, initializeAttemptHistory]);

  // Initialize session if not already started
  useEffect(() => {
    if (allQuestions && allQuestions.length > 0 && sessionState === 'IDLE') {
      const questionIds = allQuestions.map(q => q.id);
      startSession(questionIds);
    }
  }, [allQuestions, sessionState, startSession]);

  // Get unanswered questions for auto-transition (reactive via attemptHistory)
  const unansweredQuestions = useMemo(() => {
    if (!allQuestions) return [];
    return allQuestions.filter(q =>
      q.id !== questionId &&
      !q.isCompleted &&
      q.isInstantReward === question?.isInstantReward &&
      !attemptHistory?.attemptedQuestionIds.includes(q.id)
    );
  }, [allQuestions, questionId, attemptHistory, question?.isInstantReward]);

  // Check if user has already attempted this question (reactive via attemptHistory)
  const previousAttempt = useMemo(() => {
    if (!questionId || !attemptHistory) return null;
    return attemptHistory.questionAttempts[questionId] ?? null;
  }, [questionId, attemptHistory]);

  const hasAlreadyAttempted = useMemo(() => {
    return attemptHistory?.attemptedQuestionIds.includes(questionId) ?? false;
  }, [questionId, attemptHistory]);

  // Stable callback for CountdownTimer to signal expiry (no per-second parent re-render)
  const handleTimerExpired = useCallback(() => setIsExpired(true), []);

  const options = useMemo(() => {
    if (!question?.options) return [] as { key: string; label: string }[];
    return Object.entries(question.options).map(([key, label]) => ({ key, label: String(label) }));
  }, [question?.options]);

  const spotsLeft = useMemo(() => {
    if (!question) return 0;
    return Math.max(question.maxWinners - question.winnersCount, 0);
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

  const handleBack = useCallback((): void => {
    triggerHaptic('light');
    router.back();
  }, []);

  // Auto-transition to next question or show session summary
  const handleTransitionToNext = useCallback(() => {
    const nextQuestion = unansweredQuestions[0];

    if (nextQuestion) {
      // Animate transition
      setIsTransitioning(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Navigate to next question
        goToNextQuestion();
        router.replace(`/instant-reward-answer/${nextQuestion.id}`);
      });
    } else {
      // No more questions - show session summary
      triggerHaptic('success');
      endSession();
      setShowSessionSummary(true);
    }
  }, [unansweredQuestions, fadeAnim, slideAnim, goToNextQuestion, endSession]);

  const handleSelectOption = useCallback((optionKey: string) => {
    if (isClosed || hasAlreadyAttempted) return;
    triggerHaptic('selection');
    setSelectedOption(optionKey);
  }, [isClosed, hasAlreadyAttempted]);

  const handleSubmit = useCallback((): void => {
    const answer = selectedOption || "";

    if (!question) return;

    // Validate user authentication
    if (!user?.email) {
      triggerHaptic('warning');
      showToast({
        message: 'Please log in to submit answers and earn rewards.',
        type: 'warning',
        action: 'Login',
        onAction: () => router.push("/(auth)/login" as Href),
      });
      return;
    }

    // Validate phone number is available for reward payout
    if (!user?.phone) {
      triggerHaptic('warning');
      showToast({
        message: 'Please update your profile with a phone number to receive reward payouts.',
        type: 'warning',
      });
      return;
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
      showToast({ message: 'Select the option you think is correct.', type: 'warning' });
      return;
    }

    triggerHaptic('medium');

    submitAnswer.mutate(
      {
        questionId: question.id,
        answer,
        phoneNumber: user.phone,
        userEmail: user.email,
      },
      {
        onSuccess: (payload) => {
          setResult(payload);

          // Calculate reward amount: 500 shs (5 points) for correct answers
          const rewardAmount = payload.isCorrect ? REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT : 0;

          // Mark question as attempted in store (single attempt enforcement)
          markQuestionAttempted({
            questionId: question.id,
            isCorrect: payload.isCorrect,
            selectedAnswer: answer,
            rewardEarned: rewardAmount,
            isWinner: payload.isWinner || false,
            position: payload.position || null,
            paymentStatus: payload.paymentStatus || null,
          });

          // Update session summary
          updateSessionSummary(payload.isCorrect, rewardAmount);

          if (payload.isCorrect) {
            triggerHaptic('success');

            // Update wallet if reward earned
            if (payload.isCorrect) {
              confirmReward(REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT);
            }

            // Check if this is an instant reward winner
            if (payload.isWinner) {
              const _position = payload.position || 0;
              const paymentStatus = payload.paymentStatus || 'PENDING';

              let paymentMessage = "";
              if (paymentStatus === "SUCCESSFUL") {
                paymentMessage = " Your reward has been credited!";
              } else if (paymentStatus === "PENDING") {
                paymentMessage = " Your reward is being processed.";
              }

              showToast({
                message: `Correct! +${formatCurrency(REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT)} earned!${paymentMessage}`,
                type: 'success',
                action: unansweredQuestions.length > 0 ? 'Next Question' : 'View Summary',
                onAction: () => setTimeout(() => handleTransitionToNext(), 300),
              });
            } else {
              showToast({
                message: `Correct! +${formatCurrency(REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT)} earned!`,
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
        onError: (error) => {
          triggerHaptic('error');
          const errorMessage = error?.message || "Unable to submit your answer. Please try again.";

          if (errorMessage.includes("already attempted")) {
            showToast({
              message: 'You have already attempted this question.',
              type: 'warning',
              action: 'Go Back',
              onAction: () => router.back(),
            });
          } else if (errorMessage.includes("expired")) {
            showToast({
              message: 'This question has expired and is no longer available.',
              type: 'info',
              action: 'Next',
              onAction: () => handleTransitionToNext(),
            });
          } else if (errorMessage.includes("completed")) {
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
  }, [question, selectedOption, user, hasAlreadyAttempted, submitAnswer, markQuestionAttempted, confirmReward, updateSessionSummary, unansweredQuestions, handleTransitionToNext, showToast]);

  // Handle redemption
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

    // TODO: Call actual redemption API
    await new Promise(resolve => setTimeout(resolve, 2000));

    const transactionRef = `TXN-${Date.now()}`;
    completeRedemption(transactionRef, true);
    return { success: true, message: `${formatCurrency(amount)} has been sent to your ${provider} number!` };
  }, [initiateRedemption, completeRedemption]);

  // ── Stable modal callbacks (avoid inline arrow fns in JSX) ──
  const handleRefresh = useCallback(async () => {
    triggerHaptic('light');
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleRedeemCash = useCallback(() => {
    setShowSessionSummary(false);
    setShowRedemptionModal(true);
  }, []);

  const handleRedeemAirtime = useCallback(() => {
    setShowSessionSummary(false);
    setShowRedemptionModal(true);
  }, []);

  const handleContinue = useCallback(() => {
    setShowSessionSummary(false);
    router.push('/instant-reward-questions');
  }, []);

  const handleCloseSession = useCallback(() => {
    setShowSessionSummary(false);
    router.back();
  }, []);

  const handleCloseRedemption = useCallback(() => {
    setShowRedemptionModal(false);
    cancelRedemption();
  }, [cancelRedemption]);

  const handleFooterPress = useMemo(
    () => (result || hasAlreadyAttempted ? handleTransitionToNext : handleSubmit),
    [result, hasAlreadyAttempted, handleTransitionToNext, handleSubmit]
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

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING['2xl'] }}
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
            <View style={[styles.badge, { backgroundColor: withAlpha(colors.success, 0.12) }]}> 
              <Zap size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />
              <Text style={[styles.badgeText, { color: colors.success }]}>Live</Text>
            </View>
            {!!question.expiryTime && (
              <CountdownTimer
                expiryTime={question.expiryTime}
                colors={colors}
                onExpired={handleTimerExpired}
              />
            )}
          </View>

          <Text style={[styles.heroTitle, { color: colors.text }]}>{formatCurrency(REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT)}</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
            Earn {REWARD_CONSTANTS.INSTANT_REWARD_POINTS} points per correct answer • One attempt only
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

        {/* Already Attempted Warning */}
        {hasAlreadyAttempted && previousAttempt && (
          <View
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
                {previousAttempt.isCorrect ? "You answered correctly! 🎉" : "Already attempted"}
              </Text>
              <Text style={[styles.attemptedBannerText, { color: colors.textMuted }]}>
                {previousAttempt.isCorrect
                  ? `You earned ${formatCurrency(REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT)} (${REWARD_CONSTANTS.INSTANT_REWARD_POINTS} points)`
                  : "Each question can only be attempted once."}
              </Text>
            </View>
          </View>
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

          <View style={styles.optionsList}>
            {options.map((option) => {
              const isSelected = selectedOption === option.key ||
                (previousAttempt?.selectedAnswer === option.key);
              const isCorrectOption = Boolean(
                (result?.isCorrect || previousAttempt?.isCorrect) &&
                normalizeText(question.correctAnswer) === normalizeText(option.key)
              );
              const wasSelectedPreviously = previousAttempt?.selectedAnswer === option.key;
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

          {(result || previousAttempt) && (
            <View
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
                  ? `You answered correctly and earned ${formatCurrency(REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT)} (${REWARD_CONSTANTS.INSTANT_REWARD_POINTS} points)!`
                  : "This question has already been attempted. Each question can only be answered once."}
              </Text>
              {result?.remainingSpots !== undefined && (
                <Text style={[styles.feedbackMeta, { color: colors.textMuted }]}>Remaining spots: {result.remainingSpots}</Text>
              )}
              {(result?.isCorrect || previousAttempt?.isCorrect) && (
                <Text style={[styles.feedbackReward, { color: colors.success }]}>
                  +{formatCurrency(REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT)} ({REWARD_CONSTANTS.INSTANT_REWARD_POINTS} points)
                </Text>
              )}
            </View>
          )}
        </View>

        {Boolean(question.winners && question.winners.length) && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: withAlpha(colors.info, 0.12) }]}> 
                <PartyPopper size={ICON_SIZE.sm} color={colors.info} strokeWidth={1.5} />
                <Text style={[styles.badgeText, { color: colors.info }]}>Winners</Text>
              </View>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Latest payouts</Text>
            </View>

            {(question.winners || []).map((winner) => (
              <WinnerRow key={winner.id} winner={winner} colors={colors} />
            ))}
          </View>
        )}
      </ScrollView>

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
                : isClosed
                  ? "Closed"
                  : "Submit Answer"
          }
          onPress={handleFooterPress}
          loading={submitAnswer.isPending || isTransitioning}
          disabled={isClosed && !hasAlreadyAttempted && !result}
          variant={hasAlreadyAttempted && !previousAttempt?.isCorrect ? "secondary" : "primary"}
        />
      </View>

      {/* Session Summary Modal */}
      <RewardSessionSummary
        visible={showSessionSummary}
        totalQuestions={sessionSummary.totalQuestions}
        correctAnswers={sessionSummary.correctAnswers}
        incorrectAnswers={sessionSummary.incorrectAnswers}
        totalEarned={sessionSummary.totalEarned}
        sessionEarnings={sessionSummary.totalEarned}
        totalBalance={walletBalance}
        canRedeemRewards={canRedeem()}
        onRedeemCash={handleRedeemCash}
        onRedeemAirtime={handleRedeemAirtime}
        onContinue={handleContinue}
        onClose={handleCloseSession}
      />

      {/* Redemption Modal */}
      <RedemptionModal
        visible={showRedemptionModal}
        availableAmount={walletBalance}
        onClose={handleCloseRedemption}
        onRedeem={handleRedeem}
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
});
