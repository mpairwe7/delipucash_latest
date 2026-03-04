/**
 * Subscription Price Configuration Helper
 *
 * Reads subscription plan prices from the AppConfig singleton and caches
 * them in-memory for 1 minute. Same pattern as rewardConfig.mjs.
 */

import prisma from './prisma.mjs';

// ---------------------------------------------------------------------------
// In-memory cache (1-minute TTL)
// ---------------------------------------------------------------------------

let cachedConfig = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

/** Field names for subscription prices */
export const SUBSCRIPTION_PRICE_FIELDS = {
  // Survey plans
  subSurveyOncePrice: { feature: 'SURVEY', planType: 'ONCE' },
  subSurveyDailyPrice: { feature: 'SURVEY', planType: 'DAILY' },
  subSurveyWeeklyPrice: { feature: 'SURVEY', planType: 'WEEKLY' },
  subSurveyMonthlyPrice: { feature: 'SURVEY', planType: 'MONTHLY' },
  subSurveyQuarterlyPrice: { feature: 'SURVEY', planType: 'QUARTERLY' },
  subSurveyHalfYearlyPrice: { feature: 'SURVEY', planType: 'HALF_YEARLY' },
  subSurveyYearlyPrice: { feature: 'SURVEY', planType: 'YEARLY' },
  subSurveyLifetimePrice: { feature: 'SURVEY', planType: 'LIFETIME' },
  // Video plans
  subVideoDailyPrice: { feature: 'VIDEO', planType: 'DAILY' },
  subVideoWeeklyPrice: { feature: 'VIDEO', planType: 'WEEKLY' },
  subVideoMonthlyPrice: { feature: 'VIDEO', planType: 'MONTHLY' },
  subVideoQuarterlyPrice: { feature: 'VIDEO', planType: 'QUARTERLY' },
  subVideoHalfYearlyPrice: { feature: 'VIDEO', planType: 'HALF_YEARLY' },
  subVideoYearlyPrice: { feature: 'VIDEO', planType: 'YEARLY' },
  subVideoLifetimePrice: { feature: 'VIDEO', planType: 'LIFETIME' },
};

/** Fallback defaults matching the Prisma schema defaults */
const DEFAULTS = {
  subSurveyOncePrice: 500,
  subSurveyDailyPrice: 300,
  subSurveyWeeklyPrice: 1500,
  subSurveyMonthlyPrice: 5000,
  subSurveyQuarterlyPrice: 12000,
  subSurveyHalfYearlyPrice: 22000,
  subSurveyYearlyPrice: 40000,
  subSurveyLifetimePrice: 100000,
  subVideoDailyPrice: 200,
  subVideoWeeklyPrice: 1000,
  subVideoMonthlyPrice: 3500,
  subVideoQuarterlyPrice: 9000,
  subVideoHalfYearlyPrice: 16000,
  subVideoYearlyPrice: 28000,
  subVideoLifetimePrice: 70000,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the subscription price config singleton. Returns a cached value if
 * it was fetched within the last minute.
 */
export async function getSubscriptionConfig() {
  if (cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const row = await prisma.appConfig.findUnique({ where: { id: 'singleton' } });
    if (row) {
      // Extract only subscription price fields
      const config = {};
      for (const field of Object.keys(DEFAULTS)) {
        config[field] = row[field] ?? DEFAULTS[field];
      }
      cachedConfig = config;
    } else {
      cachedConfig = { ...DEFAULTS };
    }
  } catch (err) {
    console.error('[subscriptionConfig] DB read failed, using defaults:', err.message);
    cachedConfig = { ...DEFAULTS };
  }

  cacheTimestamp = Date.now();
  return cachedConfig;
}

/** Force the next `getSubscriptionConfig()` call to hit the DB. */
export function invalidateSubscriptionConfigCache() {
  cachedConfig = null;
  cacheTimestamp = 0;
}
