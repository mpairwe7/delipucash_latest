/**
 * Question API Service
 * Dedicated API layer for question-related operations
 * Supports both mock data and real backend integration
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
import {
  mockQuestions,
  mockResponses,
  mockRewardQuestions,
  mockCurrentUser,
  getQuestionById,
  getResponsesForQuestion,
} from "@/data/mockData";

// Simulate network delay
const delay = (ms: number = 500): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
const isBackendConfigured = Boolean(API_BASE_URL);

// API Routes
const QUESTION_ROUTES = {
  list: "/api/questions",
  get: (id: string) => `/api/questions/${id}`,
  create: "/api/questions",
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
  rewardQuestions: "/api/rewards/questions",
  rewardQuestion: (id: string) => `/api/rewards/questions/${id}`,
  submitRewardAnswer: (id: string) => `/api/rewards/questions/${id}/answer`,
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

// Question statistics interface
export interface QuestionStats {
  totalQuestions: number;
  totalAnswered: number;
  totalEarned: number;
  instantRewardQuestions: number;
  averageReward: number;
  topCategories: { category: string; count: number }[];
}

// Question filter options
export interface QuestionFilters {
  category?: string;
  search?: string;
  sortBy?: "newest" | "oldest" | "reward" | "answers" | "popular";
  isInstantReward?: boolean;
  userId?: string;
  page?: number;
  limit?: number;
}

// Question with extended details
export interface QuestionWithDetails extends Question {
  responses: Response[];
  totalResponses: number;
  topResponses: Response[];
  isAnswered?: boolean;
  userResponse?: Response;
}

// Create question data
export interface CreateQuestionData {
  text: string;
  category?: string;
  rewardAmount?: number;
  isInstantReward?: boolean;
  userId?: string;
}

// Create reward question data
export interface CreateRewardQuestionData {
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
}

// Response with author details (simplified user info)
export interface ResponseWithAuthor extends Omit<Response, "user"> {
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
}

// ===========================================
// Question API
// ===========================================
export const questionApi = {
  /**
   * Get all questions with optional filtering and pagination
   */
  async getAll(filters?: QuestionFilters): Promise<PaginatedResponse<Question>> {
    if (isBackendConfigured) {
      const params = new URLSearchParams();
      if (filters?.category) params.append("category", filters.category);
      if (filters?.search) params.append("search", filters.search);
      if (filters?.sortBy) params.append("sortBy", filters.sortBy);
      if (filters?.isInstantReward !== undefined)
        params.append("isInstantReward", String(filters.isInstantReward));
      if (filters?.userId) params.append("userId", filters.userId);
      if (filters?.page) params.append("page", String(filters.page));
      if (filters?.limit) params.append("limit", String(filters.limit));

      const queryString = params.toString();
      const path = queryString
        ? `${QUESTION_ROUTES.list}?${queryString}`
        : QUESTION_ROUTES.list;

      const response = await fetchJson<{
        data: Question[];
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
    let questions = [...mockQuestions];

    // Apply filters
    if (filters?.category) {
      questions = questions.filter((q) => q.category === filters.category);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      questions = questions.filter((q) =>
        q.text.toLowerCase().includes(searchLower)
      );
    }

    if (filters?.isInstantReward !== undefined) {
      questions = questions.filter(
        (q) => q.isInstantReward === filters.isInstantReward
      );
    }

    if (filters?.userId) {
      questions = questions.filter((q) => q.userId === filters.userId);
    }

    // Apply sorting
    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case "newest":
          questions.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          break;
        case "oldest":
          questions.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          break;
        case "reward":
          questions.sort(
            (a, b) => (b.rewardAmount || 0) - (a.rewardAmount || 0)
          );
          break;
        case "answers":
          questions.sort(
            (a, b) => (b.totalAnswers || 0) - (a.totalAnswers || 0)
          );
          break;
        case "popular":
          questions.sort(
            (a, b) =>
              (b.totalAnswers || 0) + (b.rewardAmount || 0) * 10 -
              ((a.totalAnswers || 0) + (a.rewardAmount || 0) * 10)
          );
          break;
      }
    }

    // Paginate
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
   * Get recent questions
   */
  async getRecent(limit: number = 10): Promise<ApiResponse<Question[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Question[]>(
        `${QUESTION_ROUTES.recent}?limit=${limit}`
      );
      if (response.success) return response;
    }

    await delay();
    const recent = [...mockQuestions]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);

    return {
      success: true,
      data: recent,
    };
  },

  /**
   * Get popular questions
   */
  async getPopular(limit: number = 10): Promise<ApiResponse<Question[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Question[]>(
        `${QUESTION_ROUTES.popular}?limit=${limit}`
      );
      if (response.success) return response;
    }

    await delay();
    const popular = [...mockQuestions]
      .sort((a, b) => (b.totalAnswers || 0) - (a.totalAnswers || 0))
      .slice(0, limit);

    return {
      success: true,
      data: popular,
    };
  },

  /**
   * Get trending questions
   */
  async getTrending(limit: number = 10): Promise<ApiResponse<Question[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Question[]>(
        `${QUESTION_ROUTES.trending}?limit=${limit}`
      );
      if (response.success) return response;
    }

    await delay();
    // Trending = recent + popular (weighted by recency and engagement)
    const now = Date.now();
    const trending = [...mockQuestions]
      .map((q) => {
        const ageInHours =
          (now - new Date(q.createdAt).getTime()) / (1000 * 60 * 60);
        const recencyScore = Math.max(0, 100 - ageInHours);
        const engagementScore = (q.totalAnswers || 0) * 10;
        return { ...q, trendScore: recencyScore + engagementScore };
      })
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, limit);

    return {
      success: true,
      data: trending,
    };
  },

  /**
   * Get instant reward questions
   */
  async getInstantReward(limit: number = 10): Promise<ApiResponse<Question[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Question[]>(
        `${QUESTION_ROUTES.instant}?limit=${limit}`
      );
      if (response.success) return response;
    }

    await delay();
    const instant = mockQuestions
      .filter((q) => q.isInstantReward)
      .slice(0, limit);

    return {
      success: true,
      data: instant,
    };
  },

  /**
   * Get question by ID with responses
   */
  async getById(
    questionId: string
  ): Promise<ApiResponse<QuestionWithDetails | null>> {
    if (isBackendConfigured) {
      const response = await fetchJson<QuestionWithDetails>(
        QUESTION_ROUTES.get(questionId)
      );
      if (response.success) return response;
    }

    await delay();
    const question = getQuestionById(questionId);
    if (!question) {
      return { success: false, data: null, error: "Question not found" };
    }

    const responses = getResponsesForQuestion(questionId);
    const topResponses = [...responses]
      .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
      .slice(0, 3);

    return {
      success: true,
      data: {
        ...question,
        responses,
        totalResponses: responses.length,
        topResponses,
      },
    };
  },

  /**
   * Search questions
   */
  async search(query: string): Promise<ApiResponse<Question[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Question[]>(
        `${QUESTION_ROUTES.search}?q=${encodeURIComponent(query)}`
      );
      if (response.success) return response;
    }

    await delay();
    const lowerQuery = query.toLowerCase();
    const results = mockQuestions.filter((q) =>
      q.text.toLowerCase().includes(lowerQuery)
    );

    return {
      success: true,
      data: results,
    };
  },

  /**
   * Create a new question
   */
  async create(data: CreateQuestionData): Promise<ApiResponse<Question>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Question>(QUESTION_ROUTES.create, {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (response.success) return response;
    }

    await delay();
    const newQuestion: Question = {
      id: `question_${Date.now()}`,
      text: data.text,
      userId: data.userId || mockCurrentUser.id,
      category: data.category,
      rewardAmount: data.rewardAmount || 0,
      isInstantReward: data.isInstantReward || false,
      totalAnswers: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: newQuestion,
      message: "Question created successfully",
    };
  },

  /**
   * Update a question
   */
  async update(
    questionId: string,
    data: Partial<CreateQuestionData>
  ): Promise<ApiResponse<Question>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Question>(
        QUESTION_ROUTES.update(questionId),
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      );
      if (response.success) return response;
    }

    await delay();
    const question = getQuestionById(questionId);
    if (!question) {
      return {
        success: false,
        data: {} as Question,
        error: "Question not found",
      };
    }

    const updatedQuestion: Question = {
      ...question,
      text: data.text ?? question.text,
      category: data.category ?? question.category,
      rewardAmount: data.rewardAmount ?? question.rewardAmount,
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: updatedQuestion,
      message: "Question updated successfully",
    };
  },

  /**
   * Delete a question
   */
  async delete(questionId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    if (isBackendConfigured) {
      const response = await fetchJson<{ deleted: boolean }>(
        QUESTION_ROUTES.delete(questionId),
        { method: "DELETE" }
      );
      if (response.success) return response;
    }

    await delay();
    const question = getQuestionById(questionId);
    if (!question) {
      return {
        success: false,
        data: { deleted: false },
        error: "Question not found",
      };
    }

    return {
      success: true,
      data: { deleted: true },
      message: "Question deleted successfully",
    };
  },

  /**
   * Get responses for a question
   */
  async getResponses(questionId: string): Promise<ApiResponse<Response[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Response[]>(
        QUESTION_ROUTES.responses(questionId)
      );
      if (response.success) return response;
    }

    await delay();
    const responses = getResponsesForQuestion(questionId);

    return {
      success: true,
      data: responses,
    };
  },

  /**
   * Submit a response to a question
   */
  async submitResponse(
    questionId: string,
    responseText: string
  ): Promise<ApiResponse<Response>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Response>(
        QUESTION_ROUTES.submitResponse(questionId),
        {
          method: "POST",
          body: JSON.stringify({ responseText }),
        }
      );
      if (response.success) return response;
    }

    await delay();
    const question = getQuestionById(questionId);
    if (!question) {
      return {
        success: false,
        data: {} as Response,
        error: "Question not found",
      };
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
      message: `Answer submitted! You earned $${question.rewardAmount?.toFixed(2) || "0.00"}`,
    };
  },

  /**
   * Like a response
   */
  async likeResponse(responseId: string): Promise<ApiResponse<Response>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Response>(
        `/api/responses/${responseId}/like`,
        { method: "POST" }
      );
      if (response.success) return response;
    }

    await delay();
    const response = mockResponses.find((r) => r.id === responseId);
    if (!response) {
      return {
        success: false,
        data: {} as Response,
        error: "Response not found",
      };
    }

    return {
      success: true,
      data: {
        ...response,
        likesCount: (response.likesCount || 0) + 1,
        isLiked: true,
        isDisliked: false,
      },
    };
  },

  /**
   * Dislike a response
   */
  async dislikeResponse(responseId: string): Promise<ApiResponse<Response>> {
    if (isBackendConfigured) {
      const response = await fetchJson<Response>(
        `/api/responses/${responseId}/dislike`,
        { method: "POST" }
      );
      if (response.success) return response;
    }

    await delay();
    const response = mockResponses.find((r) => r.id === responseId);
    if (!response) {
      return {
        success: false,
        data: {} as Response,
        error: "Response not found",
      };
    }

    return {
      success: true,
      data: {
        ...response,
        dislikesCount: (response.dislikesCount || 0) + 1,
        isDisliked: true,
        isLiked: false,
      },
    };
  },

  /**
   * Get question categories
   */
  async getCategories(): Promise<
    ApiResponse<{ id: string; name: string; count: number }[]>
  > {
    if (isBackendConfigured) {
      const response = await fetchJson<
        { id: string; name: string; count: number }[]
      >(QUESTION_ROUTES.categories);
      if (response.success) return response;
    }

    await delay();
    // Generate categories from questions
    const categoryCounts = mockQuestions.reduce(
      (acc, q) => {
        const cat = q.category || "General";
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const categories = Object.entries(categoryCounts).map(([name, count]) => ({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      count,
    }));

    return {
      success: true,
      data: categories,
    };
  },

  /**
   * Get questions by user
   */
  async getByUser(
    userId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Question>> {
    if (isBackendConfigured) {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append("page", String(params.page));
      if (params?.limit) queryParams.append("limit", String(params.limit));
      const queryString = queryParams.toString();
      const path = queryString
        ? `${QUESTION_ROUTES.byUser(userId)}?${queryString}`
        : QUESTION_ROUTES.byUser(userId);

      const response = await fetchJson<{
        data: Question[];
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
    const userQuestions = mockQuestions.filter((q) => q.userId === userId);
    const start = (page - 1) * limit;
    const paginatedQuestions = userQuestions.slice(start, start + limit);

    return {
      success: true,
      data: paginatedQuestions,
      pagination: {
        page,
        limit,
        total: userQuestions.length,
        totalPages: Math.ceil(userQuestions.length / limit),
      },
    };
  },

  /**
   * Get question statistics
   */
  async getStats(): Promise<ApiResponse<QuestionStats>> {
    await delay();

    const totalQuestions = mockQuestions.length;
    const instantRewardQuestions = mockQuestions.filter(
      (q) => q.isInstantReward
    ).length;
    const totalEarned = mockQuestions.reduce(
      (sum, q) => sum + (q.rewardAmount || 0),
      0
    );

    // Calculate top categories
    const categoryCounts = mockQuestions.reduce(
      (acc, q) => {
        const cat = q.category || "General";
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topCategories = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const stats: QuestionStats = {
      totalQuestions,
      totalAnswered: Math.floor(totalQuestions * 0.7),
      totalEarned,
      instantRewardQuestions,
      averageReward: totalQuestions > 0 ? totalEarned / totalQuestions : 0,
      topCategories,
    };

    return {
      success: true,
      data: stats,
    };
  },

  // ===========================================
  // Reward Questions API
  // ===========================================

  /**
   * Get all reward questions
   */
  async getRewardQuestions(): Promise<ApiResponse<RewardQuestion[]>> {
    if (isBackendConfigured) {
      const response = await fetchJson<RewardQuestion[]>(
        QUESTION_ROUTES.rewardQuestions
      );
      if (response.success) return response;
    }

    await delay();
    const activeRewardQuestions = mockRewardQuestions.filter(
      (rq) => rq.isActive && !rq.isCompleted
    );

    return {
      success: true,
      data: activeRewardQuestions,
    };
  },

  /**
   * Get reward question by ID
   */
  async getRewardQuestionById(
    id: string
  ): Promise<ApiResponse<RewardQuestion | null>> {
    if (isBackendConfigured) {
      const response = await fetchJson<RewardQuestion>(
        QUESTION_ROUTES.rewardQuestion(id)
      );
      if (response.success) return response;
    }

    await delay();
    const rewardQuestion = mockRewardQuestions.find((rq) => rq.id === id);
    if (!rewardQuestion) {
      return {
        success: false,
        data: null,
        error: "Reward question not found",
      };
    }

    return {
      success: true,
      data: rewardQuestion,
    };
  },

  /**
   * Create a reward question
   */
  async createRewardQuestion(
    data: CreateRewardQuestionData
  ): Promise<ApiResponse<RewardQuestion>> {
    if (isBackendConfigured) {
      const response = await fetchJson<RewardQuestion>(
        QUESTION_ROUTES.rewardQuestions,
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      );
      if (response.success) return response;
    }

    await delay(800);
    const newRewardQuestion: RewardQuestion = {
      id: `reward_question_${Date.now()}`,
      text: data.text,
      options: data.options.reduce(
        (acc, opt, idx) => {
          acc[`option${idx + 1}`] = opt;
          return acc;
        },
        {} as Record<string, unknown>
      ),
      correctAnswer: data.correctAnswer,
      rewardAmount: data.rewardAmount,
      expiryTime: data.expiryTime || null,
      isActive: true,
      userId: data.userId,
      isInstantReward: data.isInstantReward ?? true,
      maxWinners: data.maxWinners || 2,
      winnersCount: 0,
      isCompleted: false,
      paymentProvider: data.paymentProvider || null,
      phoneNumber: data.phoneNumber || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: newRewardQuestion,
      message: "Reward question created successfully",
    };
  },

  /**
   * Submit answer to reward question
   */
  async submitRewardAnswer(
    questionId: string,
    answer: string
  ): Promise<ApiResponse<RewardAnswerResult>> {
    if (isBackendConfigured) {
      const response = await fetchJson<RewardAnswerResult>(
        QUESTION_ROUTES.submitRewardAnswer(questionId),
        {
          method: "POST",
          body: JSON.stringify({ answer }),
        }
      );
      if (response.success) return response;
    }

    await delay();
    const rewardQuestion = mockRewardQuestions.find(
      (rq) => rq.id === questionId
    );
    if (!rewardQuestion) {
      return {
        success: false,
        data: {
          isCorrect: false,
          rewardEarned: 0,
          remainingSpots: 0,
          isExpired: false,
          message: "Question not found",
        },
        error: "Question not found",
      };
    }

    // Check if expired
    if (rewardQuestion.expiryTime) {
      const isExpired = new Date(rewardQuestion.expiryTime) < new Date();
      if (isExpired) {
        return {
          success: true,
          data: {
            isCorrect: false,
            rewardEarned: 0,
            remainingSpots: 0,
            isExpired: true,
            message: "This question has expired",
          },
        };
      }
    }

    // Check if completed
    if (rewardQuestion.isCompleted) {
      return {
        success: true,
        data: {
          isCorrect: false,
          rewardEarned: 0,
          remainingSpots: 0,
          isExpired: false,
          isCompleted: true,
          message: "All reward spots have been claimed",
        },
      };
    }

    // Check answer
    const isCorrect =
      answer.toLowerCase() === rewardQuestion.correctAnswer.toLowerCase();
    const remainingSpots = rewardQuestion.maxWinners - rewardQuestion.winnersCount;

    if (isCorrect && remainingSpots > 0) {
      return {
        success: true,
        data: {
          isCorrect: true,
          rewardEarned: rewardQuestion.rewardAmount,
          remainingSpots: remainingSpots - 1,
          isExpired: false,
          message: `Congratulations! You earned $${rewardQuestion.rewardAmount.toFixed(2)}!`,
        },
      };
    }

    return {
      success: true,
      data: {
        isCorrect: false,
        rewardEarned: 0,
        remainingSpots,
        isExpired: false,
        message: isCorrect
          ? "Correct, but all reward spots have been claimed"
          : "Incorrect answer. Try again!",
      },
    };
  },
};

export default questionApi;
