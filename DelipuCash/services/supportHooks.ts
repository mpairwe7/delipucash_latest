/**
 * Support Hooks — TanStack Query v5 layer over supportApi
 *
 * Architecture (mirrors questionHooks.ts conventions):
 * - Structured query keys with factory pattern for granular invalidation
 * - One hook per resource; screens compose them and derive per-tab
 *   loading/error state instead of a monolithic Promise.all
 * - Server-backed FAQ search keyed by the (debounced) term, with
 *   keepPreviousData so results don't flash while typing
 * - Optimistic rateFAQ mutation with automatic rollback
 * - Support content is near-static → long staleTime; combined with the
 *   app-wide AsyncStorage persister the screen renders instantly offline
 */

import { useCallback } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  fetchFAQs,
  searchFAQs,
  rateFAQ,
  fetchContactMethods,
  fetchQuickActions,
  fetchTutorials,
  getFAQCategories,
  type FAQItem,
  type FAQCategory,
  type ContactMethod,
  type QuickAction,
  type Tutorial,
} from './supportApi';

// ===========================================
// Query Keys
// ===========================================

export const supportQueryKeys = {
  all: ['support'] as const,
  faqs: () => [...supportQueryKeys.all, 'faqs'] as const,
  faqSearches: () => [...supportQueryKeys.all, 'faqSearch'] as const,
  faqSearch: (query: string) => [...supportQueryKeys.faqSearches(), query] as const,
  categories: () => [...supportQueryKeys.all, 'categories'] as const,
  contacts: () => [...supportQueryKeys.all, 'contacts'] as const,
  quickActions: () => [...supportQueryKeys.all, 'quickActions'] as const,
  tutorials: () => [...supportQueryKeys.all, 'tutorials'] as const,
};

// Help-center content changes rarely — refetch at most every 10 minutes.
const SUPPORT_STALE_TIME = 1000 * 60 * 10;

// ===========================================
// Query Hooks
// ===========================================

/** All FAQ items. Category filtering happens client-side on this cache. */
export function useFAQs(): UseQueryResult<FAQItem[], Error> {
  return useQuery({
    queryKey: supportQueryKeys.faqs(),
    queryFn: () => fetchFAQs(),
    staleTime: SUPPORT_STALE_TIME,
  });
}

/** FAQ categories with item counts (drives the filter chips). */
export function useFAQCategories(): UseQueryResult<
  { category: FAQCategory; count: number }[],
  Error
> {
  return useQuery({
    queryKey: supportQueryKeys.categories(),
    queryFn: getFAQCategories,
    staleTime: SUPPORT_STALE_TIME,
  });
}

/** Contact methods (email / WhatsApp / phone / live chat availability). */
export function useContactMethods(): UseQueryResult<ContactMethod[], Error> {
  return useQuery({
    queryKey: supportQueryKeys.contacts(),
    queryFn: fetchContactMethods,
    staleTime: SUPPORT_STALE_TIME,
  });
}

/** Quick actions shown on the Contact tab. */
export function useQuickActions(): UseQueryResult<QuickAction[], Error> {
  return useQuery({
    queryKey: supportQueryKeys.quickActions(),
    queryFn: fetchQuickActions,
    staleTime: SUPPORT_STALE_TIME,
  });
}

/** Video tutorials list. */
export function useTutorials(): UseQueryResult<Tutorial[], Error> {
  return useQuery({
    queryKey: supportQueryKeys.tutorials(),
    queryFn: () => fetchTutorials(),
    staleTime: SUPPORT_STALE_TIME,
  });
}

/**
 * Server-backed FAQ search.
 *
 * Pass an already-debounced term (see useDebouncedValue) — each distinct
 * term becomes its own cache entry, so returning to a previous search is
 * instant. Disabled until the term is meaningful (> 2 chars), and
 * keepPreviousData holds the last results on screen while the next
 * term loads instead of flashing a skeleton.
 */
export function useSearchFAQs(query: string): UseQueryResult<FAQItem[], Error> {
  const normalized = query.trim().toLowerCase();

  return useQuery({
    queryKey: supportQueryKeys.faqSearch(normalized),
    queryFn: () => searchFAQs(normalized),
    enabled: normalized.length > 2,
    placeholderData: keepPreviousData,
    staleTime: SUPPORT_STALE_TIME,
  });
}

// ===========================================
// Mutations
// ===========================================

export interface RateFAQParams {
  faqId: string;
  helpful: boolean;
}

type RateFAQContext = {
  previousFaqs: [readonly unknown[], FAQItem[] | undefined][];
};

/** Bump the rated counter on the matching FAQ item. */
const applyRating = (faqs: FAQItem[] | undefined, { faqId, helpful }: RateFAQParams) =>
  faqs?.map((faq) =>
    faq.id === faqId
      ? helpful
        ? { ...faq, helpful: faq.helpful + 1 }
        : { ...faq, notHelpful: faq.notHelpful + 1 }
      : faq,
  );

/**
 * Rate an FAQ as helpful / not helpful.
 *
 * Optimistically increments the visible counter in the FAQ list cache and
 * every cached search result, rolling back on error. No onSettled
 * invalidation: the current backend acknowledges but doesn't persist
 * ratings, so a refetch would wipe the increment — add
 * `invalidateQueries(supportQueryKeys.faqs())` once it does.
 */
export function useRateFAQ(): UseMutationResult<
  { success: boolean; message: string },
  Error,
  RateFAQParams,
  RateFAQContext
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['support', 'rateFAQ'],
    mutationFn: ({ faqId, helpful }) => rateFAQ(faqId, helpful),
    onMutate: async (params) => {
      // Cancel in-flight FAQ fetches so they don't overwrite the optimistic bump
      await queryClient.cancelQueries({ queryKey: supportQueryKeys.faqs() });
      await queryClient.cancelQueries({ queryKey: supportQueryKeys.faqSearches() });

      // Snapshot every FAQ-bearing cache (list + all search terms) for rollback
      const previousFaqs = [
        ...queryClient.getQueriesData<FAQItem[]>({ queryKey: supportQueryKeys.faqs() }),
        ...queryClient.getQueriesData<FAQItem[]>({ queryKey: supportQueryKeys.faqSearches() }),
      ];

      queryClient.setQueriesData<FAQItem[]>(
        { queryKey: supportQueryKeys.faqs() },
        (old) => applyRating(old, params),
      );
      queryClient.setQueriesData<FAQItem[]>(
        { queryKey: supportQueryKeys.faqSearches() },
        (old) => applyRating(old, params),
      );

      return { previousFaqs };
    },
    onError: (_err, _params, context) => {
      context?.previousFaqs.forEach(([queryKey, data]) => {
        if (data) queryClient.setQueryData(queryKey, data);
      });
    },
  });
}

// ===========================================
// Refresh
// ===========================================

/**
 * Pull-to-refresh for the whole help center: invalidates every support
 * query and resolves when the actively-rendered ones have refetched
 * (so RefreshControl's spinner hides at the right moment).
 */
export function useRefreshSupport(): () => Promise<void> {
  const queryClient = useQueryClient();

  return useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: supportQueryKeys.all,
        refetchType: 'active',
      }),
    [queryClient],
  );
}

export default {
  useFAQs,
  useFAQCategories,
  useContactMethods,
  useQuickActions,
  useTutorials,
  useSearchFAQs,
  useRateFAQ,
  useRefreshSupport,
};
