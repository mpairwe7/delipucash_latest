/**
 * Survey API Service
 * Dedicated API layer for survey-related operations
 * REST API integration - No mock data fallbacks
 */

import {
  ApiResponse,
  Survey,
  SurveyResponse,
  UploadSurvey,
  PaginatedResponse,
} from "@/types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";

// Validate that API URL is configured
if (!API_BASE_URL) {
  console.warn('[SurveyAPI] EXPO_PUBLIC_API_URL is not configured. API calls will fail.');
}

// API Routes
const SURVEY_ROUTES = {
  list: "/api/surveys",
  get: (id: string) => `/api/surveys/${id}`,
  questions: (id: string) => `/api/surveys/${id}/questions`,
  submit: (id: string) => `/api/surveys/${id}/submit`,
  create: "/api/surveys/upload",
  responses: (id: string) => `/api/surveys/${id}/responses`,
  checkAttempt: (id: string, userId: string) => `/api/surveys/${id}/attempt?userId=${userId}`,
  byStatus: (status: string) => `/api/surveys/status/${status}`,
  analytics: (id: string) => `/api/surveys/${id}/analytics`,
  delete: (id: string) => `/api/surveys/${id}`,
  update: (id: string) => `/api/surveys/${id}`,
} as const;

// Survey attempt status interface
export interface SurveyAttemptStatus {
  hasAttempted: boolean;
  attemptedAt: string | null;
  message: string;
}

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

// Survey statistics interface
export interface SurveyStats {
  totalSurveys: number;
  activeSurveys: number;
  scheduledSurveys: number;
  completedSurveys: number;
  totalResponses: number;
  totalEarnings: number;
  averageCompletionRate: number;
}

// Survey filter options
export interface SurveyFilters {
  status?: "running" | "scheduled" | "completed" | "all";
  search?: string;
  sortBy?: "newest" | "oldest" | "reward" | "responses";
  category?: string;
  page?: number;
  limit?: number;
}

// Survey with extended details
export interface SurveyWithDetails extends Survey {
  questions: UploadSurvey[];
  questionsCount: number;
  completionRate: number;
  estimatedTime: number;
  category?: string;
  tags?: string[];
}

// Survey analytics interface
export interface SurveyAnalytics {
  surveyId: string;
  title: string;
  totalResponses: number;
  completionRate: number;
  averageTime: number;
  responsesByDay: { date: string; count: number }[];
  questionStats: {
    questionId: string;
    questionText: string;
    responseDistribution: { option: string; count: number; percentage: number }[];
  }[];
}

// ===========================================
// Survey API
// ===========================================
export const surveyApi = {
  /**
   * Get all surveys with optional filtering
   */
  async getAll(filters?: SurveyFilters): Promise<PaginatedResponse<Survey>> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== "all") {
      params.append("status", filters.status);
    }
    if (filters?.search) params.append("search", filters.search);
    if (filters?.sortBy) params.append("sortBy", filters.sortBy);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const queryString = params.toString();
    const path = queryString ? `${SURVEY_ROUTES.list}?${queryString}` : SURVEY_ROUTES.list;

    const response = await fetchJson<{ data: Survey[]; pagination: any }>(path);

    return {
      success: response.success,
      data: response.data?.data || response.data || [],
      pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      error: response.error,
    };
  },

  /**
   * Get running (active) surveys
   */
  async getRunning(): Promise<ApiResponse<Survey[]>> {
    return fetchJson<Survey[]>(SURVEY_ROUTES.byStatus("running"));
  },

  /**
   * Get upcoming (scheduled) surveys
   */
  async getUpcoming(): Promise<ApiResponse<Survey[]>> {
    return fetchJson<Survey[]>(SURVEY_ROUTES.byStatus("scheduled"));
  },

  /**
   * Get completed surveys
   */
  async getCompleted(): Promise<ApiResponse<Survey[]>> {
    return fetchJson<Survey[]>(SURVEY_ROUTES.byStatus("completed"));
  },

  /**
   * Get survey by ID
   */
  async getById(surveyId: string): Promise<ApiResponse<Survey | null>> {
    return fetchJson<Survey>(SURVEY_ROUTES.get(surveyId));
  },

  /**
   * Get survey with full details including questions
   */
  async getWithDetails(surveyId: string): Promise<ApiResponse<SurveyWithDetails | null>> {
    return fetchJson<SurveyWithDetails>(`${SURVEY_ROUTES.get(surveyId)}?include=questions`);
  },

  /**
   * Get survey questions
   */
  async getQuestions(surveyId: string): Promise<ApiResponse<UploadSurvey[]>> {
    return fetchJson<UploadSurvey[]>(SURVEY_ROUTES.questions(surveyId));
  },

  /**
   * Submit survey response
   */
  async submitResponse(
    surveyId: string,
    answers: Record<string, any>
  ): Promise<ApiResponse<{ submitted: boolean; reward?: number; message?: string }>> {
    return fetchJson<{ submitted: boolean; reward?: number; message?: string }>(
      SURVEY_ROUTES.submit(surveyId),
      {
        method: "POST",
        body: JSON.stringify({ answers }),
      }
    );
  },

  /**
   * Check if user has already attempted survey
   */
  async checkAttempt(surveyId: string, userId: string): Promise<ApiResponse<SurveyAttemptStatus>> {
    return fetchJson<SurveyAttemptStatus>(SURVEY_ROUTES.checkAttempt(surveyId, userId));
  },

  /**
   * Create a new survey
   */
  async create(surveyData: {
    title: string;
    description?: string;
    rewardAmount?: number;
    maxResponses?: number;
    startDate?: string;
    endDate?: string;
    questions: Partial<UploadSurvey>[];
  }): Promise<ApiResponse<Survey>> {
    return fetchJson<Survey>(SURVEY_ROUTES.create, {
      method: "POST",
      body: JSON.stringify(surveyData),
    });
  },

  /**
   * Update survey
   */
  async update(surveyId: string, data: Partial<Survey>): Promise<ApiResponse<Survey>> {
    return fetchJson<Survey>(SURVEY_ROUTES.update(surveyId), {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete survey
   */
  async delete(surveyId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return fetchJson<{ deleted: boolean }>(SURVEY_ROUTES.delete(surveyId), {
      method: "DELETE",
    });
  },

  /**
   * Get survey responses
   */
  async getResponses(surveyId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<SurveyResponse>> {
    const response = await fetchJson<{ data: SurveyResponse[]; pagination: any }>(
      `${SURVEY_ROUTES.responses(surveyId)}?page=${page}&limit=${limit}`
    );

    return {
      success: response.success,
      data: response.data?.data || [],
      pagination: response.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
      error: response.error,
    };
  },

  /**
   * Get survey analytics
   */
  async getAnalytics(surveyId: string): Promise<ApiResponse<SurveyAnalytics>> {
    return fetchJson<SurveyAnalytics>(SURVEY_ROUTES.analytics(surveyId));
  },

  /**
   * Get survey statistics summary
   */
  async getStats(): Promise<ApiResponse<SurveyStats>> {
    return fetchJson<SurveyStats>("/api/surveys/stats");
  },
};

export default surveyApi;
