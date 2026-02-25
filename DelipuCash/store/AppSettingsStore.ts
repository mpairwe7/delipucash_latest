/**
 * AppSettingsStore — Zustand store for app-level quick settings.
 * Persists user preferences (notifications, data saver, haptics) across sessions.
 *
 * Pattern: Follows TransactionUIStore / NotificationUIStore conventions —
 * devtools + persist middleware, atomic selectors, AsyncStorage persistence.
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

interface AppSettingsState {
  /** Whether push notifications are enabled (local preference; OS permission is separate) */
  pushNotificationsEnabled: boolean;
  /** Reduce data usage — lower quality thumbnails, defer autoplay */
  dataSaverEnabled: boolean;
  /** Haptic/vibration feedback on interactions */
  hapticFeedbackEnabled: boolean;
}

interface AppSettingsActions {
  togglePushNotifications: () => void;
  toggleDataSaver: () => void;
  toggleHapticFeedback: () => void;
  /** Reset all preferences to defaults */
  resetSettings: () => void;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const initialState: AppSettingsState = {
  pushNotificationsEnabled: true,
  dataSaverEnabled: false,
  hapticFeedbackEnabled: true,
};

// ============================================================================
// STORE
// ============================================================================

export const useAppSettingsStore = create<AppSettingsState & AppSettingsActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        togglePushNotifications: () =>
          set((s) => ({ pushNotificationsEnabled: !s.pushNotificationsEnabled })),
        toggleDataSaver: () =>
          set((s) => ({ dataSaverEnabled: !s.dataSaverEnabled })),
        toggleHapticFeedback: () =>
          set((s) => ({ hapticFeedbackEnabled: !s.hapticFeedbackEnabled })),
        resetSettings: () => set(initialState),
      }),
      {
        name: '@app_settings',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          pushNotificationsEnabled: state.pushNotificationsEnabled,
          dataSaverEnabled: state.dataSaverEnabled,
          hapticFeedbackEnabled: state.hapticFeedbackEnabled,
        }),
      },
    ),
    { name: 'AppSettingsStore', enabled: __DEV__ },
  ),
);

// ============================================================================
// ATOMIC SELECTORS (stable references — no new objects per render)
// ============================================================================

export const selectPushNotificationsEnabled = (s: AppSettingsState) => s.pushNotificationsEnabled;
export const selectDataSaverEnabled = (s: AppSettingsState) => s.dataSaverEnabled;
export const selectHapticFeedbackEnabled = (s: AppSettingsState) => s.hapticFeedbackEnabled;

// Action selectors
export const selectTogglePushNotifications = (s: AppSettingsState & AppSettingsActions) => s.togglePushNotifications;
export const selectToggleDataSaver = (s: AppSettingsState & AppSettingsActions) => s.toggleDataSaver;
export const selectToggleHapticFeedback = (s: AppSettingsState & AppSettingsActions) => s.toggleHapticFeedback;
export const selectResetSettings = (s: AppSettingsState & AppSettingsActions) => s.resetSettings;
