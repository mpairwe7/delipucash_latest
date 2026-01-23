/**
 * Ad Store - State Management for Advertisements
 * Zustand-based store for managing ad state, preferences, and analytics
 * Design System Compliant - Consistent with app architecture
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Ad } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type AdType = 'standard' | 'featured' | 'banner' | 'compact' | 'video' | 'native' | 'interstitial';
export type AdPlacement = 'home' | 'feed' | 'survey' | 'video' | 'question' | 'profile' | 'explore';
export type AdStatus = 'active' | 'paused' | 'expired' | 'pending';

export interface AdMetrics {
  impressions: number;
  clicks: number;
  ctr: number; // Click-through rate
  viewDuration: number; // Average view duration in ms
  completionRate: number; // For video ads
  lastUpdated: string;
}

export interface AdPreferences {
  personalizedAds: boolean;
  adFrequency: 'low' | 'medium' | 'high';
  blockedCategories: string[];
  blockedAdvertisers: string[];
}

export interface AdImpression {
  adId: string;
  timestamp: string;
  placement: AdPlacement;
  duration: number;
  wasClicked: boolean;
  wasCompleted: boolean;
}

export interface AdState {
  // Current ads
  ads: Ad[];
  featuredAds: Ad[];
  bannerAds: Ad[];
  videoAds: Ad[];
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  
  // User preferences
  preferences: AdPreferences;
  
  // Analytics
  impressions: AdImpression[];
  metrics: Record<string, AdMetrics>;
  
  // Ad queue for sequential display
  adQueue: Ad[];
  currentAdIndex: number;
  
  // Last fetch timestamp
  lastFetchTimestamp: string | null;
}

export interface AdActions {
  // Data fetching
  setAds: (ads: Ad[]) => void;
  setFeaturedAds: (ads: Ad[]) => void;
  setBannerAds: (ads: Ad[]) => void;
  setVideoAds: (ads: Ad[]) => void;
  
  // Loading states
  setLoading: (isLoading: boolean) => void;
  setRefreshing: (isRefreshing: boolean) => void;
  setError: (error: string | null) => void;
  
  // Ad interactions
  recordImpression: (impression: AdImpression) => void;
  recordClick: (adId: string) => void;
  recordCompletion: (adId: string) => void;
  
  // Preferences
  updatePreferences: (preferences: Partial<AdPreferences>) => void;
  blockAdvertiser: (advertiserId: string) => void;
  unblockAdvertiser: (advertiserId: string) => void;
  blockCategory: (category: string) => void;
  unblockCategory: (category: string) => void;
  
  // Ad queue management
  addToQueue: (ad: Ad) => void;
  removeFromQueue: (adId: string) => void;
  nextAd: () => Ad | null;
  previousAd: () => Ad | null;
  clearQueue: () => void;
  
  // Utility
  getAdById: (adId: string) => Ad | undefined;
  getAdsByType: (type: AdType) => Ad[];
  getAdsByPlacement: (placement: AdPlacement) => Ad[];
  getRandomAd: (type?: AdType) => Ad | null;
  
  // Reset
  reset: () => void;
  clearImpressions: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AdState = {
  ads: [],
  featuredAds: [],
  bannerAds: [],
  videoAds: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  preferences: {
    personalizedAds: true,
    adFrequency: 'medium',
    blockedCategories: [],
    blockedAdvertisers: [],
  },
  impressions: [],
  metrics: {},
  adQueue: [],
  currentAdIndex: 0,
  lastFetchTimestamp: null,
};

// ============================================================================
// STORE
// ============================================================================

export const useAdStore = create<AdState & AdActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Data fetching
      setAds: (ads) => set({ ads, lastFetchTimestamp: new Date().toISOString() }),
      setFeaturedAds: (ads) => set({ featuredAds: ads }),
      setBannerAds: (ads) => set({ bannerAds: ads }),
      setVideoAds: (ads) => set({ videoAds: ads }),

      // Loading states
      setLoading: (isLoading) => set({ isLoading }),
      setRefreshing: (isRefreshing) => set({ isRefreshing }),
      setError: (error) => set({ error }),

      // Ad interactions
      recordImpression: (impression) => {
        const { impressions, metrics } = get();
        const existingMetrics = metrics[impression.adId] || {
          impressions: 0,
          clicks: 0,
          ctr: 0,
          viewDuration: 0,
          completionRate: 0,
          lastUpdated: new Date().toISOString(),
        };

        const newImpressions = existingMetrics.impressions + 1;
        const newViewDuration = 
          (existingMetrics.viewDuration * existingMetrics.impressions + impression.duration) / newImpressions;

        set({
          impressions: [...impressions, impression],
          metrics: {
            ...metrics,
            [impression.adId]: {
              ...existingMetrics,
              impressions: newImpressions,
              viewDuration: newViewDuration,
              ctr: existingMetrics.clicks / newImpressions,
              lastUpdated: new Date().toISOString(),
            },
          },
        });
      },

      recordClick: (adId) => {
        const { metrics } = get();
        const existingMetrics = metrics[adId] || {
          impressions: 1,
          clicks: 0,
          ctr: 0,
          viewDuration: 0,
          completionRate: 0,
          lastUpdated: new Date().toISOString(),
        };

        const newClicks = existingMetrics.clicks + 1;

        set({
          metrics: {
            ...metrics,
            [adId]: {
              ...existingMetrics,
              clicks: newClicks,
              ctr: newClicks / existingMetrics.impressions,
              lastUpdated: new Date().toISOString(),
            },
          },
        });
      },

      recordCompletion: (adId) => {
        const { metrics } = get();
        const existingMetrics = metrics[adId] || {
          impressions: 1,
          clicks: 0,
          ctr: 0,
          viewDuration: 0,
          completionRate: 0,
          lastUpdated: new Date().toISOString(),
        };

        const completions = Math.round(existingMetrics.completionRate * existingMetrics.impressions) + 1;
        const newCompletionRate = completions / existingMetrics.impressions;

        set({
          metrics: {
            ...metrics,
            [adId]: {
              ...existingMetrics,
              completionRate: newCompletionRate,
              lastUpdated: new Date().toISOString(),
            },
          },
        });
      },

      // Preferences
      updatePreferences: (newPreferences) => {
        const { preferences } = get();
        set({ preferences: { ...preferences, ...newPreferences } });
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
        const { preferences } = get();
        set({
          preferences: {
            ...preferences,
            blockedAdvertisers: preferences.blockedAdvertisers.filter((id) => id !== advertiserId),
          },
        });
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
        const { preferences } = get();
        set({
          preferences: {
            ...preferences,
            blockedCategories: preferences.blockedCategories.filter((c) => c !== category),
          },
        });
      },

      // Ad queue management
      addToQueue: (ad) => {
        const { adQueue } = get();
        if (!adQueue.find((a) => a.id === ad.id)) {
          set({ adQueue: [...adQueue, ad] });
        }
      },

      removeFromQueue: (adId) => {
        const { adQueue, currentAdIndex } = get();
        const newQueue = adQueue.filter((a) => a.id !== adId);
        const newIndex = Math.min(currentAdIndex, Math.max(0, newQueue.length - 1));
        set({ adQueue: newQueue, currentAdIndex: newIndex });
      },

      nextAd: () => {
        const { adQueue, currentAdIndex } = get();
        if (currentAdIndex < adQueue.length - 1) {
          set({ currentAdIndex: currentAdIndex + 1 });
          return adQueue[currentAdIndex + 1];
        }
        return null;
      },

      previousAd: () => {
        const { adQueue, currentAdIndex } = get();
        if (currentAdIndex > 0) {
          set({ currentAdIndex: currentAdIndex - 1 });
          return adQueue[currentAdIndex - 1];
        }
        return null;
      },

      clearQueue: () => set({ adQueue: [], currentAdIndex: 0 }),

      // Utility
      getAdById: (adId) => {
        const { ads, featuredAds, bannerAds, videoAds } = get();
        return [...ads, ...featuredAds, ...bannerAds, ...videoAds].find((a) => a.id === adId);
      },

      getAdsByType: (type) => {
        const { ads, featuredAds, bannerAds, videoAds } = get();
        const allAds = [...ads, ...featuredAds, ...bannerAds, ...videoAds];
        return allAds.filter((a) => a.type === type);
      },

      getAdsByPlacement: (placement) => {
        const { ads } = get();
        // Filter based on placement logic - can be extended
        return ads.filter((ad) => ad.isActive);
      },

      getRandomAd: (type) => {
        const { ads, featuredAds, bannerAds, videoAds, preferences } = get();
        let pool = [...ads, ...featuredAds, ...bannerAds, ...videoAds].filter(
          (ad) => 
            ad.isActive && 
            !preferences.blockedAdvertisers.includes(ad.userId)
        );

        if (type) {
          pool = pool.filter((ad) => ad.type === type);
        }

        if (pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
      },

      // Reset
      reset: () => set(initialState),
      clearImpressions: () => set({ impressions: [], metrics: {} }),
    }),
    {
      name: 'ad-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        metrics: state.metrics,
      }),
    }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectActiveAds = (state: AdState) => 
  state.ads.filter((ad) => ad.isActive);

export const selectFeaturedAds = (state: AdState) => 
  state.featuredAds.filter((ad) => ad.isActive);

export const selectBannerAds = (state: AdState) => 
  state.bannerAds.filter((ad) => ad.isActive);

export const selectVideoAds = (state: AdState) => 
  state.videoAds.filter((ad) => ad.isActive);

export const selectAdMetrics = (adId: string) => (state: AdState) => 
  state.metrics[adId];

export const selectTotalImpressions = (state: AdState) => 
  state.impressions.length;

export const selectAdPreferences = (state: AdState) => 
  state.preferences;

// Re-export Ad type for convenience
export type { Ad };
