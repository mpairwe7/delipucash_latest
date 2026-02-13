import asyncHandler from "express-async-handler";
import prisma from '../lib/prisma.mjs';
import { errorHandler } from "../utils/error.mjs";
import { publishEvent } from '../lib/eventBus.mjs';

// Notification templates inspired by fintech apps
const NOTIFICATION_TEMPLATES = {
  PAYMENT_SUCCESS: {
    title: "Payment Successful! 💰",
    body: "Your payment of {amount} UGX has been processed successfully.",
    icon: "checkmark-circle",
    priority: "HIGH",
    category: "payments"
  },
  PAYMENT_FAILED: {
    title: "Payment Failed ❌",
    body: "Your payment of {amount} UGX could not be processed. Please try again.",
    icon: "close-circle",
    priority: "URGENT",
    category: "payments"
  },
  PAYMENT_PENDING: {
    title: "Payment Processing ⏳",
    body: "Your payment of {amount} UGX is being processed. We'll notify you once it's complete.",
    icon: "time",
    priority: "MEDIUM",
    category: "payments"
  },
  REWARD_EARNED: {
    title: "Reward Earned! 🎉",
    body: "Congratulations! You've earned {points} points for completing a survey.",
    icon: "star",
    priority: "HIGH",
    category: "rewards"
  },
  REWARD_REDEEMED: {
    title: "Reward Redeemed! 🎁",
    body: "Your reward of {amount} UGX has been sent to {phoneNumber}.",
    icon: "gift",
    priority: "HIGH",
    category: "rewards"
  },
  SURVEY_COMPLETED: {
    title: "Survey Completed! 📊",
    body: "Great job! You've completed '{surveyTitle}' and earned {points} points.",
    icon: "document-text",
    priority: "MEDIUM",
    category: "surveys"
  },
  SURVEY_EXPIRING: {
    title: "Survey Expiring Soon! ⏰",
    body: "Your survey '{surveyTitle}' expires in {timeLeft}. Complete it to earn rewards!",
    icon: "warning",
    priority: "HIGH",
    category: "surveys"
  },
  SUBSCRIPTION_ACTIVE: {
    title: "Subscription Active! ✅",
    body: "Your {subscriptionType} subscription is now active. Enjoy premium features!",
    icon: "shield-checkmark",
    priority: "HIGH",
    category: "subscription"
  },
  SUBSCRIPTION_EXPIRED: {
    title: "Subscription Expired ⚠️",
    body: "Your {subscriptionType} subscription has expired. Renew to continue enjoying premium features.",
    icon: "shield-close",
    priority: "URGENT",
    category: "subscription"
  },
  SECURITY_ALERT: {
    title: "Security Alert! 🔒",
    body: "We detected unusual activity on your account. Please verify your identity.",
    icon: "lock-closed",
    priority: "URGENT",
    category: "security"
  },
  ACHIEVEMENT: {
    title: "Achievement Unlocked! 🏆",
    body: "You've reached a new milestone: {achievement}. Keep up the great work!",
    icon: "trophy",
    priority: "HIGH",
    category: "achievements"
  },
  REFERRAL_BONUS: {
    title: "Referral Bonus! 👥",
    body: "Your friend joined DelipuCash! You both earned {bonus} points.",
    icon: "people",
    priority: "HIGH",
    category: "referrals"
  },
  WELCOME: {
    title: "Welcome to DelipuCash! 🎊",
    body: "Start earning rewards by completing surveys and answering questions!",
    icon: "home",
    priority: "MEDIUM",
    category: "welcome"
  }
};

// Helper function to create notification with template
const createNotificationFromTemplateHelper = async (userId, templateKey, data = {}) => {
  const template = NOTIFICATION_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Unknown notification template: ${templateKey}`);
  }

  // Replace placeholders in template
  let title = template.title;
  let body = template.body;
  
  Object.keys(data).forEach(key => {
    const placeholder = `{${key}}`;
    title = title.replace(placeholder, data[key]);
    body = body.replace(placeholder, data[key]);
  });

  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      body,
      type: templateKey,
      priority: template.priority,
      icon: template.icon,
      category: template.category,
      metadata: data,
      actionUrl: data.actionUrl,
      actionText: data.actionText,
      expiresAt: data.expiresAt
    }
  });

  // SSE: Notify user of new notification in real-time
  publishEvent(userId, 'notification.new', {
    notificationId: notification.id,
    title,
    type: templateKey,
    priority: template.priority,
    category: template.category,
  }).catch(() => {});

  return notification;
};


// Get notifications for a user with advanced filtering and pagination
export const getUserNotifications = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    category,
    read,
    unreadOnly,
    priority,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  try {
    // Use authenticated user from JWT; fall back to params for admin use
    const userId = req.userRef || req.params.userId;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    // Build where clause
    const where = { userId };
    
    if (type) where.type = type;
    if (category) where.category = category;
    if (unreadOnly === 'true') {
      where.read = false;
    } else if (read !== undefined) {
      where.read = read === 'true';
    }
    if (priority) where.priority = priority;
    
    // Don't show expired notifications
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } }
    ];

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get notifications with pagination
    if (!prisma || !prisma.notification) {
      throw new Error('Prisma client or notification model not available');
    }
    
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: parseInt(limit),
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      // Prisma Accelerate: Short cache for notifications (30s TTL, 10s SWR)
    });

    // Get total count for pagination
    const total = await prisma.notification.count({ where });
    
    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: { ...where, read: false }
    });

    // Get counts by category
    const categoryCounts = await prisma.notification.groupBy({
      by: ['category'],
      where: { ...where, read: false },
      _count: { category: true }
    });

    console.log(`getUserNotifications: Returning ${notifications.length} notifications`);
    
    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      summary: {
        unreadCount,
        categoryCounts: categoryCounts.reduce((acc, item) => {
          acc[item.category] = item._count.category;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('getUserNotifications: Error fetching notifications:', error);
    errorHandler(error, res);
  }
});

export const getNotifications = asyncHandler(async (req, res) => {
  // Reuse getUserNotifications logic — userId comes from JWT (req.userRef)
  return getUserNotifications(req, res);
});

// Create a new notification with enhanced features
export const createNotification = asyncHandler(async (req, res) => {
  const { 
    userId, 
    title, 
    body, 
    type = 'SYSTEM_UPDATE',
    priority = 'MEDIUM',
    icon,
    imageUrl,
    actionUrl,
    actionText,
    metadata,
    category,
    expiresAt
  } = req.body;

  try {
    console.log(`createNotification: Creating notification for user ${userId}`);

    // Validate user exists
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type,
        priority,
        icon,
        imageUrl,
        actionUrl,
        actionText,
        metadata,
        category,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // SSE: Notify user of new notification in real-time
    publishEvent(userId, 'notification.new', {
      notificationId: notification.id,
      title,
      type,
      priority,
      category,
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: notification
    });
  } catch (error) {
    console.error('createNotification: Error creating notification:', error);
    errorHandler(error, res);
  }
});

// Create notification from template
export const createNotificationFromTemplate = asyncHandler(async (req, res) => {
  const { userId, templateKey, data } = req.body;

  try {
    console.log(`createNotificationFromTemplate: Creating ${templateKey} notification for user ${userId}`);

    const notification = await createNotificationFromTemplateHelper(userId, templateKey, data);
    
    res.status(201).json({ 
      success: true,
      message: 'Notification created successfully from template',
      data: notification
    });
  } catch (error) {
    console.error('createNotificationFromTemplate: Error creating notification:', error);
    errorHandler(error, res);
  }
});

// Mark notification as read (with ownership check)
export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.userRef;

  try {
    // Verify ownership before updating
    const existing = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() }
    });

    // SSE: Notify client that notification was read
    publishEvent(userId, 'notification.read', { notificationId }).catch(() => {});

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('markNotificationAsRead: Error:', error);
    errorHandler(error, res);
  }
});

// Mark multiple notifications as read
export const markMultipleNotificationsAsRead = asyncHandler(async (req, res) => {
  const { notificationIds, markAll = false, category } = req.body;
  const userId = req.userRef;

  try {

    let where = { userId, read: false };
    
    if (!markAll) {
      where.id = { in: notificationIds };
    }
    
    if (category) {
      where.category = category;
    }

    const result = await prisma.notification.updateMany({
      where,
      data: { 
        read: true,
        readAt: new Date()
      }
    });
    
    res.json({ 
      success: true,
      message: `${result.count} notifications marked as read`,
      data: { count: result.count }
    });
  } catch (error) {
    console.error('markMultipleNotificationsAsRead: Error marking notifications as read:', error);
    errorHandler(error, res);
  }
});

export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const userId = req.userRef;

  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() }
  });

  // SSE: Notify client that all notifications were read
  publishEvent(userId, 'notification.readAll', { updated: result.count }).catch(() => {});

  res.json({ success: true, data: { updated: result.count } });
});

// Archive notification (with ownership check)
export const archiveNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.userRef;

  try {
    const existing = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: { archived: true, archivedAt: new Date() }
    });

    res.json({
      success: true,
      message: 'Notification archived',
      data: notification
    });
  } catch (error) {
    console.error('archiveNotification: Error:', error);
    errorHandler(error, res);
  }
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.userRef;

  try {
    const existing = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    await prisma.notification.delete({ where: { id: notificationId } });
    res.json({ success: true, data: { deleted: true, id: notificationId } });
  } catch (error) {
    console.error('deleteNotification: Error:', error);
    errorHandler(error, res);
  }
});

// Get notification statistics
export const getNotificationStats = asyncHandler(async (req, res) => {
  const userId = req.userRef;

  try {
    console.log(`getNotificationStats: Getting stats for user ${userId}`);

    const [
      totalNotifications,
      unreadCount,
      readCount,
      archivedCount,
      categoryStats,
      typeStats,
      priorityStats
    ] = await Promise.all([
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, read: false } }),
      prisma.notification.count({ where: { userId, read: true } }),
      prisma.notification.count({ where: { userId, archived: true } }),
      prisma.notification.groupBy({
        by: ['category'],
        where: { userId },
        _count: { category: true }
      }),
      prisma.notification.groupBy({
        by: ['type'],
        where: { userId },
        _count: { type: true }
      }),
      prisma.notification.groupBy({
        by: ['priority'],
        where: { userId },
        _count: { priority: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        total: totalNotifications,
        unread: unreadCount,
        read: readCount,
        archived: archivedCount,
        categories: categoryStats.reduce((acc, item) => {
          acc[item.category] = item._count.category;
          return acc;
        }, {}),
        types: typeStats.reduce((acc, item) => {
          acc[item.type] = item._count.type;
          return acc;
        }, {}),
        priorities: priorityStats.reduce((acc, item) => {
          acc[item.priority] = item._count.priority;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('getNotificationStats: Error getting notification stats:', error);
    errorHandler(error, res);
  }
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.userRef;
  const count = await prisma.notification.count({ where: { userId, read: false, archived: false } });
  res.json({ success: true, data: { count } });
});

// Delete expired notifications (cleanup function)
export const cleanupExpiredNotifications = asyncHandler(async (req, res) => {
  try {
    console.log('cleanupExpiredNotifications: Cleaning up expired notifications');
    
    const result = await prisma.notification.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    res.json({ 
      message: `${result.count} expired notifications deleted`,
      count: result.count
    });
  } catch (error) {
    console.error('cleanupExpiredNotifications: Error cleaning up notifications:', error);
    errorHandler(error, res);
  }
});

// Export template function for use in other controllers
export { createNotificationFromTemplateHelper }; 