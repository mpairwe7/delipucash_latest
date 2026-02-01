/**
 * Ad Frequency Manager - Industry Standard Ad Delivery Control
 * 
 * Implements frequency capping, viewability tracking, and smart ad delivery
 * following IAB (Interactive Advertising Bureau) guidelines and Google Ads best practices.
 * 
 * Features:
 * - Frequency capping (per ad, per placement, global)
 * - Viewability tracking (50%+ visible for 1s = viewable impression)
 * - Cool-down periods between interstitials
 * - User fatigue detection
 * - Time-based delivery rules
 * - A/B testing support
 * 
 * @example
 * ```tsx
 * const manager = AdFrequencyManager.getInstance();
 * 
 * // Check if ad can be shown
 * if (manager.canShowAd('interstitial', adId)) {
 *   manager.recordImpression(adId, 'interstitial');
 *   showInterstitialAd(ad);
 * }
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

export type AdPlacementType = 
  | 'feed'
  | 'interstitial'
  | 'rewarded'
  | 'banner'
  | 'native'
  | 'video'
  | 'story'
  | 'pre-roll'
  | 'mid-roll'
  | 'question'
  | 'survey'
  | 'home'
  | 'banner-top'
  | 'banner-bottom'
  | 'between-content'
  | 'featured'
  | 'in-feed'
  // Underscore variants (used by some components)
  | 'pre_roll'
  | 'mid_roll'
  | 'banner_top'
  | 'banner_bottom'
  | 'between_content'
  | 'in_feed';

export interface FrequencyRule {
  /** Maximum impressions per time window */
  maxImpressions: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Minimum cool-down between impressions in milliseconds */
  cooldownMs?: number;
}

export interface AdImpression {
  adId: string;
  placement: AdPlacementType;
  timestamp: number;
  viewable: boolean;
  viewDuration: number;
  clicked: boolean;
}

export interface ViewabilityState {
  adId: string;
  startTime: number;
  isVisible: boolean;
  visiblePercentage: number;
  totalViewTime: number;
  isViewable: boolean; // 50%+ visible for 1s
}

export interface UserAdState {
  impressions: AdImpression[];
  lastInterstitialTime: number;
  sessionAdCount: number;
  totalAdsViewed: number;
  dismissedAds: string[];
  reportedAds: string[];
  preferredCategories: string[];
  blockedAdvertisers: string[];
}

export interface FrequencyConfig {
  global: {
    /** Max ads per session */
    maxAdsPerSession: number;
    /** Max ads per hour */
    maxAdsPerHour: number;
    /** Session duration in ms */
    sessionDurationMs: number;
  };
  placements: Record<AdPlacementType, FrequencyRule>;
  userFatigue: {
    /** If user dismisses N ads in a row, reduce frequency */
    dismissThreshold: number;
    /** Reduction factor (0.5 = 50% fewer ads) */
    reductionFactor: number;
    /** Recovery time in ms */
    recoveryTimeMs: number;
  };
}

// ============================================================================
// DEFAULT CONFIGURATION - Industry Standard Values
// ============================================================================

const DEFAULT_FREQUENCY_CONFIG: FrequencyConfig = {
  global: {
    maxAdsPerSession: 20,
    maxAdsPerHour: 12,
    sessionDurationMs: 30 * 60 * 1000, // 30 minutes
  },
  placements: {
    feed: {
      maxImpressions: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
      cooldownMs: 30 * 1000, // 30 seconds between feed ads
    },
    interstitial: {
      maxImpressions: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      cooldownMs: 5 * 60 * 1000, // 5 minutes between interstitials
    },
    rewarded: {
      maxImpressions: 5,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 60 * 1000, // 1 minute
    },
    banner: {
      maxImpressions: 20,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 10 * 1000,
    },
    native: {
      maxImpressions: 15,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 20 * 1000,
    },
    video: {
      maxImpressions: 5,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 2 * 60 * 1000, // 2 minutes
    },
    story: {
      maxImpressions: 8,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 45 * 1000,
    },
    'pre-roll': {
      maxImpressions: 4,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 3 * 60 * 1000, // 3 minutes
    },
    'mid-roll': {
      maxImpressions: 3,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 5 * 60 * 1000, // 5 minutes
    },
    // Context-specific placements
    question: {
      maxImpressions: 12,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 20 * 1000, // 20 seconds
    },
    survey: {
      maxImpressions: 12,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 20 * 1000, // 20 seconds
    },
    home: {
      maxImpressions: 15,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 15 * 1000, // 15 seconds
    },
    'banner-top': {
      maxImpressions: 20,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 10 * 1000, // 10 seconds
    },
    'banner-bottom': {
      maxImpressions: 20,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 10 * 1000, // 10 seconds
    },
    'between-content': {
      maxImpressions: 10,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 30 * 1000, // 30 seconds
    },
    featured: {
      maxImpressions: 8,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 45 * 1000, // 45 seconds
    },
    'in-feed': {
      maxImpressions: 15,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 20 * 1000, // 20 seconds
    },
    // Underscore variants (aliases for components that convert hyphens to underscores)
    pre_roll: {
      maxImpressions: 4,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 3 * 60 * 1000,
    },
    mid_roll: {
      maxImpressions: 3,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 5 * 60 * 1000,
    },
    banner_top: {
      maxImpressions: 20,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 10 * 1000,
    },
    banner_bottom: {
      maxImpressions: 20,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 10 * 1000,
    },
    between_content: {
      maxImpressions: 10,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 30 * 1000,
    },
    in_feed: {
      maxImpressions: 15,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 20 * 1000,
    },
  },
  userFatigue: {
    dismissThreshold: 3,
    reductionFactor: 0.5,
    recoveryTimeMs: 15 * 60 * 1000, // 15 minutes
  },
};

// Storage keys
const STORAGE_KEYS = {
  USER_AD_STATE: '@ad_frequency_state',
  SESSION_START: '@ad_session_start',
  VIEWABILITY_CACHE: '@ad_viewability_cache',
};

// ============================================================================
// AD FREQUENCY MANAGER - Singleton
// ============================================================================

class AdFrequencyManagerClass {
  private static instance: AdFrequencyManagerClass;
  private config: FrequencyConfig;
  private state: UserAdState;
  private sessionStart: number;
  private viewabilityStates: Map<string, ViewabilityState>;
  private initialized: boolean = false;

  private constructor() {
    this.config = DEFAULT_FREQUENCY_CONFIG;
    this.state = this.getDefaultState();
    this.sessionStart = Date.now();
    this.viewabilityStates = new Map();
  }

  static getInstance(): AdFrequencyManagerClass {
    if (!AdFrequencyManagerClass.instance) {
      AdFrequencyManagerClass.instance = new AdFrequencyManagerClass();
    }
    return AdFrequencyManagerClass.instance;
  }

  // ========== INITIALIZATION ==========

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const [stateJson, sessionStartStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER_AD_STATE),
        AsyncStorage.getItem(STORAGE_KEYS.SESSION_START),
      ]);

      if (stateJson) {
        this.state = { ...this.getDefaultState(), ...JSON.parse(stateJson) };
      }

      // Check if this is a new session
      const storedSessionStart = sessionStartStr ? parseInt(sessionStartStr, 10) : 0;
      const now = Date.now();

      if (now - storedSessionStart > this.config.global.sessionDurationMs) {
        // New session - reset session counters
        this.sessionStart = now;
        this.state.sessionAdCount = 0;
        await AsyncStorage.setItem(STORAGE_KEYS.SESSION_START, now.toString());
      } else {
        this.sessionStart = storedSessionStart;
      }

      // Clean up old impressions (older than 24 hours)
      const dayAgo = now - 24 * 60 * 60 * 1000;
      this.state.impressions = this.state.impressions.filter(
        (imp) => imp.timestamp > dayAgo
      );

      this.initialized = true;
      await this.persistState();
    } catch (error) {
      console.error('[AdFrequencyManager] Init error:', error);
      this.state = this.getDefaultState();
      this.initialized = true;
    }
  }

  private getDefaultState(): UserAdState {
    return {
      impressions: [],
      lastInterstitialTime: 0,
      sessionAdCount: 0,
      totalAdsViewed: 0,
      dismissedAds: [],
      reportedAds: [],
      preferredCategories: [],
      blockedAdvertisers: [],
    };
  }

  private async persistState(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_AD_STATE,
        JSON.stringify(this.state)
      );
    } catch (error) {
      console.error('[AdFrequencyManager] Persist error:', error);
    }
  }

  // ========== FREQUENCY CHECKING ==========

  /**
   * Check if an ad can be shown based on frequency rules
   */
  canShowAd(placement: AdPlacementType, adId?: string): boolean {
    const now = Date.now();
    const rule = this.config.placements[placement];

    // Safety check: if placement rule doesn't exist, use default feed rule or allow
    if (!rule) {
      console.warn(`[AdFrequencyManager] No rule defined for placement: ${placement}, using default`);
      // Fall back to feed rule or return true if no rules defined
      const fallbackRule = this.config.placements.feed;
      if (!fallbackRule) return true;
    }

    // Use rule or fallback to feed
    const activeRule = rule || this.config.placements.feed;
    if (!activeRule) return true;

    // 1. Check global session limit
    if (this.state.sessionAdCount >= this.config.global.maxAdsPerSession) {
      console.log('[AdFrequencyManager] Session limit reached');
      return false;
    }

    // 2. Check hourly limit
    const hourAgo = now - 60 * 60 * 1000;
    const hourlyImpressions = this.state.impressions.filter(
      (imp) => imp.timestamp > hourAgo
    );
    if (hourlyImpressions.length >= this.config.global.maxAdsPerHour) {
      console.log('[AdFrequencyManager] Hourly limit reached');
      return false;
    }

    // 3. Check placement-specific limits
    const placementImpressions = this.state.impressions.filter(
      (imp) => imp.placement === placement && imp.timestamp > now - activeRule.windowMs
    );
    if (placementImpressions.length >= activeRule.maxImpressions) {
      console.log(`[AdFrequencyManager] Placement limit reached for ${placement}`);
      return false;
    }

    // 4. Check cooldown
    if (activeRule.cooldownMs) {
      const lastImpression = this.state.impressions
        .filter((imp) => imp.placement === placement)
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      if (lastImpression && now - lastImpression.timestamp < activeRule.cooldownMs) {
        console.log(`[AdFrequencyManager] Cooldown active for ${placement}`);
        return false;
      }
    }

    // 5. Special interstitial check (prevent back-to-back)
    if (placement === 'interstitial') {
      const interstitialCooldown = this.config.placements.interstitial.cooldownMs || 0;
      if (now - this.state.lastInterstitialTime < interstitialCooldown) {
        console.log('[AdFrequencyManager] Interstitial cooldown active');
        return false;
      }
    }

    // 6. Check if ad was dismissed/reported
    if (adId) {
      if (this.state.dismissedAds.includes(adId) || this.state.reportedAds.includes(adId)) {
        console.log('[AdFrequencyManager] Ad was dismissed/reported by user');
        return false;
      }
    }

    // 7. Check user fatigue
    if (this.isUserFatigued()) {
      console.log('[AdFrequencyManager] User fatigue detected');
      return false;
    }

    return true;
  }

  /**
   * Check if user is experiencing ad fatigue (public API)
   */
  checkUserFatigue(): boolean {
    return this.isUserFatigued();
  }

  /**
   * Check if user is experiencing ad fatigue (internal)
   */
  private isUserFatigued(): boolean {
    const { dismissThreshold, recoveryTimeMs } = this.config.userFatigue;
    const now = Date.now();

    // Count recent dismissals
    const recentDismissals = this.state.dismissedAds.filter((_, index) => {
      // Look at the last N dismissals
      return index >= this.state.dismissedAds.length - dismissThreshold;
    });

    if (recentDismissals.length >= dismissThreshold) {
      // Check if enough recovery time has passed
      const lastImpression = this.state.impressions[this.state.impressions.length - 1];
      if (lastImpression && now - lastImpression.timestamp < recoveryTimeMs) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get time until next ad can be shown for a placement
   */
  getTimeUntilNextAd(placement: AdPlacementType): number {
    const now = Date.now();
    const rule = this.config.placements[placement];

    // Safety check: if no rule defined, return 0 (allow immediately)
    if (!rule || !rule.cooldownMs) return 0;

    const lastImpression = this.state.impressions
      .filter((imp) => imp.placement === placement)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (!lastImpression) return 0;

    const elapsed = now - lastImpression.timestamp;
    return Math.max(0, rule.cooldownMs - elapsed);
  }

  // ========== IMPRESSION RECORDING ==========

  /**
   * Record an ad impression
   */
  async recordImpression(
    adId: string,
    placement: AdPlacementType,
    viewable: boolean = false,
    viewDuration: number = 0
  ): Promise<void> {
    const impression: AdImpression = {
      adId,
      placement,
      timestamp: Date.now(),
      viewable,
      viewDuration,
      clicked: false,
    };

    this.state.impressions.push(impression);
    this.state.sessionAdCount++;
    this.state.totalAdsViewed++;

    if (placement === 'interstitial') {
      this.state.lastInterstitialTime = Date.now();
    }

    await this.persistState();
  }

  /**
   * Record an ad click
   */
  async recordClick(adId: string): Promise<void> {
    const impression = this.state.impressions
      .filter((imp) => imp.adId === adId)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (impression) {
      impression.clicked = true;
      await this.persistState();
    }
  }

  /**
   * Record ad dismissal
   */
  async recordDismissal(adId: string): Promise<void> {
    if (!this.state.dismissedAds.includes(adId)) {
      this.state.dismissedAds.push(adId);
      
      // Keep only last 50 dismissals
      if (this.state.dismissedAds.length > 50) {
        this.state.dismissedAds = this.state.dismissedAds.slice(-50);
      }

      await this.persistState();
    }
  }

  /**
   * Record ad report (e.g., "not interested", "inappropriate")
   */
  async recordReport(adId: string, reason?: string): Promise<void> {
    if (!this.state.reportedAds.includes(adId)) {
      this.state.reportedAds.push(adId);
      await this.persistState();
    }

    // Here you would also send to analytics
    console.log(`[AdFrequencyManager] Ad reported: ${adId}, reason: ${reason}`);
  }

  // ========== VIEWABILITY TRACKING (IAB Standards) ==========

  /**
   * Start tracking viewability for an ad
   * IAB Standard: 50% of ad visible for at least 1 second
   */
  startViewabilityTracking(adId: string): void {
    this.viewabilityStates.set(adId, {
      adId,
      startTime: Date.now(),
      isVisible: true,
      visiblePercentage: 100,
      totalViewTime: 0,
      isViewable: false,
    });
  }

  /**
   * Update viewability state when ad visibility changes
   */
  updateViewability(adId: string, isVisible: boolean, visiblePercentage: number): void {
    const state = this.viewabilityStates.get(adId);
    if (!state) return;

    const now = Date.now();

    // If ad was visible, add to total view time
    if (state.isVisible && state.visiblePercentage >= 50) {
      state.totalViewTime += now - state.startTime;
    }

    state.isVisible = isVisible;
    state.visiblePercentage = visiblePercentage;
    state.startTime = now;

    // Check if viewable (50%+ visible for 1+ seconds)
    if (state.totalViewTime >= 1000 && !state.isViewable) {
      state.isViewable = true;
      this.onViewableImpression(adId);
    }
  }

  /**
   * Stop tracking and get final viewability
   */
  async stopViewabilityTracking(adId: string): Promise<ViewabilityState | null> {
    const state = this.viewabilityStates.get(adId);
    if (!state) return null;

    // Finalize view time
    if (state.isVisible && state.visiblePercentage >= 50) {
      state.totalViewTime += Date.now() - state.startTime;
    }

    // Update impression with viewability data
    const impression = this.state.impressions
      .filter((imp) => imp.adId === adId)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (impression) {
      impression.viewable = state.isViewable;
      impression.viewDuration = state.totalViewTime;
      await this.persistState();
    }

    this.viewabilityStates.delete(adId);
    return state;
  }

  private onViewableImpression(adId: string): void {
    console.log(`[AdFrequencyManager] Viewable impression: ${adId}`);
    // Here you would send viewable impression to analytics
  }

  // ========== USER PREFERENCES ==========

  /**
   * Block an advertiser
   */
  async blockAdvertiser(advertiserId: string): Promise<void> {
    if (!this.state.blockedAdvertisers.includes(advertiserId)) {
      this.state.blockedAdvertisers.push(advertiserId);
      await this.persistState();
    }
  }

  /**
   * Update preferred ad categories
   */
  async updatePreferredCategories(categories: string[]): Promise<void> {
    this.state.preferredCategories = categories;
    await this.persistState();
  }

  /**
   * Check if advertiser is blocked
   */
  isAdvertiserBlocked(advertiserId: string): boolean {
    return this.state.blockedAdvertisers.includes(advertiserId);
  }

  // ========== STATISTICS & DEBUGGING ==========

  /**
   * Get ad statistics for debugging/analytics
   */
  getStats(): {
    sessionAdCount: number;
    totalAdsViewed: number;
    hourlyImpressions: number;
    viewableRate: number;
    clickRate: number;
  } {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;

    const hourlyImpressions = this.state.impressions.filter(
      (imp) => imp.timestamp > hourAgo
    );

    const viewableImpressions = this.state.impressions.filter((imp) => imp.viewable);
    const clickedImpressions = this.state.impressions.filter((imp) => imp.clicked);

    return {
      sessionAdCount: this.state.sessionAdCount,
      totalAdsViewed: this.state.totalAdsViewed,
      hourlyImpressions: hourlyImpressions.length,
      viewableRate: this.state.impressions.length > 0
        ? (viewableImpressions.length / this.state.impressions.length) * 100
        : 0,
      clickRate: this.state.impressions.length > 0
        ? (clickedImpressions.length / this.state.impressions.length) * 100
        : 0,
    };
  }

  /**
   * Reset state (for testing/debugging)
   */
  async reset(): Promise<void> {
    this.state = this.getDefaultState();
    this.sessionStart = Date.now();
    this.viewabilityStates.clear();

    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.USER_AD_STATE),
      AsyncStorage.setItem(STORAGE_KEYS.SESSION_START, Date.now().toString()),
    ]);
  }

  /**
   * Update configuration (e.g., from server)
   */
  updateConfig(newConfig: Partial<FrequencyConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      global: { ...this.config.global, ...newConfig.global },
      placements: { ...this.config.placements, ...newConfig.placements },
      userFatigue: { ...this.config.userFatigue, ...newConfig.userFatigue },
    };
  }
}

// Export singleton instance
export const AdFrequencyManager = AdFrequencyManagerClass.getInstance();

// Export hook for React components
export function useAdFrequency() {
  return {
    canShowAd: (placement: AdPlacementType, adId?: string) =>
      AdFrequencyManager.canShowAd(placement, adId),
    recordImpression: (adId: string, placement: AdPlacementType, viewable?: boolean) =>
      AdFrequencyManager.recordImpression(adId, placement, viewable),
    recordClick: (adId: string) => AdFrequencyManager.recordClick(adId),
    recordDismissal: (adId: string) => AdFrequencyManager.recordDismissal(adId),
    recordReport: (adId: string, reason?: string) => AdFrequencyManager.recordReport(adId, reason),
    getTimeUntilNextAd: (placement: AdPlacementType) =>
      AdFrequencyManager.getTimeUntilNextAd(placement),
    startViewabilityTracking: (adId: string) =>
      AdFrequencyManager.startViewabilityTracking(adId),
    updateViewability: (adId: string, isVisible: boolean, percentage: number) =>
      AdFrequencyManager.updateViewability(adId, isVisible, percentage),
    stopViewabilityTracking: (adId: string) =>
      AdFrequencyManager.stopViewabilityTracking(adId),
    getStats: () => AdFrequencyManager.getStats(),
  };
}

export default AdFrequencyManager;
