/**
 * Survey UI Store - Client State Management
 * Zustand store for survey landing, creation, and discovery UI state
 * 
 * Architecture (Industry Standard 2025/2026):
 * - This store handles ONLY client-side state (view mode, filters, UI preferences)
 * - Server state (surveys, responses) is managed by TanStack Query
 * - Optimistic updates coordinated between store and query cache
 * 
 * Features:
 * - Tab navigation (My Surveys, Discover, Running, Upcoming)
 * - Creation mode selection (Blank, Template, Import, Conversational)
 * - Filter and sort preferences
 * - Draft autosave tracking
 * - Accessibility preferences
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

export type SurveyLandingTab = 'my-surveys' | 'discover' | 'running' | 'upcoming';
export type MySurveyFilter = 'all' | 'drafts' | 'active' | 'closed';
export type SortOption = 'newest' | 'oldest' | 'responses' | 'completion' | 'reward';
export type CreationMode = 'blank' | 'template' | 'import' | 'conversational' | 'ai-assisted';
export type BuilderViewMode = 'classic' | 'conversational' | 'preview';

export interface SurveyDraft {
  id: string;
  title: string;
  questionsCount: number;
  lastEditedAt: string;
  autoSavedAt?: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export interface SurveyFilters {
  search?: string;
  mySurveyFilter: MySurveyFilter;
  sortBy: SortOption;
  categories: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface SurveyUIState {
  // Navigation
  activeTab: SurveyLandingTab;
  
  // Filters (persisted)
  filters: SurveyFilters;
  
  // Creation flow
  creationMode: CreationMode | null;
  showCreationModal: boolean;
  builderViewMode: BuilderViewMode;
  
  // Drafts tracking
  drafts: SurveyDraft[];
  currentDraftId: string | null;
  hasUnsavedChanges: boolean;
  
  // Template gallery
  selectedTemplateCategory: string | null;
  templateSearchQuery: string;
  
  // Sharing
  showShareModal: boolean;
  shareTargetSurveyId: string | null;
  
  // UI preferences (persisted)
  showCompletionRates: boolean;
  showResponseCounts: boolean;
  cardViewStyle: 'compact' | 'detailed' | 'grid';
  
  // Accessibility
  prefersReducedMotion: boolean;
  prefersHighContrast: boolean;
  
  // Onboarding
  hasSeenOnboarding: boolean;
  hasSeenTemplatesHint: boolean;
  hasSeenImportHint: boolean;
}

export interface SurveyUIActions {
  // Tab navigation
  setActiveTab: (tab: SurveyLandingTab) => void;
  
  // Filters
  setFilters: (filters: Partial<SurveyFilters>) => void;
  setSearch: (query: string) => void;
  clearFilters: () => void;
  
  // Creation flow
  openCreationModal: () => void;
  closeCreationModal: () => void;
  setCreationMode: (mode: CreationMode | null) => void;
  setBuilderViewMode: (mode: BuilderViewMode) => void;
  
  // Drafts
  addDraft: (draft: SurveyDraft) => void;
  updateDraft: (id: string, updates: Partial<SurveyDraft>) => void;
  removeDraft: (id: string) => void;
  setCurrentDraft: (id: string | null) => void;
  setHasUnsavedChanges: (has: boolean) => void;
  
  // Templates
  setSelectedTemplateCategory: (category: string | null) => void;
  setTemplateSearchQuery: (query: string) => void;
  
  // Sharing
  openShareModal: (surveyId: string) => void;
  closeShareModal: () => void;
  
  // UI preferences
  toggleCompletionRates: () => void;
  toggleResponseCounts: () => void;
  setCardViewStyle: (style: 'compact' | 'detailed' | 'grid') => void;
  
  // Accessibility
  setPrefersReducedMotion: (prefers: boolean) => void;
  setPrefersHighContrast: (prefers: boolean) => void;
  
  // Onboarding
  markOnboardingSeen: () => void;
  markTemplatesHintSeen: () => void;
  markImportHintSeen: () => void;
  
  // Reset
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialFilters: SurveyFilters = {
  search: '',
  mySurveyFilter: 'all',
  sortBy: 'newest',
  categories: [],
};

const initialState: SurveyUIState = {
  activeTab: 'my-surveys',
  filters: initialFilters,
  creationMode: null,
  showCreationModal: false,
  builderViewMode: 'classic',
  drafts: [],
  currentDraftId: null,
  hasUnsavedChanges: false,
  selectedTemplateCategory: null,
  templateSearchQuery: '',
  showShareModal: false,
  shareTargetSurveyId: null,
  showCompletionRates: true,
  showResponseCounts: true,
  cardViewStyle: 'detailed',
  prefersReducedMotion: false,
  prefersHighContrast: false,
  hasSeenOnboarding: false,
  hasSeenTemplatesHint: false,
  hasSeenImportHint: false,
};

// ============================================================================
// STORE
// ============================================================================

export const useSurveyUIStore = create<SurveyUIState & SurveyUIActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Tab navigation
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Filters
      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),
      
      setSearch: (query) =>
        set((state) => ({
          filters: { ...state.filters, search: query },
        })),
      
      clearFilters: () =>
        set({ filters: initialFilters }),

      // Creation flow
      openCreationModal: () => set({ showCreationModal: true }),
      closeCreationModal: () => set({ showCreationModal: false, creationMode: null }),
      setCreationMode: (mode) => set({ creationMode: mode }),
      setBuilderViewMode: (mode) => set({ builderViewMode: mode }),

      // Drafts
      addDraft: (draft) =>
        set((state) => ({
          drafts: [draft, ...state.drafts.filter((d) => d.id !== draft.id)],
        })),
      
      updateDraft: (id, updates) =>
        set((state) => ({
          drafts: state.drafts.map((d) =>
            d.id === id ? { ...d, ...updates, lastEditedAt: new Date().toISOString() } : d
          ),
        })),
      
      removeDraft: (id) =>
        set((state) => ({
          drafts: state.drafts.filter((d) => d.id !== id),
          currentDraftId: state.currentDraftId === id ? null : state.currentDraftId,
        })),
      
      setCurrentDraft: (id) => set({ currentDraftId: id }),
      setHasUnsavedChanges: (has) => set({ hasUnsavedChanges: has }),

      // Templates
      setSelectedTemplateCategory: (category) => set({ selectedTemplateCategory: category }),
      setTemplateSearchQuery: (query) => set({ templateSearchQuery: query }),

      // Sharing
      openShareModal: (surveyId) =>
        set({ showShareModal: true, shareTargetSurveyId: surveyId }),
      closeShareModal: () =>
        set({ showShareModal: false, shareTargetSurveyId: null }),

      // UI preferences
      toggleCompletionRates: () =>
        set((state) => ({ showCompletionRates: !state.showCompletionRates })),
      toggleResponseCounts: () =>
        set((state) => ({ showResponseCounts: !state.showResponseCounts })),
      setCardViewStyle: (style) => set({ cardViewStyle: style }),

      // Accessibility
      setPrefersReducedMotion: (prefers) => set({ prefersReducedMotion: prefers }),
      setPrefersHighContrast: (prefers) => set({ prefersHighContrast: prefers }),

      // Onboarding
      markOnboardingSeen: () => set({ hasSeenOnboarding: true }),
      markTemplatesHintSeen: () => set({ hasSeenTemplatesHint: true }),
      markImportHintSeen: () => set({ hasSeenImportHint: true }),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'survey-ui-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist preferences, not ephemeral UI state
        filters: state.filters,
        drafts: state.drafts,
        showCompletionRates: state.showCompletionRates,
        showResponseCounts: state.showResponseCounts,
        cardViewStyle: state.cardViewStyle,
        prefersReducedMotion: state.prefersReducedMotion,
        prefersHighContrast: state.prefersHighContrast,
        hasSeenOnboarding: state.hasSeenOnboarding,
        hasSeenTemplatesHint: state.hasSeenTemplatesHint,
        hasSeenImportHint: state.hasSeenImportHint,
      }),
    }
  )
);

// ============================================================================
// SELECTORS (for optimized re-renders)
// ============================================================================

export const selectActiveTab = (state: SurveyUIState) => state.activeTab;
export const selectFilters = (state: SurveyUIState) => state.filters;
export const selectCreationMode = (state: SurveyUIState) => state.creationMode;
export const selectDrafts = (state: SurveyUIState) => state.drafts;
export const selectShowShareModal = (state: SurveyUIState) => state.showShareModal;
export const selectAccessibilityPrefs = (state: SurveyUIState) => ({
  prefersReducedMotion: state.prefersReducedMotion,
  prefersHighContrast: state.prefersHighContrast,
});

// ============================================================================
// TEMPLATE DATA
// ============================================================================

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: 'customer-feedback', name: 'Customer Feedback', icon: 'message-circle', count: 12 },
  { id: 'employee-engagement', name: 'Employee Engagement', icon: 'users', count: 8 },
  { id: 'market-research', name: 'Market Research', icon: 'trending-up', count: 15 },
  { id: 'product-feedback', name: 'Product Feedback', icon: 'package', count: 10 },
  { id: 'event-feedback', name: 'Event Feedback', icon: 'calendar', count: 6 },
  { id: 'education', name: 'Education', icon: 'book-open', count: 9 },
  { id: 'healthcare', name: 'Healthcare', icon: 'heart', count: 7 },
  { id: 'nps', name: 'NPS & CSAT', icon: 'star', count: 5 },
];

export interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  questionsCount: number;
  estimatedTime: number;
  thumbnail?: string;
  isPremium: boolean;
  tags: string[];
  previewQuestions: string[];
}

export const FEATURED_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'nps-simple',
    name: 'Net Promoter Score (NPS)',
    description: 'Measure customer loyalty with the classic NPS question and follow-up',
    categoryId: 'nps',
    questionsCount: 3,
    estimatedTime: 2,
    isPremium: false,
    tags: ['nps', 'loyalty', 'quick'],
    previewQuestions: [
      'How likely are you to recommend us to a friend?',
      'What is the primary reason for your score?',
    ],
  },
  {
    id: 'csat-standard',
    name: 'Customer Satisfaction (CSAT)',
    description: 'Comprehensive satisfaction survey with multiple touchpoints',
    categoryId: 'customer-feedback',
    questionsCount: 8,
    estimatedTime: 5,
    isPremium: false,
    tags: ['csat', 'satisfaction', 'customer'],
    previewQuestions: [
      'How satisfied are you with our product/service?',
      'How would you rate the quality of our customer support?',
    ],
  },
  {
    id: 'employee-pulse',
    name: 'Employee Pulse Check',
    description: 'Quick weekly check-in to gauge team morale and engagement',
    categoryId: 'employee-engagement',
    questionsCount: 5,
    estimatedTime: 3,
    isPremium: false,
    tags: ['hr', 'engagement', 'pulse'],
    previewQuestions: [
      'How are you feeling about your work this week?',
      'Do you have the resources you need to succeed?',
    ],
  },
  {
    id: 'product-discovery',
    name: 'Product Discovery Interview',
    description: 'Deep dive into user needs and pain points for product development',
    categoryId: 'product-feedback',
    questionsCount: 12,
    estimatedTime: 10,
    isPremium: true,
    tags: ['product', 'discovery', 'user-research'],
    previewQuestions: [
      'What is the biggest challenge you face in your workflow?',
      'How do you currently solve this problem?',
    ],
  },
  {
    id: 'event-post',
    name: 'Post-Event Feedback',
    description: 'Gather attendee feedback after conferences, webinars, or meetings',
    categoryId: 'event-feedback',
    questionsCount: 7,
    estimatedTime: 4,
    isPremium: false,
    tags: ['event', 'conference', 'feedback'],
    previewQuestions: [
      'How would you rate the overall event experience?',
      'What was the most valuable part of the event?',
    ],
  },
  {
    id: 'market-segmentation',
    name: 'Market Segmentation Survey',
    description: 'Identify customer segments for targeted marketing strategies',
    categoryId: 'market-research',
    questionsCount: 15,
    estimatedTime: 12,
    isPremium: true,
    tags: ['market', 'segmentation', 'demographics'],
    previewQuestions: [
      'Which industry do you work in?',
      'What is your company size?',
    ],
  },
];
