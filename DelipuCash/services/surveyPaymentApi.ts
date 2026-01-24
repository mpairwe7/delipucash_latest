/**
 * Survey Payment API Service
 * 
 * Comprehensive API layer for survey subscription payments.
 * Supports both mock data for development and real backend integration.
 * 
 * @module services/surveyPaymentApi
 */

import {
  ApiResponse,
  PaymentStatus,
  SubscriptionStatus,
  SurveySubscriptionType,
  PaymentProvider,
  AppUser,
} from "@/types";
import { mockCurrentUser } from "@/data/mockData";

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
 * Payment status check response
 */
export interface PaymentStatusResponse {
  payment: SurveyPayment;
  subscription: SurveySubscription | null;
  user: Partial<AppUser>;
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
// CONSTANTS
// ============================================================================

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
const isBackendConfigured = Boolean(API_BASE_URL);

// Simulate network delay
const delay = (ms: number = 500): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// MOCK DATA
// ============================================================================

/**
 * Mock subscription plans
 */
export const mockSubscriptionPlans: SurveySubscriptionPlan[] = [
  {
    id: "plan_once",
    type: SurveySubscriptionType.ONCE,
    name: "Single Access",
    description: "One-time access to a single survey",
    price: 500,
    currency: "UGX",
    durationDays: 1,
    features: [
      "Access to 1 survey",
      "Basic analytics",
    ],
    isActive: true,
  },
  {
    id: "plan_daily",
    type: SurveySubscriptionType.DAILY,
    name: "Daily",
    description: "24 hours of unlimited survey access",
    price: 300,
    currency: "UGX",
    durationDays: 1,
    features: [
      "Unlimited surveys for 24 hours",
      "Basic analytics",
    ],
    isActive: true,
  },
  {
    id: "plan_weekly",
    type: SurveySubscriptionType.WEEKLY,
    name: "Weekly",
    description: "7 days of unlimited survey access",
    price: 1500,
    currency: "UGX",
    durationDays: 7,
    features: [
      "Unlimited surveys",
      "Basic analytics",
      "Email support",
    ],
    isActive: true,
  },
  {
    id: "plan_monthly",
    type: SurveySubscriptionType.MONTHLY,
    name: "Monthly",
    description: "30 days of unlimited survey access",
    price: 5000,
    currency: "UGX",
    durationDays: 30,
    features: [
      "Unlimited surveys",
      "Advanced analytics",
      "Priority support",
      "Export data",
    ],
    isPopular: true,
    isActive: true,
  },
  {
    id: "plan_quarterly",
    type: SurveySubscriptionType.QUARTERLY,
    name: "Quarterly",
    description: "3 months of unlimited survey access",
    price: 12000,
    currency: "UGX",
    durationDays: 90,
    features: [
      "Unlimited surveys",
      "Advanced analytics",
      "Priority support",
      "Export data",
      "Custom branding",
    ],
    savings: "Save 20%",
    isActive: true,
  },
  {
    id: "plan_half_yearly",
    type: SurveySubscriptionType.HALF_YEARLY,
    name: "Half Yearly",
    description: "6 months of unlimited survey access",
    price: 22000,
    currency: "UGX",
    durationDays: 180,
    features: [
      "Unlimited surveys",
      "Advanced analytics",
      "Priority support",
      "Export data",
      "Custom branding",
      "API access",
    ],
    savings: "Save 27%",
    isBestValue: true,
    isActive: true,
  },
  {
    id: "plan_yearly",
    type: SurveySubscriptionType.YEARLY,
    name: "Yearly",
    description: "365 days of unlimited survey access",
    price: 40000,
    currency: "UGX",
    durationDays: 365,
    features: [
      "Unlimited surveys",
      "Advanced analytics",
      "Priority support",
      "Export data",
      "API access",
      "Custom branding",
      "Dedicated account manager",
    ],
    savings: "Save 33%",
    isActive: true,
  },
  {
    id: "plan_lifetime",
    type: SurveySubscriptionType.LIFETIME,
    name: "Lifetime",
    description: "Unlimited lifetime access",
    price: 150000,
    currency: "UGX",
    durationDays: 36500, // ~100 years
    features: [
      "Unlimited surveys forever",
      "All premium features",
      "VIP support",
      "Early access to new features",
      "No recurring payments",
    ],
    savings: "Best long-term value",
    isActive: true,
  },
];

/**
 * Mock subscriptions storage
 */
let mockSubscriptions: SurveySubscription[] = [
  {
    id: "sub_001",
    userId: "user_001",
    planId: "plan_monthly",
    planType: SurveySubscriptionType.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-31T23:59:59Z",
    autoRenew: true,
    paymentId: "spay_001",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

/**
 * Mock payments storage
 */
let mockSurveyPayments: SurveyPayment[] = [
  {
    id: "spay_001",
    userId: "user_001",
    amount: 2000,
    currency: "UGX",
    phoneNumber: "+256700123456",
    provider: PaymentProvider.MTN,
    planType: SurveySubscriptionType.MONTHLY,
    transactionId: "TXN-SURV-20260101-001",
    externalReference: "MOMO-REF-12345",
    status: PaymentStatus.SUCCESSFUL,
    statusMessage: "Payment completed successfully",
    subscriptionId: "sub_001",
    initiatedAt: "2026-01-01T00:00:00Z",
    completedAt: "2026-01-01T00:01:30Z",
    failedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:01:30Z",
  },
  {
    id: "spay_002",
    userId: "user_002",
    amount: 1000,
    currency: "UGX",
    phoneNumber: "+256700234567",
    provider: PaymentProvider.AIRTEL,
    planType: SurveySubscriptionType.WEEKLY,
    transactionId: "TXN-SURV-20260115-002",
    externalReference: null,
    status: PaymentStatus.PENDING,
    statusMessage: "Waiting for user confirmation",
    subscriptionId: null,
    initiatedAt: "2026-01-15T10:30:00Z",
    completedAt: null,
    failedAt: null,
    createdAt: "2026-01-15T10:30:00Z",
    updatedAt: "2026-01-15T10:30:00Z",
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique transaction ID
 */
const generateTransactionId = (): string => {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `TXN-SURV-${date}-${random}`;
};

/**
 * Calculate subscription end date based on plan
 */
const calculateEndDate = (startDate: Date, durationDays: number): Date => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);
  return endDate;
};

/**
 * Get plan by type
 */
const getPlanByType = (type: SurveySubscriptionType): SurveySubscriptionPlan | undefined => {
  return mockSubscriptionPlans.find(p => p.type === type);
};

/**
 * Get user's active subscription
 */
const getUserActiveSubscription = (userId: string): SurveySubscription | null => {
  const now = new Date();
  return mockSubscriptions.find(
    s => s.userId === userId && 
    s.status === SubscriptionStatus.ACTIVE &&
    new Date(s.endDate) > now
  ) || null;
};

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

// ============================================================================
// API SERVICE
// ============================================================================

export const surveyPaymentApi = {
  /**
   * Get all available subscription plans
   */
  async getPlans(): Promise<ApiResponse<SurveySubscriptionPlan[]>> {
    if (isBackendConfigured) {
      return fetchJson<SurveySubscriptionPlan[]>(SURVEY_PAYMENT_ROUTES.plans);
    }

    await delay(300);
    return {
      success: true,
      data: mockSubscriptionPlans.filter(p => p.isActive),
    };
  },

  /**
   * Get subscription status for current user
   */
  async getSubscriptionStatus(userId?: string): Promise<ApiResponse<SubscriptionStatusResponse>> {
    if (isBackendConfigured) {
      return fetchJson<SubscriptionStatusResponse>(SURVEY_PAYMENT_ROUTES.status);
    }

    await delay(400);
    const currentUserId = userId || mockCurrentUser.id;
    const subscription = getUserActiveSubscription(currentUserId);
    
    let remainingDays = 0;
    if (subscription) {
      const now = new Date();
      const endDate = new Date(subscription.endDate);
      remainingDays = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    return {
      success: true,
      data: {
        hasActiveSubscription: subscription !== null,
        subscription,
        remainingDays,
        canRenew: remainingDays <= 7, // Can renew within last 7 days
        availablePlans: mockSubscriptionPlans.filter(p => p.isActive),
      },
    };
  },

  /**
   * Initiate a payment for subscription
   */
  async initiatePayment(request: InitiatePaymentRequest): Promise<ApiResponse<InitiatePaymentResponse>> {
    if (isBackendConfigured) {
      return fetchJson<InitiatePaymentResponse>(SURVEY_PAYMENT_ROUTES.initiate, {
        method: "POST",
        body: JSON.stringify(request),
      });
    }

    await delay(1500); // Simulate payment gateway delay

    const plan = getPlanByType(request.planType);
    if (!plan) {
      return {
        success: false,
        data: {} as InitiatePaymentResponse,
        error: "Invalid subscription plan",
      };
    }

    // Validate phone number format
    const cleanPhone = request.phoneNumber.replace(/\s/g, "");
    if (cleanPhone.length < 10) {
      return {
        success: false,
        data: {} as InitiatePaymentResponse,
        error: "Invalid phone number format",
      };
    }

    // Create new payment record
    const now = new Date();
    const newPayment: SurveyPayment = {
      id: `spay_${Date.now()}`,
      userId: mockCurrentUser.id,
      amount: plan.price,
      currency: plan.currency,
      phoneNumber: cleanPhone,
      provider: request.provider,
      planType: request.planType,
      transactionId: generateTransactionId(),
      externalReference: null,
      status: PaymentStatus.PENDING,
      statusMessage: `Payment request sent to your ${request.provider} number. Please check your phone to confirm.`,
      subscriptionId: null,
      initiatedAt: now.toISOString(),
      completedAt: null,
      failedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Store the payment
    mockSurveyPayments.push(newPayment);

    // Calculate expiry (payment prompt expires in 5 minutes)
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    return {
      success: true,
      data: {
        payment: newPayment,
        message: `A payment request of ${plan.price.toLocaleString()} ${plan.currency} has been sent to your ${request.provider} number (${cleanPhone}). Please check your phone to complete the payment.`,
        requiresConfirmation: true,
        expiresAt: expiresAt.toISOString(),
      },
    };
  },

  /**
   * Check payment status and update subscription if successful
   */
  async checkPaymentStatus(paymentId: string): Promise<ApiResponse<PaymentStatusResponse>> {
    if (isBackendConfigured) {
      return fetchJson<PaymentStatusResponse>(SURVEY_PAYMENT_ROUTES.checkStatus(paymentId));
    }

    await delay(500);

    const paymentIndex = mockSurveyPayments.findIndex(p => p.id === paymentId);
    if (paymentIndex === -1) {
      return {
        success: false,
        data: {} as PaymentStatusResponse,
        error: "Payment not found",
      };
    }

    const payment = mockSurveyPayments[paymentIndex];

    // Simulate payment completion (50% chance of success for demo)
    // In production, this would check with the payment gateway
    if (payment.status === PaymentStatus.PENDING) {
      const isSuccessful = Math.random() > 0.3; // 70% success rate for demo
      const now = new Date();

      if (isSuccessful) {
        // Update payment status
        mockSurveyPayments[paymentIndex] = {
          ...payment,
          status: PaymentStatus.SUCCESSFUL,
          statusMessage: "Payment completed successfully",
          externalReference: `MOMO-${Date.now()}`,
          completedAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        // Create subscription
        const plan = getPlanByType(payment.planType);
        if (plan) {
          const endDate = calculateEndDate(now, plan.durationDays);
          const newSubscription: SurveySubscription = {
            id: `sub_${Date.now()}`,
            userId: payment.userId,
            planId: plan.id,
            planType: payment.planType,
            status: SubscriptionStatus.ACTIVE,
            startDate: now.toISOString(),
            endDate: endDate.toISOString(),
            autoRenew: false,
            paymentId: payment.id,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          };

          mockSubscriptions.push(newSubscription);
          mockSurveyPayments[paymentIndex].subscriptionId = newSubscription.id;
        }
      } else {
        // Payment failed
        mockSurveyPayments[paymentIndex] = {
          ...payment,
          status: PaymentStatus.FAILED,
          statusMessage: "Payment was declined or cancelled",
          failedAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
      }
    }

    const updatedPayment = mockSurveyPayments[paymentIndex];
    const subscription = updatedPayment.subscriptionId 
      ? mockSubscriptions.find(s => s.id === updatedPayment.subscriptionId) || null
      : null;

    return {
      success: true,
      data: {
        payment: updatedPayment,
        subscription,
        user: {
          id: mockCurrentUser.id,
          surveysubscriptionStatus: subscription ? SubscriptionStatus.ACTIVE : mockCurrentUser.surveysubscriptionStatus,
        },
      },
    };
  },

  /**
   * Get payment history for current user
   */
  async getPaymentHistory(userId?: string): Promise<ApiResponse<SurveyPayment[]>> {
    if (isBackendConfigured) {
      return fetchJson<SurveyPayment[]>(SURVEY_PAYMENT_ROUTES.history);
    }

    await delay(400);
    const currentUserId = userId || mockCurrentUser.id;
    const payments = mockSurveyPayments
      .filter(p => p.userId === currentUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      success: true,
      data: payments,
    };
  },

  /**
   * Cancel subscription (disable auto-renew)
   */
  async cancelSubscription(subscriptionId: string): Promise<ApiResponse<SurveySubscription>> {
    if (isBackendConfigured) {
      return fetchJson<SurveySubscription>(SURVEY_PAYMENT_ROUTES.cancel(subscriptionId), {
        method: "POST",
      });
    }

    await delay(500);

    const subscriptionIndex = mockSubscriptions.findIndex(s => s.id === subscriptionId);
    if (subscriptionIndex === -1) {
      return {
        success: false,
        data: {} as SurveySubscription,
        error: "Subscription not found",
      };
    }

    // Disable auto-renew (subscription remains active until end date)
    mockSubscriptions[subscriptionIndex] = {
      ...mockSubscriptions[subscriptionIndex],
      autoRenew: false,
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: mockSubscriptions[subscriptionIndex],
      message: "Auto-renewal has been disabled. Your subscription will remain active until the end date.",
    };
  },

  /**
   * Simulate completing a pending payment (for testing)
   * In production, this would be triggered by webhook from payment gateway
   */
  async simulatePaymentCompletion(
    paymentId: string, 
    success: boolean = true
  ): Promise<ApiResponse<PaymentStatusResponse>> {
    await delay(300);

    const paymentIndex = mockSurveyPayments.findIndex(p => p.id === paymentId);
    if (paymentIndex === -1) {
      return {
        success: false,
        data: {} as PaymentStatusResponse,
        error: "Payment not found",
      };
    }

    const payment = mockSurveyPayments[paymentIndex];
    const now = new Date();

    if (success) {
      // Update payment status
      mockSurveyPayments[paymentIndex] = {
        ...payment,
        status: PaymentStatus.SUCCESSFUL,
        statusMessage: "Payment completed successfully",
        externalReference: `MOMO-${Date.now()}`,
        completedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      // Create subscription
      const plan = getPlanByType(payment.planType);
      if (plan) {
        const endDate = calculateEndDate(now, plan.durationDays);
        const newSubscription: SurveySubscription = {
          id: `sub_${Date.now()}`,
          userId: payment.userId,
          planId: plan.id,
          planType: payment.planType,
          status: SubscriptionStatus.ACTIVE,
          startDate: now.toISOString(),
          endDate: endDate.toISOString(),
          autoRenew: false,
          paymentId: payment.id,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        mockSubscriptions.push(newSubscription);
        mockSurveyPayments[paymentIndex].subscriptionId = newSubscription.id;
      }
    } else {
      mockSurveyPayments[paymentIndex] = {
        ...payment,
        status: PaymentStatus.FAILED,
        statusMessage: "Payment was declined or cancelled",
        failedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    }

    return this.checkPaymentStatus(paymentId);
  },
};

export default surveyPaymentApi;
