const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :ticketId
const { requireAuth } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');
const {
  uploadTicketAttachment,
  getTicketAttachments,
} = require('../controllers/attachmentController');

// All routes require authentication
router.use(requireAuth);

// POST /api/tickets/:ticketId/attachments - Upload attachments to a ticket
router.post('/', uploadMultiple, uploadTicketAttachment);

// GET /api/tickets/:ticketId/attachments - Get all attachments for a ticket
router.get('/', getTicketAttachments);

module.exports = router;
