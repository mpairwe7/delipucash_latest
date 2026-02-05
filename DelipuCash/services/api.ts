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
    PaginatedResponse,
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

// ===========================================
// API Configuration
// ===========================================

// Ensure the API URL always ends with /api
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || "https://delipucash-latest.vercel.app";

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
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      headers: {
        ...getDefaultHeaders(),
        ...(init?.headers || {}),
      },
      ...init,
    });

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
    list: "/api/videos",
    get: (id: string) => `/api/videos/${id}`,
    create: "/api/videos",
    like: (id: string) => `/api/videos/${id}/like`,
    bookmark: (id: string) => `/api/videos/${id}/bookmark`,
    comments: (id: string) => `/api/videos/${id}/comments`,
    trending: "/api/videos/trending",
    popular: "/api/videos/popular",
  },
  // Surveys
  surveys: {
    list: "/api/surveys",
    get: (id: string) => `/api/surveys/${id}`,
    questions: (id: string) => `/api/surveys/${id}/questions`,
    submit: (id: string) => `/api/surveys/${id}/submit`,
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
    markRead: (id: string) => `/api/notifications/${id}/read`,
    markAllRead: "/api/notifications/read-all",
    delete: (id: string) => `/api/notifications/${id}`,
    unreadCount: "/api/notifications/unread-count",
  },
  // Rewards
  rewards: {
    list: "/api/rewards",
    questions: "/api/rewards/questions",
    question: (id: string) => `/api/rewards/questions/${id}`,
    submitAnswer: (id: string) => `/api/rewards/questions/${id}/answer`,
    claim: (id: string) => `/api/rewards/${id}/claim`,
    daily: "/api/rewards/daily",
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
   */
  async getProfile(): Promise<ApiResponse<AppUser>> {
    return fetchJson<AppUser>(API_ROUTES.user.profile);
  },

  /**
   * Update user profile
   * Backend: PUT /api/users/profile (requires auth token)
   */
  async updateProfile(data: Partial<AppUser>): Promise<ApiResponse<AppUser>> {
    return fetchJson<AppUser>(API_ROUTES.user.update, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get user statistics
   * Backend: GET /api/users/stats
   */
  async getStats(): Promise<ApiResponse<UserStats>> {
    return fetchJson<UserStats>(API_ROUTES.user.stats);
  },

  /**
   * Get user by ID
   * Backend: GET /api/users/:userId
   */
  async getById(userId: string): Promise<ApiResponse<AppUser | null>> {
    return fetchJson<AppUser>(`/api/users/${userId}`);
  },

  /**
   * Get user login sessions
   * Backend: GET /api/users/login-activity (requires auth token)
   */
  async getSessions(): Promise<ApiResponse<LoginSession[]>> {
    return fetchJson<LoginSession[]>(API_ROUTES.user.sessions);
  },

  /**
   * Revoke a login session
   * Backend: POST /api/users/sessions/:sessionId/revoke
   */
  async revokeSession(sessionId: string): Promise<ApiResponse<{ revoked: boolean }>> {
    return fetchJson<{ revoked: boolean }>(`/api/users/sessions/${sessionId}/revoke`, {
      method: 'POST',
    });
  },

  /**
   * Toggle 2FA settings (enable/disable)
   * Backend: PUT /api/auth/two-factor
   */
  async updateTwoFactor(enabled: boolean, password?: string): Promise<ApiResponse<{
    enabled?: boolean;
    codeSent?: boolean;
    email?: string;
    expiresIn?: number;
  }>> {
    return fetchJson<any>('/api/auth/two-factor', {
      method: 'PUT',
      body: JSON.stringify({ enabled, password }),
    });
  },

  /**
   * Verify 2FA code to complete enabling 2FA
   * Backend: POST /api/auth/two-factor/verify
   */
  async verify2FACode(code: string): Promise<ApiResponse<{ enabled: boolean }>> {
    return fetchJson<{ enabled: boolean }>('/api/auth/two-factor/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  /**
   * Resend 2FA verification code
   * Backend: POST /api/auth/two-factor/resend
   */
  async resend2FACode(): Promise<ApiResponse<{ codeSent: boolean; email: string; expiresIn: number }>> {
    return fetchJson<any>('/api/auth/two-factor/resend', {
      method: 'POST',
    });
  },

  /**
   * Change password
   * Backend: PUT /api/auth/change-password (requires auth token)
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<{ success: boolean }>> {
    return fetchJson<{ success: boolean }>(API_ROUTES.auth.changePassword, {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  /**
   * Update privacy settings
   * Backend: PUT /api/users/privacy (requires auth token)
   */
  async updatePrivacySettings(settings: { shareProfile: boolean; shareActivity: boolean }): Promise<ApiResponse<{ shareProfile: boolean; shareActivity: boolean }>> {
    return fetchJson<{ shareProfile: boolean; shareActivity: boolean }>(API_ROUTES.user.privacy, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  /**
   * Get privacy settings
   * Backend: GET /api/users/privacy (requires auth token)
   */
  async getPrivacySettings(): Promise<ApiResponse<{ shareProfile: boolean; shareActivity: boolean }>> {
    return fetchJson<{ shareProfile: boolean; shareActivity: boolean }>(API_ROUTES.user.privacy);
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
   * Get trending videos
   */
  async getTrending(limit: number = 10): Promise<ApiResponse<Video[]>> {
    return fetchJson<Video[]>(`${API_ROUTES.videos.trending}?limit=${limit}`);
  },

  /**
   * Get live videos
   */
  async getLive(): Promise<ApiResponse<Video[]>> {
    return fetchJson<Video[]>(`${API_ROUTES.videos.list}?live=true`);
  },

  /**
   * Get recommended videos for user
   */
  async getRecommended(limit: number = 10): Promise<ApiResponse<Video[]>> {
    return fetchJson<Video[]>(`${API_ROUTES.videos.list}?recommended=true&limit=${limit}`);
  },

  /**
   * Like a video
   */
  async like(videoId: string): Promise<ApiResponse<Video>> {
    return fetchJson<Video>(API_ROUTES.videos.like(videoId), { method: 'POST' });
  },

  /**
   * Unlike a video
   */
  async unlike(videoId: string): Promise<ApiResponse<Video>> {
    return fetchJson<Video>(`/api/videos/${videoId}/unlike`, { method: 'POST' });
  },

  /**
   * Share a video (track for analytics)
   */
  async share(videoId: string, platform: string): Promise<ApiResponse<{ shared: boolean }>> {
    return fetchJson<{ shared: boolean }>(`/api/videos/${videoId}/share`, {
      method: 'POST',
      body: JSON.stringify({ platform }),
    });
  },

  /**
   * Bookmark a video
   */
  async bookmark(videoId: string): Promise<ApiResponse<Video>> {
    return fetchJson<Video>(API_ROUTES.videos.bookmark(videoId), { method: 'POST' });
  },

  /**
   * Remove bookmark
   */
  async removeBookmark(videoId: string): Promise<ApiResponse<Video>> {
    return fetchJson<Video>(API_ROUTES.videos.bookmark(videoId), { method: 'DELETE' });
  },

  /**
   * Get video comments
   */
  async getComments(videoId: string): Promise<ApiResponse<Comment[]>> {
    return fetchJson<Comment[]>(API_ROUTES.videos.comments(videoId));
  },

  /**
   * Add comment to video
   */
  async addComment(videoId: string, content: string, mediaUrls?: string[]): Promise<ApiResponse<Comment>> {
    return fetchJson<Comment>(API_ROUTES.videos.comments(videoId), {
      method: 'POST',
      body: JSON.stringify({ content, mediaUrls }),
    });
  },

  /**
   * Upload a video
   */
  async upload(data: { title: string; description?: string; videoUrl: string; thumbnail: string; duration?: number }): Promise<ApiResponse<Video>> {
    return fetchJson<Video>(API_ROUTES.videos.list, {
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
    return fetchJson<Video>(`/api/videos/${videoId}/view`, { method: 'POST' });
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
    return fetchJson<Survey[]>(API_ROUTES.surveys.byStatus('scheduled'));
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
   * Submit survey response (alias for submitResponse)
   */
  async submit(surveyId: string, responses: Record<string, any>, userId?: string): Promise<ApiResponse<{ reward: number; message: string }>> {
    return fetchJson<{ reward: number; message: string }>(API_ROUTES.surveys.submit(surveyId), {
      method: 'POST',
      body: JSON.stringify({ responses, userId }),
    });
  },

  /**
   * Submit survey response
   */
  async submitResponse(surveyId: string, answers: Record<string, any>): Promise<ApiResponse<{ submitted: boolean; reward?: number }>> {
    return fetchJson<{ submitted: boolean; reward?: number }>(API_ROUTES.surveys.submit(surveyId), {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  /**
   * Create a new survey
   */
  async create(surveyData: Partial<Survey> & { questions?: Partial<UploadSurvey>[] }): Promise<ApiResponse<Survey>> {
    return fetchJson<Survey>(API_ROUTES.surveys.create, {
      method: 'POST',
      body: JSON.stringify(surveyData),
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
      body: JSON.stringify({ responseText }),
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
      body: JSON.stringify(questionData),
    });
  },

  /**
   * Vote on a question
   */
  async vote(questionId: string, type: 'up' | 'down'): Promise<ApiResponse<Question>> {
    return fetchJson<Question>(API_ROUTES.questions.vote(questionId), {
      method: 'POST',
      body: JSON.stringify({ type }),
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
   * Like a response
   */
  async like(responseId: string): Promise<ApiResponse<Response>> {
    return fetchJson<Response>(API_ROUTES.responses.like(responseId), { method: 'POST' });
  },

  /**
   * Dislike a response
   */
  async dislike(responseId: string): Promise<ApiResponse<Response>> {
    return fetchJson<Response>(API_ROUTES.responses.dislike(responseId), { method: 'POST' });
  },

  /**
   * Reply to a response
   */
  async reply(responseId: string, replyText: string): Promise<ApiResponse<any>> {
    return fetchJson<any>(API_ROUTES.responses.reply(responseId), {
      method: 'POST',
      body: JSON.stringify({ text: replyText }),
    });
  },
};

// ===========================================
// Transactions API
// ===========================================
export const transactionsApi = {
  /**
   * Get user transactions
   */
  async getAll(params?: { page?: number; limit?: number; type?: string }): Promise<PaginatedResponse<Transaction>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.type) searchParams.append('type', params.type);
    
    const queryString = searchParams.toString();
    const path = queryString ? `${API_ROUTES.transactions.list}?${queryString}` : API_ROUTES.transactions.list;
    
    const response = await fetchJson<{ data: Transaction[]; pagination: any }>(path);
    return {
      success: response.success,
      data: response.data?.data || response.data || [],
      pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      error: response.error,
    };
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
   * Get user notifications
   */
  async getAll(params?: { page?: number; limit?: number; unreadOnly?: boolean }): Promise<PaginatedResponse<Notification>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.unreadOnly) searchParams.append('unreadOnly', 'true');

    const queryString = searchParams.toString();
    const path = queryString ? `${API_ROUTES.notifications.list}?${queryString}` : API_ROUTES.notifications.list;

    const response = await fetchJson<{ data: Notification[]; pagination: any }>(path);
    return {
      success: response.success,
      data: response.data?.data || response.data || [],
      pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      error: response.error,
    };
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    return fetchJson<{ count: number }>(API_ROUTES.notifications.unreadCount);
  },

  /**
   * Mark notification as read
   */
  async markRead(notificationId: string): Promise<ApiResponse<Notification>> {
    return fetchJson<Notification>(API_ROUTES.notifications.markRead(notificationId), { method: 'POST' });
  },

  /**
   * Mark all notifications as read
   */
  async markAllRead(): Promise<ApiResponse<{ updated: number }>> {
    return fetchJson<{ updated: number }>(API_ROUTES.notifications.markAllRead, { method: 'POST' });
  },

  /**
   * Delete notification
   */
  async delete(notificationId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return fetchJson<{ deleted: boolean }>(API_ROUTES.notifications.delete(notificationId), { method: 'DELETE' });
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
   * Get reward question by ID
   */
  async getQuestionById(questionId: string): Promise<ApiResponse<RewardQuestion | null>> {
    return fetchJson<RewardQuestion>(API_ROUTES.rewards.question(questionId));
  },

  /**
   * Submit answer to reward question
   */
  async submitAnswer(questionId: string, answer: string, paymentProvider?: string, phoneNumber?: string): Promise<ApiResponse<RewardAnswerResult>> {
    return fetchJson<RewardAnswerResult>(API_ROUTES.rewards.submitAnswer(questionId), {
      method: 'POST',
      body: JSON.stringify({ answer, paymentProvider, phoneNumber }),
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
   * Create a reward question
   */
  async createRewardQuestion(data: {
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
  }): Promise<ApiResponse<RewardQuestion>> {
    return fetchJson<RewardQuestion>('/api/rewards/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
    return fetchJson<{ created: number; failed: number; questions: RewardQuestion[] }>('/api/rewards/questions/bulk', {
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
    return fetchJson<{ created: number; failed: number; questions: RewardQuestion[] }>('/api/rewards/questions/bulk', {
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
// Utility Functions (moved from mockData)
// ===========================================

/**
 * Format currency amount
 */
export const formatCurrency = (amount: number, currency: string = 'UGX'): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
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
  { id: "bank", name: "Bank Transfer", icon: "business", minWithdrawal: 50000, maxWithdrawal: 50000000, processingTime: "1-3 business days" },
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
