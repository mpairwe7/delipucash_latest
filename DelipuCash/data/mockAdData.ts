/**
 * Mock Ad Data
 * Sample advertisements for development and testing
 * Real sample URLs from Google, YouTube, and Unsplash for testing
 * Inspired by Google Ads and YouTube Ads formats
 */

import type { Ad } from '../types';

// ============================================================================
// REAL SAMPLE VIDEO URLS (Google's Public Test Videos)
// These are freely available for testing and development
// ============================================================================

const GOOGLE_VIDEO_BASE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample';

export const SAMPLE_VIDEO_ADS = {
  bigBuckBunny: `${GOOGLE_VIDEO_BASE}/BigBuckBunny.mp4`,
  elephantsDream: `${GOOGLE_VIDEO_BASE}/ElephantsDream.mp4`,
  forBiggerBlazes: `${GOOGLE_VIDEO_BASE}/ForBiggerBlazes.mp4`,
  forBiggerEscapes: `${GOOGLE_VIDEO_BASE}/ForBiggerEscapes.mp4`,
  forBiggerFun: `${GOOGLE_VIDEO_BASE}/ForBiggerFun.mp4`,
  forBiggerJoyrides: `${GOOGLE_VIDEO_BASE}/ForBiggerJoyrides.mp4`,
  forBiggerMeltdowns: `${GOOGLE_VIDEO_BASE}/ForBiggerMeltdowns.mp4`,
  sintel: `${GOOGLE_VIDEO_BASE}/Sintel.mp4`,
  subaru: `${GOOGLE_VIDEO_BASE}/SubaruOutbackOnStreetAndDirt.mp4`,
  tearsOfSteel: `${GOOGLE_VIDEO_BASE}/TearsOfSteel.mp4`,
  volkswagenGTI: `${GOOGLE_VIDEO_BASE}/VolkswagenGTIReview.mp4`,
  weAreGoingOnBullrun: `${GOOGLE_VIDEO_BASE}/WeAreGoingOnBullrun.mp4`,
  whatCarCanYouGetForAGrand: `${GOOGLE_VIDEO_BASE}/WhatCarCanYouGetForAGrand.mp4`,
} as const;

// ============================================================================
// REAL SAMPLE IMAGE URLS (Unsplash - Free to use)
// High-quality images for ad mockups
// ============================================================================

export const SAMPLE_AD_IMAGES = {
  // Tech & Electronics
  smartphone: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&h=400&fit=crop',
  laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&h=400&fit=crop',
  headphones: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=400&fit=crop',
  smartwatch: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&h=400&fit=crop',
  camera: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&h=400&fit=crop',
  gaming: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=800&h=400&fit=crop',
  vr: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=800&h=400&fit=crop',

  // Fashion & Lifestyle
  fashion: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=400&fit=crop',
  sneakers: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=400&fit=crop',
  sunglasses: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&h=400&fit=crop',
  watch: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&h=400&fit=crop',
  jewelry: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&h=400&fit=crop',

  // Food & Beverage
  coffee: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=400&fit=crop',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=400&fit=crop',
  restaurant: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop',
  pizza: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=400&fit=crop',

  // Automotive
  car: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&h=400&fit=crop',
  electricCar: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&h=400&fit=crop',
  motorcycle: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&h=400&fit=crop',
  sportsCar: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&h=400&fit=crop',

  // Travel & Hospitality
  travel: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&h=400&fit=crop',
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=400&fit=crop',
  beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=400&fit=crop',
  mountains: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&h=400&fit=crop',

  // Health & Fitness
  fitness: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=400&fit=crop',
  yoga: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=400&fit=crop',
  nutrition: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=400&fit=crop',
  running: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=400&fit=crop',

  // Finance & Business
  finance: 'https://images.unsplash.com/photo-1579621970795-87facc2f976d?w=800&h=400&fit=crop',
  business: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop',
  crypto: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&h=400&fit=crop',
  banking: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=400&fit=crop',

  // Education & Learning
  education: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=400&fit=crop',
  books: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=400&fit=crop',
  online: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=800&h=400&fit=crop',
  coding: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop',

  // Home & Garden
  home: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=400&fit=crop',
  furniture: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=400&fit=crop',
  garden: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=400&fit=crop',
  kitchen: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=400&fit=crop',

  // Entertainment & Media
  music: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=400&fit=crop',
  movies: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=400&fit=crop',
  streaming: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800&h=400&fit=crop',
} as const;

// ============================================================================
// MOCK ADS DATA - Industry Standard Structure
// ============================================================================

export const MOCK_ADS: Ad[] = [
  // =========================================================================
  // FEATURED ADS - Premium placement with video content
  // =========================================================================
  {
    id: 'ad-featured-1',
    title: 'Discover Premium Financial Services',
    headline: 'Banking Made Better',
    description: 'Unlock exclusive benefits with our premium banking solutions. Earn rewards, get cashback, and enjoy zero transaction fees. Join thousands of satisfied customers today!',
    imageUrl: SAMPLE_AD_IMAGES.banking,
    videoUrl: SAMPLE_VIDEO_ADS.forBiggerBlazes,
    thumbnailUrl: SAMPLE_AD_IMAGES.banking,
    type: 'featured',
    placement: 'feed',
    sponsored: true,
    views: 2450000,
    clicks: 185000,
    impressions: 3200000,
    conversions: 12500,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-20T12:00:00Z',
    userId: 'advertiser-1',
    priority: 10,
    frequency: 3,
    lastShown: '2025-01-20T10:00:00Z',
    targetUrl: 'https://example.com/premium-banking',
    callToAction: 'learn_more',
    pricingModel: 'cpm',
    totalBudget: 50000,
    bidAmount: 2.50,
    dailyBudgetLimit: 500,
    amountSpent: 32500,
    targetAgeRanges: ['25-34', '35-44', '45-54'],
    targetGender: 'all',
    targetLocations: ['US', 'UK', 'CA'],
    targetInterests: ['finance', 'banking', 'investing'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2024-12-28T10:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-featured-2',
    title: 'Invest in Your Future Today',
    headline: 'Start with $10',
    description: 'Start your investment journey with as little as $10. Smart portfolios, expert guidance, and real-time tracking. Your financial freedom starts here.',
    imageUrl: SAMPLE_AD_IMAGES.finance,
    videoUrl: SAMPLE_VIDEO_ADS.bigBuckBunny,
    thumbnailUrl: SAMPLE_AD_IMAGES.finance,
    type: 'featured',
    placement: 'feed',
    sponsored: true,
    views: 1850000,
    clicks: 142000,
    impressions: 2500000,
    conversions: 8900,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-05T00:00:00Z',
    updatedAt: '2025-01-19T15:00:00Z',
    userId: 'advertiser-2',
    priority: 9,
    frequency: 4,
    lastShown: '2025-01-20T09:30:00Z',
    targetUrl: 'https://example.com/invest-now',
    callToAction: 'sign_up',
    pricingModel: 'cpc',
    totalBudget: 35000,
    bidAmount: 0.85,
    dailyBudgetLimit: 400,
    amountSpent: 21500,
    targetAgeRanges: ['18-24', '25-34'],
    targetGender: 'all',
    targetLocations: ['US', 'UK'],
    targetInterests: ['investing', 'stocks', 'cryptocurrency'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2024-12-30T14:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-featured-3',
    title: 'E-Commerce Revolution - Mega Sale',
    headline: 'Shop & Save Big',
    description: 'Shop smarter, save bigger! Exclusive deals on electronics, fashion, and more. Free shipping on orders over $50. Limited time offer!',
    imageUrl: SAMPLE_AD_IMAGES.fashion,
    videoUrl: SAMPLE_VIDEO_ADS.elephantsDream,
    thumbnailUrl: SAMPLE_AD_IMAGES.fashion,
    type: 'featured',
    placement: 'interstitial',
    sponsored: true,
    views: 3200000,
    clicks: 245000,
    impressions: 4100000,
    conversions: 18500,
    isActive: true,
    startDate: '2025-01-10T00:00:00Z',
    endDate: '2025-06-30T23:59:59Z',
    createdAt: '2025-01-10T00:00:00Z',
    updatedAt: '2025-01-21T08:00:00Z',
    userId: 'advertiser-3',
    priority: 8,
    frequency: 2,
    lastShown: '2025-01-21T07:45:00Z',
    targetUrl: 'https://example.com/shop-now',
    callToAction: 'shop_now',
    pricingModel: 'cpa',
    totalBudget: 75000,
    bidAmount: 5.00,
    dailyBudgetLimit: 1000,
    amountSpent: 42000,
    targetAgeRanges: ['18-24', '25-34', '35-44'],
    targetGender: 'female',
    targetLocations: ['US', 'UK', 'AU'],
    targetInterests: ['fashion', 'shopping', 'lifestyle'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-08T09:00:00Z',
    approvedBy: 'admin-2',
  },
  {
    id: 'ad-featured-4',
    title: 'Next-Gen Gaming Console Launch',
    headline: 'Pre-Order Now',
    description: 'Experience gaming like never before. 4K HDR graphics, lightning-fast load times, and exclusive titles. Pre-order now and get a free controller!',
    imageUrl: SAMPLE_AD_IMAGES.gaming,
    videoUrl: SAMPLE_VIDEO_ADS.forBiggerFun,
    thumbnailUrl: SAMPLE_AD_IMAGES.gaming,
    type: 'featured',
    placement: 'rewarded',
    sponsored: true,
    views: 4500000,
    clicks: 380000,
    impressions: 5800000,
    conversions: 25000,
    isActive: true,
    startDate: '2025-01-15T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-22T10:00:00Z',
    userId: 'advertiser-4',
    priority: 10,
    frequency: 2,
    lastShown: '2025-01-22T09:30:00Z',
    targetUrl: 'https://example.com/gaming-console',
    callToAction: 'shop_now',
    pricingModel: 'cpm',
    totalBudget: 100000,
    bidAmount: 3.00,
    dailyBudgetLimit: 1500,
    amountSpent: 58000,
    targetAgeRanges: ['13-17', '18-24', '25-34'],
    targetGender: 'male',
    targetLocations: ['US', 'UK', 'JP', 'DE'],
    targetInterests: ['gaming', 'technology', 'entertainment'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-12T11:00:00Z',
    approvedBy: 'admin-1',
  },

  // =========================================================================
  // BANNER ADS - Horizontal strip format (YouTube-style)
  // =========================================================================
  {
    id: 'ad-banner-1',
    title: 'Quick Loans, Fast Approval',
    headline: 'Get Approved Today',
    description: 'Get approved in minutes! Low interest rates, flexible terms.',
    imageUrl: SAMPLE_AD_IMAGES.finance,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.finance,
    type: 'banner',
    placement: 'feed',
    sponsored: true,
    views: 890000,
    clicks: 67000,
    impressions: 1200000,
    conversions: 4500,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-03T00:00:00Z',
    updatedAt: '2025-01-18T14:00:00Z',
    userId: 'advertiser-5',
    priority: 7,
    frequency: 5,
    lastShown: '2025-01-20T11:00:00Z',
    targetUrl: 'https://example.com/quick-loans',
    callToAction: 'apply_now',
    pricingModel: 'cpc',
    totalBudget: 15000,
    bidAmount: 0.45,
    dailyBudgetLimit: 200,
    amountSpent: 8500,
    targetAgeRanges: ['25-34', '35-44', '45-54'],
    targetGender: 'all',
    targetLocations: ['US'],
    targetInterests: ['finance', 'loans'],
    enableRetargeting: false,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2024-12-30T09:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-banner-2',
    title: 'Mobile Top-Up - 10% Cashback',
    headline: 'Earn Rewards',
    description: 'Earn 10% cashback on every mobile recharge! Limited time offer.',
    imageUrl: SAMPLE_AD_IMAGES.smartphone,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.smartphone,
    type: 'banner',
    placement: 'native',
    sponsored: true,
    views: 1250000,
    clicks: 95000,
    impressions: 1800000,
    conversions: 7200,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-07T00:00:00Z',
    updatedAt: '2025-01-20T16:00:00Z',
    userId: 'advertiser-6',
    priority: 6,
    frequency: 4,
    lastShown: '2025-01-20T15:30:00Z',
    targetUrl: 'https://example.com/mobile-rewards',
    callToAction: 'get_offer',
    pricingModel: 'cpm',
    totalBudget: 20000,
    bidAmount: 1.80,
    dailyBudgetLimit: 250,
    amountSpent: 12000,
    targetAgeRanges: ['18-24', '25-34'],
    targetGender: 'all',
    targetLocations: ['US', 'UK'],
    targetInterests: ['mobile', 'technology'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-05T10:00:00Z',
    approvedBy: 'admin-2',
  },
  {
    id: 'ad-banner-3',
    title: 'Insurance Made Simple',
    headline: 'Get Protected',
    description: 'Protect what matters. Get a free quote in 2 minutes.',
    imageUrl: SAMPLE_AD_IMAGES.business,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.business,
    type: 'banner',
    placement: 'feed',
    sponsored: true,
    views: 560000,
    clicks: 42000,
    impressions: 780000,
    conversions: 2800,
    isActive: true,
    startDate: '2025-01-05T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-05T00:00:00Z',
    updatedAt: '2025-01-19T10:00:00Z',
    userId: 'advertiser-7',
    priority: 5,
    frequency: 6,
    lastShown: '2025-01-19T09:00:00Z',
    targetUrl: 'https://example.com/insurance-quote',
    callToAction: 'get_quote',
    pricingModel: 'cpc',
    totalBudget: 12000,
    bidAmount: 0.65,
    dailyBudgetLimit: 150,
    amountSpent: 6500,
    targetAgeRanges: ['25-34', '35-44', '45-54', '55-64'],
    targetGender: 'all',
    targetLocations: ['US'],
    targetInterests: ['insurance', 'family', 'finance'],
    enableRetargeting: false,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-03T11:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-banner-4',
    title: 'Stream Music Premium - Free Trial',
    headline: 'Try 3 Months Free',
    description: 'Ad-free music, offline listening, unlimited skips. Try 3 months free!',
    imageUrl: SAMPLE_AD_IMAGES.music,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.music,
    type: 'banner',
    placement: 'native',
    sponsored: true,
    views: 2100000,
    clicks: 168000,
    impressions: 2900000,
    conversions: 15000,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-10T00:00:00Z',
    updatedAt: '2025-01-21T09:00:00Z',
    userId: 'advertiser-8',
    priority: 8,
    frequency: 3,
    lastShown: '2025-01-21T08:45:00Z',
    targetUrl: 'https://example.com/music-premium',
    callToAction: 'subscribe',
    pricingModel: 'cpa',
    totalBudget: 30000,
    bidAmount: 2.00,
    dailyBudgetLimit: 400,
    amountSpent: 18000,
    targetAgeRanges: ['13-17', '18-24', '25-34'],
    targetGender: 'all',
    targetLocations: ['US', 'UK', 'CA', 'AU'],
    targetInterests: ['music', 'entertainment', 'streaming'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-08T14:00:00Z',
    approvedBy: 'admin-2',
  },
  {
    id: 'ad-banner-5',
    title: 'Fitness App - Transform Your Body',
    headline: 'Join 10M+ Users',
    description: 'Personalized workouts, meal plans, and progress tracking. Join 10M+ users!',
    imageUrl: SAMPLE_AD_IMAGES.fitness,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.fitness,
    type: 'banner',
    placement: 'feed',
    sponsored: true,
    views: 1780000,
    clicks: 134000,
    impressions: 2400000,
    conversions: 9800,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-08T00:00:00Z',
    updatedAt: '2025-01-22T11:00:00Z',
    userId: 'advertiser-9',
    priority: 7,
    frequency: 4,
    lastShown: '2025-01-22T10:30:00Z',
    targetUrl: 'https://example.com/fitness-app',
    callToAction: 'download',
    pricingModel: 'cpc',
    totalBudget: 25000,
    bidAmount: 0.55,
    dailyBudgetLimit: 300,
    amountSpent: 14500,
    targetAgeRanges: ['18-24', '25-34', '35-44'],
    targetGender: 'all',
    targetLocations: ['US', 'UK'],
    targetInterests: ['fitness', 'health', 'wellness'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-06T09:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-banner-6',
    title: 'Food Delivery - 50% Off First Order',
    headline: 'Hungry? Order Now',
    description: 'Fresh meals delivered to your door. Get 50% off your first order with code WELCOME50!',
    imageUrl: SAMPLE_AD_IMAGES.food,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.food,
    type: 'banner',
    placement: 'feed',
    sponsored: true,
    views: 2340000,
    clicks: 187000,
    impressions: 3100000,
    conversions: 15600,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-09T00:00:00Z',
    updatedAt: '2025-01-23T09:00:00Z',
    userId: 'advertiser-10',
    priority: 8,
    frequency: 5,
    lastShown: '2025-01-23T08:30:00Z',
    targetUrl: 'https://example.com/food-delivery',
    callToAction: 'get_offer',
    pricingModel: 'cpc',
    totalBudget: 35000,
    bidAmount: 0.75,
    dailyBudgetLimit: 400,
    amountSpent: 19500,
    targetAgeRanges: ['18-24', '25-34', '35-44'],
    targetGender: 'all',
    targetLocations: ['US', 'UK', 'CA'],
    targetInterests: ['food', 'delivery', 'restaurants'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-07T10:00:00Z',
    approvedBy: 'admin-2',
  },
  {
    id: 'ad-banner-7',
    title: 'Travel Deals - Book Your Dream Trip',
    headline: 'Flights from $99',
    description: 'Unbeatable prices on flights and hotels. Book now and save up to 60%!',
    imageUrl: SAMPLE_AD_IMAGES.travel,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.travel,
    type: 'banner',
    placement: 'native',
    sponsored: true,
    views: 1890000,
    clicks: 156000,
    impressions: 2500000,
    conversions: 8900,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-10T00:00:00Z',
    updatedAt: '2025-01-24T14:00:00Z',
    userId: 'advertiser-11',
    priority: 7,
    frequency: 4,
    lastShown: '2025-01-24T13:45:00Z',
    targetUrl: 'https://example.com/travel-deals',
    callToAction: 'book_now',
    pricingModel: 'cpm',
    totalBudget: 40000,
    bidAmount: 2.20,
    dailyBudgetLimit: 450,
    amountSpent: 22000,
    targetAgeRanges: ['25-34', '35-44', '45-54'],
    targetGender: 'all',
    targetLocations: ['US', 'UK', 'AU', 'DE'],
    targetInterests: ['travel', 'vacation', 'adventure'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-08T11:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-banner-8',
    title: 'Online Education - Learn Anything',
    headline: 'Unlimited Courses',
    description: 'Access 10,000+ courses from top instructors. Learn new skills at your own pace.',
    imageUrl: SAMPLE_AD_IMAGES.education,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.education,
    type: 'banner',
    placement: 'feed',
    sponsored: true,
    views: 2120000,
    clicks: 169000,
    impressions: 2800000,
    conversions: 12400,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-11T00:00:00Z',
    updatedAt: '2025-01-25T10:00:00Z',
    userId: 'advertiser-12',
    priority: 6,
    frequency: 3,
    lastShown: '2025-01-25T09:30:00Z',
    targetUrl: 'https://example.com/online-learning',
    callToAction: 'learn_more',
    pricingModel: 'cpc',
    totalBudget: 30000,
    bidAmount: 0.60,
    dailyBudgetLimit: 350,
    amountSpent: 16500,
    targetAgeRanges: ['18-24', '25-34', '35-44'],
    targetGender: 'all',
    targetLocations: ['US', 'UK', 'IN'],
    targetInterests: ['education', 'learning', 'career'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-09T12:00:00Z',
    approvedBy: 'admin-2',
  },
  {
    id: 'ad-banner-9',
    title: 'Smart Home Devices - Save 40%',
    headline: 'Home Automation',
    description: 'Transform your home with smart devices. Save energy and enhance comfort. 40% off today!',
    imageUrl: SAMPLE_AD_IMAGES.home,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.home,
    type: 'banner',
    placement: 'native',
    sponsored: true,
    views: 1450000,
    clicks: 116000,
    impressions: 1900000,
    conversions: 6700,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-12T00:00:00Z',
    updatedAt: '2025-01-26T08:00:00Z',
    userId: 'advertiser-13',
    priority: 5,
    frequency: 4,
    lastShown: '2025-01-26T07:45:00Z',
    targetUrl: 'https://example.com/smart-home',
    callToAction: 'shop_now',
    pricingModel: 'cpm',
    totalBudget: 22000,
    bidAmount: 1.90,
    dailyBudgetLimit: 280,
    amountSpent: 11800,
    targetAgeRanges: ['25-34', '35-44', '45-54'],
    targetGender: 'all',
    targetLocations: ['US', 'UK'],
    targetInterests: ['technology', 'home', 'gadgets'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-10T09:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-banner-10',
    title: 'Crypto Trading Made Easy',
    headline: 'Start with $10',
    description: 'Trade Bitcoin, Ethereum and 100+ cryptocurrencies. Low fees, secure platform.',
    imageUrl: SAMPLE_AD_IMAGES.crypto,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.crypto,
    type: 'banner',
    placement: 'feed',
    sponsored: true,
    views: 3200000,
    clicks: 256000,
    impressions: 4100000,
    conversions: 18500,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-13T00:00:00Z',
    updatedAt: '2025-01-27T11:00:00Z',
    userId: 'advertiser-14',
    priority: 9,
    frequency: 3,
    lastShown: '2025-01-27T10:30:00Z',
    targetUrl: 'https://example.com/crypto-trading',
    callToAction: 'sign_up',
    pricingModel: 'cpa',
    totalBudget: 50000,
    bidAmount: 3.50,
    dailyBudgetLimit: 600,
    amountSpent: 28000,
    targetAgeRanges: ['18-24', '25-34', '35-44'],
    targetGender: 'male',
    targetLocations: ['US', 'UK', 'SG', 'JP'],
    targetInterests: ['cryptocurrency', 'investing', 'trading'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-11T14:00:00Z',
    approvedBy: 'admin-2',
  },

  // =========================================================================
  // REGULAR/STANDARD ADS - Standard display format
  // =========================================================================
  {
    id: 'ad-regular-1',
    title: 'Learn to Code - Free Course',
    headline: 'Start Your Tech Career',
    description: 'Master programming with our comprehensive curriculum. Python, JavaScript, and more. Start your tech career today!',
    imageUrl: SAMPLE_AD_IMAGES.coding,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.coding,
    type: 'regular',
    placement: 'feed',
    sponsored: true,
    views: 1560000,
    clicks: 4500,
    impressions: 2100000,
    conversions: 3200,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-20T18:00:00Z',
    userId: 'advertiser-7',
    priority: 4,
    frequency: 3,
    lastShown: '2025-01-20T17:30:00Z',
    targetUrl: 'https://example.com/learn-to-code',
    callToAction: 'learn_more',
    pricingModel: 'cpm',
    totalBudget: 18000,
    bidAmount: 1.50,
    dailyBudgetLimit: 200,
    amountSpent: 10500,
    targetAgeRanges: ['18-24', '25-34'],
    targetGender: 'all',
    targetLocations: ['US', 'UK', 'IN'],
    targetInterests: ['technology', 'education', 'programming'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2024-12-30T10:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-regular-2',
    title: 'Transform Your Body - 30 Day Challenge',
    headline: 'Start Free Today',
    description: 'Personalized workout plans, nutrition tracking, and progress monitoring. Download free and start your fitness journey!',
    imageUrl: SAMPLE_AD_IMAGES.running,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.running,
    type: 'regular',
    placement: 'native',
    sponsored: true,
    views: 1450000,
    clicks: 112000,
    impressions: 2000000,
    conversions: 8500,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-04T00:00:00Z',
    updatedAt: '2025-01-21T09:00:00Z',
    userId: 'advertiser-10',
    priority: 4,
    frequency: 4,
    lastShown: '2025-01-21T08:30:00Z',
    targetUrl: 'https://example.com/fitness-challenge',
    callToAction: 'download',
    pricingModel: 'cpc',
    totalBudget: 22000,
    bidAmount: 0.60,
    dailyBudgetLimit: 280,
    amountSpent: 13200,
    targetAgeRanges: ['18-24', '25-34', '35-44'],
    targetGender: 'all',
    targetLocations: ['US', 'UK', 'CA'],
    targetInterests: ['fitness', 'health', 'weight loss'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-02T09:00:00Z',
    approvedBy: 'admin-2',
  },
  {
    id: 'ad-regular-3',
    title: 'Dream Vacation Deals - Save 50%',
    headline: 'Book Your Escape',
    description: 'Exclusive flight and hotel packages. Save up to 50% on your next vacation. Limited time offer!',
    imageUrl: SAMPLE_AD_IMAGES.travel,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.travel,
    type: 'regular',
    placement: 'feed',
    sponsored: true,
    views: 2100000,
    clicks: 158000,
    impressions: 2800000,
    conversions: 12000,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-06T00:00:00Z',
    updatedAt: '2025-01-20T20:00:00Z',
    userId: 'advertiser-11',
    priority: 5,
    frequency: 3,
    lastShown: '2025-01-20T19:30:00Z',
    targetUrl: 'https://example.com/travel-deals',
    callToAction: 'book_now',
    pricingModel: 'cpa',
    totalBudget: 40000,
    bidAmount: 8.00,
    dailyBudgetLimit: 500,
    amountSpent: 24000,
    targetAgeRanges: ['25-34', '35-44', '45-54'],
    targetGender: 'all',
    targetLocations: ['US', 'UK', 'AU', 'EU'],
    targetInterests: ['travel', 'vacation', 'adventure'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-04T10:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-regular-4',
    title: 'Smart Home Devices - Voice Control',
    headline: 'Automate Your Life',
    description: 'Transform your home with intelligent devices. Voice control, automation, and energy savings. Shop the latest tech!',
    imageUrl: SAMPLE_AD_IMAGES.home,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.home,
    type: 'regular',
    placement: 'feed',
    sponsored: false,
    views: 980000,
    clicks: 74000,
    impressions: 1400000,
    conversions: 5200,
    isActive: true,
    startDate: '2025-01-08T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-08T00:00:00Z',
    updatedAt: '2025-01-19T12:00:00Z',
    userId: 'advertiser-12',
    priority: 3,
    frequency: 5,
    lastShown: '2025-01-19T11:00:00Z',
    targetUrl: 'https://example.com/smart-home',
    callToAction: 'shop_now',
    pricingModel: 'cpm',
    totalBudget: 16000,
    bidAmount: 1.20,
    dailyBudgetLimit: 180,
    amountSpent: 9800,
    targetAgeRanges: ['25-34', '35-44', '45-54'],
    targetGender: 'all',
    targetLocations: ['US'],
    targetInterests: ['technology', 'smart home', 'home improvement'],
    enableRetargeting: false,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-06T11:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-regular-5',
    title: 'Online MBA Program - Flexible Learning',
    headline: 'Advance Your Career',
    description: 'Advance your career with a top-ranked online MBA. Learn at your own pace from world-class professors.',
    imageUrl: SAMPLE_AD_IMAGES.education,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.education,
    type: 'regular',
    placement: 'native',
    sponsored: true,
    views: 1230000,
    clicks: 89000,
    impressions: 1700000,
    conversions: 4500,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-03T00:00:00Z',
    updatedAt: '2025-01-22T08:00:00Z',
    userId: 'advertiser-13',
    priority: 6,
    frequency: 4,
    lastShown: '2025-01-22T07:30:00Z',
    targetUrl: 'https://example.com/online-mba',
    callToAction: 'apply_now',
    pricingModel: 'cpc',
    totalBudget: 28000,
    bidAmount: 1.20,
    dailyBudgetLimit: 350,
    amountSpent: 16800,
    targetAgeRanges: ['25-34', '35-44'],
    targetGender: 'all',
    targetLocations: ['US', 'UK', 'CA'],
    targetInterests: ['education', 'career', 'business'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2024-12-28T14:00:00Z',
    approvedBy: 'admin-2',
  },
  {
    id: 'ad-regular-6',
    title: 'Gourmet Food Delivery',
    headline: '40% Off First Order',
    description: 'Restaurant-quality meals delivered to your door. First order 40% off with code YUMMY40!',
    imageUrl: SAMPLE_AD_IMAGES.food,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.food,
    type: 'regular',
    placement: 'feed',
    sponsored: true,
    views: 1670000,
    clicks: 134000,
    impressions: 2200000,
    conversions: 9500,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-05T00:00:00Z',
    updatedAt: '2025-01-21T14:00:00Z',
    userId: 'advertiser-14',
    priority: 5,
    frequency: 3,
    lastShown: '2025-01-21T13:30:00Z',
    targetUrl: 'https://example.com/food-delivery',
    callToAction: 'get_offer',
    pricingModel: 'cpa',
    totalBudget: 35000,
    bidAmount: 4.00,
    dailyBudgetLimit: 450,
    amountSpent: 21000,
    targetAgeRanges: ['18-24', '25-34', '35-44'],
    targetGender: 'all',
    targetLocations: ['US'],
    targetInterests: ['food', 'delivery', 'dining'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-03T09:00:00Z',
    approvedBy: 'admin-1',
  },

  // =========================================================================
  // COMPACT ADS - Minimal footprint, sidebar/widget format
  // =========================================================================
  {
    id: 'ad-compact-1',
    title: 'Daily Rewards App',
    headline: 'Earn Daily',
    description: 'Earn coins daily!',
    imageUrl: SAMPLE_AD_IMAGES.finance,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.finance,
    type: 'compact',
    placement: 'feed',
    sponsored: true,
    views: 560000,
    clicks: 45000,
    impressions: 800000,
    conversions: 3200,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-09T00:00:00Z',
    updatedAt: '2025-01-20T07:00:00Z',
    userId: 'advertiser-15',
    priority: 2,
    frequency: 8,
    lastShown: '2025-01-20T06:30:00Z',
    targetUrl: 'https://example.com/daily-rewards',
    callToAction: 'download',
    pricingModel: 'cpc',
    totalBudget: 8000,
    bidAmount: 0.25,
    dailyBudgetLimit: 100,
    amountSpent: 4800,
    targetAgeRanges: ['18-24', '25-34'],
    targetGender: 'all',
    targetLocations: ['US'],
    targetInterests: ['rewards', 'cashback', 'gaming'],
    enableRetargeting: false,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-07T10:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-compact-2',
    title: 'Crypto Trading Pro',
    headline: 'Trade Now',
    description: 'Trade crypto now!',
    imageUrl: SAMPLE_AD_IMAGES.crypto,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.crypto,
    type: 'compact',
    placement: 'native',
    sponsored: true,
    views: 890000,
    clicks: 72000,
    impressions: 1200000,
    conversions: 4800,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-11T00:00:00Z',
    updatedAt: '2025-01-21T06:00:00Z',
    userId: 'advertiser-16',
    priority: 2,
    frequency: 6,
    lastShown: '2025-01-21T05:30:00Z',
    targetUrl: 'https://example.com/crypto-trading',
    callToAction: 'sign_up',
    pricingModel: 'cpa',
    totalBudget: 15000,
    bidAmount: 3.50,
    dailyBudgetLimit: 200,
    amountSpent: 9500,
    targetAgeRanges: ['18-24', '25-34', '35-44'],
    targetGender: 'male',
    targetLocations: ['US', 'UK'],
    targetInterests: ['cryptocurrency', 'investing', 'finance'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-09T11:00:00Z',
    approvedBy: 'admin-2',
  },
  {
    id: 'ad-compact-3',
    title: 'Premium Headphones',
    headline: 'Studio Sound',
    description: 'Studio quality sound',
    imageUrl: SAMPLE_AD_IMAGES.headphones,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.headphones,
    type: 'compact',
    placement: 'feed',
    sponsored: true,
    views: 450000,
    clicks: 38000,
    impressions: 650000,
    conversions: 2800,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-12T00:00:00Z',
    updatedAt: '2025-01-22T06:00:00Z',
    userId: 'advertiser-17',
    priority: 3,
    frequency: 5,
    lastShown: '2025-01-22T05:30:00Z',
    targetUrl: 'https://example.com/headphones',
    callToAction: 'shop_now',
    pricingModel: 'cpc',
    totalBudget: 10000,
    bidAmount: 0.40,
    dailyBudgetLimit: 120,
    amountSpent: 6200,
    targetAgeRanges: ['18-24', '25-34'],
    targetGender: 'all',
    targetLocations: ['US', 'UK', 'CA'],
    targetInterests: ['music', 'audio', 'technology'],
    enableRetargeting: false,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-10T09:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-compact-4',
    title: 'Coffee Subscription',
    headline: 'Fresh Monthly',
    description: 'Fresh beans monthly',
    imageUrl: SAMPLE_AD_IMAGES.coffee,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.coffee,
    type: 'compact',
    placement: 'native',
    sponsored: false,
    views: 320000,
    clicks: 28000,
    impressions: 480000,
    conversions: 1900,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-14T00:00:00Z',
    updatedAt: '2025-01-21T12:00:00Z',
    userId: 'advertiser-18',
    priority: 2,
    frequency: 7,
    lastShown: '2025-01-21T11:30:00Z',
    targetUrl: 'https://example.com/coffee-subscription',
    callToAction: 'subscribe',
    pricingModel: 'cpm',
    totalBudget: 6000,
    bidAmount: 0.80,
    dailyBudgetLimit: 80,
    amountSpent: 3600,
    targetAgeRanges: ['25-34', '35-44', '45-54'],
    targetGender: 'all',
    targetLocations: ['US'],
    targetInterests: ['coffee', 'food', 'lifestyle'],
    enableRetargeting: false,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-12T10:00:00Z',
    approvedBy: 'admin-1',
  },

  // =========================================================================
  // VIDEO ADS - Rich media with video content (YouTube-style pre-roll/mid-roll)
  // =========================================================================
  {
    id: 'ad-video-1',
    title: 'Next-Gen Gaming Console - Pre-Order Now',
    headline: 'Pre-Order Today',
    description: 'Experience next-gen gaming with stunning 4K graphics! Pre-order the latest console with exclusive bonuses. Limited stock available.',
    imageUrl: SAMPLE_AD_IMAGES.gaming,
    videoUrl: SAMPLE_VIDEO_ADS.sintel,
    thumbnailUrl: SAMPLE_AD_IMAGES.gaming,
    type: 'featured',
    placement: 'rewarded',
    sponsored: true,
    views: 4200000,
    clicks: 315000,
    impressions: 5500000,
    conversions: 22000,
    isActive: true,
    startDate: '2025-01-15T00:00:00Z',
    endDate: '2025-06-30T23:59:59Z',
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-21T10:00:00Z',
    userId: 'advertiser-19',
    priority: 8,
    frequency: 2,
    lastShown: '2025-01-21T09:30:00Z',
    targetUrl: 'https://example.com/gaming-console',
    callToAction: 'shop_now',
    pricingModel: 'cpm',
    totalBudget: 80000,
    bidAmount: 3.50,
    dailyBudgetLimit: 1000,
    amountSpent: 48000,
    targetAgeRanges: ['13-17', '18-24', '25-34'],
    targetGender: 'male',
    targetLocations: ['US', 'UK', 'CA', 'AU'],
    targetInterests: ['gaming', 'technology', 'entertainment'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-13T14:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-video-2',
    title: 'Electric Vehicle Test Drive Experience',
    headline: 'Book Free Test Drive',
    description: 'The future of driving is here. Book your free test drive today and experience zero-emission luxury performance.',
    imageUrl: SAMPLE_AD_IMAGES.electricCar,
    videoUrl: SAMPLE_VIDEO_ADS.tearsOfSteel,
    thumbnailUrl: SAMPLE_AD_IMAGES.electricCar,
    type: 'featured',
    placement: 'interstitial',
    sponsored: true,
    views: 3150000,
    clicks: 245000,
    impressions: 4200000,
    conversions: 15000,
    isActive: true,
    startDate: '2025-01-12T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-12T00:00:00Z',
    updatedAt: '2025-01-20T22:00:00Z',
    userId: 'advertiser-20',
    priority: 7,
    frequency: 3,
    lastShown: '2025-01-20T21:30:00Z',
    targetUrl: 'https://example.com/ev-test-drive',
    callToAction: 'book_now',
    pricingModel: 'cpc',
    totalBudget: 60000,
    bidAmount: 2.50,
    dailyBudgetLimit: 800,
    amountSpent: 35000,
    targetAgeRanges: ['25-34', '35-44', '45-54'],
    targetGender: 'all',
    targetLocations: ['US', 'CA'],
    targetInterests: ['automotive', 'electric vehicles', 'sustainability'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-10T11:00:00Z',
    approvedBy: 'admin-2',
  },
  {
    id: 'ad-video-3',
    title: 'Adventure Awaits - Luxury Travel',
    headline: 'Escape to Paradise',
    description: 'Escape to paradise with our exclusive travel packages. All-inclusive resorts, private tours, and unforgettable experiences.',
    imageUrl: SAMPLE_AD_IMAGES.beach,
    videoUrl: SAMPLE_VIDEO_ADS.forBiggerEscapes,
    thumbnailUrl: SAMPLE_AD_IMAGES.beach,
    type: 'featured',
    placement: 'rewarded',
    sponsored: true,
    views: 2890000,
    clicks: 218000,
    impressions: 3800000,
    conversions: 12500,
    isActive: true,
    startDate: '2025-01-10T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-10T00:00:00Z',
    updatedAt: '2025-01-22T08:00:00Z',
    userId: 'advertiser-21',
    priority: 6,
    frequency: 4,
    lastShown: '2025-01-22T07:45:00Z',
    targetUrl: 'https://example.com/luxury-travel',
    callToAction: 'book_now',
    pricingModel: 'cpa',
    totalBudget: 55000,
    bidAmount: 12.00,
    dailyBudgetLimit: 700,
    amountSpent: 32000,
    targetAgeRanges: ['25-34', '35-44', '45-54', '55-64'],
    targetGender: 'all',
    targetLocations: ['US', 'UK', 'AU'],
    targetInterests: ['travel', 'luxury', 'vacation'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-08T10:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-video-4',
    title: 'Subaru Outback - Adventure Ready',
    headline: 'Explore Any Terrain',
    description: 'Built for those who dare to explore. The all-new Subaru Outback handles any terrain with ease. Book a test drive today.',
    imageUrl: SAMPLE_AD_IMAGES.car,
    videoUrl: SAMPLE_VIDEO_ADS.subaru,
    thumbnailUrl: SAMPLE_AD_IMAGES.car,
    type: 'featured',
    placement: 'interstitial',
    sponsored: true,
    views: 5600000,
    clicks: 420000,
    impressions: 7200000,
    conversions: 28000,
    isActive: true,
    startDate: '2025-01-05T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-05T00:00:00Z',
    updatedAt: '2025-01-22T10:00:00Z',
    userId: 'advertiser-22',
    priority: 9,
    frequency: 2,
    lastShown: '2025-01-22T09:30:00Z',
    targetUrl: 'https://example.com/subaru-outback',
    callToAction: 'book_now',
    pricingModel: 'cpc',
    totalBudget: 90000,
    bidAmount: 2.80,
    dailyBudgetLimit: 1200,
    amountSpent: 54000,
    targetAgeRanges: ['25-34', '35-44', '45-54'],
    targetGender: 'all',
    targetLocations: ['US', 'CA'],
    targetInterests: ['automotive', 'adventure', 'outdoor'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-03T09:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-video-5',
    title: 'Volkswagen GTI - Pure Performance',
    headline: 'Feel the Thrill',
    description: 'Feel the thrill of German engineering. The new GTI delivers power, precision, and pure driving excitement.',
    imageUrl: SAMPLE_AD_IMAGES.sportsCar,
    videoUrl: SAMPLE_VIDEO_ADS.volkswagenGTI,
    thumbnailUrl: SAMPLE_AD_IMAGES.sportsCar,
    type: 'featured',
    placement: 'rewarded',
    sponsored: true,
    views: 4800000,
    clicks: 360000,
    impressions: 6200000,
    conversions: 24000,
    isActive: true,
    startDate: '2025-01-08T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-08T00:00:00Z',
    updatedAt: '2025-01-21T16:00:00Z',
    userId: 'advertiser-23',
    priority: 9,
    frequency: 2,
    lastShown: '2025-01-21T15:30:00Z',
    targetUrl: 'https://example.com/volkswagen-gti',
    callToAction: 'learn_more',
    pricingModel: 'cpm',
    totalBudget: 85000,
    bidAmount: 4.00,
    dailyBudgetLimit: 1100,
    amountSpent: 52000,
    targetAgeRanges: ['25-34', '35-44'],
    targetGender: 'male',
    targetLocations: ['US', 'DE', 'UK'],
    targetInterests: ['automotive', 'sports cars', 'performance'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-06T10:00:00Z',
    approvedBy: 'admin-2',
  },
  {
    id: 'ad-video-6',
    title: 'Epic Road Trip Adventure',
    headline: 'Start Your Journey',
    description: 'Join the adventure of a lifetime! Explore scenic routes, hidden gems, and make memories that last forever.',
    imageUrl: SAMPLE_AD_IMAGES.mountains,
    videoUrl: SAMPLE_VIDEO_ADS.weAreGoingOnBullrun,
    thumbnailUrl: SAMPLE_AD_IMAGES.mountains,
    type: 'regular',
    placement: 'feed',
    sponsored: true,
    views: 2340000,
    clicks: 178000,
    impressions: 3100000,
    conversions: 11000,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-22T12:00:00Z',
    userId: 'advertiser-24',
    priority: 5,
    frequency: 4,
    lastShown: '2025-01-22T11:30:00Z',
    targetUrl: 'https://example.com/road-trip',
    callToAction: 'watch_more',
    pricingModel: 'cpm',
    totalBudget: 25000,
    bidAmount: 1.60,
    dailyBudgetLimit: 300,
    amountSpent: 15000,
    targetAgeRanges: ['18-24', '25-34', '35-44'],
    targetGender: 'all',
    targetLocations: ['US'],
    targetInterests: ['travel', 'adventure', 'road trips'],
    enableRetargeting: false,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2024-12-28T09:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-video-7',
    title: 'Budget Car Deals - What Can You Get?',
    headline: 'Find Your Ride',
    description: 'Amazing deals on quality used cars. Find your perfect ride without breaking the bank. Financing available!',
    imageUrl: SAMPLE_AD_IMAGES.car,
    videoUrl: SAMPLE_VIDEO_ADS.whatCarCanYouGetForAGrand,
    thumbnailUrl: SAMPLE_AD_IMAGES.car,
    type: 'regular',
    placement: 'native',
    sponsored: true,
    views: 1890000,
    clicks: 142000,
    impressions: 2500000,
    conversions: 8500,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-03T00:00:00Z',
    updatedAt: '2025-01-21T18:00:00Z',
    userId: 'advertiser-25',
    priority: 4,
    frequency: 5,
    lastShown: '2025-01-21T17:30:00Z',
    targetUrl: 'https://example.com/budget-cars',
    callToAction: 'shop_now',
    pricingModel: 'cpc',
    totalBudget: 18000,
    bidAmount: 0.75,
    dailyBudgetLimit: 220,
    amountSpent: 10800,
    targetAgeRanges: ['18-24', '25-34'],
    targetGender: 'all',
    targetLocations: ['US'],
    targetInterests: ['automotive', 'budget', 'used cars'],
    enableRetargeting: false,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2024-12-30T10:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-video-8',
    title: 'VR Gaming Experience - Bigger Joyrides',
    headline: 'Step Into The Game',
    description: 'Step into the game with cutting-edge VR technology. Immersive worlds, realistic graphics, endless possibilities.',
    imageUrl: SAMPLE_AD_IMAGES.vr,
    videoUrl: SAMPLE_VIDEO_ADS.forBiggerJoyrides,
    thumbnailUrl: SAMPLE_AD_IMAGES.vr,
    type: 'featured',
    placement: 'rewarded',
    sponsored: true,
    views: 2670000,
    clicks: 198000,
    impressions: 3500000,
    conversions: 14000,
    isActive: true,
    startDate: '2025-01-10T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-10T00:00:00Z',
    updatedAt: '2025-01-22T14:00:00Z',
    userId: 'advertiser-26',
    priority: 6,
    frequency: 3,
    lastShown: '2025-01-22T13:30:00Z',
    targetUrl: 'https://example.com/vr-gaming',
    callToAction: 'shop_now',
    pricingModel: 'cpm',
    totalBudget: 45000,
    bidAmount: 2.80,
    dailyBudgetLimit: 550,
    amountSpent: 27000,
    targetAgeRanges: ['13-17', '18-24', '25-34'],
    targetGender: 'male',
    targetLocations: ['US', 'UK', 'JP'],
    targetInterests: ['gaming', 'VR', 'technology'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-08T11:00:00Z',
    approvedBy: 'admin-2',
  },
  {
    id: 'ad-video-9',
    title: 'Pro Streaming Setup - Go Live',
    headline: 'Stream Like a Pro',
    description: 'Everything you need to start streaming like a pro. Cameras, lights, mics, and software bundles at unbeatable prices.',
    imageUrl: SAMPLE_AD_IMAGES.streaming,
    videoUrl: SAMPLE_VIDEO_ADS.forBiggerMeltdowns,
    thumbnailUrl: SAMPLE_AD_IMAGES.streaming,
    type: 'regular',
    placement: 'feed',
    sponsored: true,
    views: 1560000,
    clicks: 118000,
    impressions: 2100000,
    conversions: 7500,
    isActive: true,
    startDate: '2025-01-05T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-05T00:00:00Z',
    updatedAt: '2025-01-21T20:00:00Z',
    userId: 'advertiser-27',
    priority: 5,
    frequency: 4,
    lastShown: '2025-01-21T19:30:00Z',
    targetUrl: 'https://example.com/streaming-setup',
    callToAction: 'shop_now',
    pricingModel: 'cpc',
    totalBudget: 20000,
    bidAmount: 0.85,
    dailyBudgetLimit: 250,
    amountSpent: 12000,
    targetAgeRanges: ['18-24', '25-34'],
    targetGender: 'all',
    targetLocations: ['US', 'UK'],
    targetInterests: ['streaming', 'gaming', 'content creation'],
    enableRetargeting: true,
    status: 'approved',
    rejectionReason: null,
    approvedAt: '2025-01-03T10:00:00Z',
    approvedBy: 'admin-1',
  },

  // =========================================================================
  // INACTIVE ADS - For testing filters and historical data
  // =========================================================================
  {
    id: 'ad-inactive-1',
    title: 'Expired Holiday Campaign',
    headline: 'Campaign Ended',
    description: 'This holiday ad campaign has ended. Thank you for participating!',
    imageUrl: SAMPLE_AD_IMAGES.business,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.business,
    type: 'regular',
    placement: 'feed',
    sponsored: false,
    views: 15000,
    clicks: 400,
    impressions: 25000,
    conversions: 50,
    isActive: false,
    startDate: '2024-06-01T00:00:00Z',
    endDate: '2024-12-31T23:59:59Z',
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-12-31T23:59:59Z',
    userId: 'advertiser-28',
    priority: 1,
    frequency: 10,
    lastShown: '2024-12-30T12:00:00Z',
    targetUrl: 'https://example.com/expired',
    callToAction: 'learn_more',
    pricingModel: 'cpm',
    totalBudget: 5000,
    bidAmount: 1.00,
    dailyBudgetLimit: 50,
    amountSpent: 5000,
    targetAgeRanges: ['25-34', '35-44'],
    targetGender: 'all',
    targetLocations: ['US'],
    targetInterests: ['business'],
    enableRetargeting: false,
    status: 'completed',
    rejectionReason: null,
    approvedAt: '2024-05-28T10:00:00Z',
    approvedBy: 'admin-1',
  },
  {
    id: 'ad-inactive-2',
    title: 'Black Friday Sale - Ended',
    headline: 'Sale Over',
    description: 'Our Black Friday sale has ended. Stay tuned for more deals!',
    imageUrl: SAMPLE_AD_IMAGES.fashion,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.fashion,
    type: 'featured',
    placement: 'interstitial',
    sponsored: true,
    views: 4500000,
    clicks: 380000,
    impressions: 6000000,
    conversions: 45000,
    isActive: false,
    startDate: '2024-11-20T00:00:00Z',
    endDate: '2024-11-30T23:59:59Z',
    createdAt: '2024-11-20T00:00:00Z',
    updatedAt: '2024-11-30T23:59:59Z',
    userId: 'advertiser-29',
    priority: 10,
    frequency: 1,
    lastShown: '2024-11-30T23:00:00Z',
    targetUrl: 'https://example.com/black-friday',
    callToAction: 'shop_now',
    pricingModel: 'cpa',
    totalBudget: 100000,
    bidAmount: 5.00,
    dailyBudgetLimit: 10000,
    amountSpent: 100000,
    targetAgeRanges: ['18-24', '25-34', '35-44', '45-54'],
    targetGender: 'all',
    targetLocations: ['US', 'UK', 'CA', 'AU'],
    targetInterests: ['shopping', 'fashion', 'deals'],
    enableRetargeting: true,
    status: 'completed',
    rejectionReason: null,
    approvedAt: '2024-11-18T14:00:00Z',
    approvedBy: 'admin-1',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get ads by type
 */
export const getAdsByType = (type: Ad['type']): Ad[] => {
  return MOCK_ADS.filter(ad => ad.type === type && ad.isActive);
};

/**
 * Get active ads only
 */
export const getActiveAds = (): Ad[] => {
  return MOCK_ADS.filter(ad => ad.isActive);
};

/**
 * Get sponsored ads
 */
export const getSponsoredAds = (): Ad[] => {
  return MOCK_ADS.filter(ad => ad.sponsored && ad.isActive);
};

/**
 * Get video ads
 */
export const getVideoAds = (): Ad[] => {
  return MOCK_ADS.filter(ad => ad.videoUrl && ad.isActive);
};

/**
 * Get random ad
 */
export const getRandomAd = (type?: Ad['type']): Ad | null => {
  let pool = MOCK_ADS.filter(ad => ad.isActive);
  if (type) {
    pool = pool.filter(ad => ad.type === type);
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * Get ads sorted by priority
 */
export const getAdsByPriority = (limit?: number): Ad[] => {
  const sorted = [...MOCK_ADS]
    .filter(ad => ad.isActive)
    .sort((a, b) => b.priority - a.priority);
  return limit ? sorted.slice(0, limit) : sorted;
};

/**
 * Get top performing ads by clicks
 */
export const getTopPerformingAds = (limit = 5): Ad[] => {
  return [...MOCK_ADS]
    .filter(ad => ad.isActive)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit);
};

/**
 * Get featured video ads (premium video content)
 */
export const getFeaturedVideoAds = (): Ad[] => {
  return MOCK_ADS.filter(ad => ad.videoUrl && ad.type === 'featured' && ad.isActive);
};

/**
 * Get banner ads
 */
export const getBannerAds = (): Ad[] => {
  return MOCK_ADS.filter(ad => ad.type === 'banner' && ad.isActive);
};

/**
 * Get compact ads (for sidebar/widget placement)
 */
export const getCompactAds = (): Ad[] => {
  return MOCK_ADS.filter(ad => ad.type === 'compact' && ad.isActive);
};

/**
 * Get random video ad for pre-roll/mid-roll
 */
export const getRandomVideoAd = (): Ad | null => {
  const videoAds = MOCK_ADS.filter(ad => ad.videoUrl && ad.isActive);
  if (videoAds.length === 0) return null;
  return videoAds[Math.floor(Math.random() * videoAds.length)];
};

/**
 * Get ads by category (based on image URL keywords)
 */
export const getAdsByCategory = (category: keyof typeof SAMPLE_AD_IMAGES): Ad[] => {
  const imageUrl = SAMPLE_AD_IMAGES[category];
  return MOCK_ADS.filter(ad => ad.imageUrl === imageUrl && ad.isActive);
};

/**
 * Get total ad statistics
 */
export const getAdStats = () => {
  const activeAds = MOCK_ADS.filter(ad => ad.isActive);
  const videoAds = activeAds.filter(ad => ad.videoUrl);
  const approvedAds = MOCK_ADS.filter(ad => ad.status === 'approved');

  return {
    totalAds: MOCK_ADS.length,
    activeAds: activeAds.length,
    videoAds: videoAds.length,
    totalViews: activeAds.reduce((sum, ad) => sum + ad.views, 0),
    totalClicks: activeAds.reduce((sum, ad) => sum + ad.clicks, 0),
    totalImpressions: activeAds.reduce((sum, ad) => sum + ad.impressions, 0),
    totalConversions: activeAds.reduce((sum, ad) => sum + ad.conversions, 0),
    totalBudget: activeAds.reduce((sum, ad) => sum + ad.totalBudget, 0),
    totalSpent: activeAds.reduce((sum, ad) => sum + ad.amountSpent, 0),
    averageCTR: activeAds.length > 0
      ? (activeAds.reduce((sum, ad) => sum + (ad.clicks / ad.views), 0) / activeAds.length * 100).toFixed(2)
      : '0',
    averageConversionRate: activeAds.length > 0
      ? (activeAds.reduce((sum, ad) => sum + (ad.conversions / ad.clicks), 0) / activeAds.length * 100).toFixed(2)
      : '0',
    adsByType: {
      featured: activeAds.filter(ad => ad.type === 'featured').length,
      banner: activeAds.filter(ad => ad.type === 'banner').length,
      regular: activeAds.filter(ad => ad.type === 'regular').length,
      compact: activeAds.filter(ad => ad.type === 'compact').length,
    },
    adsByPlacement: {
      feed: activeAds.filter(ad => ad.placement === 'feed').length,
      interstitial: activeAds.filter(ad => ad.placement === 'interstitial').length,
      native: activeAds.filter(ad => ad.placement === 'native').length,
      rewarded: activeAds.filter(ad => ad.placement === 'rewarded').length,
      story: activeAds.filter(ad => ad.placement === 'story').length,
    },
    adsByStatus: {
      pending: MOCK_ADS.filter(ad => ad.status === 'pending').length,
      approved: approvedAds.length,
      rejected: MOCK_ADS.filter(ad => ad.status === 'rejected').length,
      paused: MOCK_ADS.filter(ad => ad.status === 'paused').length,
      completed: MOCK_ADS.filter(ad => ad.status === 'completed').length,
    },
    adsByPricingModel: {
      cpm: activeAds.filter(ad => ad.pricingModel === 'cpm').length,
      cpc: activeAds.filter(ad => ad.pricingModel === 'cpc').length,
      cpa: activeAds.filter(ad => ad.pricingModel === 'cpa').length,
      flat: activeAds.filter(ad => ad.pricingModel === 'flat').length,
    },
  };
};

// ============================================================================
// NEW HELPER FUNCTIONS FOR INDUSTRY-STANDARD AD FEATURES
// ============================================================================

/**
 * Get ads by placement type (IAB standard placements)
 */
export const getAdsByPlacement = (placement: Ad['placement']): Ad[] => {
  return MOCK_ADS.filter(ad => ad.placement === placement && ad.isActive && ad.status === 'approved');
};

/**
 * Get ads by status
 */
export const getAdsByStatus = (status: Ad['status']): Ad[] => {
  return MOCK_ADS.filter(ad => ad.status === status);
};

/**
 * Get ads by pricing model
 */
export const getAdsByPricingModel = (pricingModel: Ad['pricingModel']): Ad[] => {
  return MOCK_ADS.filter(ad => ad.pricingModel === pricingModel && ad.isActive);
};

/**
 * Get ads by call-to-action type
 */
export const getAdsByCTA = (callToAction: Ad['callToAction']): Ad[] => {
  return MOCK_ADS.filter(ad => ad.callToAction === callToAction && ad.isActive);
};

/**
 * Get ads targeting specific age range
 */
export const getAdsByAgeRange = (ageRange: string): Ad[] => {
  return MOCK_ADS.filter(ad =>
    ad.isActive &&
    ad.targetAgeRanges &&
    ad.targetAgeRanges.includes(ageRange)
  );
};

/**
 * Get ads targeting specific gender
 */
export const getAdsByTargetGender = (gender: Ad['targetGender']): Ad[] => {
  return MOCK_ADS.filter(ad =>
    ad.isActive &&
    (ad.targetGender === gender || ad.targetGender === 'all')
  );
};

/**
 * Get ads targeting specific location
 */
export const getAdsByLocation = (location: string): Ad[] => {
  return MOCK_ADS.filter(ad =>
    ad.isActive &&
    ad.targetLocations &&
    ad.targetLocations.includes(location)
  );
};

/**
 * Get ads with remaining budget
 */
export const getAdsWithBudget = (): Ad[] => {
  return MOCK_ADS.filter(ad =>
    ad.isActive &&
    ad.amountSpent < ad.totalBudget
  );
};

/**
 * Get rewarded video ads for user reward features
 */
export const getRewardedAds = (): Ad[] => {
  return MOCK_ADS.filter(ad =>
    ad.placement === 'rewarded' &&
    ad.isActive &&
    ad.status === 'approved'
  );
};

/**
 * Get interstitial ads for between-content display
 */
export const getInterstitialAds = (): Ad[] => {
  return MOCK_ADS.filter(ad =>
    ad.placement === 'interstitial' &&
    ad.isActive &&
    ad.status === 'approved'
  );
};

/**
 * Get native ads for seamless content integration
 */
export const getNativeAds = (): Ad[] => {
  return MOCK_ADS.filter(ad =>
    ad.placement === 'native' &&
    ad.isActive &&
    ad.status === 'approved'
  );
};

/**
 * Get story ads for story format placement
 */
export const getStoryAds = (): Ad[] => {
  return MOCK_ADS.filter(ad =>
    ad.placement === 'story' &&
    ad.isActive &&
    ad.status === 'approved'
  );
};

/**
 * Get ads with retargeting enabled
 */
export const getRetargetingAds = (): Ad[] => {
  return MOCK_ADS.filter(ad => ad.enableRetargeting && ad.isActive);
};

/**
 * Get top converting ads
 */
export const getTopConvertingAds = (limit = 5): Ad[] => {
  return [...MOCK_ADS]
    .filter(ad => ad.isActive && ad.conversions > 0)
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, limit);
};

/**
 * Get ads by interest targeting
 */
export const getAdsByInterest = (interest: string): Ad[] => {
  return MOCK_ADS.filter(ad =>
    ad.isActive &&
    ad.targetInterests &&
    ad.targetInterests.some(i => i.toLowerCase().includes(interest.toLowerCase()))
  );
};

/**
 * Get ad performance metrics
 */
export const getAdPerformance = (adId: string) => {
  const ad = MOCK_ADS.find(a => a.id === adId);
  if (!ad) return null;

  const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;
  const conversionRate = ad.clicks > 0 ? (ad.conversions / ad.clicks) * 100 : 0;
  const costPerClick = ad.clicks > 0 ? ad.amountSpent / ad.clicks : 0;
  const costPerConversion = ad.conversions > 0 ? ad.amountSpent / ad.conversions : 0;
  const budgetUtilization = (ad.amountSpent / ad.totalBudget) * 100;

  return {
    id: ad.id,
    title: ad.title,
    impressions: ad.impressions,
    clicks: ad.clicks,
    conversions: ad.conversions,
    ctr: ctr.toFixed(2),
    conversionRate: conversionRate.toFixed(2),
    costPerClick: costPerClick.toFixed(2),
    costPerConversion: costPerConversion.toFixed(2),
    amountSpent: ad.amountSpent,
    totalBudget: ad.totalBudget,
    budgetUtilization: budgetUtilization.toFixed(1),
    remainingBudget: ad.totalBudget - ad.amountSpent,
    status: ad.status,
  };
};

// ============================================================================
// EXPORT
// ============================================================================

export default MOCK_ADS;
