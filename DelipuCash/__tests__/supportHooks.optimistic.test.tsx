/**
 * Tests for the new support hooks (services/supportHooks.ts):
 *
 * - useRateFAQ applies the helpful/notHelpful bump optimistically (before the
 *   request resolves) to BOTH the FAQ list cache and every cached search
 *   result, keeps it on success (no invalidation — the backend doesn't
 *   persist ratings yet), and rolls every cache back on failure.
 * - useSearchFAQs stays idle until the term is meaningful (> 2 chars) and
 *   fetches with the normalized (trimmed/lowercased) term so equivalent
 *   spellings share one cache entry.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { createProvidersWrapper, createTestQueryClient } from '@/test-utils';
import {
  useRateFAQ,
  useSearchFAQs,
  supportQueryKeys,
} from '@/services/supportHooks';
import * as supportApi from '@/services/supportApi';
import type { FAQItem } from '@/services/supportApi';

const faq = (id: string, helpful = 10, notHelpful = 2): FAQItem => ({
  id,
  question: `Question ${id}`,
  answer: 'Answer',
  category: 'payments',
  helpful,
  notHelpful,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

/** Promise whose settlement the test controls, to observe in-flight state. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const faqsIn = (queryClient: ReturnType<typeof createTestQueryClient>) =>
  queryClient.getQueryData<FAQItem[]>(supportQueryKeys.faqs())!;
const searchIn = (queryClient: ReturnType<typeof createTestQueryClient>, term: string) =>
  queryClient.getQueryData<FAQItem[]>(supportQueryKeys.faqSearch(term))!;

describe('useRateFAQ', () => {
  let rateSpy: jest.SpyInstance;

  afterEach(() => rateSpy?.mockRestore());

  it('bumps helpful optimistically in list + search caches and keeps it on success', async () => {
    const request = deferred<{ success: boolean; message: string }>();
    rateSpy = jest.spyOn(supportApi, 'rateFAQ').mockReturnValue(request.promise);

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(supportQueryKeys.faqs(), [faq('faq_1'), faq('faq_2')]);
    queryClient.setQueryData(supportQueryKeys.faqSearch('payment'), [faq('faq_1')]);

    const { result } = renderHook(() => useRateFAQ(), {
      wrapper: createProvidersWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ faqId: 'faq_1', helpful: true });
    });

    // Optimistic: visible while the request is still in flight
    expect(faqsIn(queryClient)[0].helpful).toBe(11);
    expect(searchIn(queryClient, 'payment')[0].helpful).toBe(11);
    // Sibling item and the other counter are untouched
    expect(faqsIn(queryClient)[1].helpful).toBe(10);
    expect(faqsIn(queryClient)[0].notHelpful).toBe(2);

    await act(async () => request.resolve({ success: true, message: 'Thanks!' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // No invalidation-triggered reset — the bump survives settlement
    expect(faqsIn(queryClient)[0].helpful).toBe(11);
    expect(rateSpy).toHaveBeenCalledWith('faq_1', true);
  });

  it('rolls back every cache when the request fails', async () => {
    rateSpy = jest.spyOn(supportApi, 'rateFAQ').mockRejectedValue(new Error('offline'));

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(supportQueryKeys.faqs(), [faq('faq_1')]);
    queryClient.setQueryData(supportQueryKeys.faqSearch('payment'), [faq('faq_1')]);

    const { result } = renderHook(() => useRateFAQ(), {
      wrapper: createProvidersWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ faqId: 'faq_1', helpful: false });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(faqsIn(queryClient)[0].notHelpful).toBe(2);
    expect(searchIn(queryClient, 'payment')[0].notHelpful).toBe(2);
  });
});

describe('useSearchFAQs', () => {
  let searchSpy: jest.SpyInstance;

  afterEach(() => searchSpy?.mockRestore());

  it('stays idle for short terms, then fetches with the normalized term', async () => {
    searchSpy = jest.spyOn(supportApi, 'searchFAQs').mockResolvedValue([faq('faq_1')]);

    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useSearchFAQs(query),
      {
        wrapper: createProvidersWrapper(),
        initialProps: { query: 'ab' },
      },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(searchSpy).not.toHaveBeenCalled();

    rerender({ query: '  PayMent ' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(searchSpy).toHaveBeenCalledWith('payment');
    expect(result.current.data).toEqual([faq('faq_1')]);
  });
});
