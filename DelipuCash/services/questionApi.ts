/**
 * Question API Service
 * Dedicated API layer for question-related operations
 * REST API integration - No mock data fallbacks
 * Follows industry standards for REST API design
 */

import {
  ApiResponse,
  Question,
  Response,
  RewardQuestion,
  RewardAnswerResult,
  PaginatedResponse,
} from "@/types";

// ===========================================
// API Configuration
// ===========================================

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";

// Validate that API URL is configured
if (!API_BASE_URL) {
    console.warn('[QuestionAPI] EXPO_PUBLIC_API_URL is not configured. API calls will fail.');
}

// API Version for future compatibility
const API_VERSION = "v1";
const API_VERSION_HEADER = "X-API-Version";
const CLIENT_VERSION_HEADER = "X-Client-Version";
const CLIENT_PLATFORM_HEADER = "X-Client-Platform";
const REQUEST_ID_HEADER = "X-Request-ID";

// Client info for debugging and analytics
const CLIENT_VERSION = "1.0.0";
const CLIENT_PLATFORM = "expo-react-native";

/**
 * Generate a unique request ID for tracing
 */
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get default headers for API requests
 */
const getDefaultHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  [API_VERSION_HEADER]: API_VERSION,
  [CLIENT_VERSION_HEADER]: CLIENT_VERSION,
  [CLIENT_PLATFORM_HEADER]: CLIENT_PLATFORM,
  [REQUEST_ID_HEADER]: generateRequestId(),
  "Accept": "application/json",
});

// API Routes
const QUESTION_ROUTES = {
  list: "/api/questions",
    all: "/api/questions/all",
  get: (id: string) => `/api/questions/${id}`,
    create: "/api/questions/create",
  update: (id: string) => `/api/questions/${id}`,
  delete: (id: string) => `/api/questions/${id}`,
  responses: (id: string) => `/api/questions/${id}/responses`,
  submitResponse: (id: string) => `/api/questions/${id}/responses`,
  categories: "/api/questions/categories",
  recent: "/api/questions/recent",
  popular: "/api/questions/popular",
  instant: "/api/questions/instant-reward",
  trending: "/api/questions/trending",
  search: "/api/questions/search",
  byUser: (userId: string) => `/api/questions/user/${userId}`,
    vote: (id: string) => `/api/questions/${id}/vote`,
  rewardQuestions: "/api/reward-questions/all",
  rewardQuestion: (id: string) => `/api/reward-questions/${id}`,
  submitRewardAnswer: (id: string) => `/api/reward-questions/${id}/answer`,
} as const;

// Helper to fetch JSON with versioning headers
async function fetchJson<T>(
  path: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
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

// Question statistics interface
export interface QuestionStats {
  totalQuestions: number;
    totalResponses: number;
  instantRewardQuestions: number;
    totalRewardsDistributed: number;
    averageResponsesPerQuestion: number;
}

// Question filter options
export interface QuestionFilters {
  category?: string;
  search?: string;
    sortBy?: "newest" | "oldest" | "popular" | "responses" | "reward";
  isInstantReward?: boolean;
  userId?: string;
  page?: number;
  limit?: number;
}

// Question with extended details
export interface QuestionWithDetails extends Question {
    author?: {
        id: string;
        firstName: string;
        lastName: string;
        avatar: string | null;
    };
    responses?: Response[];
    responseCount?: number;
    hasUserResponded?: boolean;
    topResponse?: Response;
}

// Create question data
export interface CreateQuestionData {
  text: string;
  category?: string;
  rewardAmount?: number;
  isInstantReward?: boolean;
    tags?: string[];
}

// ===========================================
// Question API
// ===========================================
export const questionApi = {
  /**
   * Get all questions with optional filtering and pagination
   */
    async getAll(filters?: QuestionFilters): Promise<PaginatedResponse<Question>> {
        const params = new URLSearchParams();
        if (filters?.category) params.append("category", filters.category);
        if (filters?.search) params.append("search", filters.search);
        if (filters?.sortBy) params.append("sortBy", filters.sortBy);
        if (filters?.isInstantReward !== undefined) {
            params.append("isInstantReward", String(filters.isInstantReward));
    }
        if (filters?.userId) params.append("userId", filters.userId);
        if (filters?.page) params.append("page", String(filters.page));
        if (filters?.limit) params.append("limit", String(filters.limit));

        const queryString = params.toString();
        const path = queryString ? `${QUESTION_ROUTES.all}?${queryString}` : QUESTION_ROUTES.all;

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
      return fetchJson<Question[]>(`${QUESTION_ROUTES.recent}?limit=${limit}`);
  },

  /**
   * Get popular questions
   */
  async getPopular(limit: number = 10): Promise<ApiResponse<Question[]>> {
      return fetchJson<Question[]>(`${QUESTION_ROUTES.popular}?limit=${limit}`);
  },

  /**
   * Get trending questions
   */
  async getTrending(limit: number = 10): Promise<ApiResponse<Question[]>> {
      return fetchJson<Question[]>(`${QUESTION_ROUTES.trending}?limit=${limit}`);
  },

  /**
   * Get instant reward questions
   */
    async getInstantReward(): Promise<ApiResponse<Question[]>> {
        return fetchJson<Question[]>(QUESTION_ROUTES.instant);
    },

    /**
     * Get question by ID
     */
    async getById(questionId: string): Promise<ApiResponse<Question | null>> {
        return fetchJson<Question>(QUESTION_ROUTES.get(questionId));
  },

  /**
   * Get question with full details
   */
    async getWithDetails(questionId: string): Promise<ApiResponse<QuestionWithDetails | null>> {
        return fetchJson<QuestionWithDetails>(`${QUESTION_ROUTES.get(questionId)}?include=author,responses`);
    },

    /**
     * Search questions
     */
    async search(query: string, filters?: Omit<QuestionFilters, 'search'>): Promise<PaginatedResponse<Question>> {
        const params = new URLSearchParams({ q: query });
        if (filters?.category) params.append("category", filters.category);
        if (filters?.sortBy) params.append("sortBy", filters.sortBy);
        if (filters?.page) params.append("page", String(filters.page));
        if (filters?.limit) params.append("limit", String(filters.limit));

      const response = await fetchJson<{ data: Question[]; pagination: any }>(
          `${QUESTION_ROUTES.search}?${params.toString()}`
      );

    return {
        success: response.success,
        data: response.data?.data || [],
        pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
        error: response.error,
    };
  },

  /**
   * Get questions by user
   */
    async getByUser(userId: string, page: number = 1, limit: number = 10): Promise<PaginatedResponse<Question>> {
        const response = await fetchJson<{ data: Question[]; pagination: any }>(
            `${QUESTION_ROUTES.byUser(userId)}?page=${page}&limit=${limit}`
    );

    return {
        success: response.success,
        data: response.data?.data || [],
        pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
        error: response.error,
    };
  },

  /**
   * Create a new question
   */
    async create(questionData: CreateQuestionData): Promise<ApiResponse<Question>> {
        return fetchJson<Question>(QUESTION_ROUTES.create, {
            method: "POST",
        body: JSON.stringify(questionData),
    });
  },

  /**
   * Update question
   */
    async update(questionId: string, data: Partial<CreateQuestionData>): Promise<ApiResponse<Question>> {
        return fetchJson<Question>(QUESTION_ROUTES.update(questionId), {
            method: "PUT",
            body: JSON.stringify(data),
    });
  },

  /**
   * Delete question
   */
  async delete(questionId: string): Promise<ApiResponse<{ deleted: boolean }>> {
      return fetchJson<{ deleted: boolean }>(QUESTION_ROUTES.delete(questionId), {
          method: "DELETE",
      });
  },

  /**
   * Get responses for a question
   */
    async getResponses(questionId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<Response>> {
        const response = await fetchJson<{ data: Response[]; pagination: any }>(
            `${QUESTION_ROUTES.responses(questionId)}?page=${page}&limit=${limit}`
        );

    return {
        success: response.success,
        data: response.data?.data || response.data || [],
        pagination: response.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
        error: response.error,
    };
  },

  /**
   * Submit response to a question
   */
    async submitResponse(questionId: string, responseText: string): Promise<ApiResponse<Response>> {
        return fetchJson<Response>(QUESTION_ROUTES.submitResponse(questionId), {
            method: "POST",
            body: JSON.stringify({ responseText }),
    });
  },

  /**
   * Vote on a question
   */
    async vote(questionId: string, type: 'up' | 'down'): Promise<ApiResponse<{ votes: number; userVote: 'up' | 'down' | null }>> {
        return fetchJson<{ votes: number; userVote: 'up' | 'down' | null }>(QUESTION_ROUTES.vote(questionId), {
            method: "POST",
            body: JSON.stringify({ type }),
        });
  },

  /**
   * Get question categories
   */
    async getCategories(): Promise<ApiResponse<string[]>> {
        return fetchJson<string[]>(QUESTION_ROUTES.categories);
  },

  /**
   * Get question statistics
   */
  async getStats(): Promise<ApiResponse<QuestionStats>> {
      return fetchJson<QuestionStats>("/api/questions/stats");
  },

  // ===========================================
    // Reward Questions
  // ===========================================

  /**
   * Get reward questions
   */
  async getRewardQuestions(): Promise<ApiResponse<RewardQuestion[]>> {
      return fetchJson<RewardQuestion[]>(QUESTION_ROUTES.rewardQuestions);
  },

  /**
   * Get reward question by ID
   */
    async getRewardQuestionById(questionId: string): Promise<ApiResponse<RewardQuestion | null>> {
        return fetchJson<RewardQuestion>(QUESTION_ROUTES.rewardQuestion(questionId));
  },

  /**
   * Submit answer to reward question
   */
  async submitRewardAnswer(
    questionId: string,
      answer: string,
      phoneNumber?: string,
      userEmail?: string
  ): Promise<ApiResponse<RewardAnswerResult>> {
      return fetchJson<RewardAnswerResult>(QUESTION_ROUTES.submitRewardAnswer(questionId), {
          method: "POST",
        body: JSON.stringify({ selectedAnswer: answer, phoneNumber, userEmail, rewardQuestionId: questionId }),
    });
  },
};

export default questionApi;
