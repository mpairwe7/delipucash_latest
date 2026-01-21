/**
 * Notification API Service
 * Mock REST API for notifications functionality
 * Design System Compliant - Consistent patterns and error handling
 */

// ============================================================================
// TYPES
// ============================================================================

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type NotificationCategory = 
  | 'payments' 
  | 'rewards' 
  | 'surveys' 
  | 'subscription'
  | 'security' 
  | 'achievements' 
  | 'referrals'
  | 'welcome'
  | 'general';

export type NotificationType =
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_PENDING'
  | 'REWARD_EARNED'
  | 'REWARD_REDEEMED'
  | 'SURVEY_COMPLETED'
  | 'SURVEY_EXPIRING'
  | 'SUBSCRIPTION_ACTIVE'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SECURITY_ALERT'
  | 'ACHIEVEMENT'
  | 'REFERRAL_BONUS'
  | 'WELCOME'
  | 'SYSTEM_UPDATE'
  | 'PROMOTIONAL';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  read: boolean;
  archived: boolean;
  actionUrl?: string;
  actionText?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  readAt?: string;
  expiresAt?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  urgent: number;
  byCategory: Record<NotificationCategory, number>;
  byType: Record<NotificationType, number>;
}

export interface NotificationPreferences {
  push: boolean;
  email: boolean;
  sms: boolean;
  categories: Record<NotificationCategory, boolean>;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface NotificationFilters {
  read?: boolean;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  type?: NotificationType;
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const generateMockNotifications = (userId: string): NotificationItem[] => {
  const now = new Date();
  
  return [
    {
      id: 'notif_1',
      userId,
      title: 'Payment Received! 🎉',
      body: 'Your withdrawal of UGX 50,000 has been successfully sent to your MTN Mobile Money account ending in ***896.',
      type: 'PAYMENT_SUCCESS',
      category: 'payments',
      priority: 'HIGH',
      read: false,
      archived: false,
      actionUrl: '/(tabs)/transactions',
      actionText: 'View Transaction',
      metadata: {
        amount: 'UGX 50,000',
        transactionId: 'TXN_123456',
        paymentMethod: 'MTN Mobile Money',
      },
      createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 min ago
    },
    {
      id: 'notif_2',
      userId,
      title: 'Reward Earned! ⭐',
      body: 'Congratulations! You\'ve earned 150 points for completing the "Consumer Preferences" survey. Keep up the great work!',
      type: 'REWARD_EARNED',
      category: 'rewards',
      priority: 'MEDIUM',
      read: false,
      archived: false,
      actionUrl: '/(tabs)/surveys',
      actionText: 'Find More Surveys',
      metadata: {
        points: 150,
        surveyName: 'Consumer Preferences',
      },
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    },
    {
      id: 'notif_3',
      userId,
      title: 'Security Alert ⚠️',
      body: 'New login detected from a Samsung Galaxy S23 in Kampala, Uganda. If this wasn\'t you, please secure your account immediately.',
      type: 'SECURITY_ALERT',
      category: 'security',
      priority: 'URGENT',
      read: false,
      archived: false,
      actionUrl: '/(tabs)/profile',
      actionText: 'Review Security',
      metadata: {
        device: 'Samsung Galaxy S23',
        location: 'Kampala, Uganda',
        ipAddress: '102.xxx.xxx.xxx',
      },
      createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    },
    {
      id: 'notif_4',
      userId,
      title: 'Survey Expiring Soon! ⏰',
      body: 'The "Mobile Banking Experience" survey expires in 2 hours. Complete it now to earn 200 points before it\'s gone!',
      type: 'SURVEY_EXPIRING',
      category: 'surveys',
      priority: 'HIGH',
      read: true,
      archived: false,
      actionUrl: '/(tabs)/surveys',
      actionText: 'Complete Survey',
      metadata: {
        surveyId: 'survey_456',
        points: 200,
        expiresIn: '2 hours',
      },
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      readAt: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif_5',
      userId,
      title: 'Achievement Unlocked! 🏆',
      body: 'You\'ve earned the "Survey Master" badge for completing 50 surveys! You\'ve also received a bonus of 500 points.',
      type: 'ACHIEVEMENT',
      category: 'achievements',
      priority: 'MEDIUM',
      read: true,
      archived: false,
      metadata: {
        badge: 'Survey Master',
        bonusPoints: 500,
        totalSurveys: 50,
      },
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      readAt: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif_6',
      userId,
      title: 'Referral Bonus! 🎁',
      body: 'Your friend John completed their first survey! You\'ve earned a UGX 5,000 referral bonus. Keep inviting friends!',
      type: 'REFERRAL_BONUS',
      category: 'referrals',
      priority: 'MEDIUM',
      read: true,
      archived: false,
      actionUrl: '/(tabs)/profile',
      actionText: 'Invite More Friends',
      metadata: {
        bonus: 'UGX 5,000',
        referredUser: 'John',
        totalReferrals: 5,
      },
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      readAt: new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif_7',
      userId,
      title: 'Payment Failed ❌',
      body: 'Your withdrawal of UGX 25,000 could not be processed. Please verify your mobile money account details and try again.',
      type: 'PAYMENT_FAILED',
      category: 'payments',
      priority: 'URGENT',
      read: false,
      archived: false,
      actionUrl: '/(tabs)/withdraw',
      actionText: 'Retry Withdrawal',
      metadata: {
        amount: 'UGX 25,000',
        errorCode: 'INVALID_ACCOUNT',
        reason: 'Account verification failed',
      },
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    },
    {
      id: 'notif_8',
      userId,
      title: 'Premium Subscription Activated! 👑',
      body: 'Welcome to DelipuCash Premium! You now have access to exclusive surveys, priority support, and higher rewards.',
      type: 'SUBSCRIPTION_ACTIVE',
      category: 'subscription',
      priority: 'HIGH',
      read: true,
      archived: false,
      metadata: {
        plan: 'Premium',
        validUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        features: ['Exclusive surveys', 'Priority support', '2x rewards'],
      },
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      readAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif_9',
      userId,
      title: 'Survey Completed Successfully! ✅',
      body: 'Great job! You\'ve completed the "Financial Habits" survey and earned 100 points. Your responses help shape better products.',
      type: 'SURVEY_COMPLETED',
      category: 'surveys',
      priority: 'LOW',
      read: true,
      archived: false,
      metadata: {
        points: 100,
        surveyName: 'Financial Habits',
        completionTime: '8 minutes',
      },
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      readAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif_10',
      userId,
      title: 'Welcome to DelipuCash! 🚀',
      body: 'Thanks for joining DelipuCash! Complete your profile to unlock your first survey and start earning rewards today.',
      type: 'WELCOME',
      category: 'welcome',
      priority: 'MEDIUM',
      read: true,
      archived: false,
      actionUrl: '/(tabs)/profile',
      actionText: 'Complete Profile',
      createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
      readAt: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  push: true,
  email: true,
  sms: false,
  categories: {
    payments: true,
    rewards: true,
    surveys: true,
    subscription: true,
    security: true,
    achievements: true,
    referrals: true,
    welcome: true,
    general: true,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
};

// In-memory store for mock data
let mockNotifications: NotificationItem[] = [];
let mockPreferences: NotificationPreferences = { ...DEFAULT_PREFERENCES };

// ============================================================================
// API SIMULATION HELPERS
// ============================================================================

const simulateNetworkDelay = (ms: number = 500): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Initialize notifications for a user
 */
export const initializeNotifications = (userId: string): void => {
  mockNotifications = generateMockNotifications(userId);
  console.log('[NotificationAPI] Initialized notifications for user:', userId);
};

/**
 * Fetch all notifications
 */
export const fetchNotifications = async (
  filters?: NotificationFilters
): Promise<NotificationItem[]> => {
  console.log('[NotificationAPI] Fetching notifications with filters:', filters);
  
  await simulateNetworkDelay(300);
  
  let result = [...mockNotifications].filter(n => !n.archived);
  
  if (filters) {
    if (filters.read !== undefined) {
      result = result.filter(n => n.read === filters.read);
    }
    if (filters.category) {
      result = result.filter(n => n.category === filters.category);
    }
    if (filters.priority) {
      result = result.filter(n => n.priority === filters.priority);
    }
    if (filters.type) {
      result = result.filter(n => n.type === filters.type);
    }
  }
  
  // Sort by date, newest first
  result.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  return result;
};

/**
 * Fetch notification statistics
 */
export const fetchNotificationStats = async (): Promise<NotificationStats> => {
  console.log('[NotificationAPI] Fetching notification stats');
  
  await simulateNetworkDelay(200);
  
  const notifications = mockNotifications.filter(n => !n.archived);
  
  const byCategory = {} as Record<NotificationCategory, number>;
  const byType = {} as Record<NotificationType, number>;
  
  notifications.forEach(n => {
    byCategory[n.category] = (byCategory[n.category] || 0) + 1;
    byType[n.type] = (byType[n.type] || 0) + 1;
  });
  
  return {
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    urgent: notifications.filter(n => n.priority === 'URGENT' && !n.read).length,
    byCategory,
    byType,
  };
};

/**
 * Mark notification as read
 */
export const markAsRead = async (
  notificationId: string
): Promise<{ success: boolean; notification: NotificationItem | null }> => {
  console.log('[NotificationAPI] Marking notification as read:', notificationId);
  
  await simulateNetworkDelay(150);
  
  const index = mockNotifications.findIndex(n => n.id === notificationId);
  if (index !== -1) {
    mockNotifications[index] = {
      ...mockNotifications[index],
      read: true,
      readAt: new Date().toISOString(),
    };
    return { success: true, notification: mockNotifications[index] };
  }
  
  return { success: false, notification: null };
};

/**
 * Mark multiple notifications as read
 */
export const markMultipleAsRead = async (
  notificationIds: string[]
): Promise<{ success: boolean; count: number }> => {
  console.log('[NotificationAPI] Marking multiple notifications as read:', notificationIds.length);
  
  await simulateNetworkDelay(200);
  
  let count = 0;
  const now = new Date().toISOString();
  
  notificationIds.forEach(id => {
    const index = mockNotifications.findIndex(n => n.id === id);
    if (index !== -1 && !mockNotifications[index].read) {
      mockNotifications[index] = {
        ...mockNotifications[index],
        read: true,
        readAt: now,
      };
      count++;
    }
  });
  
  return { success: true, count };
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (): Promise<{ success: boolean; count: number }> => {
  console.log('[NotificationAPI] Marking all notifications as read');
  
  await simulateNetworkDelay(300);
  
  const now = new Date().toISOString();
  let count = 0;
  
  mockNotifications = mockNotifications.map(n => {
    if (!n.read) {
      count++;
      return { ...n, read: true, readAt: now };
    }
    return n;
  });
  
  return { success: true, count };
};

/**
 * Archive notification
 */
export const archiveNotification = async (
  notificationId: string
): Promise<{ success: boolean }> => {
  console.log('[NotificationAPI] Archiving notification:', notificationId);
  
  await simulateNetworkDelay(150);
  
  const index = mockNotifications.findIndex(n => n.id === notificationId);
  if (index !== -1) {
    mockNotifications[index] = {
      ...mockNotifications[index],
      archived: true,
    };
    return { success: true };
  }
  
  return { success: false };
};

/**
 * Delete notification
 */
export const deleteNotification = async (
  notificationId: string
): Promise<{ success: boolean }> => {
  console.log('[NotificationAPI] Deleting notification:', notificationId);
  
  await simulateNetworkDelay(150);
  
  const initialLength = mockNotifications.length;
  mockNotifications = mockNotifications.filter(n => n.id !== notificationId);
  
  return { success: mockNotifications.length < initialLength };
};

/**
 * Fetch notification preferences
 */
export const fetchPreferences = async (): Promise<NotificationPreferences> => {
  console.log('[NotificationAPI] Fetching notification preferences');
  
  await simulateNetworkDelay(200);
  
  return { ...mockPreferences };
};

/**
 * Update notification preferences
 */
export const updatePreferences = async (
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> => {
  console.log('[NotificationAPI] Updating notification preferences');
  
  await simulateNetworkDelay(300);
  
  mockPreferences = {
    ...mockPreferences,
    ...preferences,
    categories: {
      ...mockPreferences.categories,
      ...(preferences.categories || {}),
    },
    quietHours: {
      ...mockPreferences.quietHours,
      ...(preferences.quietHours || {}),
    },
  };
  
  return { ...mockPreferences };
};

/**
 * Get unread count
 */
export const getUnreadCount = async (): Promise<number> => {
  await simulateNetworkDelay(100);
  return mockNotifications.filter(n => !n.read && !n.archived).length;
};

/**
 * Get notification by ID
 */
export const getNotificationById = async (
  notificationId: string
): Promise<NotificationItem | null> => {
  console.log('[NotificationAPI] Fetching notification by ID:', notificationId);
  
  await simulateNetworkDelay(150);
  
  return mockNotifications.find(n => n.id === notificationId) || null;
};

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  initializeNotifications,
  fetchNotifications,
  fetchNotificationStats,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  archiveNotification,
  deleteNotification,
  fetchPreferences,
  updatePreferences,
  getUnreadCount,
  getNotificationById,
};
