/**
 * QuestionAnswerStore — Zustand store for question-answer screen UI state.
 *
 * Manages:
 * - Draft answer text with character tracking
 * - Submission guard (prevents double-submit)
 * - Answer history per question (survives navigation within session)
 *
 * Architecture:
 * - Zustand for ephemeral UI state (answer text, submission flag)
 * - TanStack Query for server state (question data, responses)
 * - No persistence — drafts are session-scoped
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ─── Constants ───────────────────────────────────────────────────────────────

export const ANSWER_MAX_LENGTH = 500;

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuestionDraft {
  text: string;
  lastUpdated: number;
}

interface QuestionAnswerState {
  /** Per-question draft answers (keyed by questionId) */
  drafts: Record<string, QuestionDraft>;

  /** Questions that have been submitted this session */
  submittedQuestionIds: Set<string>;

  /** Currently active question ID */
  activeQuestionId: string | null;
}

interface QuestionAnswerActions {
  /** Set the active question being answered */
  setActiveQuestion: (questionId: string) => void;

  /** Update the draft text for the active question */
  updateDraft: (questionId: string, text: string) => void;

  /** Mark a question as submitted (prevents re-submission) */
  markSubmitted: (questionId: string) => void;

  /** Check if a question was submitted this session */
  isSubmitted: (questionId: string) => boolean;

  /** Get the draft text for a question */
  getDraft: (questionId: string) => string;

  /** Clear draft for a specific question */
  clearDraft: (questionId: string) => void;

  /** Reset the entire store */
  reset: () => void;
}

// ─── Initial State ───────────────────────────────────────────────────────────

const initialState: QuestionAnswerState = {
  drafts: {},
  submittedQuestionIds: new Set(),
  activeQuestionId: null,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useQuestionAnswerStore = create<
  QuestionAnswerState & QuestionAnswerActions
>()(
  devtools(
  immer((set, get) => ({
    ...initialState,

    setActiveQuestion: (questionId: string) => {
      set((state) => {
        state.activeQuestionId = questionId;
      });
    },

    updateDraft: (questionId: string, text: string) => {
      // Enforce max length at store level
      const trimmed = text.slice(0, ANSWER_MAX_LENGTH);
      set((state) => {
        state.drafts[questionId] = {
          text: trimmed,
          lastUpdated: Date.now(),
        };
      });
    },

    markSubmitted: (questionId: string) => {
      set((state) => {
        state.submittedQuestionIds.add(questionId);
        // Clear draft after successful submission
        delete state.drafts[questionId];
      });
    },

    isSubmitted: (questionId: string) => {
      return get().submittedQuestionIds.has(questionId);
    },

    getDraft: (questionId: string) => {
      return get().drafts[questionId]?.text ?? '';
    },

    clearDraft: (questionId: string) => {
      set((state) => {
        delete state.drafts[questionId];
      });
    },

    reset: () => {
      set(() => ({
        drafts: {},
        submittedQuestionIds: new Set(),
        activeQuestionId: null,
      }));
    },
  })),
  { name: 'QuestionAnswerStore', enabled: __DEV__ },
  )
);

// ─── Selectors (granular subscriptions — avoid full-store re-renders) ────────

export const selectActiveQuestionId = (s: QuestionAnswerState) =>
  s.activeQuestionId;

export const selectDraftText = (questionId: string) => (s: QuestionAnswerState) =>
  s.drafts[questionId]?.text ?? '';

export const selectRemainingChars = (questionId: string) => (s: QuestionAnswerState) =>
  ANSWER_MAX_LENGTH - (s.drafts[questionId]?.text?.length ?? 0);

export const selectIsValidLength = (questionId: string) => (s: QuestionAnswerState) => {
  const len = s.drafts[questionId]?.text?.trim().length ?? 0;
  return len > 0 && len <= ANSWER_MAX_LENGTH;
};

export const selectWasSubmitted = (questionId: string) => (s: QuestionAnswerState) =>
  s.submittedQuestionIds.has(questionId);
