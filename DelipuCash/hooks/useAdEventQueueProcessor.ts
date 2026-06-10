/**
 * useAdEventQueueProcessor
 *
 * Replays queued ad impression/click events (persisted by AdEventQueueStore) when the
 * device comes back online, and once on mount for events left over from a previous session.
 * Mount ONCE in _layout.tsx, alongside useOfflineQueueProcessor.
 *
 * Each event carries its eventId, so replays are idempotent — the server dedups on eventId
 * and counts it at most once. An event that keeps failing is discarded after MAX_RETRIES so
 * the queue can't grow stuck.
 */
import { useEffect, useRef } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { adApi } from '@/services/adApi';
import { useAdEventQueueStore, type QueuedAdEvent } from '@/store/AdEventQueueStore';
import type { AdImpressionPayload, AdClickPayload } from '@/services/adApi';

const MAX_RETRIES = 3;

async function sendQueuedEvent(ev: QueuedAdEvent): Promise<boolean> {
  const res =
    ev.kind === 'impression'
      ? await adApi.recordAdImpression(ev.payload as AdImpressionPayload)
      : await adApi.recordAdClick(ev.payload as AdClickPayload);
  return !!res?.success;
}

export function useAdEventQueueProcessor() {
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const flush = async () => {
      if (isProcessingRef.current) return;
      if (!onlineManager.isOnline()) return;

      const pending = [...useAdEventQueueStore.getState().pending];
      if (pending.length === 0) return;

      isProcessingRef.current = true;
      try {
        for (const ev of pending) {
          let ok = false;
          try {
            ok = await sendQueuedEvent(ev);
          } catch {
            ok = false;
          }
          const store = useAdEventQueueStore.getState();
          if (ok) {
            store.remove(ev.eventId); // delivered (or deduped server-side)
          } else if (ev.retries + 1 >= MAX_RETRIES) {
            store.remove(ev.eventId); // give up — analytics event, not worth blocking on
          } else {
            store.bumpRetry(ev.eventId); // stays queued for the next online event
          }
        }
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Replay whenever connectivity returns…
    const unsubscribe = onlineManager.subscribe((isOnline) => {
      if (isOnline) flush();
    });
    // …and once on mount if already online (app restart with a stale queue).
    if (onlineManager.isOnline()) flush();

    return unsubscribe;
  }, []);
}
