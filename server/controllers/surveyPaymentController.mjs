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
import {
  processMtnCollection,
  processAirtelCollection,
  checkMtnCollectionStatus,
  checkAirtelCollectionStatus,
} from './paymentController.mjs';
import { createNotificationFromTemplateHelper } from './notificationController.mjs';
import { createPaymentLogger, maskPhone } from '../lib/paymentLogger.mjs';
import { publishEvent } from '../lib/eventBus.mjs';

const log = createPaymentLogger('survey-payment');

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
 * Video subscription plans configuration
 * Separate pricing and features from survey plans
 */
const VIDEO_SUBSCRIPTION_PLANS = [
  {
    id: "vplan_daily",
    type: "DAILY",
    name: "Daily",
    description: "24 hours of video premium access",
    price: 200,
    currency: "UGX",
    durationDays: 1,
    features: ["Upload up to 500 MB", "Record up to 30 minutes"],
    isActive: true,
  },
  {
    id: "vplan_weekly",
    type: "WEEKLY",
    name: "Weekly",
    description: "7 days of video premium access",
    price: 1000,
    currency: "UGX",
    durationDays: 7,
    features: ["Upload up to 500 MB", "Record up to 30 minutes", "Livestream up to 2 hours"],
    isActive: true,
  },
  {
    id: "vplan_monthly",
    type: "MONTHLY",
    name: "Monthly",
    description: "30 days of video premium access",
    price: 3500,
    currency: "UGX",
    durationDays: 30,
    features: ["Upload up to 500 MB", "Record up to 30 minutes", "Livestream up to 2 hours", "Ad-free video experience"],
    isPopular: true,
    isActive: true,
  },
  {
    id: "vplan_quarterly",
    type: "QUARTERLY",
    name: "Quarterly",
    description: "90 days of video premium access",
    price: 9000,
    currency: "UGX",
    durationDays: 90,
    features: ["Upload up to 500 MB", "Record up to 30 minutes", "Livestream up to 2 hours", "Ad-free video experience"],
    savings: "Save 14%",
    isActive: true,
  },
  {
    id: "vplan_half_yearly",
    type: "HALF_YEARLY",
    name: "Half Yearly",
    description: "180 days of video premium access",
    price: 16000,
    currency: "UGX",
    durationDays: 180,
    features: ["Upload up to 500 MB", "Record up to 30 minutes", "Livestream up to 2 hours", "Ad-free video experience", "Priority video processing"],
    savings: "Save 24%",
    isActive: true,
  },
  {
    id: "vplan_yearly",
    type: "YEARLY",
    name: "Yearly",
    description: "365 days of video premium access",
    price: 28000,
    currency: "UGX",
    durationDays: 365,
    features: ["Upload up to 500 MB", "Record up to 30 minutes", "Livestream up to 2 hours", "Ad-free video experience", "Priority video processing"],
    savings: "Save 33%",
    isBestValue: true,
    isActive: true,
  },
  {
    id: "vplan_lifetime",
    type: "LIFETIME",
    name: "Lifetime",
    description: "Unlimited lifetime video premium access",
    price: 70000,
    currency: "UGX",
    durationDays: 36500,
    features: ["Lifetime video premium", "All video features", "Priority processing", "Early access to new features"],
    isBestValue: true,
    isActive: true,
  },
];

/**
 * Generate unique transaction ID with feature-specific prefix
 * @param {string} featureType - 'SURVEY' or 'VIDEO'
 */
const generateTransactionId = (featureType = 'SURVEY') => {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const random = crypto.randomBytes(6).toString('hex');
  const prefix = featureType === 'VIDEO' ? 'TXN-VID' : 'TXN-SURV';
  return `${prefix}-${date}-${random}`;
};

// Throttle live provider re-checks: max 1 query per 30s per payment
const PROVIDER_RECHECK_INTERVAL_MS = 30_000;
const lastProviderCheck = new Map();

/**
 * Calculate subscription end date based on plan
 */
const calculateEndDate = (startDate, durationDays) => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);
  return endDate;
};

/**
 * Get plan by type and feature
 * @param {string} type - Plan type (e.g., 'MONTHLY')
 * @param {string} featureType - 'SURVEY' or 'VIDEO' (default: 'SURVEY')
 */
const getPlanByType = (type, featureType = 'SURVEY') => {
  const plans = featureType === 'VIDEO' ? VIDEO_SUBSCRIPTION_PLANS : SURVEY_SUBSCRIPTION_PLANS;
  return plans.find(p => p.type === type);
};

const VALID_FEATURE_TYPES = ['SURVEY', 'VIDEO'];
const VALID_PROVIDERS = ['MTN', 'AIRTEL'];

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * Get all available subscription plans
 * 
 * @route GET /api/survey-subscriptions/plans
 */
export const getPlans = asyncHandler(async (req, res) => {
  const featureType = req.query.featureType || 'SURVEY';
  log.info('Fetching subscription plans', { featureType });

  const plans = featureType === 'VIDEO' ? VIDEO_SUBSCRIPTION_PLANS : SURVEY_SUBSCRIPTION_PLANS;
  const activePlans = plans.filter(p => p.isActive);

  res.json(activePlans);
});

/**
 * Get subscription status for a user
 * 
 * @route GET /api/survey-subscriptions/status
 */
export const getSubscriptionStatus = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const featureType = req.query.featureType || 'SURVEY';

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }

  log.info('Checking subscription status', { userId, featureType });

  try {
    // Determine which user subscription field to check based on featureType
    const statusField = featureType === 'VIDEO' ? 'videoSubscriptionStatus' : 'surveysubscriptionStatus';

    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { [statusField]: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    // Get latest active payment for the requested feature type
    const now = new Date();
    const latestPayment = await prisma.payment.findFirst({
      where: {
        userId,
        status: 'SUCCESSFUL',
        featureType,
        endDate: { gt: now },
      },
      orderBy: { endDate: 'desc' },
    });

    let hasActiveSubscription = user[statusField] === 'ACTIVE';
    let remainingDays = 0;
    let subscription = null;

    if (latestPayment) {
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

    const plans = featureType === 'VIDEO' ? VIDEO_SUBSCRIPTION_PLANS : SURVEY_SUBSCRIPTION_PLANS;

    res.json({
      hasActiveSubscription,
      subscription,
      remainingDays,
      canRenew: remainingDays <= 7,
      availablePlans: plans.filter(p => p.isActive),
    });
  } catch (error) {
    log.error('Error checking subscription status', { featureType, message: error.message });
    res.status(500).json({ error: 'Failed to check subscription status', code: 'INTERNAL_ERROR' });
  }
});

/**
 * Initiate a survey payment
 * 
 * @route POST /api/survey-payments/initiate
 */
export const initiatePayment = asyncHandler(async (req, res) => {
  const { phoneNumber, provider, planType, featureType: rawFeatureType } = req.body;
  const featureType = VALID_FEATURE_TYPES.includes(rawFeatureType) ? rawFeatureType : 'SURVEY';
  if (rawFeatureType && !VALID_FEATURE_TYPES.includes(rawFeatureType)) {
    return res.status(400).json({
      error: `Invalid featureType. Allowed: ${VALID_FEATURE_TYPES.join(', ')}`,
      code: 'INVALID_FEATURE_TYPE',
    });
  }
  const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;
  const actualUserId = req.user?.id;

  // Validation
  if (!actualUserId) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }

  if (!phoneNumber || !provider || !planType) {
    return res.status(400).json({
      error: 'Missing required fields: phoneNumber, provider, planType',
      code: 'MISSING_FIELDS',
    });
  }

  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({
      error: `Invalid payment provider. Allowed: ${VALID_PROVIDERS.join(', ')}`,
      code: 'INVALID_PROVIDER',
    });
  }

  const plan = getPlanByType(planType, featureType);
  if (!plan) {
    return res.status(400).json({ error: 'Invalid subscription plan type', code: 'INVALID_PLAN' });
  }

  log.info('Initiating payment', { featureType, userId: actualUserId, planType, provider });

  // Clean phone number
  let cleanPhone = String(phoneNumber).replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Invalid phone number format', code: 'INVALID_PHONE' });
  }

  try {
    // Verify user exists
    const user = await prisma.appUser.findUnique({
      where: { id: actualUserId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    // ── Idempotency check ──
    // If the client sent an idempotency key and a payment with that key already
    // exists, return the existing payment instead of creating a duplicate charge.
    if (idempotencyKey) {
      const existingByKey = await prisma.payment.findUnique({
        where: { idempotencyKey },
      });

      if (existingByKey) {
        // Validate mutation parameters match — reject if key reused with different plan/feature/provider
        if (
          existingByKey.subscriptionType !== planType ||
          existingByKey.featureType !== featureType ||
          existingByKey.provider !== provider
        ) {
          log.warn('Idempotency key mismatch', {
            idempotencyKey,
            existing: { plan: existingByKey.subscriptionType, feature: existingByKey.featureType, provider: existingByKey.provider },
            requested: { plan: planType, feature: featureType, provider },
          });
          return res.status(409).json({
            error: 'Idempotency key already used with different payment parameters. Use a new key for different purchases.',
            code: 'IDEMPOTENCY_MISMATCH',
          });
        }

        log.info('Idempotency hit', { idempotencyKey, paymentId: existingByKey.id });
        const existingPlan = getPlanByType(existingByKey.subscriptionType, existingByKey.featureType);
        return res.status(200).json({
          payment: {
            id: existingByKey.id,
            userId: existingByKey.userId,
            amount: existingByKey.amount,
            currency: existingPlan?.currency || 'UGX',
            phoneNumber: existingByKey.phoneNumber,
            provider: existingByKey.provider,
            planType: existingByKey.subscriptionType,
            transactionId: existingByKey.TransactionId,
            externalReference: null,
            status: existingByKey.status,
            statusMessage: getStatusMessage(existingByKey.status),
            subscriptionId: existingByKey.status === 'SUCCESSFUL' ? existingByKey.id : null,
            initiatedAt: existingByKey.createdAt.toISOString(),
            completedAt: existingByKey.status === 'SUCCESSFUL' ? existingByKey.updatedAt.toISOString() : null,
            failedAt: existingByKey.status === 'FAILED' ? existingByKey.updatedAt.toISOString() : null,
            createdAt: existingByKey.createdAt.toISOString(),
            updatedAt: existingByKey.updatedAt.toISOString(),
          },
          message: 'Payment already initiated.',
          requiresConfirmation: existingByKey.status === 'PENDING',
          expiresAt: new Date(existingByKey.createdAt.getTime() + 5 * 60 * 1000).toISOString(),
          idempotent: true,
        });
      }
    }

    // Auto-expire stale PENDING payments (>15 min) for this user+featureType before checking
    const staleCutoff = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.payment.updateMany({
      where: {
        userId: actualUserId,
        featureType,
        status: 'PENDING',
        createdAt: { lt: staleCutoff },
      },
      data: { status: 'FAILED' },
    });

    // Prevent concurrent payments — reject if a recent PENDING payment for same feature exists
    // Users can have 1 PENDING survey + 1 PENDING video payment simultaneously
    const existingPending = await prisma.payment.findFirst({
      where: {
        userId: actualUserId,
        status: 'PENDING',
        featureType,
        createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });

    if (existingPending) {
      return res.status(409).json({
        error: 'A payment is already in progress. Please wait for it to complete or try again in a few minutes.',
        code: 'CONCURRENT_PAYMENT',
        existingPaymentId: existingPending.id,
      });
    }

    const now = new Date();
    const transactionId = generateTransactionId(featureType);
    const endDate = calculateEndDate(now, plan.durationDays);

    // Create payment record with PENDING status
    const payment = await prisma.payment.create({
      data: {
        amount: plan.price,
        phoneNumber: cleanPhone,
        provider: provider,
        TransactionId: transactionId,
        idempotencyKey: idempotencyKey || null,
        status: 'PENDING',
        subscriptionType: planType,
        featureType,
        startDate: now,
        endDate: endDate,
        userId: actualUserId,
      },
    });

    log.info('Payment record created', { paymentId: payment.id, featureType });

    // Calculate expiry (payment prompt expires in 5 minutes)
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    const maskedPhone = maskPhone(cleanPhone);

    res.status(201).json({
      payment: {
        id: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        currency: plan.currency,
        phoneNumber: maskedPhone,
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
      message: `A payment request of ${plan.price.toLocaleString()} ${plan.currency} has been sent to your ${provider} number (${maskedPhone}). Please check your phone to complete the payment.`,
      requiresConfirmation: true,
      expiresAt: expiresAt.toISOString(),
    });

    // Trigger actual mobile money request asynchronously with 2-minute hard timeout
    const TRIGGER_TIMEOUT_MS = 2 * 60 * 1000;
    Promise.race([
      triggerMobileMoneyRequest(payment.id, provider, plan.price, cleanPhone, transactionId, featureType),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Collection request timed out after 2 minutes')), TRIGGER_TIMEOUT_MS)),
    ]).catch(async (err) => {
      log.error('Mobile money request failed or timed out', { paymentId: payment.id, message: err.message });
      // Mark as FAILED if still PENDING (timeout case)
      try {
        await prisma.payment.updateMany({
          where: { id: payment.id, status: 'PENDING' },
          data: { status: 'FAILED' },
        });
      } catch (dbErr) {
        log.error('Failed to mark timed-out payment as FAILED', { paymentId: payment.id, message: dbErr.message });
      }
    });

  } catch (error) {
    log.error('Error initiating payment', { message: error.message });
    res.status(500).json({ error: 'Failed to initiate payment', code: 'INTERNAL_ERROR' });
  }
});

/**
 * Trigger mobile money collection request
 * Called asynchronously after creating payment record
 * Uses COLLECTION APIs (request-to-pay), NOT disbursement
 *
 * @param {string} featureType - 'SURVEY' or 'VIDEO' — determines which user status field to update
 */
const triggerMobileMoneyRequest = async (paymentId, provider, amount, phoneNumber, transactionId, featureType = 'SURVEY') => {
  log.info('Triggering collection request', { provider, featureType, paymentId });

  // Determine which user subscription status field to update
  const statusField = featureType === 'VIDEO' ? 'videoSubscriptionStatus' : 'surveysubscriptionStatus';

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
      log.error('Unknown provider in triggerMobileMoneyRequest', { provider });
      return;
    }

    // Update payment status based on result — atomically within a transaction
    if (result.success) {
      const payment = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.update({
          where: { id: paymentId },
          data: { status: 'SUCCESSFUL' },
        });

        await tx.appUser.update({
          where: { id: p.userId },
          data: { [statusField]: 'ACTIVE' },
        });

        return p;
      });

      log.info('Payment completed successfully', { featureType, paymentId });

      // SSE event for real-time frontend updates + persistent notification
      if (payment.userId) {
        publishEvent(payment.userId, 'payment.status', {
          paymentId: payment.id, status: 'SUCCESSFUL', amount: payment.amount, provider,
        }).catch(() => {});
        const subscriptionType = featureType === 'VIDEO' ? 'Video Premium' : 'Survey Premium';
        createNotificationFromTemplateHelper(payment.userId, 'SUBSCRIPTION_ACTIVE', { subscriptionType }).catch(() => {});
      }
    } else if (result.pending) {
      // Keep record as PENDING; frontend status polling + live re-check will resolve later.
      log.info('Payment remains pending at provider level', { paymentId });
    } else {
      const payment = await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'FAILED' },
      });
      log.warn('Payment failed', { paymentId });

      // SSE event + persistent notification for failure
      if (payment.userId) {
        publishEvent(payment.userId, 'payment.status', {
          paymentId: payment.id, status: 'FAILED', amount: payment.amount, provider,
        }).catch(() => {});
        createNotificationFromTemplateHelper(payment.userId, 'PAYMENT_FAILED', { amount: payment.amount }).catch(() => {});
      }
    }
  } catch (error) {
    log.error(`Error processing ${provider} collection`, { paymentId, message: error.message });

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED' },
    });

    // SSE event + persistent notification for failure
    if (payment.userId) {
      publishEvent(payment.userId, 'payment.status', {
        paymentId: payment.id, status: 'FAILED', amount: payment.amount, provider,
      }).catch(() => {});
      createNotificationFromTemplateHelper(payment.userId, 'PAYMENT_FAILED', { amount: payment.amount }).catch(() => {});
    }
  }
};

/**
 * Check payment status
 * 
 * @route GET /api/survey-payments/:paymentId/status
 */
export const checkPaymentStatus = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;

  log.info('Checking payment status', { paymentId });

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
            videoSubscriptionStatus: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found', code: 'PAYMENT_NOT_FOUND' });
    }

    // Authorization: only the payment owner or admin can view payment details
    if (payment.userId !== req.user?.id) {
      const requestingUser = await prisma.appUser.findUnique({
        where: { id: req.user?.id },
        select: { role: true },
      });
      if (!requestingUser || !['ADMIN', 'MODERATOR'].includes(requestingUser.role)) {
        return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
      }
    }

    // ── Live provider re-check for stale PENDING payments ──
    // Throttled: max 1 provider query per 30s per payment to prevent API abuse.
    if (payment.status === 'PENDING') {
      const ageMs = Date.now() - new Date(payment.createdAt).getTime();
      const lastCheck = lastProviderCheck.get(paymentId) || 0;
      const sinceLastCheck = Date.now() - lastCheck;

      if (ageMs > 30_000 && sinceLastCheck > PROVIDER_RECHECK_INTERVAL_MS && payment.TransactionId) {
        lastProviderCheck.set(paymentId, Date.now());
        try {
          let liveStatus = 'PENDING';
          if (payment.provider === 'MTN') {
            liveStatus = await checkMtnCollectionStatus(payment.TransactionId);
          } else if (payment.provider === 'AIRTEL') {
            liveStatus = await checkAirtelCollectionStatus(payment.TransactionId);
          }

          if (liveStatus !== 'PENDING') {
            // Update DB to match provider reality
            const statusField = payment.featureType === 'VIDEO' ? 'videoSubscriptionStatus' : 'surveysubscriptionStatus';
            if (liveStatus === 'SUCCESSFUL') {
              await prisma.$transaction(async (tx) => {
                await tx.payment.update({
                  where: { id: paymentId },
                  data: { status: 'SUCCESSFUL' },
                });
                await tx.appUser.update({
                  where: { id: payment.userId },
                  data: { [statusField]: 'ACTIVE' },
                });
              });
              payment.status = 'SUCCESSFUL';
            } else {
              await prisma.payment.update({
                where: { id: paymentId },
                data: { status: 'FAILED' },
              });
              payment.status = 'FAILED';
            }
            log.info('Live re-check resolved payment', { paymentId, liveStatus });

            // SSE event so frontend cache invalidation triggers immediately
            publishEvent(payment.userId, 'payment.status', {
              paymentId: payment.id, status: liveStatus, amount: payment.amount, provider: payment.provider,
            }).catch(() => {});
            lastProviderCheck.delete(paymentId); // cleanup throttle entry
          }
        } catch (err) {
          // Non-fatal — fall through with DB status
          log.error('Live status re-check failed', { paymentId, message: err.message });
        }
      }
    }

    const plan = getPlanByType(payment.subscriptionType, payment.featureType);

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
        phoneNumber: maskPhone(payment.phoneNumber),
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
        videoSubscriptionStatus: payment.user.videoSubscriptionStatus,
      },
    });
  } catch (error) {
    log.error('Error checking payment status', { paymentId, message: error.message });
    res.status(500).json({ error: 'Failed to check payment status', code: 'INTERNAL_ERROR' });
  }
});

/**
 * Get payment history for user
 *
 * @route GET /api/survey-payments/history
 */
export const getPaymentHistory = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const featureType = req.query.featureType; // optional filter

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }

  log.info('Fetching payment history', { userId, featureType: featureType || 'ALL' });

  try {
    const where = { userId };
    if (featureType && VALID_FEATURE_TYPES.includes(featureType)) {
      where.featureType = featureType;
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const formattedPayments = payments.map(payment => {
      const plan = getPlanByType(payment.subscriptionType, payment.featureType);

      return {
        id: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        currency: plan?.currency || 'UGX',
        phoneNumber: maskPhone(payment.phoneNumber),
        provider: payment.provider,
        planType: payment.subscriptionType,
        featureType: payment.featureType,
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
    log.error('Error fetching payment history', { userId, message: error.message });
    res.status(500).json({ error: 'Failed to fetch payment history', code: 'INTERNAL_ERROR' });
  }
});

/**
 * Cancel subscription auto-renewal
 *
 * @route POST /api/survey-subscriptions/:subscriptionId/cancel
 */
export const cancelSubscription = asyncHandler(async (_req, res) => {
  // MoMo subscriptions are one-time purchases — no auto-renewal to cancel.
  // Google Play cancellations go through RevenueCat / Play Store directly.
  res.status(501).json({
    error: 'Auto-renewal cancellation is not yet supported for MoMo subscriptions',
    code: 'NOT_IMPLEMENTED',
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
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }

  try {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        surveysubscriptionStatus: true,
        videoSubscriptionStatus: true,
        subscriptionStatus: true, // Legacy unified Google Play status
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const now = new Date();

    // Helper to build per-feature status from MoMo payments + user status field
    const buildFeatureStatus = (latestPayment, userStatusField) => {
      const momoActive = Boolean(latestPayment);
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

      const isActive = momoActive || userStatusField === 'ACTIVE';
      let source = 'NONE';
      if (momoActive) source = 'MOBILE_MONEY';
      else if (userStatusField === 'ACTIVE') source = 'GOOGLE_PLAY';

      return { isActive, source, expirationDate, remainingDays, planType };
    };

    // Fetch latest active MoMo payments per feature type
    const [surveyPayment, videoPayment] = await Promise.all([
      prisma.payment.findFirst({
        where: { userId, status: 'SUCCESSFUL', featureType: 'SURVEY', endDate: { gt: now } },
        orderBy: { endDate: 'desc' },
      }),
      prisma.payment.findFirst({
        where: { userId, status: 'SUCCESSFUL', featureType: 'VIDEO', endDate: { gt: now } },
        orderBy: { endDate: 'desc' },
      }),
    ]);

    const survey = buildFeatureStatus(surveyPayment, user.surveysubscriptionStatus);
    const video = buildFeatureStatus(videoPayment, user.videoSubscriptionStatus);

    // Legacy unified status — active if ANY feature is active or legacy subscriptionStatus is ACTIVE
    const legacyActive = survey.isActive || video.isActive || user.subscriptionStatus === 'ACTIVE';
    let legacySource = 'NONE';
    if (survey.source !== 'NONE') legacySource = survey.source;
    else if (video.source !== 'NONE') legacySource = video.source;
    else if (user.subscriptionStatus === 'ACTIVE') legacySource = 'GOOGLE_PLAY';

    res.json({
      // Per-feature status (new)
      survey,
      video,
      // Legacy flat fields (backward compat)
      isActive: legacyActive,
      source: legacySource,
      expirationDate: survey.expirationDate || video.expirationDate,
      remainingDays: Math.max(survey.remainingDays, video.remainingDays),
      planType: survey.planType || video.planType,
    });
  } catch (error) {
    log.error('Error checking unified subscription status', { userId, message: error.message });
    res.status(500).json({ error: 'Failed to check subscription status', code: 'INTERNAL_ERROR' });
  }
});

/**
 * Clean up stale PENDING payments
 *
 * Marks payments stuck in PENDING for over 15 minutes as FAILED.
 * Prevents ghost payments from blocking new payment initiation.
 * Can be called from a cron job or admin endpoint.
 *
 * @route POST /api/survey-payments/cleanup-stale
 */
export const cleanupStalePayments = asyncHandler(async (req, res) => {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago

  log.info('Cleaning up stale PENDING payments', { cutoff: cutoff.toISOString() });

  try {
    const result = await prisma.payment.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      data: {
        status: 'FAILED',
      },
    });

    log.info('Cleaned up stale payments', { count: result.count });

    res.json({
      cleaned: result.count,
      cutoffTime: cutoff.toISOString(),
    });
  } catch (error) {
    log.error('Error cleaning up stale payments', { message: error.message });
    res.status(500).json({ error: 'Failed to clean up stale payments', code: 'INTERNAL_ERROR' });
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
  cleanupStalePayments,
};
