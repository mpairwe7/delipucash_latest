/**
 * Notification Hooks — Dedicated TanStack Query hooks for the Notifications screen.
 *
 * Follows the same architecture as transactionHooks.ts:
 * - Factory query keys for granular cache control
 * - Infinite pagination with server-side filtering
 * - Adaptive polling (SSE primary, polling fallback)
 * - Date-grouped flat list data for heterogeneous FlatList
 * - Optimistic mutations for mark-read, mark-all-read, delete, archive
 */

import { useMemo } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { notificationsApi } from './api';
import { useSSEStore, selectNeedsPolling } from '@/store/SSEStore';
import { useAuthStore } from '@/utils/auth/store';
import type {
  Notification,
  NotificationsResponse,
  NotificationFilterType,
  NotificationStats,
} from '@/types';

// ---------------------------------------------------------------------------
// Query Key Factory
// ---------------------------------------------------------------------------

export const notificationQueryKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationQueryKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...notificationQueryKeys.lists(), filters] as const,
  stats: () => [...notificationQueryKeys.all, 'stats'] as const,
  unreadCount: () => [...notificationQueryKeys.all, 'unreadCount'] as const,
} as const;

// ---------------------------------------------------------------------------
// Adaptive polling (mirrors transactionHooks.ts)
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 60_000; // 60 s when SSE is down
const UNREAD_POLL_INTERVAL_MS = 30_000; // 30 s — lightweight single-int

function useAdaptiveInterval(intervalMs: number): number | false {
  const needsPolling = useSSEStore(selectNeedsPolling);
  return needsPolling ? intervalMs : false;
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

export interface NotificationFilters {
  type?: NotificationFilterType;
  priority?: string;
}

const PAGE_SIZE = 20;

function filterToApiParams(filters: NotificationFilters) {
  const params: Record<string, string | boolean> = {};
  if (filters.type === 'unread') {
    params.unreadOnly = true;
  } else if (filters.type && filters.type !== 'all') {
    params.category = filters.type; // 'payments', 'rewards', etc.
  }
  if (filters.priority) {
    params.priority = filters.priority;
  }
  return params;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Infinite-scroll notification list with server-side filtering + adaptive polling.
 */
export function useInfiniteNotifications(filters: NotificationFilters = {}) {
  const refetchInterval = useAdaptiveInterval(POLL_INTERVAL_MS);

  return useInfiniteQuery<NotificationsResponse>({
    queryKey: notificationQueryKeys.list(filters as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const apiParams = filterToApiParams(filters);
      const response = await notificationsApi.getAll({
        page: pageParam as number,
        limit: PAGE_SIZE,
        ...apiParams,
      });
      if (!response.success) throw new Error(response.error ?? 'Failed to fetch notifications');
      return response.data!;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      if (page >= totalPages) return undefined;
      return page + 1;
    },
    staleTime: 60_000,
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

/**
 * Lightweight stats hook — uses dedicated /stats endpoint.
 * Uses placeholderData to avoid flicker on refetch.
 */
export function useNotificationStats() {
  const refetchInterval = useAdaptiveInterval(POLL_INTERVAL_MS);

  return useQuery<NotificationStats>({
    queryKey: notificationQueryKeys.stats(),
    queryFn: async () => {
      const response = await notificationsApi.getStats();
      if (!response.success) throw new Error(response.error ?? 'Failed to fetch stats');
      return response.data!;
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

/**
 * Lightweight unread count (kept for bell badges across app).
 */
export function useUnreadNotificationCount(enabled: boolean = true) {
  const isAuthReady = useAuthStore((s) => s.isReady && !!s.auth?.token);
  const refetchInterval = useAdaptiveInterval(UNREAD_POLL_INTERVAL_MS);

  return useQuery<number>({
    queryKey: notificationQueryKeys.unreadCount(),
    queryFn: async () => {
      const response = await notificationsApi.getUnreadCount();
      if (!response.success) throw new Error(response.error ?? 'Failed to fetch count');
      return typeof response.data === 'number'
        ? response.data
        : (response.data as { count: number })?.count ?? 0;
    },
    staleTime: 30_000,
    refetchInterval,
    refetchIntervalInBackground: false,
    enabled: enabled && isAuthReady,
    placeholderData: keepPreviousData,
  });
}

// ---------------------------------------------------------------------------
// Date section grouping (mirrors transactionHooks.ts)
// ---------------------------------------------------------------------------

export type DateSection = 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Earlier';

export interface SectionedItem {
  type: 'section';
  title: DateSection;
  key: string;
}

export interface NotificationListItem {
  type: 'notification';
  data: Notification;
  key: string;
}

export type NotificationFlatListItem = SectionedItem | NotificationListItem;

function getDateSection(dateStr: string): DateSection {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Earlier';
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
 * with interleaved section headers (Today, Yesterday, etc.).
 */
export function useFlatNotifications(filters: NotificationFilters = {}) {
  const query = useInfiniteNotifications(filters);

  const flatData: NotificationFlatListItem[] = useMemo(() => {
    if (!query.data?.pages) return [];

    const notifications = query.data.pages.flatMap((p) => p?.notifications ?? []);
    const items: NotificationFlatListItem[] = [];
    let lastSection: DateSection | null = null;

    for (const n of notifications) {
      const section = getDateSection(n.createdAt);
      if (section !== lastSection) {
        items.push({ type: 'section', title: section, key: `section_${section}` });
        lastSection = section;
      }
      items.push({ type: 'notification', data: n, key: n.id });
    }

    return items;
  }, [query.data?.pages]);

  // Extract summary from the first page (only included on page 1)
  const summary = useMemo(
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

// ---------------------------------------------------------------------------
// Mutations (with optimistic updates)
// ---------------------------------------------------------------------------

/**
 * Mark single notification as read — optimistic update on infinite pages.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['notifications', 'markRead'],
    mutationFn: async (notificationId: string) => {
      const response = await notificationsApi.markRead(notificationId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationQueryKeys.all });

      const previousQueries = queryClient.getQueriesData({
        queryKey: notificationQueryKeys.lists(),
      });
      const previousCount = queryClient.getQueryData<number>(
        notificationQueryKeys.unreadCount(),
      );

      // Optimistically update all list caches
      queryClient.setQueriesData(
        { queryKey: notificationQueryKeys.lists() },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: NotificationsResponse) => ({
              ...page,
              notifications: page.notifications.map((n: Notification) =>
                n.id === notificationId
                  ? { ...n, read: true, readAt: new Date().toISOString() }
                  : n,
              ),
              summary: page.summary
                ? {
                    ...page.summary,
                    unreadCount: Math.max(0, page.summary.unreadCount - 1),
                  }
                : page.summary,
            })),
          };
        },
      );

      // Decrement unread count
      if (typeof previousCount === 'number' && previousCount > 0) {
        queryClient.setQueryData(notificationQueryKeys.unreadCount(), previousCount - 1);
      }

      return { previousQueries, previousCount };
    },
    onError: (_err, _id, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
      if (typeof context?.previousCount === 'number') {
        queryClient.setQueryData(notificationQueryKeys.unreadCount(), context.previousCount);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    },
  });
}

/**
 * Mark all as read — optimistic (sets all read, count to 0).
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['notifications', 'markAllRead'],
    mutationFn: async () => {
      const response = await notificationsApi.markAllRead();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationQueryKeys.all });

      const previousQueries = queryClient.getQueriesData({
        queryKey: notificationQueryKeys.lists(),
      });

      queryClient.setQueriesData(
        { queryKey: notificationQueryKeys.lists() },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: NotificationsResponse) => ({
              ...page,
              notifications: page.notifications.map((n: Notification) => ({
                ...n,
                read: true,
                readAt: n.readAt || new Date().toISOString(),
              })),
              summary: page.summary
                ? { ...page.summary, unreadCount: 0 }
                : page.summary,
            })),
          };
        },
      );

      queryClient.setQueryData(notificationQueryKeys.unreadCount(), 0);

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    },
  });
}

/**
 * Delete notification — optimistic removal from list.
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['notifications', 'delete'],
    mutationFn: async (notificationId: string) => {
      const response = await notificationsApi.delete(notificationId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationQueryKeys.all });

      const previousQueries = queryClient.getQueriesData({
        queryKey: notificationQueryKeys.lists(),
      });

      queryClient.setQueriesData(
        { queryKey: notificationQueryKeys.lists() },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: NotificationsResponse) => ({
              ...page,
              notifications: page.notifications.filter(
                (n: Notification) => n.id !== notificationId,
              ),
            })),
          };
        },
      );

      return { previousQueries };
    },
    onError: (_err, _id, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    },
  });
}

/**
 * Archive notification — optimistic removal from visible list.
 */
export function useArchiveNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['notifications', 'archive'],
    mutationFn: async (notificationId: string) => {
      const response = await notificationsApi.archive(notificationId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationQueryKeys.all });

      const previousQueries = queryClient.getQueriesData({
        queryKey: notificationQueryKeys.lists(),
      });

      queryClient.setQueriesData(
        { queryKey: notificationQueryKeys.lists() },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: NotificationsResponse) => ({
              ...page,
              notifications: page.notifications.filter(
                (n: Notification) => n.id !== notificationId,
              ),
            })),
          };
        },
      );

      return { previousQueries };
    },
    onError: (_err, _id, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    },
  });
}
