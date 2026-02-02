/**
 * Video Hooks Module
 * Centralized hooks for video functionality
 * 
 * Features:
 * - React Query integration for data fetching
 * - Optimistic updates for better UX
 * - Offline support via query caching
 * - Type-safe API contracts
 * 
 * @module services/videoHooks
 */

import { useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type UseQueryResult,
  type UseMutationResult,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { Video, Comment } from '@/types';
import { videoApi, VideoWithDetails, VideoAnalytics, VideoStats } from './videoApi';

// ============================================================================
// QUERY KEYS
// ============================================================================

/**
 * Centralized query keys for video-related queries
 * Enables proper cache invalidation and query management
 */
export const videoQueryKeys = {
  all: ['videos'] as const,
  lists: () => [...videoQueryKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...videoQueryKeys.lists(), filters] as const,
  details: () => [...videoQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...videoQueryKeys.details(), id] as const,
  comments: (videoId: string) => [...videoQueryKeys.all, 'comments', videoId] as const,
  trending: () => [...videoQueryKeys.all, 'trending'] as const,
  live: () => [...videoQueryKeys.all, 'live'] as const,
  recommended: () => [...videoQueryKeys.all, 'recommended'] as const,
  search: (query: string) => [...videoQueryKeys.all, 'search', query] as const,
  bookmarked: () => [...videoQueryKeys.all, 'bookmarked'] as const,
  userVideos: (userId: string) => [...videoQueryKeys.all, 'user', userId] as const,
  analytics: (videoId: string) => [...videoQueryKeys.all, 'analytics', videoId] as const,
  stats: () => [...videoQueryKeys.all, 'stats'] as const,
} as const;

// ============================================================================
// VIDEO LIST HOOKS
// ============================================================================

interface UseVideosParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sortBy?: 'newest' | 'oldest' | 'popular' | 'likes' | 'views';
  enabled?: boolean;
}

/**
 * Hook to fetch paginated video list
 * 
 * @example
 * ```tsx
 * const { data, isLoading, fetchNextPage } = useVideos({ limit: 10 });
 * ```
 */
export function useVideos(params: UseVideosParams = {}): UseQueryResult<{
  videos: Video[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { page = 1, limit = 10, category, search, sortBy, enabled = true } = params;

  return useQuery({
    queryKey: videoQueryKeys.list({ page, limit, category, search, sortBy }),
    queryFn: async () => {
      const response = await videoApi.getAll({ page, limit, category, search, sortBy });
      if (!response.success) throw new Error('Failed to fetch videos');
      return {
        videos: response.data,
        pagination: response.pagination || { page, limit, total: response.data.length, totalPages: 1 },
      };
    },
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook for infinite scroll video loading
 * 
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage } = useInfiniteVideos({ limit: 10 });
 * ```
 */
export function useInfiniteVideos(params: Omit<UseVideosParams, 'page'> = {}): UseInfiniteQueryResult<{
  pages: { videos: Video[]; nextPage: number | null }[];
  pageParams: number[];
}> {
  const { limit = 10, category, search, sortBy, enabled = true } = params;

  return useInfiniteQuery({
    queryKey: videoQueryKeys.list({ limit, category, search, sortBy, infinite: true }),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await videoApi.getAll({ page: pageParam, limit, category, search, sortBy });
      if (!response.success) throw new Error('Failed to fetch videos');
      
      const hasMore = response.pagination 
        ? pageParam < response.pagination.totalPages 
        : response.data.length === limit;
      
      return {
        videos: response.data,
        nextPage: hasMore ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

// ============================================================================
// VIDEO DETAIL HOOKS
// ============================================================================

/**
 * Hook to fetch single video with details
 * 
 * @example
 * ```tsx
 * const { data: video, isLoading } = useVideoDetails('video_001');
 * ```
 */
export function useVideoDetails(videoId: string): UseQueryResult<VideoWithDetails | null> {
  return useQuery({
    queryKey: videoQueryKeys.detail(videoId),
    queryFn: async () => {
      const response = await videoApi.getById(videoId);
      if (!response.success) throw new Error(response.error || 'Failed to fetch video');
      return response.data;
    },
    enabled: !!videoId,
    staleTime: 1000 * 60, // 1 minute
  });
}

// ============================================================================
// VIDEO INTERACTION HOOKS
// ============================================================================

/**
 * Hook to like/unlike a video with optimistic updates
 * 
 * @example
 * ```tsx
 * const { mutate: likeVideo, isPending } = useLikeVideo();
 * likeVideo({ videoId: 'video_001', isLiked: false });
 * ```
 */
export function useLikeVideo(): UseMutationResult<
  { likes: number; isLiked: boolean },
  Error,
  { videoId: string; isLiked: boolean },
  { previousVideo: VideoWithDetails | undefined }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ videoId, isLiked }) => {
      const response = isLiked 
        ? await videoApi.unlike(videoId)
        : await videoApi.like(videoId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    // Optimistic update
    onMutate: async ({ videoId, isLiked }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: videoQueryKeys.detail(videoId) });

      // Snapshot previous value
      const previousVideo = queryClient.getQueryData<VideoWithDetails>(
        videoQueryKeys.detail(videoId)
      );

      // Optimistically update
      if (previousVideo) {
        queryClient.setQueryData<VideoWithDetails>(
          videoQueryKeys.detail(videoId),
          {
            ...previousVideo,
            likes: isLiked ? previousVideo.likes - 1 : previousVideo.likes + 1,
          }
        );
      }

      return { previousVideo };
    },
    onError: (_, { videoId }, context) => {
      // Rollback on error
      if (context?.previousVideo) {
        queryClient.setQueryData(videoQueryKeys.detail(videoId), context.previousVideo);
      }
    },
    onSettled: (_, __, { videoId }) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.detail(videoId) });
    },
  });
}

/**
 * Hook to bookmark/unbookmark a video
 * 
 * @example
 * ```tsx
 * const { mutate: toggleBookmark } = useBookmarkVideo();
 * toggleBookmark({ videoId: 'video_001', isBookmarked: false });
 * ```
 */
export function useBookmarkVideo(): UseMutationResult<
  Video,
  Error,
  { videoId: string; isBookmarked: boolean }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ videoId }) => {
      const response = await videoApi.toggleBookmark(videoId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.detail(videoId) });
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.bookmarked() });
    },
  });
}

/**
 * Hook to increment video view count
 * 
 * @example
 * ```tsx
 * const { mutate: recordView } = useRecordVideoView();
 * recordView('video_001');
 * ```
 */
export function useRecordVideoView(): UseMutationResult<{ views: number }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoId: string) => {
      const response = await videoApi.incrementView(videoId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data, videoId) => {
      // Update cache with new view count
      queryClient.setQueryData<VideoWithDetails>(
        videoQueryKeys.detail(videoId),
        (old) => old ? { ...old, views: data.views } : old
      );
    },
  });
}

// ============================================================================
// VIDEO COMMENTS HOOKS
// ============================================================================

interface CommentsData {
  comments: Comment[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * Hook to fetch video comments with pagination
 * 
 * @example
 * ```tsx
 * const { data, isLoading, refetch } = useVideoCommentsQuery('video_001');
 * ```
 */
export function useVideoCommentsQuery(
  videoId: string,
  page: number = 1,
  limit: number = 20
): UseQueryResult<CommentsData> {
  return useQuery({
    queryKey: videoQueryKeys.comments(videoId),
    queryFn: async () => {
      const response = await videoApi.getComments(videoId);
      if (!response.success) throw new Error(response.error || 'Failed to fetch comments');
      return {
        comments: response.data,
        pagination: { page, limit, total: response.data.length, totalPages: 1 },
      };
    },
    enabled: !!videoId,
    staleTime: 1000 * 30, // 30 seconds - comments change frequently
  });
}

/**
 * Hook to add a comment with optimistic update
 * 
 * @example
 * ```tsx
 * const { mutate: addComment, isPending } = useAddVideoComment();
 * addComment({ videoId: 'video_001', text: 'Great video!' });
 * ```
 */
export function useAddVideoComment(): UseMutationResult<
  Comment,
  Error,
  { videoId: string; text: string; mediaUrls?: string[] }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ videoId, text }) => {
      const response = await videoApi.addComment(videoId, text);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    // Optimistic update
    onMutate: async ({ videoId, text, mediaUrls }) => {
      await queryClient.cancelQueries({ queryKey: videoQueryKeys.comments(videoId) });

      const previousData = queryClient.getQueryData<CommentsData>(
        videoQueryKeys.comments(videoId)
      );

      // Create optimistic comment
      const optimisticComment: Comment = {
        id: `temp_${Date.now()}`,
        text,
        mediaUrls: mediaUrls || [],
        userId: 'current_user',
        videoId,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<CommentsData>(
        videoQueryKeys.comments(videoId),
        (old) => ({
          comments: [optimisticComment, ...(old?.comments || [])],
          pagination: old?.pagination || { page: 1, limit: 20, total: 1, totalPages: 1 },
        })
      );

      return { previousData };
    },
    onError: (_, { videoId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(videoQueryKeys.comments(videoId), context.previousData);
      }
    },
    onSettled: (_, __, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.comments(videoId) });
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.detail(videoId) });
    },
  });
}

/**
 * Hook to delete a comment
 * 
 * @example
 * ```tsx
 * const { mutate: deleteComment } = useDeleteVideoComment();
 * deleteComment({ videoId: 'video_001', commentId: 'comment_001' });
 * ```
 */
export function useDeleteVideoComment(): UseMutationResult<
  { deleted: boolean },
  Error,
  { videoId: string; commentId: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ videoId, commentId }) => {
      const response = await videoApi.deleteComment(videoId, commentId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onMutate: async ({ videoId, commentId }) => {
      await queryClient.cancelQueries({ queryKey: videoQueryKeys.comments(videoId) });

      const previousData = queryClient.getQueryData<CommentsData>(
        videoQueryKeys.comments(videoId)
      );

      queryClient.setQueryData<CommentsData>(
        videoQueryKeys.comments(videoId),
        (old) => ({
          comments: old?.comments.filter((c) => c.id !== commentId) || [],
          pagination: old?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 },
        })
      );

      return { previousData };
    },
    onError: (_, { videoId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(videoQueryKeys.comments(videoId), context.previousData);
      }
    },
    onSettled: (_, __, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.comments(videoId) });
    },
  });
}

// ============================================================================
// SPECIALIZED LIST HOOKS
// ============================================================================

/**
 * Hook to fetch trending videos
 */
export function useTrendingVideos(limit: number = 10): UseQueryResult<Video[]> {
  return useQuery({
    queryKey: videoQueryKeys.trending(),
    queryFn: async () => {
      const response = await videoApi.getTrending(limit);
      if (!response.success) throw new Error(response.error || 'Failed to fetch trending videos');
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch live videos
 */
export function useLiveVideos(): UseQueryResult<Video[]> {
  return useQuery({
    queryKey: videoQueryKeys.live(),
    queryFn: async () => {
      const response = await videoApi.getLive();
      if (!response.success) throw new Error(response.error || 'Failed to fetch live videos');
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds - live status changes frequently
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}

/**
 * Hook to fetch recommended videos
 */
export function useRecommendedVideos(limit: number = 10): UseQueryResult<Video[]> {
  return useQuery({
    queryKey: videoQueryKeys.recommended(),
    queryFn: async () => {
      const response = await videoApi.getRecommended(limit);
      if (!response.success) throw new Error(response.error || 'Failed to fetch recommended videos');
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to fetch bookmarked videos
 */
export function useBookmarkedVideos(): UseQueryResult<Video[]> {
  return useQuery({
    queryKey: videoQueryKeys.bookmarked(),
    queryFn: async () => {
      const response = await videoApi.getBookmarked();
      if (!response.success) throw new Error(response.error || 'Failed to fetch bookmarked videos');
      return response.data;
    },
    staleTime: 1000 * 60,
  });
}

/**
 * Hook to search videos
 */
export function useVideoSearch(query: string): UseQueryResult<Video[]> {
  return useQuery({
    queryKey: videoQueryKeys.search(query),
    queryFn: async () => {
      const response = await videoApi.search(query);
      if (!response.success) throw new Error(response.error || 'Search failed');
      return response.data;
    },
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 2,
  });
}

// ============================================================================
// UPLOAD HOOKS
// ============================================================================

/**
 * Hook to upload a video
 * 
 * @example
 * ```tsx
 * const { mutate: uploadVideo, isPending, progress } = useUploadVideo();
 * uploadVideo({ title: 'My Video', videoUrl: 'https://...', thumbnail: '...' });
 * ```
 */
export function useUploadVideo(): UseMutationResult<
  Video,
  Error,
  {
    title: string;
    description?: string;
    videoUrl: string;
    thumbnail: string;
    duration?: number;
    category?: string;
    tags?: string[];
  }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const response = await videoApi.upload(data);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.all });
    },
  });
}

/**
 * Hook to delete a video
 */
export function useDeleteVideo(): UseMutationResult<{ deleted: boolean }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoId: string) => {
      const response = await videoApi.delete(videoId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.all });
    },
  });
}

// ============================================================================
// ANALYTICS HOOKS
// ============================================================================

/**
 * Hook to fetch video analytics
 */
export function useVideoAnalytics(videoId: string): UseQueryResult<VideoAnalytics> {
  return useQuery({
    queryKey: videoQueryKeys.analytics(videoId),
    queryFn: async () => {
      const response = await videoApi.getAnalytics(videoId);
      if (!response.success) throw new Error(response.error || 'Failed to fetch analytics');
      return response.data;
    },
    enabled: !!videoId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to fetch overall video stats
 */
export function useVideoStats(): UseQueryResult<VideoStats> {
  return useQuery({
    queryKey: videoQueryKeys.stats(),
    queryFn: async () => {
      const response = await videoApi.getStats();
      if (!response.success) throw new Error(response.error || 'Failed to fetch stats');
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ============================================================================
// COMPUTED HOOKS
// ============================================================================

/**
 * Hook that provides computed video state
 * Combines multiple queries for a comprehensive video view
 */
export function useVideoState(videoId: string) {
  const videoQuery = useVideoDetails(videoId);
  const commentsQuery = useVideoCommentsQuery(videoId);
  const likeMutation = useLikeVideo();
  const bookmarkMutation = useBookmarkVideo();
  const viewMutation = useRecordVideoView();

  const isLoading = videoQuery.isLoading || commentsQuery.isLoading;
  const isError = videoQuery.isError || commentsQuery.isError;
  const error = videoQuery.error || commentsQuery.error;

  const video = videoQuery.data;
  const comments = commentsQuery.data?.comments || [];

  // Actions
  const actions = useMemo(() => ({
    like: () => {
      if (video) {
        likeMutation.mutate({ videoId, isLiked: false }); // Assuming not liked
      }
    },
    unlike: () => {
      if (video) {
        likeMutation.mutate({ videoId, isLiked: true });
      }
    },
    bookmark: () => {
      if (video) {
        bookmarkMutation.mutate({ videoId, isBookmarked: video.isBookmarked ?? false });
      }
    },
    recordView: () => viewMutation.mutate(videoId),
    refetch: () => {
      videoQuery.refetch();
      commentsQuery.refetch();
    },
  }), [video, videoId, likeMutation, bookmarkMutation, viewMutation, videoQuery, commentsQuery]);

  return {
    video,
    comments,
    isLoading,
    isError,
    error,
    isLiking: likeMutation.isPending,
    isBookmarking: bookmarkMutation.isPending,
    ...actions,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  useVideos,
  useInfiniteVideos,
  useVideoDetails,
  useLikeVideo,
  useBookmarkVideo,
  useRecordVideoView,
  useVideoCommentsQuery,
  useAddVideoComment,
  useDeleteVideoComment,
  useTrendingVideos,
  useLiveVideos,
  useRecommendedVideos,
  useBookmarkedVideos,
  useVideoSearch,
  useUploadVideo,
  useDeleteVideo,
  useVideoAnalytics,
  useVideoStats,
  useVideoState,
  videoQueryKeys,
};
