import express from 'express';
import { 
  getUserNotifications, 
  createNotification, 
  createNotificationFromTemplateHelper,
  markNotificationAsRead,
  markMultipleNotificationsAsRead,
  archiveNotification,
  getNotificationStats,
  cleanupExpiredNotifications
} from '../controllers/notificationController.mjs';

const router = express.Router();

// Get notifications for a specific user with filtering and pagination
router.get('/users/:userId/notifications', getUserNotifications);

// Get notification statistics for a user
router.get('/users/:userId/notifications/stats', getNotificationStats);

// Create a new notification
router.post('/notifications', createNotification);

// Create a notification from template
router.post('/notifications/template', createNotificationFromTemplateHelper);

// Mark a notification as read
router.put('/notifications/:notificationId/read', markNotificationAsRead);

// Mark multiple notifications as read
router.put('/users/:userId/notifications/read', markMultipleNotificationsAsRead);

// Archive a notification
router.put('/notifications/:notificationId/archive', archiveNotification);

// Cleanup expired notifications (admin function)
router.delete('/notifications/cleanup', cleanupExpiredNotifications);

export default router; 