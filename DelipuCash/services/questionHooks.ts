/**
 * Question Hooks - Dedicated React Query hooks for Questions
 * 
 * Provides comprehensive state management for the Questions screen with:
 * - Proper REST API integration with backend
 * - Mock data fallback for development
 * - Optimistic updates for votes
 * - Caching and pagination
 * - Real-time leaderboard and stats
 * 
 * Backend Integration:
 * - GET /api/questions/all - List all questions
 * - GET /api/questions/:id - Get single question
 * - POST /api/questions/create - Create question
 * - POST /api/questions/:id/responses - Submit response
 * - GET /api/questions/:id/responses - Get responses
 * - POST /api/questions/:id/vote - Vote on question
 * 
 * @example
 * ```tsx
 * const { data, fetchNextPage } = useInfiniteQuestionsFeed('for-you');
 * const { mutate: vote } = useVoteQuestion();
 * const { mutate: create } = useCreateQuestion();
 * ```
 */

import { useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
  UseMutationResult,
  useInfiniteQuery,
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

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const isBackendConfigured = Boolean(API_BASE_URL);

/** Get current authenticated user ID from auth store */
const getCurrentUserId = (): string | null =>
  useAuthStore.getState().auth?.user?.id || null;

const delay = (ms: number = 300): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate request headers
 */
const getHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Client-Version': '1.0.0',
  'X-Request-ID': `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
});

/**
 * Fetch JSON with error handling
 */
async function fetchJson<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      headers: getHeaders(),
      ...init,
    });
    const json = await response.json();
    if (!response.ok) {
      return { success: false, data: json as T, error: json?.message || 'Request failed' };
    }
    return { success: true, data: json as T };
  } catch (error) {
    return {
      success: false,
      data: {} as T,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ===========================================
// Query Keys
// ===========================================

export const questionQueryKeys = {
  all: ['questions'] as const,
  detail: (id: string) => ['questions', 'detail', id] as const,
  responses: (id: string) => ['questions', 'responses', id] as const,
  leaderboard: ['questions', 'leaderboard'] as const,
  userStats: ['questions', 'userStats'] as const,
};

// ===========================================
// Helper Functions
// ===========================================

/**
 * Simple deterministic hash from string → number.
 * Used to generate stable pseudo-random values from question IDs
 * so metrics don't change on every refetch.
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Transform backend question to FeedQuestion format.
 * Uses deterministic hash-based values instead of Math.random()
 * so metrics remain stable across refetches.
 */
function transformToFeedQuestion(
  question: Question & { user?: Partial<AppUser> },
  index?: number
): FeedQuestion {
  const hash = hashCode(question.id || `q-${index}`);

  // Generate author from user data or fallback
  const author: QuestionAuthor = question.user
    ? {
        id: question.user.id || question.userId || 'anonymous',
        name: `${question.user.firstName || 'Anonymous'} ${question.user.lastName || 'User'}`.trim(),
        avatar: question.user.avatar || undefined,
        reputation: question.user.points || (hash % 5000) + 100,
        badge: question.user.points && question.user.points > 1000 ? 'top-contributor' : undefined,
      }
    : {
        id: question.userId || 'anonymous',
        name: 'Anonymous User',
        reputation: (hash % 5000) + 100,
        badge: undefined,
      };

  // Calculate engagement metrics
  const totalAnswers = question.totalAnswers || 0;
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(question.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    ...question,
    author,
    upvotes: totalAnswers * 2 + (hash % 20),
    downvotes: (hash >> 4) % 5,
    followersCount: (hash % 80) + 5,
    isHot: daysSinceCreation <= 1 && totalAnswers > 5,
    isTrending: daysSinceCreation <= 3 && totalAnswers > 10,
    hasExpertAnswer: totalAnswers > 3,
    hasAcceptedAnswer: totalAnswers > 0,
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

    case 'my-activity':
      // Would filter by user's questions/answers
      return sorted.slice(0, 10);

    default:
      return sorted;
  }
}

// ===========================================
// Hooks
// ===========================================

/**
 * Infinite scroll questions feed
 */
export function useInfiniteQuestionsFeed(
  tab: FeedTabId,
  limit: number = 20
) {
  return useInfiniteQuery({
    queryKey: ['questions', 'infinite', tab, limit],
    queryFn: async ({ pageParam = 1 }): Promise<QuestionsFeedResult> => {
      const queryStr = `?tab=${tab}&page=${pageParam}&limit=${limit}`;
      const response = await fetchJson<any>(`/api/questions/all${queryStr}`);

      if (!response.success) {
        console.warn('[useInfiniteQuestionsFeed] API error:', response.error);
        throw new Error(response.error || 'Failed to fetch questions');
      }

      const questions = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
        ? response.data
        : [];

      if (!Array.isArray(questions)) {
        console.warn('[useInfiniteQuestionsFeed] Unexpected response shape:', response.data);
        throw new Error('Invalid response format from questions API');
      }

      const feedQuestions = questions.map((q: Question, i: number) => transformToFeedQuestion(q, i));

      // Always apply client-side tab filtering — backend doesn't filter by tab yet
      const sortedQuestions = sortQuestionsByTab(feedQuestions, tab);

      const total = response.data?.pagination?.total ?? sortedQuestions.length;

      return {
        questions: sortedQuestions,
        pagination: {
          page: pageParam,
          limit,
          total,
          totalPages: response.data?.pagination?.totalPages ?? Math.ceil(total / limit),
          hasMore: response.data?.pagination?.hasMore ?? (pageParam * limit < total),
        },
        stats: response.data?.stats ?? {
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
  });
}

/**
 * Fetch single question with responses
 */
export function useQuestionDetail(
  questionId: string
): UseQueryResult<FeedQuestion & { responses: Response[] }, Error> {
  return useQuery({
    queryKey: questionQueryKeys.detail(questionId),
    queryFn: async () => {
      if (isBackendConfigured) {
        try {
          const [questionRes, responsesRes] = await Promise.all([
            fetchJson<any>(`/api/questions/${questionId}`),
            fetchJson<any>(`/api/questions/${questionId}/responses`),
          ]);

          const questionData = questionRes.data?.data ?? questionRes.data;
          const responsesData = responsesRes.data?.data ?? responsesRes.data ?? [];

          if (questionRes.success && questionData) {
            return {
              ...transformToFeedQuestion(questionData as Question),
              responses: Array.isArray(responsesData) ? (responsesData as Response[]) : [],
            };
          }
        } catch (error) {
          console.log('[useQuestionDetail] Backend failed, using mock:', error);
        }
      }

      await delay();
      // When backend is unavailable, throw error to indicate question not found
      throw new Error('Question not found - API unavailable');
    },
    enabled: !!questionId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Vote on a question (optimistic update with toggle)
 * SO/Reddit-style: clicking same vote type un-votes, clicking opposite switches
 */
export function useVoteQuestion(): UseMutationResult<
  { success: boolean; upvotes: number; downvotes: number },
  Error,
  VoteParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, type }) => {
      if (isBackendConfigured) {
        try {
          const userId = getCurrentUserId();
          const response = await fetchJson<{ upvotes: number; downvotes: number }>(
            `/api/questions/${questionId}/vote`,
            {
              method: 'POST',
              body: JSON.stringify({ type, userId }),
            }
          );
          if (response.success) {
            return { success: true, ...response.data };
          }
        } catch (error) {
          console.log('[useVoteQuestion] Backend failed:', error);
        }
      }

      // Mock response
      await delay(200);
      return {
        success: true,
        upvotes: type === 'up' ? 1 : 0,
        downvotes: type === 'down' ? 1 : 0,
      };
    },
    onMutate: async ({ questionId, type }) => {
      // Cancel in-flight queries to avoid race conditions
      await queryClient.cancelQueries({ queryKey: ['questions'] });

      // Snapshot for rollback
      const previousInfiniteData = queryClient.getQueriesData({
        queryKey: ['questions', 'infinite'],
      });

      // SO/Reddit-style toggle vote logic
      const updateQuestion = (q: FeedQuestion): FeedQuestion => {
        if (q.id !== questionId) return q;

        const prevVote = q.userHasVoted;
        let newUpvotes = q.upvotes || 0;
        let newDownvotes = q.downvotes || 0;
        let newVote: 'up' | 'down' | null;

        if (prevVote === type) {
          newVote = null;
          if (type === 'up') newUpvotes = Math.max(0, newUpvotes - 1);
          else newDownvotes = Math.max(0, newDownvotes - 1);
        } else {
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
        { queryKey: ['questions', 'infinite'] },
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

      return { previousInfiniteData };
    },
    onError: (_err, _vars, context) => {
      // Rollback to snapshot on error
      if (context?.previousInfiniteData) {
        context.previousInfiniteData.forEach(([queryKey, data]: [any, any]) => {
          if (data) queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Only refetch actively rendered queries, not all tab caches
      queryClient.invalidateQueries({ queryKey: ['questions', 'infinite'], refetchType: 'active' });
    },
  });
}

/**
 * Create a new question
 */
export function useCreateQuestion(): UseMutationResult<
  Question,
  Error,
  CreateQuestionParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      if (isBackendConfigured) {
        try {
          const userId = getCurrentUserId();
          const response = await fetchJson<{ question: Question }>(
            '/api/questions/create',
            {
              method: 'POST',
              body: JSON.stringify({
                ...data,
                userId,
              }),
            }
          );
          if (response.success) {
            return response.data.question;
          }
          throw new Error(response.error || 'Failed to create question');
        } catch (error) {
          console.log('[useCreateQuestion] Backend failed:', error);
          throw error;
        }
      }

      // Return mock response only for local development without backend
      await delay();
      const newQuestion: Question = {
        id: `question_${Date.now()}`,
        text: data.text,
        userId: 'local_user',
        category: data.category || 'General',
        rewardAmount: data.rewardAmount || 0,
        isInstantReward: data.isInstantReward || false,
        totalAnswers: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return newQuestion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.all });
    },
  });
}

/**
 * Submit response to a question (with optimistic update)
 * Immediately adds the response to the UI while server processes
 */
export function useSubmitQuestionResponse(): UseMutationResult<
  Response & { rewardEarned?: number },
  Error,
  SubmitResponseParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, responseText }) => {
      if (isBackendConfigured) {
        try {
          const userId = getCurrentUserId();
          const response = await fetchJson<{ response: Response; rewardEarned?: number }>(
            `/api/questions/${questionId}/responses`,
            {
              method: 'POST',
              body: JSON.stringify({
                responseText,
                userId,
              }),
            }
          );
          if (response.success) {
            return { ...response.data.response, rewardEarned: response.data.rewardEarned };
          }
          throw new Error(response.error || 'Failed to submit response');
        } catch (error) {
          console.log('[useSubmitQuestionResponse] Backend failed:', error);
          throw error;
        }
      }

      // Mock response for local development
      await delay();
      const newResponse: Response = {
        id: `response_${Date.now()}`,
        responseText,
        userId: 'local_user',
        questionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        likesCount: 0,
        dislikesCount: 0,
        repliesCount: 0,
        isLiked: false,
        isDisliked: false,
      };
      return { ...newResponse, rewardEarned: 0 };
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
        { queryKey: ['questions', 'infinite'] },
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
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.userStats });
    },
  });
}

/**
 * Fetch leaderboard data
 */
export function useQuestionsLeaderboard(
  limit: number = 10
): UseQueryResult<LeaderboardResult, Error> {
  return useQuery({
    queryKey: [...questionQueryKeys.leaderboard, limit],
    queryFn: async () => {
      if (isBackendConfigured) {
        try {
          const response = await fetchJson<LeaderboardResult>(
            `/api/questions/leaderboard?limit=${limit}`
          );
          if (response.success) return response.data;
        } catch (error) {
          console.log('[useQuestionsLeaderboard] Backend failed, using mock:', error);
        }
      }

      // Mock leaderboard
      await delay();
      const mockLeaderboard: LeaderboardUser[] = [
        { id: '1', name: 'Sarah K.', points: 15420, rank: 1 },
        { id: '2', name: 'James M.', points: 12350, rank: 2 },
        { id: '3', name: 'Emma L.', points: 11200, rank: 3 },
        { id: '4', name: 'Alex P.', points: 9800, rank: 4 },
        { id: '5', name: 'Chris W.', points: 8500, rank: 5 },
      ].slice(0, limit);

      return {
        users: mockLeaderboard,
        currentUserRank: 42,
        totalUsers: 5234,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch user questions stats
 */
export function useUserQuestionsStats(): UseQueryResult<UserQuestionsStats, Error> {
  return useQuery({
    queryKey: questionQueryKeys.userStats,
    queryFn: async () => {
      if (isBackendConfigured) {
        try {
          const response = await fetchJson<UserQuestionsStats>(
            '/api/users/stats/questions'
          );
          if (response.success) return response.data;
        } catch (error) {
          console.log('[useUserQuestionsStats] Backend failed, using mock:', error);
        }
      }

      // Mock stats for local development
      await delay();
      return {
        totalAnswered: 0,
        totalEarnings: 0,
        currentStreak: 0,
        questionsAnsweredToday: 0,
        dailyTarget: 10,
        weeklyProgress: [0, 0, 0, 0, 0, 0, 0],
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Prefetch questions for better UX
 */
export function usePrefetchQuestions() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    const tabs: FeedTabId[] = ['for-you', 'latest', 'rewards'];
    const limit = 20;
    tabs.forEach((tab) => {
      queryClient.prefetchInfiniteQuery({
        queryKey: ['questions', 'infinite', tab, limit],
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

export default {
  useInfiniteQuestionsFeed,
  useQuestionDetail,
  useVoteQuestion,
  useCreateQuestion,
  useSubmitQuestionResponse,
  useQuestionsLeaderboard,
  useUserQuestionsStats,
  usePrefetchQuestions,
};
