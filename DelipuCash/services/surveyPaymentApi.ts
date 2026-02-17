/**
 * Survey Payment API Service
 * 
 * Comprehensive API layer for survey subscription payments.
 * Uses REST API for all data operations - No mock data fallbacks.
 * 
 * @module services/surveyPaymentApi
 */

import {
  ApiResponse,
  PaymentStatus,
  SubscriptionStatus,
  SurveySubscriptionType,
  PaymentProvider,
} from "@/types";
import { useAuthStore } from "@/utils/auth/store";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Survey subscription plan configuration
 */
export interface SurveySubscriptionPlan {
  id: string;
  type: SurveySubscriptionType;
  name: string;
  description: string;
  price: number;
  currency: string;
  durationDays: number;
  features: string[];
  isPopular?: boolean;
  isBestValue?: boolean;
  savings?: string;
  isActive: boolean;
}

/**
 * Survey subscription record
 */
export interface SurveySubscription {
  id: string;
  userId: string;
  planId: string;
  planType: SurveySubscriptionType;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  paymentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Survey payment record
 */
export interface SurveyPayment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  provider: PaymentProvider;
  planType: SurveySubscriptionType;
  transactionId: string;
  externalReference: string | null;
  status: PaymentStatus;
  statusMessage: string | null;
  subscriptionId: string | null;
  initiatedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payment initiation request
 */
export interface InitiatePaymentRequest {
  phoneNumber: string;
  provider: PaymentProvider;
  planType: SurveySubscriptionType;
  userId?: string;
}

/**
 * Payment initiation response
 */
export interface InitiatePaymentResponse {
  payment: SurveyPayment;
  message: string;
  requiresConfirmation: boolean;
  expiresAt: string;
}

/**
 * Payment status response
 */
export interface PaymentStatusResponse {
  payment: SurveyPayment;
  subscription: SurveySubscription | null;
  user?: {
    id: string;
    surveysubscriptionStatus: SubscriptionStatus;
  };
}

/**
 * Subscription status response
 */
export interface SubscriptionStatusResponse {
  hasActiveSubscription: boolean;
  subscription: SurveySubscription | null;
  remainingDays: number;
  canRenew: boolean;
  availablePlans: SurveySubscriptionPlan[];
}

// ============================================================================
// API CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";

// Validate that API URL is configured
if (!API_BASE_URL) {
  console.warn('[SurveyPaymentAPI] EXPO_PUBLIC_API_URL is not configured. API calls will fail.');
}

// ============================================================================
// API ROUTES
// ============================================================================

const SURVEY_PAYMENT_ROUTES = {
  plans: "/api/survey-subscriptions/plans",
  status: "/api/survey-subscriptions/status",
  initiate: "/api/survey-payments/initiate",
  checkStatus: (paymentId: string) => `/api/survey-payments/${paymentId}/status`,
  history: "/api/survey-payments/history",
  cancel: (subscriptionId: string) => `/api/survey-subscriptions/${subscriptionId}/cancel`,
} as const;

// ============================================================================
// FETCH HELPER
// ============================================================================

/** Get auth token from Zustand store for protected API calls */
const getAuthHeaders = (): Record<string, string> => {
  const token = useAuthStore.getState().auth?.token || null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function fetchJson<T>(
  path: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...(init?.headers || {}),
      },
      ...init,
    });

    const json = await response.json();
    if (!response.ok) {
      return {
        success: false,
        data: json as T,
        error: json?.message || json?.error || "Request failed",
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

// ============================================================================
// API SERVICE
// ============================================================================

export const surveyPaymentApi = {
  /**
   * Get all available subscription plans
   */
  async getPlans(): Promise<ApiResponse<SurveySubscriptionPlan[]>> {
    return fetchJson<SurveySubscriptionPlan[]>(SURVEY_PAYMENT_ROUTES.plans);
  },

  /**
   * Get subscription status for current user
   */
  async getSubscriptionStatus(): Promise<ApiResponse<SubscriptionStatusResponse>> {
    const userId = useAuthStore.getState().auth?.user?.id;
    const query = userId ? `?userId=${userId}` : '';
    return fetchJson<SubscriptionStatusResponse>(`${SURVEY_PAYMENT_ROUTES.status}${query}`);
  },

  /**
   * Initiate a payment for subscription
   */
  async initiatePayment(request: InitiatePaymentRequest): Promise<ApiResponse<InitiatePaymentResponse>> {
    // Include userId from auth store if not already provided
    const userId = request.userId || useAuthStore.getState().auth?.user?.id;
    return fetchJson<InitiatePaymentResponse>(SURVEY_PAYMENT_ROUTES.initiate, {
      method: "POST",
      body: JSON.stringify({ ...request, userId }),
    });
  },

  /**
   * Check payment status
   */
  async checkPaymentStatus(paymentId: string): Promise<ApiResponse<PaymentStatusResponse>> {
    return fetchJson<PaymentStatusResponse>(SURVEY_PAYMENT_ROUTES.checkStatus(paymentId));
  },

  /**
   * Get payment history for current user
   */
  async getPaymentHistory(): Promise<ApiResponse<SurveyPayment[]>> {
    return fetchJson<SurveyPayment[]>(SURVEY_PAYMENT_ROUTES.history);
  },

  /**
   * Cancel subscription (disable auto-renew)
   */
  async cancelSubscription(subscriptionId: string): Promise<ApiResponse<SurveySubscription>> {
    return fetchJson<SurveySubscription>(SURVEY_PAYMENT_ROUTES.cancel(subscriptionId), {
      method: "POST",
    });
  },

  /**
   * Simulate payment completion (for testing only)
   */
  async simulatePaymentCompletion(paymentId: string, success: boolean): Promise<ApiResponse<PaymentStatusResponse>> {
    return fetchJson<PaymentStatusResponse>(`/api/survey-payments/${paymentId}/simulate`, {
      method: "POST",
      body: JSON.stringify({ success }),
    });
  },
};

export default surveyPaymentApi;
