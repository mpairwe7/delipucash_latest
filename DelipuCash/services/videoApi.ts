/**
 * Video API Service
 * Dedicated API layer for video-related operations
 * REST API integration - No mock data fallbacks
 * Follows industry standards for REST API design
 */

import {
  ApiResponse,
  Video,
  Comment,
  PaginatedResponse,
} from "@/types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";

// Validate that API URL is configured
if (!API_BASE_URL) {
  console.warn('[VideoAPI] EXPO_PUBLIC_API_URL is not configured. API calls will fail.');
}

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
  async getAll(filters?: VideoFilters): Promise<PaginatedResponse<Video>> {
    const params = new URLSearchParams();
    if (filters?.category) params.append("category", filters.category);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.sortBy) params.append("sortBy", filters.sortBy);
    if (filters?.duration) params.append("duration", filters.duration);
    if (filters?.isLive !== undefined) params.append("isLive", String(filters.isLive));
    if (filters?.userId) params.append("userId", filters.userId);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const queryString = params.toString();
    const path = queryString ? `${VIDEO_ROUTES.list}?${queryString}` : VIDEO_ROUTES.list;

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
        data: response.data?.data || [],
        pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
    }

    return {
      success: false,
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      error: response.error,
    };
  },

  /**
   * Get trending videos
   */
  async getTrending(limit: number = 10): Promise<ApiResponse<Video[]>> {
    return fetchJson<Video[]>(`${VIDEO_ROUTES.trending}?limit=${limit}`);
  },

  /**
   * Get popular videos
   */
  async getPopular(limit: number = 10): Promise<ApiResponse<Video[]>> {
    return fetchJson<Video[]>(`${VIDEO_ROUTES.popular}?limit=${limit}`);
  },

  /**
   * Get recommended videos for user
   */
  async getRecommended(limit: number = 10): Promise<ApiResponse<Video[]>> {
    return fetchJson<Video[]>(`${VIDEO_ROUTES.recommended}?limit=${limit}`);
  },

  /**
   * Get live videos
   */
  async getLive(): Promise<ApiResponse<Video[]>> {
    return fetchJson<Video[]>(VIDEO_ROUTES.live);
  },

  /**
   * Get video by ID
   */
  async getById(videoId: string): Promise<ApiResponse<Video | null>> {
    return fetchJson<Video>(VIDEO_ROUTES.get(videoId));
  },

  /**
   * Get video with full details
   */
  async getWithDetails(videoId: string): Promise<ApiResponse<VideoWithDetails | null>> {
    return fetchJson<VideoWithDetails>(`${VIDEO_ROUTES.get(videoId)}?include=author,comments,related`);
  },

  /**
   * Search videos
   */
  async search(query: string, filters?: Omit<VideoFilters, 'search'>): Promise<PaginatedResponse<Video>> {
    const params = new URLSearchParams({ q: query });
    if (filters?.category) params.append("category", filters.category);
    if (filters?.sortBy) params.append("sortBy", filters.sortBy);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const response = await fetchJson<{
      data: Video[];
      pagination: any;
    }>(`${VIDEO_ROUTES.search}?${params.toString()}`);

    return {
      success: response.success,
      data: response.data?.data || [],
      pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      error: response.error,
    };
  },

  /**
   * Get videos by user
   */
  async getByUser(userId: string, page: number = 1, limit: number = 10): Promise<PaginatedResponse<Video>> {
    const response = await fetchJson<{
      data: Video[];
      pagination: any;
    }>(`${VIDEO_ROUTES.byUser(userId)}?page=${page}&limit=${limit}`);

    return {
      success: response.success,
      data: response.data?.data || [],
      pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      error: response.error,
    };
  },

  /**
   * Upload a new video
   */
  async upload(videoData: UploadVideoData): Promise<ApiResponse<Video>> {
    return fetchJson<Video>(VIDEO_ROUTES.upload, {
      method: "POST",
      body: JSON.stringify(videoData),
    });
  },

  /**
   * Update video details
   */
  async update(videoId: string, data: Partial<UploadVideoData>): Promise<ApiResponse<Video>> {
    return fetchJson<Video>(VIDEO_ROUTES.update(videoId), {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a video
   */
  async delete(videoId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return fetchJson<{ deleted: boolean }>(VIDEO_ROUTES.delete(videoId), {
      method: "DELETE",
    });
  },

  /**
   * Like a video
   */
  async like(videoId: string): Promise<ApiResponse<{ likes: number; isLiked: boolean }>> {
    return fetchJson<{ likes: number; isLiked: boolean }>(VIDEO_ROUTES.like(videoId), {
      method: "POST",
    });
  },

  /**
   * Unlike a video
   */
  async unlike(videoId: string): Promise<ApiResponse<{ likes: number; isLiked: boolean }>> {
    return fetchJson<{ likes: number; isLiked: boolean }>(VIDEO_ROUTES.unlike(videoId), {
      method: "POST",
    });
  },

  /**
   * Bookmark a video
   */
  async bookmark(videoId: string): Promise<ApiResponse<{ isBookmarked: boolean }>> {
    return fetchJson<{ isBookmarked: boolean }>(VIDEO_ROUTES.bookmark(videoId), {
      method: "POST",
    });
  },

  /**
   * Remove bookmark from video
   */
  async removeBookmark(videoId: string): Promise<ApiResponse<{ isBookmarked: boolean }>> {
    return fetchJson<{ isBookmarked: boolean }>(VIDEO_ROUTES.bookmark(videoId), {
      method: "DELETE",
    });
  },

  /**
   * Toggle bookmark on video (convenience method)
   */
  async toggleBookmark(videoId: string): Promise<ApiResponse<Video>> {
    return fetchJson<Video>(VIDEO_ROUTES.bookmark(videoId), {
      method: "POST",
    });
  },

  /**
   * Get user's bookmarked videos
   */
  async getBookmarked(page: number = 1, limit: number = 20): Promise<ApiResponse<Video[]>> {
    return fetchJson<Video[]>(`${VIDEO_ROUTES.list}/bookmarked?page=${page}&limit=${limit}`);
  },

  /**
   * Increment view count
   */
  async incrementView(videoId: string): Promise<ApiResponse<{ views: number }>> {
    return fetchJson<{ views: number }>(VIDEO_ROUTES.incrementView(videoId), {
      method: "POST",
    });
  },

  /**
   * Get video comments
   */
  async getComments(videoId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<Comment>> {
    const response = await fetchJson<{
      data: Comment[];
      pagination: any;
    }>(`${VIDEO_ROUTES.comments(videoId)}?page=${page}&limit=${limit}`);

    return {
      success: response.success,
      data: response.data?.data || [],
      pagination: response.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
      error: response.error,
    };
  },

  /**
   * Add comment to video
   */
  async addComment(videoId: string, content: string): Promise<ApiResponse<Comment>> {
    return fetchJson<Comment>(VIDEO_ROUTES.comments(videoId), {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  },

  /**
   * Delete a comment from video
   */
  async deleteComment(videoId: string, commentId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return fetchJson<{ deleted: boolean }>(`${VIDEO_ROUTES.comments(videoId)}/${commentId}`, {
      method: "DELETE",
    });
  },

  /**
   * Get video analytics
   */
  async getAnalytics(videoId: string): Promise<ApiResponse<VideoAnalytics>> {
    return fetchJson<VideoAnalytics>(VIDEO_ROUTES.analytics(videoId));
  },

  /**
   * Get video statistics summary
   */
  async getStats(): Promise<ApiResponse<VideoStats>> {
    return fetchJson<VideoStats>("/api/videos/stats");
  },

  /**
   * Get video categories
   */
  async getCategories(): Promise<ApiResponse<string[]>> {
    return fetchJson<string[]>(VIDEO_ROUTES.categories);
  },

  // ============================================================================
  // VIDEO PREMIUM & LIMITS METHODS
  // ============================================================================

  /**
   * Get user's video premium limits
   */
  async getUserLimits(userId: string): Promise<ApiResponse<VideoPremiumLimits>> {
    return fetchJson<VideoPremiumLimits>(VIDEO_ROUTES.limits(userId));
  },

  /**
   * Validate upload before starting
   */
  async validateUpload(request: ValidateUploadRequest): Promise<ApiResponse<ValidateUploadResponse>> {
    return fetchJson<ValidateUploadResponse>(VIDEO_ROUTES.validateUpload, {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Start a livestream session
   */
  async startLivestream(request: StartLivestreamRequest): Promise<ApiResponse<LivestreamSessionResponse>> {
    return fetchJson<LivestreamSessionResponse>(VIDEO_ROUTES.livestreamStart, {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * End a livestream session
   */
  async endLivestream(request: EndLivestreamRequest): Promise<ApiResponse<{ success: boolean }>> {
    return fetchJson<{ success: boolean }>(VIDEO_ROUTES.livestreamEnd, {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Validate session duration (recording or livestream)
   */
  async validateSession(request: ValidateSessionRequest): Promise<ApiResponse<ValidateSessionResponse>> {
    return fetchJson<ValidateSessionResponse>(VIDEO_ROUTES.validateSession, {
      method: "POST",
      body: JSON.stringify(request),
    });
  },
};

export default videoApi;
