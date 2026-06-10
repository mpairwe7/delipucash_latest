/**
 * Phase 3 regression: useAdImpressionTracker must record EXACTLY ONE impression per view.
 *
 * The old hook fired in both the invisible branch AND the effect cleanup, so scrolling an
 * ad out of view double-counted it (inflating billable impressions). These lock in:
 *  - one impression per visible→invisible cycle, carrying an idempotency `eventId`,
 *  - one impression on unmount while visible,
 *  - no re-fire on extra invisible re-renders.
 *
 * adApi.recordAdImpression (the network leaf) is mocked; the real hook chain + a
 * QueryClient run so the de-dup logic is exercised end to end.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdImpressionTracker } from '@/services/adHooksRefactored';
import { adApi } from '@/services/adApi';

jest.mock('@/services/adApi', () => ({
  adApi: { recordAdImpression: jest.fn().mockResolvedValue({ success: true }) },
}));
jest.mock('@/store/AdUIStore', () => ({
  __esModule: true,
  useAdUIStore: (selector: (s: { recordImpression: () => void }) => unknown) =>
    selector({ recordImpression: jest.fn() }),
}));

const recordAdImpression = adApi.recordAdImpression as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const ad = { id: 'ad-1' } as Parameters<typeof useAdImpressionTracker>[0];

beforeEach(() => recordAdImpression.mockClear());

describe('useAdImpressionTracker — one impression per view', () => {
  it('records exactly one impression per visible→invisible cycle, with an eventId', async () => {
    const { rerender } = renderHook(
      ({ vis }: { vis: boolean }) => useAdImpressionTracker(ad, 'feed', vis),
      { wrapper, initialProps: { vis: true } }
    );
    rerender({ vis: false });

    await waitFor(() => expect(recordAdImpression).toHaveBeenCalledTimes(1));
    expect(recordAdImpression.mock.calls[0][0].eventId).toBeTruthy();
  });

  it('records once on unmount while still visible', async () => {
    const { unmount } = renderHook(() => useAdImpressionTracker(ad, 'feed', true), { wrapper });
    unmount();
    await waitFor(() => expect(recordAdImpression).toHaveBeenCalledTimes(1));
  });

  it('does not re-fire on extra invisible re-renders (no double-count)', async () => {
    const { rerender } = renderHook(
      ({ vis }: { vis: boolean }) => useAdImpressionTracker(ad, 'feed', vis),
      { wrapper, initialProps: { vis: true } }
    );
    rerender({ vis: false });
    rerender({ vis: false });
    rerender({ vis: false });

    await waitFor(() => expect(recordAdImpression).toHaveBeenCalledTimes(1));
    expect(recordAdImpression).toHaveBeenCalledTimes(1);
  });

  it('records a separate impression for a second view (visible→invisible twice)', async () => {
    const { rerender } = renderHook(
      ({ vis }: { vis: boolean }) => useAdImpressionTracker(ad, 'feed', vis),
      { wrapper, initialProps: { vis: true } }
    );
    rerender({ vis: false }); // view 1 recorded
    rerender({ vis: true });  // new view starts
    rerender({ vis: false }); // view 2 recorded
    await waitFor(() => expect(recordAdImpression).toHaveBeenCalledTimes(2));
  });
});
