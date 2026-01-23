/**
 * Ad API Service
 * REST API integration for advertisement management
 * Design System Compliant - Consistent with app API patterns
 */

import { api } from './api';
import type { Ad } from '../types';
import type { AdPlacement, AdType } from '../store/AdStore';

// ============================================================================
// TYPES
// ============================================================================

export interface AdFilters {
  type?: AdType;
  placement?: AdPlacement;
  isActive?: boolean;
  sponsored?: boolean;
  limit?: number;
  offset?: number;
}

export interface AdClickPayload {
  adId: string;
  timestamp: string;
  placement: AdPlacement;
  userId?: string;
  deviceInfo?: {
    platform: string;
    version: string;
  };
}

export interface AdImpressionPayload {
  adId: string;
  timestamp: string;
  placement: AdPlacement;
  duration: number;
  wasVisible: boolean;
  viewportPercentage: number;
  userId?: string;
}

export interface AdVideoProgressPayload {
  adId: string;
  progress: number; // 0-100
  currentTime: number;
  duration: number;
  wasCompleted: boolean;
  wasMuted: boolean;
}

export interface CreateAdPayload {
  title: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  type: AdType;
  sponsored?: boolean;
  targetUrl?: string;
  startDate?: string;
  endDate?: string;
  priority?: number;
  frequency?: number;
}

export interface UpdateAdPayload extends Partial<CreateAdPayload> {
  isActive?: boolean;
}

export interface AdResponse {
  success: boolean;
  data: Ad;
  message?: string;
}

export interface AdsListResponse {
  success: boolean;
  data: Ad[];
  total: number;
  page: number;
  limit: number;
  message?: string;
}

export interface AdAnalyticsResponse {
  success: boolean;
  data: {
    impressions: number;
    clicks: number;
    ctr: number;
    views: number;
    completionRate: number;
    avgViewDuration: number;
    revenue?: number;
  };
  message?: string;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

const AD_ENDPOINTS = {
  list: '/ads',
  featured: '/ads/featured',
  banners: '/ads/banners',
  videos: '/ads/videos',
  detail: (id: string) => `/ads/${id}`,
  create: '/ads',
  update: (id: string) => `/ads/${id}`,
  delete: (id: string) => `/ads/${id}`,
  click: (id: string) => `/ads/${id}/click`,
  impression: (id: string) => `/ads/${id}/impression`,
  videoProgress: (id: string) => `/ads/${id}/video-progress`,
  analytics: (id: string) => `/ads/${id}/analytics`,
  userAds: '/ads/user',
  random: '/ads/random',
  forPlacement: (placement: string) => `/ads/placement/${placement}`,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch all ads with optional filters
 */
export const fetchAds = async (filters?: AdFilters): Promise<AdsListResponse> => {
  try {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.placement) params.append('placement', filters.placement);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters?.sponsored !== undefined) params.append('sponsored', String(filters.sponsored));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const queryString = params.toString();
    const url = queryString ? `${AD_ENDPOINTS.list}?${queryString}` : AD_ENDPOINTS.list;
    
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching ads:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch ads');
  }
};

/**
 * Fetch featured ads
 */
export const fetchFeaturedAds = async (limit?: number): Promise<AdsListResponse> => {
  try {
    const url = limit ? `${AD_ENDPOINTS.featured}?limit=${limit}` : AD_ENDPOINTS.featured;
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching featured ads:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch featured ads');
  }
};

/**
 * Fetch banner ads
 */
export const fetchBannerAds = async (limit?: number): Promise<AdsListResponse> => {
  try {
    const url = limit ? `${AD_ENDPOINTS.banners}?limit=${limit}` : AD_ENDPOINTS.banners;
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching banner ads:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch banner ads');
  }
};

/**
 * Fetch video ads
 */
export const fetchVideoAds = async (limit?: number): Promise<AdsListResponse> => {
  try {
    const url = limit ? `${AD_ENDPOINTS.videos}?limit=${limit}` : AD_ENDPOINTS.videos;
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching video ads:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch video ads');
  }
};

/**
 * Fetch a single ad by ID
 */
export const fetchAdById = async (adId: string): Promise<AdResponse> => {
  try {
    const response = await api.get(AD_ENDPOINTS.detail(adId));
    return response.data;
  } catch (error: any) {
    console.error('Error fetching ad:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch ad');
  }
};

/**
 * Fetch ads for a specific placement
 */
export const fetchAdsForPlacement = async (
  placement: AdPlacement, 
  limit?: number
): Promise<AdsListResponse> => {
  try {
    const url = limit 
      ? `${AD_ENDPOINTS.forPlacement(placement)}?limit=${limit}` 
      : AD_ENDPOINTS.forPlacement(placement);
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching ads for placement:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch ads for placement');
  }
};

/**
 * Fetch a random ad
 */
export const fetchRandomAd = async (type?: AdType): Promise<AdResponse> => {
  try {
    const url = type ? `${AD_ENDPOINTS.random}?type=${type}` : AD_ENDPOINTS.random;
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching random ad:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch random ad');
  }
};

/**
 * Create a new ad
 */
export const createAd = async (payload: CreateAdPayload): Promise<AdResponse> => {
  try {
    const response = await api.post(AD_ENDPOINTS.create, payload);
    return response.data;
  } catch (error: any) {
    console.error('Error creating ad:', error);
    throw new Error(error.response?.data?.message || 'Failed to create ad');
  }
};

/**
 * Update an existing ad
 */
export const updateAd = async (adId: string, payload: UpdateAdPayload): Promise<AdResponse> => {
  try {
    const response = await api.put(AD_ENDPOINTS.update(adId), payload);
    return response.data;
  } catch (error: any) {
    console.error('Error updating ad:', error);
    throw new Error(error.response?.data?.message || 'Failed to update ad');
  }
};

/**
 * Delete an ad
 */
export const deleteAd = async (adId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.delete(AD_ENDPOINTS.delete(adId));
    return response.data;
  } catch (error: any) {
    console.error('Error deleting ad:', error);
    throw new Error(error.response?.data?.message || 'Failed to delete ad');
  }
};

/**
 * Record an ad click
 */
export const recordAdClick = async (payload: AdClickPayload): Promise<{ success: boolean }> => {
  try {
    const response = await api.post(AD_ENDPOINTS.click(payload.adId), payload);
    return response.data;
  } catch (error: any) {
    console.error('Error recording ad click:', error);
    // Don't throw - analytics shouldn't block user experience
    return { success: false };
  }
};

/**
 * Record an ad impression
 */
export const recordAdImpression = async (payload: AdImpressionPayload): Promise<{ success: boolean }> => {
  try {
    const response = await api.post(AD_ENDPOINTS.impression(payload.adId), payload);
    return response.data;
  } catch (error: any) {
    console.error('Error recording ad impression:', error);
    // Don't throw - analytics shouldn't block user experience
    return { success: false };
  }
};

/**
 * Record video ad progress
 */
export const recordVideoProgress = async (payload: AdVideoProgressPayload): Promise<{ success: boolean }> => {
  try {
    const response = await api.post(AD_ENDPOINTS.videoProgress(payload.adId), payload);
    return response.data;
  } catch (error: any) {
    console.error('Error recording video progress:', error);
    // Don't throw - analytics shouldn't block user experience
    return { success: false };
  }
};

/**
 * Fetch ad analytics
 */
export const fetchAdAnalytics = async (adId: string): Promise<AdAnalyticsResponse> => {
  try {
    const response = await api.get(AD_ENDPOINTS.analytics(adId));
    return response.data;
  } catch (error: any) {
    console.error('Error fetching ad analytics:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch ad analytics');
  }
};

/**
 * Fetch user's ads (for advertisers)
 */
export const fetchUserAds = async (filters?: AdFilters): Promise<AdsListResponse> => {
  try {
    const params = new URLSearchParams();
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const queryString = params.toString();
    const url = queryString ? `${AD_ENDPOINTS.userAds}?${queryString}` : AD_ENDPOINTS.userAds;
    
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching user ads:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch user ads');
  }
};

// ============================================================================
// EXPORT
// ============================================================================

export const adApi = {
  fetchAds,
  fetchFeaturedAds,
  fetchBannerAds,
  fetchVideoAds,
  fetchAdById,
  fetchAdsForPlacement,
  fetchRandomAd,
  createAd,
  updateAd,
  deleteAd,
  recordAdClick,
  recordAdImpression,
  recordVideoProgress,
  fetchAdAnalytics,
  fetchUserAds,
};

export default adApi;
