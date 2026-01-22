/**
 * Mock Ad Data
 * Sample advertisements for development and testing
 * Inspired by Google Ads and YouTube Ads formats
 */

import type { Ad } from '../types';

// ============================================================================
// MOCK ADS DATA
// ============================================================================

export const MOCK_ADS: Ad[] = [
  // Featured Ads - Premium placement
  {
    id: 'ad-featured-1',
    title: 'Discover Premium Financial Services',
    description: 'Unlock exclusive benefits with our premium banking solutions. Earn rewards, get cashback, and enjoy zero transaction fees. Join thousands of satisfied customers today!',
    imageUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=400&fit=crop',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=400&fit=crop',
    type: 'featured',
    sponsored: true,
    views: 125000,
    clicks: 3500,
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
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop',
    type: 'featured',
    sponsored: true,
    views: 98000,
    clicks: 2800,
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
    title: 'E-Commerce Revolution',
    description: 'Shop smarter, save bigger! Exclusive deals on electronics, fashion, and more. Free shipping on orders over $50. Limited time offer!',
    imageUrl: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&h=400&fit=crop',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&h=400&fit=crop',
    type: 'featured',
    sponsored: true,
    views: 156000,
    clicks: 5200,
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

  // Banner Ads - Horizontal strip format
  {
    id: 'ad-banner-1',
    title: 'Quick Loans, Fast Approval',
    description: 'Get approved in minutes! Low interest rates, flexible terms.',
    imageUrl: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&h=200&fit=crop',
    videoUrl: null,
    thumbnailUrl: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&h=200&fit=crop',
    type: 'banner',
    sponsored: true,
    views: 45000,
    clicks: 1200,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-03T00:00:00Z',
    updatedAt: '2025-01-18T14:00:00Z',
    userId: 'advertiser-4',
    priority: 7,
    frequency: 5,
    lastShown: '2025-01-20T11:00:00Z',
    targetUrl: 'https://example.com/quick-loans',
  },
  {
    id: 'ad-banner-2',
    title: 'Mobile Top-Up Rewards',
    description: 'Earn 10% cashback on every mobile recharge!',
    imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=200&fit=crop',
    videoUrl: null,
    thumbnailUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=200&fit=crop',
    type: 'banner',
    sponsored: true,
    views: 67000,
    clicks: 1800,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-07T00:00:00Z',
    updatedAt: '2025-01-20T16:00:00Z',
    userId: 'advertiser-5',
    priority: 6,
    frequency: 4,
    lastShown: '2025-01-20T15:30:00Z',
    targetUrl: 'https://example.com/mobile-rewards',
  },
  {
    id: 'ad-banner-3',
    title: 'Insurance Made Simple',
    description: 'Protect what matters. Get a free quote today.',
    imageUrl: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=200&fit=crop',
    videoUrl: null,
    thumbnailUrl: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=200&fit=crop',
    type: 'banner',
    sponsored: true,
    views: 38000,
    clicks: 950,
    isActive: true,
    startDate: '2025-01-05T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-05T00:00:00Z',
    updatedAt: '2025-01-19T10:00:00Z',
    userId: 'advertiser-6',
    priority: 5,
    frequency: 6,
    lastShown: '2025-01-19T09:00:00Z',
    targetUrl: 'https://example.com/insurance-quote',
  },

  // Regular/Standard Ads
  {
    id: 'ad-regular-1',
    title: 'Learn to Code - Free Course',
    description: 'Master programming with our comprehensive curriculum. Python, JavaScript, and more. Start your tech career today!',
    imageUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&h=400&fit=crop',
    videoUrl: null,
    thumbnailUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&h=400&fit=crop',
    type: 'regular',
    sponsored: true,
    views: 89000,
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
    title: 'Fitness App - Get Fit Now',
    description: 'Personalized workout plans, nutrition tracking, and progress monitoring. Download free and start your fitness journey!',
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    videoUrl: null,
    thumbnailUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    type: 'regular',
    sponsored: true,
    views: 72000,
    clicks: 3200,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-04T00:00:00Z',
    updatedAt: '2025-01-21T09:00:00Z',
    userId: 'advertiser-8',
    priority: 4,
    frequency: 4,
    lastShown: '2025-01-21T08:30:00Z',
    targetUrl: 'https://example.com/fitness-app',
  },
  {
    id: 'ad-regular-3',
    title: 'Travel Deals - Book Now',
    description: 'Exclusive flight and hotel packages. Save up to 50% on your next vacation. Limited time offer!',
    imageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=400&fit=crop',
    videoUrl: null,
    thumbnailUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=400&fit=crop',
    type: 'regular',
    sponsored: true,
    views: 95000,
    clicks: 4100,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-06T00:00:00Z',
    updatedAt: '2025-01-20T20:00:00Z',
    userId: 'advertiser-9',
    priority: 5,
    frequency: 3,
    lastShown: '2025-01-20T19:30:00Z',
    targetUrl: 'https://example.com/travel-deals',
  },
  {
    id: 'ad-regular-4',
    title: 'Smart Home Devices',
    description: 'Transform your home with intelligent devices. Voice control, automation, and energy savings. Shop the latest tech!',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop',
    videoUrl: null,
    thumbnailUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop',
    type: 'regular',
    sponsored: false,
    views: 54000,
    clicks: 2100,
    isActive: true,
    startDate: '2025-01-08T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-08T00:00:00Z',
    updatedAt: '2025-01-19T12:00:00Z',
    userId: 'advertiser-10',
    priority: 3,
    frequency: 5,
    lastShown: '2025-01-19T11:00:00Z',
    targetUrl: 'https://example.com/smart-home',
  },

  // Compact Ads - Minimal footprint
  {
    id: 'ad-compact-1',
    title: 'Daily Rewards App',
    description: 'Earn coins daily!',
    imageUrl: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=300&h=300&fit=crop',
    videoUrl: null,
    thumbnailUrl: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=300&h=300&fit=crop',
    type: 'compact',
    sponsored: true,
    views: 28000,
    clicks: 850,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-09T00:00:00Z',
    updatedAt: '2025-01-20T07:00:00Z',
    userId: 'advertiser-11',
    priority: 2,
    frequency: 8,
    lastShown: '2025-01-20T06:30:00Z',
    targetUrl: 'https://example.com/daily-rewards',
  },
  {
    id: 'ad-compact-2',
    title: 'Crypto Trading',
    description: 'Trade crypto now!',
    imageUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=300&h=300&fit=crop',
    videoUrl: null,
    thumbnailUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=300&h=300&fit=crop',
    type: 'compact',
    sponsored: true,
    views: 42000,
    clicks: 1500,
    isActive: true,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-11T00:00:00Z',
    updatedAt: '2025-01-21T06:00:00Z',
    userId: 'advertiser-12',
    priority: 2,
    frequency: 6,
    lastShown: '2025-01-21T05:30:00Z',
    targetUrl: 'https://example.com/crypto-trading',
  },

  // Video Ads (without featured status)
  {
    id: 'ad-video-1',
    title: 'Gaming Console Launch',
    description: 'Experience next-gen gaming! Pre-order the latest console with exclusive bonuses. Limited stock available.',
    imageUrl: 'https://images.unsplash.com/photo-1486401899868-0e435ed85128?w=800&h=400&fit=crop',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1486401899868-0e435ed85128?w=800&h=400&fit=crop',
    type: 'regular',
    sponsored: true,
    views: 180000,
    clicks: 8500,
    isActive: true,
    startDate: '2025-01-15T00:00:00Z',
    endDate: '2025-06-30T23:59:59Z',
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-21T10:00:00Z',
    userId: 'advertiser-13',
    priority: 8,
    frequency: 2,
    lastShown: '2025-01-21T09:30:00Z',
    targetUrl: 'https://example.com/gaming-console',
  },
  {
    id: 'ad-video-2',
    title: 'Electric Vehicle Test Drive',
    description: 'The future of driving is here. Book your free test drive today and experience zero-emission luxury.',
    imageUrl: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&h=400&fit=crop',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&h=400&fit=crop',
    type: 'regular',
    sponsored: true,
    views: 135000,
    clicks: 6200,
    isActive: true,
    startDate: '2025-01-12T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
    createdAt: '2025-01-12T00:00:00Z',
    updatedAt: '2025-01-20T22:00:00Z',
    userId: 'advertiser-14',
    priority: 7,
    frequency: 3,
    lastShown: '2025-01-20T21:30:00Z',
    targetUrl: 'https://example.com/ev-test-drive',
  },

  // Inactive Ads (for testing filters)
  {
    id: 'ad-inactive-1',
    title: 'Expired Campaign',
    description: 'This ad campaign has ended. Thank you for participating!',
    imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&h=400&fit=crop',
    videoUrl: null,
    thumbnailUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&h=400&fit=crop',
    type: 'regular',
    sponsored: false,
    views: 15000,
    clicks: 400,
    isActive: false,
    startDate: '2024-06-01T00:00:00Z',
    endDate: '2024-12-31T23:59:59Z',
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-12-31T23:59:59Z',
    userId: 'advertiser-15',
    priority: 1,
    frequency: 10,
    lastShown: '2024-12-30T12:00:00Z',
    targetUrl: 'https://example.com/expired',
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

// ============================================================================
// EXPORT
// ============================================================================

export default MOCK_ADS;
