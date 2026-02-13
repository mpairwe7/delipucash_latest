/**
 * Quiz Store - Zustand State Management
 * 
 * Architecture:
 * - Zustand: Client-side UI state (session state, progress, animations)
 * - TanStack Query: Server state (questions fetching, points sync)
 * 
 * Industry Standards:
 * - Separation of concerns (UI state vs server state)
 * - Type-safe actions and selectors
 * - Persist session progress for recovery
 * - Immutable state updates
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QuizSessionState,
  QuizQuestion,
  QuizAnswerResult,
  QuizSessionSummary,
  RewardRedemptionType,
} from '@/types';

// ===========================================
// Types
// ===========================================

export type AnswerType = 'single_choice' | 'multiple_choice' | 'boolean' | 'text' | 'checkbox';

export interface AnswerOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface NormalizedQuestion {
  id: string;
  text: string;
  type: AnswerType;
  options: AnswerOption[];
  correctAnswers: string[]; // Array to support multiple correct answers
  explanation?: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  pointValue: number;
  timeLimit: number;
}

export interface QuizSessionProgress {
  sessionId: string;
  userId: string;
  startedAt: string;
  currentIndex: number;
  answers: QuizAnswerResult[];
  totalPoints: number;
  currentStreak: number;
  maxStreak: number;
  isCompleted: boolean;
}

/**
 * Track attempted questions to prevent re-attempts
 */
export interface AttemptedQuestion {
  questionId: string;
  attemptedAt: string;
  isCorrect: boolean;
  pointsEarned: number;
}

export interface QuizAttemptHistory {
  userId: string;
  attemptedQuestionIds: string[];
  attemptedQuestions: AttemptedQuestion[];
  completedSessions: string[];
  lastAttemptAt: string | null;
  totalAttemptsCount: number;
}

export interface QuizUIState {
  // Session State
  sessionState: QuizSessionState;
  sessionId: string | null;
  
  // Questions
  questions: NormalizedQuestion[];
  currentIndex: number;
  
  // User Answer State
  selectedAnswer: string | null;
  selectedAnswers: string[]; // For checkbox/multi-select
  textAnswer: string;
  isAnswerRevealed: boolean;
  lastAnswerResult: QuizAnswerResult | null;
  
  // Progress
  answers: QuizAnswerResult[];
  totalPoints: number;
  currentStreak: number;
  maxStreak: number;
  
  // Timer
  timeRemaining: number;
  isTimerActive: boolean;
  
  // User Points (cached from server)
  initialUserPoints: number;
  currentUserPoints: number;
  
  // Session Summary
  showSessionSummary: boolean;
  sessionSummary: QuizSessionSummary | null;
  
  // Redemption
  showRedemptionModal: boolean;
  selectedRedemptionType: RewardRedemptionType | null;
  selectedProvider: 'MTN' | 'AIRTEL' | null;
  redemptionAmount: number;
  
  // Loading/Error States
  isSubmitting: boolean;
  error: string | null;
  
  // Animation States
  isTransitioning: boolean;
  slideDirection: 'left' | 'right' | null;
  
  // Attempt History - Prevent repeated quiz attempts
  attemptHistory: QuizAttemptHistory | null;
}

export interface QuizUIActions {
  // Session Management
  startSession: (questions: QuizQuestion[], userId: string, initialPoints: number) => void;
  resetSession: () => void;
  endSession: () => void;
  
  // Question Navigation
  setCurrentIndex: (index: number) => void;
  goToNextQuestion: () => void;
  goToPreviousQuestion: () => void;
  
  // Answer Handling
  setSelectedAnswer: (answer: string | null) => void;
  toggleSelectedAnswer: (answer: string) => void; // For checkbox
  setTextAnswer: (text: string) => void;
  clearAnswerSelection: () => void;
  
  // Answer Validation
  revealAnswer: () => void;
  submitAnswer: (result: QuizAnswerResult) => void;
  
  // Timer
  setTimeRemaining: (seconds: number) => void;
  decrementTimer: () => void;
  startTimer: () => void;
  stopTimer: () => void;
  
  // Points
  addPoints: (points: number) => void;
  deductPoints: (points: number) => void;
  updateUserPoints: (points: number) => void;
  
  // Streak
  incrementStreak: () => void;
  resetStreak: () => void;
  
  // Session State
  setSessionState: (state: QuizSessionState) => void;
  
  // Session Summary
  showSummary: () => void;
  hideSummary: () => void;
  calculateSummary: () => QuizSessionSummary;
  
  // Redemption
  openRedemptionModal: (type: RewardRedemptionType) => void;
  closeRedemptionModal: () => void;
  setRedemptionProvider: (provider: 'MTN' | 'AIRTEL') => void;
  setRedemptionAmount: (amount: number) => void;
  
  // Loading/Error
  setSubmitting: (isSubmitting: boolean) => void;
  setError: (error: string | null) => void;
  
  // Animation
  setTransitioning: (isTransitioning: boolean, direction?: 'left' | 'right') => void;
  
  // Attempt History - Prevent repeated quiz attempts
  initializeAttemptHistory: (userId: string) => void;
  hasAttemptedQuestion: (questionId: string) => boolean;
  hasCompletedQuizSession: () => boolean;
  markQuestionAttempted: (questionId: string, isCorrect: boolean, pointsEarned: number) => void;
  markSessionCompleted: (sessionId: string) => void;
  getUnattemptedQuestions: (questions: QuizQuestion[]) => QuizQuestion[];
  clearAttemptHistory: () => void;
}

// ===========================================
// Initial State
// ===========================================

const initialState: QuizUIState = {
  sessionState: 'LOADING',
  sessionId: null,
  
  questions: [],
  currentIndex: 0,
  
  selectedAnswer: null,
  selectedAnswers: [],
  textAnswer: '',
  isAnswerRevealed: false,
  lastAnswerResult: null,
  
  answers: [],
  totalPoints: 0,
  currentStreak: 0,
  maxStreak: 0,
  
  timeRemaining: 90,
  isTimerActive: false,
  
  initialUserPoints: 0,
  currentUserPoints: 0,
  
  showSessionSummary: false,
  sessionSummary: null,
  
  showRedemptionModal: false,
  selectedRedemptionType: null,
  selectedProvider: null,
  redemptionAmount: 0,
  
  isSubmitting: false,
  error: null,
  
  isTransitioning: false,
  slideDirection: null,
  
  // Attempt history for preventing re-attempts
  attemptHistory: null,
};

// ===========================================
// Store
// ===========================================

export const useQuizStore = create<QuizUIState & QuizUIActions>()(
  devtools(
  persist(
    (set, get) => ({
      ...initialState,

      // ========================================
      // Session Management
      // ========================================
      
      startSession: (questions, userId, initialPoints) => {
        const state = get();
        
        // Initialize attempt history for user if not already done
        if (!state.attemptHistory || state.attemptHistory.userId !== userId) {
          state.initializeAttemptHistory(userId);
        }
        
        // Filter out already attempted questions
        const unattemptedQuestions = state.getUnattemptedQuestions(questions);
        
        // Check if user has any unattempted questions
        if (unattemptedQuestions.length === 0) {
          set({
            sessionState: 'COMPLETED',
            error: 'You have already attempted all available questions. New questions will be available soon!',
            questions: [],
          });
          return;
        }
        
        const normalizedQuestions = normalizeQuestions(unattemptedQuestions);
        const sessionId = `quiz_${Date.now()}_${userId}`;
        
        // Preserve attempt history when resetting session
        const currentAttemptHistory = get().attemptHistory;
        
        set({
          ...initialState,
          attemptHistory: currentAttemptHistory,
          sessionId,
          questions: normalizedQuestions,
          sessionState: 'DISPLAYING_QUESTION',
          initialUserPoints: initialPoints,
          currentUserPoints: initialPoints,
          timeRemaining: normalizedQuestions[0]?.timeLimit || 90,
          isTimerActive: true,
        });
      },

      resetSession: () => {
        // Preserve attempt history when resetting
        const currentAttemptHistory = get().attemptHistory;
        set({
          ...initialState,
          attemptHistory: currentAttemptHistory,
        });
      },

      endSession: () => {
        const state = get();
        const summary = state.calculateSummary();
        
        // Mark session as completed
        if (state.sessionId) {
          state.markSessionCompleted(state.sessionId);
        }
        
        set({
          sessionState: 'COMPLETED',
          isTimerActive: false,
          showSessionSummary: true,
          sessionSummary: summary,
        });
      },

      // ========================================
      // Question Navigation
      // ========================================

      setCurrentIndex: (index) => {
        const { questions } = get();
        if (index >= 0 && index < questions.length) {
          set({
            currentIndex: index,
            selectedAnswer: null,
            selectedAnswers: [],
            textAnswer: '',
            isAnswerRevealed: false,
            lastAnswerResult: null,
            timeRemaining: questions[index]?.timeLimit || 90,
          });
        }
      },

      goToNextQuestion: () => {
        const state = get();
        const { currentIndex, questions, calculateSummary } = state;
        
        if (currentIndex >= questions.length - 1) {
          // Last question - show summary
          const summary = calculateSummary();
          set({
            sessionState: 'SESSION_SUMMARY',
            isTimerActive: false,
            showSessionSummary: true,
            sessionSummary: summary,
          });
          return;
        }

        set({
          currentIndex: currentIndex + 1,
          selectedAnswer: null,
          selectedAnswers: [],
          textAnswer: '',
          isAnswerRevealed: false,
          lastAnswerResult: null,
          sessionState: 'DISPLAYING_QUESTION',
          timeRemaining: questions[currentIndex + 1]?.timeLimit || 90,
          isTransitioning: true,
          slideDirection: 'left',
        });
      },

      goToPreviousQuestion: () => {
        const { currentIndex } = get();

        if (currentIndex <= 0) return;

        set({
          currentIndex: currentIndex - 1,
          selectedAnswer: null,
          selectedAnswers: [],
          textAnswer: '',
          isAnswerRevealed: false,
          lastAnswerResult: null,
          isTransitioning: true,
          slideDirection: 'right',
        });
      },

      // ========================================
      // Answer Handling
      // ========================================

      setSelectedAnswer: (answer) => {
        set({ 
          selectedAnswer: answer,
          sessionState: answer ? 'ANSWER_SELECTED' : 'DISPLAYING_QUESTION',
        });
      },

      toggleSelectedAnswer: (answer) => {
        const { selectedAnswers } = get();
        const newSelected = selectedAnswers.includes(answer)
          ? selectedAnswers.filter(a => a !== answer)
          : [...selectedAnswers, answer];
        
        set({ 
          selectedAnswers: newSelected,
          sessionState: newSelected.length > 0 ? 'ANSWER_SELECTED' : 'DISPLAYING_QUESTION',
        });
      },

      setTextAnswer: (text) => {
        set({ 
          textAnswer: text,
          sessionState: text.trim() ? 'ANSWER_SELECTED' : 'DISPLAYING_QUESTION',
        });
      },

      clearAnswerSelection: () => {
        set({
          selectedAnswer: null,
          selectedAnswers: [],
          textAnswer: '',
          sessionState: 'DISPLAYING_QUESTION',
        });
      },

      // ========================================
      // Answer Validation
      // ========================================

      revealAnswer: () => {
        set({ 
          isAnswerRevealed: true,
          sessionState: 'ANSWER_VALIDATED',
          isTimerActive: false,
        });
      },

      submitAnswer: (result) => {
        const state = get();
        const { answers, currentStreak, maxStreak } = state;
        
        const newStreak = result.isCorrect ? currentStreak + 1 : 0;
        const newMaxStreak = Math.max(maxStreak, newStreak);
        
        // Mark question as attempted to prevent re-attempts
        state.markQuestionAttempted(result.questionId, result.isCorrect, result.pointsEarned);
        
        set({
          answers: [...answers, result],
          lastAnswerResult: result,
          isAnswerRevealed: true,
          sessionState: 'ANSWER_VALIDATED',
          isTimerActive: false,
          totalPoints: get().totalPoints + result.pointsEarned,
          currentStreak: newStreak,
          maxStreak: newMaxStreak,
        });
      },

      // ========================================
      // Timer
      // ========================================

      setTimeRemaining: (seconds) => {
        set({ timeRemaining: Math.max(0, seconds) });
      },

      decrementTimer: () => {
        const { timeRemaining, isTimerActive } = get();
        if (isTimerActive && timeRemaining > 0) {
          set({ timeRemaining: timeRemaining - 1 });
        }
      },

      startTimer: () => {
        set({ isTimerActive: true });
      },

      stopTimer: () => {
        set({ isTimerActive: false });
      },

      // ========================================
      // Points
      // ========================================

      addPoints: (points) => {
        set(state => ({
          totalPoints: state.totalPoints + points,
          currentUserPoints: state.currentUserPoints + points,
        }));
      },

      deductPoints: (points) => {
        set(state => ({
          totalPoints: Math.max(0, state.totalPoints - points),
          currentUserPoints: Math.max(0, state.currentUserPoints - points),
        }));
      },

      updateUserPoints: (points) => {
        set({ currentUserPoints: points });
      },

      // ========================================
      // Streak
      // ========================================

      incrementStreak: () => {
        set(state => ({
          currentStreak: state.currentStreak + 1,
          maxStreak: Math.max(state.maxStreak, state.currentStreak + 1),
        }));
      },

      resetStreak: () => {
        set({ currentStreak: 0 });
      },

      // ========================================
      // Session State
      // ========================================

      setSessionState: (sessionState) => {
        set({ sessionState });
      },

      // ========================================
      // Session Summary
      // ========================================

      showSummary: () => {
        const summary = get().calculateSummary();
        set({
          showSessionSummary: true,
          sessionSummary: summary,
          sessionState: 'SESSION_SUMMARY',
        });
      },

      hideSummary: () => {
        set({ showSessionSummary: false });
      },

      calculateSummary: () => {
        const { 
          sessionId, 
          answers, 
          questions, 
          maxStreak, 
          totalPoints,
          initialUserPoints,
        } = get();
        
        const correctAnswers = answers.filter(a => a.isCorrect).length;
        const incorrectAnswers = answers.length - correctAnswers;
        const totalQuestions = questions.length;
        const accuracy = totalQuestions > 0 
          ? Math.round((correctAnswers / totalQuestions) * 100) 
          : 0;
        
        const avgTime = answers.length > 0
          ? Math.round(answers.reduce((sum, a) => sum + a.timeTaken, 0) / answers.length)
          : 0;

        const bonusPoints = calculateStreakBonus(maxStreak);

        return {
          sessionId: sessionId || `quiz_${Date.now()}`,
          totalQuestions,
          correctAnswers,
          incorrectAnswers,
          totalPoints,
          pointsEarned: totalPoints,
          accuracy,
          averageTime: avgTime,
          maxStreak,
          bonusPoints,
          totalEarned: totalPoints + bonusPoints,
          previousPoints: initialUserPoints,
          newTotalPoints: initialUserPoints + totalPoints + bonusPoints,
        };
      },

      // ========================================
      // Redemption
      // ========================================

      openRedemptionModal: (type) => {
        set({
          showRedemptionModal: true,
          selectedRedemptionType: type,
          sessionState: 'REWARDS_SELECTION',
        });
      },

      closeRedemptionModal: () => {
        set({
          showRedemptionModal: false,
          selectedRedemptionType: null,
          selectedProvider: null,
          redemptionAmount: 0,
        });
      },

      setRedemptionProvider: (provider) => {
        set({ selectedProvider: provider });
      },

      setRedemptionAmount: (amount) => {
        set({ redemptionAmount: amount });
      },

      // ========================================
      // Loading/Error
      // ========================================

      setSubmitting: (isSubmitting) => {
        set({ isSubmitting });
      },

      setError: (error) => {
        set({ error });
      },

      // ========================================
      // Animation
      // ========================================

      setTransitioning: (isTransitioning, direction) => {
        set({ isTransitioning, slideDirection: direction ?? null });
      },

      // ========================================
      // Attempt History - Prevent Repeated Attempts
      // ========================================

      initializeAttemptHistory: (userId) => {
        const { attemptHistory } = get();
        
        // Only initialize if not already done for this user
        if (!attemptHistory || attemptHistory.userId !== userId) {
          set({
            attemptHistory: {
              userId,
              attemptedQuestionIds: [],
              attemptedQuestions: [],
              completedSessions: [],
              lastAttemptAt: null,
              totalAttemptsCount: 0,
            },
          });
        }
      },

      hasAttemptedQuestion: (questionId) => {
        const { attemptHistory } = get();
        if (!attemptHistory) return false;
        return attemptHistory.attemptedQuestionIds.includes(questionId);
      },

      hasCompletedQuizSession: () => {
        const { attemptHistory } = get();
        if (!attemptHistory) return false;
        return attemptHistory.completedSessions.length > 0;
      },

      markQuestionAttempted: (questionId, isCorrect, pointsEarned) => {
        const { attemptHistory } = get();
        if (!attemptHistory) return;

        // Check if already attempted
        if (attemptHistory.attemptedQuestionIds.includes(questionId)) {
          return; // Already marked
        }

        const attemptedQuestion: AttemptedQuestion = {
          questionId,
          attemptedAt: new Date().toISOString(),
          isCorrect,
          pointsEarned,
        };

        set({
          attemptHistory: {
            ...attemptHistory,
            attemptedQuestionIds: [...attemptHistory.attemptedQuestionIds, questionId],
            attemptedQuestions: [...attemptHistory.attemptedQuestions, attemptedQuestion],
            lastAttemptAt: new Date().toISOString(),
            totalAttemptsCount: attemptHistory.totalAttemptsCount + 1,
          },
        });
      },

      markSessionCompleted: (sessionId) => {
        const { attemptHistory } = get();
        if (!attemptHistory) return;

        // Check if session already marked as completed
        if (attemptHistory.completedSessions.includes(sessionId)) {
          return;
        }

        set({
          attemptHistory: {
            ...attemptHistory,
            completedSessions: [...attemptHistory.completedSessions, sessionId],
          },
        });
      },

      getUnattemptedQuestions: (questions) => {
        const { attemptHistory } = get();
        if (!attemptHistory) return questions;

        return questions.filter(
          (q) => !attemptHistory.attemptedQuestionIds.includes(q.id)
        );
      },

      clearAttemptHistory: () => {
        set({ attemptHistory: null });
      },
    }),
    {
      name: 'quiz-session-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Persist session progress for recovery
        sessionId: state.sessionId,
        currentIndex: state.currentIndex,
        answers: state.answers,
        totalPoints: state.totalPoints,
        currentStreak: state.currentStreak,
        maxStreak: state.maxStreak,
        initialUserPoints: state.initialUserPoints,
        // Persist attempt history to prevent re-attempts across app restarts
        attemptHistory: state.attemptHistory,
      }),
    }
  ),
  { name: 'QuizStore', enabled: __DEV__ },
  )
);

// ===========================================
// Helper Functions
// ===========================================

/**
 * Normalize questions to consistent format
 */
function normalizeQuestions(questions: QuizQuestion[]): NormalizedQuestion[] {
  return questions.map(q => {
    const type = determineAnswerType(q);
    const options = normalizeOptions(q.options, type);
    const correctAnswers = normalizeCorrectAnswers(q.correctAnswer, type);

    return {
      id: q.id,
      text: q.text,
      type,
      options,
      correctAnswers,
      explanation: q.explanation,
      category: q.category,
      difficulty: q.difficulty as 'easy' | 'medium' | 'hard' | undefined,
      pointValue: q.pointValue || 10,
      timeLimit: q.timeLimit || 90,
    };
  });
}

/**
 * Determine answer type from question data
 */
function determineAnswerType(question: QuizQuestion): AnswerType {
  // Explicit type from question
  if (question.type) {
    const typeMap: Record<string, AnswerType> = {
      'single_choice': 'single_choice',
      'multiple_choice': 'multiple_choice',
      'checkbox': 'checkbox',
      'boolean': 'boolean',
      'text': 'text',
      'input': 'text',
      'radio': 'single_choice',
      'check': 'checkbox',
    };
    return typeMap[question.type] || 'single_choice';
  }

  // Infer from options
  if (!question.options) return 'text';
  
  const optionArray = Array.isArray(question.options) 
    ? question.options 
    : Object.values(question.options);

  if (optionArray.length === 2) {
    const normalized = optionArray.map(o => String(o).toLowerCase());
    if (
      (normalized.includes('true') && normalized.includes('false')) ||
      (normalized.includes('yes') && normalized.includes('no'))
    ) {
      return 'boolean';
    }
  }

  // Check if multiple answers are correct
  if (Array.isArray(question.correctAnswer) && question.correctAnswer.length > 1) {
    return 'checkbox';
  }

  return 'single_choice';
}

/**
 * Normalize options to consistent format
 */
function normalizeOptions(
  options: unknown,
  type: AnswerType
): AnswerOption[] {
  if (!options) return [];

  // Handle boolean type
  if (type === 'boolean') {
    return [
      { id: 'true', text: 'True' },
      { id: 'false', text: 'False' },
    ];
  }

  // Handle array of strings
  if (Array.isArray(options)) {
    return options.map((opt, idx) => ({
      id: typeof opt === 'object' && opt !== null && 'id' in opt 
        ? String((opt as Record<string, unknown>).id) 
        : String(idx),
      text: typeof opt === 'object' && opt !== null && 'text' in opt
        ? String((opt as Record<string, unknown>).text)
        : String(opt),
    }));
  }

  // Handle object { A: 'text', B: 'text' }
  if (typeof options === 'object' && options !== null) {
    return Object.entries(options as Record<string, unknown>).map(([key, value]) => ({
      id: key,
      text: String(value),
    }));
  }

  return [];
}

/**
 * Normalize correct answers to array format
 */
function normalizeCorrectAnswers(
  correctAnswer: unknown,
  type: AnswerType
): string[] {
  // Handle boolean type
  if (type === 'boolean') {
    const boolValue = String(correctAnswer).toLowerCase();
    // Map yes/no to true/false
    if (boolValue === 'yes') return ['true'];
    if (boolValue === 'no') return ['false'];
    return [boolValue];
  }

  // Handle array of correct answers
  if (Array.isArray(correctAnswer)) {
    return correctAnswer.map(a => String(a).toLowerCase().trim());
  }

  // Handle single answer
  if (correctAnswer !== null && correctAnswer !== undefined) {
    return [String(correctAnswer).toLowerCase().trim()];
  }

  return [];
}

/**
 * Calculate streak bonus points
 */
function calculateStreakBonus(streak: number): number {
  if (streak < 3) return 0;
  if (streak < 5) return 5;
  if (streak < 10) return 10;
  if (streak < 20) return 25;
  return 50;
}

// ===========================================
// Atomic Selectors (stable — no new objects)
// ===========================================

export const selectCurrentQuestion = (state: QuizUIState) =>
  state.questions[state.currentIndex] || null;

export const selectSessionState = (state: QuizUIState) => state.sessionState;
export const selectCurrentIndex = (state: QuizUIState) => state.currentIndex;
export const selectQuestionsCount = (state: QuizUIState) => state.questions.length;
export const selectTotalPoints = (state: QuizUIState) => state.totalPoints;
export const selectCurrentStreak = (state: QuizUIState) => state.currentStreak;
export const selectMaxStreak = (state: QuizUIState) => state.maxStreak;
export const selectTimeRemaining = (state: QuizUIState) => state.timeRemaining;
export const selectIsTimerActive = (state: QuizUIState) => state.isTimerActive;
export const selectIsAnswerRevealed = (state: QuizUIState) => state.isAnswerRevealed;
export const selectSelectedAnswer = (state: QuizUIState) => state.selectedAnswer;
export const selectIsTransitioning = (state: QuizUIState) => state.isTransitioning;
export const selectShowSessionSummary = (state: QuizUIState) => state.showSessionSummary;
export const selectSessionSummary = (state: QuizUIState) => state.sessionSummary;
export const selectQuizError = (state: QuizUIState) => state.error;
export const selectIsSubmitting = (state: QuizUIState) => state.isSubmitting;

export const selectCanStartNewSession = (state: QuizUIState) =>
  state.sessionState !== 'DISPLAYING_QUESTION' &&
  state.sessionState !== 'ANSWER_SELECTED' &&
  state.sessionState !== 'ANSWER_VALIDATED';

/** Reactive selector: has the given question been attempted? */
export const selectHasAttemptedQuestion = (questionId: string) => (state: QuizUIState) =>
  state.attemptHistory?.attemptedQuestionIds.includes(questionId) ?? false;

/** Reactive selector: has user completed at least one session? */
export const selectHasCompletedSession = (state: QuizUIState) =>
  (state.attemptHistory?.completedSessions.length ?? 0) > 0;

// ===========================================
// Object Selectors — use with useShallow to prevent re-renders
//
// Usage:
//   const progress = useQuizStore(useShallow(selectProgress));
// ===========================================

export const selectProgress = (state: QuizUIState) => ({
  current: state.currentIndex + 1,
  total: state.questions.length,
  percentage: state.questions.length > 0
    ? Math.round(((state.currentIndex + 1) / state.questions.length) * 100)
    : 0,
});

export const selectAnswerState = (state: QuizUIState) => ({
  selectedAnswer: state.selectedAnswer,
  selectedAnswers: state.selectedAnswers,
  textAnswer: state.textAnswer,
  isAnswerRevealed: state.isAnswerRevealed,
  lastResult: state.lastAnswerResult,
});

export const selectScoreState = (state: QuizUIState) => ({
  totalPoints: state.totalPoints,
  currentStreak: state.currentStreak,
  maxStreak: state.maxStreak,
  answeredCount: state.answers.length,
  correctCount: state.answers.filter(a => a.isCorrect).length,
});

export const selectTimerState = (state: QuizUIState) => ({
  timeRemaining: state.timeRemaining,
  isActive: state.isTimerActive,
  percentage: state.questions[state.currentIndex]
    ? (state.timeRemaining / (state.questions[state.currentIndex].timeLimit || 90)) * 100
    : 100,
});

export const selectPointsState = (state: QuizUIState) => ({
  initialPoints: state.initialUserPoints,
  currentPoints: state.currentUserPoints,
  sessionPoints: state.totalPoints,
  totalPoints: state.initialUserPoints + state.totalPoints,
  availableForRedemption: state.currentUserPoints + state.totalPoints,
});

export const selectRedemptionState = (state: QuizUIState) => {
  const availablePoints = state.currentUserPoints + state.totalPoints;
  const minRedemptionPoints = 50;
  return {
    showModal: state.showRedemptionModal,
    type: state.selectedRedemptionType,
    provider: state.selectedProvider,
    amount: state.redemptionAmount,
    availablePoints,
    canRedeem: availablePoints >= minRedemptionPoints,
    minRedemptionPoints,
  };
};

export const selectAttemptHistory = (state: QuizUIState) => ({
  attemptHistory: state.attemptHistory,
  hasAttemptedQuestions: (state.attemptHistory?.attemptedQuestionIds.length ?? 0) > 0,
  totalAttempts: state.attemptHistory?.totalAttemptsCount ?? 0,
  completedSessionsCount: state.attemptHistory?.completedSessions.length ?? 0,
  lastAttemptAt: state.attemptHistory?.lastAttemptAt ?? null,
});

// ===========================================
// Pure Summary Calculator (replaces imperative calculateSummary action)
// ===========================================

export function computeSessionSummary(state: QuizUIState): QuizSessionSummary {
  const correctAnswers = state.answers.filter(a => a.isCorrect).length;
  const incorrectAnswers = state.answers.length - correctAnswers;
  const totalQuestions = state.questions.length;
  const accuracy = totalQuestions > 0
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0;
  const avgTime = state.answers.length > 0
    ? Math.round(state.answers.reduce((sum, a) => sum + a.timeTaken, 0) / state.answers.length)
    : 0;
  const bonusPoints = calculateStreakBonus(state.maxStreak);

  return {
    sessionId: state.sessionId || `quiz_${Date.now()}`,
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    totalPoints: state.totalPoints,
    pointsEarned: state.totalPoints,
    accuracy,
    averageTime: avgTime,
    maxStreak: state.maxStreak,
    bonusPoints,
    totalEarned: state.totalPoints + bonusPoints,
    previousPoints: state.initialUserPoints,
    newTotalPoints: state.initialUserPoints + state.totalPoints + bonusPoints,
  };
}

// ===========================================
// Convenience Hooks — useShallow wrappers for common patterns
// ===========================================

/** Pre-wrapped hook for progress — shallow-compared, re-render safe */
export const useQuizProgress = () => useQuizStore(useShallow(selectProgress));

/** Pre-wrapped hook for score — shallow-compared, re-render safe */
export const useQuizScore = () => useQuizStore(useShallow(selectScoreState));

/** Pre-wrapped hook for timer — shallow-compared, re-render safe */
export const useQuizTimer = () => useQuizStore(useShallow(selectTimerState));

/** Pre-wrapped hook for answer state — shallow-compared, re-render safe */
export const useQuizAnswer = () => useQuizStore(useShallow(selectAnswerState));

/** Pre-wrapped hook for redemption — shallow-compared, re-render safe */
export const useQuizRedemption = () => useQuizStore(useShallow(selectRedemptionState));

// ===========================================
// Default Export
// ===========================================

export default useQuizStore;
