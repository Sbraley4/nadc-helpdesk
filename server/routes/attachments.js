const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const {
  deleteAttachment,
  downloadAttachment,
} = require('../controllers/attachmentController');

// All routes require authentication
router.use(requireAuth);

// GET /api/attachments/:id/download - Download an attachment
router.get('/:id/download', downloadAttachment);

// DELETE /api/attachments/:id - Delete an attachment (uploader or admin)
router.delete('/:id', requireRole('ADMIN', 'AGENT'), deleteAttachment);

module.exports = router;
