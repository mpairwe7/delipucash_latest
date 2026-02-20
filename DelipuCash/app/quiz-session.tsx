/**
 * Quiz Session Screen - Duolingo-like "Answer Questions & Earn" Experience
 * 
 * Features:
 * - Fuzzy answer matching with Levenshtein distance
 * - Animated transitions between questions
 * - Haptic feedback on answer submission
 * - Accessibility support (VoiceOver/TalkBack)
 * - Responsive design for phone/tablet
 * - Streak system for consecutive correct answers
 * - 90-second time limit per question (configurable)
 * - Reward redemption (Cash/Airtime)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  X,
  Check,
  ChevronRight,
  Clock,
  Flame,
  Star,
  Gift,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Trophy,
  Zap,
  Phone,
  Banknote,
  Smartphone,
} from 'lucide-react-native';
import { PrimaryButton } from '@/components';
import {
  useTheme,
  ThemeColors,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  withAlpha,
} from '@/utils/theme';
import {
  triggerHaptic,
  validateAnswer,
  calculatePoints,
  getStreakBonus,
  formatTime,
  getTimerColor,
  announceForAccessibility,
  getQuestionAccessibilityLabel,
  getResultAccessibilityLabel,
} from '@/utils/quiz-utils';
import {
  useQuizQuestions,
  useUserPoints,
  useUpdatePoints,
  useRedeemReward,
  MIN_REDEMPTION_POINTS,
  pointsToCash,
  canRedeem,
  getRedemptionOptions,
} from '@/services/quizApi';
import { useRewardConfig } from '@/services/configHooks';
import useUser from '@/utils/useUser';
import { lockPortrait } from '@/hooks/useScreenOrientation';
import { formatCurrency } from '@/services';
import {
  QuizSessionState,
  QuizAnswerResult,
  QuizSessionSummary,
  RewardRedemptionType,
} from '@/types';
import { useQuizStore, selectCurrentQuestion, selectQuestionsCount } from '@/store/QuizStore';
import { useShallow } from 'zustand/react/shallow';

// ===========================================
// Constants
// ===========================================

const DEFAULT_TIME_LIMIT = 90; // seconds
const BASE_POINTS_PER_QUESTION = 10;
const QUESTIONS_PER_SESSION = 10;

// ===========================================
// Component Types
// ===========================================

interface QuizSessionScreenProps {
  onClose?: () => void;
  category?: string;
  questionsLimit?: number;
}

// ===========================================
// Sub-Components
// ===========================================

interface CircularTimerProps {
  timeRemaining: number;
  totalTime: number;
  colors: ThemeColors;
  size?: number;
}

const CircularTimer: React.FC<CircularTimerProps> = ({ 
  timeRemaining, 
  totalTime, 
  colors,
  size = 60,
}) => {
  const percentage = (timeRemaining / totalTime) * 100;
  const timerColor = getTimerColor(timeRemaining, totalTime, {
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  });

  return (
    <View style={[styles.timerContainer, { width: size, height: size }]}>
      <View 
        style={[
          styles.timerCircle, 
          { 
            width: size, 
            height: size,
            borderColor: withAlpha(timerColor, 0.2),
          }
        ]} 
      />
      <View 
        style={[
          styles.timerProgress, 
          { 
            width: size, 
            height: size,
            borderColor: timerColor,
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
            transform: [{ rotate: `${(percentage / 100) * 360}deg` }],
          }
        ]} 
      />
      <View style={styles.timerInner}>
        <Clock size={14} color={timerColor} strokeWidth={2} />
        <Text style={[styles.timerText, { color: timerColor }]}>
          {formatTime(timeRemaining)}
        </Text>
      </View>
    </View>
  );
};

interface OptionButtonProps {
  option: string;
  label: string;
  isSelected: boolean;
  isCorrect?: boolean;
  isRevealed: boolean;
  onPress: () => void;
  colors: ThemeColors;
  disabled?: boolean;
}

const OptionButton: React.FC<OptionButtonProps> = ({
  option,
  label,
  isSelected,
  isCorrect,
  isRevealed,
  onPress,
  colors,
  disabled,
}) => {
  const getBackgroundColor = (): string => {
    if (isRevealed) {
      if (isCorrect) return withAlpha(colors.success, 0.15);
      if (isSelected && !isCorrect) return withAlpha(colors.error, 0.15);
    }
    if (isSelected) return withAlpha(colors.primary, 0.15);
    return colors.card;
  };

  const getBorderColor = (): string => {
    if (isRevealed) {
      if (isCorrect) return colors.success;
      if (isSelected && !isCorrect) return colors.error;
    }
    if (isSelected) return colors.primary;
    return colors.border;
  };

  const getIcon = () => {
    if (!isRevealed) {
      if (isSelected) return <Check size={18} color={colors.primary} strokeWidth={2} />;
      return null;
    }
    if (isCorrect) return <CheckCircle2 size={18} color={colors.success} strokeWidth={2} />;
    if (isSelected && !isCorrect) return <XCircle size={18} color={colors.error} strokeWidth={2} />;
    return null;
  };

  return (
    <TouchableOpacity
      style={[
        styles.optionButton,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
        },
      ]}
      onPress={onPress}
      disabled={disabled || isRevealed}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled }}
      accessibilityLabel={`${option}: ${label}${isSelected ? ', selected' : ''}`}
    >
      <View style={[styles.optionKey, { backgroundColor: getBorderColor() }]}>
        <Text style={[styles.optionKeyText, { color: colors.primaryText }]}>{option}</Text>
      </View>
      <Text style={[styles.optionLabel, { color: colors.text }]} numberOfLines={3}>
        {label}
      </Text>
      <View style={styles.optionIcon}>{getIcon()}</View>
    </TouchableOpacity>
  );
};

interface NotificationToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
  colors: ThemeColors;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  visible,
  message,
  type,
  colors,
}) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -100,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, [visible, slideAnim]);

  const backgroundColor = type === 'success' 
    ? colors.success 
    : type === 'error' 
    ? colors.error 
    : colors.info;

  const Icon = type === 'success' ? CheckCircle2 : type === 'error' ? XCircle : AlertCircle;

  return (
    <Animated.View
      style={[
        styles.toast,
        { 
          backgroundColor,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      <Icon size={20} color="#FFFFFF" strokeWidth={2} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

// ===========================================
// Main Component
// ===========================================

export default function QuizSessionScreen({
  onClose,
  category,
  questionsLimit = QUESTIONS_PER_SESSION,
}: QuizSessionScreenProps): React.ReactElement {
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // Lock to portrait — quiz layouts are designed exclusively for portrait orientation
  useEffect(() => { lockPortrait(); }, []);

  const { data: userData } = useUser();
  const userId = userData?.id || '';
  const { data: rewardConfig } = useRewardConfig();

  // Queries
  const { data: questions, isLoading, error, refetch } = useQuizQuestions(questionsLimit, category);
  const { data: userPoints } = useUserPoints(userId);
  const updatePoints = useUpdatePoints();
  const redeemRewardMutation = useRedeemReward();

  // ── QuizStore: state via useShallow (session, answers, streak, points — persisted) ──
  const {
    sessionState,
    currentIndex,
    selectedAnswer,
    textAnswer,
    timeRemaining,
    isAnswerRevealed,
    answers,
    totalPoints,
    currentStreak,
    maxStreak,
  } = useQuizStore(
    useShallow((s) => ({
      sessionState: s.sessionState,
      currentIndex: s.currentIndex,
      selectedAnswer: s.selectedAnswer,
      textAnswer: s.textAnswer,
      timeRemaining: s.timeRemaining,
      isAnswerRevealed: s.isAnswerRevealed,
      answers: s.answers,
      totalPoints: s.totalPoints,
      currentStreak: s.currentStreak,
      maxStreak: s.maxStreak,
    }))
  );

  // ── QuizStore: actions (stable references) ──
  const storeStartSession = useQuizStore((s) => s.startSession);
  const storeResetSession = useQuizStore((s) => s.resetSession);
  const storeSetSessionState = useQuizStore((s) => s.setSessionState);
  const storeSetCurrentIndex = useQuizStore((s) => s.setCurrentIndex);
  const storeSetSelectedAnswer = useQuizStore((s) => s.setSelectedAnswer);
  const storeSetTextAnswer = useQuizStore((s) => s.setTextAnswer);
  const storeSetTimeRemaining = useQuizStore((s) => s.setTimeRemaining);
  const storeRevealAnswer = useQuizStore((s) => s.revealAnswer);
  const storeSubmitAnswer = useQuizStore((s) => s.submitAnswer);
  const storeGoToNextQuestion = useQuizStore((s) => s.goToNextQuestion);
  const storeStartTimer = useQuizStore((s) => s.startTimer);
  const storeStopTimer = useQuizStore((s) => s.stopTimer);
  const storeSetTransitioning = useQuizStore((s) => s.setTransitioning);

  // Toast (component-local — not persisted)
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success'
  });

  // Redemption (component-local — UI modals)
  const [selectedRedemptionType, setSelectedRedemptionType] = useState<RewardRedemptionType>('CASH');
  const [selectedProvider, setSelectedProvider] = useState<'MTN' | 'AIRTEL'>('MTN');
  const [phoneNumber, setPhoneNumber] = useState(userData?.phone || '');
  const [selectedRedemptionAmount, setSelectedRedemptionAmount] = useState(0);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const questionStartTime = useRef(Date.now());

  // Timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Current question — from store's filtered+normalized questions (not raw TanStack Query data)
  // This ensures currentIndex aligns with the store's unattempted question list
  const currentQuestion = useQuizStore(selectCurrentQuestion);

  const totalQuestions = useQuizStore(selectQuestionsCount);

  // Options array — NormalizedQuestion.options is AnswerOption[] { id, text }
  const optionsArray = useMemo(() => {
    if (!currentQuestion?.options) return [];
    return currentQuestion.options.map((opt) => ({
      key: opt.id,
      value: opt.text,
    }));
  }, [currentQuestion]);

  // ===========================================
  // Effects
  // ===========================================

  // Initialize session when questions load — uses store's startSession
  useEffect(() => {
    if (questions && questions.length > 0 && sessionState === 'LOADING') {
      storeStartSession(questions, userId, userPoints?.totalPoints || 0);
      questionStartTime.current = Date.now();
      announceForAccessibility(
        getQuestionAccessibilityLabel(1, questions.length, questions[0].text)
      );
    }
  }, [questions, sessionState, userId, userPoints, storeStartSession]);

  // Timer tick effect
  useEffect(() => {
    if (sessionState !== 'DISPLAYING_QUESTION' && sessionState !== 'ANSWER_SELECTED') {
      return;
    }

    timerRef.current = setInterval(() => {
      const store = useQuizStore.getState();
      if (store.timeRemaining <= 1) {
        storeSetTimeRemaining(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        storeSetTimeRemaining(store.timeRemaining - 1);
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentIndex, sessionState]);

  // Handle time up separately
  useEffect(() => {
    if (timeRemaining === 0 && (sessionState === 'DISPLAYING_QUESTION' || sessionState === 'ANSWER_SELECTED')) {
      triggerHaptic('warning');
      setToast({ visible: true, message: "Time's up!", type: 'error' });
      setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 2500);
      // Force check answer as timeout
      storeRevealAnswer();
    }
  }, [timeRemaining, sessionState]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // ===========================================
  // Timer Functions
  // ===========================================

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    storeStopTimer();
  }, [storeStopTimer]);

  // ===========================================
  // Toast
  // ===========================================

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 2500);
  };

  // ===========================================
  // Answer Handling
  // ===========================================

  const handleSelectAnswer = (answer: string) => {
    if (isAnswerRevealed) return;

    triggerHaptic('selection');
    storeSetSelectedAnswer(answer);
  };

  const handleCheckAnswer = useCallback((isTimeout: boolean = false) => {
    if (!currentQuestion) return;

    stopTimer();

    const userAnswer = currentQuestion.type === 'text' ? textAnswer : selectedAnswer || '';
    const timeTaken = Math.round((Date.now() - questionStartTime.current) / 1000);

    const validationResult = validateAnswer(
      userAnswer,
      currentQuestion.correctAnswers,
      currentQuestion.type,
      80 // fuzzy threshold - allows minor typos
    );

    const { isCorrect, feedback, similarity = 0 } = validationResult;

    // Calculate points with time bonus
    const timeBonus = isTimeout ? 0 : ((timeRemaining / (currentQuestion.timeLimit || DEFAULT_TIME_LIMIT)) * 100);
    const pointsEarned = isCorrect ? calculatePoints(
      currentQuestion.pointValue || BASE_POINTS_PER_QUESTION,
      currentStreak,
      timeBonus
    ) : 0;
    const streakBonus = getStreakBonus(isCorrect ? currentStreak + 1 : 0);

    // Submit answer to store (handles streak, points, attempt history, answer recording)
    const result: QuizAnswerResult = {
      questionId: currentQuestion.id,
      userAnswer,
      correctAnswer: currentQuestion.correctAnswers,
      isCorrect,
      pointsEarned: pointsEarned + streakBonus,
      timeTaken,
      feedback,
    };
    storeSubmitAnswer(result);

    // Haptic and accessibility feedback
    if (isCorrect) {
      triggerHaptic('success');
      const totalPointsWithBonus = pointsEarned + streakBonus;
      const encouragement = similarity === 100 ? 'Perfect!' : 'Great!';
      showToast(`${encouragement} +${totalPointsWithBonus} points!`, 'success');
    } else {
      triggerHaptic('error');
      const closeMessage = similarity >= 70 ? 'So close!' : 'Keep trying!';
      showToast(closeMessage, 'error');
    }

    const newStreak = isCorrect ? currentStreak + 1 : 0;
    announceForAccessibility(getResultAccessibilityLabel(isCorrect, pointsEarned, newStreak));
  }, [currentQuestion, selectedAnswer, textAnswer, timeRemaining, currentStreak, stopTimer, storeSubmitAnswer]);

  const handleNextQuestion = useCallback(() => {
    if (currentIndex >= totalQuestions - 1) {
      // Last question — store handles summary + session completion
      stopTimer();
      storeGoToNextQuestion(); // triggers SESSION_SUMMARY when at last question

      // Update points in database
      if (userId && totalPoints > 0) {
        updatePoints.mutate({
          userId,
          pointsToAdd: totalPoints,
          sessionId: `session_${Date.now()}`,
        });
      }
      return;
    }

    questionStartTime.current = Date.now();

    // Animate transition
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Store handles index increment, answer reset, timer reset, transition flag
      storeGoToNextQuestion();
      // Reset transition after animation
      storeSetTransitioning(false);

      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      // Announce new question
      const store = useQuizStore.getState();
      const nextQ = store.questions[store.currentIndex];
      if (nextQ) {
        announceForAccessibility(
          getQuestionAccessibilityLabel(
            store.currentIndex + 1,
            store.questions.length,
            nextQ.text
          )
        );
      }
    });
  }, [currentIndex, totalQuestions, totalPoints, userId, fadeAnim, slideAnim, stopTimer, updatePoints, storeGoToNextQuestion, storeSetTransitioning]);

  // ===========================================
  // Close Handling
  // ===========================================

  const handleClose = () => {
    if (sessionState === 'DISPLAYING_QUESTION' || sessionState === 'ANSWER_SELECTED') {
      Alert.alert(
        'End Session?',
        'Your progress will be lost. Are you sure you want to quit?',
        [
          { text: 'Continue', style: 'cancel' },
          { 
            text: 'Quit', 
            style: 'destructive',
            onPress: () => {
              stopTimer();
              if (onClose) {
                onClose();
              } else {
                router.back();
              }
            },
          },
        ]
      );
    } else {
      if (onClose) {
        onClose();
      } else {
        router.back();
      }
    }
  };

  // ===========================================
  // Redemption Handling
  // ===========================================

  const handleRedeemReward = async () => {
    // Validate inputs
    if (!userId || selectedRedemptionAmount <= 0) {
      showToast('Please select a valid amount', 'error');
      return;
    }

    if (!phoneNumber || phoneNumber.length < 10) {
      showToast('Please enter a valid phone number', 'error');
      return;
    }

    // Check if already processing to prevent double clicks
    if (isRedeeming || redeemRewardMutation.isPending) {
      return;
    }

    // Calculate available points (including session earnings)
    const availablePoints = (userPoints?.availablePoints || 0) + sessionSummary.totalEarned;
    if (selectedRedemptionAmount > availablePoints) {
      showToast('Insufficient points for this redemption', 'error');
      return;
    }

    try {
      setIsRedeeming(true);
      triggerHaptic('medium');

      // Use redeemRewardMutation which handles payment + point deduction atomically
      const result = await redeemRewardMutation.mutateAsync({
        userId,
        points: selectedRedemptionAmount,
        redemptionType: selectedRedemptionType,
        phoneNumber,
        provider: selectedProvider,
      });

      if (result.success) {
        // Update store points to reflect deduction
        useQuizStore.getState().deductPoints(result.pointsDeducted);
        
        showToast(
          `Success! ${result.amountRedeemed.toLocaleString()} UGX sent to your ${selectedProvider} number`,
          'success'
        );
        triggerHaptic('success');

        // Reset redemption selection
        setSelectedRedemptionAmount(0);
      } else {
        showToast(result.message || 'Payment failed. Please try again.', 'error');
        triggerHaptic('error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process reward';
      showToast(errorMessage, 'error');
      triggerHaptic('error');
    } finally {
      setIsRedeeming(false);
    }
  };

  // ===========================================
  // Session Summary
  // ===========================================

  const sessionSummary = useMemo((): QuizSessionSummary => {
    const correctAnswers = answers.filter((a) => a.isCorrect).length;
    const incorrectAnswers = answers.length - correctAnswers;
    const totalPointsEarned = answers.reduce((sum, a) => sum + a.pointsEarned, 0);
    const avgTime = answers.length > 0 
      ? answers.reduce((sum, a) => sum + a.timeTaken, 0) / answers.length 
      : 0;
    const bonusPoints = getStreakBonus(maxStreak);

    return {
      sessionId: `session_${Date.now()}`,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      totalPoints: totalPointsEarned,
      pointsEarned: totalPointsEarned,
      accuracy: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
      averageTime: Math.round(avgTime),
      maxStreak,
      bonusPoints,
      totalEarned: totalPointsEarned + bonusPoints,
    };
  }, [answers, maxStreak, totalQuestions]);

  // ===========================================
  // Render Loading
  // ===========================================

  if (isLoading || sessionState === 'LOADING') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading questions...
          </Text>
        </View>
      </View>
    );
  }

  // ===========================================
  // Render Error
  // ===========================================

  if (error || !questions || questions.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={colors.error} strokeWidth={1.5} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            No Questions Available
          </Text>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>
            We could not load any questions. Please try again later.
          </Text>
          <PrimaryButton 
            title="Go Back" 
            onPress={handleClose}
            variant="secondary"
            style={{ marginTop: SPACING.lg }}
          />
        </View>
      </View>
    );
  }

  // ===========================================
  // Render Session Summary
  // ===========================================

  if (sessionState === 'SESSION_SUMMARY' || sessionState === 'REWARDS_SELECTION') {
    const availablePoints = (userPoints?.availablePoints || 0) + sessionSummary.totalEarned;
    const redemptionOptions = getRedemptionOptions(availablePoints, rewardConfig);

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
          <TouchableOpacity 
            style={[styles.closeButton, { backgroundColor: colors.secondary }]}
            onPress={handleClose}
          >
            <X size={20} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Session Complete!</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView 
          style={styles.scrollContent}
          contentContainerStyle={[
            styles.summaryContainer,
            { paddingBottom: insets.bottom + SPACING.xl },
          ]}
        >
          {/* Trophy */}
          <View style={[styles.trophyContainer, { backgroundColor: withAlpha(colors.warning, 0.15) }]}>
            <Trophy size={64} color={colors.warning} strokeWidth={1.5} />
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <CheckCircle2 size={24} color={colors.success} strokeWidth={1.5} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {sessionSummary.correctAnswers}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Correct</Text>
            </View>
            
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Star size={24} color={colors.warning} strokeWidth={1.5} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {sessionSummary.totalEarned}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Points</Text>
            </View>
            
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Flame size={24} color={colors.error} strokeWidth={1.5} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {sessionSummary.maxStreak}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Max Streak</Text>
            </View>
            
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Zap size={24} color={colors.info} strokeWidth={1.5} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {sessionSummary.accuracy}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Accuracy</Text>
            </View>
          </View>

          {/* Points Summary */}
          <View style={[styles.pointsSummary, { backgroundColor: colors.card }]}>
            <View style={styles.pointsRow}>
              <Text style={[styles.pointsLabel, { color: colors.textMuted }]}>
                Questions Answered
              </Text>
              <Text style={[styles.pointsValue, { color: colors.text }]}>
                +{sessionSummary.pointsEarned} pts
              </Text>
            </View>
            <View style={styles.pointsRow}>
              <Text style={[styles.pointsLabel, { color: colors.textMuted }]}>
                Streak Bonus
              </Text>
              <Text style={[styles.pointsValue, { color: colors.success }]}>
                +{sessionSummary.bonusPoints} pts
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.pointsRow}>
              <Text style={[styles.pointsLabelBold, { color: colors.text }]}>
                Total Earned
              </Text>
              <Text style={[styles.pointsValueBold, { color: colors.primary }]}>
                {sessionSummary.totalEarned} pts
              </Text>
            </View>
            <View style={styles.pointsRow}>
              <Text style={[styles.pointsLabel, { color: colors.textMuted }]}>
                Available Balance
              </Text>
              <Text style={[styles.pointsValue, { color: colors.text }]}>
                {availablePoints} pts ≈ {formatCurrency(pointsToCash(availablePoints, rewardConfig))}
              </Text>
            </View>
          </View>

          {/* Redemption Section */}
          {canRedeem(availablePoints, rewardConfig) && (
            <View style={[styles.redemptionCard, { backgroundColor: colors.card }]}>
              <View style={styles.redemptionHeader}>
                <Gift size={24} color={colors.primary} strokeWidth={1.5} />
                <Text style={[styles.redemptionTitle, { color: colors.text }]}>
                  Redeem Your Rewards
                </Text>
              </View>
              <Text style={[styles.redemptionSubtitle, { color: colors.textMuted }]}>
                Minimum {MIN_REDEMPTION_POINTS} points required
              </Text>

              {/* Redemption Type Selection */}
              <View style={styles.redemptionTypes}>
                <TouchableOpacity
                  style={[
                    styles.redemptionTypeButton,
                    selectedRedemptionType === 'CASH' && styles.redemptionTypeActive,
                    { 
                      borderColor: selectedRedemptionType === 'CASH' ? colors.primary : colors.border,
                      backgroundColor: selectedRedemptionType === 'CASH' 
                        ? withAlpha(colors.primary, 0.1) 
                        : colors.background,
                    },
                  ]}
                  onPress={() => setSelectedRedemptionType('CASH')}
                >
                  <Banknote size={20} color={selectedRedemptionType === 'CASH' ? colors.primary : colors.text} />
                  <Text style={[
                    styles.redemptionTypeText,
                    { color: selectedRedemptionType === 'CASH' ? colors.primary : colors.text },
                  ]}>
                    Cash
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.redemptionTypeButton,
                    selectedRedemptionType === 'AIRTIME' && styles.redemptionTypeActive,
                    { 
                      borderColor: selectedRedemptionType === 'AIRTIME' ? colors.primary : colors.border,
                      backgroundColor: selectedRedemptionType === 'AIRTIME' 
                        ? withAlpha(colors.primary, 0.1) 
                        : colors.background,
                    },
                  ]}
                  onPress={() => setSelectedRedemptionType('AIRTIME')}
                >
                  <Smartphone size={20} color={selectedRedemptionType === 'AIRTIME' ? colors.primary : colors.text} />
                  <Text style={[
                    styles.redemptionTypeText,
                    { color: selectedRedemptionType === 'AIRTIME' ? colors.primary : colors.text },
                  ]}>
                    Airtime
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount Options */}
              <View style={styles.amountOptions}>
                {redemptionOptions.map((option) => (
                  <TouchableOpacity
                    key={option.points}
                    style={[
                      styles.amountOption,
                      selectedRedemptionAmount === option.points && styles.amountOptionActive,
                      { 
                        borderColor: selectedRedemptionAmount === option.points 
                          ? colors.primary 
                          : colors.border,
                        backgroundColor: selectedRedemptionAmount === option.points 
                          ? withAlpha(colors.primary, 0.1) 
                          : colors.background,
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setSelectedRedemptionAmount(option.points);
                    }}
                  >
                    <Text style={[
                      styles.amountOptionPoints,
                      { color: selectedRedemptionAmount === option.points ? colors.primary : colors.text },
                    ]}>
                      {option.points} pts
                    </Text>
                    <Text style={[styles.amountOptionCash, { color: colors.textMuted }]}>
                      {formatCurrency(option.cashValue)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Provider Selection */}
              <View style={styles.providerSelection}>
                <TouchableOpacity
                  style={[
                    styles.providerButton,
                    selectedProvider === 'MTN' && { backgroundColor: '#FFCC00' },
                  ]}
                  onPress={() => setSelectedProvider('MTN')}
                >
                  <Text style={[
                    styles.providerText,
                    { color: selectedProvider === 'MTN' ? '#000' : colors.text },
                  ]}>
                    MTN
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.providerButton,
                    selectedProvider === 'AIRTEL' && { backgroundColor: '#FF0000' },
                  ]}
                  onPress={() => setSelectedProvider('AIRTEL')}
                >
                  <Text style={[
                    styles.providerText,
                    { color: selectedProvider === 'AIRTEL' ? '#FFF' : colors.text },
                  ]}>
                    Airtel
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Phone Input */}
              <View style={[styles.phoneInput, { borderColor: colors.border }]}>
                <Phone size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.phoneInputText, { color: colors.text }]}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textMuted}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>

              <PrimaryButton
                title={`Redeem ${selectedRedemptionAmount > 0 ? formatCurrency(pointsToCash(selectedRedemptionAmount)) : ''}`}
                onPress={handleRedeemReward}
                disabled={selectedRedemptionAmount === 0 || !phoneNumber || isRedeeming}
                loading={isRedeeming}
                style={{ marginTop: SPACING.md }}
              />
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <PrimaryButton
              title="Play Again"
              onPress={() => {
                storeResetSession();
                refetch();
              }}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Done"
              variant="secondary"
              onPress={handleClose}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>

        <NotificationToast {...toast} colors={colors} />
      </View>
    );
  }

  // ===========================================
  // Render Question
  // ===========================================

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <TouchableOpacity 
          style={[styles.closeButton, { backgroundColor: colors.secondary }]}
          onPress={handleClose}
          accessibilityLabel="Close quiz"
          accessibilityRole="button"
        >
          <X size={20} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        
        {/* Progress Bar */}
        <View style={[styles.progressContainer, { backgroundColor: colors.secondary }]}>
          <View 
            style={[
              styles.progressBar, 
              { 
                backgroundColor: colors.primary,
                width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
              },
            ]} 
          />
        </View>

        <Text style={[styles.progressText, { color: colors.textMuted }]}>
          {currentIndex + 1}/{totalQuestions}
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <CircularTimer
          timeRemaining={timeRemaining}
          totalTime={currentQuestion?.timeLimit || DEFAULT_TIME_LIMIT}
          colors={colors}
        />
        
        <View style={[styles.streakBadge, { backgroundColor: withAlpha(colors.error, 0.15) }]}>
          <Flame size={18} color={colors.error} strokeWidth={2} />
          <Text style={[styles.streakText, { color: colors.error }]}>{currentStreak}</Text>
        </View>
        
        <View style={[styles.pointsBadge, { backgroundColor: withAlpha(colors.warning, 0.15) }]}>
          <Star size={18} color={colors.warning} strokeWidth={2} />
          <Text style={[styles.pointsText, { color: colors.warning }]}>{totalPoints}</Text>
        </View>
      </View>

      {/* Question */}
      <Animated.View 
        style={[
          styles.questionContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <ScrollView 
          style={styles.scrollContent}
          contentContainerStyle={[
            styles.questionContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Question Text */}
          <View style={[styles.questionCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.questionNumber, { color: colors.textMuted }]}>
              Question {currentIndex + 1}
            </Text>
            <Text 
              style={[styles.questionText, { color: colors.text }]}
              accessibilityRole="text"
            >
              {currentQuestion?.text}
            </Text>
          </View>

          {/* Options */}
          {currentQuestion?.type !== 'text' ? (
            <View style={styles.optionsContainer}>
              {optionsArray.map((option) => (
                <OptionButton
                  key={option.key}
                  option={option.key}
                  label={option.value}
                  isSelected={selectedAnswer === option.key}
                  isCorrect={isAnswerRevealed && (currentQuestion?.correctAnswers.includes(option.key) ?? false)}
                  isRevealed={isAnswerRevealed}
                  onPress={() => handleSelectAnswer(option.key)}
                  colors={colors}
                  disabled={isAnswerRevealed}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.textInputContainer, { borderColor: colors.border }]}>
              <TextInput
                style={[styles.textAnswerInput, { color: colors.text }]}
                placeholder="Type your answer..."
                placeholderTextColor={colors.textMuted}
                value={textAnswer}
                onChangeText={(text) => {
                  storeSetTextAnswer(text);
                }}
                editable={!isAnswerRevealed}
                multiline
              />
            </View>
          )}

          {/* Explanation (after answering) */}
          {isAnswerRevealed && currentQuestion?.explanation && (
            <View style={[styles.explanationCard, { backgroundColor: withAlpha(colors.info, 0.1) }]}>
              <AlertCircle size={18} color={colors.info} strokeWidth={1.5} />
              <Text style={[styles.explanationText, { color: colors.text }]}>
                {currentQuestion.explanation}
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        {!isAnswerRevealed ? (
          <PrimaryButton
            title="Check Answer"
            onPress={() => handleCheckAnswer()}
            disabled={sessionState !== 'ANSWER_SELECTED'}
            leftIcon={<Check size={18} color={colors.primaryText} strokeWidth={2} />}
          />
        ) : (
          <PrimaryButton
            title={currentIndex >= totalQuestions - 1 ? 'Finish Quiz' : 'Next Question'}
            onPress={handleNextQuestion}
            rightIcon={<ChevronRight size={18} color={colors.primaryText} strokeWidth={2} />}
          />
        )}
      </View>

      {/* Toast */}
      <NotificationToast {...toast} colors={colors} />
    </View>
  );
}

// ===========================================
// Styles
// ===========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  errorTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    marginTop: SPACING.md,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: 'center',
  },
  progressContainer: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    minWidth: 40,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.lg,
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCircle: {
    position: 'absolute',
    borderRadius: 30,
    borderWidth: 3,
  },
  timerProgress: {
    position: 'absolute',
    borderRadius: 30,
    borderWidth: 3,
  },
  timerInner: {
    alignItems: 'center',
    gap: 2,
  },
  timerText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  streakText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  pointsText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  questionContainer: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  questionContent: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  questionCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  questionNumber: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    lineHeight: TYPOGRAPHY.fontSize.lg * 1.4,
  },
  optionsContainer: {
    gap: SPACING.md,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.base,
    gap: SPACING.md,
  },
  optionKey: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionKeyText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  optionLabel: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  optionIcon: {
    width: 24,
    alignItems: 'center',
  },
  textInputContainer: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    minHeight: 120,
  },
  textAnswerInput: {
    flex: 1,
    padding: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlignVertical: 'top',
  },
  explanationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  explanationText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },
  footer: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
  },
  toast: {
    position: 'absolute',
    top: 100,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  toastText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#FFFFFF',
  },
  summaryContainer: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  trophyContainer: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.xs,
  },
  statValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  statLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  pointsSummary: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  pointsValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  pointsLabelBold: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  pointsValueBold: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  divider: {
    height: 1,
    marginVertical: SPACING.sm,
  },
  redemptionCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  redemptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  redemptionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  redemptionSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  redemptionTypes: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  redemptionTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
  },
  redemptionTypeActive: {},
  redemptionTypeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  amountOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  amountOption: {
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
  },
  amountOptionActive: {},
  amountOptionPoints: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  amountOptionCash: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  providerSelection: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  providerButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    borderColor: 'transparent',
  },
  providerText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  phoneInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  phoneInputText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    paddingVertical: SPACING.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
});
