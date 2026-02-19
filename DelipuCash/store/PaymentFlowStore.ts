/**
 * PaymentFlowStore — Zustand store for payment method preferences.
 * Persists the user's preferred payment method and last-used MoMo details.
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type PaymentMethodPref = 'GOOGLE_PLAY' | 'MTN_MOMO' | 'AIRTEL_MONEY' | null;

interface PaymentFlowState {
  preferredMethod: PaymentMethodPref;
  lastUsedPhone: string | null;
  lastUsedProvider: 'MTN' | 'AIRTEL' | null;
}

interface PaymentFlowActions {
  setPreferredMethod: (method: PaymentMethodPref) => void;
  setLastUsedDetails: (phone: string, provider: 'MTN' | 'AIRTEL') => void;
  reset: () => void;
}

const initialState: PaymentFlowState = {
  preferredMethod: null,
  lastUsedPhone: null,
  lastUsedProvider: null,
};

export const usePaymentFlowStore = create<PaymentFlowState & PaymentFlowActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        setPreferredMethod: (method) => set({ preferredMethod: method }),
        setLastUsedDetails: (phone, provider) =>
          set({ lastUsedPhone: phone, lastUsedProvider: provider }),
        reset: () => set(initialState),
      }),
      {
        name: '@payment_flow',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          preferredMethod: state.preferredMethod,
          lastUsedPhone: state.lastUsedPhone,
          lastUsedProvider: state.lastUsedProvider,
        }),
      },
    ),
    { name: 'PaymentFlowStore', enabled: __DEV__ },
  ),
);

// Selectors
export const selectPreferredMethod = (s: PaymentFlowState) => s.preferredMethod;
export const selectLastUsedPhone = (s: PaymentFlowState) => s.lastUsedPhone;
export const selectLastUsedProvider = (s: PaymentFlowState) => s.lastUsedProvider;
