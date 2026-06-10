/**
 * Ad Hooks - TanStack Query hooks for advertisement data fetching
 * 
 * Following industry best practices:
 * - TanStack Query for server state (ad data, remote analytics)
 * - Zustand (AdUIStore) for client-only state (preferences, queue, local metrics)
 * 
 * This separation ensures:
 * - Automatic caching and deduplication of ad data
 * - Background refetching when app comes to foreground
 * - Optimistic updates for ad interactions
 * - No redundant state between Query cache and Zustand store
 * 
 * REST API integration - No mock data fallbacks
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, AppState, AppStateStatus, Linking } from 'react-native';
import type { Ad } from '../types';
import type { AdType } from '../store/AdStore';
import { adApi, type AdFilters, type CreateAdPayload, type UpdateAdPayload } from './adApi';
import { useAuthStore } from '../utils/auth/store';

// Import UI store for client-side interactions (NOT for caching server data)
import { useAdUIStore, type AdPlacement } from '../store/AdUIStore';
import { useAdEventQueueStore } from '../store/AdEventQueueStore';
import { useShallow } from 'zustand/react/shallow';

/** Time before data is considered stale (5 minutes) */
const STALE_TIME = 1000 * 60 * 5;

/** Time to keep data in cache (30 minutes) */
const GC_TIME = 1000 * 60 * 30;

/** Background refetch interval (10 minutes) */
const REFETCH_INTERVAL = 1000 * 60 * 10;

/**
 * Stable idempotency key for an ad event. Lets the server dedup retries / offline
 * re-sends of the same impression or click (so they count at most once).
 */
function generateEventId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  random: (type?: string, seed?: number) => [...adQueryKeys.all, 'random', type, seed] as const,
  userAdsList: () => [...adQueryKeys.all, 'user'] as const,
  userAds: (userId: string, filters?: AdFilters) => [...adQueryKeys.all, 'user', userId, filters] as const,
  analytics: (id: string) => [...adQueryKeys.all, 'analytics', id] as const,
};

// ============================================================================
// TYPES
// ============================================================================

export interface AdsListData {
  ads: Ad[];
  total: number;
}

export interface AdAnalyticsData {
  impressions: number;
  clicks: number;
  ctr: number;
  views: number;
  completionRate: number;
  avgViewDuration: number;
  revenue?: number;
}

// ============================================================================
// DATA FETCHING HOOKS
// ============================================================================

/**
 * Hook to fetch all ads with optional filters
 * Returns ad data directly - no Zustand sync needed
 */
export function useAds(filters?: AdFilters): UseQueryResult<AdsListData, Error> {
  return useQuery({
    queryKey: adQueryKeys.list(filters),
    queryFn: async (): Promise<AdsListData> => {
      const response = await adApi.fetchAds(filters);
      // response.data is { ads, featuredAd, bannerAd, all } — unwrap correctly
      const adsList = response.data?.all ?? response.data?.ads ?? [];
      return { ads: adsList, total: response.pagination?.total ?? adsList.length };
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch featured ads
 */
export function useFeaturedAds(limit?: number, options?: { enabled?: boolean }): UseQueryResult<Ad[], Error> {
  return useQuery({
    queryKey: adQueryKeys.featured(limit),
    queryFn: async (): Promise<Ad[]> => {
      const ads = await adApi.fetchFeaturedAds(limit);
      return ads ?? [];
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Hook to fetch banner ads
 */
export function useBannerAds(limit?: number, options?: { enabled?: boolean }): UseQueryResult<Ad[], Error> {
  return useQuery({
    queryKey: adQueryKeys.banners(limit),
    queryFn: async (): Promise<Ad[]> => {
      const ads = await adApi.fetchBannerAds(limit);
      return ads ?? [];
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Hook to fetch video ads
 */
export function useVideoAds(limit?: number): UseQueryResult<Ad[], Error> {
  return useQuery({
    queryKey: adQueryKeys.videos(limit),
    queryFn: async (): Promise<Ad[]> => {
      const ads = await adApi.fetchVideoAds(limit);
      return ads ?? [];
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Hook to fetch a single ad by ID
 */
export function useAdById(adId: string, enabled = true): UseQueryResult<Ad | null, Error> {
  return useQuery({
    queryKey: adQueryKeys.detail(adId),
    queryFn: async (): Promise<Ad | null> => {
      const response = await adApi.fetchAdById(adId);
      return response ?? null;
    },
    enabled: enabled && !!adId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Hook to fetch ads for a specific placement
 */
export function useAdsForPlacement(
  placement: AdPlacement,
  limit?: number,
  options?: { enabled?: boolean }
): UseQueryResult<Ad[], Error> {
  return useQuery({
    queryKey: adQueryKeys.placement(placement, limit),
    queryFn: async (): Promise<Ad[]> => {
      const ads = await adApi.fetchAdsForPlacement(placement, limit);
      return ads ?? [];
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Hook to fetch a random ad
 * Note: Uses seed to control caching behavior
 */
export function useRandomAd(
  type?: AdType, 
  options?: { enabled?: boolean; refetchOnMount?: boolean }
): UseQueryResult<Ad | null, Error> {
  // Use a random seed that changes every minute for some randomness
  const seed = Math.floor(Date.now() / 60000);
  
  return useQuery({
    queryKey: adQueryKeys.random(type, seed),
    queryFn: async (): Promise<Ad | null> => {
      const ad = await adApi.fetchRandomAd(type);
      return ad ?? null;
    },
    enabled: options?.enabled !== false,
    staleTime: 1000 * 60, // 1 minute for random ads
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: options?.refetchOnMount ?? false,
  });
}

/**
 * Consolidated ad data for a screen — fetches feed, banner, and featured
 * ads in a single query to avoid 3 parallel requests on mount.
 */
export interface ScreenAdsData {
  feedAds: Ad[];
  bannerAds: Ad[];
  featuredAds: Ad[];
}

export function useScreenAds(
  placement: AdPlacement,
  options?: { feedLimit?: number; bannerLimit?: number; featuredLimit?: number; enabled?: boolean }
): UseQueryResult<ScreenAdsData, Error> {
  const { feedLimit = 5, bannerLimit = 3, featuredLimit = 2, enabled = true } = options ?? {};

  return useQuery({
    queryKey: [...adQueryKeys.all, 'screen', placement, feedLimit, bannerLimit, featuredLimit],
    queryFn: async (): Promise<ScreenAdsData> => {
      const [feedAds, bannerAds, featuredAds] = await Promise.all([
        adApi.fetchAdsForPlacement(placement, feedLimit).catch(() => []),
        adApi.fetchBannerAds(bannerLimit).catch(() => []),
        adApi.fetchFeaturedAds(featuredLimit).catch(() => []),
      ]);
      const result = {
        feedAds: feedAds ?? [],
        bannerAds: bannerAds ?? [],
        featuredAds: featuredAds ?? [],
      };
      if (__DEV__) {
        console.log(`[useScreenAds] ${placement}: feed=${result.feedAds.length}, banner=${result.bannerAds.length}, featured=${result.featuredAds.length}`);
      }
      return result;
    },
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1, // Retry once for transient network errors
  });
}

/**
 * Hook to fetch user's created ads (for advertisers)
 */
export function useUserAds(userId: string, filters?: AdFilters): UseQueryResult<AdsListData, Error> {
  return useQuery({
    queryKey: adQueryKeys.userAds(userId, filters),
    queryFn: async (): Promise<AdsListData> => {
      const response = await adApi.fetchUserAds(userId, filters);
      // response.data is { ads, featuredAd, bannerAd, all } — unwrap correctly
      const adsList = response.data?.all ?? response.data?.ads ?? [];
      return { ads: adsList, total: response.pagination?.total ?? adsList.length };
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    enabled: !!userId,
  });
}

/**
 * Hook to fetch ad analytics (server-side analytics)
 */
export function useAdAnalytics(
  adId: string, 
  enabled = true
): UseQueryResult<AdAnalyticsData, Error> {
  return useQuery({
    queryKey: adQueryKeys.analytics(adId),
    queryFn: async (): Promise<AdAnalyticsData> => {
      const response = await adApi.fetchAdAnalytics(adId);
      // Map API response to AdAnalyticsData format
      return {
        impressions: response.data.impressions,
        clicks: response.data.clicks,
        ctr: response.data.ctr,
        views: response.data.views,
        completionRate: 0, // Not provided by API, default to 0
        avgViewDuration: 0, // Not provided by API, default to 0
      };
    },
    enabled: enabled && !!adId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Hook to create a new ad
 */
export function useCreateAd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ads', 'create'],
    mutationFn: (payload: CreateAdPayload) => adApi.createAd(payload),
    onSuccess: () => {
      // Invalidate all ad lists
      queryClient.invalidateQueries({ queryKey: adQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adQueryKeys.userAdsList() });
    },
  });
}

/**
 * Hook to update an existing ad
 */
export function useUpdateAd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ads', 'update'],
    mutationFn: ({ adId, payload }: { adId: string; payload: UpdateAdPayload }) =>
      adApi.updateAd(adId, payload),
    onSuccess: (_, { adId }) => {
      // Invalidate specific ad and lists
      queryClient.invalidateQueries({ queryKey: adQueryKeys.detail(adId) });
      queryClient.invalidateQueries({ queryKey: adQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adQueryKeys.userAdsList() });
    },
  });
}

/**
 * Hook to delete an ad
 */
export function useDeleteAd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ads', 'delete'],
    mutationFn: (adId: string) => adApi.deleteAd(adId),
    onSuccess: (_, adId) => {
      // Remove from cache and invalidate lists
      queryClient.removeQueries({ queryKey: adQueryKeys.detail(adId) });
      queryClient.invalidateQueries({ queryKey: adQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adQueryKeys.userAdsList() });
    },
  });
}

// ============================================================================
// ANALYTICS MUTATION HOOKS
// ============================================================================

/**
 * Hook to record ad click
 * Syncs to both local store and server
 */
export function useRecordAdClick() {
  const recordClick = useAdUIStore(s => s.recordClick);

  return useMutation({
    mutationKey: ['ads', 'recordClick'],
    mutationFn: async (payload: {
      adId: string;
      placement: AdPlacement;
      eventId?: string;
      deviceInfo?: { platform: string; version: string };
    }) => {
      // Record locally in UI store
      recordClick(payload.adId);

      // Send to server (idempotency key dedups retries server-side)
      const eventId = payload.eventId ?? generateEventId();
      const fullPayload = { ...payload, eventId, timestamp: new Date().toISOString() };
      const result = await adApi.recordAdClick(fullPayload);
      // On failure (offline / network), queue it for replay on reconnect. The eventId
      // makes the replay idempotent, so it counts at most once.
      if (!result?.success) {
        useAdEventQueueStore.getState().enqueue({ kind: 'click', eventId, payload: fullPayload });
      }
      return result;
    },
    // No in-mutation retry — the offline queue handles re-sends.
    retry: false,
  });
}

/**
 * Hook to record ad impression
 * Syncs to both local store and server
 */
export function useRecordAdImpression() {
  const recordImpression = useAdUIStore(s => s.recordImpression);

  return useMutation({
    mutationKey: ['ads', 'recordImpression'],
    mutationFn: async (payload: {
      adId: string;
      placement: AdPlacement;
      duration: number;
      eventId?: string;
      wasVisible?: boolean;
      viewportPercentage?: number;
    }) => {
      // Record locally in UI store
      recordImpression({
        adId: payload.adId,
        placement: payload.placement,
        duration: payload.duration,
        wasClicked: false,
        wasCompleted: false,
      });

      // Send to server (idempotency key dedups retries server-side)
      const eventId = payload.eventId ?? generateEventId();
      const fullPayload = {
        ...payload,
        eventId,
        timestamp: new Date().toISOString(),
        wasVisible: payload.wasVisible ?? true,
        viewportPercentage: payload.viewportPercentage ?? 100,
      };
      const result = await adApi.recordAdImpression(fullPayload);
      // On failure (offline / network), queue it for replay on reconnect (idempotent via eventId).
      if (!result?.success) {
        useAdEventQueueStore.getState().enqueue({ kind: 'impression', eventId, payload: fullPayload });
      }
      return result;
    },
    retry: false,
  });
}

/**
 * Hook to record video ad progress/completion
 */
export function useRecordVideoProgress() {
  const recordCompletion = useAdUIStore(s => s.recordCompletion);

  return useMutation({
    mutationKey: ['ads', 'recordVideoProgress'],
    mutationFn: async (payload: {
      adId: string;
      progress: number;
      currentTime: number;
      duration: number;
      wasCompleted: boolean;
      wasMuted?: boolean;
    }) => {
      // Record completion locally if video was completed
      if (payload.wasCompleted) {
        recordCompletion(payload.adId);
      }
      
      // Send to server
      return adApi.recordVideoProgress({
        ...payload,
        wasMuted: payload.wasMuted ?? false,
      });
    },
    retry: false,
  });
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to track ad visibility and automatically record impressions.
 *
 * Records EXACTLY ONE impression per view: on the visible→invisible transition, or on
 * unmount while still visible. The previous version fired in BOTH the invisible branch
 * AND the effect cleanup, so scrolling an ad out of view double-counted it (and the
 * cleanup re-ran on every dependency change, risking mid-view fires). A `firedRef` guard
 * + a separate unmount-only effect make it idempotent per view; each view carries its own
 * `eventId` so the server can dedup a re-send.
 *
 * @param viewportPercentage measured visible percentage (defaults to 100 when not measured)
 */
export function useAdImpressionTracker(
  ad: Ad | null,
  placement: AdPlacement,
  isVisible: boolean,
  viewportPercentage: number = 100
) {
  const viewStartTime = useRef<number | null>(null);
  const firedRef = useRef(false);
  const { mutate: recordImpression } = useRecordAdImpression();

  // Latest values in a ref so the unmount-only effect needn't depend on them.
  const latest = useRef({ ad, placement, viewportPercentage });
  latest.current = { ad, placement, viewportPercentage };

  // Fire the impression at most once for the current view.
  const fire = useCallback(() => {
    const { ad: a, placement: p, viewportPercentage: vp } = latest.current;
    if (!a || firedRef.current || viewStartTime.current == null) return;
    firedRef.current = true;
    const duration = Date.now() - viewStartTime.current;
    viewStartTime.current = null;
    recordImpression({
      adId: a.id,
      placement: p,
      duration,
      wasVisible: true,
      viewportPercentage: vp,
      eventId: generateEventId(),
    });
  }, [recordImpression]);

  // Visibility transitions: start timing when visible, record once when hidden.
  useEffect(() => {
    if (!ad) {
      viewStartTime.current = null;
      firedRef.current = false;
      return;
    }
    if (isVisible) {
      if (viewStartTime.current == null) {
        viewStartTime.current = Date.now();
        firedRef.current = false; // a fresh view
      }
    } else {
      fire();
    }
  }, [ad, isVisible, fire]);

  // Unmount-only: record once if still mid-view. `fire` is stable, so this does NOT
  // re-run on re-renders (which is what caused the old mid-view double-fire).
  useEffect(() => () => fire(), [fire]);

  return { impressionRecorded: firedRef.current };
}

/**
 * Hook to handle ad click with analytics tracking
 */
export function useAdClickHandler(placement: AdPlacement) {
  const { mutate: recordClick } = useRecordAdClick();

  return useCallback(
    (ad: Ad) => {
      recordClick({
        adId: ad.id,
        placement,
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version.toString(),
        },
      });
    },
    [placement, recordClick]
  );
}

/**
 * Hook to refresh ads when app comes to foreground
 */
export function useAdRefreshOnFocus() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Refresh active ad queries when app comes to foreground
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
}

/**
 * Hook to access ad preferences from UI store
 * (Convenience wrapper around Zustand store)
 */
export function useAdPreferences() {
  return useAdUIStore(useShallow((s) => ({
    preferences: s.preferences,
    updatePreferences: s.updatePreferences,
    togglePersonalizedAds: s.togglePersonalizedAds,
    setAdFrequency: s.setAdFrequency,
    blockAdvertiser: s.blockAdvertiser,
    unblockAdvertiser: s.unblockAdvertiser,
    blockCategory: s.blockCategory,
    unblockCategory: s.unblockCategory,
  })));
}

// ============================================================================
// COMBINED DATA HOOKS
// ============================================================================

/**
 * Hook to get all ads needed for a page/placement
 * Combines multiple ad queries efficiently
 */
export function usePageAds(placement: AdPlacement) {
  const featuredQuery = useFeaturedAds(2);
  const bannerQuery = useBannerAds(3);
  const placementQuery = useAdsForPlacement(placement, 5);

  const isLoading = 
    featuredQuery.isLoading || 
    bannerQuery.isLoading || 
    placementQuery.isLoading;

  const isFetching =
    featuredQuery.isFetching ||
    bannerQuery.isFetching ||
    placementQuery.isFetching;

  const isError = 
    featuredQuery.isError || 
    bannerQuery.isError || 
    placementQuery.isError;

  const error = featuredQuery.error || bannerQuery.error || placementQuery.error;

  const refetchAll = useCallback(async () => {
    await Promise.all([
      featuredQuery.refetch(),
      bannerQuery.refetch(),
      placementQuery.refetch(),
    ]);
  }, [featuredQuery, bannerQuery, placementQuery]);

  return {
    featuredAds: featuredQuery.data || [],
    bannerAds: bannerQuery.data || [],
    placementAds: placementQuery.data || [],
    isLoading,
    isFetching,
    isError,
    error,
    refetchAll,
  };
}

/**
 * Hook for ad data needed in ad registration/management screens
 */
export function useAdManagement() {
  const userId = useAuthStore(s => s.auth?.user?.id ?? '');
  const userAdsQuery = useUserAds(userId);
  const createAdMutation = useCreateAd();
  const updateAdMutation = useUpdateAd();
  const deleteAdMutation = useDeleteAd();

  return {
    // Data
    userAds: userAdsQuery.data?.ads || [],
    totalAds: userAdsQuery.data?.total || 0,
    
    // Loading states
    isLoading: userAdsQuery.isLoading,
    isCreating: createAdMutation.isPending,
    isUpdating: updateAdMutation.isPending,
    isDeleting: deleteAdMutation.isPending,
    
    // Error states
    isError: userAdsQuery.isError,
    error: userAdsQuery.error,
    
    // Mutations
    createAd: createAdMutation.mutateAsync,
    updateAd: updateAdMutation.mutateAsync,
    deleteAd: deleteAdMutation.mutateAsync,
    
    // Refetch
    refetch: userAdsQuery.refetch,
  };
}

// ============================================================================
// CACHE UTILITIES
// ============================================================================

/**
 * Hook to invalidate ad caches
 */
export function useInvalidateAdCache() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: adQueryKeys.all });
    },
    invalidateLists: () => {
      queryClient.invalidateQueries({ queryKey: adQueryKeys.lists() });
    },
    invalidateAd: (adId: string) => {
      queryClient.invalidateQueries({ queryKey: adQueryKeys.detail(adId) });
    },
    invalidateFeatured: () => {
      queryClient.invalidateQueries({ queryKey: adQueryKeys.featured() });
    },
    invalidateBanners: () => {
      queryClient.invalidateQueries({ queryKey: adQueryKeys.banners() });
    },
    invalidateVideos: () => {
      queryClient.invalidateQueries({ queryKey: adQueryKeys.videos() });
    },
    prefetchAd: (adId: string) => {
      queryClient.prefetchQuery({
        queryKey: adQueryKeys.detail(adId),
        queryFn: async () => {
          const response = await adApi.fetchAdById(adId);
          return response ?? null;
        },
      });
    },
  };
}
