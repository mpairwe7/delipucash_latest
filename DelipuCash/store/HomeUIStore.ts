/**
 * HomeUIStore - Lightweight Zustand store for home screen UI state.
 * Persists search query across navigations via AsyncStorage.
 * Consistent with QuestionUIStore / QuestionAnswerStore patterns.
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface HomeUIState {
  searchQuery: string;
  activeModal: string | null;
}

interface HomeUIActions {
  setSearchQuery: (query: string) => void;
  setActiveModal: (modalId: string | null) => void;
  reset: () => void;
}

export const useHomeUIStore = create<HomeUIState & HomeUIActions>()(
  devtools(
  persist(
    (set) => ({
      searchQuery: '',
      activeModal: null,
      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveModal: (modalId) => set({ activeModal: modalId }),
      reset: () => set({ searchQuery: '', activeModal: null }),
    }),
    {
      name: '@home_ui',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ searchQuery: state.searchQuery }),
    }
  ),
  { name: 'HomeUIStore', enabled: __DEV__ },
  )
);

// Granular selectors — avoids full-store subscription
export const selectSearchQuery = (s: HomeUIState) => s.searchQuery;
export const selectActiveModal = (s: HomeUIState) => s.activeModal;
