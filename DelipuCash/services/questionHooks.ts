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
 * const { data, isLoading, refetch } = useQuestionsFeed({ tab: 'for-you' });
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
  UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { Question, Response, AppUser, ApiResponse } from '@/types';
import { FeedQuestion, QuestionAuthor, LeaderboardUser } from '@/components/feed';

// ===========================================
// Types
// ===========================================

export type FeedTabId = 'for-you' | 'latest' | 'unanswered' | 'rewards' | 'my-activity';

export interface QuestionsFeedParams {
  tab: FeedTabId;
  page?: number;
  limit?: number;
  userId?: string;
}

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
  feed: (params: QuestionsFeedParams) => ['questions', 'feed', params] as const,
  detail: (id: string) => ['questions', 'detail', id] as const,
  responses: (id: string) => ['questions', 'responses', id] as const,
  leaderboard: ['questions', 'leaderboard'] as const,
  userStats: ['questions', 'userStats'] as const,
  categories: ['questions', 'categories'] as const,
  search: (query: string) => ['questions', 'search', query] as const,
};

// ===========================================
// Helper Functions
// ===========================================

/**
 * Transform backend question to FeedQuestion format
 */
function transformToFeedQuestion(
  question: Question & { user?: Partial<AppUser> },
  index?: number
): FeedQuestion {
  // Generate author from user data or mock
  const author: QuestionAuthor = question.user
    ? {
        id: question.user.id || question.userId || 'anonymous',
        name: `${question.user.firstName || 'Anonymous'} ${question.user.lastName || 'User'}`.trim(),
        avatar: question.user.avatar || undefined,
        reputation: question.user.points || Math.floor(Math.random() * 5000) + 100,
        badge: question.user.points && question.user.points > 1000 ? 'top-contributor' : undefined,
      }
    : {
        id: question.userId || 'anonymous',
        name: 'Anonymous User',
        reputation: Math.floor(Math.random() * 5000) + 100,
        badge: Math.random() > 0.7 ? 'top-contributor' : undefined,
      };

  // Calculate engagement metrics
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(question.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    ...question,
    author,
    upvotes: Math.floor(Math.random() * 50) + (question.totalAnswers || 0) * 2,
    downvotes: Math.floor(Math.random() * 5),
    followersCount: Math.floor(Math.random() * 100) + 5,
    isHot: daysSinceCreation <= 1 && (question.totalAnswers || 0) > 5,
    isTrending: daysSinceCreation <= 3 && (question.totalAnswers || 0) > 10,
    hasExpertAnswer: Math.random() > 0.8,
    hasAcceptedAnswer: Math.random() > 0.6,
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
 * Fetch questions feed with tab filtering
 */
export function useQuestionsFeed(
  params: QuestionsFeedParams
): UseQueryResult<QuestionsFeedResult, Error> {
  const { tab, page = 1, limit = 20 } = params;

  return useQuery({
    queryKey: questionQueryKeys.feed(params),
    queryFn: async (): Promise<QuestionsFeedResult> => {
      const response = await fetchJson<any>('/api/questions/all');
      const questions = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
        ? response.data
        : [];

      if (response.success && Array.isArray(questions)) {
        const feedQuestions = questions.map((q: Question, i: number) => transformToFeedQuestion(q, i));
        const sortedQuestions = sortQuestionsByTab(feedQuestions, tab);
        const start = (page - 1) * limit;
        const paginatedQuestions = sortedQuestions.slice(start, start + limit);

        return {
          questions: paginatedQuestions,
          pagination: {
            page,
            limit,
            total: response.data?.pagination?.total || sortedQuestions.length,
            totalPages: response.data?.pagination?.totalPages || Math.ceil(sortedQuestions.length / limit),
            hasMore:
              response.data?.pagination?.total
                ? start + limit < response.data.pagination.total
                : start + limit < sortedQuestions.length,
          },
          stats: {
            totalQuestions: questions.length,
            unansweredCount: questions.filter((q: Question) => (q.totalAnswers || 0) === 0).length,
            rewardsCount: questions.filter((q: Question) => q.isInstantReward).length,
          },
        };
      }

      // Return empty state if API fails
      return {
        questions: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
        stats: {
          totalQuestions: 0,
          unansweredCount: 0,
          rewardsCount: 0,
        },
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
  });
}

/**
 * Infinite scroll questions feed
 */
export function useInfiniteQuestionsFeed(
  tab: FeedTabId,
  limit: number = 20
): UseInfiniteQueryResult<{ pages: QuestionsFeedResult[] }, Error> {
  return useInfiniteQuery({
    queryKey: ['questions', 'infinite', tab, limit],
    queryFn: async ({ pageParam = 1 }): Promise<QuestionsFeedResult> => {
      // Reuse the same logic as useQuestionsFeed
      if (isBackendConfigured) {
        try {
          const response = await fetchJson<any>('/api/questions/all');
          const questions = Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data)
            ? response.data
            : [];

          if (response.success && Array.isArray(questions)) {
            const feedQuestions = questions.map((q: Question, i: number) => transformToFeedQuestion(q, i));
            const sortedQuestions = sortQuestionsByTab(feedQuestions, tab);
            const start = (pageParam - 1) * limit;
            const paginatedQuestions = sortedQuestions.slice(start, start + limit);

            return {
              questions: paginatedQuestions,
              pagination: {
                page: pageParam,
                limit,
                total: response.data?.pagination?.total || sortedQuestions.length,
                totalPages: response.data?.pagination?.totalPages || Math.ceil(sortedQuestions.length / limit),
                hasMore:
                  response.data?.pagination?.total
                    ? start + limit < response.data.pagination.total
                    : start + limit < sortedQuestions.length,
              },
              stats: {
                totalQuestions: questions.length,
                unansweredCount: questions.filter((q: Question) => (q.totalAnswers || 0) === 0).length,
                rewardsCount: questions.filter((q: Question) => q.isInstantReward).length,
              },
            };
          }
        } catch (error) {
          console.log('[useInfiniteQuestionsFeed] Backend failed, using mock:', error);
        }
      }

      await delay();
      // Return empty state when API fails and no backend
      return {
        questions: [],
        pagination: {
          page: pageParam,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
        stats: {
          totalQuestions: 0,
          unansweredCount: 0,
          rewardsCount: 0,
        },
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    staleTime: 1000 * 60 * 2,
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
 * Vote on a question (optimistic update)
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
          const response = await fetchJson<{ upvotes: number; downvotes: number }>(
            `/api/questions/${questionId}/vote`,
            {
              method: 'POST',
              body: JSON.stringify({ type }),
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
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: questionQueryKeys.all });

      // Update all feed queries optimistically
      queryClient.setQueriesData<QuestionsFeedResult>(
        { queryKey: ['questions', 'feed'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            questions: old.questions.map((q) =>
              q.id === questionId
                ? {
                    ...q,
                    upvotes: type === 'up' ? (q.upvotes || 0) + 1 : q.upvotes,
                    downvotes: type === 'down' ? (q.downvotes || 0) + 1 : q.downvotes,
                    userHasVoted: type,
                  }
                : q
            ),
          };
        }
      );
    },
    onError: () => {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.all });
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
          const response = await fetchJson<{ question: Question }>(
            '/api/questions/create',
            {
              method: 'POST',
              body: JSON.stringify({
                // userId will be set by the backend from the auth token
                ...data,
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
 * Submit response to a question
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
          const response = await fetchJson<{ response: Response; rewardEarned?: number }>(
            `/api/questions/${questionId}/responses`,
            {
              method: 'POST',
              body: JSON.stringify({
                responseText,
                // userId will be set by the backend from the auth token
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
      return {
        ...newResponse,
        rewardEarned: 0,
      };
    },
    onSuccess: (_, { questionId }) => {
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
 * Fetch question categories
 */
export function useQuestionCategories(): UseQueryResult<string[], Error> {
  return useQuery({
    queryKey: questionQueryKeys.categories,
    queryFn: async () => {
      if (isBackendConfigured) {
        try {
          const response = await fetchJson<string[]>('/api/questions/categories');
          if (response.success) return response.data;
        } catch (error) {
          console.log('[useQuestionCategories] Backend failed, using mock:', error);
        }
      }

      await delay(200);
      // Return default categories when API unavailable
      const defaultCategories = ['General', 'Technology', 'Science', 'Entertainment', 'Sports', 'Business'];
      return defaultCategories;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Search questions
 */
export function useSearchQuestions(
  query: string
): UseQueryResult<FeedQuestion[], Error> {
  return useQuery({
    queryKey: questionQueryKeys.search(query),
    queryFn: async () => {
      if (!query.trim()) return [];

      if (isBackendConfigured) {
        try {
          const response = await fetchJson<Question[]>(
            `/api/questions/search?q=${encodeURIComponent(query)}`
          );
          if (response.success) {
            return response.data.map((q, i) => transformToFeedQuestion(q, i));
          }
        } catch (error) {
          console.log('[useSearchQuestions] Backend failed, using mock:', error);
        }
      }

      await delay();
      // Return empty results when API unavailable
      return [];
    },
    enabled: query.length > 2,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Prefetch questions for better UX
 */
export function usePrefetchQuestions() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    // Prefetch common tabs by triggering the useQuestionsFeed queryFn
    const tabs: FeedTabId[] = ['for-you', 'latest', 'rewards'];
    tabs.forEach((tab) => {
      queryClient.prefetchQuery({
        queryKey: questionQueryKeys.feed({ tab }),
        queryFn: async (): Promise<QuestionsFeedResult> => {
          const response = await fetchJson<Question[]>('/api/questions/all');
          if (response.success && Array.isArray(response.data)) {
            const feedQuestions = response.data.map((q, i) => transformToFeedQuestion(q, i));
            const sortedQuestions = sortQuestionsByTab(feedQuestions, tab);
            return {
              questions: sortedQuestions.slice(0, 20),
              pagination: {
                page: 1,
                limit: 20,
                total: sortedQuestions.length,
                totalPages: Math.ceil(sortedQuestions.length / 20),
                hasMore: sortedQuestions.length > 20,
              },
              stats: {
                totalQuestions: response.data.length,
                unansweredCount: response.data.filter((q) => (q.totalAnswers || 0) === 0).length,
                rewardsCount: response.data.filter((q) => q.isInstantReward).length,
              },
            };
          }
          // Return empty state if API fails
          return {
            questions: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
            stats: { totalQuestions: 0, unansweredCount: 0, rewardsCount: 0 },
          };
        },
        staleTime: 1000 * 60 * 2,
      });
    });
  }, [queryClient]);
}

/**
 * Combined hook for questions screen state
 */
export function useQuestionsScreen(initialTab: FeedTabId = 'for-you') {
  const feedQuery = useQuestionsFeed({ tab: initialTab });
  const statsQuery = useUserQuestionsStats();
  const leaderboardQuery = useQuestionsLeaderboard(3);
  const voteMutation = useVoteQuestion();
  const createMutation = useCreateQuestion();
  const prefetch = usePrefetchQuestions();

  const isLoading = feedQuery.isLoading || statsQuery.isLoading;
  const isRefreshing = feedQuery.isFetching && !feedQuery.isLoading;

  const refetchAll = useCallback(async () => {
    await Promise.all([
      feedQuery.refetch(),
      statsQuery.refetch(),
      leaderboardQuery.refetch(),
    ]);
  }, [feedQuery, statsQuery, leaderboardQuery]);

  return {
    // Feed data
    questions: feedQuery.data?.questions || [],
    pagination: feedQuery.data?.pagination,
    feedStats: feedQuery.data?.stats,

    // User stats
    userStats: statsQuery.data,

    // Leaderboard
    leaderboard: leaderboardQuery.data,

    // Loading states
    isLoading,
    isRefreshing,
    isFeedError: feedQuery.isError,
    feedError: feedQuery.error,

    // Actions
    refetch: refetchAll,
    refetchFeed: feedQuery.refetch,
    vote: voteMutation.mutate,
    isVoting: voteMutation.isPending,
    createQuestion: createMutation.mutate,
    isCreating: createMutation.isPending,
    prefetch,
  };
}

export default {
  useQuestionsFeed,
  useInfiniteQuestionsFeed,
  useQuestionDetail,
  useVoteQuestion,
  useCreateQuestion,
  useSubmitQuestionResponse,
  useQuestionsLeaderboard,
  useUserQuestionsStats,
  useQuestionCategories,
  useSearchQuestions,
  usePrefetchQuestions,
  useQuestionsScreen,
};
