import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';
import { buildOptimizedQuery } from '../lib/queryStrategies.mjs';

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

// Redeem Rewards — convert points to cash/airtime via mobile money
export const redeemRewards = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { cashValue, provider, phoneNumber, type } = req.body;

  // Validate inputs
  if (!cashValue || !provider || !phoneNumber || !type) {
    return res.status(400).json({ success: false, error: 'Missing required fields: cashValue, provider, phoneNumber, type.' });
  }
  if (!['MTN', 'AIRTEL'].includes(provider)) {
    return res.status(400).json({ success: false, error: 'Invalid provider. Must be MTN or AIRTEL.' });
  }
  if (!['CASH', 'AIRTIME'].includes(type)) {
    return res.status(400).json({ success: false, error: 'Invalid type. Must be CASH or AIRTIME.' });
  }
  if (cashValue <= 0) {
    return res.status(400).json({ success: false, error: 'cashValue must be positive.' });
  }

  const POINTS_TO_UGX = 100;
  const pointsRequired = Math.ceil(cashValue / POINTS_TO_UGX);

  // Phase 1: Validate balance, deduct points, create PENDING record (transactional)
  let redemption;
  try {
    redemption = await prisma.$transaction(async (tx) => {
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

      // Create pending redemption record
      return tx.rewardRedemption.create({
        data: {
          userId,
          cashValue,
          provider,
          phoneNumber,
          type,
          status: 'PENDING',
        },
      });
    }, { timeout: 10000 });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, error: err.message });
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
    console.error('Payment provider error during redemption:', paymentError);
    paymentResult = { success: false, reference: null };
  }

  // Phase 3: Update record + refund on failure (transactional)
  await prisma.$transaction(async (tx) => {
    await tx.rewardRedemption.update({
      where: { id: redemption.id },
      data: {
        status: paymentResult.success ? 'SUCCESSFUL' : 'FAILED',
        transactionRef: paymentResult.reference ?? null,
        errorMessage: paymentResult.success ? null : 'Payment provider returned failure.',
        completedAt: new Date(),
      },
    });

    // Refund points if payment failed
    if (!paymentResult.success) {
      await tx.appUser.update({
        where: { id: userId },
        data: { points: { increment: pointsRequired } },
      });
    }
  });

  if (paymentResult.success) {
    return res.json({
      success: true,
      transactionRef: paymentResult.reference,
      message: `${cashValue.toLocaleString()} UGX has been sent to your ${provider} number!`,
    });
  } else {
    return res.status(502).json({
      success: false,
      error: 'Payment processing failed. Your points have been refunded.',
    });
  }
});
