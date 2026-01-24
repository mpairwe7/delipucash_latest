/**
 * Video API Service
 * Dedicated API layer for video-related operations
 * Supports both mock data and real backend integration
 * Follows industry standards for REST API design
 */

import {
  ApiResponse,
  Video,
  Comment,
  PaginatedResponse,
} from "@/types";
import {
  mockVideos,
  mockComments,
  mockCurrentUser,
  getVideoById,
} from "@/data/mockData";

// Simulate network delay
const delay = (ms: number = 500): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
const isBackendConfigured = Boolean(API_BASE_URL);

// API Routes
const VIDEO_ROUTES = {
  list: "/api/videos",
  get: (id: string) => `/api/videos/${id}`,
  like: (id: string) => `/api/videos/${id}/like`,
  unlike: (id: string) => `/api/videos/${id}/unlike`,
  bookmark: (id: string) => `/api/videos/${id}/bookmark`,
  comments: (id: string) => `/api/videos/${id}/comments`,
  trending: "/api/videos/trending",
  live: "/api/videos/live",
  recommended: "/api/videos/recommended",
  search: "/api/videos/search",
  upload: "/api/videos",
  delete: (id: string) => `/api/videos/${id}`,
  update: (id: string) => `/api/videos/${id}`,
  incrementView: (id: string) => `/api/videos/${id}/view`,
  analytics: (id: string) => `/api/videos/${id}/analytics`,
  popular: "/api/videos/popular",
  byUser: (userId: string) => `/api/videos/user/${userId}`,
  categories: "/api/videos/categories",
  // Video premium & limits
  limits: (userId: string) => `/api/videos/limits/${userId}`,
  validateUpload: "/api/videos/validate-upload",
  livestreamStart: "/api/videos/livestream/start",
  livestreamEnd: "/api/videos/livestream/end",
  validateSession: "/api/videos/validate-session",
} as const;

// Helper to fetch JSON
async function fetchJson<T>(
  path: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      ...init,
    });

    const json = await response.json();
    if (!response.ok) {
      return {
        success: false,
        data: json as T,
        error: json?.message || "Request failed",
      };
    }

    return { success: true, data: json as T };
  } catch (error) {
    return {
      success: false,
      data: {} as T,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// Video statistics interface
export interface VideoStats {
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  liveVideosCount: number;
  averageEngagement: number;
  watchTime: number; // in minutes
}

// ============================================================================
// VIDEO PREMIUM & LIMITS TYPES
// ============================================================================

/** User's video premium status and limits */
export interface VideoPremiumLimits {
  hasVideoPremium: boolean;
  maxUploadSize: number;
  maxRecordingDuration: number;
  maxLivestreamDuration: number;
  maxUploadSizeFormatted: string;
  maxRecordingDurationFormatted: string;
  maxLivestreamDurationFormatted: string;
}

/** Upload validation request */
export interface ValidateUploadRequest {
  userId: string;
  fileSize: number;
  fileName?: string;
  mimeType?: string;
}

/** Upload validation response */
export interface ValidateUploadResponse {
  valid: boolean;
  message?: string;
  error?: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE';
  upgradeRequired?: boolean;
  currentLimit?: number;
  premiumLimit?: number;
  hasVideoPremium?: boolean;
  fileSize?: number;
  fileName?: string;
  maxUploadSize?: number;
}

/** Livestream session request */
export interface StartLivestreamRequest {
  userId: string;
  title?: string;
  description?: string;
}

/** Livestream session response */
export interface LivestreamSessionResponse {
  sessionId: string;
  streamKey: string;
  maxDuration: number;
  maxDurationFormatted: string;
  hasVideoPremium: boolean;
  streamer: {
    id: string;
    name: string;
  };
  title: string;
  description: string;
  startedAt: string;
}

/** End livestream request */
export interface EndLivestreamRequest {
  sessionId: string;
  duration: number;
  viewerCount?: number;
  peakViewers?: number;
}

/** Session duration validation request */
export interface ValidateSessionRequest {
  userId: string;
  sessionType: 'recording' | 'livestream';
  currentDuration?: number;
}

/** Session duration validation response */
export interface ValidateSessionResponse {
  valid: boolean;
  hasVideoPremium: boolean;
  sessionType: 'recording' | 'livestream';
  currentDuration: number;
  maxDuration: number;
  remainingSeconds: number;
  isNearLimit: boolean;
  limitReached: boolean;
  upgradeRequired?: boolean;
  premiumMaxDuration: number;
}


// Video filter options
export interface VideoFilters {
  category?: string;
  search?: string;
  sortBy?: "newest" | "oldest" | "popular" | "views" | "likes";
  duration?: "short" | "medium" | "long"; // < 5min, 5-20min, > 20min
  isLive?: boolean;
  userId?: string;
  page?: number;
  limit?: number;
}

// Video with extended details
export interface VideoWithDetails extends Video {
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
  comments?: Comment[];
  relatedVideos?: Video[];
  isLive?: boolean;
  duration?: number;
  category?: string;
  tags?: string[];
  engagementRate?: number;
}

// Upload video data
export interface UploadVideoData {
  title: string;
  description?: string;
  videoUrl: string;
  thumbnail: string;
  duration?: number;
  category?: string;
  tags?: string[];
  isLive?: boolean;
}

// Video analytics interface
export interface VideoAnalytics {
  videoId: string;
  views: number;
  uniqueViewers: number;
  likes: number;
  dislikes: number;
  comments: number;
  shares: number;
  averageWatchTime: number;
  completionRate: number;
  viewsByDay: { date: string; views: number }[];
  viewsByLocation: { location: string; views: number }[];
  engagementRate: number;
  clickThroughRate: number;
}

// ===========================================
// Video API
// ===========================================
export const videoApi = {
  /**
   * Get all videos with optional filtering and pagination
   */
  async getAll(
    filters?: VideoFilters
  ): Promise<PaginatedResponse<Video>> {
    if (isBackendConfigured) {
      const params = new URLSearchParams();
      if (filters?.category) params.append("category", filters.category);
      if (filters?.search) params.append("search", filters.search);
      if (filters?.sortBy) params.append("sortBy", filters.sortBy);
      if (filters?.duration) params.append("duration", filters.duration);
      if (filters?.isLive !== undefined)
        params.append("isLive", String(filters.isLive));
      if (filters?.userId) params.append("userId", filters.userId);
      if (filters?.page) params.append("page", String(filters.page));
      if (filters?.limit) params.append("limit", String(filters.limit));

      const queryString = params.toString();
      const path = queryString
        ? `${VIDEO_ROUTES.list}?${queryString}`
        : VIDEO_ROUTES.list;

      const response = await fetchJson<{
        data: Video[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(path);

      if (response.success) {
        return {
          success: true,
          data: response.data.data,
          pagination: response.data.pagination,
        };
      }
    }

    await delay();
    const { page = 1, limit = 10 } = filters || {};
    let videos = [...mockVideos];

    // Apply filters
    if (filters?.category) {
      videos = videos.filter((v) =>
        v.title?.toLowerCase().includes(filters.category!.toLowerCase())
      );
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      videos = videos.filter(
        (v) =>
          v.title?.toLowerCase().includes(searchLower) ||
          v.description?.toLowerCase().includes(searchLower)
      );
    }

    if (filters?.isLive) {
      videos = videos.filter(
        (v) => v.videoUrl?.includes(".m3u8") || v.videoUrl?.includes("live")
      );
    }

    if (filters?.userId) {
      videos = videos.filter((v) => v.userId === filters.userId);
    }

    // Apply sorting
    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case "newest":
          videos.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          break;
        case "oldest":
          videos.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          break;
        case "popular":
          videos.sort((a, b) => b.views + b.likes * 2 - (a.views + a.likes * 2));
          break;
        case "views":
          videos.sort((a, b) => b.views - a.views);
          break;
        case "likes":
          videos.sort((a, b) => b.likes - a.likes);
          break;
      }
    }

    // Paginate
    const start = (page - 1) * limit;
    const paginatedVideos = videos.slice(start, start + limit);

    return {
      success: true,
      data: paginatedVideos,
      pagination: {
        page,
        limit,
        total: videos.length,
        totalPages: Math.ceil(videos.length / limit),
      },
    };
  },

  /**
   * Get trending videos
   */
  async getTrending(limit: number = 10): Promise<ApiResponse<Video[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Video[]>(
        `${VIDEO_ROUTES.trending}?limit=${limit}`
      );
      if (response.success) return response;
    }

    await delay();
    const trending = [...mockVideos]
      .sort((a, b) => b.views + b.likes * 2 - (a.views + a.likes * 2))
      .slice(0, limit);

    return {
      success: true,
      data: trending,
    };
  },

  /**
   * Get popular videos
   */
  async getPopular(limit: number = 10): Promise<ApiResponse<Video[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Video[]>(
        `${VIDEO_ROUTES.popular}?limit=${limit}`
      );
      if (response.success) return response;
    }

    await delay();
    const popular = [...mockVideos]
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);

    return {
      success: true,
      data: popular,
    };
  },

  /**
   * Get live videos
   */
  async getLive(): Promise<ApiResponse<Video[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Video[]>(VIDEO_ROUTES.live);
      if (response.success) return response;
    }

    await delay();
    const liveVideos = mockVideos.filter(
      (v) => v.videoUrl?.includes(".m3u8") || v.videoUrl?.includes("live")
    );

    return {
      success: true,
      data: liveVideos,
    };
  },

  /**
   * Get recommended videos for user
   */
  async getRecommended(limit: number = 10): Promise<ApiResponse<Video[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Video[]>(
        `${VIDEO_ROUTES.recommended}?limit=${limit}`
      );
      if (response.success) return response;
    }

    await delay();
    // Shuffle and return random videos as recommendations
    const shuffled = [...mockVideos].sort(() => Math.random() - 0.5);

    return {
      success: true,
      data: shuffled.slice(0, limit),
    };
  },

  /**
   * Get video by ID with extended details
   */
  async getById(videoId: string): Promise<ApiResponse<VideoWithDetails | null>> {
    if (isBackendConfigured) {
      const response = await fetchJson<VideoWithDetails>(
        VIDEO_ROUTES.get(videoId)
      );
      if (response.success) return response;
    }

    await delay();
    const video = getVideoById(videoId);
    if (!video) {
      return { success: false, data: null, error: "Video not found" };
    }

    // Get related videos
    const relatedVideos = mockVideos
      .filter((v) => v.id !== videoId)
      .slice(0, 5);

    // Get comments
    const comments = mockComments.filter((c) => c.videoId === videoId);

    return {
      success: true,
      data: {
        ...video,
        comments,
        relatedVideos,
        engagementRate:
          video.views > 0
            ? Math.round(((video.likes + video.commentsCount) / video.views) * 100)
            : 0,
      },
    };
  },

  /**
   * Search videos
   */
  async search(query: string): Promise<ApiResponse<Video[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Video[]>(
        `${VIDEO_ROUTES.search}?q=${encodeURIComponent(query)}`
      );
      if (response.success) return response;
    }

    await delay();
    const lowerQuery = query.toLowerCase();
    const results = mockVideos.filter(
      (v) =>
        v.title?.toLowerCase().includes(lowerQuery) ||
        v.description?.toLowerCase().includes(lowerQuery)
    );

    return {
      success: true,
      data: results,
    };
  },

  /**
   * Like a video
   */
  async like(videoId: string): Promise<ApiResponse<Video>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Video>(VIDEO_ROUTES.like(videoId), {
        method: "POST",
      });
      if (response.success) return response;
    }

    await delay();
    const video = getVideoById(videoId);
    if (!video) {
      return { success: false, data: {} as Video, error: "Video not found" };
    }

    return {
      success: true,
      data: { ...video, likes: video.likes + 1 },
      message: "Video liked",
    };
  },

  /**
   * Unlike a video
   */
  async unlike(videoId: string): Promise<ApiResponse<Video>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Video>(VIDEO_ROUTES.unlike(videoId), {
        method: "POST",
      });
      if (response.success) return response;
    }

    await delay();
    const video = getVideoById(videoId);
    if (!video) {
      return { success: false, data: {} as Video, error: "Video not found" };
    }

    return {
      success: true,
      data: { ...video, likes: Math.max(0, video.likes - 1) },
      message: "Like removed",
    };
  },

  /**
   * Bookmark/unbookmark a video
   */
  async toggleBookmark(videoId: string): Promise<ApiResponse<Video>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Video>(VIDEO_ROUTES.bookmark(videoId), {
        method: "POST",
      });
      if (response.success) return response;
    }

    await delay();
    const video = getVideoById(videoId);
    if (!video) {
      return { success: false, data: {} as Video, error: "Video not found" };
    }

    return {
      success: true,
      data: { ...video, isBookmarked: !video.isBookmarked },
      message: video.isBookmarked ? "Bookmark removed" : "Video bookmarked",
    };
  },

  /**
   * Get bookmarked videos
   */
  async getBookmarked(): Promise<ApiResponse<Video[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Video[]>(
        `${VIDEO_ROUTES.list}?bookmarked=true`
      );
      if (response.success) return response;
    }

    await delay();
    const bookmarked = mockVideos.filter((v) => v.isBookmarked);

    return {
      success: true,
      data: bookmarked,
    };
  },

  /**
   * Get video comments
   */
  async getComments(videoId: string): Promise<ApiResponse<Comment[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Comment[]>(
        VIDEO_ROUTES.comments(videoId)
      );
      if (response.success) return response;
    }

    await delay();
    const comments = mockComments.filter((c) => c.videoId === videoId);

    return {
      success: true,
      data: comments,
    };
  },

  /**
   * Add comment to video
   */
  async addComment(
    videoId: string,
    text: string,
    mediaUrls?: string[]
  ): Promise<ApiResponse<Comment>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Comment>(VIDEO_ROUTES.comments(videoId), {
        method: "POST",
        body: JSON.stringify({ text, mediaUrls }),
      });
      if (response.success) return response;
    }

    await delay();
    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      text,
      mediaUrls: mediaUrls || [],
      userId: mockCurrentUser.id,
      videoId,
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: newComment,
      message: "Comment added",
    };
  },

  /**
   * Delete a comment
   */
  async deleteComment(
    videoId: string,
    commentId: string
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    if (isBackendConfigured) {
      const response = await fetchJson<{ deleted: boolean }>(
        `${VIDEO_ROUTES.comments(videoId)}/${commentId}`,
        { method: "DELETE" }
      );
      if (response.success) return response;
    }

    await delay();
    return {
      success: true,
      data: { deleted: true },
      message: "Comment deleted",
    };
  },

  /**
   * Upload a new video
   */
  async upload(videoData: UploadVideoData): Promise<ApiResponse<Video>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Video>(VIDEO_ROUTES.upload, {
        method: "POST",
        body: JSON.stringify(videoData),
      });
      if (response.success) return response;
    }

    await delay(1500); // Longer delay to simulate upload
    const newVideo: Video = {
      id: `video_${Date.now()}`,
      title: videoData.title,
      description: videoData.description || null,
      videoUrl: videoData.videoUrl,
      thumbnail: videoData.thumbnail,
      userId: mockCurrentUser.id,
      likes: 0,
      views: 0,
      isBookmarked: false,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: newVideo,
      message: "Video uploaded successfully",
    };
  },

  /**
   * Update video details
   */
  async update(
    videoId: string,
    data: Partial<UploadVideoData>
  ): Promise<ApiResponse<Video>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Video>(VIDEO_ROUTES.update(videoId), {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (response.success) return response;
    }

    await delay();
    const video = getVideoById(videoId);
    if (!video) {
      return { success: false, data: {} as Video, error: "Video not found" };
    }

    const updatedVideo: Video = {
      ...video,
      title: data.title ?? video.title,
      description: data.description ?? video.description,
      thumbnail: data.thumbnail ?? video.thumbnail,
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: updatedVideo,
      message: "Video updated successfully",
    };
  },

  /**
   * Delete a video
   */
  async delete(videoId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    if (isBackendConfigured) {
      const response = await fetchJson<{ deleted: boolean }>(
        VIDEO_ROUTES.delete(videoId),
        { method: "DELETE" }
      );
      if (response.success) return response;
    }

    await delay();
    const video = getVideoById(videoId);
    if (!video) {
      return {
        success: false,
        data: { deleted: false },
        error: "Video not found",
      };
    }

    return {
      success: true,
      data: { deleted: true },
      message: "Video deleted successfully",
    };
  },

  /**
   * Increment video view count
   */
  async incrementView(videoId: string): Promise<ApiResponse<Video>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Video>(
        VIDEO_ROUTES.incrementView(videoId),
        { method: "POST" }
      );
      if (response.success) return response;
    }

    await delay(100); // Quick operation
    const video = getVideoById(videoId);
    if (!video) {
      return { success: false, data: {} as Video, error: "Video not found" };
    }

    return {
      success: true,
      data: { ...video, views: video.views + 1 },
    };
  },

  /**
   * Get video analytics
   */
  async getAnalytics(videoId: string): Promise<ApiResponse<VideoAnalytics>> {
    if (isBackendConfigured) {
      const response = await fetchJson<VideoAnalytics>(
        VIDEO_ROUTES.analytics(videoId)
      );
      if (response.success) return response;
    }

    await delay();
    const video = getVideoById(videoId);
    if (!video) {
      return {
        success: false,
        data: {} as VideoAnalytics,
        error: "Video not found",
      };
    }

    // Generate mock analytics
    const analytics: VideoAnalytics = {
      videoId,
      views: video.views,
      uniqueViewers: Math.floor(video.views * 0.85),
      likes: video.likes,
      dislikes: Math.floor(video.likes * 0.05),
      comments: video.commentsCount,
      shares: Math.floor(video.views * 0.02),
      averageWatchTime: 180 + Math.random() * 300, // 3-8 minutes
      completionRate: 0.65 + Math.random() * 0.25, // 65-90%
      viewsByDay: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        views: Math.floor(Math.random() * video.views * 0.2),
      })),
      viewsByLocation: [
        { location: "United States", views: Math.floor(video.views * 0.4) },
        { location: "India", views: Math.floor(video.views * 0.25) },
        { location: "United Kingdom", views: Math.floor(video.views * 0.15) },
        { location: "Canada", views: Math.floor(video.views * 0.1) },
        { location: "Other", views: Math.floor(video.views * 0.1) },
      ],
      engagementRate:
        video.views > 0
          ? (video.likes + video.commentsCount) / video.views
          : 0,
      clickThroughRate: 0.02 + Math.random() * 0.08, // 2-10%
    };

    return {
      success: true,
      data: analytics,
    };
  },

  /**
   * Get videos by user
   */
  async getByUser(
    userId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Video>> {
    if (isBackendConfigured) {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append("page", String(params.page));
      if (params?.limit) queryParams.append("limit", String(params.limit));
      const queryString = queryParams.toString();
      const path = queryString
        ? `${VIDEO_ROUTES.byUser(userId)}?${queryString}`
        : VIDEO_ROUTES.byUser(userId);

      const response = await fetchJson<{
        data: Video[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(path);

      if (response.success) {
        return {
          success: true,
          data: response.data.data,
          pagination: response.data.pagination,
        };
      }
    }

    await delay();
    const { page = 1, limit = 10 } = params || {};
    const userVideos = mockVideos.filter((v) => v.userId === userId);
    const start = (page - 1) * limit;
    const paginatedVideos = userVideos.slice(start, start + limit);

    return {
      success: true,
      data: paginatedVideos,
      pagination: {
        page,
        limit,
        total: userVideos.length,
        totalPages: Math.ceil(userVideos.length / limit),
      },
    };
  },

  /**
   * Get video categories
   */
  async getCategories(): Promise<
    ApiResponse<{ id: string; name: string; count: number }[]>
  > {
    if (isBackendConfigured) {
      const response = await fetchJson<
        { id: string; name: string; count: number }[]
      >(VIDEO_ROUTES.categories);
      if (response.success) return response;
    }

    await delay();
    // Generate mock categories from video titles
    const categories = [
      { id: "entertainment", name: "Entertainment", count: 25 },
      { id: "education", name: "Education", count: 18 },
      { id: "gaming", name: "Gaming", count: 15 },
      { id: "music", name: "Music", count: 12 },
      { id: "sports", name: "Sports", count: 10 },
      { id: "news", name: "News", count: 8 },
      { id: "comedy", name: "Comedy", count: 7 },
      { id: "tech", name: "Technology", count: 5 },
    ];

    return {
      success: true,
      data: categories,
    };
  },

  /**
   * Get video statistics for user
   */
  async getStats(): Promise<ApiResponse<VideoStats>> {
    await delay();

    const totalViews = mockVideos.reduce((sum, v) => sum + v.views, 0);
    const totalLikes = mockVideos.reduce((sum, v) => sum + v.likes, 0);
    const totalComments = mockVideos.reduce((sum, v) => sum + v.commentsCount, 0);
    const liveVideos = mockVideos.filter(
      (v) => v.videoUrl?.includes(".m3u8") || v.videoUrl?.includes("live")
    );

    const stats: VideoStats = {
      totalVideos: mockVideos.length,
      totalViews,
      totalLikes,
      totalComments,
      liveVideosCount: liveVideos.length,
      averageEngagement:
        totalViews > 0
          ? Math.round(((totalLikes + totalComments) / totalViews) * 100)
          : 0,
      watchTime: Math.floor(Math.random() * 5000) + 1000, // Random watch time
    };

    return {
      success: true,
      data: stats,
    };
  },

  /**
   * Share a video (track share action)
   */
  async share(
    videoId: string,
    platform: "copy" | "twitter" | "facebook" | "whatsapp"
  ): Promise<ApiResponse<{ shared: boolean }>> {
    if (isBackendConfigured) {
      const response = await fetchJson<{ shared: boolean }>(
        `${VIDEO_ROUTES.get(videoId)}/share`,
        {
          method: "POST",
          body: JSON.stringify({ platform }),
        }
      );
      if (response.success) return response;
    }

    await delay(200);
    return {
      success: true,
      data: { shared: true },
      message: `Video shared via ${platform}`,
    };
  },

  /**
   * Report a video
   */
  async report(
    videoId: string,
    reason: string,
    description?: string
  ): Promise<ApiResponse<{ reported: boolean }>> {
    if (isBackendConfigured) {
      const response = await fetchJson<{ reported: boolean }>(
        `${VIDEO_ROUTES.get(videoId)}/report`,
        {
          method: "POST",
          body: JSON.stringify({ reason, description }),
        }
      );
      if (response.success) return response;
    }

    await delay();
    return {
      success: true,
      data: { reported: true },
      message: "Video reported successfully. Our team will review it.",
    };
  },

  // ==========================================================================
  // VIDEO PREMIUM & LIMITS API
  // ==========================================================================

  /**
   * Get user's video premium status and upload/stream limits
   */
  async getVideoLimits(userId: string): Promise<ApiResponse<VideoPremiumLimits>> {
    if (isBackendConfigured) {
      const response = await fetchJson<{ data: VideoPremiumLimits }>(
        VIDEO_ROUTES.limits(userId)
      );
      if (response.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, data: {} as VideoPremiumLimits, error: response.error };
    }

    // Mock response for development
    await delay();
    return {
      success: true,
      data: {
        hasVideoPremium: false,
        maxUploadSize: 20 * 1024 * 1024, // 20MB
        maxRecordingDuration: 300, // 5 minutes
        maxLivestreamDuration: 300, // 5 minutes
        maxUploadSizeFormatted: '20 MB',
        maxRecordingDurationFormatted: '5 minutes',
        maxLivestreamDurationFormatted: '5 minutes',
      },
    };
  },

  /**
   * Validate upload request before uploading (check file size against user's limit)
   */
  async validateUpload(data: ValidateUploadRequest): Promise<ApiResponse<ValidateUploadResponse>> {
    if (isBackendConfigured) {
      const response = await fetchJson<{ data: ValidateUploadResponse }>(
        VIDEO_ROUTES.validateUpload,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      if (response.success) {
        return { success: true, data: response.data.data || response.data as unknown as ValidateUploadResponse };
      }
      // Return error response with validation details
      return {
        success: false,
        data: response.data as unknown as ValidateUploadResponse,
        error: response.error,
      };
    }

    // Mock validation for development
    await delay();
    const FREE_LIMIT = 20 * 1024 * 1024; // 20MB
    
    if (data.fileSize > FREE_LIMIT) {
      return {
        success: false,
        data: {
          valid: false,
          error: 'FILE_TOO_LARGE',
          message: 'File size exceeds maximum allowed (20 MB)',
          upgradeRequired: true,
          currentLimit: FREE_LIMIT,
          premiumLimit: 500 * 1024 * 1024, // 500MB
        },
        error: 'File too large',
      };
    }

    return {
      success: true,
      data: {
        valid: true,
        hasVideoPremium: false,
        fileSize: data.fileSize,
        fileName: data.fileName,
        maxUploadSize: FREE_LIMIT,
      },
    };
  },

  /**
   * Start a livestream session
   */
  async startLivestream(data: StartLivestreamRequest): Promise<ApiResponse<LivestreamSessionResponse>> {
    if (isBackendConfigured) {
      const response = await fetchJson<{ data: LivestreamSessionResponse }>(
        VIDEO_ROUTES.livestreamStart,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      if (response.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, data: {} as LivestreamSessionResponse, error: response.error };
    }

    // Mock response for development
    await delay();
    return {
      success: true,
      data: {
        sessionId: `stream_${Date.now()}`,
        streamKey: `key_${Math.random().toString(36).substr(2, 9)}`,
        maxDuration: 300, // 5 minutes for free users
        maxDurationFormatted: '5 minutes',
        hasVideoPremium: false,
        streamer: {
          id: data.userId,
          name: 'User',
        },
        title: data.title || 'Live Stream',
        description: data.description || '',
        startedAt: new Date().toISOString(),
      },
    };
  },

  /**
   * End a livestream session
   */
  async endLivestream(data: EndLivestreamRequest): Promise<ApiResponse<{ endedAt: string }>> {
    if (isBackendConfigured) {
      const response = await fetchJson<{ data: { endedAt: string } }>(
        VIDEO_ROUTES.livestreamEnd,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      if (response.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, data: { endedAt: '' }, error: response.error };
    }

    // Mock response for development
    await delay();
    return {
      success: true,
      data: { endedAt: new Date().toISOString() },
    };
  },

  /**
   * Validate session duration (for recording or livestream)
   */
  async validateSession(data: ValidateSessionRequest): Promise<ApiResponse<ValidateSessionResponse>> {
    if (isBackendConfigured) {
      const response = await fetchJson<{ data: ValidateSessionResponse }>(
        VIDEO_ROUTES.validateSession,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      if (response.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, data: {} as ValidateSessionResponse, error: response.error };
    }

    // Mock response for development
    await delay();
    const maxDuration = 300; // 5 minutes for free users
    const currentDuration = data.currentDuration || 0;
    const remainingSeconds = Math.max(0, maxDuration - currentDuration);

    return {
      success: true,
      data: {
        valid: remainingSeconds > 0,
        hasVideoPremium: false,
        sessionType: data.sessionType,
        currentDuration,
        maxDuration,
        remainingSeconds,
        isNearLimit: remainingSeconds <= 30,
        limitReached: remainingSeconds <= 0,
        upgradeRequired: remainingSeconds <= 0,
        premiumMaxDuration: data.sessionType === 'livestream' ? 7200 : 1800,
      },
    };
  },
};

export default videoApi;
