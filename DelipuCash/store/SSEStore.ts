/**
 * SSE Connection State Store
 *
 * Tracks the SSE connection status in Zustand so components
 * can reactively display connection indicators or fallback UI.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SSEConnectionStatus } from '@/services/sse/types';

export interface SSEState {
  status: SSEConnectionStatus;
  lastEventId: string | null;
  reconnectAttempt: number;
  lastError: string | null;
  isEnabled: boolean;
  /** Epoch ms — burst polling active until this time (0 = inactive) */
  burstUntil: number;
}

export interface SSEActions {
  setStatus: (status: SSEConnectionStatus) => void;
  setLastEventId: (id: string | null) => void;
  setReconnectAttempt: (attempt: number) => void;
  setLastError: (error: string | null) => void;
  setEnabled: (enabled: boolean) => void;
  /** Activate burst polling for `durationMs` (default 120 000 = 2 min) */
  startBurstPolling: (durationMs?: number) => void;
}

export const useSSEStore = create<SSEState & SSEActions>()(
  devtools((set) => ({
  status: 'disconnected',
  lastEventId: null,
  reconnectAttempt: 0,
  lastError: null,
  isEnabled: true,
  burstUntil: 0,

  setStatus: (status) => set({ status }),
  setLastEventId: (id) => set({ lastEventId: id }),
  setReconnectAttempt: (attempt) => set({ reconnectAttempt: attempt }),
  setLastError: (error) => set({ lastError: error }),
  setEnabled: (enabled) => set({ isEnabled: enabled }),
  startBurstPolling: (durationMs = 120_000) =>
    set({ burstUntil: Date.now() + durationMs }),
}),
  { name: 'SSEStore', enabled: __DEV__ },
  )
);

// Selectors
export const selectSSEStatus = (state: SSEState) => state.status;
export const selectSSEConnected = (state: SSEState) => state.status === 'connected';
export const selectSSEEnabled = (state: SSEState) => state.isEnabled;

/**
 * Returns true when SSE is NOT delivering real-time events,
 * meaning consumers should fall back to periodic polling.
 */
export const selectNeedsPolling = (state: SSEState) =>
  state.status !== 'connected' && state.status !== 'connecting';

/** Returns true when burst polling window is active */
export const selectIsBursting = (state: SSEState) =>
  state.burstUntil > Date.now();
