/**
 * Survey Attempt Store - Client State for Active Survey Sessions
 * Zustand store for managing in-progress survey attempt state
 *
 * Industry best practices (Google Forms, SurveyMonkey, Typeform):
 * - Auto-save draft answers locally (survives app crash/nav away)
 * - Track progress per survey
 * - Timer tracking for completion analytics
 * - Submission guard (prevent double-submit)
 * - Pair with TanStack Query hooks for server state
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

export type AnswerValue = string | number | string[];

export interface DraftAnswers {
  [questionId: string]: AnswerValue;
}

export interface SurveyAttemptDraft {
  surveyId: string;
  answers: DraftAnswers;
  currentIndex: number;
  startedAt: string;
  lastSavedAt: string;
  totalQuestions: number;
}

export type SubmissionStatus =
  | 'idle'
  | 'submitting'
  | 'submitted'
  | 'error';

export interface SurveyAttemptState {
  // Active attempt
  activeSurveyId: string | null;
  answers: DraftAnswers;
  currentQuestionIndex: number;
  totalQuestions: number;

  // Progress
  startedAt: string | null;
  lastSavedAt: string | null;

  // Submission
  submissionStatus: SubmissionStatus;
  submissionError: string | null;
  submittedReward: number | null;

  // Drafts (persisted across sessions)
  drafts: Record<string, SurveyAttemptDraft>;
}

export interface SurveyAttemptActions {
  // Session lifecycle
  startAttempt: (surveyId: string, totalQuestions: number) => void;
  resumeAttempt: (surveyId: string) => boolean;
  abandonAttempt: () => void;
  clearDraft: (surveyId: string) => void;

  // Answer management
  setAnswer: (questionId: string, value: AnswerValue) => void;
  setAnswers: (answers: DraftAnswers) => void;
  clearAnswer: (questionId: string) => void;

  // Navigation
  setCurrentIndex: (index: number) => void;
  goNext: () => void;
  goPrevious: () => void;

  // Submission
  setSubmitting: () => void;
  setSubmitted: (reward: number) => void;
  setSubmissionError: (error: string) => void;
  resetSubmission: () => void;

  // Computed helpers
  getAnsweredCount: () => number;
  getProgress: () => number;
  hasDraft: (surveyId: string) => boolean;
  isAnswered: (questionId: string) => boolean;

  // Reset
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: SurveyAttemptState = {
  activeSurveyId: null,
  answers: {},
  currentQuestionIndex: 0,
  totalQuestions: 0,
  startedAt: null,
  lastSavedAt: null,
  submissionStatus: 'idle',
  submissionError: null,
  submittedReward: null,
  drafts: {},
};

// ============================================================================
// STORE
// ============================================================================

export const useSurveyAttemptStore = create<
  SurveyAttemptState & SurveyAttemptActions
>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ============================
      // Session lifecycle
      // ============================

      startAttempt: (surveyId, totalQuestions) => {
        const { drafts } = get();
        const existingDraft = drafts[surveyId];

        if (existingDraft) {
          // Resume from draft
          set({
            activeSurveyId: surveyId,
            answers: existingDraft.answers,
            currentQuestionIndex: existingDraft.currentIndex,
            totalQuestions: existingDraft.totalQuestions,
            startedAt: existingDraft.startedAt,
            lastSavedAt: existingDraft.lastSavedAt,
            submissionStatus: 'idle',
            submissionError: null,
            submittedReward: null,
          });
        } else {
          // Fresh start
          set({
            activeSurveyId: surveyId,
            answers: {},
            currentQuestionIndex: 0,
            totalQuestions,
            startedAt: new Date().toISOString(),
            lastSavedAt: null,
            submissionStatus: 'idle',
            submissionError: null,
            submittedReward: null,
          });
        }
      },

      resumeAttempt: (surveyId) => {
        const { drafts } = get();
        const draft = drafts[surveyId];
        if (!draft) return false;

        set({
          activeSurveyId: surveyId,
          answers: draft.answers,
          currentQuestionIndex: draft.currentIndex,
          totalQuestions: draft.totalQuestions,
          startedAt: draft.startedAt,
          lastSavedAt: draft.lastSavedAt,
          submissionStatus: 'idle',
          submissionError: null,
          submittedReward: null,
        });
        return true;
      },

      abandonAttempt: () => {
        const state = get();
        if (state.activeSurveyId && Object.keys(state.answers).length > 0) {
          // Save draft before abandoning
          const draft: SurveyAttemptDraft = {
            surveyId: state.activeSurveyId,
            answers: state.answers,
            currentIndex: state.currentQuestionIndex,
            startedAt: state.startedAt || new Date().toISOString(),
            lastSavedAt: new Date().toISOString(),
            totalQuestions: state.totalQuestions,
          };
          set((prev) => ({
            ...initialState,
            drafts: { ...prev.drafts, [state.activeSurveyId!]: draft },
          }));
        } else {
          set({
            activeSurveyId: null,
            answers: {},
            currentQuestionIndex: 0,
            totalQuestions: 0,
            startedAt: null,
            lastSavedAt: null,
            submissionStatus: 'idle',
            submissionError: null,
            submittedReward: null,
          });
        }
      },

      clearDraft: (surveyId) => {
        set((state) => {
          const { [surveyId]: _, ...remainingDrafts } = state.drafts;
          return { drafts: remainingDrafts };
        });
      },

      // ============================
      // Answer management
      // ============================

      setAnswer: (questionId, value) => {
        const state = get();
        const newAnswers = { ...state.answers, [questionId]: value };
        const now = new Date().toISOString();

        // Auto-save draft
        const updatedState: Partial<SurveyAttemptState> = {
          answers: newAnswers,
          lastSavedAt: now,
        };

        if (state.activeSurveyId) {
          const draft: SurveyAttemptDraft = {
            surveyId: state.activeSurveyId,
            answers: newAnswers,
            currentIndex: state.currentQuestionIndex,
            startedAt: state.startedAt || now,
            lastSavedAt: now,
            totalQuestions: state.totalQuestions,
          };
          set((prev) => ({
            ...updatedState,
            drafts: { ...prev.drafts, [state.activeSurveyId!]: draft },
          }));
        } else {
          set(updatedState);
        }
      },

      setAnswers: (answers) => {
        set({ answers, lastSavedAt: new Date().toISOString() });
      },

      clearAnswer: (questionId) => {
        set((state) => {
          const { [questionId]: _, ...remaining } = state.answers;
          return { answers: remaining };
        });
      },

      // ============================
      // Navigation
      // ============================

      setCurrentIndex: (index) => {
        const state = get();
        if (index >= 0 && index < state.totalQuestions) {
          set({ currentQuestionIndex: index });

          // Update draft with new index
          if (state.activeSurveyId && state.drafts[state.activeSurveyId]) {
            set((prev) => ({
              drafts: {
                ...prev.drafts,
                [state.activeSurveyId!]: {
                  ...prev.drafts[state.activeSurveyId!],
                  currentIndex: index,
                },
              },
            }));
          }
        }
      },

      goNext: () => {
        const { currentQuestionIndex, totalQuestions } = get();
        if (currentQuestionIndex < totalQuestions - 1) {
          get().setCurrentIndex(currentQuestionIndex + 1);
        }
      },

      goPrevious: () => {
        const { currentQuestionIndex } = get();
        if (currentQuestionIndex > 0) {
          get().setCurrentIndex(currentQuestionIndex - 1);
        }
      },

      // ============================
      // Submission
      // ============================

      setSubmitting: () => {
        set({ submissionStatus: 'submitting', submissionError: null });
      },

      setSubmitted: (reward) => {
        const state = get();
        // Clear draft on successful submission
        if (state.activeSurveyId) {
          const { [state.activeSurveyId]: _, ...remainingDrafts } = state.drafts;
          set({
            submissionStatus: 'submitted',
            submittedReward: reward,
            submissionError: null,
            drafts: remainingDrafts,
          });
        } else {
          set({
            submissionStatus: 'submitted',
            submittedReward: reward,
            submissionError: null,
          });
        }
      },

      setSubmissionError: (error) => {
        set({ submissionStatus: 'error', submissionError: error });
      },

      resetSubmission: () => {
        set({
          submissionStatus: 'idle',
          submissionError: null,
          submittedReward: null,
        });
      },

      // ============================
      // Computed helpers
      // ============================

      getAnsweredCount: () => {
        const { answers } = get();
        return Object.values(answers).filter((val) => {
          if (val === undefined || val === null) return false;
          if (typeof val === 'string') return val.trim().length > 0;
          if (typeof val === 'number') return val > 0;
          if (Array.isArray(val)) return val.length > 0;
          return false;
        }).length;
      },

      getProgress: () => {
        const state = get();
        if (state.totalQuestions === 0) return 0;
        return (state.getAnsweredCount() / state.totalQuestions) * 100;
      },

      hasDraft: (surveyId) => {
        return !!get().drafts[surveyId];
      },

      isAnswered: (questionId) => {
        const val = get().answers[questionId];
        if (val === undefined || val === null) return false;
        if (typeof val === 'string') return val.trim().length > 0;
        if (typeof val === 'number') return val > 0;
        if (Array.isArray(val)) return val.length > 0;
        return false;
      },

      // ============================
      // Reset
      // ============================

      reset: () => set(initialState),
    }),
    {
      name: 'survey-attempt-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist drafts across sessions
        drafts: state.drafts,
      }),
    }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectActiveSurveyId = (s: SurveyAttemptState) => s.activeSurveyId;
export const selectAnswers = (s: SurveyAttemptState) => s.answers;
export const selectCurrentIndex = (s: SurveyAttemptState) => s.currentQuestionIndex;
export const selectTotalQuestions = (s: SurveyAttemptState) => s.totalQuestions;
export const selectSubmissionStatus = (s: SurveyAttemptState) => s.submissionStatus;
export const selectSubmissionError = (s: SurveyAttemptState) => s.submissionError;
export const selectSubmittedReward = (s: SurveyAttemptState) => s.submittedReward;
export const selectDrafts = (s: SurveyAttemptState) => s.drafts;
export const selectIsSubmitting = (s: SurveyAttemptState) => s.submissionStatus === 'submitting';

export default useSurveyAttemptStore;
