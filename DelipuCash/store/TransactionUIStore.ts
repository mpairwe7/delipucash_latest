/**
 * TransactionUIStore — Zustand store for Transaction screen UI state.
 * Persists the user's selected filter across app restarts.
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TransactionFilterType } from '@/types';

interface TransactionUIState {
  selectedFilter: TransactionFilterType;
  selectedTransactionId: string | null;
}

interface TransactionUIActions {
  setSelectedFilter: (filter: TransactionFilterType) => void;
  openDetail: (transactionId: string) => void;
  closeDetail: () => void;
}

const initialState: TransactionUIState = {
  selectedFilter: 'all',
  selectedTransactionId: null,
};

export const useTransactionUIStore = create<TransactionUIState & TransactionUIActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        setSelectedFilter: (filter) => set({ selectedFilter: filter }),
        openDetail: (transactionId) => set({ selectedTransactionId: transactionId }),
        closeDetail: () => set({ selectedTransactionId: null }),
      }),
      {
        name: '@transaction_ui',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          selectedFilter: state.selectedFilter,
        }),
      },
    ),
    { name: 'TransactionUIStore', enabled: __DEV__ },
  ),
);

// State selectors
export const selectSelectedFilter = (s: TransactionUIState) => s.selectedFilter;
export const selectSelectedTransactionId = (s: TransactionUIState) => s.selectedTransactionId;

// Action selectors (stable references — avoids inline `(s) => s.action` per render)
export const selectSetSelectedFilter = (s: TransactionUIState & TransactionUIActions) => s.setSelectedFilter;
export const selectOpenDetail = (s: TransactionUIState & TransactionUIActions) => s.openDetail;
export const selectCloseDetail = (s: TransactionUIState & TransactionUIActions) => s.closeDetail;
