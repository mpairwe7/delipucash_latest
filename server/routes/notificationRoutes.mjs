import express from 'express';
import { 
  getUserNotifications, 
  getNotifications,
  createNotification, 
  createNotificationFromTemplate,
  markNotificationAsRead,
  markMultipleNotificationsAsRead,
  markAllNotificationsAsRead,
  archiveNotification,
  deleteNotification,
  getNotificationStats,
  getUnreadCount,
  cleanupExpiredNotifications
} from '../controllers/notificationController.mjs';

const router = express.Router();

// Get notifications (userId optional for local mocks)
router.get('/notifications', getNotifications);

// Get notifications for a specific user with filtering and pagination
router.get('/users/:userId/notifications', getUserNotifications);

// Get notification statistics for a user
router.get('/users/:userId/notifications/stats', getNotificationStats);
router.get('/notifications/stats', getNotificationStats);

// Get unread count
router.get('/notifications/unread-count', getUnreadCount);

// Create a new notification
router.post('/notifications', createNotification);

// Create a notification from template
router.post('/notifications/template', createNotificationFromTemplate);

// Mark a notification as read
router.put('/notifications/:notificationId/read', markNotificationAsRead);
router.post('/notifications/:notificationId/read', markNotificationAsRead);

// Mark multiple notifications as read
router.put('/users/:userId/notifications/read', markMultipleNotificationsAsRead);

// Mark all notifications as read
router.post('/notifications/read-all', markAllNotificationsAsRead);

// Archive a notification
router.put('/notifications/:notificationId/archive', archiveNotification);
router.delete('/notifications/:notificationId', deleteNotification);

// Cleanup expired notifications (admin function)
router.delete('/notifications/cleanup', cleanupExpiredNotifications);

export default router; 