/**
 * Ad Hooks - React Query hooks for ad data fetching
 * Design System Compliant - Consistent with app data fetching patterns
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { useAdStore } from '../store/AdStore';
import type { AdPlacement, AdType, AdImpression } from '../store/AdStore';
import {
  adApi,
  type AdFilters,
  type AdClickPayload,
  type AdImpressionPayload,
  type AdVideoProgressPayload,
  type CreateAdPayload,
  type UpdateAdPayload,
} from './adApi';
import { MOCK_ADS } from '../data/mockAdData';
import type { Ad } from '../types';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const adQueryKeys = {
  all: ['ads'] as const,
  lists: () => [...adQueryKeys.all, 'list'] as const,
  list: (filters?: AdFilters) => [...adQueryKeys.lists(), filters] as const,
  featured: (limit?: number) => [...adQueryKeys.all, 'featured', limit] as const,
  banners: (limit?: number) => [...adQueryKeys.all, 'banners', limit] as const,
  videos: (limit?: number) => [...adQueryKeys.all, 'videos', limit] as const,
  detail: (id: string) => [...adQueryKeys.all, 'detail', id] as const,
  placement: (placement: AdPlacement, limit?: number) => 
    [...adQueryKeys.all, 'placement', placement, limit] as const,
  random: (type?: AdType) => [...adQueryKeys.all, 'random', type] as const,
  userAds: (filters?: AdFilters) => [...adQueryKeys.all, 'user', filters] as const,
  analytics: (id: string) => [...adQueryKeys.all, 'analytics', id] as const,
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const USE_MOCK_DATA = true; // Toggle for development
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 30 * 60 * 1000; // 30 minutes
const REFETCH_INTERVAL = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// FETCH HOOKS
// ============================================================================

/**
 * Hook to fetch all ads with optional filters
 */
export const useAds = (filters?: AdFilters) => {
  const { setAds } = useAdStore();

  return useQuery({
    queryKey: adQueryKeys.list(filters),
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        // Filter mock data based on filters
        let filteredAds = [...MOCK_ADS];
        
        if (filters?.type) {
          filteredAds = filteredAds.filter(ad => ad.type === filters.type);
        }
        if (filters?.isActive !== undefined) {
          filteredAds = filteredAds.filter(ad => ad.isActive === filters.isActive);
        }
        if (filters?.sponsored !== undefined) {
          filteredAds = filteredAds.filter(ad => ad.sponsored === filters.sponsored);
        }
        if (filters?.limit) {
          filteredAds = filteredAds.slice(0, filters.limit);
        }
        
        return { data: filteredAds, total: filteredAds.length };
      }
      
      const response = await adApi.fetchAds(filters);
      return { data: response.data, total: response.pagination?.total || response.data.length };
    },
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    select: (data) => {
      setAds(data.data);
      return data;
    },
  });
};

/**
 * Hook to fetch featured ads
 */
export const useFeaturedAds = (limit?: number) => {
  const { setFeaturedAds } = useAdStore();

  return useQuery({
    queryKey: adQueryKeys.featured(limit),
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        const featured = MOCK_ADS.filter(ad => ad.type === 'featured' && ad.isActive);
        return { data: limit ? featured.slice(0, limit) : featured };
      }
      
      const response = await adApi.fetchFeaturedAds(limit);
      return { data: response.data };
    },
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    select: (data) => {
      setFeaturedAds(data.data);
      return data.data;
    },
  });
};

/**
 * Hook to fetch banner ads
 */
export const useBannerAds = (limit?: number) => {
  const { setBannerAds } = useAdStore();

  return useQuery({
    queryKey: adQueryKeys.banners(limit),
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        const banners = MOCK_ADS.filter(ad => ad.type === 'banner' && ad.isActive);
        return { data: limit ? banners.slice(0, limit) : banners };
      }
      
      const response = await adApi.fetchBannerAds(limit);
      return { data: response.data };
    },
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    select: (data) => {
      setBannerAds(data.data);
      return data.data;
    },
  });
};

/**
 * Hook to fetch video ads
 */
export const useVideoAds = (limit?: number) => {
  const { setVideoAds } = useAdStore();

  return useQuery({
    queryKey: adQueryKeys.videos(limit),
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        const videos = MOCK_ADS.filter(ad => ad.videoUrl && ad.isActive);
        return { data: limit ? videos.slice(0, limit) : videos };
      }
      
      const response = await adApi.fetchVideoAds(limit);
      return { data: response.data };
    },
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    select: (data) => {
      setVideoAds(data.data);
      return data.data;
    },
  });
};

/**
 * Hook to fetch a single ad by ID
 */
export const useAdById = (adId: string, enabled = true) => {
  return useQuery({
    queryKey: adQueryKeys.detail(adId),
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        const ad = MOCK_ADS.find(a => a.id === adId);
        if (!ad) throw new Error('Ad not found');
        return ad;
      }
      
      const response = await adApi.fetchAdById(adId);
      return response.data;
    },
    enabled: enabled && !!adId,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
};

/**
 * Hook to fetch ads for a specific placement
 */
export const useAdsForPlacement = (placement: AdPlacement, limit?: number) => {
  return useQuery({
    queryKey: adQueryKeys.placement(placement, limit),
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        // Simulate placement-based filtering
        let ads = MOCK_ADS.filter(ad => ad.isActive);
        
        switch (placement) {
          case 'home':
            ads = ads.filter(ad => ad.type === 'featured' || ad.type === 'banner');
            break;
          case 'feed':
            ads = ads.filter(ad => ad.type === 'regular' || ad.type === 'banner');
            break;
          case 'video':
            ads = ads.filter(ad => ad.videoUrl);
            break;
          default:
            break;
        }
        
        return { data: limit ? ads.slice(0, limit) : ads };
      }
      
      const response = await adApi.fetchAdsForPlacement(placement, limit);
      return { data: response.data };
    },
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
};

/**
 * Hook to fetch a random ad
 */
export const useRandomAd = (type?: AdType, enabled = true) => {
  return useQuery({
    queryKey: adQueryKeys.random(type),
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        let pool = MOCK_ADS.filter(ad => ad.isActive);
        if (type) {
          pool = pool.filter(ad => ad.type === type);
        }
        if (pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
      }
      
      const response = await adApi.fetchRandomAd(type);
      return response.data;
    },
    enabled,
    staleTime: 0, // Always fetch fresh for random ads
    gcTime: 0,
  });
};

/**
 * Hook to fetch user's ads (for advertisers)
 */
export const useUserAds = (userId?: string, filters?: AdFilters) => {
  return useQuery({
    queryKey: adQueryKeys.userAds(filters),
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        return { data: MOCK_ADS.slice(0, 5), total: 5 };
      }
      
      if (!userId) {
        return { data: [], total: 0 };
      }

      const response = await adApi.fetchUserAds(userId, filters);
      return { data: response.data, total: response.pagination?.total || response.data.length };
    },
    enabled: !!userId || USE_MOCK_DATA,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
};

/**
 * Hook to fetch ad analytics
 */
export const useAdAnalytics = (adId: string, enabled = true) => {
  return useQuery({
    queryKey: adQueryKeys.analytics(adId),
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        return {
          impressions: Math.floor(Math.random() * 10000),
          clicks: Math.floor(Math.random() * 500),
          ctr: Math.random() * 5,
          views: Math.floor(Math.random() * 8000),
          completionRate: Math.random() * 80,
          avgViewDuration: Math.floor(Math.random() * 30),
        };
      }
      
      const response = await adApi.fetchAdAnalytics(adId);
      return response.data;
    },
    enabled: enabled && !!adId,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
};

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Hook to create a new ad
 */
export const useCreateAd = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAdPayload) => adApi.createAd(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adQueryKeys.all });
    },
  });
};

/**
 * Hook to update an ad
 */
export const useUpdateAd = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adId, payload }: { adId: string; payload: UpdateAdPayload }) =>
      adApi.updateAd(adId, payload),
    onSuccess: (_, { adId }) => {
      queryClient.invalidateQueries({ queryKey: adQueryKeys.detail(adId) });
      queryClient.invalidateQueries({ queryKey: adQueryKeys.lists() });
    },
  });
};

/**
 * Hook to delete an ad
 */
export const useDeleteAd = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adId: string) => adApi.deleteAd(adId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adQueryKeys.all });
    },
  });
};

// ============================================================================
// ANALYTICS HOOKS
// ============================================================================

/**
 * Hook to record ad click
 */
export const useRecordAdClick = () => {
  const { recordClick } = useAdStore();

  return useMutation({
    mutationFn: (payload: AdClickPayload) => {
      // Record locally
      recordClick(payload.adId);
      
      // Send to server (fire and forget)
      return adApi.recordAdClick(payload);
    },
  });
};

/**
 * Hook to record ad impression
 */
export const useRecordAdImpression = () => {
  const { recordImpression } = useAdStore();

  return useMutation({
    mutationFn: (payload: AdImpressionPayload) => {
      // Record locally
      const impression: AdImpression = {
        adId: payload.adId,
        timestamp: payload.timestamp,
        placement: payload.placement,
        duration: payload.duration,
        wasClicked: false,
        wasCompleted: false,
      };
      recordImpression(impression);
      
      // Send to server
      return adApi.recordAdImpression(payload);
    },
  });
};

/**
 * Hook to record video ad progress
 */
export const useRecordVideoProgress = () => {
  const { recordCompletion } = useAdStore();

  return useMutation({
    mutationFn: (payload: AdVideoProgressPayload) => {
      // Record completion if video was completed
      if (payload.wasCompleted) {
        recordCompletion(payload.adId);
      }
      
      // Send to server
      return adApi.recordVideoProgress(payload);
    },
  });
};

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to track ad visibility and record impressions
 */
export const useAdImpressionTracker = (
  ad: Ad | null,
  placement: AdPlacement,
  isVisible: boolean
) => {
  const impressionRecorded = useRef(false);
  const viewStartTime = useRef<number | null>(null);
  const { mutate: recordImpression } = useRecordAdImpression();

  useEffect(() => {
    if (!ad || !isVisible) {
      if (viewStartTime.current && ad) {
        // Record view duration when ad becomes invisible
        const duration = Date.now() - viewStartTime.current;
        recordImpression({
          adId: ad.id,
          timestamp: new Date().toISOString(),
          placement,
          duration,
          wasVisible: true,
          viewportPercentage: 100,
        });
      }
      viewStartTime.current = null;
      return;
    }

    if (!impressionRecorded.current) {
      viewStartTime.current = Date.now();
      impressionRecorded.current = true;
    }

    return () => {
      if (viewStartTime.current && ad) {
        const duration = Date.now() - viewStartTime.current;
        recordImpression({
          adId: ad.id,
          timestamp: new Date().toISOString(),
          placement,
          duration,
          wasVisible: true,
          viewportPercentage: 100,
        });
      }
    };
  }, [ad, isVisible, placement, recordImpression]);

  return { impressionRecorded: impressionRecorded.current };
};

/**
 * Hook to handle ad click with analytics
 */
export const useAdClickHandler = (placement: AdPlacement) => {
  const { mutate: recordClick } = useRecordAdClick();

  return useCallback(
    (ad: Ad) => {
      recordClick({
        adId: ad.id,
        timestamp: new Date().toISOString(),
        placement,
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version.toString(),
        },
      });
    },
    [placement, recordClick]
  );
};

/**
 * Hook to refresh ads on app focus
 */
export const useAdRefreshOnFocus = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Refresh ads when app comes to foreground
        queryClient.invalidateQueries({ 
          queryKey: adQueryKeys.all,
          refetchType: 'active',
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [queryClient]);
};

/**
 * Hook to get ad preferences and update them
 */
export const useAdPreferences = () => {
  const { 
    preferences, 
    updatePreferences,
    blockAdvertiser,
    unblockAdvertiser,
    blockCategory,
    unblockCategory,
  } = useAdStore();

  return {
    preferences,
    updatePreferences,
    blockAdvertiser,
    unblockAdvertiser,
    blockCategory,
    unblockCategory,
    togglePersonalizedAds: () => 
      updatePreferences({ personalizedAds: !preferences.personalizedAds }),
    setAdFrequency: (frequency: 'low' | 'medium' | 'high') =>
      updatePreferences({ adFrequency: frequency }),
  };
};

// ============================================================================
// COMBINED HOOKS
// ============================================================================

/**
 * Hook to get all ads for a page (combines multiple ad types)
 */
export const usePageAds = (placement: AdPlacement) => {
  const featuredQuery = useFeaturedAds(2);
  const bannerQuery = useBannerAds(3);
  const standardQuery = useAds({ isActive: true, limit: 5 });

  const isLoading = 
    featuredQuery.isLoading || 
    bannerQuery.isLoading || 
    standardQuery.isLoading;

  const isError = 
    featuredQuery.isError || 
    bannerQuery.isError || 
    standardQuery.isError;

  const refetch = useCallback(async () => {
    await Promise.all([
      featuredQuery.refetch(),
      bannerQuery.refetch(),
      standardQuery.refetch(),
    ]);
  }, [featuredQuery, bannerQuery, standardQuery]);

  return {
    featuredAds: featuredQuery.data || [],
    bannerAds: bannerQuery.data || [],
    standardAds: standardQuery.data?.data || [],
    isLoading,
    isError,
    refetch,
  };
};
