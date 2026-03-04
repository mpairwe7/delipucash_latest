/**
 * Config Controller
 *
 * Endpoints for reading and updating the AppConfig singleton
 * (reward rates, points-per-survey, minimum withdrawal threshold).
 */

import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import {
  getRewardConfig as getCachedConfig,
  invalidateRewardConfigCache,
} from '../lib/rewardConfig.mjs';
import {
  getSubscriptionConfig as getCachedSubscriptionConfig,
  invalidateSubscriptionConfigCache,
  SUBSCRIPTION_PRICE_FIELDS,
} from '../lib/subscriptionConfig.mjs';

// ---------------------------------------------------------------------------
// GET /api/config/rewards — public, no auth required
// ---------------------------------------------------------------------------

export const getRewardConfig = asyncHandler(async (_req, res) => {
  const config = await getCachedConfig();

  res.json({
    surveyCompletionPoints: config.surveyCompletionPoints,
    pointsToCashNumerator: config.pointsToCashNumerator,
    pointsToCashDenominator: config.pointsToCashDenominator,
    minWithdrawalPoints: config.minWithdrawalPoints,
    defaultRegularRewardAmount: config.defaultRegularRewardAmount,
    defaultInstantRewardAmount: config.defaultInstantRewardAmount,
    referralBonusPoints: config.referralBonusPoints,
  });
});

// ---------------------------------------------------------------------------
// PUT /api/config/rewards — requireModerator
// ---------------------------------------------------------------------------

export const updateRewardConfig = asyncHandler(async (req, res) => {
  const {
    surveyCompletionPoints,
    pointsToCashNumerator,
    pointsToCashDenominator,
    minWithdrawalPoints,
    defaultRegularRewardAmount,
    defaultInstantRewardAmount,
    referralBonusPoints,
  } = req.body;

  // Validate — all fields must be positive integers when provided
  const updates = {};

  if (surveyCompletionPoints !== undefined) {
    const v = Number(surveyCompletionPoints);
    if (!Number.isInteger(v) || v < 1) {
      return res.status(400).json({ error: 'surveyCompletionPoints must be a positive integer.' });
    }
    updates.surveyCompletionPoints = v;
  }

  if (pointsToCashNumerator !== undefined) {
    const v = Number(pointsToCashNumerator);
    if (!Number.isInteger(v) || v < 1) {
      return res.status(400).json({ error: 'pointsToCashNumerator must be a positive integer.' });
    }
    updates.pointsToCashNumerator = v;
  }

  if (pointsToCashDenominator !== undefined) {
    const v = Number(pointsToCashDenominator);
    if (!Number.isInteger(v) || v < 1) {
      return res.status(400).json({ error: 'pointsToCashDenominator must be a positive integer (cannot be zero).' });
    }
    updates.pointsToCashDenominator = v;
  }

  if (minWithdrawalPoints !== undefined) {
    const v = Number(minWithdrawalPoints);
    if (!Number.isInteger(v) || v < 1) {
      return res.status(400).json({ error: 'minWithdrawalPoints must be a positive integer.' });
    }
    updates.minWithdrawalPoints = v;
  }

  if (defaultRegularRewardAmount !== undefined) {
    const v = Number(defaultRegularRewardAmount);
    if (!Number.isInteger(v) || v < 1 || v > 1000000) {
      return res.status(400).json({ error: 'defaultRegularRewardAmount must be a positive integer between 1 and 1,000,000.' });
    }
    updates.defaultRegularRewardAmount = v;
  }

  if (defaultInstantRewardAmount !== undefined) {
    const v = Number(defaultInstantRewardAmount);
    if (!Number.isInteger(v) || v < 1 || v > 1000000) {
      return res.status(400).json({ error: 'defaultInstantRewardAmount must be a positive integer between 1 and 1,000,000.' });
    }
    updates.defaultInstantRewardAmount = v;
  }

  if (referralBonusPoints !== undefined) {
    const v = Number(referralBonusPoints);
    if (!Number.isInteger(v) || v < 1 || v > 10000) {
      return res.status(400).json({ error: 'referralBonusPoints must be a positive integer between 1 and 10,000.' });
    }
    updates.referralBonusPoints = v;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided to update.' });
  }

  updates.updatedBy = req.user.id;

  const config = await prisma.appConfig.upsert({
    where: { id: 'singleton' },
    update: updates,
    create: {
      id: 'singleton',
      ...updates,
    },
  });

  // Bust the in-memory cache so subsequent requests see the new values
  invalidateRewardConfigCache();

  res.json({
    success: true,
    data: {
      surveyCompletionPoints: config.surveyCompletionPoints,
      pointsToCashNumerator: config.pointsToCashNumerator,
      pointsToCashDenominator: config.pointsToCashDenominator,
      minWithdrawalPoints: config.minWithdrawalPoints,
      defaultRegularRewardAmount: config.defaultRegularRewardAmount,
      defaultInstantRewardAmount: config.defaultInstantRewardAmount,
      referralBonusPoints: config.referralBonusPoints,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/config/subscriptions — public, no auth required
// ---------------------------------------------------------------------------

export const getSubscriptionPriceConfig = asyncHandler(async (_req, res) => {
  const config = await getCachedSubscriptionConfig();
  res.json(config);
});

// ---------------------------------------------------------------------------
// PUT /api/config/subscriptions — requireModerator
// ---------------------------------------------------------------------------

const SUB_PRICE_MIN = 100;
const SUB_PRICE_MAX = 10_000_000;

export const updateSubscriptionPriceConfig = asyncHandler(async (req, res) => {
  const updates = {};
  const validFields = Object.keys(SUBSCRIPTION_PRICE_FIELDS);

  for (const field of validFields) {
    if (req.body[field] !== undefined) {
      const v = Number(req.body[field]);
      if (!Number.isInteger(v) || v < SUB_PRICE_MIN || v > SUB_PRICE_MAX) {
        return res.status(400).json({
          error: `${field} must be an integer between ${SUB_PRICE_MIN.toLocaleString()} and ${SUB_PRICE_MAX.toLocaleString()}.`,
        });
      }
      updates[field] = v;
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided to update.' });
  }

  updates.updatedBy = req.user.id;

  const config = await prisma.appConfig.upsert({
    where: { id: 'singleton' },
    update: updates,
    create: { id: 'singleton', ...updates },
  });

  // Bust caches so subsequent requests see new values
  invalidateSubscriptionConfigCache();

  // Return only subscription price fields
  const result = {};
  for (const field of validFields) {
    result[field] = config[field];
  }

  res.json({ success: true, data: result });
});
