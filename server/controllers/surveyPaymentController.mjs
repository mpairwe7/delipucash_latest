/**
 * Survey Payment Controller
 * 
 * Handles survey subscription payments via mobile money providers (MTN, Airtel).
 * Manages subscription lifecycle: plans, payments, status, and history.
 * 
 * @module controllers/surveyPaymentController
 */

import crypto from 'crypto';
import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { v4 as uuidv4 } from 'uuid';
import { processMtnCollection, processAirtelCollection } from './paymentController.mjs';

// ============================================================================
// SUBSCRIPTION PLANS CONFIGURATION
// ============================================================================

/**
 * Survey subscription plans configuration
 * Matches frontend SurveySubscriptionType enum
 */
const SURVEY_SUBSCRIPTION_PLANS = [
  {
    id: "plan_once",
    type: "ONCE",
    name: "Single Access",
    description: "One-time access to a single survey",
    price: 500,
    currency: "UGX",
    durationDays: 1,
    features: ["Access to 1 survey", "Basic analytics"],
    isActive: true,
  },
  {
    id: "plan_daily",
    type: "DAILY",
    name: "Daily",
    description: "24 hours of unlimited survey access",
    price: 300,
    currency: "UGX",
    durationDays: 1,
    features: ["Unlimited surveys for 24 hours", "Basic analytics"],
    isActive: true,
  },
  {
    id: "plan_weekly",
    type: "WEEKLY",
    name: "Weekly",
    description: "7 days of unlimited survey access",
    price: 1500,
    currency: "UGX",
    durationDays: 7,
    features: ["Unlimited surveys", "Basic analytics", "Email support"],
    isActive: true,
  },
  {
    id: "plan_monthly",
    type: "MONTHLY",
    name: "Monthly",
    description: "30 days of unlimited survey access",
    price: 5000,
    currency: "UGX",
    durationDays: 30,
    features: ["Unlimited surveys", "Advanced analytics", "Priority support", "Export data"],
    isPopular: true,
    isActive: true,
  },
  {
    id: "plan_quarterly",
    type: "QUARTERLY",
    name: "Quarterly",
    description: "90 days of unlimited survey access",
    price: 12000,
    currency: "UGX",
    durationDays: 90,
    features: ["Unlimited surveys", "Advanced analytics", "Priority support", "Export data", "API access"],
    savings: "Save 20%",
    isActive: true,
  },
  {
    id: "plan_half_yearly",
    type: "HALF_YEARLY",
    name: "Half Yearly",
    description: "180 days of unlimited survey access",
    price: 22000,
    currency: "UGX",
    durationDays: 180,
    features: ["Unlimited surveys", "Advanced analytics", "Priority support", "Export data", "API access", "Custom branding"],
    savings: "Save 27%",
    isActive: true,
  },
  {
    id: "plan_yearly",
    type: "YEARLY",
    name: "Yearly",
    description: "365 days of unlimited survey access",
    price: 40000,
    currency: "UGX",
    durationDays: 365,
    features: ["Unlimited surveys", "Advanced analytics", "Priority support", "Export data", "API access", "Custom branding", "Dedicated support"],
    savings: "Save 33%",
    isBestValue: true,
    isActive: true,
  },
  {
    id: "plan_lifetime",
    type: "LIFETIME",
    name: "Lifetime",
    description: "Unlimited lifetime access",
    price: 100000,
    currency: "UGX",
    durationDays: 36500, // ~100 years
    features: ["Lifetime access", "All premium features", "VIP support", "Early access to new features"],
    isBestValue: true,
    isActive: true,
  },
];

/**
 * Generate unique transaction ID
 */
const generateTransactionId = () => {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const random = crypto.randomBytes(6).toString('hex');
  return `TXN-SURV-${date}-${random}`;
};

/**
 * Calculate subscription end date based on plan
 */
const calculateEndDate = (startDate, durationDays) => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);
  return endDate;
};

/**
 * Get plan by type
 */
const getPlanByType = (type) => {
  return SURVEY_SUBSCRIPTION_PLANS.find(p => p.type === type);
};

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * Get all available subscription plans
 * 
 * @route GET /api/survey-subscriptions/plans
 */
export const getPlans = asyncHandler(async (req, res) => {
  console.log('[SurveyPayment] Fetching subscription plans');

  const activePlans = SURVEY_SUBSCRIPTION_PLANS.filter(p => p.isActive);

  res.json(activePlans);
});

/**
 * Get subscription status for a user
 * 
 * @route GET /api/survey-subscriptions/status
 */
export const getSubscriptionStatus = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  console.log(`[SurveyPayment] Checking subscription status for user: ${userId}`);

  try {
    // Get user's current subscription status
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { surveysubscriptionStatus: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get latest active payment for this user (for survey subscriptions)
    const latestPayment = await prisma.payment.findFirst({
      where: { 
        userId,
        status: 'SUCCESSFUL',
      },
      orderBy: { createdAt: 'desc' },
    });

    let hasActiveSubscription = user.surveysubscriptionStatus === 'ACTIVE';
    let remainingDays = 0;
    let subscription = null;

    if (latestPayment) {
      const now = new Date();
      const endDate = new Date(latestPayment.endDate);
      
      if (endDate > now) {
        hasActiveSubscription = true;
        remainingDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        subscription = {
          id: latestPayment.id,
          userId: latestPayment.userId,
          planType: latestPayment.subscriptionType,
          status: 'ACTIVE',
          startDate: latestPayment.startDate.toISOString(),
          endDate: latestPayment.endDate.toISOString(),
          autoRenew: false,
          paymentId: latestPayment.id,
          createdAt: latestPayment.createdAt.toISOString(),
          updatedAt: latestPayment.updatedAt.toISOString(),
        };
      }
    }

    res.json({
      hasActiveSubscription,
      subscription,
      remainingDays,
      canRenew: remainingDays <= 7,
      availablePlans: SURVEY_SUBSCRIPTION_PLANS.filter(p => p.isActive),
    });
  } catch (error) {
    console.error('[SurveyPayment] Error checking subscription status:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

/**
 * Initiate a survey payment
 * 
 * @route POST /api/survey-payments/initiate
 */
export const initiatePayment = asyncHandler(async (req, res) => {
  const { phoneNumber, provider, planType } = req.body;
  const actualUserId = req.user?.id;

  // Validation
  if (!actualUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!phoneNumber || !provider || !planType) {
    return res.status(400).json({
      error: 'Missing required fields: phoneNumber, provider, planType'
    });
  }

  const plan = getPlanByType(planType);
  if (!plan) {
    return res.status(400).json({ error: 'Invalid subscription plan type' });
  }

  console.log(`[SurveyPayment] Initiating payment for user: ${actualUserId}, plan: ${planType}, provider: ${provider}`);

  // Clean phone number
  let cleanPhone = phoneNumber.replace(/\s/g, '');
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  try {
    // Verify user exists
    const user = await prisma.appUser.findUnique({
      where: { id: actualUserId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent concurrent payments — reject if a recent PENDING payment exists
    const existingPending = await prisma.payment.findFirst({
      where: {
        userId: actualUserId,
        status: 'PENDING',
        createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });

    if (existingPending) {
      return res.status(409).json({
        error: 'A payment is already in progress. Please wait for it to complete or try again in a few minutes.',
        existingPaymentId: existingPending.id,
      });
    }

    const now = new Date();
    const transactionId = generateTransactionId();
    const endDate = calculateEndDate(now, plan.durationDays);

    // Create payment record with PENDING status
    const payment = await prisma.payment.create({
      data: {
        amount: plan.price,
        phoneNumber: cleanPhone,
        provider: provider,
        TransactionId: transactionId,
        status: 'PENDING',
        subscriptionType: planType,
        startDate: now,
        endDate: endDate,
        userId: actualUserId,
      },
    });

    console.log(`[SurveyPayment] Payment record created: ${payment.id}`);

    // Calculate expiry (payment prompt expires in 5 minutes)
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    res.status(201).json({
      payment: {
        id: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        currency: plan.currency,
        phoneNumber: payment.phoneNumber,
        provider: payment.provider,
        planType: payment.subscriptionType,
        transactionId: payment.TransactionId,
        externalReference: null,
        status: payment.status,
        statusMessage: `Payment request sent to your ${provider} number. Please check your phone to confirm.`,
        subscriptionId: null,
        initiatedAt: now.toISOString(),
        completedAt: null,
        failedAt: null,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      },
      message: `A payment request of ${plan.price.toLocaleString()} ${plan.currency} has been sent to your ${provider} number (${cleanPhone}). Please check your phone to complete the payment.`,
      requiresConfirmation: true,
      expiresAt: expiresAt.toISOString(),
    });

    // Trigger actual mobile money request asynchronously
    // This would integrate with MTN/Airtel APIs
    triggerMobileMoneyRequest(payment.id, provider, plan.price, cleanPhone, transactionId)
      .catch(err => console.error('[SurveyPayment] Mobile money request failed:', err));

  } catch (error) {
    console.error('[SurveyPayment] Error initiating payment:', error);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

/**
 * Trigger mobile money collection request
 * Called asynchronously after creating payment record
 * Uses COLLECTION APIs (request-to-pay), NOT disbursement
 */
const triggerMobileMoneyRequest = async (paymentId, provider, amount, phoneNumber, transactionId) => {
  console.log(`[SurveyPayment] Triggering ${provider} collection request...`);

  try {
    let result;

    if (provider === 'MTN') {
      result = await processMtnCollection({
        amount,
        phoneNumber,
        referenceId: transactionId,
      });
    } else if (provider === 'AIRTEL') {
      result = await processAirtelCollection({
        amount,
        phoneNumber,
        referenceId: transactionId,
      });
    } else {
      console.error(`[SurveyPayment] Unknown provider: ${provider}`);
      return;
    }

    // Update payment status based on result — atomically within a transaction
    if (result.success) {
      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.update({
          where: { id: paymentId },
          data: { status: 'SUCCESSFUL' },
        });

        await tx.appUser.update({
          where: { id: payment.userId },
          data: { surveysubscriptionStatus: 'ACTIVE' },
        });
      });

      console.log(`[SurveyPayment] Payment ${paymentId} completed successfully`);
    } else {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'FAILED' },
      });
      console.log(`[SurveyPayment] Payment ${paymentId} failed`);
    }
  } catch (error) {
    console.error(`[SurveyPayment] Error processing ${provider} collection:`, error);

    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED' },
    });
  }
};

/**
 * Check payment status
 * 
 * @route GET /api/survey-payments/:paymentId/status
 */
export const checkPaymentStatus = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;

  console.log(`[SurveyPayment] Checking payment status: ${paymentId}`);

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            surveysubscriptionStatus: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Authorization: only the payment owner or admin can view payment details
    if (payment.userId !== req.user?.id) {
      const requestingUser = await prisma.appUser.findUnique({
        where: { id: req.user?.id },
        select: { role: true },
      });
      if (!requestingUser || !['ADMIN', 'MODERATOR'].includes(requestingUser.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const plan = getPlanByType(payment.subscriptionType);

    let subscription = null;
    if (payment.status === 'SUCCESSFUL') {
      subscription = {
        id: payment.id,
        userId: payment.userId,
        planId: plan?.id || 'unknown',
        planType: payment.subscriptionType,
        status: 'ACTIVE',
        startDate: payment.startDate.toISOString(),
        endDate: payment.endDate.toISOString(),
        autoRenew: false,
        paymentId: payment.id,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      };
    }

    res.json({
      payment: {
        id: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        currency: plan?.currency || 'UGX',
        phoneNumber: payment.phoneNumber,
        provider: payment.provider,
        planType: payment.subscriptionType,
        transactionId: payment.TransactionId,
        externalReference: null,
        status: payment.status,
        statusMessage: getStatusMessage(payment.status),
        subscriptionId: payment.status === 'SUCCESSFUL' ? payment.id : null,
        initiatedAt: payment.createdAt.toISOString(),
        completedAt: payment.status === 'SUCCESSFUL' ? payment.updatedAt.toISOString() : null,
        failedAt: payment.status === 'FAILED' ? payment.updatedAt.toISOString() : null,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      },
      subscription,
      user: {
        id: payment.user.id,
        email: payment.user.email,
        firstName: payment.user.firstName,
        lastName: payment.user.lastName,
        surveysubscriptionStatus: payment.user.surveysubscriptionStatus,
      },
    });
  } catch (error) {
    console.error('[SurveyPayment] Error checking payment status:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

/**
 * Get payment history for user
 * 
 * @route GET /api/survey-payments/history
 */
export const getPaymentHistory = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  console.log(`[SurveyPayment] Fetching payment history for user: ${userId}`);

  try {
    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50 payments
    });

    const formattedPayments = payments.map(payment => {
      const plan = getPlanByType(payment.subscriptionType);
      
      return {
        id: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        currency: plan?.currency || 'UGX',
        phoneNumber: payment.phoneNumber,
        provider: payment.provider,
        planType: payment.subscriptionType,
        transactionId: payment.TransactionId,
        externalReference: null,
        status: payment.status,
        statusMessage: getStatusMessage(payment.status),
        subscriptionId: payment.status === 'SUCCESSFUL' ? payment.id : null,
        initiatedAt: payment.createdAt.toISOString(),
        completedAt: payment.status === 'SUCCESSFUL' ? payment.updatedAt.toISOString() : null,
        failedAt: payment.status === 'FAILED' ? payment.updatedAt.toISOString() : null,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      };
    });

    res.json(formattedPayments);
  } catch (error) {
    console.error('[SurveyPayment] Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

/**
 * Cancel subscription auto-renewal
 * 
 * @route POST /api/survey-subscriptions/:subscriptionId/cancel
 */
export const cancelSubscription = asyncHandler(async (req, res) => {
  const { subscriptionId } = req.params;

  console.log(`[SurveyPayment] Cancelling subscription: ${subscriptionId}`);

  // Since we don't have a separate subscription table, we just return success
  // In production, this would disable auto-renewal flag
  
  res.json({
    id: subscriptionId,
    message: 'Subscription auto-renewal disabled successfully',
    autoRenew: false,
  });
});

/**
 * Helper to get status message
 */
const getStatusMessage = (status) => {
  switch (status) {
    case 'SUCCESSFUL':
      return 'Payment completed successfully';
    case 'FAILED':
      return 'Payment failed. Please try again.';
    case 'PENDING':
      return 'Waiting for payment confirmation...';
    default:
      return 'Unknown status';
  }
};

/**
 * Get unified subscription status
 * Checks both MoMo payments (Payment table) and RevenueCat status
 * Returns active if EITHER source has an active subscription
 *
 * @route GET /api/survey-payments/unified-status
 */
export const getUnifiedSubscriptionStatus = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { surveysubscriptionStatus: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check latest successful MoMo payment with valid end date
    const latestPayment = await prisma.payment.findFirst({
      where: {
        userId,
        status: 'SUCCESSFUL',
        endDate: { gt: new Date() },
      },
      orderBy: { endDate: 'desc' },
    });

    const momoActive = Boolean(latestPayment);
    const now = new Date();
    let remainingDays = 0;
    let expirationDate = null;
    let planType = null;

    if (latestPayment) {
      expirationDate = latestPayment.endDate.toISOString();
      remainingDays = Math.ceil(
        (latestPayment.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      planType = latestPayment.subscriptionType;
    }

    // Determine source — MoMo if we found an active payment,
    // GOOGLE_PLAY if user status is ACTIVE but no MoMo payment (set by RevenueCat webhook or manual),
    // NONE otherwise
    const isActive = momoActive || user.surveysubscriptionStatus === 'ACTIVE';
    let source = 'NONE';
    if (momoActive) source = 'MOBILE_MONEY';
    else if (user.surveysubscriptionStatus === 'ACTIVE') source = 'GOOGLE_PLAY';

    res.json({
      isActive,
      source,
      expirationDate,
      remainingDays,
      planType,
    });
  } catch (error) {
    console.error('[SurveyPayment] Error checking unified subscription status:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

export default {
  getPlans,
  getSubscriptionStatus,
  getUnifiedSubscriptionStatus,
  initiatePayment,
  checkPaymentStatus,
  getPaymentHistory,
  cancelSubscription,
};
