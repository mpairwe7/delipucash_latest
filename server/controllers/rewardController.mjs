import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';

// Add Reward Points
export const addReward = asyncHandler(async (req, res) => {
  const { userPhoneNumber, points, description } = req.body;

  // First, find the user by phone number to get their email
  const user = await prisma.appUser.findFirst({
    where: { phone: userPhoneNumber },
    select: { email: true },
    // Prisma Accelerate: Standard cache for user lookups
    cacheStrategy: cacheStrategies.standard,
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
    cacheStrategy: cacheStrategies.standard,
  });

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const rewards = await prisma.reward.findMany({
    where: { userEmail: user.email },
    orderBy: { createdAt: 'desc' },
    // Prisma Accelerate: Short-lived cache for rewards (30s TTL, 10s SWR)
    cacheStrategy: cacheStrategies.shortLived,
  });

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
      cacheStrategy: cacheStrategies.standard,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Then get rewards for that email
    const rewards = await prisma.reward.findMany({
      where: { userEmail: user.email },
      orderBy: { createdAt: 'desc' },
      // Prisma Accelerate: Short-lived cache for rewards (30s TTL, 10s SWR)
      cacheStrategy: cacheStrategies.shortLived,
    });

    res.json(rewards);
  } catch (error) {
    console.error("Error fetching rewards for user:", error);
    res.status(500).json({ error: "Failed to fetch rewards." });
  }
});
