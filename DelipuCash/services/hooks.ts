/**
 * Custom hooks for data fetching
 * These hooks use React Query for caching and state management
 */

import {
    AppUser,
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
 */
export function useSubmitRewardAnswer(): UseMutationResult<RewardAnswerResult, Error, { questionId: string; answer: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, answer }) => {
      const response = await api.rewards.submitAnswer(questionId, answer);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rewardQuestions });
      queryClient.invalidateQueries({ queryKey: queryKeys.rewardQuestion(variables.questionId) });
    },
  });
}

// ===========================================
// Dashboard Hooks
// ===========================================

/**
 * Hook to fetch trending videos for dashboard
 */
export function useTrendingVideos(limit: number = 5): UseQueryResult<Video[], Error> {
  return useQuery({
    queryKey: [...queryKeys.trendingVideos, limit],
    queryFn: async () => {
      const response = await api.videos.getAll({ limit });
      if (!response.success) throw new Error("Failed to fetch trending videos");
      // Sort by views to get trending
      return response.data.sort((a, b) => b.views - a.views).slice(0, limit);
    },
    staleTime: 1000 * 60 * 5,
  });
}

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
