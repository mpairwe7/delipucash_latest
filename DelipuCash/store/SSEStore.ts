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
}

export interface SSEActions {
  setStatus: (status: SSEConnectionStatus) => void;
  setLastEventId: (id: string | null) => void;
  setReconnectAttempt: (attempt: number) => void;
  setLastError: (error: string | null) => void;
  setEnabled: (enabled: boolean) => void;
}

export const useSSEStore = create<SSEState & SSEActions>()(
  devtools((set) => ({
  status: 'disconnected',
  lastEventId: null,
  reconnectAttempt: 0,
  lastError: null,
  isEnabled: true,

  setStatus: (status) => set({ status }),
  setLastEventId: (id) => set({ lastEventId: id }),
  setReconnectAttempt: (attempt) => set({ reconnectAttempt: attempt }),
  setLastError: (error) => set({ lastError: error }),
  setEnabled: (enabled) => set({ isEnabled: enabled }),
}),
  { name: 'SSEStore', enabled: __DEV__ },
  )
);

// Selectors
export const selectSSEStatus = (state: SSEState) => state.status;
export const selectSSEConnected = (state: SSEState) => state.status === 'connected';
export const selectSSEEnabled = (state: SSEState) => state.isEnabled;
