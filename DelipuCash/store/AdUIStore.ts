/**
 * Ad UI Store - Client State Management for Advertisements
 * Zustand-based store for UI-only state (preferences, queue, local analytics)
 * 
 * Following industry best practices:
 * - This store handles ONLY client-side state (user preferences, ad queue, local metrics)
 * - Server state (ad data, remote analytics) is managed by TanStack Query
 * - Use with: services/adHooks.ts for server state
 * 
 * Design System Compliant - Consistent with app architecture
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Ad } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type AdType = 'standard' | 'featured' | 'banner' | 'compact' | 'video' | 'native' | 'interstitial';
export type AdPlacement = 'home' | 'feed' | 'survey' | 'video' | 'question' | 'profile' | 'explore';
export type AdFrequency = 'low' | 'medium' | 'high';

export interface AdPreferences {
  /** Whether to show personalized ads based on user behavior */
  personalizedAds: boolean;
  /** How often to show ads */
  adFrequency: AdFrequency;
  /** Categories of ads user doesn't want to see */
  blockedCategories: string[];
  /** Specific advertisers user has blocked */
  blockedAdvertisers: string[];
  /** Whether user has completed ad preferences onboarding */
  hasCompletedOnboarding: boolean;
}

export interface LocalAdImpression {
  adId: string;
  timestamp: string;
  placement: AdPlacement;
  duration: number;
  wasClicked: boolean;
  wasCompleted: boolean;
}

export interface LocalAdMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  viewDuration: number;
  completionRate: number;
  lastUpdated: string;
}

export interface AdQueueItem {
  ad: Ad;
  placement: AdPlacement;
  addedAt: string;
  priority: number;
}

// ============================================================================
// UI STATE INTERFACE
// ============================================================================

export interface AdUIState {
  // User preferences (persisted)
  preferences: AdPreferences;
  
  // Local analytics tracking (persisted)
  localImpressions: LocalAdImpression[];
  localMetrics: Record<string, LocalAdMetrics>;
  
  // Ad queue for sequential display (session)
  adQueue: AdQueueItem[];
  currentQueueIndex: number;
  
  // Dismissed ads (session - to avoid showing same ad repeatedly)
  dismissedAdIds: string[];
  
  // UI state
  isAdModalVisible: boolean;
  currentModalAd: Ad | null;
  
  // Last sync timestamps
  lastMetricsSyncAt: string | null;
}

export interface AdUIActions {
  // Preferences management
  updatePreferences: (preferences: Partial<AdPreferences>) => void;
  togglePersonalizedAds: () => void;
  setAdFrequency: (frequency: AdFrequency) => void;
  blockAdvertiser: (advertiserId: string) => void;
  unblockAdvertiser: (advertiserId: string) => void;
  blockCategory: (category: string) => void;
  unblockCategory: (category: string) => void;
  completeOnboarding: () => void;
  
  // Local impression tracking
  recordImpression: (impression: Omit<LocalAdImpression, 'timestamp'>) => void;
  recordClick: (adId: string) => void;
  recordCompletion: (adId: string) => void;
  getLocalMetrics: (adId: string) => LocalAdMetrics | undefined;
  clearLocalMetrics: () => void;
  
  // Ad queue management
  addToQueue: (ad: Ad, placement: AdPlacement, priority?: number) => void;
  removeFromQueue: (adId: string) => void;
  getNextQueuedAd: () => AdQueueItem | null;
  advanceQueue: () => void;
  rewindQueue: () => void;
  clearQueue: () => void;
  
  // Dismissed ads
  dismissAd: (adId: string) => void;
  clearDismissedAds: () => void;
  isAdDismissed: (adId: string) => boolean;
  
  // Modal management
  showAdModal: (ad: Ad) => void;
  hideAdModal: () => void;
  
  // Reset
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialPreferences: AdPreferences = {
  personalizedAds: true,
  adFrequency: 'medium',
  blockedCategories: [],
  blockedAdvertisers: [],
  hasCompletedOnboarding: false,
};

const initialState: AdUIState = {
  preferences: initialPreferences,
  localImpressions: [],
  localMetrics: {},
  adQueue: [],
  currentQueueIndex: 0,
  dismissedAdIds: [],
  isAdModalVisible: false,
  currentModalAd: null,
  lastMetricsSyncAt: null,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate CTR from impressions and clicks
 */
const calculateCTR = (clicks: number, impressions: number): number => {
  if (impressions === 0) return 0;
  return (clicks / impressions) * 100;
};

/**
 * Calculate new average view duration
 */
const calculateAvgDuration = (
  currentAvg: number,
  currentCount: number,
  newDuration: number
): number => {
  if (currentCount === 0) return newDuration;
  return (currentAvg * currentCount + newDuration) / (currentCount + 1);
};

/**
 * Filter ads based on user preferences
 */
export const filterAdsByPreferences = (
  ads: Ad[],
  preferences: AdPreferences
): Ad[] => {
  return ads.filter((ad) => {
    // Filter out blocked advertisers
    if (preferences.blockedAdvertisers.includes(ad.userId)) {
      return false;
    }
    // Filter out blocked categories (if ad has category metadata)
    // Note: The Ad type doesn't have a category field, so this is for future extensibility
    // when categories are added to the ad schema
    return true;
  });
};

/**
 * Sort ads by priority for queue
 */
export const sortAdsByPriority = (ads: Ad[]): Ad[] => {
  return [...ads].sort((a, b) => {
    // Sponsored ads first
    if (a.sponsored !== b.sponsored) {
      return a.sponsored ? -1 : 1;
    }
    // Then by priority if available
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;
    return priorityB - priorityA;
  });
};

/**
 * Get random ad from pool respecting preferences
 */
export const getRandomAdFromPool = (
  ads: Ad[],
  preferences: AdPreferences,
  excludeIds: string[] = []
): Ad | null => {
  const filtered = filterAdsByPreferences(ads, preferences).filter(
    (ad) => !excludeIds.includes(ad.id) && ad.isActive
  );
  
  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
};

// ============================================================================
// STORE
// ============================================================================

export const useAdUIStore = create<AdUIState & AdUIActions>()(
  devtools(
  persist(
    (set, get) => ({
      ...initialState,

      // ========================================
      // PREFERENCES MANAGEMENT
      // ========================================
      
      updatePreferences: (newPreferences) => {
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences },
        }));
      },

      togglePersonalizedAds: () => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            personalizedAds: !state.preferences.personalizedAds,
          },
        }));
      },

      setAdFrequency: (frequency) => {
        set((state) => ({
          preferences: { ...state.preferences, adFrequency: frequency },
        }));
      },

      blockAdvertiser: (advertiserId) => {
        const { preferences } = get();
        if (!preferences.blockedAdvertisers.includes(advertiserId)) {
          set({
            preferences: {
              ...preferences,
              blockedAdvertisers: [...preferences.blockedAdvertisers, advertiserId],
            },
          });
        }
      },

      unblockAdvertiser: (advertiserId) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            blockedAdvertisers: state.preferences.blockedAdvertisers.filter(
              (id) => id !== advertiserId
            ),
          },
        }));
      },

      blockCategory: (category) => {
        const { preferences } = get();
        if (!preferences.blockedCategories.includes(category)) {
          set({
            preferences: {
              ...preferences,
              blockedCategories: [...preferences.blockedCategories, category],
            },
          });
        }
      },

      unblockCategory: (category) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            blockedCategories: state.preferences.blockedCategories.filter(
              (c) => c !== category
            ),
          },
        }));
      },

      completeOnboarding: () => {
        set((state) => ({
          preferences: { ...state.preferences, hasCompletedOnboarding: true },
        }));
      },

      // ========================================
      // LOCAL IMPRESSION TRACKING
      // ========================================

      recordImpression: (impressionData) => {
        const impression: LocalAdImpression = {
          ...impressionData,
          timestamp: new Date().toISOString(),
        };

        const { localMetrics, localImpressions } = get();
        const existingMetrics = localMetrics[impression.adId] || {
          impressions: 0,
          clicks: 0,
          ctr: 0,
          viewDuration: 0,
          completionRate: 0,
          lastUpdated: new Date().toISOString(),
        };

        const newImpressionCount = existingMetrics.impressions + 1;
        const newAvgDuration = calculateAvgDuration(
          existingMetrics.viewDuration,
          existingMetrics.impressions,
          impression.duration
        );

        set({
          localImpressions: [...localImpressions.slice(-99), impression], // Keep last 100
          localMetrics: {
            ...localMetrics,
            [impression.adId]: {
              ...existingMetrics,
              impressions: newImpressionCount,
              viewDuration: newAvgDuration,
              ctr: calculateCTR(existingMetrics.clicks, newImpressionCount),
              lastUpdated: new Date().toISOString(),
            },
          },
        });
      },

      recordClick: (adId) => {
        const { localMetrics } = get();
        const existingMetrics = localMetrics[adId] || {
          impressions: 1,
          clicks: 0,
          ctr: 0,
          viewDuration: 0,
          completionRate: 0,
          lastUpdated: new Date().toISOString(),
        };

        const newClicks = existingMetrics.clicks + 1;

        set({
          localMetrics: {
            ...localMetrics,
            [adId]: {
              ...existingMetrics,
              clicks: newClicks,
              ctr: calculateCTR(newClicks, existingMetrics.impressions),
              lastUpdated: new Date().toISOString(),
            },
          },
        });
      },

      recordCompletion: (adId) => {
        const { localMetrics } = get();
        const existingMetrics = localMetrics[adId] || {
          impressions: 1,
          clicks: 0,
          ctr: 0,
          viewDuration: 0,
          completionRate: 0,
          lastUpdated: new Date().toISOString(),
        };

        const completedCount = 
          Math.round(existingMetrics.completionRate * existingMetrics.impressions) + 1;
        const newCompletionRate = completedCount / existingMetrics.impressions;

        set({
          localMetrics: {
            ...localMetrics,
            [adId]: {
              ...existingMetrics,
              completionRate: Math.min(newCompletionRate, 1), // Cap at 100%
              lastUpdated: new Date().toISOString(),
            },
          },
        });
      },

      getLocalMetrics: (adId) => {
        return get().localMetrics[adId];
      },

      clearLocalMetrics: () => {
        set({
          localImpressions: [],
          localMetrics: {},
          lastMetricsSyncAt: new Date().toISOString(),
        });
      },

      // ========================================
      // AD QUEUE MANAGEMENT
      // ========================================

      addToQueue: (ad, placement, priority = 0) => {
        const { adQueue } = get();
        // Don't add duplicates
        if (adQueue.some((item) => item.ad.id === ad.id)) {
          return;
        }

        const queueItem: AdQueueItem = {
          ad,
          placement,
          priority,
          addedAt: new Date().toISOString(),
        };

        // Insert sorted by priority (higher priority first)
        const newQueue = [...adQueue, queueItem].sort(
          (a, b) => b.priority - a.priority
        );
        set({ adQueue: newQueue });
      },

      removeFromQueue: (adId) => {
        const { adQueue, currentQueueIndex } = get();
        const newQueue = adQueue.filter((item) => item.ad.id !== adId);
        const newIndex = Math.min(currentQueueIndex, Math.max(0, newQueue.length - 1));
        set({ adQueue: newQueue, currentQueueIndex: newIndex });
      },

      getNextQueuedAd: () => {
        const { adQueue, currentQueueIndex } = get();
        return adQueue[currentQueueIndex] || null;
      },

      advanceQueue: () => {
        const { adQueue, currentQueueIndex } = get();
        if (currentQueueIndex < adQueue.length - 1) {
          set({ currentQueueIndex: currentQueueIndex + 1 });
        }
      },

      rewindQueue: () => {
        const { currentQueueIndex } = get();
        if (currentQueueIndex > 0) {
          set({ currentQueueIndex: currentQueueIndex - 1 });
        }
      },

      clearQueue: () => {
        set({ adQueue: [], currentQueueIndex: 0 });
      },

      // ========================================
      // DISMISSED ADS
      // ========================================

      dismissAd: (adId) => {
        const { dismissedAdIds } = get();
        if (!dismissedAdIds.includes(adId)) {
          set({ dismissedAdIds: [...dismissedAdIds, adId] });
        }
      },

      clearDismissedAds: () => {
        set({ dismissedAdIds: [] });
      },

      isAdDismissed: (adId) => {
        return get().dismissedAdIds.includes(adId);
      },

      // ========================================
      // MODAL MANAGEMENT
      // ========================================

      showAdModal: (ad) => {
        set({ isAdModalVisible: true, currentModalAd: ad });
      },

      hideAdModal: () => {
        set({ isAdModalVisible: false, currentModalAd: null });
      },

      // ========================================
      // RESET
      // ========================================

      reset: () => set(initialState),
    }),
    {
      name: 'ad-ui-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist preferences and local metrics
        preferences: state.preferences,
        localMetrics: state.localMetrics,
        // Don't persist session state (queue, dismissedAds, modal)
      }),
    }
  ),
  { name: 'AdUIStore', enabled: __DEV__ },
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectAdPreferences = (state: AdUIState) => state.preferences;
export const selectPersonalizedAds = (state: AdUIState) => state.preferences.personalizedAds;
export const selectAdFrequency = (state: AdUIState) => state.preferences.adFrequency;
export const selectBlockedAdvertisers = (state: AdUIState) => state.preferences.blockedAdvertisers;
export const selectBlockedCategories = (state: AdUIState) => state.preferences.blockedCategories;
export const selectLocalMetrics = (state: AdUIState) => state.localMetrics;
export const selectAdQueue = (state: AdUIState) => state.adQueue;
export const selectCurrentQueueIndex = (state: AdUIState) => state.currentQueueIndex;
export const selectDismissedAdIds = (state: AdUIState) => state.dismissedAdIds;
export const selectIsAdModalVisible = (state: AdUIState) => state.isAdModalVisible;
export const selectCurrentModalAd = (state: AdUIState) => state.currentModalAd;

// ============================================================================
// CONVENIENCE HOOKS (pre-wrapped with useShallow for object selectors)
// ============================================================================

export const useAdPreferences = () => useAdUIStore(useShallow(selectAdPreferences));
export const useLocalMetrics = () => useAdUIStore(useShallow(selectLocalMetrics));
export const useAdQueue = () => useAdUIStore(useShallow(selectAdQueue));

export default useAdUIStore;
