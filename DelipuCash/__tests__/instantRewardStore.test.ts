/**
 * InstantRewardStore selector tests.
 *
 * These exercise pure selector logic — wallet sync, redeemability, session
 * activity — without needing AsyncStorage / Zustand persist round-trips.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(),
    getItem: jest.fn(() => Promise.resolve(null)),
    removeItem: jest.fn(),
  },
}));

import {
  selectWalletBalance,
  selectAttemptedCount,
  selectIsSessionActive,
  selectHasPendingSubmissions,
} from '../store/InstantRewardStore';

describe('InstantRewardStore selectors', () => {
  it('selectWalletBalance returns the stored balance', () => {
    const state: any = { walletBalance: 1234 };
    expect(selectWalletBalance(state)).toBe(1234);
  });

  it('selectAttemptedCount counts entries', () => {
    const state: any = {
      attemptHistory: { q1: { attemptedAt: 1 }, q2: { attemptedAt: 2 }, q3: { attemptedAt: 3 } },
    };
    expect(selectAttemptedCount(state)).toBe(3);
  });

  it('selectIsSessionActive false when sessionState is IDLE', () => {
    const state: any = { sessionState: 'IDLE' };
    expect(selectIsSessionActive(state)).toBe(false);
  });

  it('selectHasPendingSubmissions reflects queue length', () => {
    expect(selectHasPendingSubmissions({ pendingSubmissions: [] } as any)).toBe(false);
    expect(selectHasPendingSubmissions({ pendingSubmissions: [{ id: 'p1' }] } as any)).toBe(true);
  });
});
