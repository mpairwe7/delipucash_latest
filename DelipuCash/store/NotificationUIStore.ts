/**
 * NotificationUIStore — Zustand store for Notification screen UI state.
 * Persists the user's selected filter across app restarts.
 * Mirrors TransactionUIStore architecture.
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationFilterType } from '@/types';

interface NotificationUIState {
  selectedFilter: NotificationFilterType;
  selectedNotificationId: string | null;
}

interface NotificationUIActions {
  setSelectedFilter: (filter: NotificationFilterType) => void;
  openDetail: (notificationId: string) => void;
  closeDetail: () => void;
}

const initialState: NotificationUIState = {
  selectedFilter: 'all',
  selectedNotificationId: null,
};

export const useNotificationUIStore = create<NotificationUIState & NotificationUIActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        setSelectedFilter: (filter) => set({ selectedFilter: filter }),
        openDetail: (notificationId) => set({ selectedNotificationId: notificationId }),
        closeDetail: () => set({ selectedNotificationId: null }),
      }),
      {
        name: '@notification_ui',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          selectedFilter: state.selectedFilter,
          // selectedNotificationId is transient — NOT persisted
        }),
      },
    ),
    { name: 'NotificationUIStore', enabled: __DEV__ },
  ),
);

// State selectors (stable references)
export const selectNotificationFilter = (s: NotificationUIState) => s.selectedFilter;
export const selectSelectedNotificationId = (s: NotificationUIState) => s.selectedNotificationId;

// Action selectors (stable references — avoids inline `(s) => s.action` per render)
export const selectSetNotificationFilter = (s: NotificationUIState & NotificationUIActions) =>
  s.setSelectedFilter;
export const selectOpenNotificationDetail = (s: NotificationUIState & NotificationUIActions) =>
  s.openDetail;
export const selectCloseNotificationDetail = (s: NotificationUIState & NotificationUIActions) =>
  s.closeDetail;
