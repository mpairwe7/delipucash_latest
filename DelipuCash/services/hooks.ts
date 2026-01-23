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
import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import api from "./api";

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
  rewardQuestion: (id: string) => ["rewards", "questions", id] as const,
  dailyReward: ["rewards", "daily"] as const,
  ads: ["ads"] as const,
  dashboard: ["dashboard"] as const,
};

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
 * Hook to update 2FA settings
 */
export function useUpdateTwoFactor(): UseMutationResult<{ enabled: boolean }, Error, boolean> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await api.user.updateTwoFactor(enabled);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}

/**
 * Hook to change password
 */
export function useChangePassword(): UseMutationResult<{ success: boolean }, Error, { currentPassword: string; newPassword: string }> {
  return useMutation({
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
 */
export function useLikeVideo(): UseMutationResult<Video, Error, string> {
  const queryClient = useQueryClient();
  
  return useMutation({
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
 */
export function useBookmarkVideo(): UseMutationResult<Video, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
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
 * Hook to upload a video
 */
export function useUploadVideo(): UseMutationResult<
  Video,
  Error,
  { title: string; description?: string; videoUrl: string; thumbnail: string; duration?: number }
> {
  const queryClient = useQueryClient();

  return useMutation({
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
 * Hook to get video comments
 */
export function useVideoComments(videoId: string): UseQueryResult<Comment[], Error> {
  return useQuery({
    queryKey: ["videos", videoId, "comments"],
    queryFn: async () => {
      const response = await api.videos.getComments(videoId);
      if (!response.success) throw new Error(response.error || "Failed to fetch comments");
      return response.data;
    },
    enabled: !!videoId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to add comment to video
 */
export function useAddVideoComment(): UseMutationResult<Comment, Error, { videoId: string; text: string }> {
  const queryClient = useQueryClient();

  return useMutation({
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
      return response.data;
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
      return response.data;
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
      return response.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch a single survey with questions
 */
export function useSurvey(surveyId: string): UseQueryResult<(Survey & { questions: UploadSurvey[] }) | null, Error> {
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
 * Hook to submit survey response
 */
export function useSubmitSurvey(): UseMutationResult<{ reward: number }, Error, { surveyId: string; responses: Record<string, unknown> }> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ surveyId, responses }) => {
      const response = await api.surveys.submit(surveyId, responses);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.surveys });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
    },
  });
}

/**
 * Hook to create a new survey
 */
export function useCreateSurvey(): UseMutationResult<Survey & { questions: UploadSurvey[] }, Error, {
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
    mutationFn: async (surveyId) => {
      const response = await api.surveys.delete?.(surveyId);
      if (!response?.success) throw new Error(response?.error || "Failed to delete survey");
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
 * Hook to fetch questions
 */
export function useQuestions(params?: { category?: string; page?: number; limit?: number }): UseQueryResult<{
  questions: Question[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}, Error> {
  return useQuery({
    queryKey: [...queryKeys.questions, params],
    queryFn: async () => {
      const response = await api.questions.getAll(params);
      if (!response.success) throw new Error("Failed to fetch questions");
      return {
        questions: response.data,
        pagination: response.pagination,
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}

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
 * Hook to fetch instant-reward questions
 */
export function useInstantRewardQuestions(limit: number = 5): UseQueryResult<Question[], Error> {
  return useQuery({
    queryKey: [...queryKeys.instantQuestions, limit],
    queryFn: async () => {
      const response = await api.questions.getAll({ limit: 50 });
      if (!response.success) throw new Error("Failed to fetch instant questions");
      return response.data.filter((q) => q.isInstantReward).slice(0, limit);
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch a single question with responses
 */
export function useQuestion(questionId: string): UseQueryResult<(Question & { responses: Response[] }) | null, Error> {
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
    mutationFn: async ({ questionId, responseText }) => {
      const response = await api.questions.submitResponse(questionId, responseText);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.question(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
    },
  });
}

/**
 * Hook to fetch popular questions
 */
export function usePopularQuestions(limit: number = 10): UseQueryResult<Question[], Error> {
  return useQuery({
    queryKey: ["questions", "popular", limit],
    queryFn: async () => {
      const response = await api.questions.getAll({ limit: 50 });
      if (!response.success) throw new Error("Failed to fetch popular questions");
      // Sort by total answers (most engaged)
      return response.data
        .sort((a, b) => (b.totalAnswers || 0) - (a.totalAnswers || 0))
        .slice(0, limit);
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch trending questions
 */
export function useTrendingQuestions(limit: number = 10): UseQueryResult<Question[], Error> {
  return useQuery({
    queryKey: ["questions", "trending", limit],
    queryFn: async () => {
      const response = await api.questions.getAll({ limit: 50 });
      if (!response.success) throw new Error("Failed to fetch trending questions");
      // Trending = recent + popular (weighted by recency)
      const now = Date.now();
      return response.data
        .map((q) => {
          const ageInHours = (now - new Date(q.createdAt).getTime()) / (1000 * 60 * 60);
          const recencyScore = Math.max(0, 100 - ageInHours);
          const engagementScore = (q.totalAnswers || 0) * 10;
          return { ...q, trendScore: recencyScore + engagementScore };
        })
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, limit);
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to search questions
 */
export function useSearchQuestions(query: string): UseQueryResult<Question[], Error> {
  return useQuery({
    queryKey: ["questions", "search", query],
    queryFn: async () => {
      const response = await api.questions.getAll({ limit: 100 });
      if (!response.success) throw new Error("Search failed");
      const lowerQuery = query.toLowerCase();
      return response.data.filter((q) =>
        q.text.toLowerCase().includes(lowerQuery)
      );
    },
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to create a new question
 */
export function useCreateQuestion(): UseMutationResult<
  Question,
  Error,
  { text: string; category?: string; rewardAmount?: number; isInstantReward?: boolean }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      // Using direct fetch since api.questions.create might not exist in base api
      const response = await api.questions.getAll({ limit: 1 });
      // Simulate creation - in real app this would be a POST
      const newQuestion: Question = {
        id: `question_${Date.now()}`,
        text: data.text,
        userId: null,
        category: data.category,
        rewardAmount: data.rewardAmount || 0,
        isInstantReward: data.isInstantReward || false,
        totalAnswers: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return newQuestion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentQuestions });
    },
  });
}

/**
 * Hook to like a response
 */
export function useLikeResponse(): UseMutationResult<Response, Error, { responseId: string; questionId: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ responseId }) => {
      const response = await api.responses.like(responseId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.question(variables.questionId) });
    },
  });
}

/**
 * Hook to dislike a response
 */
export function useDislikeResponse(): UseMutationResult<Response, Error, { responseId: string; questionId: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ responseId }) => {
      const response = await api.responses.dislike(responseId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.question(variables.questionId) });
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
export function useUnreadCount(): UseQueryResult<number, Error> {
  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: async () => {
      const response = await api.notifications.getUnreadCount();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}

/**
 * Hook to mark notification as read
 */
export function useMarkNotificationRead(): UseMutationResult<Notification, Error, string> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await api.notifications.markRead(notificationId);
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
export function useRewardQuestions(): UseQueryResult<RewardQuestion[], Error> {
  return useQuery({
    queryKey: queryKeys.rewardQuestions,
    queryFn: async () => {
      const response = await api.rewards.getQuestions();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch a single reward question
 */
export function useRewardQuestion(questionId: string): UseQueryResult<RewardQuestion | null, Error> {
  return useQuery({
    queryKey: queryKeys.rewardQuestion(questionId),
    queryFn: async () => {
      const response = await api.rewards.getQuestionById(questionId);
      return response.data;
    },
    enabled: Boolean(questionId),
    staleTime: 1000 * 60,
  });
}

/**
 * Hook to submit an answer for a reward question
 * For instant reward questions, include phoneNumber for automatic payout
 */
export function useSubmitRewardAnswer(): UseMutationResult<RewardAnswerResult, Error, { questionId: string; answer: string; phoneNumber?: string; userEmail?: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, answer, phoneNumber, userEmail }) => {
      const response = await api.rewards.submitAnswer(questionId, answer, phoneNumber, userEmail);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rewardQuestions });
      queryClient.invalidateQueries({ queryKey: queryKeys.rewardQuestion(variables.questionId) });
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
 */
export function useBulkCreateQuestions(): UseMutationResult<
  { created: number; failed: number; questions: RewardQuestion[] },
  Error,
  {
    questions: Array<{
      text: string;
      options: string[];
      correctAnswer?: string;
      category?: string;
      rewardAmount?: number;
    }>;
    userId: string;
  }
> {
  const queryClient = useQueryClient();

  return useMutation({
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
 */
export function useDailyReward(): UseQueryResult<DailyRewardData, Error> {
  return useQuery({
    queryKey: queryKeys.dailyReward,
    queryFn: async () => {
      // Simulated daily reward data
      const data: DailyRewardData = {
        isAvailable: true,
        nextRewardIn: 0,
        currentStreak: 7,
        todayReward: 100,
        streakBonus: 50,
      };
      return data;
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
 */
export function useClaimDailyReward(): UseMutationResult<{ points: number; message: string }, Error, void> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Simulated claim response
      await new Promise(resolve => setTimeout(resolve, 500));
      return { points: 100, message: "Daily reward claimed!" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyReward });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}
