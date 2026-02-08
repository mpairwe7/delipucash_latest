/**
 * Ad API Service
 * REST API integration for advertisement management
 * Design System Compliant - Consistent with app API patterns
 * Enhanced with industry-standard ad management features
 */

import { api } from './api';
import type { Ad } from '../types';
import type { AdPlacement, AdType } from '../store/AdStore';

// ============================================================================
// TYPES - Industry Standard Ad Configuration
// ============================================================================

// Pricing models following IAB standards
export type PricingModel = 'cpm' | 'cpc' | 'cpa' | 'flat';

// Call-to-action button types
export type CTAType = 
  | 'learn_more' 
  | 'shop_now' 
  | 'sign_up' 
  | 'download' 
  | 'contact_us' 
  | 'get_offer' 
  | 'book_now' 
  | 'watch_more' 
  | 'apply_now' 
  | 'subscribe' 
  | 'get_quote';

// Age range targeting options
export type AgeRange = '13-17' | '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';

// Gender targeting options
export type Gender = 'all' | 'male' | 'female' | 'other';

// Ad status types
export type AdStatus = 'pending' | 'approved' | 'rejected' | 'paused' | 'completed';

export interface AdFilters {
  type?: AdType;
  placement?: AdPlacement;
  status?: AdStatus;
  isActive?: boolean;
  sponsored?: boolean;
  userId?: string;
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

export interface AdConversionPayload {
  adId: string;
  conversionType?: string;
  value?: number;
}

// Enhanced CreateAdPayload with industry-standard fields
export interface CreateAdPayload {
  // Basic info
  title: string;
  headline?: string;
  description: string;
  
  // Media
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  
  // Ad configuration
  type: AdType;
  placement: AdPlacement;
  sponsored?: boolean;
  targetUrl?: string;
  callToAction: CTAType;
  
  // Scheduling
  startDate?: string;
  endDate?: string;
  
  // Budget & Bidding
  pricingModel: PricingModel;
  totalBudget: number;
  bidAmount: number;
  dailyBudgetLimit?: number;
  
  // Targeting
  targetAgeRanges?: AgeRange[];
  targetGender: Gender;
  targetLocations?: string[];
  targetInterests?: string[];
  enableRetargeting?: boolean;
  
  // Priority & Frequency
  priority?: number;
  frequency?: number;
  
  // User ID
  userId: string;
  
  // R2 Storage Metadata (Cloudflare R2 / S3-compatible) - similar to Video model
  r2ImageKey?: string;
  r2VideoKey?: string;
  r2ThumbnailKey?: string;
  r2ImageEtag?: string;
  r2VideoEtag?: string;
  r2ThumbnailEtag?: string;
  imageMimeType?: string;
  videoMimeType?: string;
  thumbnailMimeType?: string;
  imageSizeBytes?: number;
  videoSizeBytes?: number;
  thumbnailSizeBytes?: number;
  storageProvider?: string;
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
  data: {
    ads: Ad[];
    featuredAd: Ad | null;
    bannerAd: Ad | null;
    all: Ad[];
  };
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  message?: string;
}

export interface AdAnalyticsResponse {
  success: boolean;
  data: {
    id: string;
    title: string;
    status: AdStatus;
    // Performance metrics
    impressions: number;
    views: number;
    clicks: number;
    conversions: number;
    ctr: number;
    conversionRate: number;
    // Budget metrics
    totalBudget: number;
    amountSpent: number;
    budgetRemaining: number;
    budgetUtilization: number;
    // Cost metrics
    costPerClick: number;
    costPerMille: number;
    costPerConversion: number;
    // Schedule
    startDate?: string;
    endDate?: string;
    daysRunning: number;
    // Targeting
    targetAgeRanges?: AgeRange[];
    targetGender: Gender;
    targetLocations?: string[];
    targetInterests?: string[];
  };
  message?: string;
}

// ============================================================================
// API ENDPOINTS - Updated to match backend routes
// ============================================================================

const AD_ENDPOINTS = {
  // Public
  list: '/api/ads/all',
  userAds: (userId: string) => `/api/ads/user/${userId}`,
  create: '/api/ads/create',
  
  // Management
  update: (id: string) => `/api/ads/${id}/update`,
  delete: (id: string) => `/api/ads/${id}/delete`,
  analytics: (id: string) => `/api/ads/${id}/analytics`,
  pause: (id: string) => `/api/ads/${id}/pause`,
  resume: (id: string) => `/api/ads/${id}/resume`,
  
  // Admin
  pending: '/api/ads/admin/pending',
  approve: (id: string) => `/api/ads/${id}/approve`,
  reject: (id: string) => `/api/ads/${id}/reject`,
  
  // Tracking
  view: (id: string) => `/api/ads/${id}/view`,
  impression: (id: string) => `/api/ads/${id}/impression`,
  click: (id: string) => `/api/ads/${id}/click`,
  conversion: (id: string) => `/api/ads/${id}/conversion`,
  
  // Legacy endpoints (for backward compatibility) - Updated to use /all with filters
  featured: '/api/ads/all?type=featured',
  banners: '/api/ads/all?type=banner',
  videos: '/api/ads/all?type=video',
  forPlacement: (placement: string) => `/api/ads/all?placement=${placement}`,
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
 * Returns empty array on failure instead of throwing to prevent
 * cascading errors in consolidated hooks like useScreenAds.
 */
export const fetchFeaturedAds = async (limit?: number): Promise<Ad[]> => {
  try {
    const url = limit ? `${AD_ENDPOINTS.featured}&limit=${limit}` : AD_ENDPOINTS.featured;
    const response = await api.get(url);
    
    // Return featured ads from the response
    if (response.data.success && response.data.data) {
      // Return featuredAd if available, otherwise return all featured type ads
      const featuredAds = response.data.data.featuredAd ? [response.data.data.featuredAd] : 
                         Array.isArray(response.data.data.all)
                           ? response.data.data.all.filter((ad: Ad) => ad.type === 'featured')
                           : [];
      return featuredAds;
    }

    // Direct array response (some endpoints return ads directly)
    if (Array.isArray(response.data)) {
      return response.data;
    }
    
    return [];
  } catch (error: any) {
    if (__DEV__) {
      console.warn('[AdAPI] Featured ads unavailable:', error?.message || error);
    }
    // Return empty array instead of throwing — ads are non-critical UI
    return [];
  }
};

/**
 * Fetch banner ads
 * Returns empty array on failure — ads are non-critical UI.
 */
export const fetchBannerAds = async (limit?: number): Promise<Ad[]> => {
  try {
    const url = limit ? `${AD_ENDPOINTS.banners}&limit=${limit}` : AD_ENDPOINTS.banners;
    const response = await api.get(url);
    
    // Return banner ads from the response
    if (response.data.success && response.data.data) {
      // Return bannerAd if available, otherwise return all banner type ads
      const bannerAds = response.data.data.bannerAd ? [response.data.data.bannerAd] : 
                       Array.isArray(response.data.data.all)
                         ? response.data.data.all.filter((ad: Ad) => ad.type === 'banner')
                         : [];
      return bannerAds;
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }
    
    return [];
  } catch (error: any) {
    if (__DEV__) {
      console.warn('[AdAPI] Banner ads unavailable:', error?.message || error);
    }
    return [];
  }
};

/**
 * Fetch video ads
 * Returns empty array on failure — ads are non-critical UI.
 */
export const fetchVideoAds = async (limit?: number): Promise<Ad[]> => {
  try {
    const url = limit ? `${AD_ENDPOINTS.videos}&limit=${limit}` : AD_ENDPOINTS.videos;
    const response = await api.get(url);
    
    // Return video ads from the response
    if (response.data.success && response.data.data) {
      const videoAds = Array.isArray(response.data.data.all)
        ? response.data.data.all.filter((ad: Ad) => ad.type === 'video')
        : [];
      return videoAds;
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }
    
    return [];
  } catch (error: any) {
    if (__DEV__) {
      console.warn('[AdAPI] Video ads unavailable:', error?.message || error);
    }
    return [];
  }
};

/**
 * Fetch a single ad by ID
 */
export const fetchAdById = async (adId: string): Promise<Ad | null> => {
  try {
    // Since the backend doesn't have a detail endpoint, we'll use /all and filter
    // This is not ideal for performance but works with the current backend
    const response = await api.get(AD_ENDPOINTS.list + '?limit=100');
    
    if (response.data.success && response.data.data && response.data.data.all) {
      const ad = response.data.data.all.find((ad: Ad) => ad.id === adId);
      return ad || null;
    }
    
    return null;
  } catch (error: any) {
    console.error('Error fetching ad:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch ad');
  }
};

/**
 * Fetch ads for a specific placement
 * Returns empty array on failure — ads are non-critical UI.
 */
export const fetchAdsForPlacement = async (
  placement: AdPlacement, 
  limit?: number
): Promise<Ad[]> => {
  try {
    const url = limit 
      ? `${AD_ENDPOINTS.forPlacement(placement)}&limit=${limit}` 
      : AD_ENDPOINTS.forPlacement(placement);
    const response = await api.get(url);
    
    // Return ads from the response
    if (response.data.success && response.data.data) {
      return Array.isArray(response.data.data.all) ? response.data.data.all : [];
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }
    
    return [];
  } catch (error: any) {
    if (__DEV__) {
      console.warn(`[AdAPI] Ads for placement "${placement}" unavailable:`, error?.message || error);
    }
    return [];
  }
};

/**
 * Fetch a random ad
 */
export const fetchRandomAd = async (type?: AdType): Promise<Ad | null> => {
  try {
    // Use the /all endpoint with type filter if specified
    const url = type ? `${AD_ENDPOINTS.list}?type=${type}&limit=10` : `${AD_ENDPOINTS.list}?limit=10`;
    const response = await api.get(url);
    
    // Get a random ad from the results
    if (response.data.success && response.data.data && response.data.data.all && response.data.data.all.length > 0) {
      const ads = response.data.data.all;
      const randomIndex = Math.floor(Math.random() * ads.length);
      return ads[randomIndex];
    }
    
    return null;
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
  } catch {
  // Silently fail - analytics shouldn't block user experience or spam logs
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
  } catch {
  // Silently fail - analytics shouldn't block user experience or spam logs
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
  } catch {
  // Silently fail - analytics shouldn't block user experience or spam logs
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
export const fetchUserAds = async (userId: string, filters?: AdFilters): Promise<AdsListResponse> => {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const queryString = params.toString();
    const url = queryString ? `${AD_ENDPOINTS.userAds(userId)}?${queryString}` : AD_ENDPOINTS.userAds(userId);
    
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching user ads:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch user ads');
  }
};

// ============================================================================
// AD MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Pause an ad campaign
 */
export const pauseAd = async (adId: string): Promise<AdResponse> => {
  try {
    const response = await api.put(AD_ENDPOINTS.pause(adId));
    return response.data;
  } catch (error: any) {
    console.error('Error pausing ad:', error);
    throw new Error(error.response?.data?.message || 'Failed to pause ad');
  }
};

/**
 * Resume an ad campaign
 */
export const resumeAd = async (adId: string): Promise<AdResponse> => {
  try {
    const response = await api.put(AD_ENDPOINTS.resume(adId));
    return response.data;
  } catch (error: any) {
    console.error('Error resuming ad:', error);
    throw new Error(error.response?.data?.message || 'Failed to resume ad');
  }
};

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Fetch pending ads for admin review
 */
export const fetchPendingAds = async (limit?: number, offset?: number): Promise<AdsListResponse> => {
  try {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (offset) params.append('offset', String(offset));

    const queryString = params.toString();
    const url = queryString ? `${AD_ENDPOINTS.pending}?${queryString}` : AD_ENDPOINTS.pending;
    
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching pending ads:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch pending ads');
  }
};

/**
 * Approve an ad (Admin only)
 */
export const approveAd = async (adId: string, adminUserId: string): Promise<AdResponse> => {
  try {
    const response = await api.put(AD_ENDPOINTS.approve(adId), { adminUserId });
    return response.data;
  } catch (error: any) {
    console.error('Error approving ad:', error);
    throw new Error(error.response?.data?.message || 'Failed to approve ad');
  }
};

/**
 * Reject an ad (Admin only)
 */
export const rejectAd = async (adId: string, reason: string, adminUserId?: string): Promise<AdResponse> => {
  try {
    const response = await api.put(AD_ENDPOINTS.reject(adId), { reason, adminUserId });
    return response.data;
  } catch (error: any) {
    console.error('Error rejecting ad:', error);
    throw new Error(error.response?.data?.message || 'Failed to reject ad');
  }
};

// ============================================================================
// TRACKING FUNCTIONS - Enhanced with budget tracking
// ============================================================================

/**
 * Record an ad view
 */
export const recordAdView = async (adId: string): Promise<{ success: boolean; views?: number }> => {
  try {
    const response = await api.post(AD_ENDPOINTS.view(adId));
    return response.data;
  } catch {
    // Silently fail - analytics shouldn't block user experience
    return { success: false };
  }
};

/**
 * Record an ad conversion
 */
export const recordAdConversion = async (payload: AdConversionPayload): Promise<{ success: boolean; conversions?: number; amountSpent?: number }> => {
  try {
    const response = await api.post(AD_ENDPOINTS.conversion(payload.adId), payload);
    return response.data;
  } catch {
    // Silently fail - analytics shouldn't block user experience
    return { success: false };
  }
};

// ============================================================================
// EXPORT - Complete API object
// ============================================================================

export const adApi = {
  // Public
  fetchAds,
  fetchFeaturedAds,
  fetchBannerAds,
  fetchVideoAds,
  fetchAdById,
  fetchAdsForPlacement,
  fetchRandomAd,
  fetchUserAds,
  
  // CRUD
  createAd,
  updateAd,
  deleteAd,
  
  // Management
  pauseAd,
  resumeAd,
  fetchAdAnalytics,
  
  // Admin
  fetchPendingAds,
  approveAd,
  rejectAd,
  
  // Tracking
  recordAdView,
  recordAdClick,
  recordAdImpression,
  recordAdConversion,
  recordVideoProgress,
};

export default adApi;
