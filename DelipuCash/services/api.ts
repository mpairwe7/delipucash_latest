/**
 * API Service Layer
 * Centralized API routes and data fetching utilities
 * Uses mock data for development, can be switched to real API calls
 */

import {
  getQuestionById,
  getResponsesForQuestion,
  getSurveyById,
  getSurveyQuestionsForSurvey,
  getUnreadNotificationCount,
  getUserById,
  getUserNotifications,
  getVideoById,
  mockAds,
  mockComments,
  mockCurrentUser,
  mockLoginSessions,
  mockNotifications,
  mockPayments,
  mockQuestions,
  mockResponses,
  mockRewardQuestions,
  mockRewards,
  mockSurveys,
  mockTransactions,
  mockUserStats,
  mockVideos
} from "@/data/mockData";
import {
    Ad,
    ApiResponse,
    AppUser,
    Comment,
  LoginSession,
    Notification,
    PaginatedResponse,
    Payment,
    PaymentStatus,
    Question,
    Response,
    Reward,
    RewardAnswerResult,
    RewardQuestion,
    SubscriptionType,
    Survey,
    Transaction,
    UploadSurvey,
    UserStats,
    Video,
} from "@/types";

// ===========================================
// API Configuration
// ===========================================

// Simulate network delay
const delay = (ms: number = 500): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
const isBackendConfigured = Boolean(process.env.EXPO_PUBLIC_API_URL);

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
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    get: (id: string) => `/api/questions/${id}`,
    create: "/api/questions",
    responses: (id: string) => `/api/questions/${id}/responses`,
    submitResponse: (id: string) => `/api/questions/${id}/responses`,
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
  },
  // Rewards
  rewards: {
    list: "/api/rewards",
    questions: "/api/rewards/questions",
    claim: (id: string) => `/api/rewards/${id}/claim`,
  },
  // Ads
  ads: {
    list: "/api/ads",
    click: (id: string) => `/api/ads/${id}/click`,
  },
} as const;

// ===========================================
// User API
// Integrates with backend REST API with mock fallback
// Backend routes: /api/users/* and /api/auth/*
// ===========================================
export const userApi = {
  /**
   * Get current user profile
   * Backend: GET /api/auth/:userId (requires auth token)
   * Fallback: mockCurrentUser
   */
  async getProfile(): Promise<ApiResponse<AppUser>> {
    if (isBackendConfigured) {
      try {
        const response = await fetchJson<AppUser>(API_ROUTES.user.profile);
        if (response.success) return response;
      } catch (error) {
        console.log('[userApi.getProfile] Backend call failed, using mock data:', error);
      }
    }
    // Mock fallback
    await delay();
    return {
      success: true,
      data: mockCurrentUser,
    };
  },

  /**
   * Update user profile
   * Backend: PUT /api/auth/:userId (requires auth token)
   * Fallback: mockCurrentUser with updates
   */
  async updateProfile(data: Partial<AppUser>): Promise<ApiResponse<AppUser>> {
    if (isBackendConfigured) {
      try {
        const response = await fetchJson<AppUser>(API_ROUTES.user.update, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        if (response.success) return response;
      } catch (error) {
        console.log('[userApi.updateProfile] Backend call failed, using mock data:', error);
      }
    }
    // Mock fallback
    await delay();
    const updatedUser = { ...mockCurrentUser, ...data, updatedAt: new Date().toISOString() };
    return {
      success: true,
      data: updatedUser,
      message: "Profile updated successfully",
    };
  },

  /**
   * Get user statistics
   * Backend: GET /api/users/:userId/stats (TODO: implement backend)
   * Fallback: mockUserStats
   */
  async getStats(): Promise<ApiResponse<UserStats>> {
    if (isBackendConfigured) {
      try {
        const response = await fetchJson<UserStats>(API_ROUTES.user.stats);
        if (response.success) return response;
      } catch (error) {
        console.log('[userApi.getStats] Backend call failed, using mock data:', error);
      }
    }
    // Mock fallback
    await delay();
    return {
      success: true,
      data: mockUserStats,
    };
  },

  /**
   * Get user by ID
   * Backend: GET /api/users/:userId
   * Fallback: getUserById from mock data
   */
  async getById(userId: string): Promise<ApiResponse<AppUser | null>> {
    if (isBackendConfigured) {
      try {
        const response = await fetchJson<AppUser>(`/api/users/${userId}`);
        if (response.success) return response;
      } catch (error) {
        console.log('[userApi.getById] Backend call failed, using mock data:', error);
      }
    }
    // Mock fallback
    await delay();
    const user = getUserById(userId);
    return {
      success: true,
      data: user || null,
    };
  },

  /**
   * Get user login sessions
   * Backend: GET /api/users/login-activity (requires auth token)
   * Fallback: mockLoginSessions filtered by user
   */
  async getSessions(): Promise<ApiResponse<LoginSession[]>> {
    if (isBackendConfigured) {
      try {
        const response = await fetchJson<LoginSession[]>('/api/users/login-activity');
        if (response.success) return response;
      } catch (error) {
        console.log('[userApi.getSessions] Backend call failed, using mock data:', error);
      }
    }
    // Mock fallback
    await delay();
    return {
      success: true,
      data: mockLoginSessions.filter(s => s.userId === mockCurrentUser.id),
    };
  },

  /**
   * Revoke a login session
   * Backend: POST /api/users/signout-all-devices (for all) or individual session revoke
   * Fallback: Update mock session to inactive
   */
  async revokeSession(sessionId: string): Promise<ApiResponse<{ revoked: boolean }>> {
    if (isBackendConfigured) {
      try {
        // Note: Backend currently has signout-all-devices, may need individual session revoke endpoint
        const response = await fetchJson<{ revoked: boolean }>(`/api/users/sessions/${sessionId}/revoke`, {
          method: 'POST',
        });
        if (response.success) return response;
      } catch (error) {
        console.log('[userApi.revokeSession] Backend call failed, using mock data:', error);
      }
    }
    // Mock fallback
    await delay();
    const sessionIndex = mockLoginSessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) {
      return { success: false, data: { revoked: false }, error: "Session not found" };
    }
    // Update session to inactive
    mockLoginSessions[sessionIndex] = {
      ...mockLoginSessions[sessionIndex],
      isActive: false,
      logoutTime: new Date().toISOString(),
    };
    return {
      success: true,
      data: { revoked: true },
      message: "Session revoked successfully",
    };
  },

  /**
   * Toggle 2FA settings (enable/disable)
   * When enabling: Sends verification code to email
   * When disabling: Requires password verification
   * Backend: PUT /api/auth/two-factor
   */
  async updateTwoFactor(enabled: boolean, password?: string): Promise<ApiResponse<{
    enabled?: boolean;
    codeSent?: boolean;
    email?: string;
    expiresIn?: number;
    devCode?: string; // Only in dev mode
  }>> {
    if (isBackendConfigured) {
      try {
        const response = await fetchJson<any>('/api/auth/two-factor', {
          method: 'PUT',
          body: JSON.stringify({ enabled, password }),
        });
        if (response.success) return response;
      } catch (error) {
        console.log('[userApi.updateTwoFactor] Backend call failed, using mock data:', error);
      }
    }
    // Mock fallback
    await delay();
    if (enabled) {
      return {
        success: true,
        data: { codeSent: true, email: 'us***@example.com', expiresIn: 600 },
        message: "Verification code sent to your email",
      };
    }
    return {
      success: true,
      data: { enabled: false },
      message: "Two-factor authentication disabled",
    };
  },

  /**
   * Verify 2FA code to complete enabling 2FA
   * Backend: POST /api/auth/two-factor/verify
   */
  async verify2FACode(code: string): Promise<ApiResponse<{ enabled: boolean }>> {
    if (isBackendConfigured) {
      try {
        const response = await fetchJson<{ enabled: boolean }>('/api/auth/two-factor/verify', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        return response;
      } catch (error) {
        console.log('[userApi.verify2FACode] Backend call failed:', error);
      }
    }
    // Mock fallback - simulate verification
    await delay();
    if (code === '123456') {
      return {
        success: true,
        data: { enabled: true },
        message: "Two-factor authentication enabled successfully",
      };
    }
    return {
      success: false,
      data: { enabled: false },
      error: "Invalid verification code",
    };
  },

  /**
   * Resend 2FA verification code
   * Backend: POST /api/auth/two-factor/resend
   */
  async resend2FACode(): Promise<ApiResponse<{ codeSent: boolean; email: string; expiresIn: number }>> {
    if (isBackendConfigured) {
      try {
        const response = await fetchJson<any>('/api/auth/two-factor/resend', {
          method: 'POST',
        });
        return response;
      } catch (error) {
        console.log('[userApi.resend2FACode] Backend call failed:', error);
      }
    }
    // Mock fallback
    await delay();
    return {
      success: true,
      data: { codeSent: true, email: 'us***@example.com', expiresIn: 600 },
      message: "New verification code sent",
    };
  },

  /**
   * Change password
   * Backend: PUT /api/auth/change-password (requires auth token)
   * Fallback: Simulate password change
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<{ success: boolean }>> {
    if (isBackendConfigured) {
      try {
        const response = await fetchJson<{ success: boolean }>('/api/auth/change-password', {
          method: 'PUT',
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (response.success) return response;
      } catch (error) {
        console.log('[userApi.changePassword] Backend call failed, using mock data:', error);
      }
    }
    // Mock fallback
    await delay(800);
    // Simulate password validation
    if (currentPassword === newPassword) {
      return { success: false, data: { success: false }, error: "New password must be different from current password" };
    }
    return {
      success: true,
      data: { success: true },
      message: "Password changed successfully",
    };
  },

  /**
   * Update privacy settings
   * Backend: PUT /api/users/privacy (requires auth token)
   * Fallback: Return updated settings
   */
  async updatePrivacySettings(settings: { shareProfile: boolean; shareActivity: boolean }): Promise<ApiResponse<{ shareProfile: boolean; shareActivity: boolean }>> {
    if (isBackendConfigured) {
      try {
        const response = await fetchJson<{ shareProfile: boolean; shareActivity: boolean }>('/api/users/privacy', {
          method: 'PUT',
          body: JSON.stringify(settings),
        });
        if (response.success) return response;
      } catch (error) {
        console.log('[userApi.updatePrivacySettings] Backend call failed, using mock data:', error);
      }
    }
    // Mock fallback
    await delay();
    return {
      success: true,
      data: settings,
      message: "Privacy settings updated",
    };
  },

  /**
   * Get privacy settings
   * Backend: GET /api/users/privacy (requires auth token)
   * Fallback: Return default settings
   */
  async getPrivacySettings(): Promise<ApiResponse<{ shareProfile: boolean; shareActivity: boolean }>> {
    if (isBackendConfigured) {
      try {
        const response = await fetchJson<{ shareProfile: boolean; shareActivity: boolean }>('/api/users/privacy');
        if (response.success) return response;
      } catch (error) {
        console.log('[userApi.getPrivacySettings] Backend call failed, using mock data:', error);
      }
    }
    // Mock fallback
    await delay();
    return {
      success: true,
      data: { shareProfile: true, shareActivity: false },
    };
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
    await delay();
    const { page = 1, limit = 10, category } = params || {};
    let videos = [...mockVideos];
    
    if (category) {
      videos = videos.filter(v => v.title?.toLowerCase().includes(category.toLowerCase()));
    }
    
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
   * Get video by ID
   */
  async getById(videoId: string): Promise<ApiResponse<Video | null>> {
    await delay();
    const video = getVideoById(videoId);
    return {
      success: true,
      data: video || null,
    };
  },

  /**
   * Like a video
   */
  async like(videoId: string): Promise<ApiResponse<Video>> {
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
    await delay();
    const video = getVideoById(videoId);
    if (!video) {
      return { success: false, data: {} as Video, error: "Video not found" };
    }
    return {
      success: true,
      data: { ...video, likes: Math.max(0, video.likes - 1) },
      message: "Video unliked",
    };
  },

  /**
   * Share a video (track for analytics)
   */
  async share(videoId: string, platform: string): Promise<ApiResponse<{ shared: boolean }>> {
    await delay();
    const video = getVideoById(videoId);
    if (!video) {
      return { success: false, data: { shared: false }, error: "Video not found" };
    }
    // In a real app, this would track the share event
    return {
      success: true,
      data: { shared: true },
      message: `Video shared via ${platform}`,
    };
  },

  /**
   * Bookmark a video
   */
  async bookmark(videoId: string): Promise<ApiResponse<Video>> {
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
   * Get video comments
   */
  async getComments(videoId: string): Promise<ApiResponse<Comment[]>> {
    await delay();
    const comments = mockComments.filter(c => c.videoId === videoId);
    return {
      success: true,
      data: comments,
    };
  },

  /**
   * Upload a new video
   */
  async upload(videoData: {
    title: string;
    description?: string;
    videoUrl: string;
    thumbnail: string;
    duration?: number;
  }): Promise<ApiResponse<Video>> {
    await delay(1000); // Longer delay to simulate upload
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
   * Get trending videos
   */
  async getTrending(limit: number = 10): Promise<ApiResponse<Video[]>> {
    await delay();
    const trending = [...mockVideos]
      .sort((a, b) => (b.views + b.likes * 2) - (a.views + a.likes * 2))
      .slice(0, limit);
    return {
      success: true,
      data: trending,
    };
  },

  /**
   * Get live videos
   */
  async getLive(): Promise<ApiResponse<Video[]>> {
    await delay();
    const liveVideos = mockVideos.filter(v =>
      v.videoUrl?.includes('.m3u8') || v.videoUrl?.includes('live')
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
    await delay();
    // Shuffle and return random videos as recommendations
    const shuffled = [...mockVideos].sort(() => Math.random() - 0.5);
    return {
      success: true,
      data: shuffled.slice(0, limit),
    };
  },

  /**
   * Search videos
   */
  async search(query: string): Promise<ApiResponse<Video[]>> {
    await delay();
    const lowerQuery = query.toLowerCase();
    const results = mockVideos.filter(v =>
      (v.title?.toLowerCase().includes(lowerQuery)) ||
      (v.description?.toLowerCase().includes(lowerQuery))
    );
    return {
      success: true,
      data: results,
    };
  },

  /**
   * Increment video view count
   */
  async incrementView(videoId: string): Promise<ApiResponse<Video>> {
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
   * Add comment to video
   */
  async addComment(videoId: string, text: string, mediaUrls?: string[]): Promise<ApiResponse<Comment>> {
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
   * Get user's videos
   */
  async getUserVideos(userId: string): Promise<ApiResponse<Video[]>> {
    await delay();
    const userVideos = mockVideos.filter(v => v.userId === userId);
    return {
      success: true,
      data: userVideos,
    };
  },

  /**
   * Get bookmarked videos
   */
  async getBookmarked(): Promise<ApiResponse<Video[]>> {
    await delay();
    const bookmarked = mockVideos.filter(v => v.isBookmarked);
    return {
      success: true,
      data: bookmarked,
    };
  },

  /**
   * Delete a video
   */
  async delete(videoId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    await delay();
    const video = getVideoById(videoId);
    if (!video) {
      return { success: false, data: { deleted: false }, error: "Video not found" };
    }
    return {
      success: true,
      data: { deleted: true },
      message: "Video deleted successfully",
    };
  },
};

// ===========================================
// Surveys API
// ===========================================
export const surveysApi = {
  /**
   * Get all surveys
   */
  async getAll(params?: { status?: string }): Promise<ApiResponse<Survey[]>> {
    const statusPath = params?.status ? API_ROUTES.surveys.byStatus(params.status) : API_ROUTES.surveys.list;

    if (isBackendConfigured) {
      const apiResponse = await fetchJson<Survey[]>(statusPath);
      if (apiResponse.success) return apiResponse;
      // fall through to mock on failure
      console.warn("Falling back to mock surveys", apiResponse.error);
    }

    await delay();
    let surveys = [...mockSurveys];
    if (params?.status) {
      surveys = surveys.filter((s) => s.status === params.status);
    }
    return { success: true, data: surveys };
  },

  /**
   * Get running surveys
   */
  async getRunning(): Promise<ApiResponse<Survey[]>> {
    if (isBackendConfigured) {
      const apiResponse = await fetchJson<Survey[]>(API_ROUTES.surveys.byStatus("running"));
      if (apiResponse.success) return apiResponse;
      console.warn("Falling back to mock running surveys", apiResponse.error);
    }

    await delay();
    const surveys = mockSurveys.filter((s) => s.status === "running");
    return { success: true, data: surveys };
  },

  /**
   * Get upcoming surveys
   */
  async getUpcoming(): Promise<ApiResponse<Survey[]>> {
    if (isBackendConfigured) {
      const apiResponse = await fetchJson<Survey[]>(API_ROUTES.surveys.byStatus("scheduled"));
      if (apiResponse.success) return apiResponse;
      console.warn("Falling back to mock upcoming surveys", apiResponse.error);
    }

    await delay();
    const surveys = mockSurveys.filter((s) => s.status === "scheduled");
    return { success: true, data: surveys };
  },

  /**
   * Get survey by ID with questions
   */
  async getById(surveyId: string): Promise<ApiResponse<Survey & { questions: UploadSurvey[] } | null>> {
    if (isBackendConfigured) {
      const apiResponse = await fetchJson<Survey & { uploads?: UploadSurvey[] }>(API_ROUTES.surveys.get(surveyId));
      if (apiResponse.success) {
        const surveyData = apiResponse.data;
        const questions = (surveyData as any).uploads || [];
        return { success: true, data: { ...surveyData, questions } };
      }
      console.warn("Falling back to mock survey", apiResponse.error);
    }

    await delay();
    const survey = getSurveyById(surveyId);
    if (!survey) return { success: true, data: null };
    const questions = getSurveyQuestionsForSurvey(surveyId);
    return { success: true, data: { ...survey, uploads: questions, questions } };
  },

  /**
   * Submit survey response
   */
  async submit(surveyId: string, responses: Record<string, unknown> & { userId?: string }): Promise<ApiResponse<{ reward: number }>> {
    if (isBackendConfigured) {
      const apiResponse = await fetchJson<{ message?: string }>(API_ROUTES.surveys.responses(surveyId), {
        method: "POST",
        body: JSON.stringify({ userId: responses.userId || mockCurrentUser.id, responses }),
      });
      if (apiResponse.success) {
        return { success: true, data: { reward: 0 }, message: apiResponse.data?.message || "Survey submitted" };
      }
      console.warn("Falling back to mock submit", apiResponse.error);
    }

    await delay();
    const survey = getSurveyById(surveyId);
    if (!survey) return { success: false, data: { reward: 0 }, error: "Survey not found" };
    return {
      success: true,
      data: { reward: survey.rewardAmount || 0 },
      message: `Survey completed! You earned $${survey.rewardAmount?.toFixed(2)}`,
    };
  },

  /**
   * Create a new survey with questions
   */
  async create(data: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    questions: Omit<UploadSurvey, "id" | "userId" | "surveyId" | "createdAt" | "updatedAt">[];
    userId?: string;
  }): Promise<ApiResponse<Survey & { questions: UploadSurvey[] }>> {
    const body = {
      title: data.title,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      userId: data.userId || mockCurrentUser.id,
      questions: data.questions.map((q) => ({
        text: q.text,
        type: q.type,
        options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
        placeholder: q.placeholder || "",
        minValue: q.minValue ?? null,
        maxValue: q.maxValue ?? null,
      })),
    };

    if (isBackendConfigured) {
      const apiResponse = await fetchJson<Survey & { uploads?: UploadSurvey[] }>(API_ROUTES.surveys.create, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (apiResponse.success) {
        const questions = (apiResponse.data as any).uploads || [];
        return { success: true, data: { ...(apiResponse.data as Survey), questions }, message: "Survey created successfully" };
      }
      console.warn("Falling back to mock create", apiResponse.error);
    }

    await delay(1000);
    const userId = data.userId || mockCurrentUser.id;
    const newSurvey: Survey = {
      id: `survey_${Date.now()}`,
      title: data.title,
      description: data.description || null,
      userId,
      startDate: data.startDate,
      endDate: data.endDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalResponses: 0,
      maxResponses: 500,
      rewardAmount: 10.0,
      status: "scheduled",
    };

    mockSurveys.push(newSurvey);

    const createdQuestions: UploadSurvey[] = data.questions.map((q, index) => ({
      ...q,
      id: `sq_${Date.now()}_${index}`,
      userId,
      surveyId: newSurvey.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    mockQuestions.push(...createdQuestions);

    return { success: true, data: { ...newSurvey, questions: createdQuestions }, message: "Survey created successfully" };
  },

  /**
   * Delete a survey
   */
  async delete(surveyId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    await delay();
    const surveyIndex = mockSurveys.findIndex((s) => s.id === surveyId);
    if (surveyIndex === -1) {
      return { success: false, data: { deleted: false }, error: "Survey not found" };
    }
    mockSurveys.splice(surveyIndex, 1);
    return {
      success: true,
      data: { deleted: true },
      message: "Survey deleted successfully",
    };
  },

  /**
   * Check if user has already attempted a survey
   */
  async checkAttempt(surveyId: string, userId: string): Promise<ApiResponse<{ hasAttempted: boolean; attemptedAt: string | null; message: string }>> {
    await delay();
    // In a real app, this would check the database
    // For mock, we'll return a random result based on IDs
    const hasAttempted = (surveyId.charCodeAt(0) + userId.charCodeAt(0)) % 3 === 0;
    return {
      success: true,
      data: {
        hasAttempted,
        attemptedAt: hasAttempted ? new Date(Date.now() - 86400000).toISOString() : null,
        message: hasAttempted ? "You have already completed this survey" : "Survey available",
      },
    };
  },
};

// ===========================================
// Questions API
// ===========================================
export const questionsApi = {
  /**
   * Get all questions
   */
  async getAll(params?: { category?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Question>> {
    await delay();
    const { page = 1, limit = 10, category } = params || {};
    let questions = [...mockQuestions];
    
    if (category) {
      questions = questions.filter(q => q.category === category);
    }
    
    const start = (page - 1) * limit;
    const paginatedQuestions = questions.slice(start, start + limit);
    
    return {
      success: true,
      data: paginatedQuestions,
      pagination: {
        page,
        limit,
        total: questions.length,
        totalPages: Math.ceil(questions.length / limit),
      },
    };
  },

  /**
   * Get question by ID with responses
   */
  async getById(questionId: string): Promise<ApiResponse<Question & { responses: Response[] } | null>> {
    await delay();
    const question = getQuestionById(questionId);
    if (!question) {
      return { success: true, data: null };
    }
    const responses = getResponsesForQuestion(questionId);
    return {
      success: true,
      data: { ...question, responses },
    };
  },

  /**
   * Submit response to question
   */
  async submitResponse(questionId: string, responseText: string): Promise<ApiResponse<Response>> {
    await delay();
    const question = getQuestionById(questionId);
    if (!question) {
      return { success: false, data: {} as Response, error: "Question not found" };
    }
    
    const newResponse: Response = {
      id: `response_${Date.now()}`,
      responseText,
      userId: mockCurrentUser.id,
      questionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likesCount: 0,
      dislikesCount: 0,
      repliesCount: 0,
      isLiked: false,
      isDisliked: false,
    };
    
    return {
      success: true,
      data: newResponse,
      message: `Answer submitted! You earned $${question.rewardAmount?.toFixed(2)}`,
    };
  },

  /**
   * Get question categories
   */
  async getCategories(): Promise<ApiResponse<string[]>> {
    await delay(200);
    const categories = [...new Set(mockQuestions.map(q => q.category).filter(Boolean))];
    return {
      success: true,
      data: categories as string[],
    };
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
    await delay();
    const response = mockResponses.find(r => r.id === responseId);
    if (!response) {
      return { success: false, data: {} as Response, error: "Response not found" };
    }
    return {
      success: true,
      data: { 
        ...response, 
        likesCount: (response.likesCount || 0) + 1,
        isLiked: true,
      },
    };
  },

  /**
   * Dislike a response
   */
  async dislike(responseId: string): Promise<ApiResponse<Response>> {
    await delay();
    const response = mockResponses.find(r => r.id === responseId);
    if (!response) {
      return { success: false, data: {} as Response, error: "Response not found" };
    }
    return {
      success: true,
      data: { 
        ...response, 
        dislikesCount: (response.dislikesCount || 0) + 1,
        isDisliked: true,
      },
    };
  },

  /**
   * Reply to a response
   */
  async reply(responseId: string, replyText: string): Promise<ApiResponse<{ message: string }>> {
    await delay();
    return {
      success: true,
      data: { message: "Reply posted successfully" },
    };
  },
};

// ===========================================
// Transactions API
// ===========================================
export const transactionsApi = {
  /**
   * Get all transactions
   */
  async getAll(params?: { type?: string; status?: string }): Promise<ApiResponse<Transaction[]>> {
    await delay();
    let transactions = [...mockTransactions];
    
    if (params?.type && params.type !== "all") {
      transactions = transactions.filter(t => t.type === params.type);
    }
    
    if (params?.status) {
      transactions = transactions.filter(t => t.status === params.status);
    }
    
    return {
      success: true,
      data: transactions,
    };
  },

  /**
   * Get transaction by ID
   */
  async getById(transactionId: string): Promise<ApiResponse<Transaction | null>> {
    await delay();
    const transaction = mockTransactions.find(t => t.id === transactionId);
    return {
      success: true,
      data: transaction || null,
    };
  },
};

// ===========================================
// Payments API
// ===========================================
export const paymentsApi = {
  /**
   * Get all payments
   */
  async getAll(): Promise<ApiResponse<Payment[]>> {
    await delay();
    return {
      success: true,
      data: mockPayments,
    };
  },

  /**
   * Request withdrawal
   */
  async withdraw(data: { amount: number; phoneNumber: string; provider: string }): Promise<ApiResponse<Payment>> {
    await delay(1000);
    const newPayment: Payment = {
      id: `payment_${Date.now()}`,
      amount: data.amount,
      phoneNumber: data.phoneNumber,
      provider: data.provider,
      TransactionId: `TXN-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Math.floor(Math.random() * 1000)}`,
      status: PaymentStatus.PENDING,
      subscriptionType: SubscriptionType.MONTHLY,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: mockCurrentUser.id,
    };
    
    return {
      success: true,
      data: newPayment,
      message: "Withdrawal request submitted successfully",
    };
  },
};

// ===========================================
// Notifications API
// ===========================================
export const notificationsApi = {
  /**
   * Get all notifications for current user
   */
  async getAll(): Promise<ApiResponse<Notification[]>> {
    await delay();
    const notifications = getUserNotifications(mockCurrentUser.id);
    return {
      success: true,
      data: notifications,
    };
  },

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<ApiResponse<number>> {
    await delay(200);
    const count = getUnreadNotificationCount(mockCurrentUser.id);
    return {
      success: true,
      data: count,
    };
  },

  /**
   * Mark notification as read
   */
  async markRead(notificationId: string): Promise<ApiResponse<Notification>> {
    await delay();
    const notification = mockNotifications.find(n => n.id === notificationId);
    if (!notification) {
      return { success: false, data: {} as Notification, error: "Notification not found" };
    }
    return {
      success: true,
      data: { ...notification, read: true, readAt: new Date().toISOString() },
    };
  },

  /**
   * Mark all notifications as read
   */
  async markAllRead(): Promise<ApiResponse<{ count: number }>> {
    await delay();
    const count = getUnreadNotificationCount(mockCurrentUser.id);
    return {
      success: true,
      data: { count },
      message: `${count} notifications marked as read`,
    };
  },
};

// ===========================================
// Rewards API
// ===========================================
export const rewardsApi = {
  /**
   * Get all rewards for current user
   */
  async getAll(): Promise<ApiResponse<Reward[]>> {
    await delay();
    return {
      success: true,
      data: mockRewards,
    };
  },

  /**
   * Get reward questions
   * Tries backend API first, falls back to mock data
   */
  async getQuestions(): Promise<ApiResponse<RewardQuestion[]>> {
    // Try backend API first if configured
    if (isBackendConfigured && API_BASE_URL) {
      try {
        const response = await fetchJson<{ rewardQuestions: RewardQuestion[]; message: string }>(
          '/api/reward-questions/all'
        );

        if (response.success && response.data?.rewardQuestions && Array.isArray(response.data.rewardQuestions)) {
          return {
            success: true,
            data: response.data.rewardQuestions,
          };
        }
        // If backend returns error or empty, fall through to mock data
        console.log('[RewardsAPI] Backend returned no data, using mock data fallback');
      } catch (error) {
        console.log('[RewardsAPI] Backend error, using mock data fallback:', error);
      }
    }

    // Fallback to mock data
    await delay();
    return {
      success: true,
      data: mockRewardQuestions,
    };
  },

  /**
   * Get reward question by ID
   * Tries backend API first, falls back to mock data
   */
  async getQuestionById(questionId: string): Promise<ApiResponse<RewardQuestion | null>> {
    // Try backend API first if configured
    if (isBackendConfigured && API_BASE_URL) {
      try {
        const response = await fetchJson<{ rewardQuestion: RewardQuestion; message: string }>(
          `/api/reward-questions/${questionId}`
        );

        if (response.success && response.data?.rewardQuestion) {
          return {
            success: true,
            data: response.data.rewardQuestion,
          };
        }
        // If backend returns error, fall through to mock data
        console.log('[RewardsAPI] Backend returned no data for question, using mock data fallback');
      } catch (error) {
        console.log('[RewardsAPI] Backend error getting question by ID, using mock data fallback:', error);
      }
    }

    // Fallback to mock data
    await delay();
    const question = mockRewardQuestions.find((q) => q.id === questionId) || null;
    return {
      success: true,
      data: question,
      error: question ? undefined : "Reward question not found",
    };
  },

  /**
   * Submit an answer for a reward question
   * For instant reward questions, phoneNumber and userEmail are used for automatic payout
   */
  async submitAnswer(
    questionId: string,
    answer: string,
    phoneNumber?: string,
    userEmail?: string
  ): Promise<ApiResponse<RewardAnswerResult>> {
    // If API is configured, call the real endpoint
    if (API_BASE_URL) {
      try {
        const response = await fetchJson<RewardAnswerResult>(
          `${API_BASE_URL}/api/reward-questions/submit-answer`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              rewardQuestionId: questionId,
              selectedAnswer: answer,
              phoneNumber,
              userEmail,
            }),
          }
        );

        if (response.success && response.data) {
          return {
            success: true,
            data: {
              isCorrect: response.data.isCorrect ?? false,
              rewardEarned: response.data.rewardEarned ?? response.data.pointsAwarded ?? 0,
              remainingSpots: response.data.remainingSpots ?? 0,
              isExpired: response.data.isExpired ?? false,
              isCompleted: response.data.isCompleted ?? false,
              message: response.data.message ?? '',
              isWinner: response.data.isWinner ?? false,
              position: response.data.position ?? null,
              paymentStatus: response.data.paymentStatus ?? null,
            },
            message: response.data.message,
          };
        }

        return {
          success: false,
          data: {} as RewardAnswerResult,
          error: response.error || 'Failed to submit answer'
        };
      } catch (error) {
        console.error('Submit answer error:', error);
        return {
          success: false,
          data: {} as RewardAnswerResult,
          error: error instanceof Error ? error.message : 'Network error'
        };
      }
    }

  // Mock implementation for development
    await delay(500);
    const question = mockRewardQuestions.find((q) => q.id === questionId);

    if (!question) {
      return { success: false, data: {} as RewardAnswerResult, error: "Reward question not found" };
    }

    const now = new Date();
    const expiryDate = question.expiryTime ? new Date(question.expiryTime) : null;
    const isExpired = Boolean(expiryDate && now > expiryDate);
    const isCompleted = question.isCompleted || (question.winnersCount >= question.maxWinners);

    const normalizedAnswer = answer.trim().toLowerCase();
    const normalizedCorrect = question.correctAnswer.trim().toLowerCase();
    const isCorrect = !isExpired && !isCompleted && normalizedAnswer === normalizedCorrect;

    const rewardEarned = isCorrect ? question.rewardAmount : 0;
    const remainingSpots = Math.max(question.maxWinners - question.winnersCount - (isCorrect ? 1 : 0), 0);

    const message = isExpired
      ? "This reward question has expired."
      : isCompleted
      ? "All rewards for this question have already been claimed."
      : isCorrect
          ? `Correct! You earned ${question.rewardAmount.toFixed(2)}. ${question.isInstantReward ? 'Payment is being processed to your phone.' : ''}`
      : "Incorrect answer. Try another question.";

    return {
      success: true,
      data: {
        isCorrect,
        rewardEarned,
        remainingSpots,
        isExpired,
        isCompleted,
        message,
        isWinner: isCorrect && question.isInstantReward,
        position: isCorrect && question.isInstantReward ? question.winnersCount + 1 : null,
        paymentStatus: isCorrect && question.isInstantReward ? 'PENDING' : null,
      },
      message,
    };
  },

  /**
   * Create a new reward question
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
    await delay(1000);

    const newQuestion: RewardQuestion = {
      id: `reward_question_${Date.now()}`,
      text: data.text,
      options: Object.fromEntries(data.options.map((opt, i) => [String.fromCharCode(97 + i), opt])),
      correctAnswer: data.correctAnswer,
      rewardAmount: data.rewardAmount,
      expiryTime: data.expiryTime || null,
      isActive: true,
      userId: data.userId,
      isInstantReward: data.isInstantReward || false,
      maxWinners: data.maxWinners || 1,
      winnersCount: 0,
      isCompleted: false,
      paymentProvider: data.paymentProvider || null,
      phoneNumber: data.phoneNumber || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to mock data
    mockRewardQuestions.push(newQuestion);

    return {
      success: true,
      data: newQuestion,
      message: "Reward question created successfully",
    };
  },

  /**
   * Bulk create reward questions from file upload
   * Supports multiple question types for enhanced quiz experience
   */
  async bulkCreateQuestions(questions: Array<{
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
  }>, userId: string): Promise<ApiResponse<{ created: number; failed: number; questions: RewardQuestion[] }>> {
    await delay(1500);

    const createdQuestions: RewardQuestion[] = [];
    let failed = 0;

    for (const q of questions) {
      // Validate required fields
      if (!q.text || q.text.trim().length < 5) {
        failed++;
        continue;
      }

      // Convert options to proper format
      let optionsObj: Record<string, unknown>;
      if (Array.isArray(q.options)) {
        if (q.options.length < 2 && q.type !== 'text') {
          failed++;
          continue;
        }
        optionsObj = Object.fromEntries(q.options.map((opt, i) => [String.fromCharCode(97 + i), opt]));
      } else if (q.options && typeof q.options === 'object') {
        optionsObj = q.options;
      } else if (q.type !== 'text') {
        failed++;
        continue;
      } else {
        optionsObj = {};
      }

      // Determine reward amount (prioritize pointValue for quiz questions)
      const rewardAmount = q.pointValue || q.rewardAmount || 10;

      const newQuestion: RewardQuestion = {
        id: `reward_question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: q.text.trim(),
        options: optionsObj,
        correctAnswer: Array.isArray(q.correctAnswer)
          ? q.correctAnswer.join(',')
          : (q.correctAnswer || Object.values(optionsObj)[0] as string || ''),
        rewardAmount,
        expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        userId,
        isInstantReward: false, // Bulk uploaded questions are for quiz, not instant reward
        maxWinners: 10,
        winnersCount: 0,
        isCompleted: false,
        paymentProvider: null,
        phoneNumber: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRewardQuestions.push(newQuestion);
      createdQuestions.push(newQuestion);
    }

    return {
      success: true,
      data: {
        created: createdQuestions.length,
        failed,
        questions: createdQuestions,
      },
      message: `Successfully created ${createdQuestions.length} questions${failed > 0 ? `, ${failed} failed` : ''}`,
    };
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
    await delay();
    return {
      success: true,
      data: mockAds.filter(ad => ad.isActive),
    };
  },

  /**
   * Track ad click
   */
  async trackClick(adId: string): Promise<ApiResponse<{ clicked: boolean }>> {
    await delay(200);
    return {
      success: true,
      data: { clicked: true },
    };
  },
};

// ===========================================
// Default Export - All APIs
// ===========================================
const mockApis = {
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

export default mockApis;
