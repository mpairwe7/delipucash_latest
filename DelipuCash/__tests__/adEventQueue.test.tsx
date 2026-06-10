/**
 * Offline ad-event queue: persist failed impression/click events and replay them on
 * reconnect, idempotently (server dedups on eventId). Covers the store semantics and the
 * processor's replay / retry / discard behaviour.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { useAdEventQueueStore } from '@/store/AdEventQueueStore';
import { useAdEventQueueProcessor } from '@/hooks/useAdEventQueueProcessor';
import { adApi } from '@/services/adApi';

jest.mock('@/services/adApi', () => ({
  adApi: {
    recordAdImpression: jest.fn().mockResolvedValue({ success: true }),
    recordAdClick: jest.fn().mockResolvedValue({ success: true }),
  },
}));

const recordAdImpression = adApi.recordAdImpression as jest.Mock;
const recordAdClick = adApi.recordAdClick as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const enqueue = (kind: 'impression' | 'click', eventId: string, adId = 'ad-1') =>
  useAdEventQueueStore.getState().enqueue({ kind, eventId, payload: { adId, eventId } as any });

beforeEach(() => {
  useAdEventQueueStore.getState().clear();
  recordAdImpression.mockClear().mockResolvedValue({ success: true });
  recordAdClick.mockClear().mockResolvedValue({ success: true });
  onlineManager.setOnline(true);
});

describe('AdEventQueueStore', () => {
  it('enqueues and dedups by eventId', () => {
    enqueue('impression', 'e1');
    enqueue('impression', 'e1'); // duplicate — ignored
    expect(useAdEventQueueStore.getState().pending).toHaveLength(1);
  });

  it('removes by eventId and bumps retries', () => {
    enqueue('click', 'e2');
    useAdEventQueueStore.getState().bumpRetry('e2');
    expect(useAdEventQueueStore.getState().pending[0].retries).toBe(1);
    useAdEventQueueStore.getState().remove('e2');
    expect(useAdEventQueueStore.getState().pending).toHaveLength(0);
  });
});

describe('useAdEventQueueProcessor', () => {
  it('replays queued events on mount when online and removes the delivered ones', async () => {
    enqueue('impression', 'e1');
    enqueue('click', 'e2');
    renderHook(() => useAdEventQueueProcessor());

    await waitFor(() => expect(useAdEventQueueStore.getState().pending).toHaveLength(0));
    expect(recordAdImpression).toHaveBeenCalledTimes(1);
    expect(recordAdClick).toHaveBeenCalledTimes(1);
  });

  it('keeps an event queued (with a bumped retry) after a single failure', async () => {
    recordAdImpression.mockResolvedValue({ success: false });
    enqueue('impression', 'e3');
    renderHook(() => useAdEventQueueProcessor());

    await waitFor(() => expect(useAdEventQueueStore.getState().pending[0]?.retries).toBe(1));
    expect(useAdEventQueueStore.getState().pending).toHaveLength(1);
  });

  it('discards an event after MAX_RETRIES failures', async () => {
    recordAdClick.mockResolvedValue({ success: false });
    enqueue('click', 'e4');
    useAdEventQueueStore.getState().bumpRetry('e4');
    useAdEventQueueStore.getState().bumpRetry('e4'); // retries = 2; next failure → discard (>= 3)
    renderHook(() => useAdEventQueueProcessor());

    await waitFor(() => expect(useAdEventQueueStore.getState().pending).toHaveLength(0));
  });

  it('does not replay while offline', async () => {
    onlineManager.setOnline(false);
    enqueue('impression', 'e5');
    renderHook(() => useAdEventQueueProcessor());

    // give the effect a tick; nothing should be sent
    await new Promise((r) => setTimeout(r, 30));
    expect(recordAdImpression).not.toHaveBeenCalled();
    expect(useAdEventQueueStore.getState().pending).toHaveLength(1);
    onlineManager.setOnline(true);
  });
});
