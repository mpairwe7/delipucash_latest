/**
 * Notification API Service
 * Delegates to the real REST API via notificationsApi in api.ts
 */

import { notificationsApi } from './api';
import type { Notification } from '@/types';

// ============================================================================
// TYPES — re-export backend types with local aliases for consumers
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
// TYPE MAPPING
// ============================================================================

function mapNotification(n: Notification): NotificationItem {
  return {
    id: n.id,
    userId: n.userId,
    title: n.title,
    body: n.body,
    type: n.type as NotificationType,
    category: (n.category || 'general') as NotificationCategory,
    priority: n.priority as NotificationPriority,
    read: n.read,
    archived: n.archived,
    actionUrl: n.actionUrl ?? undefined,
    actionText: n.actionText ?? undefined,
    metadata: (n.metadata as Record<string, any>) ?? undefined,
    createdAt: n.createdAt,
    readAt: n.readAt ?? undefined,
    expiresAt: n.expiresAt ?? undefined,
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Initialize notifications — no-op with real API (server owns data)
 */
export const initializeNotifications = (_userId: string): void => {
  // No-op: real notifications are fetched from the server
};

/**
 * Fetch all notifications with optional filters
 */
export const fetchNotifications = async (
  filters?: NotificationFilters
): Promise<NotificationItem[]> => {
  const params: { unreadOnly?: boolean } = {};
  if (filters?.read === false) {
    params.unreadOnly = true;
  }

  const response = await notificationsApi.getAll(params);
  if (!response.success || !response.data) return [];

  let items = (response.data as Notification[]).map(mapNotification);

  // Client-side filtering for fields the API doesn't support as query params
  if (filters?.category) {
    items = items.filter(n => n.category === filters.category);
  }
  if (filters?.priority) {
    items = items.filter(n => n.priority === filters.priority);
  }
  if (filters?.type) {
    items = items.filter(n => n.type === filters.type);
  }

  // Sort newest first
  items.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return items;
};

/**
 * Fetch notification statistics
 */
export const fetchNotificationStats = async (): Promise<NotificationStats> => {
  const [allResponse, unreadResponse] = await Promise.all([
    notificationsApi.getAll(),
    notificationsApi.getUnreadCount(),
  ]);

  const all = allResponse.success
    ? (allResponse.data as Notification[]).map(mapNotification)
    : [];

  const unreadCount = unreadResponse.success
    ? (unreadResponse.data as { count: number }).count
    : 0;

  const byCategory = {} as Record<NotificationCategory, number>;
  const byType = {} as Record<NotificationType, number>;

  all.forEach(n => {
    byCategory[n.category] = (byCategory[n.category] || 0) + 1;
    byType[n.type] = (byType[n.type] || 0) + 1;
  });

  return {
    total: all.length,
    unread: unreadCount,
    urgent: all.filter(n => n.priority === 'URGENT' && !n.read).length,
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
  const response = await notificationsApi.markRead(notificationId);
  if (!response.success) return { success: false, notification: null };

  const mapped = mapNotification(response.data as Notification);
  return { success: true, notification: mapped };
};

/**
 * Mark multiple notifications as read
 */
export const markMultipleAsRead = async (
  notificationIds: string[]
): Promise<{ success: boolean; count: number }> => {
  // Backend doesn't have a bulk endpoint, call individually
  const results = await Promise.all(
    notificationIds.map(id => notificationsApi.markRead(id))
  );
  const count = results.filter(r => r.success).length;
  return { success: count > 0, count };
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (): Promise<{ success: boolean; count: number }> => {
  const response = await notificationsApi.markAllRead();
  if (!response.success) return { success: false, count: 0 };
  const data = response.data as { updated: number };
  return { success: true, count: data.updated };
};

/**
 * Archive notification (uses delete endpoint as backend proxy)
 */
export const archiveNotification = async (
  notificationId: string
): Promise<{ success: boolean }> => {
  const response = await notificationsApi.delete(notificationId);
  return { success: response.success };
};

/**
 * Delete notification
 */
export const deleteNotification = async (
  notificationId: string
): Promise<{ success: boolean }> => {
  const response = await notificationsApi.delete(notificationId);
  return { success: response.success };
};

/**
 * Get unread count
 */
export const getUnreadCount = async (): Promise<number> => {
  const response = await notificationsApi.getUnreadCount();
  if (!response.success) return 0;
  return (response.data as { count: number }).count;
};

/**
 * Get notification by ID (fetches all and filters — no dedicated endpoint)
 */
export const getNotificationById = async (
  notificationId: string
): Promise<NotificationItem | null> => {
  const all = await fetchNotifications();
  return all.find(n => n.id === notificationId) || null;
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
  getUnreadCount,
  getNotificationById,
};
