/**
 * Instant Reward Store - Zustand State Management
 * 
 * Architecture:
 * - Zustand: Client-side UI state (attempt tracking, session state)
 * - TanStack Query: Server state (questions fetching, answer submission)
 * 
 * Features:
 * - Prevent repeated attempts on questions
 * - Track attempted questions with persistence
 * - Wallet/points tracking
 * - Offline queue for pending submissions
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
} as const;

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

export interface InstantRewardUIState {
  // Attempt History
  attemptHistory: InstantRewardAttemptHistory | null;
  
  // Wallet State (cached from server)
  walletBalance: number;
  pendingRewards: number;
  
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
  
  // Wallet Management
  updateWalletBalance: (balance: number) => void;
  addPendingReward: (amount: number) => void;
  confirmReward: (amount: number) => void;
  
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
}

// ===========================================
// Initial State
// ===========================================

const initialState: InstantRewardUIState = {
  attemptHistory: null,
  walletBalance: 0,
  pendingRewards: 0,
  currentQuestionId: null,
  selectedAnswer: null,
  isSubmitting: false,
  lastResult: null,
  error: null,
  pendingSubmissions: [],
  isOnline: true,
};

// ===========================================
// Store
// ===========================================

export const useInstantRewardStore = create<InstantRewardUIState & InstantRewardUIActions>()(
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
  )
);

// ===========================================
// Selectors
// ===========================================

export const selectAttemptHistory = (state: InstantRewardUIState) => state.attemptHistory;

export const selectHasAttempted = (questionId: string) => (state: InstantRewardUIState) => 
  state.attemptHistory?.attemptedQuestionIds.includes(questionId) ?? false;

export const selectAttemptedCount = (state: InstantRewardUIState) => 
  state.attemptHistory?.totalQuestionsAttempted ?? 0;

export const selectTotalRewardsEarned = (state: InstantRewardUIState) => 
  state.attemptHistory?.totalRewardsEarned ?? 0;

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

export const selectOfflineQueueState = (state: InstantRewardUIState) => ({
  pendingCount: state.pendingSubmissions.length,
  isOnline: state.isOnline,
  hasPending: state.pendingSubmissions.length > 0,
});

export const selectPendingSubmissionForQuestion = (questionId: string) => (state: InstantRewardUIState) =>
  state.pendingSubmissions.find(s => s.questionId === questionId) ?? null;

// ===========================================
// Default Export
// ===========================================

export default useInstantRewardStore;
