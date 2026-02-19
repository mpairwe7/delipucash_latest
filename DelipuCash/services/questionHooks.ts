/**
 * Question Hooks — TanStack Query v5 + Zustand (2026 Industry Standard)
 *
 * Architecture:
 * - Single unified API layer (eliminates duplication across api.ts/questionApi.ts)
 * - Structured query keys with factory pattern for granular invalidation
 * - Exponential backoff retry with network-aware logic
 * - Optimistic mutations with automatic rollback
 * - Infinite query for feed pagination
 * - Response normalization with stable transforms
 * - Prefetch adjacent tabs for instant tab switching
 *
 * Backend Endpoints:
 * - GET  /api/questions/all           — paginated question list
 * - GET  /api/questions/:id           — single question with responses
 * - GET  /api/questions/:id/responses — responses with likes/dislikes
 * - POST /api/questions/create        — create question
 * - POST /api/questions/:id/responses — submit response
 * - POST /api/questions/:id/vote      — vote on question
 */

import { useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
  UseMutationResult,
  useInfiniteQuery,
  useSuspenseQuery,
  useSuspenseInfiniteQuery,
  keepPreviousData,
} from '@tanstack/react-query';
import { Question, Response, AppUser, ApiResponse } from '@/types';
import { FeedQuestion, QuestionAuthor, LeaderboardUser } from '@/components/feed';
import { useAuthStore } from '@/utils/auth/store';

// ===========================================
// Types
// ===========================================

export type FeedTabId = 'for-you' | 'latest' | 'unanswered' | 'rewards' | 'my-activity';

export interface QuestionsFeedResult {
  questions: FeedQuestion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  stats: {
    totalQuestions: number;
    unansweredCount: number;
    rewardsCount: number;
  };
}

export interface VoteParams {
  questionId: string;
  type: 'up' | 'down';
}

export interface CreateQuestionParams {
  text: string;
  category?: string;
  rewardAmount?: number;
  isInstantReward?: boolean;
}

export interface SubmitResponseParams {
  questionId: string;
  responseText: string;
}

export interface LeaderboardResult {
  users: LeaderboardUser[];
  currentUserRank: number;
  totalUsers: number;
}

export interface UserQuestionsStats {
  totalAnswered: number;
  totalEarnings: number;
  currentStreak: number;
  questionsAnsweredToday: number;
  dailyTarget: number;
  weeklyProgress: number[];
}

// ===========================================
// API Configuration
// ===========================================

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://delipucash-latest.vercel.app';

/** Get current authenticated user ID from auth store */
const getCurrentUserId = (): string | null =>
  useAuthStore.getState().auth?.user?.id || null;

/** Get current auth token for protected API calls */
const getAuthToken = (): string | null =>
  useAuthStore.getState().auth?.token || null;

/**
 * Request headers with tracing + optional auth
 */
const getHeaders = (includeAuth = false): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client-Version': '1.0.0',
    'X-Request-ID': `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  };
  if (includeAuth) {
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Resilient fetch with automatic retry on network/server errors.
 * Returns normalised ApiResponse<T> — never throws on HTTP errors.
 * 4xx client errors fail fast; 5xx and network errors retry with backoff.
 */
async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  retries = 0,
  authenticated = false,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`;
  let lastError: string = 'Network error';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      const response = await fetch(url, {
        headers: getHeaders(authenticated),
        signal: controller.signal,
        ...init,
      });

      clearTimeout(timeoutId);

      const json = await response.json();
      if (!response.ok) {
        lastError = json?.message || json?.error || `HTTP ${response.status}`;
        // Don't retry 4xx client errors
        if (response.status >= 400 && response.status < 500) {
          return { success: false, data: json as T, error: lastError };
        }
        // Retry on 5xx
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
          continue;
        }
        return { success: false, data: json as T, error: lastError };
      }
      return { success: true, data: json as T };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Network error';
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
        continue;
      }
    }
  }

  return { success: false, data: {} as T, error: lastError };
}

// ===========================================
// Query Keys
// ===========================================

export const questionQueryKeys = {
  all: ['questions'] as const,
  feeds: () => [...questionQueryKeys.all, 'feed'] as const,
  feed: (tab: FeedTabId, limit: number) =>
    [...questionQueryKeys.feeds(), tab, limit] as const,
  details: () => [...questionQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...questionQueryKeys.details(), id] as const,
  responses: (id: string) => [...questionQueryKeys.all, 'responses', id] as const,
  leaderboard: ['questions', 'leaderboard'] as const,
  userStatsRoot: () => [...questionQueryKeys.all, 'userStats'] as const,
  userStats: (userId: string | null) =>
    [...questionQueryKeys.userStatsRoot(), userId ?? 'anonymous'] as const,
};

// ===========================================
// Helper Functions
// ===========================================

/**
 * Transform backend question to FeedQuestion format.
 * Uses real vote counts from the server (QuestionVote table).
 * Engagement flags are derived from real data — no synthetic values.
 */
function transformToFeedQuestion(
  question: Question & { user?: Partial<AppUser>; upvotes?: number; downvotes?: number },
  _index?: number
): FeedQuestion {
  // Generate author from user data or fallback
  const author: QuestionAuthor = question.user
    ? {
        id: question.user.id || question.userId || 'anonymous',
        name: `${question.user.firstName || 'Anonymous'} ${question.user.lastName || 'User'}`.trim(),
        avatar: question.user.avatar || undefined,
        reputation: question.user.points || 0,
        badge: question.user.points && question.user.points > 1000 ? 'top-contributor' : undefined,
      }
    : {
        id: question.userId || 'anonymous',
        name: 'Anonymous User',
        reputation: 0,
        badge: undefined,
      };

  // Use real data from server
  const totalAnswers = question.totalAnswers || 0;
  const upvotes = question.upvotes || 0;
  const downvotes = question.downvotes || 0;
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(question.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    ...question,
    author,
    upvotes,
    downvotes,
    followersCount: upvotes + totalAnswers,
    isHot: daysSinceCreation <= 1 && totalAnswers > 3,
    isTrending: daysSinceCreation <= 3 && (upvotes > 5 || totalAnswers > 5),
    // Server doesn't yet provide these fields — derive conservatively.
    // hasAcceptedAnswer requires a dedicated API field; default false to avoid false green checkmarks.
    hasExpertAnswer: false,
    hasAcceptedAnswer: false,
    userHasVoted: null,
  };
}

/**
 * Sort questions based on tab selection
 */
function sortQuestionsByTab(questions: FeedQuestion[], tab: FeedTabId): FeedQuestion[] {
  const sorted = [...questions];

  switch (tab) {
    case 'for-you':
      // AI/personalized - mix of trending, rewards, and recent
      return sorted.sort((a, b) => {
        const scoreA =
          (a.isHot ? 10 : 0) +
          (a.isTrending ? 8 : 0) +
          (a.isInstantReward ? 15 : 0) +
          (a.rewardAmount || 0) * 2;
        const scoreB =
          (b.isHot ? 10 : 0) +
          (b.isTrending ? 8 : 0) +
          (b.isInstantReward ? 15 : 0) +
          (b.rewardAmount || 0) * 2;
        return scoreB - scoreA;
      });

    case 'latest':
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    case 'unanswered':
      return sorted.filter((q) => (q.totalAnswers || 0) === 0);

    case 'rewards':
      return sorted
        .filter((q) => q.isInstantReward && q.rewardAmount)
        .sort((a, b) => (b.rewardAmount || 0) - (a.rewardAmount || 0));

    case 'my-activity': {
      // Filter to questions the user authored or answered
      const userId = getCurrentUserId();
      if (!userId) return [];
      return sorted.filter(
        (q) => q.userId === userId || q.author?.id === userId
      ).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    default:
      return sorted;
  }
}

// ===========================================
// Hooks
// ===========================================

/**
 * Infinite scroll questions feed.
 *
 * Features:
 * - Exponential backoff retry (3 attempts)
 * - keepPreviousData prevents flash on tab switch
 * - Network-aware: pauses refetch when offline
 */
export function useInfiniteQuestionsFeed(
  tab: FeedTabId,
  limit: number = 20
) {
  return useInfiniteQuery({
    queryKey: questionQueryKeys.feed(tab, limit),
    queryFn: async ({ pageParam = 1 }): Promise<QuestionsFeedResult> => {
      const queryStr = `?tab=${tab}&page=${pageParam}&limit=${limit}`;
      const response = await fetchJson<any>(`/api/questions/all${queryStr}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch questions');
      }

      // Normalise nested response shape (API returns {success, data: [...]})
      const rawData = response.data;
      const questions = Array.isArray(rawData?.data)
        ? rawData.data
        : Array.isArray(rawData)
        ? rawData
        : [];

      if (!Array.isArray(questions)) {
        throw new Error('Invalid response format from questions API');
      }

      const feedQuestions = questions.map((q: Question, i: number) => transformToFeedQuestion(q, i));
      const sortedQuestions = sortQuestionsByTab(feedQuestions, tab);
      const total = rawData?.pagination?.total ?? sortedQuestions.length;

      return {
        questions: sortedQuestions,
        pagination: {
          page: pageParam as number,
          limit,
          total,
          totalPages: rawData?.pagination?.totalPages ?? Math.ceil(total / limit),
          hasMore: rawData?.pagination?.hasMore ?? ((pageParam as number) * limit < total),
        },
        stats: rawData?.stats ?? {
          totalQuestions: total,
          unansweredCount: 0,
          rewardsCount: 0,
        },
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
    retry: 1,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10_000),
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch single question with responses.
 * Used by question-answer and question-detail screens.
 *
 * Features:
 * - Parallel fetch of question + enriched responses
 * - 5 min staleTime for detail views
 * - Graceful error propagation
 */
export function useQuestionDetail(
  questionId: string
): UseQueryResult<FeedQuestion & { responses: Response[] }, Error> {
  return useQuery({
    queryKey: questionQueryKeys.detail(questionId),
    queryFn: async () => {
      // Parallel fetch: question data + enriched responses (1 retry each for network resilience)
      const [questionRes, responsesRes] = await Promise.all([
        fetchJson<any>(`/api/questions/${questionId}`, undefined, 1),
        fetchJson<any>(`/api/questions/${questionId}/responses`, undefined, 1),
      ]);

      const questionData = questionRes.data?.data ?? questionRes.data;
      const responsesData = responsesRes.data?.data ?? responsesRes.data ?? [];

      if (!questionRes.success || !questionData) {
        throw new Error(questionRes.error || 'Failed to fetch question');
      }

      return {
        ...transformToFeedQuestion(questionData as Question),
        responses: Array.isArray(responsesData) ? (responsesData as Response[]) : [],
      };
    },
    enabled: !!questionId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 8_000),
  });
}

/**
 * Vote on a question (optimistic update with toggle)
 * SO/Reddit-style: clicking same vote type un-votes, clicking opposite switches
 */
/**
 * Vote on a question with optimistic toggle logic.
 * Implements Reddit/SO-style toggle: tap same vote = undo, tap opposite = switch.
 *
 * Optimistic update strategy:
 * - Immediately updates all feed caches + detail cache
 * - Rolls back on server error
 * - Only refetches active queries on settle (avoids refetching background tabs)
 */
export function useVoteQuestion(): UseMutationResult<
  { success: boolean; upvotes: number; downvotes: number },
  Error,
  VoteParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['questions', 'vote'],
    mutationFn: async ({ questionId, type }) => {
      const userId = getCurrentUserId();
      const response = await fetchJson<{ upvotes: number; downvotes: number }>(
        `/api/questions/${questionId}/vote`,
        {
          method: 'POST',
          body: JSON.stringify({ type, userId }),
        },
        2,
        true,
      );
      if (!response.success) {
        throw new Error(response.error || 'Vote failed');
      }
      return { success: true, ...response.data };
    },
    onMutate: async ({ questionId, type }) => {
      // Cancel in-flight queries to avoid race conditions
      await queryClient.cancelQueries({ queryKey: questionQueryKeys.all });

      // Snapshot for rollback
      const previousInfiniteData = queryClient.getQueriesData({
        queryKey: questionQueryKeys.feeds(),
      });
      const previousDetail = queryClient.getQueryData(
        questionQueryKeys.detail(questionId)
      );

      // SO/Reddit-style toggle vote logic
      const updateQuestion = (q: FeedQuestion): FeedQuestion => {
        if (q.id !== questionId) return q;

        const prevVote = q.userHasVoted;
        let newUpvotes = q.upvotes || 0;
        let newDownvotes = q.downvotes || 0;
        let newVote: 'up' | 'down' | null;

        if (prevVote === type) {
          // Undo same vote
          newVote = null;
          if (type === 'up') newUpvotes = Math.max(0, newUpvotes - 1);
          else newDownvotes = Math.max(0, newDownvotes - 1);
        } else {
          // Switch vote
          if (prevVote === 'up') newUpvotes = Math.max(0, newUpvotes - 1);
          if (prevVote === 'down') newDownvotes = Math.max(0, newDownvotes - 1);
          if (type === 'up') newUpvotes += 1;
          else newDownvotes += 1;
          newVote = type;
        }

        return { ...q, upvotes: newUpvotes, downvotes: newDownvotes, userHasVoted: newVote };
      };

      // Optimistic update for infinite feed queries
      queryClient.setQueriesData(
        { queryKey: questionQueryKeys.feeds() },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: QuestionsFeedResult) => ({
              ...page,
              questions: page.questions.map(updateQuestion),
            })),
          };
        }
      );

      // Also update detail cache if present
      if (previousDetail) {
        queryClient.setQueryData(
          questionQueryKeys.detail(questionId),
          (old: any) => (old ? updateQuestion(old) : old)
        );
      }

      return { previousInfiniteData, previousDetail };
    },
    onError: (_err, { questionId }, context) => {
      // Rollback to snapshot on error
      if (context?.previousInfiniteData) {
        context.previousInfiniteData.forEach(([queryKey, data]: [any, any]) => {
          if (data) queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          questionQueryKeys.detail(questionId),
          context.previousDetail
        );
      }
    },
    onSettled: () => {
      // Only refetch actively rendered queries, not all tab caches
      queryClient.invalidateQueries({
        queryKey: questionQueryKeys.feeds(),
        refetchType: 'active',
      });
    },
  });
}

/**
 * Create a new question.
 * Invalidates all question caches on success to show new content.
 */
export function useCreateQuestion(): UseMutationResult<
  Question,
  Error,
  CreateQuestionParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const userId = getCurrentUserId();
      const response = await fetchJson<{ question: Question }>(
        '/api/questions/create',
        {
          method: 'POST',
          body: JSON.stringify({ ...data, userId }),
        },
        2,
        true,
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to create question');
      }
      return response.data.question;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.all });
    },
  });
}

/**
 * Submit response to a question with optimistic update.
 * Immediately adds the response to the UI while server processes.
 *
 * Optimistic strategy:
 * - Inserts optimistic response at top of detail cache
 * - Increments totalAnswers in both detail and feed caches
 * - Rolls back on failure, then refetches to sync
 */
export function useSubmitQuestionResponse(): UseMutationResult<
  Response & { rewardEarned?: number },
  Error,
  SubmitResponseParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['questions', 'submitResponse'],
    mutationFn: async ({ questionId, responseText }) => {
      const userId = getCurrentUserId();
      const response = await fetchJson<{ response: Response; rewardEarned?: number }>(
        `/api/questions/${questionId}/responses`,
        {
          method: 'POST',
          body: JSON.stringify({ responseText, userId }),
        },
        2,
        true,
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to submit response');
      }
      return { ...response.data.response, rewardEarned: response.data.rewardEarned };
    },
    onMutate: async ({ questionId, responseText }) => {
      // Cancel related queries
      await queryClient.cancelQueries({ queryKey: questionQueryKeys.detail(questionId) });

      // Snapshot for rollback
      const previousDetail = queryClient.getQueryData(
        questionQueryKeys.detail(questionId)
      );

      // Optimistically add response to detail view
      queryClient.setQueryData(
        questionQueryKeys.detail(questionId),
        (old: (FeedQuestion & { responses: Response[] }) | undefined) => {
          if (!old) return old;
          const optimisticResponse: Response = {
            id: `optimistic_${Date.now()}`,
            responseText,
            userId: 'current_user',
            questionId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            likesCount: 0,
            dislikesCount: 0,
            repliesCount: 0,
            isLiked: false,
            isDisliked: false,
          };
          return {
            ...old,
            totalAnswers: (old.totalAnswers || 0) + 1,
            responses: [optimisticResponse, ...(old.responses || [])],
          };
        }
      );

      // Optimistically increment answer count in infinite feed
      queryClient.setQueriesData(
        { queryKey: questionQueryKeys.feeds() },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: QuestionsFeedResult) => ({
              ...page,
              questions: page.questions.map((q: FeedQuestion) =>
                q.id === questionId
                  ? { ...q, totalAnswers: (q.totalAnswers || 0) + 1 }
                  : q
              ),
            })),
          };
        }
      );

      return { previousDetail };
    },
    onError: (_err, { questionId }, context) => {
      // Rollback on error
      if (context?.previousDetail) {
        queryClient.setQueryData(
          questionQueryKeys.detail(questionId),
          context.previousDetail
        );
      }
    },
    onSettled: (_, __, { questionId }) => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.detail(questionId) });
      queryClient.invalidateQueries({
        queryKey: questionQueryKeys.feeds(),
        refetchType: 'active',
      });
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.userStatsRoot() });
    },
  });
}

/**
 * Fetch leaderboard data.
 * Long staleTime — leaderboard doesn't change frequently.
 */
export function useQuestionsLeaderboard(
  limit: number = 10,
  enabled = true
): UseQueryResult<LeaderboardResult, Error> {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: [...questionQueryKeys.leaderboard, limit],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (userId) params.set('userId', userId);

      const response = await fetchJson<{ data: LeaderboardResult }>(
        `/api/questions/leaderboard?${params}`
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to load leaderboard');
      }
      // Server wraps in { success, data: { users, currentUserRank, totalUsers } }
      const payload = (response.data as any)?.data ?? response.data;
      return payload as LeaderboardResult;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    enabled,
  });
}

const DEFAULT_STATS: UserQuestionsStats = {
  totalAnswered: 0,
  totalEarnings: 0,
  currentStreak: 0,
  questionsAnsweredToday: 0,
  dailyTarget: 10,
  weeklyProgress: [0, 0, 0, 0, 0, 0, 0],
};

/**
 * Fetch user questions stats (answered count, earnings, streak).
 *
 * Cache strategy:
 * - placeholderData keeps previous stats visible during background refetch
 *   (avoids flash-to-zero on tab switch / pull-to-refresh)
 * - staleTime 2 min lets SSE-invalidated queries refetch automatically
 * - gcTime 10 min keeps warm cache for fast back-navigation
 */
export function useUserQuestionsStats(): UseQueryResult<UserQuestionsStats, Error> {
  const auth = useAuthStore((s) => s.auth);
  const isAuthReady = useAuthStore((s) => s.isReady);
  const userId = auth?.user?.id ?? null;
  const hasToken = Boolean(auth?.token);

  return useQuery({
    queryKey: questionQueryKeys.userStats(userId),
    queryFn: async () => {
      if (!userId) return DEFAULT_STATS;
      const response = await fetchJson<{ data: UserQuestionsStats }>(
        `/api/questions/user-stats?userId=${userId}`,
        undefined,
        0,
        true, // authenticated — sends Bearer token
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to load stats');
      }
      // Server wraps in { success, data: { ... } }
      const payload = (response.data as any)?.data ?? response.data;
      return payload as UserQuestionsStats;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    retry: 1,
    placeholderData: (prev) => prev, // keep stale data visible during refetch
    enabled: isAuthReady && hasToken && Boolean(userId),
  });
}

/**
 * Prefetch questions for adjacent tabs — improves UX by warming the cache
 * before the user taps a tab.
 */
export function usePrefetchQuestions() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    const tabs: FeedTabId[] = ['for-you', 'latest', 'rewards'];
    const limit = 20;
    tabs.forEach((tab) => {
      queryClient.prefetchInfiniteQuery({
        queryKey: questionQueryKeys.feed(tab, limit),
        queryFn: async (): Promise<QuestionsFeedResult> => {
          const queryStr = `?tab=${tab}&page=1&limit=${limit}`;
          const response = await fetchJson<any>(`/api/questions/all${queryStr}`);

          if (!response.success) {
            throw new Error(response.error || 'Prefetch failed');
          }

          const questions = Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data)
            ? response.data
            : [];

          const feedQuestions = questions.map((q: Question, i: number) => transformToFeedQuestion(q, i));
          const sortedQuestions = sortQuestionsByTab(feedQuestions, tab);
          const total = response.data?.pagination?.total ?? sortedQuestions.length;

          return {
            questions: sortedQuestions.slice(0, limit),
            pagination: {
              page: 1,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
              hasMore: total > limit,
            },
            stats: response.data?.stats ?? {
              totalQuestions: total,
              unansweredCount: 0,
              rewardsCount: 0,
            },
          };
        },
        initialPageParam: 1,
        staleTime: 1000 * 60 * 2,
      });
    });
  }, [queryClient]);
}

// ===========================================
// Suspense Hooks (2026 — use inside <Suspense> boundary)
// ===========================================

/**
 * Suspense-enabled question detail.
 * Throws promise while loading — wrap in <Suspense fallback={...}>.
 * Guaranteed non-null data on render.
 */
export function useSuspenseQuestionDetail(questionId: string) {
  return useSuspenseQuery({
    queryKey: questionQueryKeys.detail(questionId),
    queryFn: async () => {
      const [questionRes, responsesRes] = await Promise.all([
        fetchJson<any>(`/api/questions/${questionId}`, undefined, 1),
        fetchJson<any>(`/api/questions/${questionId}/responses`, undefined, 1),
      ]);

      const questionData = questionRes.data?.data ?? questionRes.data;
      const responsesData = responsesRes.data?.data ?? responsesRes.data ?? [];

      if (!questionRes.success || !questionData) {
        throw new Error(questionRes.error || 'Failed to fetch question');
      }

      return {
        ...transformToFeedQuestion(questionData as Question),
        responses: Array.isArray(responsesData) ? (responsesData as Response[]) : [],
      };
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 8_000),
  });
}

/**
 * Suspense-enabled infinite feed.
 * Throws promise while loading — wrap in <Suspense fallback={...}>.
 */
export function useSuspenseQuestionsFeed(tab: FeedTabId, limit: number = 20) {
  return useSuspenseInfiniteQuery({
    queryKey: questionQueryKeys.feed(tab, limit),
    queryFn: async ({ pageParam = 1 }): Promise<QuestionsFeedResult> => {
      const queryStr = `?tab=${tab}&page=${pageParam}&limit=${limit}`;
      const response = await fetchJson<any>(`/api/questions/all${queryStr}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch questions');
      }

      const rawData = response.data;
      const questions = Array.isArray(rawData?.data)
        ? rawData.data
        : Array.isArray(rawData)
        ? rawData
        : [];

      if (!Array.isArray(questions)) {
        throw new Error('Invalid response format from questions API');
      }

      const feedQuestions = questions.map((q: Question, i: number) => transformToFeedQuestion(q, i));
      const sortedQuestions = sortQuestionsByTab(feedQuestions, tab);
      const total = rawData?.pagination?.total ?? sortedQuestions.length;

      return {
        questions: sortedQuestions,
        pagination: {
          page: pageParam as number,
          limit,
          total,
          totalPages: rawData?.pagination?.totalPages ?? Math.ceil(total / limit),
          hasMore: rawData?.pagination?.hasMore ?? ((pageParam as number) * limit < total),
        },
        stats: rawData?.stats ?? {
          totalQuestions: total,
          unansweredCount: 0,
          rewardsCount: 0,
        },
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10_000),
  });
}

/**
 * Suspense-enabled leaderboard.
 */
export function useSuspenseLeaderboard(limit: number = 10) {
  const userId = getCurrentUserId();

  return useSuspenseQuery({
    queryKey: [...questionQueryKeys.leaderboard, limit],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (userId) params.set('userId', userId);

      const response = await fetchJson<{ data: LeaderboardResult }>(
        `/api/questions/leaderboard?${params}`
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to load leaderboard');
      }
      const payload = (response.data as any)?.data ?? response.data;
      return payload as LeaderboardResult;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 2,
  });
}

export default {
  useInfiniteQuestionsFeed,
  useQuestionDetail,
  useVoteQuestion,
  useCreateQuestion,
  useSubmitQuestionResponse,
  useQuestionsLeaderboard,
  useUserQuestionsStats,
  usePrefetchQuestions,
  // Suspense variants
  useSuspenseQuestionDetail,
  useSuspenseQuestionsFeed,
  useSuspenseLeaderboard,
};
