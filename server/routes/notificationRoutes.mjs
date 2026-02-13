import express from 'express';
import { verifyToken, requireAdmin } from '../utils/verifyUser.mjs';
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

// All routes require authentication (mounted at /api/notifications)

// Get notifications for authenticated user
router.get('/', verifyToken, getNotifications);

// Get notifications for a specific user with filtering and pagination
router.get('/users/:userId', verifyToken, getUserNotifications);

// Get notification statistics
router.get('/users/:userId/stats', verifyToken, getNotificationStats);
router.get('/stats', verifyToken, getNotificationStats);

// Get unread count
router.get('/unread-count', verifyToken, getUnreadCount);

// Create a new notification
router.post('/', verifyToken, createNotification);

// Create a notification from template
router.post('/template', verifyToken, createNotificationFromTemplate);

// Mark a notification as read
router.put('/:notificationId/read', verifyToken, markNotificationAsRead);
router.post('/:notificationId/read', verifyToken, markNotificationAsRead);

// Mark multiple notifications as read
router.put('/users/:userId/read', verifyToken, markMultipleNotificationsAsRead);

// Mark all notifications as read
router.post('/read-all', verifyToken, markAllNotificationsAsRead);

// Archive a notification
router.put('/:notificationId/archive', verifyToken, archiveNotification);
router.delete('/:notificationId', verifyToken, deleteNotification);

// Cleanup expired notifications (admin only)
router.delete('/cleanup', verifyToken, requireAdmin, cleanupExpiredNotifications);

export default router;
