/**
 * QuestionUIStore - Lightweight Zustand store for question screen UI state.
 * Persists selected tab across navigations via AsyncStorage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FeedTabId } from '@/services/questionHooks';

interface QuestionUIState {
  selectedTab: FeedTabId;
}

interface QuestionUIActions {
  setSelectedTab: (tab: FeedTabId) => void;
}

export const useQuestionUIStore = create<QuestionUIState & QuestionUIActions>()(
  persist(
    (set) => ({
      selectedTab: 'for-you',
      setSelectedTab: (tab) => set({ selectedTab: tab }),
    }),
    {
      name: '@question_ui',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ selectedTab: state.selectedTab }),
    }
  )
);

/** Granular selector — avoids full-store subscription */
export const selectSelectedTab = (s: QuestionUIState) => s.selectedTab;
