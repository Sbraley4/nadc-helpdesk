const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} = require('../controllers/notificationController');

// All routes require authentication
router.use(requireAuth);

// GET /api/notifications - List notifications
router.get('/', getNotifications);

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', getUnreadCount);

// PUT/PATCH /api/notifications/read-all - Mark all as read
router.put('/read-all', markAllAsRead);
router.patch('/read-all', markAllAsRead);

// PUT /api/notifications/:id/read - Mark single as read
router.put('/:id/read', markAsRead);

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', deleteNotification);

module.exports = router;
