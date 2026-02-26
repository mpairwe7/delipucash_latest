import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';
import { buildOptimizedQuery } from '../lib/queryStrategies.mjs';
import { getRewardConfig as fetchRewardConfig, pointsToUgx } from '../lib/rewardConfig.mjs';
import { publishEvent } from '../lib/eventBus.mjs';
import { createPaymentLogger, maskPhone } from '../lib/paymentLogger.mjs';
import { createNotificationFromTemplateHelper } from './notificationController.mjs';
import { checkAndUnlockAchievements } from '../lib/achievementChecker.mjs';

const log = createPaymentLogger('reward-redeem');

// Add Reward Points
export const addReward = asyncHandler(async (req, res) => {
  const { userPhoneNumber, points, description } = req.body;

  // First, find the user by phone number to get their email
  const user = await prisma.appUser.findFirst({
    where: { phone: userPhoneNumber },
    select: { email: true },
    // Prisma Accelerate: Standard cache for user lookups
  });

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const reward = await prisma.reward.create({
    data: {
      userEmail: user.email,
      points,
      description,
    },
  });

  res.status(201).json({ message: 'Reward added', reward });
});

// Get Rewards for User
export const getRewardsByUser = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.params;

  // First, find the user by phone number to get their email
  const user = await prisma.appUser.findFirst({
    where: { phone: phoneNumber },
    select: { email: true },
    // Prisma Accelerate: Standard cache for user lookups
  });

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const rewards = await prisma.reward.findMany(
    buildOptimizedQuery('Reward', {
      where: { userEmail: user.email },
      orderBy: [{ createdAt: 'desc' }],
    }),
  );

  res.json(rewards);
});

// Get Rewards for User by User ID
export const getRewardsByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    // First, get the user to find their email
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { email: true },
      // Prisma Accelerate: Standard cache for user lookups
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Then get rewards for that email
    const rewards = await prisma.reward.findMany(
      buildOptimizedQuery('Reward', {
        where: { userEmail: user.email },
        orderBy: [{ createdAt: 'desc' }],
      }),
    );

    res.json(rewards);
  } catch (error) {
    console.error("Error fetching rewards for user:", error);
    res.status(500).json({ error: "Failed to fetch rewards." });
  }
});

// ---------- Daily Reward helpers ----------

/** Return the start of today (UTC midnight) */
function getUtcTodayStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Hours remaining until the next UTC midnight */
function hoursUntilMidnightUtc() {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.ceil((tomorrow - now) / (1000 * 60 * 60));
}

/**
 * Calculate the current daily-reward streak for a user.
 * Counts consecutive days (going backwards from yesterday) that have at
 * least one Reward with description 'daily_reward'.
 */
async function calculateStreak(userEmail) {
  // Fetch daily reward records ordered by newest first
  const rewards = await prisma.reward.findMany({
    where: { userEmail, description: 'daily_reward' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (rewards.length === 0) return 0;

  // Build a Set of unique UTC date strings (YYYY-MM-DD) the user claimed
  const claimedDates = new Set(
    rewards.map((r) => {
      const d = new Date(r.createdAt);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }),
  );

  // Walk backwards from yesterday, counting consecutive claimed days
  let streak = 0;
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() - 1); // start from yesterday

  while (true) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
    if (!claimedDates.has(key)) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

// ---------- GET /api/rewards/daily ----------

export const getDailyRewardStatus = asyncHandler(async (req, res) => {
  const userEmail = req.user.email;

  const todayStart = getUtcTodayStart();

  // Check if a daily reward was already claimed today
  const claimedToday = await prisma.reward.findFirst({
    where: {
      userEmail,
      description: 'daily_reward',
      createdAt: { gte: todayStart },
    },
  });

  const currentStreak = await calculateStreak(userEmail);

  if (claimedToday) {
    return res.json({
      isAvailable: false,
      nextRewardIn: hoursUntilMidnightUtc(),
      currentStreak,
      todayReward: 0,
      streakBonus: 0,
    });
  }

  const baseReward = 25;
  const streakBonus = Math.min(currentStreak * 5, 100);

  return res.json({
    isAvailable: true,
    nextRewardIn: 0,
    currentStreak,
    todayReward: baseReward,
    streakBonus,
  });
});

// ---------- POST /api/rewards/daily ----------

export const claimDailyReward = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;

  const todayStart = getUtcTodayStart();

  // Prevent double-claim
  const alreadyClaimed = await prisma.reward.findFirst({
    where: {
      userEmail,
      description: 'daily_reward',
      createdAt: { gte: todayStart },
    },
  });

  if (alreadyClaimed) {
    return res.status(400).json({
      success: false,
      error: 'Daily reward already claimed today.',
    });
  }

  const streak = await calculateStreak(userEmail);
  const baseReward = 25;
  const streakBonus = Math.min(streak * 5, 100);
  const totalReward = baseReward + streakBonus;

  await prisma.$transaction([
    prisma.reward.create({
      data: {
        userEmail,
        points: totalReward,
        description: 'daily_reward',
      },
    }),
    prisma.appUser.update({
      where: { id: userId },
      data: { points: { increment: totalReward } },
    }),
  ]);

  // Notify SSE subscribers about new transaction
  publishEvent(userId, 'transaction.new', {
    type: 'reward',
    amount: totalReward,
    description: 'Daily Reward',
  });

  return res.json({
    success: true,
    data: {
      reward: totalReward,
      streak: streak + 1,
      message: 'Daily reward claimed!',
      isAvailable: false,
      nextRewardIn: hoursUntilMidnightUtc(),
      streakBonus,
    },
  });
});

// Redeem Rewards — convert points to cash/airtime via mobile money
export const redeemRewards = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { pointsToRedeem, cashValue: legacyCashValue, provider, phoneNumber, type, idempotencyKey } = req.body;

  // Idempotency check is performed inside the Phase 1 transaction to prevent
  // race conditions where concurrent requests with the same key both pass.

  // Validate inputs — accept pointsToRedeem (new) or cashValue (legacy fallback)
  if (!pointsToRedeem && !legacyCashValue) {
    return res.status(400).json({ success: false, error: 'MISSING_POINTS', message: 'Please enter the amount you want to redeem.' });
  }
  if (!provider || !phoneNumber || !type) {
    return res.status(400).json({ success: false, error: 'MISSING_FIELDS', message: 'Please provide your phone number and payment provider.' });
  }
  if (!['MTN', 'AIRTEL'].includes(provider)) {
    return res.status(400).json({ success: false, error: 'INVALID_PROVIDER', message: 'Provider must be MTN or Airtel.' });
  }
  if (!['CASH', 'AIRTIME'].includes(type)) {
    return res.status(400).json({ success: false, error: 'INVALID_TYPE', message: 'Redemption type must be Cash or Airtime.' });
  }

  // Load dynamic config
  const rewardConfig = await fetchRewardConfig();

  // Determine points and cash from config-driven rate
  const pointsRequired = pointsToRedeem
    ? Math.floor(Number(pointsToRedeem))
    : Math.ceil((Number(legacyCashValue) * rewardConfig.pointsToCashDenominator) / rewardConfig.pointsToCashNumerator);
  const cashValue = pointsToUgx(pointsRequired, rewardConfig);

  if (pointsRequired <= 0 || cashValue <= 0) {
    return res.status(400).json({ success: false, error: 'INVALID_AMOUNT', message: 'Redemption amount must be positive.' });
  }

  // Minimum withdrawal check
  if (pointsRequired < rewardConfig.minWithdrawalPoints) {
    return res.status(400).json({
      success: false,
      error: 'BELOW_MINIMUM',
      message: `Minimum ${rewardConfig.minWithdrawalPoints} points required for withdrawal.`,
    });
  }

  // Validate phone number format (Uganda: 9-13 digits, starts with valid prefix)
  const cleanedPhone = phoneNumber.replace(/[^0-9]/g, '');
  if (cleanedPhone.length < 9 || cleanedPhone.length > 13) {
    return res.status(400).json({ success: false, error: 'INVALID_PHONE', message: 'Invalid phone number. Must be 9-13 digits.' });
  }
  // Normalize to local format for prefix check
  let localPhone = cleanedPhone;
  if (localPhone.startsWith('256') && localPhone.length >= 12) {
    localPhone = '0' + localPhone.slice(3);
  }
  if (localPhone.startsWith('0')) {
    const validPrefixes = /^(07[05678]|039)/; // MTN: 076/077/078/039, Airtel: 070/075
    if (!validPrefixes.test(localPhone)) {
      return res.status(400).json({ success: false, error: 'UNSUPPORTED_PREFIX', message: 'Phone number prefix does not match a supported provider (MTN or Airtel).' });
    }
  }

  // Phase 1: Validate balance, deduct points, create PENDING record (transactional)
  let redemption;
  try {
    redemption = await prisma.$transaction(async (tx) => {
      // Idempotency check inside transaction to prevent race conditions
      if (idempotencyKey) {
        const existing = await tx.rewardRedemption.findFirst({
          where: { userId, idempotencyKey },
        });
        if (existing) {
          if (existing.status === 'SUCCESSFUL') {
            return {
              _idempotent: true,
              success: true,
              transactionRef: existing.transactionRef || existing.idempotencyKey,
              message: 'Redemption already processed successfully.',
              pointsDeducted: 0,
              cashValue: existing.cashValue,
              provider: existing.provider,
              status: 'SUCCESSFUL',
            };
          }
          if (existing.status === 'PENDING') {
            const err = new Error('A redemption with this key is already being processed.');
            err.statusCode = 409;
            throw err;
          }
          // FAILED — allow retry with same key: delete the old record so we can create a fresh one
          await tx.rewardRedemption.delete({ where: { id: existing.id } });
        }
      }

      const dbUser = await tx.appUser.findUnique({
        where: { id: userId },
        select: { id: true, points: true },
      });

      if (!dbUser) {
        const err = new Error('User not found.');
        err.statusCode = 404;
        throw err;
      }

      if (dbUser.points < pointsRequired) {
        const err = new Error(`Insufficient points. You have ${dbUser.points} points, need ${pointsRequired}.`);
        err.statusCode = 400;
        throw err;
      }

      // Deduct points atomically
      await tx.appUser.update({
        where: { id: userId },
        data: { points: { decrement: pointsRequired } },
      });

      // Create pending redemption record (store cleaned phone for consistency)
      return tx.rewardRedemption.create({
        data: {
          userId,
          cashValue,
          provider,
          phoneNumber: cleanedPhone,
          type,
          status: 'PENDING',
          idempotencyKey: idempotencyKey || null,
          transactionRef: null, // Set in Phase 3 from provider reference
        },
      });
    }, { timeout: 10000 });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, error: err.message, message: err.message });
  }

  // Handle idempotent duplicate — already processed successfully
  if (redemption._idempotent) {
    const { _idempotent, ...responseData } = redemption;
    return res.json(responseData);
  }

  // Phase 2: Call payment provider (outside transaction to avoid long-held locks)
  const { processMtnPayment, processAirtelPayment } = await import('./paymentController.mjs');
  let paymentResult;
  try {
    if (provider === 'MTN') {
      paymentResult = await processMtnPayment({
        amount: cashValue,
        phoneNumber,
        userId,
        reason: 'DelipuCash reward redemption',
      });
    } else {
      paymentResult = await processAirtelPayment({
        amount: cashValue,
        phoneNumber,
        userId,
        reason: 'DelipuCash reward redemption',
      });
    }
  } catch (paymentError) {
    log.error('Payment provider error during redemption', {
      redemptionId: redemption.id, provider, phone: maskPhone(phoneNumber), error: paymentError.message,
    });
    paymentResult = { success: false, reference: null };
  }

  // Phase 3: Update record + refund on terminal failure (transactional)
  // Tri-state: SUCCESS / PENDING (provider still processing) / FAILED
  // Wrapped in try-catch to prevent "lost transaction" — if Phase 2 succeeds
  // but Phase 3 DB write fails, we still return success to the user.
  const isProviderPending = !paymentResult.success && paymentResult.pending === true;
  const finalStatus = paymentResult.success
    ? 'SUCCESSFUL'
    : isProviderPending
      ? 'PENDING'
      : 'FAILED';

  try {
    await prisma.$transaction(async (tx) => {
      await tx.rewardRedemption.update({
        where: { id: redemption.id },
        data: {
          status: finalStatus,
          transactionRef: paymentResult.reference ?? null,
          errorMessage: paymentResult.success
            ? null
            : isProviderPending
              ? 'Payment is being processed by the provider.'
              : 'Payment provider returned failure.',
          completedAt: paymentResult.success ? new Date() : null,
        },
      });

      // Only refund points on terminal FAILED — NOT on PENDING
      if (!paymentResult.success && !isProviderPending) {
        await tx.appUser.update({
          where: { id: userId },
          data: { points: { increment: pointsRequired } },
        });
      }
    });
  } catch (phase3Error) {
    log.error('CRITICAL: Phase 3 DB update failed', {
      redemptionId: redemption.id, phase3Error: phase3Error.message,
      paymentSuccess: paymentResult.success, paymentRef: paymentResult.reference,
    });

    // If payment succeeded but DB update failed, still tell user it worked
    // The record stays PENDING — admin reconciliation needed
    if (paymentResult.success) {
      return res.json({
        success: true,
        transactionRef: paymentResult.reference,
        message: `${cashValue.toLocaleString()} UGX has been sent to your ${provider} number!`,
        pointsDeducted: pointsRequired,
        cashValue,
        provider,
        status: 'SUCCESSFUL',
      });
    }

    // If payment failed AND DB update failed, user's points are already deducted
    // Attempt standalone refund
    if (!isProviderPending) {
      try {
        await prisma.appUser.update({
          where: { id: userId },
          data: { points: { increment: pointsRequired } },
        });
      } catch (refundError) {
        log.error('CRITICAL: Standalone refund also failed — manual reconciliation required', {
          redemptionId: redemption.id, userId, pointsToRefund: pointsRequired, error: refundError.message,
        });
      }
    }

    // Tailor message based on whether payment is pending or terminal
    const refundMessage = isProviderPending
      ? 'Payment is still being processed. Your points are on hold — you'll be notified of the outcome.'
      : 'Payment processing failed. Your points have been refunded.';

    return res.status(502).json({
      success: false,
      error: isProviderPending ? 'PAYMENT_PENDING' : 'PAYMENT_PROCESSING_FAILED',
      message: refundMessage,
    });
  }

  // Notify SSE subscribers about redemption status update
  publishEvent(userId, 'transaction.statusUpdate', {
    transactionId: redemption.id,
    status: finalStatus,
    amount: cashValue,
  });

  if (paymentResult.success) {
    createNotificationFromTemplateHelper(userId, 'REWARD_REDEEMED', {
      amount: cashValue.toLocaleString(),
      phoneNumber: maskPhone(phoneNumber),
    }).catch(() => {});
    checkAndUnlockAchievements(userId).catch(() => {});

    return res.json({
      success: true,
      transactionRef: paymentResult.reference,
      message: `${cashValue.toLocaleString()} UGX has been sent to your ${provider} number!`,
      pointsDeducted: pointsRequired,
      cashValue,
      provider,
      status: 'SUCCESSFUL',
    });
  }

  if (isProviderPending) {
    return res.json({
      success: true,
      transactionRef: paymentResult.reference,
      message: `${cashValue.toLocaleString()} UGX payment is being processed. You'll be notified when complete.`,
      pointsDeducted: pointsRequired,
      cashValue,
      provider,
      status: 'PENDING',
    });
  }

  return res.status(502).json({
    success: false,
    error: 'PAYMENT_FAILED',
    message: 'Payment processing failed. Your points have been refunded.',
  });
});
