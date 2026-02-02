/**
 * Ad Hooks - React Query hooks for ad data fetching
 * Design System Compliant - Consistent with app data fetching patterns
 * REST API integration - No mock data fallbacks
 */

import React, { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdStore } from '../store/AdStore';
import type { AdPlacement, AdType } from '../store/AdStore';
import {
  adApi,
  type AdFilters,
  type AdClickPayload,
  type AdImpressionPayload,
  type AdVideoProgressPayload,
  type CreateAdPayload,
  type UpdateAdPayload,
} from './adApi';
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
      if (!userId) {
        return { data: [], total: 0 };
      }

      const response = await adApi.fetchUserAds(userId, filters);
      return { data: response.data, total: response.pagination?.total || response.data.length };
    },
    enabled: !!userId,
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
 * Hook to track ad click
 */
export const useTrackAdClick = () => {
  const { recordImpression } = useAdStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AdClickPayload) => {
      const response = await adApi.recordAdClick(payload);
      return response;
    },
    onSuccess: (_, variables) => {
      // Update local store
      recordImpression({
        adId: variables.adId,
        timestamp: new Date().toISOString(),
        placement: variables.placement as AdPlacement,
        duration: 0,
        wasClicked: true,
        wasCompleted: false,
      });
      // Invalidate analytics queries
      queryClient.invalidateQueries({ queryKey: adQueryKeys.analytics(variables.adId) });
    },
  });
};

/**
 * Hook to track ad impression
 */
export const useTrackAdImpression = () => {
  const { recordImpression } = useAdStore();

  return useMutation({
    mutationFn: async (payload: AdImpressionPayload) => {
      const response = await adApi.recordAdImpression(payload);
      return response;
    },
    onSuccess: (_, variables) => {
      recordImpression({
        adId: variables.adId,
        timestamp: new Date().toISOString(),
        placement: variables.placement as AdPlacement,
        duration: variables.duration || 0,
        wasClicked: false,
        wasCompleted: false,
      });
    },
  });
};

/**
 * Hook to track video ad progress
 */
export const useTrackVideoProgress = () => {
  return useMutation({
    mutationFn: async (payload: AdVideoProgressPayload) => {
      const response = await adApi.recordVideoProgress(payload);
      return response;
    },
  });
};

/**
 * Hook to create a new ad
 */
export const useCreateAd = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAdPayload) => {
      const response = await adApi.createAd(payload);
      return response.data;
    },
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
    mutationFn: async ({ adId, payload }: { adId: string; payload: UpdateAdPayload }) => {
      const response = await adApi.updateAd(adId, payload);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: adQueryKeys.detail(variables.adId) });
      queryClient.invalidateQueries({ queryKey: adQueryKeys.all });
    },
  });
};

/**
 * Hook to delete an ad
 */
export const useDeleteAd = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (adId: string) => {
      const response = await adApi.deleteAd(adId);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adQueryKeys.all });
    },
  });
};

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook for automatic impression tracking when ad becomes visible
 */
export const useAdImpressionTracking = (
  ad: Ad | null,
  placement: AdPlacement,
  isVisible: boolean = true
) => {
  const trackImpression = useTrackAdImpression();
  const impressionStartRef = useRef<number | null>(null);
  const hasTrackedRef = useRef(false);
  const adIdRef = useRef(ad?.id);

  // Update ref when ad changes
  useEffect(() => {
    adIdRef.current = ad?.id;
  }, [ad?.id]);

  useEffect(() => {
    if (!ad || !isVisible) {
      // Reset when ad changes or becomes invisible
      if (impressionStartRef.current && adIdRef.current) {
        const duration = Date.now() - impressionStartRef.current;
        if (duration >= 1000 && !hasTrackedRef.current) {
          trackImpression.mutate({
            adId: adIdRef.current,
            timestamp: new Date().toISOString(),
            placement,
            duration: Math.floor(duration / 1000),
            wasVisible: true,
            viewportPercentage: 100,
          });
          hasTrackedRef.current = true;
        }
      }
      impressionStartRef.current = null;
      return;
    }

    impressionStartRef.current = Date.now();
    hasTrackedRef.current = false;

    return () => {
      if (impressionStartRef.current && !hasTrackedRef.current && adIdRef.current) {
        const duration = Date.now() - impressionStartRef.current;
        if (duration >= 1000) {
          trackImpression.mutate({
            adId: adIdRef.current,
            timestamp: new Date().toISOString(),
            placement,
            duration: Math.floor(duration / 1000),
            wasVisible: true,
            viewportPercentage: 100,
          });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad?.id, isVisible, placement]);
};

/**
 * Hook for ad rotation with configurable interval
 */
export const useAdRotation = (ads: Ad[], intervalMs: number = 10000) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  useEffect(() => {
    if (ads.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [ads.length, intervalMs]);

  return {
    currentAd: ads[currentIndex] || null,
    currentIndex,
    setCurrentIndex,
    totalAds: ads.length,
  };
};

export default {
  useAds,
  useFeaturedAds,
  useBannerAds,
  useVideoAds,
  useAdById,
  useAdsForPlacement,
  useRandomAd,
  useUserAds,
  useAdAnalytics,
  useTrackAdClick,
  useTrackAdImpression,
  useTrackVideoProgress,
  useCreateAd,
  useUpdateAd,
  useDeleteAd,
  useAdImpressionTracking,
  useAdRotation,
};
