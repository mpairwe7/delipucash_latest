/**
 * AdEventQueueStore — persisted offline queue for ad impression/click events.
 *
 * Ad tracking is fire-and-forget, so a failed send (offline / flaky network) would lose a
 * billable event. This queue persists failed events to AsyncStorage and `useAdEventQueueProcessor`
 * replays them when connectivity returns. Each event carries its `eventId`, so a replay is
 * safe — the server dedups on `eventId` and counts it at most once.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AdImpressionPayload, AdClickPayload } from '../services/adApi';

export type QueuedAdEventKind = 'impression' | 'click';

export interface QueuedAdEvent {
  kind: QueuedAdEventKind;
  /** Idempotency key — the server dedups on this, so re-sends never double-count. */
  eventId: string;
  payload: AdImpressionPayload | AdClickPayload;
  enqueuedAt: number;
  retries: number;
}

/** Cap the queue so a long offline period can't grow it without bound (keep most recent). */
export const MAX_AD_EVENT_QUEUE = 200;

interface AdEventQueueState {
  pending: QueuedAdEvent[];
  enqueue: (e: { kind: QueuedAdEventKind; eventId: string; payload: AdImpressionPayload | AdClickPayload }) => void;
  remove: (eventId: string) => void;
  bumpRetry: (eventId: string) => void;
  clear: () => void;
}

export const useAdEventQueueStore = create<AdEventQueueState>()(
  persist(
    (set, get) => ({
      pending: [],

      enqueue: ({ kind, eventId, payload }) => {
        const pending = get().pending;
        if (pending.some((e) => e.eventId === eventId)) return; // already queued
        const next = [...pending, { kind, eventId, payload, enqueuedAt: Date.now(), retries: 0 }];
        set({ pending: next.length > MAX_AD_EVENT_QUEUE ? next.slice(next.length - MAX_AD_EVENT_QUEUE) : next });
      },

      remove: (eventId) => set({ pending: get().pending.filter((e) => e.eventId !== eventId) }),

      bumpRetry: (eventId) =>
        set({
          pending: get().pending.map((e) => (e.eventId === eventId ? { ...e, retries: e.retries + 1 } : e)),
        }),

      clear: () => set({ pending: [] }),
    }),
    { name: 'ad-event-queue', storage: createJSONStorage(() => AsyncStorage) }
  )
);
