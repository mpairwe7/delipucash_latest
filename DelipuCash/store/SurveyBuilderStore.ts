/**
 * Survey Builder Store — Central State for Survey Creation
 *
 * Shared between SurveyForm.tsx and ConversationalBuilder.tsx.
 * Wraps question state with undo/redo middleware and persists drafts.
 *
 * Architecture:
 * - Undo/redo via `withUndo` middleware (tracks questions array only)
 * - AsyncStorage persistence for draft survival across sessions
 * - Atomic selectors for render-safe consumption
 * - No server state — use TanStack Query for that
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withUndo, type UndoState, type UndoActions } from './middleware/undoMiddleware';

// ============================================================================
// TYPES
// ============================================================================

export type BuilderQuestionType =
  | 'text'
  | 'paragraph'
  | 'radio'
  | 'checkbox'
  | 'dropdown'
  | 'rating'
  | 'boolean'
  | 'date'
  | 'time'
  | 'number'
  | 'file_upload';

/** Conditional logic rule for branching */
export interface ConditionalRule {
  sourceQuestionId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value: string | number | boolean;
  action: 'show' | 'skip_to';
}

export interface ConditionalLogicConfig {
  rules: ConditionalRule[];
  logicType: 'all' | 'any';
}

/** File upload configuration for file_upload question type */
export interface FileUploadConfig {
  allowedTypes: string[]; // MIME types: ['image/*', 'application/pdf']
  maxSizeBytes: number;
  maxFiles: number;
}

export interface BuilderQuestionData {
  id: string;
  text: string;
  type: BuilderQuestionType;
  options: string[];
  minValue?: number;
  maxValue?: number;
  placeholder?: string;
  required: boolean;
  conditionalLogic?: ConditionalLogicConfig | null;
  fileUploadConfig?: FileUploadConfig | null;
  points?: number;
}

export interface SurveyBuilderState {
  // Survey metadata
  surveyTitle: string;
  surveyDescription: string;
  draftId: string | null;
  lastSavedAt: string | null;

  // Questions (tracked by undo middleware)
  questions: BuilderQuestionData[];

  // Multi-select mode
  isMultiSelectMode: boolean;
  selectedQuestionIds: string[];

  // Scoring
  isScoringEnabled: boolean;

  // Gamification
  earnedBadges: string[];

  // UI
  expandedQuestionId: string | null;
}

export interface SurveyBuilderActions {
  // Survey metadata
  setSurveyTitle: (title: string) => void;
  setSurveyDescription: (description: string) => void;
  setDraftId: (id: string | null) => void;
  setScoringEnabled: (enabled: boolean) => void;

  // Question CRUD
  addQuestion: (question?: Partial<BuilderQuestionData>) => string;
  removeQuestion: (id: string) => void;
  updateQuestion: (id: string, updates: Partial<BuilderQuestionData>) => void;
  duplicateQuestion: (id: string) => string | null;
  reorderQuestions: (fromIndex: number, toIndex: number) => void;

  // Bulk operations
  bulkAddQuestions: (questions: BuilderQuestionData[]) => void;
  bulkDeleteQuestions: (ids: string[]) => void;
  bulkDuplicateQuestions: (ids: string[]) => string[];

  // Multi-select
  toggleMultiSelectMode: () => void;
  toggleQuestionSelection: (id: string) => void;
  selectAllQuestions: () => void;
  clearSelection: () => void;

  // Options helpers
  addOption: (questionId: string) => void;
  removeOption: (questionId: string, optionIndex: number) => void;
  updateOption: (questionId: string, optionIndex: number, value: string) => void;

  // Conditional logic
  setConditionalLogic: (questionId: string, config: ConditionalLogicConfig | null) => void;

  // File upload config
  setFileUploadConfig: (questionId: string, config: FileUploadConfig | null) => void;

  // UI
  setExpandedQuestion: (id: string | null) => void;

  // Import/load
  loadQuestions: (questions: BuilderQuestionData[]) => void;
  loadDraft: (draft: { title: string; description: string; questions: BuilderQuestionData[]; draftId: string }) => void;

  // Reset
  resetBuilder: () => void;

  // Badge
  checkBadges: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

let questionCounter = 0;

function generateQuestionId(): string {
  questionCounter += 1;
  return `q_${Date.now()}_${questionCounter}`;
}

function createDefaultQuestion(overrides?: Partial<BuilderQuestionData>): BuilderQuestionData {
  return {
    id: generateQuestionId(),
    text: '',
    type: 'text',
    options: [],
    placeholder: '',
    required: false,
    conditionalLogic: null,
    fileUploadConfig: null,
    points: 0,
    ...overrides,
  };
}

// Badge definitions
const BADGE_CHECKS: { id: string; label: string; check: (state: SurveyBuilderState) => boolean }[] = [
  { id: 'first_question', label: 'First Question', check: (s) => s.questions.length >= 1 && s.questions[0].text.trim() !== '' },
  { id: 'five_questions', label: 'Survey Builder', check: (s) => s.questions.length >= 5 },
  { id: 'ten_questions', label: 'Survey Architect', check: (s) => s.questions.length >= 10 },
  { id: 'has_logic', label: 'Logic Master', check: (s) => s.questions.some((q) => q.conditionalLogic && q.conditionalLogic.rules.length > 0) },
  { id: 'has_file_upload', label: 'File Collector', check: (s) => s.questions.some((q) => q.type === 'file_upload') },
  { id: 'variety', label: 'Mixed Methods', check: (s) => new Set(s.questions.map((q) => q.type)).size >= 3 },
];

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: SurveyBuilderState = {
  surveyTitle: '',
  surveyDescription: '',
  draftId: null,
  lastSavedAt: null,
  questions: [createDefaultQuestion({ id: 'q1' })],
  isMultiSelectMode: false,
  selectedQuestionIds: [],
  isScoringEnabled: false,
  earnedBadges: [],
  expandedQuestionId: 'q1',
};

// ============================================================================
// STORE
// ============================================================================

export const useSurveyBuilderStore = create<
  SurveyBuilderState & SurveyBuilderActions & UndoState & UndoActions
>()(
  devtools(
    persist(
      withUndo(
        (set, get) => ({
          ...initialState,

          // ── Survey Metadata ──────────────────────────────────────────
          setSurveyTitle: (title) => set({ surveyTitle: title }),
          setSurveyDescription: (description) => set({ surveyDescription: description }),
          setDraftId: (id) => set({ draftId: id }),
          setScoringEnabled: (enabled) => {
            set((state) => ({
              isScoringEnabled: enabled,
              // Reset points to 0 when scoring is disabled
              questions: enabled
                ? state.questions
                : state.questions.map((q) => ({ ...q, points: 0 })),
            }));
          },

          // ── Question CRUD ────────────────────────────────────────────
          addQuestion: (overrides) => {
            const newQuestion = createDefaultQuestion(overrides);
            set((state) => ({
              questions: [...state.questions, newQuestion],
              expandedQuestionId: newQuestion.id,
            }));
            return newQuestion.id;
          },

          removeQuestion: (id) => {
            const state = get();
            if (state.questions.length <= 1) return;
            set((prev) => {
              const remaining = prev.questions.filter((q) => q.id !== id);
              return {
                questions: remaining,
                expandedQuestionId:
                  prev.expandedQuestionId === id
                    ? remaining[0]?.id ?? null
                    : prev.expandedQuestionId,
                selectedQuestionIds: prev.selectedQuestionIds.filter((sid) => sid !== id),
              };
            });
          },

          updateQuestion: (id, updates) => {
            set((state) => ({
              questions: state.questions.map((q) =>
                q.id === id ? { ...q, ...updates } : q
              ),
            }));
          },

          duplicateQuestion: (id) => {
            const state = get();
            const original = state.questions.find((q) => q.id === id);
            if (!original) return null;
            const newId = generateQuestionId();
            const duplicate: BuilderQuestionData = {
              ...original,
              id: newId,
              text: `${original.text} (copy)`,
            };
            const index = state.questions.findIndex((q) => q.id === id);
            const newQuestions = [...state.questions];
            newQuestions.splice(index + 1, 0, duplicate);
            set({ questions: newQuestions, expandedQuestionId: newId });
            return newId;
          },

          reorderQuestions: (fromIndex, toIndex) => {
            set((state) => {
              const newQuestions = [...state.questions];
              const [moved] = newQuestions.splice(fromIndex, 1);
              newQuestions.splice(toIndex, 0, moved);
              return { questions: newQuestions };
            });
          },

          // ── Bulk Operations ──────────────────────────────────────────
          bulkAddQuestions: (questions) => {
            set((state) => ({
              questions: [...state.questions, ...questions],
            }));
          },

          bulkDeleteQuestions: (ids) => {
            const state = get();
            if (state.questions.length <= ids.length) return; // Must keep at least 1
            const idSet = new Set(ids);
            set((prev) => ({
              questions: prev.questions.filter((q) => !idSet.has(q.id)),
              isMultiSelectMode: false,
              selectedQuestionIds: [],
              expandedQuestionId: idSet.has(prev.expandedQuestionId ?? '')
                ? prev.questions.find((q) => !idSet.has(q.id))?.id ?? null
                : prev.expandedQuestionId,
            }));
          },

          bulkDuplicateQuestions: (ids) => {
            const state = get();
            const newIds: string[] = [];
            const newQuestions = [...state.questions];
            // Insert duplicates right after each original, in reverse order to maintain positions
            const sortedIndices = ids
              .map((id) => state.questions.findIndex((q) => q.id === id))
              .filter((i) => i !== -1)
              .sort((a, b) => b - a); // reverse so insertions don't shift indices

            for (const index of sortedIndices) {
              const original = newQuestions[index];
              const newId = generateQuestionId();
              newIds.push(newId);
              newQuestions.splice(index + 1, 0, {
                ...original,
                id: newId,
                text: `${original.text} (copy)`,
              });
            }
            set({ questions: newQuestions, isMultiSelectMode: false, selectedQuestionIds: [] });
            return newIds;
          },

          // ── Multi-select ─────────────────────────────────────────────
          toggleMultiSelectMode: () => {
            set((state) => ({
              isMultiSelectMode: !state.isMultiSelectMode,
              selectedQuestionIds: state.isMultiSelectMode ? [] : state.selectedQuestionIds,
            }));
          },

          toggleQuestionSelection: (id) => {
            set((state) => {
              const isSelected = state.selectedQuestionIds.includes(id);
              return {
                selectedQuestionIds: isSelected
                  ? state.selectedQuestionIds.filter((sid) => sid !== id)
                  : [...state.selectedQuestionIds, id],
              };
            });
          },

          selectAllQuestions: () => {
            set((state) => ({
              selectedQuestionIds: state.questions.map((q) => q.id),
            }));
          },

          clearSelection: () => {
            set({ selectedQuestionIds: [], isMultiSelectMode: false });
          },

          // ── Option Helpers ───────────────────────────────────────────
          addOption: (questionId) => {
            set((state) => ({
              questions: state.questions.map((q) => {
                if (q.id !== questionId || q.options.length >= 10) return q;
                return { ...q, options: [...q.options, `Option ${q.options.length + 1}`] };
              }),
            }));
          },

          removeOption: (questionId, optionIndex) => {
            set((state) => ({
              questions: state.questions.map((q) => {
                if (q.id !== questionId) return q;
                return { ...q, options: q.options.filter((_, i) => i !== optionIndex) };
              }),
            }));
          },

          updateOption: (questionId, optionIndex, value) => {
            set((state) => ({
              questions: state.questions.map((q) => {
                if (q.id !== questionId) return q;
                const newOptions = [...q.options];
                newOptions[optionIndex] = value;
                return { ...q, options: newOptions };
              }),
            }));
          },

          // ── Conditional Logic ────────────────────────────────────────
          setConditionalLogic: (questionId, config) => {
            set((state) => ({
              questions: state.questions.map((q) =>
                q.id === questionId ? { ...q, conditionalLogic: config } : q
              ),
            }));
          },

          // ── File Upload Config ───────────────────────────────────────
          setFileUploadConfig: (questionId, config) => {
            set((state) => ({
              questions: state.questions.map((q) =>
                q.id === questionId ? { ...q, fileUploadConfig: config } : q
              ),
            }));
          },

          // ── UI ───────────────────────────────────────────────────────
          setExpandedQuestion: (id) => set({ expandedQuestionId: id }),

          // ── Import / Load ────────────────────────────────────────────
          loadQuestions: (questions) => {
            set({
              questions: questions.length > 0 ? questions : [createDefaultQuestion()],
              expandedQuestionId: questions[0]?.id ?? null,
              selectedQuestionIds: [],
              isMultiSelectMode: false,
            });
          },

          loadDraft: (draft) => {
            set({
              surveyTitle: draft.title,
              surveyDescription: draft.description,
              questions: draft.questions.length > 0 ? draft.questions : [createDefaultQuestion()],
              draftId: draft.draftId,
              expandedQuestionId: draft.questions[0]?.id ?? null,
              selectedQuestionIds: [],
              isMultiSelectMode: false,
            });
          },

          // ── Reset ────────────────────────────────────────────────────
          resetBuilder: () => {
            questionCounter = 0;
            set({
              ...initialState,
              questions: [createDefaultQuestion({ id: 'q1' })],
            });
            // Also clear undo history
            const state = get();
            if (state.clearHistory) state.clearHistory();
          },

          // ── Badges ───────────────────────────────────────────────────
          checkBadges: () => {
            const state = get();
            const newBadges = BADGE_CHECKS
              .filter((b) => b.check(state) && !state.earnedBadges.includes(b.id))
              .map((b) => b.id);
            if (newBadges.length > 0) {
              set({ earnedBadges: [...state.earnedBadges, ...newBadges] });
            }
          },
        }),
        {
          // Only track questions array for undo/redo
          partialize: (state: SurveyBuilderState) => ({
            questions: state.questions,
          }),
          limit: 50,
          coalesceMs: 1000,
        }
      ),
      {
        name: 'survey-builder-storage',
        storage: createJSONStorage(() => AsyncStorage),
        version: 2,
        migrate: (persistedState: unknown, version: number) => {
          const state = persistedState as Record<string, unknown>;
          if (version === 0) {
            // Ensure all questions have conditionalLogic and fileUploadConfig fields
            if (Array.isArray(state.questions)) {
              state.questions = (state.questions as any[]).map(q => ({
                ...q,
                conditionalLogic: q.conditionalLogic ?? null,
                fileUploadConfig: q.fileUploadConfig ?? null,
              }));
            }
            // Ensure earnedBadges exists
            if (!state.earnedBadges) {
              state.earnedBadges = [];
            }
          }
          if (version < 2) {
            // Add points field to all questions and isScoringEnabled
            if (Array.isArray(state.questions)) {
              state.questions = (state.questions as any[]).map(q => ({
                ...q,
                points: q.points ?? 0,
              }));
            }
            if (state.isScoringEnabled === undefined) {
              state.isScoringEnabled = false;
            }
          }
          return state;
        },
        partialize: (state) => ({
          // Persist: questions, metadata, badges, scoring — NOT undo history or UI ephemera
          surveyTitle: state.surveyTitle,
          surveyDescription: state.surveyDescription,
          draftId: state.draftId,
          lastSavedAt: state.lastSavedAt,
          questions: state.questions,
          isScoringEnabled: state.isScoringEnabled,
          earnedBadges: state.earnedBadges,
        }),
      }
    ),
    { name: 'SurveyBuilderStore', enabled: __DEV__ }
  )
);

// ============================================================================
// ATOMIC SELECTORS (stable — no new objects)
// ============================================================================

export const selectQuestions = (state: SurveyBuilderState) => state.questions;
export const selectSurveyTitle = (state: SurveyBuilderState) => state.surveyTitle;
export const selectSurveyDescription = (state: SurveyBuilderState) => state.surveyDescription;
export const selectDraftId = (state: SurveyBuilderState) => state.draftId;
export const selectExpandedQuestionId = (state: SurveyBuilderState) => state.expandedQuestionId;
export const selectIsMultiSelectMode = (state: SurveyBuilderState) => state.isMultiSelectMode;
export const selectSelectedQuestionIds = (state: SurveyBuilderState) => state.selectedQuestionIds;
export const selectIsScoringEnabled = (state: SurveyBuilderState) => state.isScoringEnabled;
export const selectEarnedBadges = (state: SurveyBuilderState) => state.earnedBadges;
export const selectQuestionsCount = (state: SurveyBuilderState) => state.questions.length;
export const selectCanUndo = (state: { canUndo: boolean }) => state.canUndo;
export const selectCanRedo = (state: { canRedo: boolean }) => state.canRedo;

// ============================================================================
// OBJECT SELECTORS (use with useShallow)
// ============================================================================

export const selectBuilderMeta = (state: SurveyBuilderState) => ({
  title: state.surveyTitle,
  description: state.surveyDescription,
  draftId: state.draftId,
  questionsCount: state.questions.length,
});

export const selectMultiSelectState = (state: SurveyBuilderState) => ({
  isMultiSelectMode: state.isMultiSelectMode,
  selectedCount: state.selectedQuestionIds.length,
  selectedIds: state.selectedQuestionIds,
});

/**
 * 2026 Pattern: Dedicated actions selector
 * Returns only action methods (stable references, won't trigger re-renders)
 */
export const selectBuilderActions = (state: SurveyBuilderState) => ({
  addQuestion: state.addQuestion,
  removeQuestion: state.removeQuestion,
  updateQuestion: state.updateQuestion,
  reorderQuestions: state.reorderQuestions,
  setExpandedQuestion: state.setExpandedQuestion,
  addOption: state.addOption,
  removeOption: state.removeOption,
  updateOption: state.updateOption,
  loadQuestions: state.loadQuestions,
  setSurveyTitle: state.setSurveyTitle,
  setSurveyDescription: state.setSurveyDescription,
  checkBadges: state.checkBadges,
  toggleMultiSelectMode: state.toggleMultiSelectMode,
  toggleQuestionSelection: state.toggleQuestionSelection,
  setScoringEnabled: state.setScoringEnabled,
});

// ============================================================================
// CONVENIENCE HOOKS (pre-wrapped with useShallow)
// ============================================================================

export const useBuilderMeta = () => useSurveyBuilderStore(useShallow(selectBuilderMeta));
export const useMultiSelectState = () => useSurveyBuilderStore(useShallow(selectMultiSelectState));
export const useBuilderActions = () => useSurveyBuilderStore(useShallow(selectBuilderActions));
