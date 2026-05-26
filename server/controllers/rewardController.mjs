import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { buildOptimizedQuery } from '../lib/queryStrategies.mjs';
import { getRewardConfig as fetchRewardConfig, pointsToUgx } from '../lib/rewardConfig.mjs';
import { publishEvent } from '../lib/eventBus.mjs';
import { createPaymentLogger, maskPhone } from '../lib/paymentLogger.mjs';
import { createNotificationFromTemplateHelper } from './notificationController.mjs';
import { checkAndUnlockAchievements } from '../lib/achievementChecker.mjs';

// Velocity rules — block obvious abuse without affecting normal users.
const VELOCITY_24H_LIMIT = 3;
const VELOCITY_24H_WINDOW_MS = 24 * 60 * 60 * 1000;
const VELOCITY_BURST_WINDOW_MS = 5 * 60 * 1000; // one redemption per 5 min minimum gap

/**
 * Throws (with statusCode) if the user is over the velocity limit.
 * Counts SUCCESSFUL + PENDING redemptions in the last 24h — PENDING included
 * so a user can't queue up many requests faster than they finalize.
 */
async function enforceVelocityLimits(tx, userId) {
  const since24h = new Date(Date.now() - VELOCITY_24H_WINDOW_MS);
  const sinceBurst = new Date(Date.now() - VELOCITY_BURST_WINDOW_MS);

  const [count24h, recentBurst] = await Promise.all([
    tx.rewardRedemption.count({
      where: { userId, status: { in: ['SUCCESSFUL', 'PENDING'] }, requestedAt: { gte: since24h } },
    }),
    tx.rewardRedemption.findFirst({
      where: { userId, status: { in: ['SUCCESSFUL', 'PENDING'] }, requestedAt: { gte: sinceBurst } },
      select: { requestedAt: true },
      orderBy: { requestedAt: 'desc' },
    }),
  ]);

  if (count24h >= VELOCITY_24H_LIMIT) {
    const err = new Error(`You can make at most ${VELOCITY_24H_LIMIT} withdrawals every 24 hours. Try again later.`);
    err.statusCode = 429;
    err.code = 'VELOCITY_24H';
    throw err;
  }
  if (recentBurst) {
    const waitMs = VELOCITY_BURST_WINDOW_MS - (Date.now() - recentBurst.requestedAt.getTime());
    const waitMinutes = Math.max(1, Math.ceil(waitMs / 60000));
    const err = new Error(`Please wait ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'} before making another withdrawal.`);
    err.statusCode = 429;
    err.code = 'VELOCITY_BURST';
    throw err;
  }
}

/**
 * MoMo phone-ownership check.
 * The first time a user withdraws to a given MSISDN, we require they verified
 * it via OTP. Subsequent withdrawals to the same phone are allowed without
 * re-challenge. Returns the cleaned, normalized phone for storage.
 */
function isPhoneVerified(verifiedJson, cleanedPhone) {
  if (!verifiedJson) return false;
  const list = Array.isArray(verifiedJson) ? verifiedJson : [];
  return list.includes(cleanedPhone);
}

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

  // Phase 0: Phone-ownership gate. First-time withdrawals to a given MSISDN
  // require an OTP-verified record. We check (read-only) before opening the
  // Phase-1 transaction to keep the transaction short.
  const userPhoneState = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { verifiedMomoNumbers: true },
  });
  if (!isPhoneVerified(userPhoneState?.verifiedMomoNumbers, cleanedPhone)) {
    return res.status(412).json({
      success: false,
      error: 'PHONE_NOT_VERIFIED',
      message: 'Verify this MoMo number with a one-time code before your first withdrawal to it.',
      requiresVerification: true,
      phoneNumber: maskPhone(cleanedPhone),
    });
  }

  // Phase 1: Validate balance, deduct points, create PENDING record (transactional)
  let redemption;
  try {
    redemption = await prisma.$transaction(async (tx) => {
      // Velocity rules — return 429 quickly before the heavier idempotency
      // and balance checks run.
      await enforceVelocityLimits(tx, userId);

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
      ? "Payment is still being processed. Your points are on hold — you'll be notified of the outcome."
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

    // Referral qualification — first SUCCESSFUL redemption upgrades a PENDING
    // referral row to QUALIFIED + credits both sides 500pts atomically.
    // Fire-and-forget: failure here must NEVER fail the user-visible response.
    qualifyReferralOnFirstRedemption(userId, redemption.id).catch((err) =>
      log.warn('Referral qualification skipped', { userId, error: err.message }),
    );

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

// ---------- Referral qualification ----------
//
// Called from the redemption success path. If this is the user's FIRST
// successful redemption AND they were referred by someone, mark the Referral
// row QUALIFIED and credit both sides their bonus points. Atomic so we never
// double-credit if the function runs twice from a race.
async function qualifyReferralOnFirstRedemption(inviteeId, redemptionId) {
  const referral = await prisma.referral.findUnique({
    where: { inviteeId },
    select: { id: true, inviterId: true, inviteeId: true, status: true, rewardPoints: true },
  });
  if (!referral || referral.status !== 'PENDING') return;

  // Only qualify on the very first SUCCESSFUL redemption for this user.
  const successfulCount = await prisma.rewardRedemption.count({
    where: { userId: inviteeId, status: 'SUCCESSFUL' },
  });
  if (successfulCount !== 1) return; // someone else's race already handled it, or not the first

  const [inviter, invitee] = await Promise.all([
    prisma.appUser.findUnique({ where: { id: referral.inviterId }, select: { email: true } }),
    prisma.appUser.findUnique({ where: { id: referral.inviteeId }, select: { email: true } }),
  ]);
  if (!inviter || !invitee) return;

  const bonus = referral.rewardPoints || 500;
  try {
    await prisma.$transaction([
      prisma.referral.update({
        where: { id: referral.id },
        data: { status: 'QUALIFIED', qualifiedAt: new Date(), paidAt: new Date() },
      }),
      prisma.appUser.update({
        where: { id: referral.inviterId },
        data: { points: { increment: bonus } },
      }),
      prisma.appUser.update({
        where: { id: referral.inviteeId },
        data: { points: { increment: bonus } },
      }),
      prisma.reward.create({
        data: { userEmail: inviter.email, points: bonus, description: 'referral_qualified' },
      }),
      prisma.reward.create({
        data: { userEmail: invitee.email, points: bonus, description: 'referral_qualified' },
      }),
    ]);
    createNotificationFromTemplateHelper(referral.inviterId, 'REFERRAL_BONUS', { bonus }).catch(() => {});
    createNotificationFromTemplateHelper(referral.inviteeId, 'REFERRAL_BONUS', { bonus }).catch(() => {});
  } catch (err) {
    log.warn('Referral qualify transaction failed', { redemptionId, inviteeId, error: err.message });
  }
}

// ---------- MoMo phone-ownership OTP (per phone per user) ----------
//
// POST /api/rewards/verify-phone-send  { phoneNumber }
// POST /api/rewards/verify-phone       { phoneNumber, code }
//
// Stores the verified MSISDN in AppUser.verifiedMomoNumbers (JSON array). The
// withdrawal flow checks this list before allowing the first redemption to a
// new phone.
//
// We reuse the existing 2FA OTP fields (twoFactorCode + twoFactorCodeExpiry)
// as a transient slot — collision risk is acceptable because both flows are
// short-lived (3 min) and the user is unlikely to hit them simultaneously.
import crypto from 'crypto';
import { send2FACode } from '../lib/emailService.mjs';

function hashCodeForStorage(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export const sendPhoneVerificationCode = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { phoneNumber } = req.body || {};
  const cleanedPhone = String(phoneNumber || '').replace(/[^0-9]/g, '');
  if (cleanedPhone.length < 9 || cleanedPhone.length > 13) {
    return res.status(400).json({ success: false, message: 'Invalid phone number' });
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const codeHash = hashCodeForStorage(`momo:${cleanedPhone}:${code}`);
  const expiry = new Date(Date.now() + 3 * 60 * 1000); // 3 min

  await prisma.appUser.update({
    where: { id: userId },
    data: { twoFactorCode: codeHash, twoFactorCodeExpiry: expiry },
  });

  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true },
  });
  if (user?.email) {
    send2FACode(user.email, code, user.firstName || '', 3).catch(() => {});
  }

  return res.json({ success: true, message: 'Verification code sent', expiresIn: 180 });
});

export const verifyPhone = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { phoneNumber, code } = req.body || {};
  const cleanedPhone = String(phoneNumber || '').replace(/[^0-9]/g, '');
  if (!code || cleanedPhone.length < 9) {
    return res.status(400).json({ success: false, message: 'Phone and code required' });
  }

  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { twoFactorCode: true, twoFactorCodeExpiry: true, verifiedMomoNumbers: true },
  });
  if (!user?.twoFactorCode || !user.twoFactorCodeExpiry || user.twoFactorCodeExpiry < new Date()) {
    return res.status(400).json({ success: false, message: 'Code expired — request a new one.' });
  }

  const expected = hashCodeForStorage(`momo:${cleanedPhone}:${code}`);
  const expectedBuf = Buffer.from(expected, 'hex');
  const storedBuf = Buffer.from(user.twoFactorCode, 'hex');
  if (expectedBuf.length !== storedBuf.length || !crypto.timingSafeEqual(expectedBuf, storedBuf)) {
    return res.status(401).json({ success: false, message: 'Invalid code' });
  }

  const existing = Array.isArray(user.verifiedMomoNumbers) ? user.verifiedMomoNumbers : [];
  if (!existing.includes(cleanedPhone)) existing.push(cleanedPhone);

  await prisma.appUser.update({
    where: { id: userId },
    data: {
      verifiedMomoNumbers: existing,
      twoFactorCode: null,
      twoFactorCodeExpiry: null,
    },
  });

  return res.json({ success: true, message: 'Phone verified', verifiedNumber: maskPhone(cleanedPhone) });
});
