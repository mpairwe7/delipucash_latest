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
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// ===========================================
// Default Export
// ===========================================

export default useInstantRewardStore;
