/**
 * Reward Configuration Helper
 *
 * Reads the AppConfig singleton and caches it in-memory for 1 minute.
 * Provides conversion helpers between points and UGX using integer
 * numerator/denominator to avoid floating-point precision issues.
 */

import prisma from './prisma.mjs';

// ---------------------------------------------------------------------------
// In-memory cache (1-minute TTL)
// ---------------------------------------------------------------------------

let cachedConfig = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

/** Fallback defaults matching the Prisma schema defaults */
const DEFAULTS = {
  surveyCompletionPoints: 10,
  pointsToCashNumerator: 2500,
  pointsToCashDenominator: 20,
  minWithdrawalPoints: 50,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the reward config singleton. Returns a cached value if
 * it was fetched within the last minute.
 */
export async function getRewardConfig() {
  if (cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const row = await prisma.appConfig.findUnique({ where: { id: 'singleton' } });
    cachedConfig = row ?? { ...DEFAULTS };
  } catch (err) {
    console.error('[rewardConfig] DB read failed, using defaults:', err.message);
    cachedConfig = { ...DEFAULTS };
  }

  cacheTimestamp = Date.now();
  return cachedConfig;
}

/** Force the next `getRewardConfig()` call to hit the DB. */
export function invalidateRewardConfigCache() {
  cachedConfig = null;
  cacheTimestamp = 0;
}

/**
 * Convert a points amount to UGX.
 * Formula: floor(points * numerator / denominator)
 */
export function pointsToUgx(points, config) {
  return Math.floor((points * config.pointsToCashNumerator) / config.pointsToCashDenominator);
}

/**
 * Convert a UGX amount to the number of points required.
 * Formula: ceil(ugx * denominator / numerator)
 */
export function ugxToPoints(ugx, config) {
  return Math.ceil((ugx * config.pointsToCashDenominator) / config.pointsToCashNumerator);
}
