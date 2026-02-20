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
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type UseQueryResult,
  type UseMutationResult,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { Video, Comment } from '@/types';
import { videoApi, VideoWithDetails, VideoAnalytics, VideoStats, LivestreamListItem } from './videoApi';
import { useAuthStore } from '@/utils/auth/store';

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
  following: () => [...videoQueryKeys.all, 'following'] as const,
  live: () => [...videoQueryKeys.all, 'live'] as const,
  recommended: () => [...videoQueryKeys.all, 'recommended'] as const,
  search: (query: string) => [...videoQueryKeys.all, 'search', query] as const,
  bookmarked: () => [...videoQueryKeys.all, 'bookmarked'] as const,
  userVideos: (userId: string) => [...videoQueryKeys.all, 'user', userId] as const,
  status: (videoId: string) => [...videoQueryKeys.all, 'status', videoId] as const,
  analytics: (videoId: string) => [...videoQueryKeys.all, 'analytics', videoId] as const,
  stats: () => [...videoQueryKeys.all, 'stats'] as const,
  // Livestream keys
  livestreams: () => [...videoQueryKeys.all, 'livestreams'] as const,
  livestreamSession: (sessionId: string) => [...videoQueryKeys.all, 'livestream', sessionId] as const,
  // 2026 Feed enhancement keys
  personalized: (filters: Record<string, unknown>) => [...videoQueryKeys.all, 'personalized', filters] as const,
  trendingInfinite: (filters: Record<string, unknown>) => [...videoQueryKeys.all, 'trending-infinite', filters] as const,
  searchInfinite: (query: string) => [...videoQueryKeys.all, 'search-infinite', query] as const,
  explore: () => [...videoQueryKeys.all, 'explore'] as const,
  // Follow graph keys
  follows: () => ['follows'] as const,
  followStatus: (creatorId: string) => ['follows', 'status', creatorId] as const,
  followCounts: (userId: string) => ['follows', 'counts', userId] as const,
  blocked: () => ['follows', 'blocked'] as const,
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
    queryKey: videoQueryKeys.list({ limit, category, search, sortBy }),
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

/**
 * Hook to get per-user like/bookmark status for a specific video
 */
export function useVideoStatus(videoId: string) {
  return useQuery({
    queryKey: videoQueryKeys.status(videoId),
    queryFn: async () => {
      const response = await videoApi.getVideoStatus(videoId);
      if (!response.success) throw new Error(response.error);
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
  Video,
  Error,
  { videoId: string; isLiked: boolean },
  { previousVideo: VideoWithDetails | undefined }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['videos', 'like'],
    mutationFn: async ({ videoId, isLiked }) => {
      const response = isLiked
        ? await videoApi.unlike(videoId)
        : await videoApi.like(videoId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    // Optimistic update — detail + infinite list caches
    onMutate: async ({ videoId, isLiked }) => {
      await queryClient.cancelQueries({ queryKey: videoQueryKeys.detail(videoId) });
      await queryClient.cancelQueries({ queryKey: videoQueryKeys.lists() });

      // Snapshot detail
      const previousVideo = queryClient.getQueryData<VideoWithDetails>(
        videoQueryKeys.detail(videoId)
      );

      // Optimistically update detail cache
      if (previousVideo) {
        queryClient.setQueryData<VideoWithDetails>(
          videoQueryKeys.detail(videoId),
          {
            ...previousVideo,
            likes: isLiked ? previousVideo.likes - 1 : previousVideo.likes + 1,
            isLiked: !isLiked,
          }
        );
      }

      // Optimistically update infinite list pages
      queryClient.setQueriesData<{ pages: Array<{ videos: Video[] }>; pageParams: number[] }>(
        { queryKey: videoQueryKeys.lists() },
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              videos: page.videos.map((v: Video) =>
                v.id === videoId
                  ? { ...v, likes: isLiked ? v.likes - 1 : v.likes + 1, isLiked: !isLiked }
                  : v
              ),
            })),
          };
        }
      );

      return { previousVideo };
    },
    onError: (_, { videoId }, context) => {
      if (context?.previousVideo) {
        queryClient.setQueryData(videoQueryKeys.detail(videoId), context.previousVideo);
      }
      // Rollback list by refetching
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.lists() });
    },
    onSettled: (_, __, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.detail(videoId) });
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.status(videoId) });
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
  { videoId: string; isBookmarked: boolean },
  { previousVideo: VideoWithDetails | undefined }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['videos', 'bookmark'],
    mutationFn: async ({ videoId }) => {
      const response = await videoApi.toggleBookmark(videoId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    // Optimistic update — detail + infinite list caches
    onMutate: async ({ videoId, isBookmarked }) => {
      await queryClient.cancelQueries({ queryKey: videoQueryKeys.detail(videoId) });
      await queryClient.cancelQueries({ queryKey: videoQueryKeys.lists() });

      const previousVideo = queryClient.getQueryData<VideoWithDetails>(
        videoQueryKeys.detail(videoId)
      );

      // Optimistically update detail cache
      if (previousVideo) {
        queryClient.setQueryData<VideoWithDetails>(
          videoQueryKeys.detail(videoId),
          { ...previousVideo, isBookmarked: !isBookmarked }
        );
      }

      // Optimistically update infinite list pages
      queryClient.setQueriesData<{ pages: Array<{ videos: Video[] }>; pageParams: number[] }>(
        { queryKey: videoQueryKeys.lists() },
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              videos: page.videos.map((v: Video) =>
                v.id === videoId ? { ...v, isBookmarked: !isBookmarked } : v
              ),
            })),
          };
        }
      );

      return { previousVideo };
    },
    onError: (_, { videoId }, context) => {
      if (context?.previousVideo) {
        queryClient.setQueryData(videoQueryKeys.detail(videoId), context.previousVideo);
      }
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.lists() });
    },
    onSettled: (_, __, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.detail(videoId) });
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.bookmarked() });
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.status(videoId) });
    },
  });
}

/**
 * Hook to share a video (analytics tracking)
 */
export function useShareVideo(): UseMutationResult<
  { shared: boolean; platform: string },
  Error,
  { videoId: string; platform: 'copy' | 'twitter' | 'facebook' | 'whatsapp' | 'instagram' | 'telegram' | 'email' | 'sms' | 'other' }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['videos', 'share'],
    mutationFn: async ({ videoId, platform }) => {
      const response = await videoApi.share(videoId, platform);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSettled: (_, __, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.detail(videoId) });
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
    mutationKey: ['videos', 'recordView'],
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
    queryKey: [...videoQueryKeys.comments(videoId), { page, limit }],
    queryFn: async () => {
      const response = await videoApi.getComments(videoId, page, limit);
      if (!response.success) throw new Error(response.error || 'Failed to fetch comments');
      return {
        comments: response.data,
        pagination: response.pagination || { page, limit, total: response.data.length, totalPages: 1 },
      };
    },
    enabled: !!videoId,
    staleTime: 1000 * 30, // 30 seconds - comments change frequently
  });
}

/**
 * Infinite scroll comments — loads pages incrementally on scroll
 */
export function useInfiniteVideoComments(videoId: string, limit: number = 20) {
  return useInfiniteQuery({
    queryKey: [...videoQueryKeys.comments(videoId), 'infinite'],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await videoApi.getComments(videoId, pageParam, limit);
      if (!response.success) throw new Error(response.error || 'Failed to fetch comments');
      return {
        comments: response.data,
        nextPage: response.data.length === limit ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: !!videoId,
    staleTime: 30_000,
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
    mutationKey: ['videos', 'addComment'],
    mutationFn: async ({ videoId, text }) => {
      const response = await videoApi.addComment(videoId, text);
      if (!response.success) throw new Error(response.error || 'Failed to post comment');
      return response.data;
    },
    // Optimistic update — use fuzzy key matching (getQueriesData/setQueriesData)
    // because useVideoCommentsQuery appends { page, limit } to the base key
    onMutate: async ({ videoId, text, mediaUrls }) => {
      const baseKey = videoQueryKeys.comments(videoId);
      await queryClient.cancelQueries({ queryKey: baseKey });

      // Snapshot ALL matching comment queries (fuzzy match)
      const previousQueries = queryClient.getQueriesData<CommentsData>({ queryKey: baseKey });

      // Build optimistic comment with real user data
      const authState = useAuthStore.getState().auth;
      const optimisticComment: Comment = {
        id: `temp_${Date.now()}`,
        text,
        mediaUrls: mediaUrls || [],
        userId: authState?.user?.id || 'current_user',
        videoId,
        createdAt: new Date().toISOString(),
        user: authState?.user ? {
          id: authState.user.id,
          firstName: authState.user.firstName,
          lastName: authState.user.lastName,
          email: authState.user.email,
          avatar: authState.user.avatar,
        } as any : undefined,
      };

      // Update ALL matching comment queries (fuzzy match)
      queryClient.setQueriesData<CommentsData>(
        { queryKey: baseKey },
        (old) => old ? {
          comments: [optimisticComment, ...(old.comments || [])],
          pagination: {
            ...old.pagination,
            total: (old.pagination?.total || 0) + 1,
          },
        } : undefined,
      );

      return { previousQueries };
    },
    onError: (_, { videoId }, context) => {
      // Rollback ALL matching comment queries
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          if (data) queryClient.setQueryData(key, data);
        }
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
    mutationKey: ['videos', 'deleteComment'],
    mutationFn: async ({ videoId, commentId }) => {
      const response = await videoApi.deleteComment(videoId, commentId);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onMutate: async ({ videoId, commentId }) => {
      const baseKey = videoQueryKeys.comments(videoId);
      await queryClient.cancelQueries({ queryKey: baseKey });

      // Snapshot ALL matching comment queries (fuzzy match)
      const previousQueries = queryClient.getQueriesData<CommentsData>({ queryKey: baseKey });

      // Optimistically remove comment from ALL matching queries
      queryClient.setQueriesData<CommentsData>(
        { queryKey: baseKey },
        (old) => old ? {
          comments: old.comments.filter((c) => c.id !== commentId),
          pagination: {
            ...old.pagination,
            total: Math.max(0, (old.pagination?.total || 0) - 1),
          },
        } : undefined,
      );

      return { previousQueries };
    },
    onError: (_, { videoId }, context) => {
      // Rollback ALL matching comment queries
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          if (data) queryClient.setQueryData(key, data);
        }
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
 * Hook to fetch trending videos — uses dedicated /trending endpoint with
 * time-decay scoring (engagement velocity, not just total likes).
 */
export function useTrendingVideos(limit: number = 20): UseQueryResult<Video[]> {
  return useQuery({
    queryKey: videoQueryKeys.trending(),
    queryFn: async () => {
      const response = await videoApi.getTrending({ limit });
      if (!response.success) throw new Error(response.error || 'Failed to fetch trending videos');
      return response.data;
    },
    staleTime: 1000 * 60 * 3, // 3 minutes — trending changes faster than general feed
  });
}

/**
 * Hook to fetch following videos — videos from creators the user has engaged with.
 * Uses infinite query for seamless infinite scroll within the Following tab.
 */
export function useInfiniteFollowingVideos(params: { limit?: number; enabled?: boolean } = {}): UseInfiniteQueryResult<{
  pages: { videos: Video[]; nextPage: number | null }[];
  pageParams: number[];
}> {
  const { limit = 15, enabled = true } = params;

  return useInfiniteQuery({
    queryKey: videoQueryKeys.following(),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await videoApi.getFollowing(pageParam, limit);
      if (!response.success) throw new Error(response.error || 'Failed to fetch following videos');

      const pagination = (response as any).pagination;
      const hasMore = pagination ? pageParam < pagination.totalPages : response.data.length === limit;

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

/**
 * Hook to fetch live videos
 */
export function useLiveVideos(): UseQueryResult<LivestreamListItem[]> {
  return useQuery({
    queryKey: videoQueryKeys.livestreams(),
    queryFn: async () => {
      const response = await videoApi.getLive();
      if (!response.success) throw new Error(response.error || 'Failed to fetch live streams');
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds - live status changes frequently
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}

/**
 * Hook to join a livestream (mutation)
 */
export function useJoinLivestream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => videoApi.joinLivestream(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.livestreams() });
    },
  });
}

/**
 * Hook to leave a livestream (mutation)
 */
export function useLeaveLivestream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => videoApi.leaveLivestream(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.livestreams() });
    },
  });
}

/**
 * Hook to send a chat message to a livestream
 */
export function useSendLivestreamChat() {
  return useMutation({
    mutationFn: ({ sessionId, text }: { sessionId: string; text: string }) =>
      videoApi.sendLivestreamChat(sessionId, text),
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
    enabled: (query ?? '').length >= 2,
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
    mutationKey: ['videos', 'upload'],
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
    mutationKey: ['videos', 'delete'],
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
// SUSPENSE HOOKS (2026 — use inside <Suspense> boundary)
// ============================================================================

/**
 * Suspense-enabled video detail.
 * Throws promise while loading — guaranteed non-null data on render.
 */
export function useSuspenseVideoDetails(videoId: string) {
  return useSuspenseQuery({
    queryKey: videoQueryKeys.detail(videoId),
    queryFn: async () => {
      const response = await videoApi.getById(videoId);
      if (!response.success) throw new Error(response.error || 'Failed to fetch video');
      return response.data;
    },
    staleTime: 1000 * 60,
  });
}

/**
 * Suspense-enabled video comments.
 * Throws promise while loading — guaranteed non-null data on render.
 */
export function useSuspenseVideoComments(videoId: string) {
  return useSuspenseQuery({
    queryKey: videoQueryKeys.comments(videoId),
    queryFn: async (): Promise<CommentsData> => {
      const response = await videoApi.getComments(videoId);
      if (!response.success) throw new Error(response.error || 'Failed to fetch comments');
      return {
        comments: response.data,
        pagination: { page: 1, limit: 20, total: response.data.length, totalPages: 1 },
      };
    },
    staleTime: 1000 * 30,
  });
}

/**
 * Suspense-enabled trending videos.
 * Throws promise while loading — guaranteed non-null data on render.
 */
export function useSuspenseTrendingVideos(limit: number = 10) {
  return useSuspenseQuery({
    queryKey: videoQueryKeys.trending(),
    queryFn: async () => {
      const response = await videoApi.getTrending({ limit });
      if (!response.success) throw new Error(response.error || 'Failed to fetch trending videos');
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ============================================================================
// 2026 FEED ENHANCEMENT HOOKS
// ============================================================================

/**
 * Personalized feed with infinite scroll — replaces useInfiniteVideos for "For You" tab.
 * Uses server-side ML-lite scoring based on telemetry signals.
 * Falls back to recency-sorted for anonymous/cold-start users.
 */
export function usePersonalizedFeed(params: {
  limit?: number;
  excludeIds?: string[];
  enabled?: boolean;
} = {}): UseInfiniteQueryResult<{
  pages: { videos: Video[]; nextPage: number | null }[];
  pageParams: number[];
}> {
  const { limit = 15, excludeIds = [], enabled = true } = params;

  return useInfiniteQuery({
    queryKey: videoQueryKeys.personalized({ limit, excludeCount: excludeIds.length }),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await videoApi.getPersonalized({ page: pageParam, limit, excludeIds });
      if (!response.success) throw new Error(response.error || 'Failed to fetch personalized feed');

      const pagination = response.pagination;
      const hasMore = pagination
        ? pageParam < pagination.totalPages
        : response.data.length === limit;

      return {
        videos: response.data,
        nextPage: hasMore ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Infinite scroll trending videos with pagination + localization.
 * Replaces the old single-page useTrendingVideos for the Trending tab.
 * Auto-refreshes hourly.
 */
export function useInfiniteTrendingVideos(params: {
  limit?: number;
  country?: string;
  language?: string;
  enabled?: boolean;
} = {}): UseInfiniteQueryResult<{
  pages: { videos: Video[]; nextPage: number | null }[];
  pageParams: number[];
}> {
  const { limit = 20, country, language, enabled = true } = params;

  return useInfiniteQuery({
    queryKey: videoQueryKeys.trendingInfinite({ limit, country, language }),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await videoApi.getTrending({ page: pageParam, limit, country, language });
      if (!response.success) throw new Error(response.error || 'Failed to fetch trending videos');

      const pagination = response.pagination;
      const hasMore = pagination
        ? pageParam < pagination.totalPages
        : response.data.length === limit;

      return {
        videos: response.data,
        nextPage: hasMore ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled,
    staleTime: 1000 * 60 * 60, // 1 hour — trending is hourly
    refetchInterval: 1000 * 60 * 60, // Auto-refresh hourly
  });
}

/**
 * Server-side search with infinite scroll and relevance scoring.
 * Replaces client-side filtering via useVideoSearch.
 * Enabled when query is >= 2 chars.
 */
export function useVideoSearchInfinite(query: string, limit: number = 15): UseInfiniteQueryResult<{
  pages: { videos: Video[]; nextPage: number | null }[];
  pageParams: number[];
}> {
  return useInfiniteQuery({
    queryKey: videoQueryKeys.searchInfinite(query),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await videoApi.searchServerSide({ query, page: pageParam, limit });
      if (!response.success) throw new Error(response.error || 'Search failed');

      const pagination = response.pagination;
      const hasMore = pagination
        ? pageParam < pagination.totalPages
        : response.data.length === limit;

      return {
        videos: response.data,
        nextPage: hasMore ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: (query ?? '').length >= 2,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Video feedback mutation — not interested, hide creator, report.
 * Returns creatorId so frontend can hide all content from that creator.
 */
export function useVideoFeedback(): UseMutationResult<
  { feedbackId: string; action: string; creatorId?: string },
  Error,
  { videoId: string; action: 'not_interested' | 'hide_creator' | 'hide_sound' | 'report'; reason?: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['videos', 'feedback'],
    mutationFn: async (params) => {
      const response = await videoApi.submitFeedback(params);
      if (!response.success) throw new Error(response.error || 'Failed to submit feedback');
      return response.data;
    },
    onSettled: () => {
      // Invalidate all feed queries so hidden content is filtered out
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.trending() });
    },
  });
}

/**
 * Record video completion — fire-and-forget mutation for completionsCount.
 */
export function useRecordVideoCompletion(): UseMutationResult<
  { completionsCount: number },
  Error,
  string
> {
  return useMutation({
    mutationKey: ['videos', 'completion'],
    mutationFn: async (videoId: string) => {
      const response = await videoApi.recordCompletion(videoId);
      if (!response.success) throw new Error(response.error || 'Failed to record completion');
      return response.data;
    },
  });
}

/**
 * Explore videos — random diverse videos for feed blending.
 * Used to inject diversity into the personalized "For You" feed.
 */
export function useExploreVideos(params: {
  limit?: number;
  enabled?: boolean;
} = {}): UseQueryResult<Video[]> {
  const { limit = 10, enabled = true } = params;

  return useQuery({
    queryKey: videoQueryKeys.explore(),
    queryFn: async () => {
      const response = await videoApi.getExplore({ limit });
      if (!response.success) throw new Error(response.error || 'Failed to fetch explore videos');
      return response.data;
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
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
  // Livestream hooks
  useJoinLivestream,
  useLeaveLivestream,
  useSendLivestreamChat,
  // Suspense variants
  useSuspenseVideoDetails,
  useSuspenseVideoComments,
  useSuspenseTrendingVideos,
  // 2026 Feed enhancement hooks
  usePersonalizedFeed,
  useInfiniteTrendingVideos,
  useVideoSearchInfinite,
  useVideoFeedback,
  useRecordVideoCompletion,
  useExploreVideos,
  // Follow graph hooks
  useFollowCreator,
  useUnfollowCreator,
  useFollowStatus,
  useFollowCounts,
  useBlockUser,
};

// ============================================================================
// FOLLOW GRAPH HOOKS — Explicit follow/unfollow with optimistic updates
// ============================================================================

/** Follow a creator — optimistic UI with rollback */
export function useFollowCreator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (creatorId: string) => {
      const response = await videoApi.followCreator(creatorId);
      if (!response.success) throw new Error(response.error || 'Failed to follow');
      return response.data;
    },
    onMutate: async (creatorId: string) => {
      await queryClient.cancelQueries({ queryKey: videoQueryKeys.followStatus(creatorId) });
      const prev = queryClient.getQueryData(videoQueryKeys.followStatus(creatorId));
      queryClient.setQueryData(videoQueryKeys.followStatus(creatorId), { isFollowing: true, notificationsEnabled: true });
      return { prev };
    },
    onError: (_err, creatorId, context) => {
      if (context?.prev) queryClient.setQueryData(videoQueryKeys.followStatus(creatorId), context.prev);
    },
    onSettled: (_data, _err, creatorId) => {
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.followStatus(creatorId) });
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.followCounts(creatorId) });
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.following() });
    },
  });
}

/** Unfollow a creator — optimistic UI with rollback */
export function useUnfollowCreator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (creatorId: string) => {
      const response = await videoApi.unfollowCreator(creatorId);
      if (!response.success) throw new Error(response.error || 'Failed to unfollow');
      return response.data;
    },
    onMutate: async (creatorId: string) => {
      await queryClient.cancelQueries({ queryKey: videoQueryKeys.followStatus(creatorId) });
      const prev = queryClient.getQueryData(videoQueryKeys.followStatus(creatorId));
      queryClient.setQueryData(videoQueryKeys.followStatus(creatorId), { isFollowing: false, notificationsEnabled: false });
      return { prev };
    },
    onError: (_err, creatorId, context) => {
      if (context?.prev) queryClient.setQueryData(videoQueryKeys.followStatus(creatorId), context.prev);
    },
    onSettled: (_data, _err, creatorId) => {
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.followStatus(creatorId) });
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.followCounts(creatorId) });
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.following() });
    },
  });
}

/** Check follow status for a creator */
export function useFollowStatus(creatorId: string | undefined) {
  return useQuery({
    queryKey: videoQueryKeys.followStatus(creatorId || ''),
    queryFn: async () => {
      if (!creatorId) return { isFollowing: false, notificationsEnabled: false };
      const response = await videoApi.getFollowStatus(creatorId);
      if (!response.success) return { isFollowing: false, notificationsEnabled: false };
      return response.data;
    },
    enabled: !!creatorId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/** Get follower/following counts for a user */
export function useFollowCounts(userId: string | undefined) {
  return useQuery({
    queryKey: videoQueryKeys.followCounts(userId || ''),
    queryFn: async () => {
      if (!userId) return { followersCount: 0, followingCount: 0 };
      const response = await videoApi.getFollowCounts(userId);
      if (!response.success) return { followersCount: 0, followingCount: 0 };
      return response.data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/** Block a user — invalidates all feed queries */
export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await videoApi.blockUser(userId);
      if (!response.success) throw new Error(response.error || 'Failed to block user');
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all feed queries since blocked content should be removed
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.follows() });
    },
  });
}
