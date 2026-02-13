/**
 * Instant Reward Store - Zustand State Management
 * 
 * Architecture:
 * - Zustand: Client-side UI state (attempt tracking, session state)
 * - TanStack Query: Server state (questions fetching, answer submission)
 * 
 * Features:
 * - Prevent repeated attempts on questions (single attempt enforcement)
 * - Track attempted questions with persistence
 * - Session management for continuous question flow
 * - Wallet/points tracking with redemption support
 * - Offline queue for pending submissions
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ===========================================
// Constants
// ===========================================

/**
 * Reward constants for instant reward questions
 * Each correct answer earns 500 UGX (equivalent to 5 points)
 */
export const REWARD_CONSTANTS = {
  /** Amount in UGX for each correct answer */
  INSTANT_REWARD_AMOUNT: 500,
  /** Points equivalent (1 point = 100 UGX) */
  INSTANT_REWARD_POINTS: 5,
  /** Conversion rate: points to UGX */
  POINTS_TO_UGX_RATE: 100,
  /** Minimum points required for redemption */
  MIN_REDEMPTION_POINTS: 50,
  /** Redemption options (points to UGX) */
  REDEMPTION_OPTIONS: [
    { points: 50, cashValue: 5000 },
    { points: 100, cashValue: 10000 },
    { points: 250, cashValue: 25000 },
    { points: 500, cashValue: 50000 },
  ] as const,
} as const;

/** Redemption type for rewards */
export type RewardRedemptionType = 'CASH' | 'AIRTIME';

/** Payment provider options */
export type PaymentProvider = 'MTN' | 'AIRTEL';

/** Session state for instant reward flow */
export type InstantRewardSessionState =
  | 'IDLE'
  | 'LOADING'
  | 'ANSWERING'
  | 'SUBMITTED'
  | 'TRANSITIONING'
  | 'SESSION_SUMMARY'
  | 'REDEEMING'
  | 'COMPLETED';

// ===========================================
// Types
// ===========================================

export interface AttemptedRewardQuestion {
  questionId: string;
  attemptedAt: string;
  isCorrect: boolean;
  selectedAnswer: string;
  rewardEarned: number;
  isWinner: boolean;
  position: number | null;
  paymentStatus: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | null;
}

/** Pending submission for offline queue */
export interface PendingSubmission {
  id: string;
  questionId: string;
  answer: string;
  phoneNumber?: string;
  userEmail?: string;
  createdAt: string;
  retryCount: number;
  lastRetryAt: string | null;
}

export interface InstantRewardAttemptHistory {
  userId: string;
  attemptedQuestionIds: string[];
  attemptedQuestions: AttemptedRewardQuestion[];
  totalRewardsEarned: number;
  totalQuestionsAttempted: number;
  lastAttemptAt: string | null;
}

/** Session summary for display after all questions answered */
export interface InstantRewardSessionSummary {
  totalQuestions: number;
  questionsAnswered: number;
  correctAnswers: number;
  incorrectAnswers: number;
  totalEarned: number;
  accuracy: number;
  sessionStartedAt: string | null;
  sessionCompletedAt: string | null;
}

/** Redemption request details */
export interface RedemptionRequest {
  points: number;
  cashValue: number;
  type: RewardRedemptionType;
  provider: PaymentProvider;
  phoneNumber: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESSFUL' | 'FAILED';
  requestedAt: string;
  completedAt: string | null;
  transactionRef: string | null;
  errorMessage: string | null;
}

export interface InstantRewardUIState {
  // Attempt History
  attemptHistory: InstantRewardAttemptHistory | null;
  
  // Wallet State (cached from server)
  walletBalance: number;
  pendingRewards: number;
  
  // Session State (for continuous question flow)
  sessionState: InstantRewardSessionState;
  sessionQuestionIds: string[];
  currentSessionIndex: number;
  sessionSummary: InstantRewardSessionSummary;

  // Current Question State
  currentQuestionId: string | null;
  selectedAnswer: string | null;
  isSubmitting: boolean;
  lastResult: AttemptedRewardQuestion | null;
  
  // Loading/Error States
  error: string | null;

  // Offline Queue
  pendingSubmissions: PendingSubmission[];
  isOnline: boolean;

  // Redemption State
  isRedeeming: boolean;
  pendingRedemption: RedemptionRequest | null;
  redemptionHistory: RedemptionRequest[];
}

export interface InstantRewardUIActions {
  // Attempt History Management
  initializeAttemptHistory: (userId: string) => void;
  hasAttemptedQuestion: (questionId: string) => boolean;
  getAttemptedQuestion: (questionId: string) => AttemptedRewardQuestion | null;
  markQuestionAttempted: (attempt: Omit<AttemptedRewardQuestion, 'attemptedAt'>) => void;
  clearAttemptHistory: () => void;
  
  // Get unattempted questions from a list
  getUnattemptedQuestions: <T extends { id: string }>(questions: T[]) => T[];
  
  // Session Management (for continuous flow)
  startSession: (questionIds: string[]) => void;
  endSession: () => void;
  goToNextQuestion: () => string | null;
  goToPreviousQuestion: () => string | null;
  getCurrentSessionQuestion: () => string | null;
  getSessionProgress: () => { current: number; total: number; remaining: number };
  hasMoreQuestions: () => boolean;
  setSessionState: (state: InstantRewardSessionState) => void;
  updateSessionSummary: (isCorrect: boolean, rewardEarned: number) => void;

  // Wallet Management
  updateWalletBalance: (balance: number) => void;
  addPendingReward: (amount: number) => void;
  confirmReward: (amount: number) => void;
  
  // Redemption Management
  initiateRedemption: (request: Omit<RedemptionRequest, 'status' | 'requestedAt' | 'completedAt' | 'transactionRef' | 'errorMessage'>) => void;
  completeRedemption: (transactionRef: string, success: boolean, errorMessage?: string) => void;
  cancelRedemption: () => void;
  canRedeem: () => boolean;
  getRedemptionOptions: () => typeof REWARD_CONSTANTS.REDEMPTION_OPTIONS[number][];

  // Current Question State
  setCurrentQuestion: (questionId: string | null) => void;
  setSelectedAnswer: (answer: string | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setLastResult: (result: AttemptedRewardQuestion | null) => void;
  setError: (error: string | null) => void;
  
  // Offline Queue Management
  addPendingSubmission: (submission: Omit<PendingSubmission, 'id' | 'createdAt' | 'retryCount' | 'lastRetryAt'>) => void;
  removePendingSubmission: (id: string) => void;
  updatePendingSubmissionRetry: (id: string) => void;
  getPendingSubmissions: () => PendingSubmission[];
  hasPendingSubmission: (questionId: string) => boolean;
  setOnlineStatus: (isOnline: boolean) => void;

  // Reset
  resetCurrentQuestion: () => void;
  resetSession: () => void;
}

// ===========================================
// Initial State
// ===========================================

const initialSessionSummary: InstantRewardSessionSummary = {
  totalQuestions: 0,
  questionsAnswered: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  totalEarned: 0,
  accuracy: 0,
  sessionStartedAt: null,
  sessionCompletedAt: null,
};

const initialState: InstantRewardUIState = {
  attemptHistory: null,
  walletBalance: 0,
  pendingRewards: 0,
  sessionState: 'IDLE',
  sessionQuestionIds: [],
  currentSessionIndex: 0,
  sessionSummary: initialSessionSummary,
  currentQuestionId: null,
  selectedAnswer: null,
  isSubmitting: false,
  lastResult: null,
  error: null,
  pendingSubmissions: [],
  isOnline: true,
  isRedeeming: false,
  pendingRedemption: null,
  redemptionHistory: [],
};

// ===========================================
// Store
// ===========================================

export const useInstantRewardStore = create<InstantRewardUIState & InstantRewardUIActions>()(
  devtools(
  persist(
    (set, get) => ({
      ...initialState,

      // ========================================
      // Attempt History Management
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
              totalRewardsEarned: 0,
              totalQuestionsAttempted: 0,
              lastAttemptAt: null,
            },
          });
        }
      },

      hasAttemptedQuestion: (questionId) => {
        const { attemptHistory } = get();
        return attemptHistory?.attemptedQuestionIds.includes(questionId) ?? false;
      },

      getAttemptedQuestion: (questionId) => {
        const { attemptHistory } = get();
        return attemptHistory?.attemptedQuestions.find(q => q.questionId === questionId) ?? null;
      },

      markQuestionAttempted: (attempt) => {
        const { attemptHistory } = get();
        if (!attemptHistory) return;

        const now = new Date().toISOString();
        const newAttempt: AttemptedRewardQuestion = {
          ...attempt,
          attemptedAt: now,
        };

        // Avoid duplicate entries
        if (attemptHistory.attemptedQuestionIds.includes(attempt.questionId)) {
          return;
        }

        set({
          attemptHistory: {
            ...attemptHistory,
            attemptedQuestionIds: [...attemptHistory.attemptedQuestionIds, attempt.questionId],
            attemptedQuestions: [...attemptHistory.attemptedQuestions, newAttempt],
            totalRewardsEarned: attemptHistory.totalRewardsEarned + attempt.rewardEarned,
            totalQuestionsAttempted: attemptHistory.totalQuestionsAttempted + 1,
            lastAttemptAt: now,
          },
          lastResult: newAttempt,
        });
      },

      clearAttemptHistory: () => {
        const { attemptHistory } = get();
        if (attemptHistory) {
          set({
            attemptHistory: {
              ...attemptHistory,
              attemptedQuestionIds: [],
              attemptedQuestions: [],
              totalRewardsEarned: 0,
              totalQuestionsAttempted: 0,
              lastAttemptAt: null,
            },
          });
        }
      },

      getUnattemptedQuestions: (questions) => {
        const { attemptHistory } = get();
        if (!attemptHistory) return questions;
        
        return questions.filter(q => !attemptHistory.attemptedQuestionIds.includes(q.id));
      },

      // ========================================
      // Session Management
      // ========================================

      startSession: (questionIds) => {
        const now = new Date().toISOString();
        set({
          sessionState: 'ANSWERING',
          sessionQuestionIds: questionIds,
          currentSessionIndex: 0,
          currentQuestionId: questionIds[0] || null,
          sessionSummary: {
            ...initialSessionSummary,
            totalQuestions: questionIds.length,
            sessionStartedAt: now,
          },
          selectedAnswer: null,
          lastResult: null,
          error: null,
        });
      },

      endSession: () => {
        const { sessionSummary } = get();
        const now = new Date().toISOString();
        set({
          sessionState: 'SESSION_SUMMARY',
          sessionSummary: {
            ...sessionSummary,
            sessionCompletedAt: now,
          },
        });
      },

      goToNextQuestion: () => {
        const { sessionQuestionIds, currentSessionIndex, attemptHistory } = get();

        // Find next unattempted question
        let nextIndex = currentSessionIndex + 1;
        while (nextIndex < sessionQuestionIds.length) {
          const questionId = sessionQuestionIds[nextIndex];
          if (!attemptHistory?.attemptedQuestionIds.includes(questionId)) {
            break;
          }
          nextIndex++;
        }

        if (nextIndex >= sessionQuestionIds.length) {
          // No more unanswered questions
          get().endSession();
          return null;
        }

        const nextQuestionId = sessionQuestionIds[nextIndex];
        set({
          sessionState: 'TRANSITIONING',
          currentSessionIndex: nextIndex,
          currentQuestionId: nextQuestionId,
          selectedAnswer: null,
          lastResult: null,
        });

        return nextQuestionId;
      },

      goToPreviousQuestion: () => {
        const { sessionQuestionIds, currentSessionIndex } = get();

        if (currentSessionIndex <= 0) {
          return null;
        }

        const prevIndex = currentSessionIndex - 1;
        const prevQuestionId = sessionQuestionIds[prevIndex];

        set({
          currentSessionIndex: prevIndex,
          currentQuestionId: prevQuestionId,
          selectedAnswer: null,
          lastResult: null,
        });

        return prevQuestionId;
      },

      getCurrentSessionQuestion: () => {
        const { sessionQuestionIds, currentSessionIndex } = get();
        return sessionQuestionIds[currentSessionIndex] || null;
      },

      getSessionProgress: () => {
        const { sessionQuestionIds, currentSessionIndex, attemptHistory } = get();
        const total = sessionQuestionIds.length;
        const answeredCount = attemptHistory?.attemptedQuestions.filter(
          q => sessionQuestionIds.includes(q.questionId)
        ).length || 0;
        return {
          current: currentSessionIndex + 1,
          total,
          remaining: total - answeredCount,
        };
      },

      hasMoreQuestions: () => {
        const { sessionQuestionIds, currentSessionIndex, attemptHistory } = get();
        // Check if there are any unanswered questions remaining
        for (let i = currentSessionIndex; i < sessionQuestionIds.length; i++) {
          const questionId = sessionQuestionIds[i];
          if (!attemptHistory?.attemptedQuestionIds.includes(questionId)) {
            return true;
          }
        }
        return false;
      },

      setSessionState: (state) => {
        set({ sessionState: state });
      },

      updateSessionSummary: (isCorrect, rewardEarned) => {
        set(state => {
          const summary = state.sessionSummary;
          const newCorrect = isCorrect ? summary.correctAnswers + 1 : summary.correctAnswers;
          const newAnswered = summary.questionsAnswered + 1;
          return {
            sessionSummary: {
              ...summary,
              questionsAnswered: newAnswered,
              correctAnswers: newCorrect,
              incorrectAnswers: isCorrect ? summary.incorrectAnswers : summary.incorrectAnswers + 1,
              totalEarned: summary.totalEarned + rewardEarned,
              accuracy: newAnswered > 0 ? Math.round((newCorrect / newAnswered) * 100) : 0,
            },
          };
        });
      },

      // ========================================
      // Wallet Management
      // ========================================

      updateWalletBalance: (balance) => {
        set({ walletBalance: balance });
      },

      addPendingReward: (amount) => {
        set(state => ({
          pendingRewards: state.pendingRewards + amount,
        }));
      },

      confirmReward: (amount) => {
        set(state => ({
          walletBalance: state.walletBalance + amount,
          pendingRewards: Math.max(0, state.pendingRewards - amount),
        }));
      },

      // ========================================
      // Redemption Management
      // ========================================

      initiateRedemption: (request) => {
        const now = new Date().toISOString();
        set({
          isRedeeming: true,
          sessionState: 'REDEEMING',
          pendingRedemption: {
            ...request,
            status: 'PENDING',
            requestedAt: now,
            completedAt: null,
            transactionRef: null,
            errorMessage: null,
          },
        });
      },

      completeRedemption: (transactionRef, success, errorMessage) => {
        const now = new Date().toISOString();
        set(state => {
          const completed: RedemptionRequest = {
            ...state.pendingRedemption!,
            status: success ? 'SUCCESSFUL' : 'FAILED',
            completedAt: now,
            transactionRef: success ? transactionRef : null,
            errorMessage: success ? null : (errorMessage || 'Redemption failed'),
          };

          return {
            isRedeeming: false,
            sessionState: 'SESSION_SUMMARY',
            pendingRedemption: null,
            redemptionHistory: [...state.redemptionHistory, completed],
            // Deduct points if successful
            walletBalance: success
              ? Math.max(0, state.walletBalance - completed.points * REWARD_CONSTANTS.POINTS_TO_UGX_RATE)
              : state.walletBalance,
          };
        });
      },

      cancelRedemption: () => {
        set({
          isRedeeming: false,
          sessionState: 'SESSION_SUMMARY',
          pendingRedemption: null,
        });
      },

      canRedeem: () => {
        const { attemptHistory } = get();
        const totalPoints = (attemptHistory?.totalRewardsEarned || 0) / REWARD_CONSTANTS.POINTS_TO_UGX_RATE;
        return totalPoints >= REWARD_CONSTANTS.MIN_REDEMPTION_POINTS;
      },

      getRedemptionOptions: () => {
        const { attemptHistory } = get();
        const totalPoints = (attemptHistory?.totalRewardsEarned || 0) / REWARD_CONSTANTS.POINTS_TO_UGX_RATE;
        return REWARD_CONSTANTS.REDEMPTION_OPTIONS.filter(opt => opt.points <= totalPoints);
      },

      // ========================================
      // Offline Queue Management
      // ========================================

      addPendingSubmission: (submission) => {
        const now = new Date().toISOString();
        const newSubmission: PendingSubmission = {
          ...submission,
          id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: now,
          retryCount: 0,
          lastRetryAt: null,
        };

        set(state => ({
          pendingSubmissions: [...state.pendingSubmissions, newSubmission],
        }));
      },

      removePendingSubmission: (id) => {
        set(state => ({
          pendingSubmissions: state.pendingSubmissions.filter(s => s.id !== id),
        }));
      },

      updatePendingSubmissionRetry: (id) => {
        const now = new Date().toISOString();
        set(state => ({
          pendingSubmissions: state.pendingSubmissions.map(s =>
            s.id === id
              ? { ...s, retryCount: s.retryCount + 1, lastRetryAt: now }
              : s
          ),
        }));
      },

      getPendingSubmissions: () => {
        return get().pendingSubmissions;
      },

      hasPendingSubmission: (questionId) => {
        return get().pendingSubmissions.some(s => s.questionId === questionId);
      },

      setOnlineStatus: (isOnline) => {
        set({ isOnline });
      },

      // ========================================
      // Current Question State
      // ========================================

      setCurrentQuestion: (questionId) => {
        set({ 
          currentQuestionId: questionId,
          selectedAnswer: null,
          lastResult: null,
          error: null,
        });
      },

      setSelectedAnswer: (answer) => {
        set({ selectedAnswer: answer });
      },

      setSubmitting: (isSubmitting) => {
        set({ isSubmitting });
      },

      setLastResult: (result) => {
        set({ lastResult: result });
      },

      setError: (error) => {
        set({ error });
      },

      // ========================================
      // Reset
      // ========================================

      resetCurrentQuestion: () => {
        set({
          currentQuestionId: null,
          selectedAnswer: null,
          isSubmitting: false,
          lastResult: null,
          error: null,
        });
      },

      resetSession: () => {
        set({
          sessionState: 'IDLE',
          sessionQuestionIds: [],
          currentSessionIndex: 0,
          sessionSummary: initialSessionSummary,
          currentQuestionId: null,
          selectedAnswer: null,
          isSubmitting: false,
          lastResult: null,
          error: null,
          isRedeeming: false,
          pendingRedemption: null,
        });
      },
    }),
    {
      name: 'instant-reward-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        attemptHistory: state.attemptHistory,
        walletBalance: state.walletBalance,
        pendingSubmissions: state.pendingSubmissions,
      }),
    }
  ),
  { name: 'InstantRewardStore', enabled: __DEV__ },
  )
);

// ===========================================
// Atomic Selectors (stable — no new objects, no re-renders)
// ===========================================

export const selectAttemptHistory = (state: InstantRewardUIState) => state.attemptHistory;
export const selectInstantSessionState = (state: InstantRewardUIState) => state.sessionState;
export const selectCurrentQuestionId = (state: InstantRewardUIState) => state.currentQuestionId;
export const selectInstantSelectedAnswer = (state: InstantRewardUIState) => state.selectedAnswer;
export const selectInstantIsSubmitting = (state: InstantRewardUIState) => state.isSubmitting;
export const selectInstantLastResult = (state: InstantRewardUIState) => state.lastResult;
export const selectInstantError = (state: InstantRewardUIState) => state.error;
export const selectWalletBalance = (state: InstantRewardUIState) => state.walletBalance;
export const selectPendingRewards = (state: InstantRewardUIState) => state.pendingRewards;
export const selectIsRedeeming = (state: InstantRewardUIState) => state.isRedeeming;
export const selectInstantSessionSummary = (state: InstantRewardUIState) => state.sessionSummary;
export const selectIsOnline = (state: InstantRewardUIState) => state.isOnline;

export const selectHasAttempted = (questionId: string) => (state: InstantRewardUIState) =>
  state.attemptHistory?.attemptedQuestionIds.includes(questionId) ?? false;

export const selectAttemptedCount = (state: InstantRewardUIState) =>
  state.attemptHistory?.totalQuestionsAttempted ?? 0;

export const selectTotalRewardsEarned = (state: InstantRewardUIState) =>
  state.attemptHistory?.totalRewardsEarned ?? 0;

/** Reactive selector for canRedeem — subscribes to state changes unlike the imperative action */
export const selectCanRedeem = (state: InstantRewardUIState): boolean => {
  const totalPoints = (state.attemptHistory?.totalRewardsEarned || 0) / REWARD_CONSTANTS.POINTS_TO_UGX_RATE;
  return totalPoints >= REWARD_CONSTANTS.MIN_REDEMPTION_POINTS;
};

export const selectPendingSubmissionForQuestion = (questionId: string) => (state: InstantRewardUIState) =>
  state.pendingSubmissions.find(s => s.questionId === questionId) ?? null;

/** Reactive: is this session still active? */
export const selectIsSessionActive = (state: InstantRewardUIState) =>
  state.sessionState !== 'IDLE' && state.sessionState !== 'COMPLETED';

/** Reactive: has pending offline submissions? */
export const selectHasPendingSubmissions = (state: InstantRewardUIState) =>
  state.pendingSubmissions.length > 0;

// ===========================================
// Object Selectors — use with useShallow to prevent re-renders
// ===========================================

export const selectWalletState = (state: InstantRewardUIState) => ({
  balance: state.walletBalance,
  pending: state.pendingRewards,
  total: state.walletBalance + state.pendingRewards,
});

export const selectCurrentQuestionState = (state: InstantRewardUIState) => ({
  questionId: state.currentQuestionId,
  selectedAnswer: state.selectedAnswer,
  isSubmitting: state.isSubmitting,
  lastResult: state.lastResult,
  error: state.error,
});

export const selectSessionState = (state: InstantRewardUIState) => ({
  state: state.sessionState,
  questionIds: state.sessionQuestionIds,
  currentIndex: state.currentSessionIndex,
  summary: state.sessionSummary,
  isActive: state.sessionState !== 'IDLE' && state.sessionState !== 'COMPLETED',
});

export const selectRedemptionState = (state: InstantRewardUIState) => ({
  isRedeeming: state.isRedeeming,
  pendingRedemption: state.pendingRedemption,
  history: state.redemptionHistory,
});

export const selectOfflineQueueState = (state: InstantRewardUIState) => ({
  pendingCount: state.pendingSubmissions.length,
  isOnline: state.isOnline,
  hasPending: state.pendingSubmissions.length > 0,
});

// ===========================================
// Convenience Hooks — pre-wrapped with useShallow (re-render safe)
// ===========================================

/** Wallet state — shallow-compared, re-render safe */
export const useWalletState = () => useInstantRewardStore(useShallow(selectWalletState));

/** Current question state — shallow-compared */
export const useCurrentQuestionState = () => useInstantRewardStore(useShallow(selectCurrentQuestionState));

/** Session state — shallow-compared */
export const useInstantSessionState = () => useInstantRewardStore(useShallow(selectSessionState));

/** Redemption state — shallow-compared */
export const useInstantRedemptionState = () => useInstantRewardStore(useShallow(selectRedemptionState));

/** Offline queue — shallow-compared */
export const useOfflineQueueState = () => useInstantRewardStore(useShallow(selectOfflineQueueState));

// ===========================================
// Helper Functions
// ===========================================

/** Convert points to cash value in UGX */
export const pointsToCash = (points: number): number =>
  points * REWARD_CONSTANTS.POINTS_TO_UGX_RATE;

/** Convert cash value to points */
export const cashToPoints = (cash: number): number =>
  Math.floor(cash / REWARD_CONSTANTS.POINTS_TO_UGX_RATE);

/** Check if user can redeem rewards */
export const canRedeemRewards = (totalRewardsEarned: number): boolean => {
  const points = totalRewardsEarned / REWARD_CONSTANTS.POINTS_TO_UGX_RATE;
  return points >= REWARD_CONSTANTS.MIN_REDEMPTION_POINTS;
};

/** Get available redemption options based on points */
export const getAvailableRedemptionOptions = (totalRewardsEarned: number) => {
  const points = totalRewardsEarned / REWARD_CONSTANTS.POINTS_TO_UGX_RATE;
  return REWARD_CONSTANTS.REDEMPTION_OPTIONS.filter(opt => opt.points <= points);
};

// ===========================================
// Default Export
// ===========================================

export default useInstantRewardStore;
