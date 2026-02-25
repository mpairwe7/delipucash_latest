/**
 * API Service Layer
 * Centralized API routes and data fetching utilities
 * Uses REST API calls for all data operations - No mock data fallbacks
 */
import {
    Ad,
    ApiResponse,
    AppUser,
    Comment,
  LoginSession,
    Notification,
    NotificationsResponse,
    NotificationStats,
    PaginatedResponse,
  Payment,
    Question,
    Response,
    Reward,
    RewardAnswerResult,
  RewardQuestion,
  RewardQuestionType,
  AnswerMatchMode,
    Survey,
    Transaction,
    TransactionSummary,
    TransactionsResponse,
    UploadSurvey,
    UserStats,
    Video,
} from "@/types";
import { useAuthStore } from '@/utils/auth/store';
import { silentRefresh, isTokenExpiredResponse } from './tokenRefresh';

/** Get current authenticated user ID from auth store */
const getCurrentUserId = (): string | null =>
  useAuthStore.getState().auth?.user?.id || null;

/** Get current auth token for protected API calls */
const getAuthToken = (): string | null =>
  useAuthStore.getState().auth?.token || null;

/** Build auth header if token is available */
const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ===========================================
// API Configuration
// ===========================================

// Base API URL (host only). Request paths already include /api/*
// Default to the deployed API on Vercel. The Netlify frontend domain doesn't
// serve the backend, so falling back to it causes 503s/HTML responses that
// break JSON parsing. If you need a different API host, set
// EXPO_PUBLIC_API_URL in your env (e.g. https://delipucash-latest.vercel.app or
// http://localhost:3000/api).
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || "https://delipucash-latest.vercel.app";
const apiBaseUrl = rawApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '');

// Validate that API URL is configured
if (!rawApiUrl) {
  console.warn('[API] EXPO_PUBLIC_API_URL is not configured. API calls will fail.');
}

// API Version for future compatibility
const API_VERSION = "v1";
const API_VERSION_HEADER = "X-API-Version";
const CLIENT_VERSION_HEADER = "X-Client-Version";
const CLIENT_PLATFORM_HEADER = "X-Client-Platform";
const REQUEST_ID_HEADER = "X-Request-ID";

// Client info for debugging and analytics
const CLIENT_VERSION = "1.0.0"; // Should match app.json version
const CLIENT_PLATFORM = "expo-react-native";

/**
 * Generate a unique request ID for tracing
 */
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Get default headers for API requests
 * Includes versioning and client identification for future compatibility
 */
const getDefaultHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  [API_VERSION_HEADER]: API_VERSION,
  [CLIENT_VERSION_HEADER]: CLIENT_VERSION,
  [CLIENT_PLATFORM_HEADER]: CLIENT_PLATFORM,
  [REQUEST_ID_HEADER]: generateRequestId(),
  "Accept": "application/json",
});

async function fetchJson<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const url = `${apiBaseUrl}${path}`;

  // Separate headers from other init options so `...initRest` can't overwrite
  // the merged headers object. The `runtimeHeaders` parameter (auth token) takes
  // highest priority so a refreshed token always wins over stale init headers.
  const { headers: initHeaders, ...initRest } = init || {};
  const safeInitHeaders = (initHeaders && typeof initHeaders === 'object' && !Array.isArray(initHeaders))
    ? initHeaders as Record<string, string>
    : {};

  const doFetch = async (runtimeHeaders: Record<string, string>) => {
    return fetch(url, {
      ...initRest,
      headers: { ...getDefaultHeaders(), ...safeInitHeaders, ...runtimeHeaders },
    });
  };

  try {
    let response = await doFetch(getAuthHeaders());

    // If access token expired → silent refresh → retry once
    if (isTokenExpiredResponse(response.status)) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        // Retry with the fresh access token
        response = await doFetch({ Authorization: `Bearer ${refreshed.token}` });
      }
    }

    // 403 Forbidden = tampered / permanently invalid token (not just expired).
    // The server distinguishes 401 (expired, refreshable) from 403 (invalid, not
    // refreshable). Clear auth state so the user is redirected to login instead
    // of seeing cryptic "Request failed" errors on every screen.
    if (response.status === 403) {
      useAuthStore.getState().setAuth(null);
    }

    const json = await response.json();
    if (!response.ok) {
      return { success: false, data: json as T, error: json?.message || "Request failed" };
    }

    return { success: true, data: json as T };
  } catch (error) {
    return { success: false, data: {} as T, error: error instanceof Error ? error.message : "Network error" };
  }
}

// ===========================================
// HTTP Client (axios-like interface)
// ===========================================
export const api = {
  async get<T = any>(url: string, config?: { params?: Record<string, string> }): Promise<{ data: T }> {
    let fullUrl = url;
    if (config?.params) {
      const searchParams = new URLSearchParams(config.params);
      fullUrl = `${url}?${searchParams.toString()}`;
    }
    const response = await fetchJson<T>(fullUrl);
    if (!response.success) {
      throw new Error(response.error || 'Request failed');
    }
    return { data: response.data };
  },

  async post<T = any>(url: string, data?: any): Promise<{ data: T }> {
    const response = await fetchJson<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.success) {
      throw new Error(response.error || 'Request failed');
    }
    return { data: response.data };
  },

  async put<T = any>(url: string, data?: any): Promise<{ data: T }> {
    const response = await fetchJson<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.success) {
      throw new Error(response.error || 'Request failed');
    }
    return { data: response.data };
  },

  async patch<T = any>(url: string, data?: any): Promise<{ data: T }> {
    const response = await fetchJson<T>(url, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.success) {
      throw new Error(response.error || 'Request failed');
    }
    return { data: response.data };
  },

  async delete<T = any>(url: string): Promise<{ data: T }> {
    const response = await fetchJson<T>(url, {
      method: 'DELETE',
    });
    if (!response.success) {
      throw new Error(response.error || 'Request failed');
    }
    return { data: response.data };
  },
};

// ===========================================
// API Routes Configuration
// Maps to backend Express routes
// ===========================================

export const API_ROUTES = {
  // Auth - maps to /api/auth/*
  auth: {
    login: "/api/auth/signin",
    register: "/api/auth/signup",
    logout: "/api/auth/signout",
    forgotPassword: "/api/auth/forgot-password",
    resetPassword: "/api/auth/reset-password",
    refreshToken: "/api/auth/refresh-token",
    changePassword: "/api/auth/change-password",
    subscriptionStatus: (userId: string) => `/api/auth/${userId}/subscription-status`,
    surveySubscriptionStatus: (userId: string) => `/api/auth/${userId}/surveysubscription-status`,
    points: (userId: string) => `/api/auth/${userId}/points`,
    validateResetToken: "/api/auth/validate-reset-token",
    twoFactorSend: "/api/auth/two-factor/send",
    twoFactorVerifyLogin: "/api/auth/two-factor/verify-login",
    twoFactorToggle: "/api/auth/two-factor",
    twoFactorVerify: "/api/auth/two-factor/verify",
    twoFactorResend: "/api/auth/two-factor/resend",
  },
  // User - maps to /api/users/*
  user: {
    profile: "/api/users/profile",
    update: "/api/users/profile",
    stats: "/api/users/stats",
    sessions: "/api/users/login-activity",
    privacy: "/api/users/privacy",
    signoutAllDevices: "/api/users/signout-all-devices",
    deleteSession: (sessionId: string) => `/api/users/sessions/${sessionId}`,
  },
  // Videos
  videos: {
    list: "/api/videos/all",
    get: (id: string) => `/api/videos/${id}`,
    create: "/api/videos/create",
    like: (id: string) => `/api/videos/${id}/like`,
    bookmark: (id: string) => `/api/videos/${id}/bookmark`,
    comments: (id: string) => `/api/videos/${id}/comments`,
    trending: "/api/videos/trending",
    popular: "/api/videos/popular",
  },
  // Surveys
  surveys: {
    list: "/api/surveys/all",
    get: (id: string) => `/api/surveys/${id}`,
    questions: (id: string) => `/api/surveys/${id}/questions`,
    submit: (id: string) => `/api/surveys/${id}/responses`,
    create: "/api/surveys/upload",
    createDraft: "/api/surveys/create",
    byStatus: (status: string) => `/api/surveys/status/${status}`,
    responses: (id: string) => `/api/surveys/${id}/responses`,
  },
  // Questions
  questions: {
    list: "/api/questions",
    all: "/api/questions/all",
    get: (id: string) => `/api/questions/${id}`,
    create: "/api/questions/create",
    responses: (id: string) => `/api/questions/${id}/responses`,
    submitResponse: (id: string) => `/api/questions/${id}/responses`,
    vote: (id: string) => `/api/questions/${id}/vote`,
  },
  // Responses
  responses: {
    like: (id: string) => `/api/responses/${id}/like`,
    dislike: (id: string) => `/api/responses/${id}/dislike`,
    reply: (id: string) => `/api/responses/${id}/reply`,
  },
  // Transactions
  transactions: {
    list: "/api/transactions",
    summary: "/api/transactions/summary",
    get: (id: string) => `/api/transactions/${id}`,
  },
  // Payments
  payments: {
    list: "/api/payments",
    create: "/api/payments",
    withdraw: "/api/payments/withdraw",
  },
  // Notifications
  notifications: {
    list: "/api/notifications",
    stats: "/api/notifications/stats",
    markRead: (id: string) => `/api/notifications/${id}/read`,
    markAllRead: "/api/notifications/read-all",
    archive: (id: string) => `/api/notifications/${id}/archive`,
    delete: (id: string) => `/api/notifications/${id}`,
    unreadCount: "/api/notifications/unread-count",
  },
  // Rewards
  rewards: {
    list: "/api/rewards",
    questions: "/api/reward-questions/all",
    regularQuestions: "/api/reward-questions/regular",
    instantQuestions: "/api/reward-questions/instant",
    question: (id: string) => `/api/reward-questions/${id}`,
    submitAnswer: (id: string) => `/api/reward-questions/${id}/answer`,
    createQuestion: "/api/reward-questions/create",
    claim: (id: string) => `/api/rewards/${id}/claim`,
    daily: "/api/rewards/daily",
    redeem: "/api/rewards/redeem",
  },
  // Ads
  ads: {
    list: "/api/ads/all",
    get: (id: string) => `/api/ads/${id}`,
    click: (id: string) => `/api/ads/${id}/click`,
    impression: (id: string) => `/api/ads/${id}/impression`,
  },
} as const;

// ===========================================
// User API
// Integrates with backend REST API
// Backend routes: /api/users/* and /api/auth/*
// ===========================================
export const userApi = {
  /**
   * Get current user profile
   * Backend: GET /api/users/profile (requires auth token)
   * Server returns { success, data: AppUser } — unwrap the nested data.
   */
  async getProfile(): Promise<ApiResponse<AppUser>> {
    const response = await fetchJson<{ data: AppUser }>(API_ROUTES.user.profile, {
      headers: getAuthHeaders(),
    });
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.error };
  },

  /**
   * Update user profile
   * Backend: PUT /api/users/profile (requires auth token)
   * Server returns { success, data: AppUser } — unwrap the nested data.
   */
  async updateProfile(data: Partial<AppUser>): Promise<ApiResponse<AppUser>> {
    const response = await fetchJson<{ data: AppUser }>(API_ROUTES.user.update, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.error };
  },

  /**
   * Get user statistics
   * Backend: GET /api/users/stats
   * Server returns { success, data: UserStats } — unwrap the nested data.
   */
  async getStats(): Promise<ApiResponse<UserStats>> {
    const response = await fetchJson<{ data: UserStats }>(API_ROUTES.user.stats, {
      headers: getAuthHeaders(),
    });
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.error };
  },

  /**
   * Get user by ID
   * Backend: GET /api/users/:userId
   * Server returns { success, data: AppUser } — unwrap the nested data.
   */
  async getById(userId: string): Promise<ApiResponse<AppUser | null>> {
    const response = await fetchJson<{ data: AppUser }>(`/api/users/${userId}`, {
      headers: getAuthHeaders(),
    });
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.error };
  },

  /**
   * Get user login sessions
   * Backend: GET /api/users/login-activity (requires auth token)
   * Server returns { success, data: [...] } — unwrap the nested data.
   */
  async getSessions(): Promise<ApiResponse<LoginSession[]>> {
    const response = await fetchJson<any>(API_ROUTES.user.sessions, {
      headers: getAuthHeaders(),
    });
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.data?.error || response.error };
  },

  /**
   * Revoke a login session
   * Backend: POST /api/users/sessions/:sessionId/revoke
   * Server returns { success, data: {...} } — unwrap the nested data.
   */
  async revokeSession(sessionId: string): Promise<ApiResponse<{ revoked: boolean }>> {
    const response = await fetchJson<any>(`/api/users/sessions/${sessionId}/revoke`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.data?.error || response.error };
  },

  /**
   * Toggle 2FA settings (enable/disable)
   * Backend: PUT /api/auth/two-factor
   * Server returns { success, data: {...} } — unwrap the nested data.
   */
  async updateTwoFactor(enabled: boolean, password?: string, code?: string): Promise<ApiResponse<{
    enabled?: boolean;
    codeSent?: boolean;
    email?: string;
    expiresIn?: number;
    token?: string;
    refreshToken?: string;
  }>> {
    const response = await fetchJson<any>('/api/auth/two-factor', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ enabled, password, code }),
    });
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.data?.error || response.error };
  },

  /**
   * Verify 2FA code to complete enabling 2FA
   * Backend: POST /api/auth/two-factor/verify
   * Server returns { success, data: { enabled } } — unwrap the nested data.
   */
  async verify2FACode(code: string): Promise<ApiResponse<{ enabled: boolean; token?: string; refreshToken?: string }>> {
    const response = await fetchJson<any>('/api/auth/two-factor/verify', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code }),
    });
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.data?.error || response.error };
  },

  /**
   * Resend 2FA verification code
   * Backend: POST /api/auth/two-factor/resend
   * Server returns { success, data: {...} } — unwrap the nested data.
   */
  async resend2FACode(): Promise<ApiResponse<{ codeSent: boolean; email: string; expiresIn: number }>> {
    const response = await fetchJson<any>('/api/auth/two-factor/resend', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.data?.error || response.error };
  },

  /**
   * Change password
   * Backend: PUT /api/auth/change-password (requires auth token)
   * Server returns { success, data: {...} } — unwrap the nested data.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<{ token?: string; refreshToken?: string }>> {
    const response = await fetchJson<any>(API_ROUTES.auth.changePassword, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.data?.error || response.error };
  },

  /**
   * Update privacy settings
   * Backend: PUT /api/users/privacy (requires auth token)
   * Server returns { success, data: {...} } — unwrap the nested data.
   */
  async updatePrivacySettings(settings: { shareProfile: boolean; shareActivity: boolean }): Promise<ApiResponse<{ shareProfile: boolean; shareActivity: boolean }>> {
    const response = await fetchJson<any>(API_ROUTES.user.privacy, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.data?.error || response.error };
  },

  /**
   * Get privacy settings
   * Backend: GET /api/users/privacy (requires auth token)
   * Server returns { success, data: {...} } — unwrap the nested data.
   */
  async getPrivacySettings(): Promise<ApiResponse<{ shareProfile: boolean; shareActivity: boolean }>> {
    const response = await fetchJson<any>(API_ROUTES.user.privacy, {
      headers: getAuthHeaders(),
    });
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.data?.error || response.error };
  },
};

// ===========================================
// Videos API
// ===========================================
export const videosApi = {
  /**
   * Get all videos
   */
  async getAll(params?: { page?: number; limit?: number; category?: string }): Promise<PaginatedResponse<Video>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.category) searchParams.append('category', params.category);
    
    const queryString = searchParams.toString();
    const path = queryString ? `${API_ROUTES.videos.list}?${queryString}` : API_ROUTES.videos.list;
    
    const response = await fetchJson<{ data: Video[]; pagination: any }>(path);
    return {
      success: response.success,
      data: response.data?.data || [],
      pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      error: response.error,
    };
  },

  /**
   * Get video by ID
   */
  async getById(videoId: string): Promise<ApiResponse<Video | null>> {
    return fetchJson<Video>(API_ROUTES.videos.get(videoId));
  },

  /**
   * Get trending videos — no dedicated backend route, uses /all?sortBy=popular
   */
  async getTrending(limit: number = 10): Promise<ApiResponse<Video[]>> {
    const response = await fetchJson<{ data: Video[] }>(`${API_ROUTES.videos.list}?sortBy=popular&limit=${limit}`);
    return { success: response.success, data: response.data?.data || (response.data as any) || [], error: response.error };
  },

  /**
   * Get live videos — uses /all with isLive filter (no dedicated backend route)
   */
  async getLive(): Promise<ApiResponse<Video[]>> {
    const response = await fetchJson<{ data: Video[] }>(`${API_ROUTES.videos.list}?isLive=true`);
    return { success: response.success, data: response.data?.data || (response.data as any) || [], error: response.error };
  },

  /**
   * Get recommended videos — uses /all (no dedicated backend route)
   */
  async getRecommended(limit: number = 10): Promise<ApiResponse<Video[]>> {
    const response = await fetchJson<{ data: Video[] }>(`${API_ROUTES.videos.list}?limit=${limit}`);
    return { success: response.success, data: response.data?.data || (response.data as any) || [], error: response.error };
  },

  /**
   * Like a video — backend returns { message, video }
   */
  async like(videoId: string): Promise<ApiResponse<Video>> {
    const response = await fetchJson<{ video: Video }>(API_ROUTES.videos.like(videoId), {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return { success: response.success, data: response.data?.video || (response.data as any), error: response.error };
  },

  /**
   * Unlike a video — backend returns { message, video }
   */
  async unlike(videoId: string): Promise<ApiResponse<Video>> {
    const response = await fetchJson<{ video: Video }>(`/api/videos/${videoId}/unlike`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return { success: response.success, data: response.data?.video || (response.data as any), error: response.error };
  },

  /**
   * Share a video — backend returns { success, data: { shared, platform, ... } }
   */
  async share(videoId: string, platform: string): Promise<ApiResponse<{ shared: boolean }>> {
    const response = await fetchJson<{ data: { shared: boolean } }>(`/api/videos/${videoId}/share`, {
      method: 'POST',
      body: JSON.stringify({ platform, userId: getCurrentUserId() }),
    });
    return { success: response.success, data: response.data?.data || { shared: true }, error: response.error };
  },

  /**
   * Bookmark a video — requires userId, backend returns { message, video }
   */
  async bookmark(videoId: string): Promise<ApiResponse<Video>> {
    const response = await fetchJson<{ video: Video }>(API_ROUTES.videos.bookmark(videoId), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId: getCurrentUserId() }),
    });
    return { success: response.success, data: response.data?.video || (response.data as any), error: response.error };
  },

  /**
   * Get video comments — supports both:
   * - { comments: [...] }
   * - { data: { comments: [...] } }
   */
  async getComments(videoId: string): Promise<ApiResponse<Comment[]>> {
    const response = await fetchJson<{ comments?: Comment[]; data?: { comments?: Comment[] } }>(
      API_ROUTES.videos.comments(videoId)
    );
    const payload = response.data as any;
    const comments = payload?.data?.comments ?? payload?.comments ?? [];
    return { success: response.success, data: comments, error: response.error };
  },

  /**
   * Add comment to video — backend expects { text, user_id, created_at }
   */
  async addComment(videoId: string, content: string, mediaUrls?: string[]): Promise<ApiResponse<Comment>> {
    const response = await fetchJson<{ comment: Comment }>(API_ROUTES.videos.comments(videoId), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text: content, user_id: getCurrentUserId(), media: mediaUrls || [], created_at: new Date().toISOString() }),
    });
    // Backend wraps in { message, comment }
    return { success: response.success, data: response.data?.comment || (response.data as any), error: response.error };
  },

  /**
   * Upload a video
   */
  async upload(data: { title: string; description?: string; videoUrl: string; thumbnail: string; duration?: number }): Promise<ApiResponse<Video>> {
    return fetchJson<Video>(API_ROUTES.videos.create, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Search videos
   */
  async search(query: string): Promise<ApiResponse<Video[]>> {
    return fetchJson<Video[]>(`${API_ROUTES.videos.list}?search=${encodeURIComponent(query)}`);
  },

  /**
   * Increment video view count
   */
  async incrementView(videoId: string): Promise<ApiResponse<Video>> {
    return fetchJson<Video>(`/api/videos/${videoId}/views`, { method: 'POST' });
  },
};

// ===========================================
// Surveys API
// ===========================================
export const surveysApi = {
  /**
   * Get all surveys
   */
  async getAll(params?: { status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Survey>> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));

    const queryString = searchParams.toString();
    const path = queryString ? `${API_ROUTES.surveys.list}?${queryString}` : API_ROUTES.surveys.list;

    const response = await fetchJson<{ data: Survey[]; pagination: any }>(path);
    return {
      success: response.success,
      data: response.data?.data || response.data || [],
      pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      error: response.error,
    };
  },

  /**
   * Get running surveys
   */
  async getRunning(): Promise<ApiResponse<Survey[]>> {
    return fetchJson<Survey[]>(API_ROUTES.surveys.byStatus('running'));
  },

  /**
   * Get upcoming surveys
   */
  async getUpcoming(): Promise<ApiResponse<Survey[]>> {
    return fetchJson<Survey[]>(API_ROUTES.surveys.byStatus('upcoming'));
  },

  /**
   * Get completed surveys
   */
  async getCompleted(): Promise<ApiResponse<Survey[]>> {
    return fetchJson<Survey[]>(API_ROUTES.surveys.byStatus('completed'));
  },

  /**
   * Get survey by ID
   */
  async getById(surveyId: string): Promise<ApiResponse<Survey | null>> {
    return fetchJson<Survey>(API_ROUTES.surveys.get(surveyId));
  },

  /**
   * Get survey questions
   */
  async getQuestions(surveyId: string): Promise<ApiResponse<UploadSurvey[]>> {
    return fetchJson<UploadSurvey[]>(API_ROUTES.surveys.questions(surveyId));
  },

  /**
   * Check if user has already attempted survey
   */
  async checkAttempt(surveyId: string, userId: string): Promise<ApiResponse<{ hasAttempted: boolean; attemptedAt: string | null }>> {
    return fetchJson<{ hasAttempted: boolean; attemptedAt: string | null }>(`${API_ROUTES.surveys.get(surveyId)}/attempt?userId=${userId}`);
  },

  /**
   * Submit survey response
   * Backend extracts userId from JWT token (auth header auto-included)
   */
  async submit(surveyId: string, responses: Record<string, any>): Promise<ApiResponse<{ reward: number; message: string }>> {
    return fetchJson<{ reward: number; message: string }>(API_ROUTES.surveys.submit(surveyId), {
      method: 'POST',
      body: JSON.stringify({ responses }),
    });
  },

  /**
   * Submit survey response (alias)
   */
  async submitResponse(surveyId: string, answers: Record<string, any>): Promise<ApiResponse<{ submitted: boolean; reward?: number }>> {
    return fetchJson<{ submitted: boolean; reward?: number }>(API_ROUTES.surveys.submit(surveyId), {
      method: 'POST',
      body: JSON.stringify({ responses: answers }),
    });
  },

  /**
   * Create a new survey
   */
  async create(surveyData: Partial<Survey> & { questions?: Partial<UploadSurvey>[] }): Promise<ApiResponse<Survey>> {
    return fetchJson<Survey>(API_ROUTES.surveys.create, {
      method: 'POST',
      body: JSON.stringify({ ...surveyData, userId: getCurrentUserId() }),
    });
  },

  /**
   * Get survey responses
   */
  async getResponses(surveyId: string): Promise<ApiResponse<any[]>> {
    return fetchJson<any[]>(API_ROUTES.surveys.responses(surveyId));
  },

  /**
   * Delete a survey
   */
  async delete(surveyId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return fetchJson<{ deleted: boolean }>(API_ROUTES.surveys.get(surveyId), {
      method: 'DELETE',
    });
  },
};

// ===========================================
// Questions API
// ===========================================
/**
 * @deprecated Unused — question data is fetched by `questionHooks.ts` which
 * uses its own `fetchJson` with unified query keys, retry logic, and timeout.
 * Kept for backwards compatibility; prefer `useInfiniteQuestionsFeed`,
 * `useQuestionDetail`, `useSubmitQuestionResponse`, etc. from `questionHooks.ts`.
 */
export const questionsApi = {
  /**
   * Get all questions
   */
  async getAll(params?: { page?: number; limit?: number; category?: string }): Promise<PaginatedResponse<Question>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.category) searchParams.append('category', params.category);

    const queryString = searchParams.toString();
    const path = queryString ? `${API_ROUTES.questions.all}?${queryString}` : API_ROUTES.questions.all;
    
    const response = await fetchJson<{ data: Question[]; pagination: any }>(path);
    return {
      success: response.success,
      data: response.data?.data || response.data || [],
      pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      error: response.error,
    };
  },

  /**
   * Get recent questions
   */
  async getRecent(limit: number = 10): Promise<ApiResponse<Question[]>> {
    return fetchJson<Question[]>(`${API_ROUTES.questions.list}/recent?limit=${limit}`);
  },

  /**
   * Get instant reward questions
   */
  async getInstantReward(): Promise<ApiResponse<Question[]>> {
    return fetchJson<Question[]>(`${API_ROUTES.questions.list}/instant-reward`);
  },

  /**
   * Get question by ID
   */
  async getById(questionId: string): Promise<ApiResponse<Question | null>> {
    return fetchJson<Question>(API_ROUTES.questions.get(questionId));
  },

  /**
   * Get responses for a question
   */
  async getResponses(questionId: string): Promise<ApiResponse<Response[]>> {
    return fetchJson<Response[]>(API_ROUTES.questions.responses(questionId));
  },

  /**
   * Submit response to a question
   */
  async submitResponse(questionId: string, responseText: string): Promise<ApiResponse<Response>> {
    return fetchJson<Response>(API_ROUTES.questions.submitResponse(questionId), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ responseText, userId: getCurrentUserId() }),
    });
  },

  /**
   * Create a new question
   */
  async create(questionData: {
    text: string;
    category?: string;
    rewardAmount?: number;
    isInstantReward?: boolean;
  }): Promise<ApiResponse<Question>> {
    return fetchJson<Question>(API_ROUTES.questions.create, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...questionData, userId: getCurrentUserId() }),
    });
  },

  /**
   * Vote on a question
   */
  async vote(questionId: string, type: 'up' | 'down'): Promise<ApiResponse<Question>> {
    return fetchJson<Question>(API_ROUTES.questions.vote(questionId), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ type, userId: getCurrentUserId() }),
    });
  },

  /**
   * Get question categories
   */
  async getCategories(): Promise<ApiResponse<string[]>> {
    return fetchJson<string[]>('/api/questions/categories');
  },
};

// ===========================================
// Responses API
// ===========================================
export const responsesApi = {
  /**
   * Like or unlike a response (toggle)
   * @param isLiked true to add like, false to remove like
   */
  async like(responseId: string, isLiked: boolean = true): Promise<ApiResponse<Response>> {
    return fetchJson<Response>(API_ROUTES.responses.like(responseId), {
      method: 'POST',
      body: JSON.stringify({ userId: getCurrentUserId(), isLiked }),
    });
  },

  /**
   * Dislike or remove dislike from a response (toggle)
   * @param isDisliked true to add dislike, false to remove dislike
   */
  async dislike(responseId: string, isDisliked: boolean = true): Promise<ApiResponse<Response>> {
    return fetchJson<Response>(API_ROUTES.responses.dislike(responseId), {
      method: 'POST',
      body: JSON.stringify({ userId: getCurrentUserId(), isDisliked }),
    });
  },

  /**
   * Reply to a response
   */
  async reply(responseId: string, replyText: string): Promise<ApiResponse<any>> {
    return fetchJson<any>(API_ROUTES.responses.reply(responseId), {
      method: 'POST',
      body: JSON.stringify({ replyText, userId: getCurrentUserId() }),
    });
  },
};

// ===========================================
// Transactions API
// ===========================================
export const transactionsApi = {
  /**
   * Get user transactions (unified, paginated)
   * Server returns { success, data: { transactions, pagination, summary? } }
   * — unwrap the nested `data` to match the `TransactionsResponse` shape.
   */
  async getAll(params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<TransactionsResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.type && params.type !== 'all') searchParams.append('type', params.type);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);

    const queryString = searchParams.toString();
    const path = queryString
      ? `${API_ROUTES.transactions.list}?${queryString}`
      : API_ROUTES.transactions.list;

    const response = await fetchJson<{ data: TransactionsResponse }>(path);
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.error };
  },

  /**
   * Get lightweight transaction summary (wallet card)
   * Server returns { success, data: { totalEarned, ... } } — unwrap nested data.
   */
  async getSummary(): Promise<ApiResponse<TransactionSummary>> {
    const response = await fetchJson<{ data: TransactionSummary }>(API_ROUTES.transactions.summary);
    return { success: response.success, data: response.data?.data ?? (response.data as any), error: response.error };
  },

  /**
   * Get transaction by ID
   */
  async getById(transactionId: string): Promise<ApiResponse<Transaction | null>> {
    return fetchJson<Transaction>(API_ROUTES.transactions.get(transactionId));
  },
};

// ===========================================
// Payments API
// ===========================================
export const paymentsApi = {
  /**
   * Get user payments
   */
  async getAll(): Promise<ApiResponse<Payment[]>> {
    return fetchJson<Payment[]>(API_ROUTES.payments.list);
  },

  /**
   * Create payment
   */
  async create(paymentData: {
    amount: number;
    type: string;
    provider: string;
  }): Promise<ApiResponse<Payment>> {
    return fetchJson<Payment>(API_ROUTES.payments.create, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },

  /**
   * Request withdrawal
   */
  async withdraw(data: {
    amount: number;
    provider: string;
    phoneNumber?: string;
    accountDetails?: Record<string, string>;
  }): Promise<ApiResponse<Payment>> {
    return fetchJson<Payment>(API_ROUTES.payments.withdraw, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ===========================================
// Notifications API
// ===========================================
export const notificationsApi = {
  /**
   * Get user notifications with server-side filtering and pagination.
   * Returns full NotificationsResponse shape (notifications + pagination + summary).
   */
  async getAll(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    category?: string;
    type?: string;
    priority?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<ApiResponse<NotificationsResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.unreadOnly) searchParams.append('unreadOnly', 'true');
    if (params?.category) searchParams.append('category', params.category);
    if (params?.type) searchParams.append('type', params.type);
    if (params?.priority) searchParams.append('priority', params.priority);
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);

    const queryString = searchParams.toString();
    const path = queryString
      ? `${API_ROUTES.notifications.list}?${queryString}`
      : API_ROUTES.notifications.list;

    const response = await fetchJson<{
      data: Notification[];
      pagination: NotificationsResponse['pagination'];
      summary: NotificationsResponse['summary'];
    }>(path, { headers: getAuthHeaders() });

    return {
      success: response.success,
      data: {
        notifications: response.data?.data ?? (response.data as any) ?? [],
        pagination: response.data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 },
        summary: response.data?.summary,
      },
      error: response.error,
    };
  },

  /**
   * Get notification statistics (lightweight — no list payload).
   */
  async getStats(): Promise<ApiResponse<NotificationStats>> {
    return fetchJson<NotificationStats>(API_ROUTES.notifications.stats, {
      headers: getAuthHeaders(),
    });
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    return fetchJson<{ count: number }>(API_ROUTES.notifications.unreadCount, {
      headers: getAuthHeaders(),
    });
  },

  /**
   * Mark notification as read
   */
  async markRead(notificationId: string): Promise<ApiResponse<Notification>> {
    return fetchJson<Notification>(API_ROUTES.notifications.markRead(notificationId), {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },

  /**
   * Mark all notifications as read
   */
  async markAllRead(): Promise<ApiResponse<{ updated: number }>> {
    return fetchJson<{ updated: number }>(API_ROUTES.notifications.markAllRead, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },

  /**
   * Archive notification
   */
  async archive(notificationId: string): Promise<ApiResponse<Notification>> {
    return fetchJson<Notification>(API_ROUTES.notifications.archive(notificationId), {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
  },

  /**
   * Delete notification
   */
  async delete(notificationId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return fetchJson<{ deleted: boolean }>(API_ROUTES.notifications.delete(notificationId), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },
};

// ===========================================
// Rewards API
// ===========================================
export const rewardsApi = {
  /**
   * Get user rewards
   */
  async getAll(): Promise<ApiResponse<Reward[]>> {
    return fetchJson<Reward[]>(API_ROUTES.rewards.list);
  },

  /**
   * Get reward questions
   */
  async getQuestions(): Promise<ApiResponse<RewardQuestion[]>> {
    return fetchJson<RewardQuestion[]>(API_ROUTES.rewards.questions);
  },

  /**
   * Get regular (non-instant) reward questions (server-side filtered, paginated)
   */
  async getRegularQuestions(page = 1, limit = 20): Promise<ApiResponse<{ rewardQuestions: RewardQuestion[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean } }>> {
    return fetchJson(`${API_ROUTES.rewards.regularQuestions}?page=${page}&limit=${limit}`);
  },

  /**
   * Get instant reward questions (server-side filtered, paginated)
   */
  async getInstantQuestions(page = 1, limit = 20): Promise<ApiResponse<{ instantRewardQuestions: RewardQuestion[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean } }>> {
    return fetchJson(`${API_ROUTES.rewards.instantQuestions}?page=${page}&limit=${limit}`);
  },

  /**
   * Get reward question by ID
   */
  async getQuestionById(questionId: string): Promise<ApiResponse<RewardQuestion | null>> {
    return fetchJson<RewardQuestion>(API_ROUTES.rewards.question(questionId));
  },

  /**
   * Submit answer to reward question
   */
  async submitAnswer(questionId: string, answer: string, phoneNumber?: string, userEmail?: string): Promise<ApiResponse<RewardAnswerResult>> {
    return fetchJson<RewardAnswerResult>(API_ROUTES.rewards.submitAnswer(questionId), {
      method: 'POST',
      body: JSON.stringify({ selectedAnswer: answer, phoneNumber, userEmail, rewardQuestionId: questionId }),
    });
  },

  /**
   * Claim a reward
   */
  async claim(rewardId: string): Promise<ApiResponse<Reward>> {
    return fetchJson<Reward>(API_ROUTES.rewards.claim(rewardId), { method: 'POST' });
  },

  /**
   * Get daily reward
   */
  async claimDaily(): Promise<ApiResponse<{ reward: number; streak: number }>> {
    return fetchJson<{ reward: number; streak: number }>(API_ROUTES.rewards.daily, { method: 'POST' });
  },

  /**
   * Redeem rewards — convert points to cash/airtime via mobile money
   * @param idempotencyKey Unique key to prevent duplicate redemptions on retry
   */
  async redeem(
    params: {
      cashValue?: number;
      pointsToRedeem?: number;
      provider: string;
      phoneNumber: string;
      type: string;
      idempotencyKey?: string;
    },
  ): Promise<ApiResponse<{ success: boolean; transactionRef?: string; message?: string; error?: string }>> {
    const { cashValue, pointsToRedeem, provider, phoneNumber, type, idempotencyKey } = params;
    return fetchJson(API_ROUTES.rewards.redeem, {
      method: 'POST',
      body: JSON.stringify({
        ...(pointsToRedeem ? { pointsToRedeem } : { cashValue }),
        provider, phoneNumber, type, idempotencyKey,
      }),
    });
  },

  /**
   * Create a reward question
   */
  async createRewardQuestion(data: {
    text: string;
    options: string[] | Record<string, string> | { placeholder?: string; hint?: string; maxLength?: number };
    correctAnswer: string;
    rewardAmount: number;
    expiryTime?: string;
    userId?: string;
    isInstantReward?: boolean;
    maxWinners?: number;
    paymentProvider?: string;
    phoneNumber?: string;
    questionType?: RewardQuestionType;
    matchMode?: AnswerMatchMode;
  }): Promise<ApiResponse<RewardQuestion>> {
    const response = await fetchJson<{ message: string; rewardQuestion: RewardQuestion }>(API_ROUTES.rewards.createQuestion, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { success: response.success, data: response.data?.rewardQuestion ?? (response.data as any), error: response.error };
  },

  /**
   * Bulk create reward questions
   */
  async bulkCreateQuestions(questions: {
    text: string;
    options: string[] | Record<string, string>;
    correctAnswer?: string | string[];
    category?: string;
    rewardAmount?: number;
    type?: 'single_choice' | 'multiple_choice' | 'boolean' | 'text' | 'checkbox';
    difficulty?: 'easy' | 'medium' | 'hard';
    explanation?: string;
    timeLimit?: number;
    pointValue?: number;
  }[], userId: string): Promise<ApiResponse<{ created: number; failed: number; questions: RewardQuestion[] }>> {
    return fetchJson<{ created: number; failed: number; questions: RewardQuestion[] }>('/api/reward-questions/bulk', {
      method: 'POST',
      body: JSON.stringify({ questions, userId }),
    });
  },

  /**
   * Upload bulk reward questions (alias for bulkCreateQuestions)
   */
  async uploadBulkQuestions(questions: {
    text: string;
    options: string[] | Record<string, string>;
    correctAnswer?: string | string[];
    category?: string;
    rewardAmount?: number;
    type?: 'single_choice' | 'multiple_choice' | 'boolean' | 'text' | 'checkbox';
    difficulty?: 'easy' | 'medium' | 'hard';
    explanation?: string;
    timeLimit?: number;
    pointValue?: number;
  }[], userId: string): Promise<ApiResponse<{ created: number; failed: number; questions: RewardQuestion[] }>> {
    return fetchJson<{ created: number; failed: number; questions: RewardQuestion[] }>('/api/reward-questions/bulk', {
      method: 'POST',
      body: JSON.stringify({ questions, userId }),
    });
  },
};

// ===========================================
// Ads API
// ===========================================
export const adsApi = {
  /**
   * Get active ads
   */
  async getActive(): Promise<ApiResponse<Ad[]>> {
    return fetchJson<Ad[]>(API_ROUTES.ads.list);
  },

  /**
   * Get ad by ID
   */
  async getById(adId: string): Promise<ApiResponse<Ad>> {
    return fetchJson<Ad>(API_ROUTES.ads.get(adId));
  },

  /**
   * Track ad click
   */
  async trackClick(adId: string): Promise<ApiResponse<{ clicked: boolean }>> {
    return fetchJson<{ clicked: boolean }>(API_ROUTES.ads.click(adId), { method: 'POST' });
  },

  /**
   * Track ad impression
   */
  async trackImpression(adId: string, data?: { duration?: number; viewportPercentage?: number }): Promise<ApiResponse<{ recorded: boolean }>> {
    return fetchJson<{ recorded: boolean }>(API_ROUTES.ads.impression(adId), {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },
};

// ===========================================
// Utility Functions
// ===========================================

/**
 * Format currency amount
 */
export const formatCurrency = (amount: number, currency: string = 'UGX'): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format date
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

/**
 * Format relative time
 */
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(dateString);
};

/**
 * Format duration from seconds to MM:SS
 */
export const formatDuration = (seconds: number | null): string => {
  if (!seconds) return "LIVE";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Payment methods available for withdrawals
 */
export const paymentMethods = [
  { id: "mtn", name: "MTN Mobile Money", icon: "phone-portrait", minWithdrawal: 1000, maxWithdrawal: 5000000, processingTime: "Instant" },
  { id: "airtel", name: "Airtel Money", icon: "phone-portrait", minWithdrawal: 1000, maxWithdrawal: 5000000, processingTime: "Instant" },
];

// ===========================================
// Default Export - All APIs
// ===========================================
const apis = {
  user: userApi,
  videos: videosApi,
  surveys: surveysApi,
  questions: questionsApi,
  responses: responsesApi,
  transactions: transactionsApi,
  payments: paymentsApi,
  notifications: notificationsApi,
  rewards: rewardsApi,
  ads: adsApi,
};

export default apis;
