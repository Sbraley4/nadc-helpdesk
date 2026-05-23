const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :ticketId
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { uploadMultiple } = require('../middleware/upload');
const {
  getReplies,
  createReply,
  updateReply,
  deleteReply,
} = require('../controllers/replyController');

// All routes require authentication
router.use(requireAuth);

// GET /api/tickets/:ticketId/replies - Get all replies for a ticket
router.get('/', getReplies);

// POST /api/tickets/:ticketId/replies - Create a reply (with optional attachments)
router.post('/', uploadMultiple, createReply);

// PUT /api/tickets/:ticketId/replies/:replyId - Update a reply
router.put('/:replyId', updateReply);

// DELETE /api/tickets/:ticketId/replies/:replyId - Delete a reply (ADMIN only)
router.delete('/:replyId', requireRole('ADMIN'), deleteReply);

module.exports = router;
