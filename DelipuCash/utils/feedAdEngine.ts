/**
 * Feed Ad Engine — Smart ad insertion for vertical video feeds
 *
 * Replaces naive round-robin ad insertion with:
 * - Configurable min spacing between ads
 * - Per-creative frequency caps (session + cross-session)
 * - Creative rotation (fewest impressions first)
 * - Content safety: no restricted ads next to children's content
 * - Session-level ad caps
 *
 * @module utils/feedAdEngine
 */

import type { Ad, Video } from '@/types';

// ============================================================================
// CONFIG
// ============================================================================

export interface FeedAdConfig {
  /** Insert an ad every N videos */
  interval: number;
  /** Minimum video positions between two ads */
  minSpacing: number;
  /** Max ads per session */
  maxAdsPerSession: number;
  /** Max times same creative shown per session */
  maxPerCreative: number;
}

export const DEFAULT_AD_CONFIG: FeedAdConfig = {
  interval: 5,
  minSpacing: 3,
  maxAdsPerSession: 8,
  maxPerCreative: 2,
};

// ============================================================================
// CONTEXT — caller passes current state
// ============================================================================

export interface AdInsertionContext {
  /** Per-creative session impression counts (from AdUIStore.creativeExposureCounts) */
  sessionExposure: Record<string, number>;
  /** Per-creative cross-session impression counts (from AdUIStore.crossSessionExposure) */
  crossSessionExposure: Record<string, number>;
  /** Total ads shown this session (incremented by caller) */
  sessionAdCount: number;
}

// ============================================================================
// SAFETY RULES
// ============================================================================

const CHILDREN_KEYWORDS = [
  'kids', 'children', 'cartoon', 'animation', 'nursery', 'toy', 'toddler',
  'baby', 'disney', 'sesame', 'peppa', 'cocomelon', 'school', 'learning',
];

const RESTRICTED_AD_CATEGORIES = ['alcohol', 'gambling', 'dating', 'political'];

/** Check if a video is children's content based on title/description keywords */
const isChildrenContent = (video: Video): boolean => {
  const text = `${video.title || ''} ${video.description || ''}`.toLowerCase();
  return CHILDREN_KEYWORDS.some((kw) => text.includes(kw));
};

/** Check if ad is restricted category based on targeting interests or title */
const isRestrictedAd = (ad: Ad): boolean => {
  const interests = ad.targetInterests || [];
  const title = (ad.title || '').toLowerCase();
  return RESTRICTED_AD_CATEGORIES.some(
    (cat) => interests.some((i) => i.toLowerCase().includes(cat)) || title.includes(cat),
  );
};

// ============================================================================
// AD SELECTION
// ============================================================================

/**
 * Select the best ad from the pool, respecting caps and safety rules.
 * Uses weighted round-robin: fewest session impressions → highest priority.
 */
export function selectAd(
  ads: Ad[],
  context: AdInsertionContext,
  adjacentVideos: Video[],
  config: FeedAdConfig,
): Ad | null {
  if (ads.length === 0) return null;

  const hasChildrenAdjacent = adjacentVideos.some(isChildrenContent);

  // Filter eligible ads
  const eligible = ads.filter((ad) => {
    if (!ad.isActive) return false;
    // Per-creative session cap
    if ((context.sessionExposure[ad.id] || 0) >= config.maxPerCreative) return false;
    // Content safety: no restricted ads near children's content
    if (hasChildrenAdjacent && isRestrictedAd(ad)) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  // Sort by fewest session impressions (creative rotation), then by priority desc
  eligible.sort((a, b) => {
    const aCount = context.sessionExposure[a.id] || 0;
    const bCount = context.sessionExposure[b.id] || 0;
    if (aCount !== bCount) return aCount - bCount;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });

  return eligible[0];
}

// ============================================================================
// MAIN: INSERT ADS INTO FEED
// ============================================================================

export type FeedItem =
  | { type: 'video'; data: Video }
  | { type: 'ad'; data: Ad };

/**
 * Insert ads into a video feed, returning a mixed array of FeedItems.
 *
 * @param videos     — flat array of videos (already blended/filtered)
 * @param ads        — pool of available ads
 * @param config     — spacing/cap configuration
 * @param context    — current session exposure state
 * @returns          — interleaved FeedItems
 */
export function insertAdsIntoFeed(
  videos: Video[],
  ads: Ad[],
  config: FeedAdConfig = DEFAULT_AD_CONFIG,
  context: AdInsertionContext,
): FeedItem[] {
  if (videos.length === 0) return [];
  if (ads.length === 0) return videos.map((v) => ({ type: 'video' as const, data: v }));

  const result: FeedItem[] = [];
  let adsInserted = 0;
  let lastAdPosition = -Infinity;

  for (let i = 0; i < videos.length; i++) {
    result.push({ type: 'video', data: videos[i] });

    // Check if this position is an ad slot
    const positionInFeed = result.length; // 1-based position after pushing video
    const sinceLastAd = positionInFeed - lastAdPosition;

    if (
      (i + 1) % config.interval === 0 && // Every N videos
      sinceLastAd >= config.minSpacing &&  // Min spacing respected
      adsInserted < config.maxAdsPerSession && // Session cap
      context.sessionAdCount + adsInserted < config.maxAdsPerSession // Global session cap
    ) {
      // Get adjacent videos for safety check
      const adjacentVideos: Video[] = [];
      if (i > 0) adjacentVideos.push(videos[i - 1]);
      adjacentVideos.push(videos[i]);
      if (i + 1 < videos.length) adjacentVideos.push(videos[i + 1]);

      const ad = selectAd(ads, context, adjacentVideos, config);
      if (ad) {
        result.push({ type: 'ad', data: ad });
        lastAdPosition = result.length;
        adsInserted++;
        // Update context in-place so subsequent selections see updated counts
        context.sessionExposure[ad.id] = (context.sessionExposure[ad.id] || 0) + 1;
      }
    }
  }

  return result;
}
