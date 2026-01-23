/**
 * Survey API Service
 * Dedicated API layer for survey-related operations
 * Supports both mock data and real backend integration
 */

import {
  ApiResponse,
  Survey,
  SurveyResponse,
  UploadSurvey,
} from "@/types";
import {
  mockSurveys,
  mockSurveyQuestions,
  mockCurrentUser,
  mockUsers,
  getSurveyById,
  getSurveyQuestionsForSurvey,
} from "@/data/mockData";

// Simulate network delay
const delay = (ms: number = 500): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
const isBackendConfigured = Boolean(API_BASE_URL);

// API Routes
const SURVEY_ROUTES = {
  list: "/api/surveys",
  get: (id: string) => `/api/surveys/${id}`,
  questions: (id: string) => `/api/surveys/${id}/questions`,
  submit: (id: string) => `/api/surveys/${id}/submit`,
  create: "/api/surveys/upload",
  responses: (id: string) => `/api/surveys/${id}/responses`,
  byStatus: (status: string) => `/api/surveys/status/${status}`,
  analytics: (id: string) => `/api/surveys/${id}/analytics`,
  delete: (id: string) => `/api/surveys/${id}`,
  update: (id: string) => `/api/surveys/${id}`,
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

// ===========================================
// Survey API
// ===========================================
export const surveyApi = {
  /**
   * Get all surveys with optional filtering
   */
  async getAll(filters?: SurveyFilters): Promise<ApiResponse<Survey[]>> {
    if (isBackendConfigured) {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== "all") {
        params.append("status", filters.status);
      }
      if (filters?.search) params.append("search", filters.search);
      if (filters?.sortBy) params.append("sortBy", filters.sortBy);
      if (filters?.page) params.append("page", String(filters.page));
      if (filters?.limit) params.append("limit", String(filters.limit));

      const queryString = params.toString();
      const path = queryString
        ? `${SURVEY_ROUTES.list}?${queryString}`
        : SURVEY_ROUTES.list;

      const response = await fetchJson<Survey[]>(path);
      if (response.success) return response;
    }

    await delay();
    let surveys = [...mockSurveys];

    // Apply filters
    if (filters?.status && filters.status !== "all") {
      surveys = surveys.filter((s) => s.status === filters.status);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      surveys = surveys.filter(
        (s) =>
          s.title.toLowerCase().includes(searchLower) ||
          s.description?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case "newest":
          surveys.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          break;
        case "oldest":
          surveys.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          break;
        case "reward":
          surveys.sort((a, b) => (b.rewardAmount || 0) - (a.rewardAmount || 0));
          break;
        case "responses":
          surveys.sort(
            (a, b) => (b.totalResponses || 0) - (a.totalResponses || 0)
          );
          break;
      }
    }

    // Apply pagination
    if (filters?.page && filters?.limit) {
      const start = (filters.page - 1) * filters.limit;
      surveys = surveys.slice(start, start + filters.limit);
    }

    return { success: true, data: surveys };
  },

  /**
   * Get running (active) surveys
   */
  async getRunning(): Promise<ApiResponse<Survey[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Survey[]>(
        SURVEY_ROUTES.byStatus("running")
      );
      if (response.success) return response;
    }

    await delay();
    const surveys = mockSurveys.filter((s) => s.status === "running");
    return { success: true, data: surveys };
  },

  /**
   * Get upcoming (scheduled) surveys
   */
  async getUpcoming(): Promise<ApiResponse<Survey[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Survey[]>(
        SURVEY_ROUTES.byStatus("scheduled")
      );
      if (response.success) return response;
    }

    await delay();
    const surveys = mockSurveys.filter((s) => s.status === "scheduled");
    return { success: true, data: surveys };
  },

  /**
   * Get completed surveys
   */
  async getCompleted(): Promise<ApiResponse<Survey[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Survey[]>(
        SURVEY_ROUTES.byStatus("completed")
      );
      if (response.success) return response;
    }

    await delay();
    const surveys = mockSurveys.filter((s) => s.status === "completed");
    return { success: true, data: surveys };
  },

  /**
   * Get survey by ID with questions
   */
  async getById(
    surveyId: string
  ): Promise<ApiResponse<SurveyWithDetails | null>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Survey & { uploads?: UploadSurvey[] }>(
        SURVEY_ROUTES.get(surveyId)
      );
      if (response.success && response.data) {
        const questions = (response.data as any).uploads || [];
        const surveyWithDetails: SurveyWithDetails = {
          ...response.data,
          questions,
          questionsCount: questions.length,
          completionRate:
            ((response.data.totalResponses || 0) /
              (response.data.maxResponses || 1)) *
            100,
          estimatedTime: questions.length * 2,
        };
        return { success: true, data: surveyWithDetails };
      }
    }

    await delay();
    const survey = getSurveyById(surveyId);
    if (!survey) return { success: true, data: null };

    const questions = getSurveyQuestionsForSurvey(surveyId);
    const surveyWithDetails: SurveyWithDetails = {
      ...survey,
      questions,
      questionsCount: questions.length,
      completionRate:
        ((survey.totalResponses || 0) / (survey.maxResponses || 1)) * 100,
      estimatedTime: questions.length * 2,
    };

    return { success: true, data: surveyWithDetails };
  },

  /**
   * Get survey questions
   */
  async getQuestions(surveyId: string): Promise<ApiResponse<UploadSurvey[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<UploadSurvey[]>(
        SURVEY_ROUTES.questions(surveyId)
      );
      if (response.success) return response;
    }

    await delay();
    const questions = getSurveyQuestionsForSurvey(surveyId);
    return { success: true, data: questions };
  },

  /**
   * Submit survey response
   */
  async submit(
    surveyId: string,
    responses: Record<string, unknown>,
    userId?: string
  ): Promise<ApiResponse<{ reward: number; message: string }>> {
    const body = {
      userId: userId || mockCurrentUser.id,
      responses,
    };

    if (isBackendConfigured) {
      const response = await fetchJson<{ message?: string; reward?: number }>(
        SURVEY_ROUTES.responses(surveyId),
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      if (response.success) {
        return {
          success: true,
          data: {
            reward: response.data?.reward || 0,
            message: response.data?.message || "Survey submitted successfully",
          },
        };
      }
    }

    await delay(800);
    const survey = getSurveyById(surveyId);
    if (!survey) {
      return {
        success: false,
        data: { reward: 0, message: "" },
        error: "Survey not found",
      };
    }

    // Update mock data
    const surveyIndex = mockSurveys.findIndex((s) => s.id === surveyId);
    if (surveyIndex !== -1) {
      mockSurveys[surveyIndex] = {
        ...mockSurveys[surveyIndex],
        totalResponses: (mockSurveys[surveyIndex].totalResponses || 0) + 1,
      };
    }

    return {
      success: true,
      data: {
        reward: survey.rewardAmount || 0,
        message: `Survey completed! You earned $${(survey.rewardAmount || 0).toFixed(2)}`,
      },
    };
  },

  /**
   * Create a new survey
   */
  async create(data: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    rewardAmount?: number;
    maxResponses?: number;
    category?: string;
    questions: Omit<
      UploadSurvey,
      "id" | "userId" | "surveyId" | "createdAt" | "updatedAt"
    >[];
    userId?: string;
  }): Promise<ApiResponse<SurveyWithDetails>> {
    const body = {
      title: data.title,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      rewardAmount: data.rewardAmount,
      maxResponses: data.maxResponses,
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
      const response = await fetchJson<Survey & { uploads?: UploadSurvey[] }>(
        SURVEY_ROUTES.create,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      if (response.success) {
        const questions = (response.data as any).uploads || [];
        return {
          success: true,
          data: {
            ...response.data,
            questions,
            questionsCount: questions.length,
            completionRate: 0,
            estimatedTime: questions.length * 2,
          },
          message: "Survey created successfully",
        };
      }
    }

    await delay(1000);
    const userId = data.userId || mockCurrentUser.id;
    const now = new Date().toISOString();

    const newSurvey: Survey = {
      id: `survey_${Date.now()}`,
      title: data.title,
      description: data.description || null,
      userId,
      startDate: data.startDate,
      endDate: data.endDate,
      createdAt: now,
      updatedAt: now,
      totalResponses: 0,
      maxResponses: data.maxResponses || 500,
      rewardAmount: data.rewardAmount || 10.0,
      status: new Date(data.startDate) > new Date() ? "scheduled" : "running",
    };

    mockSurveys.unshift(newSurvey);

    const createdQuestions: UploadSurvey[] = data.questions.map((q, index) => ({
      ...q,
      id: `sq_${Date.now()}_${index}`,
      options: typeof q.options === "string" ? q.options : JSON.stringify(q.options),
      userId,
      surveyId: newSurvey.id,
      createdAt: now,
      updatedAt: now,
    }));

    mockSurveyQuestions.push(...createdQuestions);

    return {
      success: true,
      data: {
        ...newSurvey,
        questions: createdQuestions,
        questionsCount: createdQuestions.length,
        completionRate: 0,
        estimatedTime: createdQuestions.length * 2,
      },
      message: "Survey created successfully",
    };
  },

  /**
   * Update a survey
   */
  async update(
    surveyId: string,
    data: Partial<
      Pick<Survey, "title" | "description" | "startDate" | "endDate">
    >
  ): Promise<ApiResponse<Survey>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Survey>(SURVEY_ROUTES.update(surveyId), {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      if (response.success) return response;
    }

    await delay();
    const surveyIndex = mockSurveys.findIndex((s) => s.id === surveyId);
    if (surveyIndex === -1) {
      return {
        success: false,
        data: {} as Survey,
        error: "Survey not found",
      };
    }

    mockSurveys[surveyIndex] = {
      ...mockSurveys[surveyIndex],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: mockSurveys[surveyIndex],
      message: "Survey updated successfully",
    };
  },

  /**
   * Delete a survey
   */
  async delete(surveyId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    if (isBackendConfigured) {
      const response = await fetchJson<{ deleted: boolean }>(
        SURVEY_ROUTES.delete(surveyId),
        { method: "DELETE" }
      );
      if (response.success) return response;
    }

    await delay();
    const surveyIndex = mockSurveys.findIndex((s) => s.id === surveyId);
    if (surveyIndex === -1) {
      return {
        success: false,
        data: { deleted: false },
        error: "Survey not found",
      };
    }

    mockSurveys.splice(surveyIndex, 1);
    return {
      success: true,
      data: { deleted: true },
      message: "Survey deleted successfully",
    };
  },

  /**
   * Get survey statistics
   */
  async getStats(): Promise<ApiResponse<SurveyStats>> {
    if (isBackendConfigured) {
      const response = await fetchJson<SurveyStats>("/api/surveys/stats");
      if (response.success) return response;
    }

    await delay(300);
    const stats: SurveyStats = {
      totalSurveys: mockSurveys.length,
      activeSurveys: mockSurveys.filter((s) => s.status === "running").length,
      scheduledSurveys: mockSurveys.filter((s) => s.status === "scheduled")
        .length,
      completedSurveys: mockSurveys.filter((s) => s.status === "completed")
        .length,
      totalResponses: mockSurveys.reduce(
        (sum, s) => sum + (s.totalResponses || 0),
        0
      ),
      totalEarnings: mockSurveys.reduce(
        (sum, s) => sum + (s.rewardAmount || 0) * (s.totalResponses || 0),
        0
      ),
      averageCompletionRate:
        mockSurveys.reduce((sum, s) => {
          const rate =
            ((s.totalResponses || 0) / (s.maxResponses || 1)) * 100;
          return sum + rate;
        }, 0) / mockSurveys.length || 0,
    };

    return { success: true, data: stats };
  },

  /**
   * Get survey analytics
   */
  async getAnalytics(surveyId: string): Promise<
    ApiResponse<{
      responsesByDay: { date: string; count: number }[];
      completionRate: number;
      averageTime: number;
      questionStats: { questionId: string; answerDistribution: Record<string, number> }[];
    }>
  > {
    if (isBackendConfigured) {
      const response = await fetchJson<{
        responsesByDay: { date: string; count: number }[];
        completionRate: number;
        averageTime: number;
        questionStats: { questionId: string; answerDistribution: Record<string, number> }[];
      }>(SURVEY_ROUTES.analytics(surveyId));
      if (response.success) return response;
    }

    await delay();
    const survey = getSurveyById(surveyId);
    if (!survey) {
      return {
        success: false,
        data: {
          responsesByDay: [],
          completionRate: 0,
          averageTime: 0,
          questionStats: [],
        },
        error: "Survey not found",
      };
    }

    // Generate mock analytics
    const responsesByDay = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        date: date.toISOString().split("T")[0],
        count: Math.floor(Math.random() * 50) + 10,
      };
    }).reverse();

    return {
      success: true,
      data: {
        responsesByDay,
        completionRate:
          ((survey.totalResponses || 0) / (survey.maxResponses || 1)) * 100,
        averageTime: 4.5,
        questionStats: [],
      },
    };
  },

  /**
   * Duplicate a survey
   */
  async duplicate(
    surveyId: string
  ): Promise<ApiResponse<SurveyWithDetails>> {
    await delay();
    const survey = getSurveyById(surveyId);
    if (!survey) {
      return {
        success: false,
        data: {} as SurveyWithDetails,
        error: "Survey not found",
      };
    }

    const questions = getSurveyQuestionsForSurvey(surveyId);
    const now = new Date().toISOString();
    const oneWeekFromNow = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const newSurvey: Survey = {
      ...survey,
      id: `survey_${Date.now()}`,
      title: `${survey.title} (Copy)`,
      createdAt: now,
      updatedAt: now,
      startDate: now,
      endDate: oneWeekFromNow,
      totalResponses: 0,
      status: "running",
    };

    mockSurveys.unshift(newSurvey);

    const duplicatedQuestions: UploadSurvey[] = questions.map((q, index) => ({
      ...q,
      id: `sq_${Date.now()}_${index}`,
      surveyId: newSurvey.id,
      createdAt: now,
      updatedAt: now,
    }));

    mockSurveyQuestions.push(...duplicatedQuestions);

    return {
      success: true,
      data: {
        ...newSurvey,
        questions: duplicatedQuestions,
        questionsCount: duplicatedQuestions.length,
        completionRate: 0,
        estimatedTime: duplicatedQuestions.length * 2,
      },
      message: "Survey duplicated successfully",
    };
  },

  /**
   * Get survey responses (for survey owner/admin)
   */
  async getResponses(
    surveyId: string,
    options?: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<ApiResponse<{
    responses: SurveyResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    if (isBackendConfigured) {
      const params = new URLSearchParams();
      if (options?.page) params.append("page", String(options.page));
      if (options?.limit) params.append("limit", String(options.limit));
      if (options?.startDate) params.append("startDate", options.startDate);
      if (options?.endDate) params.append("endDate", options.endDate);

      const queryString = params.toString();
      const path = queryString
        ? `${SURVEY_ROUTES.responses(surveyId)}?${queryString}`
        : SURVEY_ROUTES.responses(surveyId);

      const response = await fetchJson<{
        responses: SurveyResponse[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(path);
      if (response.success) return response;
    }

    await delay();
    const survey = getSurveyById(surveyId);
    if (!survey) {
      return {
        success: false,
        data: {
          responses: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        },
        error: "Survey not found",
      };
    }

    // Generate mock responses based on survey data
    const questions = getSurveyQuestionsForSurvey(surveyId);
    const totalResponses = survey.totalResponses || 0;
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const mockResponses: SurveyResponse[] = Array.from(
      { length: Math.min(totalResponses, limit) },
      (_, index) => {
        const responseId = `resp_${surveyId}_${(page - 1) * limit + index}`;
        const userIndex = index % mockUsers.length;
        const user = mockUsers[userIndex];

        // Generate random responses for each question
        const responses: Record<string, unknown> = {};
        questions.forEach((q) => {
          switch (q.type.toLowerCase()) {
            case 'rating':
              responses[q.id] = Math.floor(Math.random() * 5) + 1;
              break;
            case 'radio':
            case 'dropdown':
              try {
                const opts = JSON.parse(q.options || '[]');
                if (Array.isArray(opts) && opts.length > 0) {
                  responses[q.id] = opts[Math.floor(Math.random() * opts.length)];
                }
              } catch {
                responses[q.id] = 'Option 1';
              }
              break;
            case 'checkbox':
              try {
                const opts = JSON.parse(q.options || '[]');
                if (Array.isArray(opts) && opts.length > 0) {
                  const numSelected = Math.floor(Math.random() * opts.length) + 1;
                  responses[q.id] = opts
                    .sort(() => Math.random() - 0.5)
                    .slice(0, numSelected);
                }
              } catch {
                responses[q.id] = ['Option 1'];
              }
              break;
            case 'boolean':
              responses[q.id] = Math.random() > 0.5;
              break;
            case 'number':
              const min = q.minValue || 0;
              const max = q.maxValue || 100;
              responses[q.id] = Math.floor(Math.random() * (max - min)) + min;
              break;
            case 'text':
            case 'paragraph':
              const sampleTexts = [
                'Great experience overall!',
                'Could use some improvements.',
                'Very satisfied with the service.',
                'The platform is easy to use.',
                'Would recommend to others.',
                'Quick and efficient.',
                'Needs more features.',
                'Love the user interface.',
              ];
              responses[q.id] = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
              break;
            case 'date':
              const date = new Date();
              date.setDate(date.getDate() - Math.floor(Math.random() * 30));
              responses[q.id] = date.toISOString().split('T')[0];
              break;
            case 'time':
              const hours = Math.floor(Math.random() * 12) + 8;
              const minutes = Math.floor(Math.random() * 60);
              responses[q.id] = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
              break;
            default:
              responses[q.id] = 'Sample response';
          }
        });

        // Create date spread over last 14 days
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 14));
        createdAt.setHours(Math.floor(Math.random() * 14) + 8);
        createdAt.setMinutes(Math.floor(Math.random() * 60));

        return {
          id: responseId,
          userId: user.id,
          surveyId,
          responses: JSON.stringify(responses),
          user,
          createdAt: createdAt.toISOString(),
          updatedAt: createdAt.toISOString(),
        };
      }
    );

    // Sort by createdAt descending
    mockResponses.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return {
      success: true,
      data: {
        responses: mockResponses,
        pagination: {
          page,
          limit,
          total: totalResponses,
          totalPages: Math.ceil(totalResponses / limit),
        },
      },
    };
  },

  /**
   * Get detailed analytics for a survey
   */
  async getDetailedAnalytics(
    surveyId: string
  ): Promise<ApiResponse<{
    totalResponses: number;
    completionRate: number;
    averageCompletionTime: number;
    responsesByDay: { date: string; count: number }[];
    questionStats: {
      questionId: string;
      questionText: string;
      questionType: string;
      answerDistribution: Record<string, number>;
    }[];
  }>> {
    if (isBackendConfigured) {
      const response = await fetchJson<{
        totalResponses: number;
        completionRate: number;
        averageCompletionTime: number;
        responsesByDay: { date: string; count: number }[];
        questionStats: {
          questionId: string;
          questionText: string;
          questionType: string;
          answerDistribution: Record<string, number>;
        }[];
      }>(SURVEY_ROUTES.analytics(surveyId));
      if (response.success) return response;
    }

    await delay();
    const survey = getSurveyById(surveyId);
    if (!survey) {
      return {
        success: false,
        data: {
          totalResponses: 0,
          completionRate: 0,
          averageCompletionTime: 0,
          responsesByDay: [],
          questionStats: [],
        },
        error: "Survey not found",
      };
    }

    const questions = getSurveyQuestionsForSurvey(surveyId);
    const totalResponses = survey.totalResponses || 0;

    // Generate mock responses by day (last 14 days)
    const responsesByDay: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      responsesByDay.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * Math.max(1, totalResponses / 7)) + (i === 0 ? 5 : 0),
      });
    }

    // Generate mock question statistics
    const questionStats = questions.map((q) => {
      const stats: {
        questionId: string;
        questionText: string;
        questionType: string;
        answerDistribution: Record<string, number>;
      } = {
        questionId: q.id,
        questionText: q.text,
        questionType: q.type,
        answerDistribution: {},
      };

      switch (q.type.toLowerCase()) {
        case 'rating':
          for (let i = 1; i <= 5; i++) {
            stats.answerDistribution[String(i)] = Math.floor(Math.random() * 50) + 10;
          }
          break;
        case 'radio':
        case 'dropdown':
          try {
            const opts = JSON.parse(q.options || '[]');
            if (Array.isArray(opts)) {
              opts.forEach((opt: string) => {
                stats.answerDistribution[opt] = Math.floor(Math.random() * 60) + 5;
              });
            }
          } catch {
            stats.answerDistribution['Option 1'] = 30;
            stats.answerDistribution['Option 2'] = 25;
          }
          break;
        case 'boolean':
          stats.answerDistribution['Yes'] = Math.floor(Math.random() * 80) + 20;
          stats.answerDistribution['No'] = Math.floor(Math.random() * 60) + 10;
          break;
        case 'checkbox':
          try {
            const opts = JSON.parse(q.options || '[]');
            if (Array.isArray(opts)) {
              opts.forEach((opt: string) => {
                stats.answerDistribution[opt] = Math.floor(Math.random() * 40) + 5;
              });
            }
          } catch {
            stats.answerDistribution['Option A'] = 25;
            stats.answerDistribution['Option B'] = 35;
          }
          break;
        default:
          // Text questions - show top terms
          stats.answerDistribution['great'] = 45;
          stats.answerDistribution['good'] = 38;
          stats.answerDistribution['easy'] = 32;
          stats.answerDistribution['improve'] = 18;
          stats.answerDistribution['recommend'] = 28;
      }

      return stats;
    });

    return {
      success: true,
      data: {
        totalResponses,
        completionRate: ((survey.totalResponses || 0) / (survey.maxResponses || 500)) * 100,
        averageCompletionTime: 180 + Math.floor(Math.random() * 120), // 3-5 minutes
        responsesByDay,
        questionStats,
      },
    };
  },

  /**
   * Check if user is survey owner
   */
  async isSurveyOwner(surveyId: string, userId: string): Promise<boolean> {
    const survey = getSurveyById(surveyId);
    return survey?.userId === userId;
  },
};

export default surveyApi;
