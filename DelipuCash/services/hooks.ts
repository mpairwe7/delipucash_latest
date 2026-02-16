/**
 * Custom hooks for data fetching
 * These hooks use React Query for caching and state management
 */

import {
    AppUser,
  Comment,
  LoginSession,
    Notification,
    Payment,
    Question,
    Response,
    Reward,
    RewardAnswerResult,
    RewardQuestion,
    Survey,
    Transaction,
    UploadSurvey,
    UserStats,
    Video,
} from "@/types";
import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult, useSuspenseQuery } from "@tanstack/react-query";
import api from "./api";
import { useAuthStore } from '@/utils/auth/store';
import { questionQueryKeys } from "./questionHooks";

// Query Keys
export const queryKeys = {
  user: ["user"] as const,
  userStats: ["user", "stats"] as const,
  userSessions: ["user", "sessions"] as const,
  videos: ["videos"] as const,
  trendingVideos: ["videos", "trending"] as const,
  video: (id: string) => ["videos", id] as const,
  surveys: ["surveys"] as const,
  runningSurveys: ["surveys", "running"] as const,
  upcomingSurveys: ["surveys", "upcoming"] as const,
  completedSurveys: ["surveys", "completed"] as const,
  survey: (id: string) => ["surveys", id] as const,
  questions: ["questions"] as const,
  recentQuestions: ["questions", "recent"] as const,
  instantQuestions: ["questions", "instant"] as const,
  question: (id: string) => ["questions", id] as const,
  transactions: ["transactions"] as const,
  notifications: ["notifications"] as const,
  unreadCount: ["notifications", "unread"] as const,
  rewards: ["rewards"] as const,
  rewardQuestions: ["rewards", "questions"] as const,
  regularRewardQuestions: ["rewards", "questions", "regular"] as const,
  rewardQuestion: (id: string) => ["rewards", "questions", id] as const,
  dailyReward: ["rewards", "daily"] as const,
  ads: ["ads"] as const,
  dashboard: ["dashboard"] as const,
};

// ===========================================
// Reward API Response Shapes
// ===========================================

/** Pagination shape shared by regular/instant reward endpoints */
interface RewardQuestionPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

/** GET /api/reward-questions/regular — response.data shape */
interface RegularRewardQuestionsPayload {
  rewardQuestions: RewardQuestion[];
  pagination: RewardQuestionPagination;
}

/** GET /api/reward-questions/instant — response.data shape */
interface InstantRewardQuestionsPayload {
  instantRewardQuestions: RewardQuestion[];
  pagination: RewardQuestionPagination;
}

/** GET /api/reward-questions/:id — actual JSON shape (API layer generic mismatches) */
interface RewardQuestionByIdPayload {
  rewardQuestion: RewardQuestion;
}

// ===========================================
// User Hooks
// ===========================================

/**
 * Hook to fetch current user profile
 */
export function useUserProfile(): UseQueryResult<AppUser, Error> {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: async () => {
      const response = await api.user.getProfile();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch user statistics
 */
export function useUserStats(): UseQueryResult<UserStats, Error> {
  return useQuery({
    queryKey: queryKeys.userStats,
    queryFn: async () => {
      const response = await api.user.getStats();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to update user profile
 */
export function useUpdateProfile(): UseMutationResult<AppUser, Error, Partial<AppUser>> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ['user', 'updateProfile'],
    mutationFn: async (data: Partial<AppUser>) => {
      const response = await api.user.updateProfile(data);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.user, data);
    },
  });
}

/**
 * Hook to fetch user login sessions
 */
export function useUserSessions(): UseQueryResult<LoginSession[], Error> {
  return useQuery({
    queryKey: queryKeys.userSessions,
    queryFn: async () => {
      const response = await api.user.getSessions();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to revoke a user session
 */
export function useRevokeSession(): UseMutationResult<{ revoked: boolean }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['user', 'revokeSession'],
    mutationFn: async (sessionId: string) => {
      const response = await api.user.revokeSession(sessionId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userSessions });
    },
  });
}

/**
 * Response type for 2FA toggle
 */
interface TwoFactorToggleResponse {
  enabled?: boolean;
  codeSent?: boolean;
  email?: string;
  expiresIn?: number;
  devCode?: string;
}

/**
 * Hook to toggle 2FA settings
 * When enabling: Returns codeSent=true, need to call verify2FACode next
 * When disabling: Requires password, returns enabled=false
 */
export function useUpdateTwoFactor(): UseMutationResult<
  TwoFactorToggleResponse,
  Error,
  { enabled: boolean; password?: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['user', 'updateTwoFactor'],
    mutationFn: async ({ enabled, password }) => {
      const response = await api.user.updateTwoFactor(enabled, password);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      // Only invalidate if 2FA was actually toggled (not just code sent)
      if (data.enabled !== undefined) {
        queryClient.invalidateQueries({ queryKey: queryKeys.user });
      }
    },
  });
}

/**
 * Hook to verify 2FA code (to complete enabling 2FA)
 */
export function useVerify2FACode(): UseMutationResult<{ enabled: boolean }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['user', 'verify2FA'],
    mutationFn: async (code: string) => {
      const response = await api.user.verify2FACode(code);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}

/**
 * Hook to resend 2FA verification code
 */
export function useResend2FACode(): UseMutationResult<
  { codeSent: boolean; email: string; expiresIn: number },
  Error,
  void
> {
  return useMutation({
    mutationKey: ['user', 'resend2FA'],
    mutationFn: async () => {
      const response = await api.user.resend2FACode();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
  });
}

/**
 * Hook to change password
 */
export function useChangePassword(): UseMutationResult<{ success: boolean }, Error, { currentPassword: string; newPassword: string }> {
  return useMutation({
    mutationKey: ['user', 'changePassword'],
    mutationFn: async ({ currentPassword, newPassword }) => {
      const response = await api.user.changePassword(currentPassword, newPassword);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
  });
}

/**
 * Hook to update privacy settings
 */
export function useUpdatePrivacySettings(): UseMutationResult<{ shareProfile: boolean; shareActivity: boolean }, Error, { shareProfile: boolean; shareActivity: boolean }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['user', 'updatePrivacy'],
    mutationFn: async (settings) => {
      const response = await api.user.updatePrivacySettings(settings);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}

// ===========================================
// User Suspense Hooks (use inside <Suspense> boundary)
// ===========================================

/**
 * Suspense-enabled user profile.
 * Throws promise while loading — guaranteed non-null data on render.
 */
export function useSuspenseUserProfile() {
  return useSuspenseQuery({
    queryKey: queryKeys.user,
    queryFn: async () => {
      const response = await api.user.getProfile();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Suspense-enabled user stats.
 * Throws promise while loading — guaranteed non-null data on render.
 */
export function useSuspenseUserStats() {
  return useSuspenseQuery({
    queryKey: queryKeys.userStats,
    queryFn: async () => {
      const response = await api.user.getStats();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Suspense-enabled user sessions.
 * Throws promise while loading — guaranteed non-null data on render.
 */
export function useSuspenseUserSessions() {
  return useSuspenseQuery({
    queryKey: queryKeys.userSessions,
    queryFn: async () => {
      const response = await api.user.getSessions();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ===========================================
// Videos Hooks
// ===========================================

/**
 * Hook to fetch all videos
 */
export function useVideos(params?: { page?: number; limit?: number; category?: string }): UseQueryResult<{
  videos: Video[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}, Error> {
  return useQuery({
    queryKey: [...queryKeys.videos, params],
    queryFn: async () => {
      const response = await api.videos.getAll(params);
      if (!response.success) throw new Error("Failed to fetch videos");
      return {
        videos: response.data,
        pagination: response.pagination,
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch a single video
 */
export function useVideo(videoId: string): UseQueryResult<Video | null, Error> {
  return useQuery({
    queryKey: queryKeys.video(videoId),
    queryFn: async () => {
      const response = await api.videos.getById(videoId);
      return response.data;
    },
    enabled: !!videoId,
  });
}

/**
 * Hook to like a video
 * @deprecated Use useLikeVideo from videoHooks.ts instead (has optimistic updates + rollback)
 */
export function useLikeVideo(): UseMutationResult<Video, Error, string> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ['videos', 'like'],
    mutationFn: async (videoId: string) => {
      const response = await api.videos.like(videoId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.video(data.id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.videos });
      queryClient.invalidateQueries({ queryKey: queryKeys.trendingVideos });
    },
  });
}

/**
 * Hook to fetch trending videos
 */
export function useTrendingVideos(limit: number = 10): UseQueryResult<Video[], Error> {
  return useQuery({
    queryKey: [...queryKeys.trendingVideos, limit],
    queryFn: async () => {
      const response = await api.videos.getTrending(limit);
      if (!response.success) throw new Error(response.error || "Failed to fetch trending videos");
      return response.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to fetch live videos
 */
export function useLiveVideos(): UseQueryResult<Video[], Error> {
  return useQuery({
    queryKey: ["videos", "live"],
    queryFn: async () => {
      const response = await api.videos.getLive();
      if (!response.success) throw new Error(response.error || "Failed to fetch live videos");
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds - live content updates frequently
  });
}

/**
 * Hook to fetch recommended videos
 */
export function useRecommendedVideos(limit: number = 10): UseQueryResult<Video[], Error> {
  return useQuery({
    queryKey: ["videos", "recommended", limit],
    queryFn: async () => {
      const response = await api.videos.getRecommended(limit);
      if (!response.success) throw new Error(response.error || "Failed to fetch recommended videos");
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to bookmark/unbookmark a video
 * @deprecated Use useBookmarkVideo from videoHooks.ts instead (has optimistic updates + rollback)
 */
export function useBookmarkVideo(): UseMutationResult<Video, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['videos', 'bookmark'],
    mutationFn: async (videoId: string) => {
      const response = await api.videos.bookmark(videoId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.video(data.id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.videos });
    },
  });
}

/**
 * Hook to unlike a video
 * @deprecated Use useLikeVideo from videoHooks.ts instead (combined like/unlike with rollback)
 */
export function useUnlikeVideo(): UseMutationResult<Video, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['videos', 'unlike'],
    mutationFn: async (videoId: string) => {
      const response = await api.videos.unlike(videoId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.video(data.id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.videos });
      queryClient.invalidateQueries({ queryKey: queryKeys.trendingVideos });
    },
  });
}

/**
 * Share platform types
 */
export type SharePlatform = 'copy' | 'twitter' | 'facebook' | 'whatsapp' | 'instagram' | 'telegram' | 'email' | 'sms' | 'other';

/**
 * Hook to share a video (tracks share for analytics)
 * @deprecated Use useShareVideo from videoHooks.ts instead
 */
export function useShareVideo(): UseMutationResult<
  { shared: boolean; platform: SharePlatform },
  Error,
  { videoId: string; platform: SharePlatform }
> {
  return useMutation({
    mutationKey: ['videos', 'share'],
    mutationFn: async ({ videoId, platform }) => {
      const response = await api.videos.share(videoId, platform);
      if (!response.success) throw new Error(response.error);
      return { shared: response.data.shared, platform };
    },
  });
}

/**
 * Hook to add a comment to a video
 * @deprecated Use useAddVideoComment from videoHooks.ts instead (has optimistic insert + rollback)
 */
export function useAddComment(): UseMutationResult<
  Comment,
  Error,
  { videoId: string; text: string; mediaUrls?: string[] }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['videos', 'addComment'],
    mutationFn: async ({ videoId, text, mediaUrls }) => {
      const response = await api.videos.addComment(videoId, text, mediaUrls);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.video(variables.videoId) });
      queryClient.invalidateQueries({ queryKey: ['comments', variables.videoId] });
    },
  });
}

/**
 * Hook to fetch video comments
 * @deprecated Use useVideoCommentsQuery from videoHooks.ts instead
 */
export function useVideoComments(
  videoId: string,
  page: number = 1,
  limit: number = 20
): UseQueryResult<{ comments: Comment[]; pagination: { page: number; limit: number; total: number; totalPages: number } }, Error> {
  return useQuery({
    queryKey: ['comments', videoId, page, limit],
    queryFn: async () => {
      const response = await api.videos.getComments(videoId);
      if (!response.success) throw new Error(response.error || 'Failed to fetch comments');
      return {
        comments: response.data,
        pagination: { page, limit, total: response.data.length, totalPages: 1 },
      };
    },
    enabled: !!videoId,
    staleTime: 1000 * 30, // 30 seconds - comments update frequently
  });
}

/**
 * Hook to upload a video
 */
export function useUploadVideo(): UseMutationResult<
  Video,
  Error,
  { title: string; description?: string; videoUrl: string; thumbnail: string; duration?: number }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['videos', 'upload'],
    mutationFn: async (data) => {
      const response = await api.videos.upload(data);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videos });
    },
  });
}

/**
 * Hook to search videos
 */
export function useSearchVideos(query: string): UseQueryResult<Video[], Error> {
  return useQuery({
    queryKey: ["videos", "search", query],
    queryFn: async () => {
      const response = await api.videos.search(query);
      if (!response.success) throw new Error(response.error || "Search failed");
      return response.data;
    },
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to increment video view
 */
export function useIncrementVideoView(): UseMutationResult<Video, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['videos', 'incrementView'],
    mutationFn: async (videoId: string) => {
      const response = await api.videos.incrementView(videoId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.video(data.id), data);
    },
  });
}

/**
 * Hook to add comment to video
 */
export function useAddVideoComment(): UseMutationResult<Comment, Error, { videoId: string; text: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['videos', 'addVideoComment'],
    mutationFn: async ({ videoId, text }) => {
      const response = await api.videos.addComment(videoId, text);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["videos", variables.videoId, "comments"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.video(variables.videoId) });
    },
  });
}

// ===========================================
// Surveys Hooks
// ===========================================

/**
 * Hook to fetch running surveys
 */
export function useRunningSurveys(): UseQueryResult<Survey[], Error> {
  return useQuery({
    queryKey: queryKeys.runningSurveys,
    queryFn: async () => {
      const response = await api.surveys.getRunning();
      if (!response.success) throw new Error(response.error);
      const payload = response.data as any;
      return Array.isArray(payload) ? payload : (payload?.data ?? []);
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch upcoming surveys
 */
export function useUpcomingSurveys(): UseQueryResult<Survey[], Error> {
  return useQuery({
    queryKey: queryKeys.upcomingSurveys,
    queryFn: async () => {
      const response = await api.surveys.getUpcoming();
      if (!response.success) throw new Error(response.error);
      const payload = response.data as any;
      return Array.isArray(payload) ? payload : (payload?.data ?? []);
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to fetch completed surveys
 */
export function useCompletedSurveys(): UseQueryResult<Survey[], Error> {
  return useQuery({
    queryKey: queryKeys.completedSurveys,
    queryFn: async () => {
      const response = await api.surveys.getCompleted();
      if (!response.success) throw new Error(response.error);
      const payload = response.data as any;
      return Array.isArray(payload) ? payload : (payload?.data ?? []);
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to fetch all surveys with optional filters
 */
export function useSurveys(filters?: { status?: string; search?: string }): UseQueryResult<Survey[], Error> {
  return useQuery({
    queryKey: [...queryKeys.surveys, filters],
    queryFn: async () => {
      const response = await api.surveys.getAll(filters);
      if (!response.success) throw new Error(response.error);
      const payload = response.data as any;
      return Array.isArray(payload) ? payload : (payload?.data ?? []);
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch a single survey with questions
 */
export function useSurvey(surveyId: string): UseQueryResult<Survey | null, Error> {
  return useQuery({
    queryKey: queryKeys.survey(surveyId),
    queryFn: async () => {
      const response = await api.surveys.getById(surveyId);
      return response.data;
    },
    enabled: !!surveyId,
  });
}

/**
 * Hook to check if user has already attempted a survey
 * Industry standard: Single attempt per user per survey
 */
export function useCheckSurveyAttempt(
  surveyId: string, 
  userId: string | undefined
): UseQueryResult<{ hasAttempted: boolean; attemptedAt: string | null; message?: string }, Error> {
  return useQuery({
    queryKey: ["surveyAttempt", surveyId, userId] as const,
    queryFn: async () => {
      if (!userId) {
        return { hasAttempted: false, attemptedAt: null, message: "User not authenticated" };
      }
      const response = await api.surveys.checkAttempt(surveyId, userId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    enabled: !!surveyId && !!userId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

/**
 * Hook to submit survey response
 * Industry standard: sends userId, invalidates caches, prevents re-submission
 */
export function useSubmitSurvey(): UseMutationResult<
  { reward: number; message: string },
  Error,
  { surveyId: string; responses: Record<string, unknown> }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['surveys', 'submit'],
    mutationFn: async ({ surveyId, responses }) => {
      const response = await api.surveys.submit(surveyId, responses);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate surveys list to update response counts
      queryClient.invalidateQueries({ queryKey: queryKeys.surveys });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats });

      // Invalidate attempt check cache for this survey
      queryClient.invalidateQueries({
        queryKey: ["surveyAttempt", variables.surveyId]
      });

      // Invalidate survey responses cache
      queryClient.invalidateQueries({
        queryKey: ["surveyResponses", "list", variables.surveyId]
      });
    },
    retry: 1,
    retryDelay: 2000,
  });
}

/**
 * Hook to create a new survey
 */
export function useCreateSurvey(): UseMutationResult<Survey, Error, {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  rewardAmount?: number;
  maxResponses?: number;
  questions: Omit<UploadSurvey, 'id' | 'userId' | 'surveyId' | 'createdAt' | 'updatedAt'>[];
  userId?: string;
}> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ['surveys', 'create'],
    mutationFn: async (data) => {
      const response = await api.surveys.create(data);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.surveys });
      queryClient.invalidateQueries({ queryKey: queryKeys.runningSurveys });
      queryClient.invalidateQueries({ queryKey: queryKeys.upcomingSurveys });
    },
  });
}

/**
 * Hook to delete a survey
 */
export function useDeleteSurvey(): UseMutationResult<{ deleted: boolean }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['surveys', 'delete'],
    mutationFn: async (surveyId) => {
      const response = await api.surveys.delete(surveyId);
      if (!response.success) throw new Error(response.error || "Failed to delete survey");
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.surveys });
      queryClient.invalidateQueries({ queryKey: queryKeys.runningSurveys });
      queryClient.invalidateQueries({ queryKey: queryKeys.upcomingSurveys });
    },
  });
}

// ===========================================
// Questions Hooks
// ===========================================

/**
 * Hook to fetch recent questions (sorted by createdAt desc)
 */
export function useRecentQuestions(limit: number = 5): UseQueryResult<Question[], Error> {
  return useQuery({
    queryKey: [...queryKeys.recentQuestions, limit],
    queryFn: async () => {
      const response = await api.questions.getAll({ limit });
      if (!response.success) throw new Error("Failed to fetch recent questions");
      return response.data.slice(0, limit);
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch a single question with responses
 */
export function useQuestion(questionId: string): UseQueryResult<Question | null, Error> {
  return useQuery({
    queryKey: queryKeys.question(questionId),
    queryFn: async () => {
      const response = await api.questions.getById(questionId);
      return response.data;
    },
    enabled: !!questionId,
  });
}

/**
 * Hook to submit a response to a question
 */
export function useSubmitResponse(): UseMutationResult<Response, Error, { questionId: string; responseText: string }> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ['questions', 'submitResponse'],
    mutationFn: async ({ questionId, responseText }) => {
      const response = await api.questions.submitResponse(questionId, responseText);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate both legacy and questionHooks query key hierarchies
      queryClient.invalidateQueries({ queryKey: queryKeys.question(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.detail(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.responses(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
    },
  });
}

/**
 * Hook to like a response
 */
export function useLikeResponse(): UseMutationResult<Response, Error, { responseId: string; questionId: string; isLiked?: boolean }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['responses', 'like'],
    mutationFn: async ({ responseId, isLiked = true }) => {
      const response = await api.responses.like(responseId, isLiked);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate both legacy and questionHooks query key hierarchies
      queryClient.invalidateQueries({ queryKey: queryKeys.question(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.detail(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.responses(variables.questionId) });
    },
  });
}

/**
 * Hook to dislike a response
 */
export function useDislikeResponse(): UseMutationResult<Response, Error, { responseId: string; questionId: string; isDisliked?: boolean }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['responses', 'dislike'],
    mutationFn: async ({ responseId, isDisliked = true }) => {
      const response = await api.responses.dislike(responseId, isDisliked);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate both legacy and questionHooks query key hierarchies
      queryClient.invalidateQueries({ queryKey: queryKeys.question(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.detail(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: questionQueryKeys.responses(variables.questionId) });
    },
  });
}

/**
 * Hook to get question categories
 */
export function useQuestionCategories(): UseQueryResult<string[], Error> {
  return useQuery({
    queryKey: ["questions", "categories"],
    queryFn: async () => {
      const response = await api.questions.getCategories();
      if (!response.success) throw new Error("Failed to fetch categories");
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// ===========================================
// Transactions Hooks
// ===========================================

/**
 * Hook to fetch transactions
 */
export function useTransactions(params?: { type?: string; status?: string }): UseQueryResult<Transaction[], Error> {
  return useQuery({
    queryKey: [...queryKeys.transactions, params],
    queryFn: async () => {
      const response = await api.transactions.getAll(params);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 60,
  });
}

// ===========================================
// Notifications Hooks
// ===========================================

/**
 * Hook to fetch notifications
 */
export function useNotifications(): UseQueryResult<Notification[], Error> {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: async () => {
      const response = await api.notifications.getAll();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to get unread notification count
 */
export function useUnreadCount(enabled?: boolean): UseQueryResult<number, Error> {
  const isAuthReady = useAuthStore((s) => s.isReady && !!s.auth?.token);

  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: async () => {
      const response = await api.notifications.getUnreadCount();
      if (!response.success) throw new Error(response.error);
      // Handle both number and object response formats
      return typeof response.data === 'number' ? response.data : response.data?.count ?? 0;
    },
    staleTime: 1000 * 30, // SSE handles real-time invalidation
    enabled: (enabled ?? true) && isAuthReady,
  });
}

/**
 * Hook to mark notification as read (with optimistic update)
 */
export function useMarkNotificationRead(): UseMutationResult<Notification, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['notifications', 'markRead'],
    mutationFn: async (notificationId: string) => {
      const response = await api.notifications.markRead(notificationId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const previous = queryClient.getQueryData<Notification[]>(queryKeys.notifications);
      if (previous) {
        queryClient.setQueryData<Notification[]>(queryKeys.notifications,
          previous.map((n) => n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n)
        );
      }
      const prevCount = queryClient.getQueryData<number>(queryKeys.unreadCount);
      if (typeof prevCount === 'number' && prevCount > 0) {
        queryClient.setQueryData<number>(queryKeys.unreadCount, prevCount - 1);
      }
      return { previous, prevCount };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.notifications, context.previous);
      if (typeof context?.prevCount === 'number') queryClient.setQueryData(queryKeys.unreadCount, context.prevCount);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['notifications', 'markAllRead'],
    mutationFn: async () => {
      const response = await api.notifications.markAllRead();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const previous = queryClient.getQueryData<Notification[]>(queryKeys.notifications);
      if (previous) {
        queryClient.setQueryData<Notification[]>(queryKeys.notifications,
          previous.map((n) => ({ ...n, read: true, readAt: n.readAt || new Date().toISOString() }))
        );
      }
      queryClient.setQueryData<number>(queryKeys.unreadCount, 0);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.notifications, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    },
  });
}

/**
 * Hook to delete a notification
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['notifications', 'delete'],
    mutationFn: async (notificationId: string) => {
      const response = await api.notifications.delete(notificationId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    },
  });
}

// ===========================================
// Payments Hooks
// ===========================================

/**
 * Hook to request withdrawal
 */
export function useWithdraw(): UseMutationResult<Payment, Error, { amount: number; phoneNumber: string; provider: string }> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ['payments', 'withdraw'],
    mutationFn: async (data) => {
      const response = await api.payments.withdraw(data);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}

// ===========================================
// Rewards Hooks
// ===========================================

/**
 * Hook to fetch rewards
 */
export function useRewards(): UseQueryResult<Reward[], Error> {
  return useQuery({
    queryKey: queryKeys.rewards,
    queryFn: async () => {
      const response = await api.rewards.getAll();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch reward questions
 */
export function useRewardQuestions(enabled = true): UseQueryResult<RewardQuestion[], Error> {
  const isAuthReady = useAuthStore(s => s.isReady && !!s.auth?.token);

  return useQuery<{ rewardQuestions: RewardQuestion[] }, Error, RewardQuestion[]>({
    queryKey: queryKeys.rewardQuestions,
    queryFn: async () => {
      const response = await api.rewards.getQuestions();
      if (!response.success) throw new Error(response.error);
      return response.data as unknown as { rewardQuestions: RewardQuestion[] };
    },
    staleTime: 1000 * 60 * 2,
    enabled: enabled && isAuthReady,
    select: (data) => data?.rewardQuestions ?? [],
  });
}

/**
 * Hook to fetch regular (non-instant) reward questions only (paginated).
 * Uses the dedicated /regular endpoint — no client-side filtering needed.
 */
export function useRegularRewardQuestions(page = 1, limit = 20): UseQueryResult<RewardQuestion[], Error> {
  const isAuthReady = useAuthStore(s => s.isReady && !!s.auth?.token);

  return useQuery<RegularRewardQuestionsPayload, Error, RewardQuestion[]>({
    queryKey: [...queryKeys.regularRewardQuestions, page, limit],
    queryFn: async () => {
      const response = await api.rewards.getRegularQuestions(page, limit);
      if (!response.success) throw new Error(response.error);
      return response.data as unknown as RegularRewardQuestionsPayload;
    },
    staleTime: 1000 * 60 * 2,
    enabled: isAuthReady,
    select: (data) => data.rewardQuestions ?? [],
  });
}

/**
 * Hook to fetch instant reward questions only (paginated).
 * Uses the dedicated /instant endpoint for server-side filtering + pagination.
 */
export function useInstantRewardQuestions(page = 1, limit = 20): UseQueryResult<RewardQuestion[], Error> {
  const isAuthReady = useAuthStore(s => s.isReady && !!s.auth?.token);

  return useQuery<InstantRewardQuestionsPayload, Error, RewardQuestion[]>({
    queryKey: [...queryKeys.instantQuestions, page, limit],
    queryFn: async () => {
      const response = await api.rewards.getInstantQuestions(page, limit);
      if (!response.success) throw new Error(response.error);
      return response.data as unknown as InstantRewardQuestionsPayload;
    },
    staleTime: 1000 * 60 * 2,
    enabled: isAuthReady,
    select: (data) => data.instantRewardQuestions ?? [],
  });
}

/**
 * Hook to fetch a single reward question
 */
export function useRewardQuestion(questionId: string): UseQueryResult<RewardQuestion | null, Error> {
  const isAuthReady = useAuthStore(s => s.isReady && !!s.auth?.token);

  return useQuery<RewardQuestionByIdPayload, Error, RewardQuestion | null>({
    queryKey: queryKeys.rewardQuestion(questionId),
    queryFn: async () => {
      const response = await api.rewards.getQuestionById(questionId);
      if (!response.success) throw new Error(response.error);
      // API layer types this as RewardQuestion|null but backend wraps in { rewardQuestion: {...} }
      return response.data as unknown as RewardQuestionByIdPayload;
    },
    enabled: Boolean(questionId) && isAuthReady,
    staleTime: 1000 * 60,
    select: (data) => data?.rewardQuestion ?? null,
  });
}

/**
 * Hook to submit an answer for a reward question
 * For instant reward questions, include phoneNumber for automatic payout
 */
export function useSubmitRewardAnswer(): UseMutationResult<RewardAnswerResult, Error, { questionId: string; answer: string; phoneNumber?: string; userEmail?: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['rewards', 'submitAnswer'],
    mutationFn: async ({ questionId, answer, phoneNumber, userEmail }) => {
      const response = await api.rewards.submitAnswer(questionId, answer, phoneNumber, userEmail);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rewardQuestions });
      queryClient.invalidateQueries({ queryKey: queryKeys.regularRewardQuestions });
      queryClient.invalidateQueries({ queryKey: queryKeys.instantQuestions });
      queryClient.invalidateQueries({ queryKey: queryKeys.rewardQuestion(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}

/**
 * Hook to create a new reward question
 */
export function useCreateRewardQuestion(): UseMutationResult<RewardQuestion, Error, {
  text: string;
  options: string[];
  correctAnswer: string;
  rewardAmount: number;
  expiryTime?: string;
  userId: string;
  isInstantReward?: boolean;
  maxWinners?: number;
  paymentProvider?: string;
  phoneNumber?: string;
}> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['rewards', 'createQuestion'],
    mutationFn: async (data) => {
      const response = await api.rewards.createRewardQuestion(data);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rewardQuestions });
      queryClient.invalidateQueries({ queryKey: queryKeys.instantQuestions });
    },
  });
}

/**
 * Hook to bulk create questions from file upload
 * Supports all question types: single_choice, multiple_choice, boolean, text
 */
export function useBulkCreateQuestions(): UseMutationResult<
  { created: number; failed: number; questions: RewardQuestion[] },
  Error,
  {
    questions: Array<{
      text: string;
      options: string[] | Record<string, string>;
      correctAnswer?: string | string[];
      category?: string;
      rewardAmount?: number;
      // Enhanced fields for different question types
      type?: 'single_choice' | 'multiple_choice' | 'boolean' | 'text' | 'checkbox';
      difficulty?: 'easy' | 'medium' | 'hard';
      explanation?: string;
      timeLimit?: number;
      pointValue?: number;
    }>;
    userId: string;
  }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['rewards', 'bulkCreate'],
    mutationFn: async (data) => {
      const response = await api.rewards.bulkCreateQuestions(data.questions, data.userId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rewardQuestions });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions });
      queryClient.invalidateQueries({ queryKey: queryKeys.instantQuestions });
    },
  });
}

// ===========================================
// Dashboard Hooks
// ===========================================

/**
 * Daily reward data structure
 */
export interface DailyRewardData {
  isAvailable: boolean;
  nextRewardIn: number; // hours until next reward
  currentStreak: number;
  todayReward: number;
  streakBonus: number;
}

/**
 * Hook to fetch daily reward status
 * Calls GET /api/rewards/daily — falls back to defaults if backend route
 * is not yet implemented (rewardRoutes.mjs currently has no daily endpoint).
 */
export function useDailyReward(): UseQueryResult<DailyRewardData, Error> {
  return useQuery({
    queryKey: queryKeys.dailyReward,
    queryFn: async () => {
      try {
        const response = await api.rewards.claimDaily();
        if (response.success && response.data) {
          const d = response.data as any;
          return {
            isAvailable: d.isAvailable ?? false,
            nextRewardIn: d.nextRewardIn ?? 0,
            currentStreak: d.streak ?? d.currentStreak ?? 0,
            todayReward: d.reward ?? d.todayReward ?? 0,
            streakBonus: d.streakBonus ?? 0,
          } satisfies DailyRewardData;
        }
      } catch {
        // Backend route not implemented yet — fall through to defaults
      }
      // Fallback: daily reward unavailable until backend is wired
      return {
        isAvailable: false,
        nextRewardIn: 24,
        currentStreak: 0,
        todayReward: 0,
        streakBonus: 0,
      } satisfies DailyRewardData;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Dashboard statistics data
 */
export interface DashboardStats {
  totalEarnings: number;
  weeklyEarnings: number;
  totalEngagement: number;
  rewardsProgress: number;
  rewardsGoal: number;
  questionsAnswered: number;
  surveysCompleted: number;
  videosWatched: number;
}

/**
 * Hook to fetch dashboard statistics
 */
export function useDashboardStats(): UseQueryResult<DashboardStats, Error> {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => {
      const userStatsResponse = await api.user.getStats();
      if (!userStatsResponse.success) throw new Error("Failed to fetch dashboard stats");
      
      const stats = userStatsResponse.data;
      const dashboardStats: DashboardStats = {
        totalEarnings: stats.totalEarnings || 0,
        weeklyEarnings: stats.rewardsThisWeek || 0,
        totalEngagement: (stats.totalAnswers || 0) + (stats.totalSurveysCompleted || 0) + (stats.totalVideosWatched || 0),
        rewardsProgress: stats.totalRewards || 0,
        rewardsGoal: 2000,
        questionsAnswered: stats.totalAnswers || 0,
        surveysCompleted: stats.totalSurveysCompleted || 0,
        videosWatched: stats.totalVideosWatched || 0,
      };
      return dashboardStats;
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to claim daily reward
 * POSTs to /api/rewards/daily — backend should credit the user and return
 * { reward, streak } or similar. Falls back with an error if not implemented.
 */
export function useClaimDailyReward(): UseMutationResult<{ points: number; message: string }, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['dashboard', 'claimDailyReward'],
    mutationFn: async () => {
      const response = await api.rewards.claimDaily();
      if (!response.success) throw new Error(response.error || 'Failed to claim daily reward');
      const d = response.data as any;
      return { points: d.reward ?? 0, message: d.message ?? 'Daily reward claimed!' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyReward });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}

// ===========================================
// Video Premium & Limits Hooks
// ===========================================

import videoApi, {
  VideoPremiumLimits,
  ValidateUploadRequest,
  ValidateUploadResponse,
  StartLivestreamRequest,
  LivestreamSessionResponse,
  EndLivestreamRequest,
  ValidateSessionRequest,
  ValidateSessionResponse,
} from './videoApi';

// Query keys for video limits
export const videoLimitsQueryKeys = {
  limits: (userId: string) => ['video', 'limits', userId] as const,
  validateUpload: ['video', 'validateUpload'] as const,
  validateSession: ['video', 'validateSession'] as const,
};

/**
 * Hook to fetch user's video premium status and limits
 * @param userId - The user's ID
 */
export function useVideoLimits(userId: string | undefined): UseQueryResult<VideoPremiumLimits, Error> {
  return useQuery({
    queryKey: videoLimitsQueryKeys.limits(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      const response = await videoApi.getUserLimits(userId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to validate file upload before uploading
 */
export function useValidateUpload(): UseMutationResult<ValidateUploadResponse, Error, ValidateUploadRequest> {
  return useMutation({
    mutationKey: ['video', 'validateUpload'],
    mutationFn: async (data: ValidateUploadRequest) => {
      const response = await videoApi.validateUpload(data);
      if (!response.success && response.data?.error) {
        // Return the error response data for handling in UI
        throw Object.assign(new Error(response.error || 'Validation failed'), {
          validationError: response.data,
        });
      }
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
  });
}

/**
 * Hook to start a livestream session
 */
export function useStartLivestream(): UseMutationResult<LivestreamSessionResponse, Error, StartLivestreamRequest> {
  return useMutation({
    mutationKey: ['video', 'startLivestream'],
    mutationFn: async (data: StartLivestreamRequest) => {
      const response = await videoApi.startLivestream(data);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
  });
}

/**
 * Hook to end a livestream session
 */
export function useEndLivestream(): UseMutationResult<{ success: boolean; endedAt?: string }, Error, EndLivestreamRequest> {
  return useMutation({
    mutationKey: ['video', 'endLivestream'],
    mutationFn: async (data: EndLivestreamRequest) => {
      const response = await videoApi.endLivestream(data);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
  });
}

/**
 * Hook to validate session duration (recording or livestream)
 */
export function useValidateSession(): UseMutationResult<ValidateSessionResponse, Error, ValidateSessionRequest> {
  return useMutation({
    mutationKey: ['video', 'validateSession'],
    mutationFn: async (data: ValidateSessionRequest) => {
      const response = await videoApi.validateSession(data);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
  });
}
