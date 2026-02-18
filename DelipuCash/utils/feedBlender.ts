/**
 * Feed Blender — Diversity engine for "For You" video feed
 *
 * Blends personalized, explore, and trending sources into a single feed
 * with configurable ratios, adaptive exploration, and freshness injection.
 *
 * Architecture:
 * - Pure function (no hooks/stores) — called from useMemo in videos-new.tsx
 * - Deterministic for same inputs (no Math.random in hot path)
 * - Dedupes across all sources against seenIds
 *
 * @module utils/feedBlender
 */

import type { Video } from '@/types';

// ============================================================================
// CONFIG
// ============================================================================

export interface BlendConfig {
  /** Fraction of feed from personalized source (0-1) */
  personalizedRatio: number;
  /** Fraction from explore/random source (0-1) */
  exploreRatio: number;
  /** Fraction from trending source (0-1) */
  trendingRatio: number;
  /** After this many videos watched, bump explore ratio */
  adaptiveThreshold: number;
  /** Explore ratio after adaptive threshold */
  adaptiveExploreRatio: number;
  /** Max age in ms for "fresh" content */
  freshnessWindow: number;
  /** Inject 1 fresh video per this many positions */
  freshnessInterval: number;
}

export const DEFAULT_BLEND_CONFIG: BlendConfig = {
  personalizedRatio: 0.70,
  exploreRatio: 0.20,
  trendingRatio: 0.10,
  adaptiveThreshold: 20,
  adaptiveExploreRatio: 0.30,
  freshnessWindow: 3600000, // 1 hour
  freshnessInterval: 10,
};

// ============================================================================
// HELPERS
// ============================================================================

/** Dedupe videos against a set of seen IDs, returning only unseen ones */
const dedupeAgainst = (videos: Video[], seenIds: Set<string>): Video[] =>
  videos.filter((v) => !seenIds.has(v.id));

/** Check if video has < 100 views (new creator boost candidate) */
const isNewCreatorContent = (video: Video): boolean =>
  (video.views ?? 0) < 100;

/** Check if video was created within the freshness window */
const isFresh = (video: Video, now: number, windowMs: number): boolean => {
  if (!video.createdAt) return false;
  const createdMs = new Date(video.createdAt).getTime();
  return now - createdMs < windowMs;
};

// ============================================================================
// MAIN: BLEND FEED
// ============================================================================

/**
 * Blend personalized, explore, and trending sources into a single feed.
 *
 * @param personalized   — main personalized feed videos
 * @param explore        — random diverse videos from /explore
 * @param trending       — trending videos
 * @param seenIds        — already-seen video IDs (from VideoFeedStore.seenVideoIds)
 * @param videosWatched  — number of videos watched this session
 * @param config         — blending configuration
 * @returns              — blended feed (deduplicated, ordered)
 */
export function blendFeed(
  personalized: Video[],
  explore: Video[],
  trending: Video[],
  seenIds: Set<string>,
  videosWatched: number,
  config: BlendConfig = DEFAULT_BLEND_CONFIG,
): Video[] {
  // 1. Adapt ratios after threshold
  let pRatio = config.personalizedRatio;
  let eRatio = config.exploreRatio;
  let tRatio = config.trendingRatio;

  if (videosWatched >= config.adaptiveThreshold) {
    eRatio = config.adaptiveExploreRatio;
    // Reduce personalized to compensate
    pRatio = 1 - eRatio - tRatio;
  }

  // 2. Dedupe all sources against seenIds
  const pVideos = dedupeAgainst(personalized, seenIds);
  const eVideos = dedupeAgainst(explore, seenIds);
  const tVideos = dedupeAgainst(trending, seenIds);

  // 3. Calculate how many from each source (per batch of 10)
  const batchSize = 10;
  const totalAvailable = pVideos.length + eVideos.length + tVideos.length;
  if (totalAvailable === 0) return [];

  const pCount = Math.round(batchSize * pRatio);
  const eCount = Math.round(batchSize * eRatio);
  const tCount = batchSize - pCount - eCount;

  // 4. Round-robin interleave in batches
  const result: Video[] = [];
  const usedIds = new Set<string>();

  let pIdx = 0;
  let eIdx = 0;
  let tIdx = 0;

  const take = (source: Video[], idx: { val: number }, count: number): Video[] => {
    const taken: Video[] = [];
    while (taken.length < count && idx.val < source.length) {
      const video = source[idx.val];
      idx.val++;
      if (!usedIds.has(video.id)) {
        usedIds.add(video.id);
        taken.push(video);
      }
    }
    return taken;
  };

  const pRef = { val: pIdx };
  const eRef = { val: eIdx };
  const tRef = { val: tIdx };

  // Build batches until we run out of all sources
  while (pRef.val < pVideos.length || eRef.val < eVideos.length || tRef.val < tVideos.length) {
    const batch: Video[] = [
      ...take(pVideos, pRef, pCount),
      ...take(eVideos, eRef, eCount),
      ...take(tVideos, tRef, tCount),
    ];

    if (batch.length === 0) break;

    // 5. New creator boost: sort videos with < 100 views higher within the batch
    batch.sort((a, b) => {
      const aBoost = isNewCreatorContent(a) ? -1 : 0;
      const bBoost = isNewCreatorContent(b) ? -1 : 0;
      return aBoost - bBoost;
    });

    result.push(...batch);
  }

  // 6. Freshness injection: ensure at least 1 fresh video per freshnessInterval positions
  const now = Date.now();
  const allFresh = [...pVideos, ...eVideos, ...tVideos].filter(
    (v) => isFresh(v, now, config.freshnessWindow) && !usedIds.has(v.id),
  );

  if (allFresh.length > 0 && config.freshnessInterval > 0) {
    let freshIdx = 0;
    for (let pos = config.freshnessInterval - 1; pos < result.length; pos += config.freshnessInterval) {
      // Check if there's already a fresh video in the interval
      const sliceStart = Math.max(0, pos - config.freshnessInterval + 1);
      const slice = result.slice(sliceStart, pos + 1);
      const hasFresh = slice.some((v) => isFresh(v, now, config.freshnessWindow));

      if (!hasFresh && freshIdx < allFresh.length) {
        // Insert fresh video at this position
        result.splice(pos, 0, allFresh[freshIdx]);
        freshIdx++;
      }
    }
  }

  return result;
}
