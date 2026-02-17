/**
 * useSmartAdPlacement - Intelligent Ad Placement Hook
 * 
 * Industry-standard hook for smart ad placement decisions using:
 * - Frequency capping (via AdFrequencyManager)
 * - Viewability tracking (IAB standards)
 * - User fatigue detection
 * - Contextual relevance
 * - Performance optimization
 * 
 * Inspired by:
 * - Google AdMob smart banners
 * - Facebook Audience Network optimization
 * - Unity Ads placement logic
 * 
 * Features:
 * - Automatic frequency cap checking
 * - Viewability-based ad rotation
 * - User session fatigue detection
 * - Placement-specific configurations
 * - Analytics-ready callbacks
 * - Context-aware ad selection
 * 
 * @example
 * ```tsx
 * const { shouldShowAd, canShowAd, trackImpression } = useSmartAdPlacement({
 *   placementType: 'feed',
 *   contextType: 'questions',
 *   position: 5,
 * });
 * 
 * if (canShowAd) {
 *   return <AdComponent onImpression={trackImpression} />;
 * }
 * ```
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  AdFrequencyManager, 
  AdPlacementType,
} from './adFrequencyManager';

// Session fatigue threshold - show max 20 ads per session
const SESSION_FATIGUE_THRESHOLD = 20;

// ============================================================================
// TYPES
// ============================================================================

export type AdContextType = 
  | 'questions'
  | 'videos'
  | 'surveys'
  | 'rewards'
  | 'home'
  | 'profile'
  | 'search'
  | 'article'
  | 'results'
  | 'checkout';

export interface SmartAdPlacementConfig {
  /** Placement type (from AdFrequencyManager) */
  placementType: AdPlacementType;
  /** Context where ad will be shown */
  contextType?: AdContextType;
  /** Position in list/feed (0-indexed) */
  position?: number;
  /** Ad ID (for tracking specific ads) */
  adId?: string;
  /** Force show regardless of caps */
  forceShow?: boolean;
  /** Minimum time between ads in same context (ms) */
  minContextInterval?: number;
  /** Maximum ads per context/screen */
  maxAdsPerContext?: number;
  /** Enable viewability tracking */
  trackViewability?: boolean;
  /** Viewability threshold (0-100) */
  viewabilityThreshold?: number;
  /** Viewability time (ms) */
  viewabilityTime?: number;
  /** Enable analytics */
  enableAnalytics?: boolean;
}

export interface SmartAdPlacementResult {
  /** Whether ad should be shown right now */
  shouldShowAd: boolean;
  /** Whether ad can be shown (passes all checks) */
  canShowAd: boolean;
  /** Whether eligibility check is complete */
  isReady: boolean;
  /** Reason why ad cannot be shown */
  blockedReason: string | null;
  /** Track impression when ad is viewed */
  trackImpression: () => Promise<void>;
  /** Track click when ad is clicked */
  trackClick: () => Promise<void>;
  /** Start viewability tracking */
  startViewabilityTracking: () => void;
  /** Stop viewability tracking */
  stopViewabilityTracking: () => void;
  /** Update viewability (call on scroll/visibility changes) */
  updateViewability: (isVisible: boolean, visiblePercent: number) => void;
  /** Whether currently viewable (IAB standard met) */
  isViewable: boolean;
  /** Current viewability percentage */
  viewabilityPercent: number;
  /** Time ad has been viewable (ms) */
  viewabilityTime: number;
  /** User fatigue level (0-1) */
  userFatigue: number;
  /** Session impression count */
  sessionImpressions: number;
  /** Recommended delay before next ad (ms) */
  recommendedDelay: number;
  /** Refresh ad placement state */
  refresh: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CONTEXT_STATE_KEY = '@smart_ad_context_state';

const CONTEXT_CONFIGS: Record<AdContextType, { maxAds: number; minInterval: number }> = {
  questions: { maxAds: 3, minInterval: 30000 },
  videos: { maxAds: 2, minInterval: 60000 },
  surveys: { maxAds: 1, minInterval: 120000 },
  rewards: { maxAds: 2, minInterval: 45000 },
  home: { maxAds: 4, minInterval: 20000 },
  profile: { maxAds: 1, minInterval: 60000 },
  search: { maxAds: 2, minInterval: 30000 },
  article: { maxAds: 2, minInterval: 45000 },
  results: { maxAds: 3, minInterval: 30000 },
  checkout: { maxAds: 0, minInterval: 999999 }, // No ads in checkout
};

// Position-based ad slots (e.g., show ad after positions 3, 8, 15...)
const FEED_AD_POSITIONS = [3, 8, 15, 25, 40, 60, 85, 115, 150];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculatePositionProbability(position: number, placementType: AdPlacementType): number {
  // Higher probability for first few valid positions
  if (placementType === 'feed' || placementType === 'native') {
    // Check if position is a valid ad slot
    const slotIndex = FEED_AD_POSITIONS.indexOf(position);
    if (slotIndex >= 0) {
      return Math.max(0.3, 1 - slotIndex * 0.1);
    }
    return 0;
  }

  if (placementType === 'banner') {
    // Every 5th position in results
    if (position > 0 && position % 5 === 0) {
      return 0.8;
    }
    return 0;
  }

  // Default placement types
  return 0.5;
}

function calculateRecommendedDelay(
  _placementType: AdPlacementType,
  fatigue: number,
  recentImpressions: number
): number {
  // Default base delay of 30 seconds
  const baseDelay = 30000;
  
  // Increase delay based on fatigue
  const fatigueMultiplier = 1 + fatigue * 2;
  
  // Increase delay if many recent impressions
  const impressionMultiplier = 1 + Math.floor(recentImpressions / 5) * 0.5;
  
  return Math.min(baseDelay * fatigueMultiplier * impressionMultiplier, 300000);
}

// ============================================================================
// HOOK
// ============================================================================

export function useSmartAdPlacement(config: SmartAdPlacementConfig): SmartAdPlacementResult {
  const {
    placementType,
    contextType = 'home',
    position = 0,
    adId = `ad-${placementType}-${position}`,
    forceShow = false,
    minContextInterval,
    maxAdsPerContext,
    trackViewability = true,
    viewabilityThreshold = 50,
    viewabilityTime = 1000,
    enableAnalytics = true,
  } = config;

  // ========== STATE ==========
  const [canShowAd, setCanShowAd] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>('initializing');
  const [isReady, setIsReady] = useState(false);
  const [isViewable, setIsViewable] = useState(false);
  const [viewabilityPercent, setViewabilityPercent] = useState(0);
  const [currentViewabilityTime, setCurrentViewabilityTime] = useState(0);
  const [userFatigue, setUserFatigue] = useState(0);
  const [sessionImpressions, setSessionImpressions] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // ========== REFS ==========
  const viewabilityStartTimeRef = useRef<number>(0);
  const viewabilityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contextStateRef = useRef<{
    lastAdTime: number;
    adsInContext: number;
    contextStartTime: number;
  }>({
    lastAdTime: 0,
    adsInContext: 0,
    contextStartTime: Date.now(),
  });

  // ========== COMPUTED ==========

  const contextConfig = useMemo(() => {
    const defaultConfig = CONTEXT_CONFIGS[contextType];
    return {
      maxAds: maxAdsPerContext ?? defaultConfig.maxAds,
      minInterval: minContextInterval ?? defaultConfig.minInterval,
    };
  }, [contextType, maxAdsPerContext, minContextInterval]);

  const shouldShowAd = useMemo(() => {
    if (forceShow) return true;
    if (!canShowAd) return false;

    // Check position probability for feed placements
    if (placementType === 'feed' || placementType === 'native') {
      const probability = calculatePositionProbability(position, placementType);
      return probability > 0;
    }

    return true;
  }, [canShowAd, forceShow, placementType, position]);

  const recommendedDelay = useMemo(() => {
    return calculateRecommendedDelay(placementType, userFatigue, sessionImpressions);
  }, [placementType, userFatigue, sessionImpressions]);

  // ========== EFFECTS ==========

  // Check ad eligibility
  useEffect(() => {
    async function checkEligibility() {
      // Force show overrides all checks
      if (forceShow) {
        setCanShowAd(true);
        setBlockedReason(null);
        setIsReady(true);
        return;
      }

      // Check frequency cap
      const frequencyAllowed = AdFrequencyManager.canShowAd(placementType);
      if (!frequencyAllowed) {
        if (__DEV__) console.log(`[SmartAd] Blocked: frequency_cap for ${placementType}/${adId}`);
        setCanShowAd(false);
        setBlockedReason('frequency_cap');
        setIsReady(true);
        return;
      }

      // Check user fatigue
      const isFatigued = AdFrequencyManager.checkUserFatigue();
      if (isFatigued) {
        if (__DEV__) console.log(`[SmartAd] Blocked: user_fatigue for ${placementType}/${adId}`);
        setCanShowAd(false);
        setBlockedReason('user_fatigue');
        setIsReady(true);
        return;
      }

      // Check context limits
      const { adsInContext, lastAdTime } = contextStateRef.current;

      if (adsInContext >= contextConfig.maxAds) {
        if (__DEV__) console.log(`[SmartAd] Blocked: context_limit (${adsInContext}/${contextConfig.maxAds}) for ${placementType}`);
        setCanShowAd(false);
        setBlockedReason('context_limit');
        setIsReady(true);
        return;
      }

      const timeSinceLastAd = Date.now() - lastAdTime;
      if (lastAdTime > 0 && timeSinceLastAd < contextConfig.minInterval) {
        if (__DEV__) console.log(`[SmartAd] Blocked: context_interval (${timeSinceLastAd}ms < ${contextConfig.minInterval}ms) for ${placementType}`);
        setCanShowAd(false);
        setBlockedReason('context_interval');
        setIsReady(true);
        return;
      }

      // All checks passed
      if (__DEV__) console.log(`[SmartAd] Allowed: ${placementType}/${adId}`);
      setCanShowAd(true);
      setBlockedReason(null);
      setIsReady(true);
    }

    checkEligibility();
  }, [placementType, forceShow, contextConfig, refreshKey]);

  // Load context state
  useEffect(() => {
    async function loadContextState() {
      try {
        const stored = await AsyncStorage.getItem(`${CONTEXT_STATE_KEY}_${contextType}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Reset if context started more than 30 minutes ago
          if (Date.now() - parsed.contextStartTime > 1800000) {
            contextStateRef.current = {
              lastAdTime: 0,
              adsInContext: 0,
              contextStartTime: Date.now(),
            };
          } else {
            contextStateRef.current = parsed;
          }
        }
      } catch (error) {
        console.error('Failed to load context state:', error);
      }
    }

    loadContextState();
  }, [contextType]);

  // Update fatigue and session impressions
  useEffect(() => {
    async function updateMetrics() {
      const stats = AdFrequencyManager.getStats();
      setUserFatigue(stats.sessionAdCount / SESSION_FATIGUE_THRESHOLD);
      setSessionImpressions(stats.sessionAdCount);
    }

    updateMetrics();
    
    // Refresh metrics periodically
    const interval = setInterval(updateMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  // App state listener (reset context on background)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // App came to foreground, refresh eligibility
        setRefreshKey(k => k + 1);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // ========== HANDLERS ==========

  const trackImpression = useCallback(async () => {
    // Record impression
    await AdFrequencyManager.recordImpression(adId, placementType);

    // Update context state
    contextStateRef.current = {
      ...contextStateRef.current,
      lastAdTime: Date.now(),
      adsInContext: contextStateRef.current.adsInContext + 1,
    };

    // Persist context state
    try {
      await AsyncStorage.setItem(
        `${CONTEXT_STATE_KEY}_${contextType}`,
        JSON.stringify(contextStateRef.current)
      );
    } catch (error) {
      console.error('Failed to save context state:', error);
    }

    // Update local metrics
    setSessionImpressions(prev => prev + 1);
    setUserFatigue(prev => Math.min(1, prev + 0.05));

    if (enableAnalytics) {
      // TODO: Send to analytics service
      console.log(`[Analytics] Ad impression: ${adId}, placement: ${placementType}`);
    }
  }, [adId, placementType, contextType, enableAnalytics]);

  const trackClick = useCallback(async () => {
    if (enableAnalytics) {
      // TODO: Send to analytics service
      console.log(`[Analytics] Ad click: ${adId}, placement: ${placementType}`);
    }
  }, [adId, placementType, enableAnalytics]);

  const startViewabilityTracking = useCallback(() => {
    if (!trackViewability) return;

    viewabilityStartTimeRef.current = Date.now();
    AdFrequencyManager.startViewabilityTracking(adId);

    viewabilityIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - viewabilityStartTimeRef.current;
      setCurrentViewabilityTime(elapsed);

      // Check if meets IAB viewability standard
      if (elapsed >= viewabilityTime && viewabilityPercent >= viewabilityThreshold) {
        setIsViewable(true);
      }
    }, 100);
  }, [adId, trackViewability, viewabilityThreshold, viewabilityTime, viewabilityPercent]);

  const stopViewabilityTracking = useCallback(() => {
    if (viewabilityIntervalRef.current) {
      clearInterval(viewabilityIntervalRef.current);
      viewabilityIntervalRef.current = null;
    }
    AdFrequencyManager.stopViewabilityTracking(adId);
  }, [adId]);

  const updateViewability = useCallback((isVisible: boolean, visiblePercent: number) => {
    setViewabilityPercent(visiblePercent);
    AdFrequencyManager.updateViewability(adId, isVisible, visiblePercent);

    if (isVisible && visiblePercent >= viewabilityThreshold) {
      if (viewabilityStartTimeRef.current === 0) {
        startViewabilityTracking();
      }
    } else {
      if (viewabilityIntervalRef.current) {
        stopViewabilityTracking();
        viewabilityStartTimeRef.current = 0;
        setCurrentViewabilityTime(0);
        setIsViewable(false);
      }
    }
  }, [adId, viewabilityThreshold, startViewabilityTracking, stopViewabilityTracking]);

  const refresh = useCallback(() => {
    setIsReady(false);
    setBlockedReason('initializing');
    setRefreshKey(k => k + 1);
  }, []);

  // ========== CLEANUP ==========

  useEffect(() => {
    return () => {
      if (viewabilityIntervalRef.current) {
        clearInterval(viewabilityIntervalRef.current);
      }
    };
  }, []);

  // ========== RETURN ==========

  return {
    shouldShowAd,
    canShowAd,
    isReady,
    blockedReason,
    trackImpression,
    trackClick,
    startViewabilityTracking,
    stopViewabilityTracking,
    updateViewability,
    isViewable,
    viewabilityPercent,
    viewabilityTime: currentViewabilityTime,
    userFatigue,
    sessionImpressions,
    recommendedDelay,
    refresh,
  };
}

// ============================================================================
// ADDITIONAL HOOKS
// ============================================================================

/**
 * Hook to get optimal ad positions in a list
 */
export function useAdPositions(
  totalItems: number,
  placementType: AdPlacementType = 'feed'
): number[] {
  return useMemo(() => {
    return FEED_AD_POSITIONS.filter(pos => pos < totalItems);
  }, [totalItems]);
}

/**
 * Hook to check if current position should show an ad
 */
export function useShouldShowAdAtPosition(
  position: number,
  placementType: AdPlacementType = 'feed'
): boolean {
  return useMemo(() => {
    return FEED_AD_POSITIONS.includes(position);
  }, [position]);
}

/**
 * Hook to manage multiple ad placements in a screen
 */
export function useMultiAdPlacement(
  contextType: AdContextType,
  maxAds: number = 3
): {
  placements: Map<string, SmartAdPlacementResult>;
  registerPlacement: (id: string, config: SmartAdPlacementConfig) => SmartAdPlacementResult;
  unregisterPlacement: (id: string) => void;
  refreshAll: () => void;
} {
  const placementsRef = useRef<Map<string, SmartAdPlacementConfig>>(new Map());
  const [, setRefreshKey] = useState(0);

  const registerPlacement = useCallback((id: string, config: SmartAdPlacementConfig) => {
    placementsRef.current.set(id, config);
    // Return a placeholder - in real implementation, this would create a new hook instance
    return {} as SmartAdPlacementResult;
  }, []);

  const unregisterPlacement = useCallback((id: string) => {
    placementsRef.current.delete(id);
  }, []);

  const refreshAll = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return {
    placements: new Map(),
    registerPlacement,
    unregisterPlacement,
    refreshAll,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useSmartAdPlacement;
