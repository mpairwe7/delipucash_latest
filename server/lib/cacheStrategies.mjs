/**
 * Prisma Accelerate Cache Strategies
 * 
 * Use these predefined cache strategies in your queries:
 * 
 * Example:
 * const users = await prisma.appUser.findMany({
 *   cacheStrategy: cacheStrategies.shortLived,
 * });
 */

/**
 * Predefined cache strategies for common use cases
 */
export const cacheStrategies = {
  /**
   * Real-time data - No caching
   * Use for: Live counters, instant updates needed
   */
  none: undefined,

  /**
   * Short-lived cache (30 seconds TTL, 10 seconds SWR)
   * Use for: Frequently changing data like notifications, activity feeds
   */
  shortLived: { ttl: 30, swr: 10 },

  /**
   * Standard cache (5 minutes TTL, 1 minute SWR)
   * Use for: User profiles, question lists, surveys
   */
  standard: { ttl: 300, swr: 60 },

  /**
   * Long-lived cache (1 hour TTL, 10 minutes SWR)
   * Use for: Static content, settings, reference data
   */
  longLived: { ttl: 3600, swr: 600 },

  /**
   * Aggressive cache (24 hours TTL, 1 hour SWR)
   * Use for: Rarely changing data, public stats, leaderboards
   */
  aggressive: { ttl: 86400, swr: 3600 },
};

/**
 * Create a custom cache strategy
 * @param ttl - Time To Live in seconds (how long to cache)
 * @param swr - Stale While Revalidate in seconds (serve stale while fetching fresh)
 * @param tags - Optional tags for cache invalidation
 */
export function createCacheStrategy(ttl, swr, tags = []) {
  return {
    ttl,
    swr,
    ...(tags.length > 0 && { tags }),
  };
}

/**
 * Cache strategy recommendations per model
 */
export const modelCacheRecommendations = {
  // User data - moderate caching
  AppUser: cacheStrategies.standard,
  
  // Surveys - moderate caching (users expect some delay)
  Survey: cacheStrategies.standard,
  UploadSurvey: cacheStrategies.standard,
  
  // Questions - short cache (answers change frequently)
  Question: cacheStrategies.shortLived,
  RewardQuestion: cacheStrategies.shortLived,
  
  // Responses - real-time or very short cache
  Response: cacheStrategies.shortLived,
  SurveyResponse: cacheStrategies.shortLived,
  
  // Notifications - very short cache
  Notification: cacheStrategies.shortLived,
  
  // Payments - real-time (never cache)
  Payment: cacheStrategies.none,
  InstantRewardWinner: cacheStrategies.none,
  
  // Static content - aggressive caching
  Video: cacheStrategies.longLived,
  Ad: cacheStrategies.longLived,
};

export default cacheStrategies;
