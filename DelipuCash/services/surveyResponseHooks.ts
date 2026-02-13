/**
 * Survey Response Hooks
 * TanStack Query hooks for survey responses data fetching
 * 
 * Following industry best practices:
 * - TanStack Query for server state (data fetching, caching, refetching)
 * - Zustand for client-only state (UI preferences, filters, view mode)
 * 
 * This separation ensures:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Optimistic updates
 * - Error handling with retries
 * - Loading states managed automatically
 */

import { useQuery, useQueryClient, UseQueryResult, useSuspenseQuery } from '@tanstack/react-query';
import type { Survey, SurveyResponse, UploadSurvey } from '@/types';
import { surveyApi } from './surveyApi';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const surveyResponseKeys = {
  all: ['surveyResponses'] as const,
  lists: () => [...surveyResponseKeys.all, 'list'] as const,
  list: (surveyId: string, filters?: ResponseFilters) => 
    [...surveyResponseKeys.lists(), surveyId, filters] as const,
  details: () => [...surveyResponseKeys.all, 'detail'] as const,
  detail: (surveyId: string) => [...surveyResponseKeys.details(), surveyId] as const,
  analytics: (surveyId: string) => [...surveyResponseKeys.all, 'analytics', surveyId] as const,
  ownership: (surveyId: string, userId: string) => 
    [...surveyResponseKeys.all, 'ownership', surveyId, userId] as const,
};

// ============================================================================
// TYPES
// ============================================================================

export interface ResponseFilters {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface SurveyResponsesData {
  responses: SurveyResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SurveyAnalyticsData {
  totalResponses: number;
  completionRate: number;
  averageCompletionTime: number;
  responsesByDay: { date: string; count: number }[];
  questionStats: {
    questionId: string;
    questionText: string;
    questionType: string;
    answerDistribution: Record<string, number>;
  }[];
}

export interface SurveyWithQuestions extends Survey {
  questions: UploadSurvey[];
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to check if user owns a survey
 * Uses caching to prevent redundant ownership checks
 */
export function useSurveyOwnership(
  surveyId: string | undefined,
  userId: string | undefined
): UseQueryResult<boolean, Error> {
  return useQuery({
    queryKey: surveyResponseKeys.ownership(surveyId || '', userId || ''),
    queryFn: async () => {
      if (!surveyId || !userId) return false;
      // Check ownership by comparing survey creator with user
      const response = await surveyApi.getById(surveyId);
      if (!response.success || !response.data) return false;
      return response.data.userId === userId;
    },
    enabled: !!surveyId && !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutes - ownership rarely changes
    gcTime: 1000 * 60 * 30, // 30 minutes cache
  });
}

/**
 * Hook to fetch survey details with questions
 * Cached for efficiency across components
 */
export function useSurveyWithQuestions(
  surveyId: string | undefined
): UseQueryResult<Survey | null, Error> {
  return useQuery({
    queryKey: surveyResponseKeys.detail(surveyId || ''),
    queryFn: async () => {
      if (!surveyId) return null;
      const response = await surveyApi.getById(surveyId);
      if (!response.success) throw new Error(response.error || 'Failed to fetch survey');
      return response.data || null;
    },
    enabled: !!surveyId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes cache
  });
}

/**
 * Hook to fetch survey responses with pagination
 * Supports filtering by date range
 */
export function useSurveyResponses(
  surveyId: string | undefined,
  filters?: ResponseFilters,
  options?: { enabled?: boolean }
): UseQueryResult<SurveyResponsesData, Error> {
  return useQuery({
    queryKey: surveyResponseKeys.list(surveyId || '', filters),
    queryFn: async () => {
      if (!surveyId) {
        return {
          responses: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        };
      }
      
      const response = await surveyApi.getResponses(
        surveyId,
        filters?.page || 1,
        filters?.limit || 100
      );
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch responses');
      }
      
      // Transform PaginatedResponse to SurveyResponsesData format
      return {
        responses: response.data,
        pagination: response.pagination,
      };
    },
    enabled: options?.enabled !== false && !!surveyId,
    staleTime: 1000 * 60 * 2, // 2 minutes - responses can change
    gcTime: 1000 * 60 * 10, // 10 minutes cache
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    retry: 2,
  });
}

/**
 * Hook to fetch survey analytics
 * Computed server-side for efficiency
 */
export function useSurveyAnalytics(
  surveyId: string | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<SurveyAnalyticsData, Error> {
  return useQuery({
    queryKey: surveyResponseKeys.analytics(surveyId || ''),
    queryFn: async () => {
      if (!surveyId) {
        return {
          totalResponses: 0,
          completionRate: 0,
          averageCompletionTime: 0,
          responsesByDay: [],
          questionStats: [],
        };
      }
      
      // Use getAnalytics instead of getDetailedAnalytics
      const response = await surveyApi.getAnalytics(surveyId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch analytics');
      }
      
      // Map the API response to SurveyAnalyticsData format
      return {
        totalResponses: response.data.totalResponses,
        completionRate: response.data.completionRate,
        averageCompletionTime: response.data.averageTime,
        responsesByDay: response.data.responsesByDay,
        questionStats: response.data.questionStats.map(stat => ({
          questionId: stat.questionId,
          questionText: stat.questionText,
          questionType: 'multiple_choice', // Default type since API doesn't provide it
          answerDistribution: stat.responseDistribution.reduce((acc, item) => {
            acc[item.option] = item.count;
            return acc;
          }, {} as Record<string, number>),
        })),
      };
    },
    enabled: options?.enabled !== false && !!surveyId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes cache
  });
}

/**
 * Hook to fetch all survey response data at once
 * Combines survey details, responses, and ownership check
 * Use when you need all data for the survey responses screen
 */
export function useSurveyResponseData(
  surveyId: string | undefined,
  userId: string | undefined,
  filters?: {
    dateRange?: { startDate: string; endDate: string };
    page?: number;
    limit?: number;
  }
) {
  const ownership = useSurveyOwnership(surveyId, userId);
  const survey = useSurveyWithQuestions(surveyId);
  const responses = useSurveyResponses(surveyId, filters as ResponseFilters, {
    enabled: ownership.data === true,
  });
  const analytics = useSurveyAnalytics(surveyId, {
    enabled: ownership.data === true,
  });

  const isLoading = ownership.isLoading || survey.isLoading;
  const isLoadingResponses = responses.isLoading || analytics.isLoading;
  const isError = ownership.isError || survey.isError || responses.isError || analytics.isError;
  const error = ownership.error || survey.error || responses.error || analytics.error;
  
  // Get the most recent data update timestamp
  const dataUpdatedAt = Math.max(
    responses.dataUpdatedAt || 0,
    analytics.dataUpdatedAt || 0,
    survey.dataUpdatedAt || 0
  );

  return {
    // Ownership
    isOwner: ownership.data,
    isCheckingOwnership: ownership.isLoading,
    
    // Survey
    survey: survey.data,
    questions: survey.data?.uploads || [],
    
    // Responses
    responses: responses.data?.responses || [],
    pagination: responses.data?.pagination,
    
    // Analytics
    analytics: analytics.data,
    
    // States
    isLoading,
    isLoadingResponses,
    isFetching: responses.isFetching || analytics.isFetching || survey.isFetching,
    isRefetching: responses.isRefetching || analytics.isRefetching,
    isError,
    error,
    dataUpdatedAt,
    
    // Refetch functions
    refetchResponses: responses.refetch,
    refetchAnalytics: analytics.refetch,
    refetchAll: () => {
      responses.refetch();
      analytics.refetch();
      survey.refetch();
    },
  };
}

/**
 * Hook to invalidate survey response cache
 * Use after mutations that affect responses
 */
export function useInvalidateSurveyResponses() {
  const queryClient = useQueryClient();
  
  return {
    invalidateResponses: (surveyId: string) => {
      queryClient.invalidateQueries({ 
        queryKey: surveyResponseKeys.list(surveyId) 
      });
    },
    invalidateAnalytics: (surveyId: string) => {
      queryClient.invalidateQueries({ 
        queryKey: surveyResponseKeys.analytics(surveyId) 
      });
    },
    invalidateAll: (surveyId: string) => {
      queryClient.invalidateQueries({ 
        queryKey: surveyResponseKeys.detail(surveyId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: surveyResponseKeys.list(surveyId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: surveyResponseKeys.analytics(surveyId) 
      });
    },
  };
}

/**
 * Hook to prefetch survey responses
 * Use for optimistic UI when navigating to response screen
 */
export function usePrefetchSurveyResponses() {
  const queryClient = useQueryClient();
  
  return async (surveyId: string, filters?: ResponseFilters) => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: surveyResponseKeys.detail(surveyId),
        queryFn: async () => {
          const response = await surveyApi.getById(surveyId);
          return response.data;
        },
        staleTime: 1000 * 60 * 5,
      }),
      queryClient.prefetchQuery({
        queryKey: surveyResponseKeys.list(surveyId, filters),
        queryFn: async () => {
          const response = await surveyApi.getResponses(
            surveyId,
            filters?.page || 1,
            filters?.limit || 100
          );
          return {
            responses: response.data,
            pagination: response.pagination,
          };
        },
        staleTime: 1000 * 60 * 2,
      }),
    ]);
  };
}

// ============================================================================
// Suspense Hooks (2026 — use inside <Suspense> boundary)
// ============================================================================

/**
 * Suspense-enabled survey detail.
 * Throws promise while loading — guaranteed non-null data on render.
 */
export function useSuspenseSurveyDetail(surveyId: string) {
  return useSuspenseQuery({
    queryKey: surveyResponseKeys.detail(surveyId),
    queryFn: async () => {
      const response = await surveyApi.getById(surveyId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Survey not found');
      }
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: 2,
  });
}

/**
 * Suspense-enabled survey responses.
 * Throws promise while loading — guaranteed non-null data on render.
 */
export function useSuspenseSurveyResponses(surveyId: string, filters?: ResponseFilters) {
  return useSuspenseQuery({
    queryKey: surveyResponseKeys.list(surveyId, filters),
    queryFn: async (): Promise<SurveyResponsesData> => {
      const response = await surveyApi.getResponses(
        surveyId,
        filters?.page || 1,
        filters?.limit || 100
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch responses');
      }
      return {
        responses: response.data,
        pagination: response.pagination,
      };
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    retry: 2,
  });
}

/**
 * Suspense-enabled survey analytics.
 */
export function useSuspenseSurveyAnalytics(surveyId: string) {
  return useSuspenseQuery({
    queryKey: surveyResponseKeys.analytics(surveyId),
    queryFn: async (): Promise<SurveyAnalyticsData> => {
      const response = await surveyApi.getAnalytics(surveyId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch analytics');
      }
      return {
        totalResponses: response.data.totalResponses,
        completionRate: response.data.completionRate,
        averageCompletionTime: response.data.averageTime,
        responsesByDay: response.data.responsesByDay,
        questionStats: response.data.questionStats.map(stat => ({
          questionId: stat.questionId,
          questionText: stat.questionText,
          questionType: 'multiple_choice',
          answerDistribution: stat.responseDistribution.reduce((acc, item) => {
            acc[item.option] = item.count;
            return acc;
          }, {} as Record<string, number>),
        })),
      };
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: 2,
  });
}

export default {
  useSurveyOwnership,
  useSurveyWithQuestions,
  useSurveyResponses,
  useSurveyAnalytics,
  useSurveyResponseData,
  useInvalidateSurveyResponses,
  usePrefetchSurveyResponses,
  // Suspense variants
  useSuspenseSurveyDetail,
  useSuspenseSurveyResponses,
  useSuspenseSurveyAnalytics,
};
