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
    },
  });
});
