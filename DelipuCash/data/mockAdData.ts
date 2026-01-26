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
// MOCK ADS DATA
// ============================================================================

export const MOCK_ADS: Ad[] = [
  // =========================================================================
  // FEATURED ADS - Premium placement with video content
  // =========================================================================
  {
    id: 'ad-featured-1',
    title: 'Discover Premium Financial Services',
    description: 'Unlock exclusive benefits with our premium banking solutions. Earn rewards, get cashback, and enjoy zero transaction fees. Join thousands of satisfied customers today!',
    imageUrl: SAMPLE_AD_IMAGES.banking,
    videoUrl: SAMPLE_VIDEO_ADS.forBiggerBlazes,
    thumbnailUrl: SAMPLE_AD_IMAGES.banking,
    type: 'featured',
    sponsored: true,
    views: 2450000,
    clicks: 185000,
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
  },
  {
    id: 'ad-featured-2',
    title: 'Invest in Your Future Today',
    description: 'Start your investment journey with as little as $10. Smart portfolios, expert guidance, and real-time tracking. Your financial freedom starts here.',
    imageUrl: SAMPLE_AD_IMAGES.finance,
    videoUrl: SAMPLE_VIDEO_ADS.bigBuckBunny,
    thumbnailUrl: SAMPLE_AD_IMAGES.finance,
    type: 'featured',
    sponsored: true,
    views: 1850000,
    clicks: 142000,
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
  },
  {
    id: 'ad-featured-3',
    title: 'E-Commerce Revolution - Mega Sale',
    description: 'Shop smarter, save bigger! Exclusive deals on electronics, fashion, and more. Free shipping on orders over $50. Limited time offer!',
    imageUrl: SAMPLE_AD_IMAGES.fashion,
    videoUrl: SAMPLE_VIDEO_ADS.elephantsDream,
    thumbnailUrl: SAMPLE_AD_IMAGES.fashion,
    type: 'featured',
    sponsored: true,
    views: 3200000,
    clicks: 245000,
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
  },
  {
    id: 'ad-featured-4',
    title: 'Next-Gen Gaming Console Launch',
    description: 'Experience gaming like never before. 4K HDR graphics, lightning-fast load times, and exclusive titles. Pre-order now and get a free controller!',
    imageUrl: SAMPLE_AD_IMAGES.gaming,
    videoUrl: SAMPLE_VIDEO_ADS.forBiggerFun,
    thumbnailUrl: SAMPLE_AD_IMAGES.gaming,
    type: 'featured',
    sponsored: true,
    views: 4500000,
    clicks: 380000,
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
  },

  // =========================================================================
  // BANNER ADS - Horizontal strip format (YouTube-style)
  // =========================================================================
  {
    id: 'ad-banner-1',
    title: 'Quick Loans, Fast Approval',
    description: 'Get approved in minutes! Low interest rates, flexible terms.',
    imageUrl: SAMPLE_AD_IMAGES.finance,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.finance,
    type: 'banner',
    sponsored: true,
    views: 890000,
    clicks: 67000,
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
  },
  {
    id: 'ad-banner-2',
    title: 'Mobile Top-Up - 10% Cashback',
    description: 'Earn 10% cashback on every mobile recharge! Limited time offer.',
    imageUrl: SAMPLE_AD_IMAGES.smartphone,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.smartphone,
    type: 'banner',
    sponsored: true,
    views: 1250000,
    clicks: 95000,
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
  },
  {
    id: 'ad-banner-3',
    title: 'Insurance Made Simple',
    description: 'Protect what matters. Get a free quote in 2 minutes.',
    imageUrl: SAMPLE_AD_IMAGES.business,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.business,
    type: 'banner',
    sponsored: true,
    views: 560000,
    clicks: 42000,
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
  },
  {
    id: 'ad-banner-4',
    title: 'Stream Music Premium - Free Trial',
    description: 'Ad-free music, offline listening, unlimited skips. Try 3 months free!',
    imageUrl: SAMPLE_AD_IMAGES.music,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.music,
    type: 'banner',
    sponsored: true,
    views: 2100000,
    clicks: 168000,
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
  },
  {
    id: 'ad-banner-5',
    title: 'Fitness App - Transform Your Body',
    description: 'Personalized workouts, meal plans, and progress tracking. Join 10M+ users!',
    imageUrl: SAMPLE_AD_IMAGES.fitness,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.fitness,
    type: 'banner',
    sponsored: true,
    views: 1780000,
    clicks: 134000,
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
  },

  // =========================================================================
  // REGULAR/STANDARD ADS - Standard display format
  // =========================================================================
  {
    id: 'ad-regular-1',
    title: 'Learn to Code - Free Course',
    description: 'Master programming with our comprehensive curriculum. Python, JavaScript, and more. Start your tech career today!',
    imageUrl: SAMPLE_AD_IMAGES.coding,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.coding,
    type: 'regular',
    sponsored: true,
    views: 1560000,
    clicks: 4500,
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
  },
  {
    id: 'ad-regular-2',
    title: 'Transform Your Body - 30 Day Challenge',
    description: 'Personalized workout plans, nutrition tracking, and progress monitoring. Download free and start your fitness journey!',
    imageUrl: SAMPLE_AD_IMAGES.running,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.running,
    type: 'regular',
    sponsored: true,
    views: 1450000,
    clicks: 112000,
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
  },
  {
    id: 'ad-regular-3',
    title: 'Dream Vacation Deals - Save 50%',
    description: 'Exclusive flight and hotel packages. Save up to 50% on your next vacation. Limited time offer!',
    imageUrl: SAMPLE_AD_IMAGES.travel,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.travel,
    type: 'regular',
    sponsored: true,
    views: 2100000,
    clicks: 158000,
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
  },
  {
    id: 'ad-regular-4',
    title: 'Smart Home Devices - Voice Control',
    description: 'Transform your home with intelligent devices. Voice control, automation, and energy savings. Shop the latest tech!',
    imageUrl: SAMPLE_AD_IMAGES.home,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.home,
    type: 'regular',
    sponsored: false,
    views: 980000,
    clicks: 74000,
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
  },
  {
    id: 'ad-regular-5',
    title: 'Online MBA Program - Flexible Learning',
    description: 'Advance your career with a top-ranked online MBA. Learn at your own pace from world-class professors.',
    imageUrl: SAMPLE_AD_IMAGES.education,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.education,
    type: 'regular',
    sponsored: true,
    views: 1230000,
    clicks: 89000,
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
  },
  {
    id: 'ad-regular-6',
    title: 'Gourmet Food Delivery',
    description: 'Restaurant-quality meals delivered to your door. First order 40% off with code YUMMY40!',
    imageUrl: SAMPLE_AD_IMAGES.food,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.food,
    type: 'regular',
    sponsored: true,
    views: 1670000,
    clicks: 134000,
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
  },

  // =========================================================================
  // COMPACT ADS - Minimal footprint, sidebar/widget format
  // =========================================================================
  {
    id: 'ad-compact-1',
    title: 'Daily Rewards App',
    description: 'Earn coins daily!',
    imageUrl: SAMPLE_AD_IMAGES.finance,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.finance,
    type: 'compact',
    sponsored: true,
    views: 560000,
    clicks: 45000,
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
  },
  {
    id: 'ad-compact-2',
    title: 'Crypto Trading Pro',
    description: 'Trade crypto now!',
    imageUrl: SAMPLE_AD_IMAGES.crypto,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.crypto,
    type: 'compact',
    sponsored: true,
    views: 890000,
    clicks: 72000,
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
  },
  {
    id: 'ad-compact-3',
    title: 'Premium Headphones',
    description: 'Studio quality sound',
    imageUrl: SAMPLE_AD_IMAGES.headphones,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.headphones,
    type: 'compact',
    sponsored: true,
    views: 450000,
    clicks: 38000,
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
  },
  {
    id: 'ad-compact-4',
    title: 'Coffee Subscription',
    description: 'Fresh beans monthly',
    imageUrl: SAMPLE_AD_IMAGES.coffee,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.coffee,
    type: 'compact',
    sponsored: false,
    views: 320000,
    clicks: 28000,
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
  },

  // =========================================================================
  // VIDEO ADS - Rich media with video content (YouTube-style pre-roll/mid-roll)
  // =========================================================================
  {
    id: 'ad-video-1',
    title: 'Next-Gen Gaming Console - Pre-Order Now',
    description: 'Experience next-gen gaming with stunning 4K graphics! Pre-order the latest console with exclusive bonuses. Limited stock available.',
    imageUrl: SAMPLE_AD_IMAGES.gaming,
    videoUrl: SAMPLE_VIDEO_ADS.sintel,
    thumbnailUrl: SAMPLE_AD_IMAGES.gaming,
    type: 'regular',
    sponsored: true,
    views: 4200000,
    clicks: 315000,
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
  },
  {
    id: 'ad-video-2',
    title: 'Electric Vehicle Test Drive Experience',
    description: 'The future of driving is here. Book your free test drive today and experience zero-emission luxury performance.',
    imageUrl: SAMPLE_AD_IMAGES.electricCar,
    videoUrl: SAMPLE_VIDEO_ADS.tearsOfSteel,
    thumbnailUrl: SAMPLE_AD_IMAGES.electricCar,
    type: 'regular',
    sponsored: true,
    views: 3150000,
    clicks: 245000,
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
  },
  {
    id: 'ad-video-3',
    title: 'Adventure Awaits - Luxury Travel',
    description: 'Escape to paradise with our exclusive travel packages. All-inclusive resorts, private tours, and unforgettable experiences.',
    imageUrl: SAMPLE_AD_IMAGES.beach,
    videoUrl: SAMPLE_VIDEO_ADS.forBiggerEscapes,
    thumbnailUrl: SAMPLE_AD_IMAGES.beach,
    type: 'regular',
    sponsored: true,
    views: 2890000,
    clicks: 218000,
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
  },
  {
    id: 'ad-video-4',
    title: 'Subaru Outback - Adventure Ready',
    description: 'Built for those who dare to explore. The all-new Subaru Outback handles any terrain with ease. Book a test drive today.',
    imageUrl: SAMPLE_AD_IMAGES.car,
    videoUrl: SAMPLE_VIDEO_ADS.subaru,
    thumbnailUrl: SAMPLE_AD_IMAGES.car,
    type: 'featured',
    sponsored: true,
    views: 5600000,
    clicks: 420000,
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
  },
  {
    id: 'ad-video-5',
    title: 'Volkswagen GTI - Pure Performance',
    description: 'Feel the thrill of German engineering. The new GTI delivers power, precision, and pure driving excitement.',
    imageUrl: SAMPLE_AD_IMAGES.sportsCar,
    videoUrl: SAMPLE_VIDEO_ADS.volkswagenGTI,
    thumbnailUrl: SAMPLE_AD_IMAGES.sportsCar,
    type: 'featured',
    sponsored: true,
    views: 4800000,
    clicks: 360000,
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
  },
  {
    id: 'ad-video-6',
    title: 'Epic Road Trip Adventure',
    description: 'Join the adventure of a lifetime! Explore scenic routes, hidden gems, and make memories that last forever.',
    imageUrl: SAMPLE_AD_IMAGES.mountains,
    videoUrl: SAMPLE_VIDEO_ADS.weAreGoingOnBullrun,
    thumbnailUrl: SAMPLE_AD_IMAGES.mountains,
    type: 'regular',
    sponsored: true,
    views: 2340000,
    clicks: 178000,
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
  },
  {
    id: 'ad-video-7',
    title: 'Budget Car Deals - What Can You Get?',
    description: 'Amazing deals on quality used cars. Find your perfect ride without breaking the bank. Financing available!',
    imageUrl: SAMPLE_AD_IMAGES.car,
    videoUrl: SAMPLE_VIDEO_ADS.whatCarCanYouGetForAGrand,
    thumbnailUrl: SAMPLE_AD_IMAGES.car,
    type: 'regular',
    sponsored: true,
    views: 1890000,
    clicks: 142000,
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
  },
  {
    id: 'ad-video-8',
    title: 'VR Gaming Experience - Bigger Joyrides',
    description: 'Step into the game with cutting-edge VR technology. Immersive worlds, realistic graphics, endless possibilities.',
    imageUrl: SAMPLE_AD_IMAGES.vr,
    videoUrl: SAMPLE_VIDEO_ADS.forBiggerJoyrides,
    thumbnailUrl: SAMPLE_AD_IMAGES.vr,
    type: 'regular',
    sponsored: true,
    views: 2670000,
    clicks: 198000,
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
  },
  {
    id: 'ad-video-9',
    title: 'Pro Streaming Setup - Go Live',
    description: 'Everything you need to start streaming like a pro. Cameras, lights, mics, and software bundles at unbeatable prices.',
    imageUrl: SAMPLE_AD_IMAGES.streaming,
    videoUrl: SAMPLE_VIDEO_ADS.forBiggerMeltdowns,
    thumbnailUrl: SAMPLE_AD_IMAGES.streaming,
    type: 'regular',
    sponsored: true,
    views: 1560000,
    clicks: 118000,
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
  },

  // =========================================================================
  // INACTIVE ADS - For testing filters and historical data
  // =========================================================================
  {
    id: 'ad-inactive-1',
    title: 'Expired Holiday Campaign',
    description: 'This holiday ad campaign has ended. Thank you for participating!',
    imageUrl: SAMPLE_AD_IMAGES.business,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.business,
    type: 'regular',
    sponsored: false,
    views: 15000,
    clicks: 400,
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
  },
  {
    id: 'ad-inactive-2',
    title: 'Black Friday Sale - Ended',
    description: 'Our Black Friday sale has ended. Stay tuned for more deals!',
    imageUrl: SAMPLE_AD_IMAGES.fashion,
    videoUrl: null,
    thumbnailUrl: SAMPLE_AD_IMAGES.fashion,
    type: 'featured',
    sponsored: true,
    views: 4500000,
    clicks: 380000,
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

  return {
    totalAds: MOCK_ADS.length,
    activeAds: activeAds.length,
    videoAds: videoAds.length,
    totalViews: activeAds.reduce((sum, ad) => sum + ad.views, 0),
    totalClicks: activeAds.reduce((sum, ad) => sum + ad.clicks, 0),
    averageCTR: activeAds.length > 0
      ? (activeAds.reduce((sum, ad) => sum + (ad.clicks / ad.views), 0) / activeAds.length * 100).toFixed(2)
      : '0',
    adsByType: {
      featured: activeAds.filter(ad => ad.type === 'featured').length,
      banner: activeAds.filter(ad => ad.type === 'banner').length,
      regular: activeAds.filter(ad => ad.type === 'regular').length,
      compact: activeAds.filter(ad => ad.type === 'compact').length,
    },
  };
};

// ============================================================================
// EXPORT
// ============================================================================

export default MOCK_ADS;
