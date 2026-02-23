/**
 * Transaction Hooks — Dedicated TanStack Query hooks for the Transactions screen.
 *
 * Follows the same architecture as videoHooks.ts / questionHooks.ts:
 * - Factory query keys for granular cache control
 * - Infinite pagination
 * - Adaptive polling (SSE primary, polling fallback)
 * - Derived helpers for date grouping
 */

import { useMemo } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  keepPreviousData,
} from '@tanstack/react-query';
import { transactionsApi } from './api';
import { useSSEStore, selectNeedsPolling } from '@/store/SSEStore';
import type {
  UnifiedTransaction,
  TransactionSummary,
  TransactionsResponse,
  TransactionFilterType,
} from '@/types';

// ---------------------------------------------------------------------------
// Query Key Factory
// ---------------------------------------------------------------------------

export const transactionQueryKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionQueryKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...transactionQueryKeys.lists(), filters] as const,
  summary: () => [...transactionQueryKeys.all, 'summary'] as const,
} as const;

// ---------------------------------------------------------------------------
// Adaptive polling (mirrors hooks.ts pattern)
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 60_000; // 60 s when SSE is down

function useAdaptiveInterval(intervalMs: number): number | false {
  const needsPolling = useSSEStore(selectNeedsPolling);
  return needsPolling ? intervalMs : false;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export interface TransactionFilters {
  type?: TransactionFilterType;
  status?: string;
  startDate?: string;
  endDate?: string;
}

const PAGE_SIZE = 20;

/**
 * Infinite-scroll transaction list with adaptive polling.
 */
export function useInfiniteTransactions(filters: TransactionFilters = {}) {
  const refetchInterval = useAdaptiveInterval(POLL_INTERVAL_MS);

  return useInfiniteQuery<TransactionsResponse>({
    queryKey: transactionQueryKeys.list(filters as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const response = await transactionsApi.getAll({
        page: pageParam as number,
        limit: PAGE_SIZE,
        type: filters.type,
        status: filters.status,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      if (!response.success) throw new Error(response.error ?? 'Failed to fetch transactions');
      return response.data!;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pagination?.hasMore) return undefined;
      return lastPage.pagination.page + 1;
    },
    staleTime: 60_000,
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

/**
 * Lightweight summary hook for the wallet card.
 * Uses placeholderData to avoid flicker on filter change.
 */
export function useTransactionSummary() {
  const refetchInterval = useAdaptiveInterval(POLL_INTERVAL_MS);

  return useQuery<TransactionSummary>({
    queryKey: transactionQueryKeys.summary(),
    queryFn: async () => {
      const response = await transactionsApi.getSummary();
      if (!response.success) throw new Error(response.error ?? 'Failed to fetch summary');
      return response.data!;
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

// ---------------------------------------------------------------------------
// Date section grouping
// ---------------------------------------------------------------------------

export type DateSection = 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Earlier';

export interface SectionedItem {
  type: 'section';
  title: DateSection;
  key: string;
}

export interface TransactionItem {
  type: 'transaction';
  data: UnifiedTransaction;
  key: string;
}

export type FlatListItem = SectionedItem | TransactionItem;

function getDateSection(dateStr: string): DateSection {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Earlier'; // Guard against invalid dates
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (date >= todayStart) return 'Today';
  if (date >= yesterdayStart) return 'Yesterday';
  if (date >= weekStart) return 'This Week';
  if (date >= monthStart) return 'This Month';
  return 'Earlier';
}

/**
 * Flattens infinite pages into a heterogeneous FlatList-ready array
 * with interleaved section headers.
 */
export function useFlatTransactions(filters: TransactionFilters = {}) {
  const query = useInfiniteTransactions(filters);

  const flatData: FlatListItem[] = useMemo(() => {
    if (!query.data?.pages) return [];

    const transactions = query.data.pages.flatMap((p) => p?.transactions ?? []);
    const items: FlatListItem[] = [];
    let lastSection: DateSection | null = null;

    for (const tx of transactions) {
      const section = getDateSection(tx.createdAt);
      if (section !== lastSection) {
        items.push({ type: 'section', title: section, key: `section_${section}` });
        lastSection = section;
      }
      items.push({ type: 'transaction', data: tx, key: tx.id });
    }

    return items;
  }, [query.data?.pages]);

  // Extract summary from the first page (only included on page 1)
  const summary: TransactionSummary | undefined = useMemo(
    () => query.data?.pages?.[0]?.summary,
    [query.data?.pages],
  );

  // Total from server pagination (accurate across all pages, not just loaded ones)
  const activeTotal = useMemo(() => {
    const firstPage = query.data?.pages?.[0];
    if (!firstPage?.pagination) return 0;
    return firstPage.pagination.total;
  }, [query.data?.pages]);

  return {
    ...query,
    flatData,
    summary,
    activeTotal,
  };
}
