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

import { useAuthStore } from '@/utils/auth/store';

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || "https://delipucash-latest.vercel.app";
// Normalize to host-only base so `/api/*` routes are never doubled.
const API_BASE_URL = rawApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '');

const isAbsoluteUrl = (url: string): boolean => /^(https?:\/\/|blob:|data:)/i.test(url);

const toAbsoluteUrl = (url: string | null | undefined): string => {
  const value = (url || '').trim();
  if (!value) return '';
  if (isAbsoluteUrl(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `${API_BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
};

const normalizeVideo = (video: Video): Video => ({
  ...video,
  videoUrl: toAbsoluteUrl(video.videoUrl),
  thumbnail: toAbsoluteUrl(video.thumbnail),
});

const extractVideos = (payload: unknown): Video[] => {
  if (Array.isArray(payload)) return payload as Video[];
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as Video[];
  }
  return [];
};

const getPlayableVideos = (videos: Video[]): Video[] =>
  videos
    .map(normalizeVideo)
    .filter((video) => typeof video.videoUrl === 'string' && video.videoUrl.trim().length > 0);

/** Get current authenticated user ID from auth store */
const getCurrentUserId = (): string | null =>
  useAuthStore.getState().auth?.user?.id || null;

/** Get current auth token for protected API calls */
const getAuthToken = (): string | null =>
  useAuthStore.getState().auth?.token || null;

// API Routes — aligned with backend videoRoutes.mjs
const VIDEO_ROUTES = {
  list: "/api/videos/all",
  get: (id: string) => `/api/videos/${id}`,
  like: (id: string) => `/api/videos/${id}/like`,
  unlike: (id: string) => `/api/videos/${id}/unlike`,
  bookmark: (id: string) => `/api/videos/${id}/bookmark`,
  status: (id: string) => `/api/videos/${id}/status`,
  comments: (id: string) => `/api/videos/${id}/comments`,
  share: (id: string) => `/api/videos/${id}/share`,
  upload: "/api/videos/create",
  delete: (id: string) => `/api/videos/delete/${id}`,
  update: (id: string) => `/api/videos/update/${id}`,
  incrementView: (id: string) => `/api/videos/${id}/views`,
  byUser: (userId: string) => `/api/videos/user/${userId}`,
  // Video premium & limits
  limits: (userId: string) => `/api/videos/limits/${userId}`,
  validateUpload: "/api/videos/validate-upload",
  livestreamStart: "/api/videos/livestream/start",
  livestreamEnd: "/api/videos/livestream/end",
  livestreamJoin: (sessionId: string) => `/api/videos/livestream/${sessionId}/join`,
  livestreamLeave: (sessionId: string) => `/api/videos/livestream/${sessionId}/leave`,
  livestreamChat: (sessionId: string) => `/api/videos/livestream/${sessionId}/chat`,
  trending: "/api/videos/trending",
  following: "/api/videos/following",
  live: "/api/videos/live",
  validateSession: "/api/videos/validate-session",
  // 2026 Feed enhancement routes
  personalized: "/api/videos/personalized",
  searchDedicated: "/api/videos/search",
  feedback: "/api/videos/feedback",
  completion: (id: string) => `/api/videos/${id}/completion`,
  explore: "/api/videos/explore",
} as const;

// Follow graph routes — aligned with backend followRoutes.mjs
const FOLLOW_ROUTES = {
  follow: (creatorId: string) => `/api/follows/${creatorId}/follow`,
  unfollow: (creatorId: string) => `/api/follows/${creatorId}/unfollow`,
  status: (creatorId: string) => `/api/follows/${creatorId}/status`,
  counts: (userId: string) => `/api/follows/${userId}/counts`,
  followers: (userId: string) => `/api/follows/${userId}/followers`,
  following: (userId: string) => `/api/follows/${userId}/following`,
  block: (userId: string) => `/api/follows/${userId}/block`,
  unblock: (userId: string) => `/api/follows/${userId}/unblock`,
  blocked: '/api/follows/blocked',
} as const;

// Helper to fetch JSON with optional auth
async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  authToken?: string | null
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> || {}),
    };

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      ...init,
      headers,
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
  title?: string;
  description?: string;
  type?: 'livestream' | 'recording';
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

/** Livestream list item (from /api/videos/live) */
export interface LivestreamListItem {
  id: string;
  sessionId: string;
  title: string | null;
  description: string | null;
  status: string;
  viewerCount: number;
  peakViewerCount: number;
  startedAt: string | null;
  isPremium: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  } | null;
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
      const videos = getPlayableVideos(extractVideos(response.data));
      return {
        success: true,
        data: videos,
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
   * Refresh a single video's signed URLs by fetching from GET /api/videos/:id
   * Used when playback fails due to expired signed URLs (ExoPlayer source error).
   * Returns only the fresh videoUrl (and thumbnail), or null on failure.
   */
  async refreshVideoUrl(videoId: string): Promise<{ videoUrl: string; thumbnail: string } | null> {
    try {
      const token = getAuthToken();
      const response = await fetchJson<{ data: Video }>(VIDEO_ROUTES.get(videoId), undefined, token);
      if (response.success && response.data) {
        const raw = (response.data as any).data || response.data;
        const videoUrl = toAbsoluteUrl(raw.videoUrl);
        const thumbnail = toAbsoluteUrl(raw.thumbnail);
        if (videoUrl && videoUrl.length > 0) {
          return { videoUrl, thumbnail };
        }
      }
    } catch (err) {
      if (__DEV__) console.warn('[videoApi] refreshVideoUrl failed:', err);
    }
    return null;
  },

  /**
   * Get trending videos — dedicated /trending endpoint with time-decay scoring
   * Now supports pagination + localization
   */
  async getTrending(params: {
    page?: number;
    limit?: number;
    country?: string;
    language?: string;
  } = {}): Promise<ApiResponse<Video[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }> {
    const { page = 1, limit = 20, country, language } = params;
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (country) qs.append('country', country);
    if (language) qs.append('language', language);

    const response = await fetchJson<{ data: Video[]; pagination?: any }>(`${VIDEO_ROUTES.trending}?${qs.toString()}`);
    return {
      success: response.success,
      data: getPlayableVideos(extractVideos(response.data)),
      pagination: response.data?.pagination,
      error: response.error,
    };
  },

  /**
   * Get popular videos — alias for trending
   */
  async getPopular(limit: number = 10): Promise<ApiResponse<Video[]>> {
    return videoApi.getTrending({ limit });
  },

  /**
   * Get following videos — videos from creators the user has engaged with (liked/bookmarked)
   */
  async getFollowing(page: number = 1, limit: number = 15): Promise<ApiResponse<Video[]> & { pagination?: any }> {
    const response = await fetchJson<{ data: Video[]; pagination: any }>(
      `${VIDEO_ROUTES.following}?page=${page}&limit=${limit}`,
    );
    return {
      success: response.success,
      data: getPlayableVideos(extractVideos(response.data)),
      pagination: response.data && 'pagination' in (response as any) ? (response as any).pagination : undefined,
      error: response.error,
    };
  },

  /**
   * Get recommended videos — uses /all (no dedicated backend route)
   */
  async getRecommended(limit: number = 10): Promise<ApiResponse<Video[]>> {
    const response = await fetchJson<{ data: Video[] }>(`${VIDEO_ROUTES.list}?limit=${limit}`);
    return {
      success: response.success,
      data: getPlayableVideos(extractVideos(response.data)),
      error: response.error,
    };
  },

  /**
   * Get active livestreams from dedicated /live endpoint
   */
  async getLive(page: number = 1, limit: number = 20): Promise<ApiResponse<LivestreamListItem[]>> {
    const response = await fetchJson<{ data: LivestreamListItem[]; pagination: any }>(
      `${VIDEO_ROUTES.live}?page=${page}&limit=${limit}`
    );
    return {
      success: response.success,
      data: response.data?.data || [],
      error: response.error,
    };
  },

  /**
   * Get videos by user
   */
  async getByUser(userId: string, page: number = 1, limit: number = 10): Promise<PaginatedResponse<Video>> {
    const response = await fetchJson<{
      videos: Video[];
    }>(`${VIDEO_ROUTES.byUser(userId)}?page=${page}&limit=${limit}`);

    return {
      success: response.success,
      data: getPlayableVideos(response.data?.videos || []),
      pagination: { page, limit, total: 0, totalPages: 0 },
      error: response.error,
    };
  },

  /**
   * Search videos — uses /all with search param (no dedicated backend route)
   */
  async search(query: string, filters?: Omit<VideoFilters, 'search'>): Promise<PaginatedResponse<Video>> {
    const params = new URLSearchParams({ search: query });
    if (filters?.sortBy) params.append("sortBy", filters.sortBy);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const response = await fetchJson<{
      data: Video[];
      pagination: any;
    }>(`${VIDEO_ROUTES.list}?${params.toString()}`);

    return {
      success: response.success,
      data: getPlayableVideos(extractVideos(response.data)),
      pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      error: response.error,
    };
  },

  /**
   * Upload a new video — server derives userId from auth token
   */
  async upload(videoData: UploadVideoData): Promise<ApiResponse<Video>> {
    const response = await fetchJson<{ video: Video }>(VIDEO_ROUTES.upload, {
      method: "POST",
      body: JSON.stringify(videoData),
    }, getAuthToken());
    // Backend wraps in { message, video }
    return {
      success: response.success,
      data: normalizeVideo(response.data?.video || (response.data as Video)),
      error: response.error,
    };
  },

  /**
   * Update video details
   */
  async update(videoId: string, data: Partial<UploadVideoData>): Promise<ApiResponse<Video>> {
    return fetchJson<Video>(VIDEO_ROUTES.update(videoId), {
      method: "PUT",
      body: JSON.stringify(data),
    }, getAuthToken());
  },

  /**
   * Delete a video
   */
  async delete(videoId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return fetchJson<{ deleted: boolean }>(VIDEO_ROUTES.delete(videoId), {
      method: "DELETE",
    }, getAuthToken());
  },

  /**
   * Like a video — backend returns { message, video }
   */
  async like(videoId: string): Promise<ApiResponse<Video>> {
    const response = await fetchJson<{ video: Video }>(VIDEO_ROUTES.like(videoId), {
      method: "POST",
    }, getAuthToken());
    return {
      success: response.success,
      data: normalizeVideo(response.data?.video || (response.data as Video)),
      error: response.error,
    };
  },

  /**
   * Unlike a video — backend returns { message, video }
   */
  async unlike(videoId: string): Promise<ApiResponse<Video>> {
    const response = await fetchJson<{ video: Video }>(VIDEO_ROUTES.unlike(videoId), {
      method: "POST",
    }, getAuthToken());
    return {
      success: response.success,
      data: normalizeVideo(response.data?.video || (response.data as Video)),
      error: response.error,
    };
  },

  /**
   * Bookmark a video — server derives userId from auth token
   */
  async bookmark(videoId: string): Promise<ApiResponse<Video>> {
    const response = await fetchJson<{ video: Video }>(VIDEO_ROUTES.bookmark(videoId), {
      method: "POST",
    }, getAuthToken());
    return {
      success: response.success,
      data: normalizeVideo(response.data?.video || (response.data as Video)),
      error: response.error,
    };
  },

  /**
   * Get per-user like/bookmark status for a video
   */
  async getVideoStatus(videoId: string): Promise<ApiResponse<{ videoId: string; isLiked: boolean; isBookmarked: boolean }>> {
    return fetchJson<{ videoId: string; isLiked: boolean; isBookmarked: boolean }>(
      VIDEO_ROUTES.status(videoId),
      undefined,
      getAuthToken()
    );
  },

  /**
   * Increment view count
   */
  async incrementView(videoId: string): Promise<ApiResponse<{ views: number }>> {
    const response = await fetchJson<{ video: Video }>(VIDEO_ROUTES.incrementView(videoId), {
      method: "POST",
    });
    return { success: response.success, data: { views: response.data?.video?.views ?? 0 }, error: response.error };
  },

  /**
   * Share a video (track for analytics) — backend returns { success, data: { shared, platform, ... } }
   */
  async share(videoId: string, platform: string): Promise<ApiResponse<{ shared: boolean; platform: string }>> {
    const response = await fetchJson<{ data: { shared: boolean; platform: string } }>(VIDEO_ROUTES.share(videoId), {
      method: "POST",
      body: JSON.stringify({ platform }),
    }, getAuthToken());
    return { success: response.success, data: response.data?.data || { shared: true, platform }, error: response.error };
  },

  /**
   * Get video comments
   */
  async getComments(videoId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<Comment>> {
    const response = await fetchJson<{
      comments?: Comment[];
      data?: { comments?: Comment[]; pagination?: { page: number; limit: number; total: number; totalPages: number } };
    }>(`${VIDEO_ROUTES.comments(videoId)}?page=${page}&limit=${limit}`);

    const payload = response.data as any;
    const comments = payload?.data?.comments ?? payload?.comments ?? [];
    const serverPagination = payload?.data?.pagination;

    return {
      success: response.success,
      data: comments,
      pagination: serverPagination || { page, limit, total: comments.length, totalPages: 1 },
      error: response.error,
    };
  },

  /**
   * Add comment to video — server derives userId from auth token
   */
  async addComment(videoId: string, text: string): Promise<ApiResponse<Comment>> {
    const response = await fetchJson<{ comment: Comment }>(VIDEO_ROUTES.comments(videoId), {
      method: "POST",
      body: JSON.stringify({ text }),
    }, getAuthToken());
    // Backend wraps in { message, comment }
    return { success: response.success, data: response.data?.comment || (response.data as any), error: response.error };
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
    }, getAuthToken());
  },

  /**
   * End a livestream session
   */
  async endLivestream(request: EndLivestreamRequest): Promise<ApiResponse<{ success: boolean }>> {
    return fetchJson<{ success: boolean }>(VIDEO_ROUTES.livestreamEnd, {
      method: "POST",
      body: JSON.stringify(request),
    }, getAuthToken());
  },

  /**
   * Join a livestream as a viewer
   */
  async joinLivestream(sessionId: string): Promise<ApiResponse<{ viewerCount: number }>> {
    return fetchJson<{ viewerCount: number }>(VIDEO_ROUTES.livestreamJoin(sessionId), {
      method: "POST",
    }, getAuthToken());
  },

  /**
   * Leave a livestream
   */
  async leaveLivestream(sessionId: string): Promise<ApiResponse<{ viewerCount: number }>> {
    return fetchJson<{ viewerCount: number }>(VIDEO_ROUTES.livestreamLeave(sessionId), {
      method: "POST",
    }, getAuthToken());
  },

  /**
   * Send a chat message to a livestream
   */
  async sendLivestreamChat(sessionId: string, text: string): Promise<ApiResponse<{ messageId: string }>> {
    return fetchJson<{ messageId: string }>(VIDEO_ROUTES.livestreamChat(sessionId), {
      method: "POST",
      body: JSON.stringify({ text }),
    }, getAuthToken());
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

  // ============================================================================
  // 2026 FEED ENHANCEMENT METHODS
  // ============================================================================

  /**
   * Get personalized feed — ML-lite scoring based on user's telemetry signals
   * Falls back to recency-sorted for anonymous/cold-start users
   */
  async getPersonalized(params: {
    page?: number;
    limit?: number;
    excludeIds?: string[];
  } = {}): Promise<ApiResponse<Video[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }> {
    const { page = 1, limit = 15, excludeIds = [] } = params;
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (excludeIds.length > 0) {
      qs.append('exclude', JSON.stringify(excludeIds.slice(0, 200)));
    }

    const token = getAuthToken();
    const response = await fetchJson<{ data: Video[]; pagination?: any }>(
      `${VIDEO_ROUTES.personalized}?${qs.toString()}`,
      undefined,
      token,
    );
    return {
      success: response.success,
      data: getPlayableVideos(extractVideos(response.data)),
      pagination: response.data?.pagination,
      error: response.error,
    };
  },

  /**
   * Search videos — dedicated server-side search with relevance scoring
   */
  async searchServerSide(params: {
    query: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Video[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }> {
    const { query, page = 1, limit = 15 } = params;
    const qs = new URLSearchParams({ q: query, page: String(page), limit: String(limit) });
    const token = getAuthToken();

    const response = await fetchJson<{ data: Video[]; pagination?: any }>(
      `${VIDEO_ROUTES.searchDedicated}?${qs.toString()}`,
      undefined,
      token,
    );
    return {
      success: response.success,
      data: getPlayableVideos(extractVideos(response.data)),
      pagination: response.data?.pagination,
      error: response.error,
    };
  },

  /**
   * Submit video feedback — not interested, hide creator, report
   */
  async submitFeedback(params: {
    videoId: string;
    action: 'not_interested' | 'hide_creator' | 'hide_sound' | 'report';
    reason?: string;
  }): Promise<ApiResponse<{ feedbackId: string; action: string; creatorId?: string }>> {
    const token = getAuthToken();
    const response = await fetchJson<{ feedbackId: string; action: string; creatorId?: string }>(
      VIDEO_ROUTES.feedback,
      { method: 'POST', body: JSON.stringify(params) },
      token,
    );
    return {
      success: response.success,
      data: response.data,
      error: response.error,
    };
  },

  /**
   * Record video completion — increments completionsCount
   */
  async recordCompletion(videoId: string): Promise<ApiResponse<{ completionsCount: number }>> {
    const response = await fetchJson<{ completionsCount: number }>(
      VIDEO_ROUTES.completion(videoId),
      { method: 'POST' },
    );
    return {
      success: response.success,
      data: response.data,
      error: response.error,
    };
  },

  /**
   * Get explore videos — random diverse videos for feed blending
   */
  async getExplore(params: {
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<Video[]>> {
    const { page = 1, limit = 10 } = params;
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    const token = getAuthToken();

    const response = await fetchJson<{ data: Video[] }>(
      `${VIDEO_ROUTES.explore}?${qs.toString()}`,
      undefined,
      token,
    );
    return {
      success: response.success,
      data: getPlayableVideos(extractVideos(response.data)),
      error: response.error,
    };
  },

  // ============================================================================
  // STUB METHODS — no dedicated backend routes yet
  // These exist so videoHooks.ts compiles. Add backend routes to make them real.
  // ============================================================================

  /**
   * Get single video by ID — no dedicated GET /:id backend route
   * Fetches /all and filters client-side.
   * TODO: Add GET /api/videos/:id backend route for efficiency
   */
  async getById(videoId: string): Promise<ApiResponse<VideoWithDetails>> {
    const response = await fetchJson<{ data: Video[] }>(`${VIDEO_ROUTES.list}?limit=100`);
    if (!response.success) return { success: false, data: {} as VideoWithDetails, error: response.error };
    const videos = getPlayableVideos(extractVideos(response.data));
    const video = (Array.isArray(videos) ? videos : []).find((v: Video) => v.id === videoId);
    if (!video) return { success: false, data: {} as VideoWithDetails, error: 'Video not found' };
    return { success: true, data: video as VideoWithDetails };
  },

  /**
   * Toggle bookmark — alias for bookmark()
   */
  async toggleBookmark(videoId: string): Promise<ApiResponse<Video>> {
    return videoApi.bookmark(videoId);
  },

  /**
   * Delete a comment — no backend route yet
   * TODO: Add DELETE /api/videos/:id/comments/:commentId backend route
   */
  async deleteComment(_videoId: string, _commentId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return { success: false, data: { deleted: false }, error: 'Delete comment not yet supported by backend' };
  },

  /**
   * Get bookmarked videos — no dedicated backend route
   * TODO: Add GET /api/videos/bookmarked backend route
   */
  async getBookmarked(): Promise<ApiResponse<Video[]>> {
    return { success: false, data: [], error: 'Bookmarked videos endpoint not yet available' };
  },

  /**
   * Get video analytics — no backend route yet
   * TODO: Add analytics backend route
   */
  async getAnalytics(_videoId: string): Promise<ApiResponse<VideoAnalytics>> {
    return { success: false, data: {} as VideoAnalytics, error: 'Analytics not yet available' };
  },

  /**
   * Get overall video stats — no backend route yet
   * TODO: Add stats backend route
   */
  async getStats(): Promise<ApiResponse<VideoStats>> {
    return { success: false, data: {} as VideoStats, error: 'Stats not yet available' };
  },

  // ==========================================================================
  // FOLLOW GRAPH — Creator follow/unfollow + block management
  // ==========================================================================

  async followCreator(creatorId: string): Promise<ApiResponse<{ isFollowing: boolean; followId?: string }>> {
    const token = getAuthToken();
    if (!token) return { success: false, data: { isFollowing: false }, error: 'Authentication required' };
    const res = await fetch(toAbsoluteUrl(FOLLOW_ROUTES.follow(creatorId)), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    return { success: json.success ?? res.ok, data: json.data || { isFollowing: false }, error: json.message };
  },

  async unfollowCreator(creatorId: string): Promise<ApiResponse<{ isFollowing: boolean }>> {
    const token = getAuthToken();
    if (!token) return { success: false, data: { isFollowing: false }, error: 'Authentication required' };
    const res = await fetch(toAbsoluteUrl(FOLLOW_ROUTES.unfollow(creatorId)), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    return { success: json.success ?? res.ok, data: json.data || { isFollowing: false }, error: json.message };
  },

  async getFollowStatus(creatorId: string): Promise<ApiResponse<{ isFollowing: boolean; notificationsEnabled: boolean }>> {
    const token = getAuthToken();
    if (!token) return { success: false, data: { isFollowing: false, notificationsEnabled: false }, error: 'Authentication required' };
    const res = await fetch(toAbsoluteUrl(FOLLOW_ROUTES.status(creatorId)), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    return { success: json.success ?? res.ok, data: json.data || { isFollowing: false, notificationsEnabled: false }, error: json.message };
  },

  async getFollowCounts(userId: string): Promise<ApiResponse<{ followersCount: number; followingCount: number }>> {
    const res = await fetch(toAbsoluteUrl(FOLLOW_ROUTES.counts(userId)));
    const json = await res.json();
    return { success: json.success ?? res.ok, data: json.data || { followersCount: 0, followingCount: 0 }, error: json.message };
  },

  async blockUser(userId: string): Promise<ApiResponse<{ success: boolean }>> {
    const token = getAuthToken();
    if (!token) return { success: false, data: { success: false }, error: 'Authentication required' };
    const res = await fetch(toAbsoluteUrl(FOLLOW_ROUTES.block(userId)), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    return { success: json.success ?? res.ok, data: { success: json.success ?? res.ok }, error: json.message };
  },

  async unblockUser(userId: string): Promise<ApiResponse<{ success: boolean }>> {
    const token = getAuthToken();
    if (!token) return { success: false, data: { success: false }, error: 'Authentication required' };
    const res = await fetch(toAbsoluteUrl(FOLLOW_ROUTES.unblock(userId)), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    return { success: json.success ?? res.ok, data: { success: json.success ?? res.ok }, error: json.message };
  },
};

export default videoApi;
