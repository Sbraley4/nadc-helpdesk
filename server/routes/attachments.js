const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const {
  deleteAttachment,
  downloadAttachment,
  getPreviewUrl,
} = require('../controllers/attachmentController');

/**
 * Middleware for download route that accepts either:
 * 1. Authorization Bearer header (standard auth)
 * 2. Signed token query parameter (for browser navigation to PDFs)
 */
const requireAuthOrToken = (req, res, next) => {
  const { token } = req.query;

  // If a token query param is provided, validate it
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Ensure token type is correct
      if (decoded.type !== 'attachment_preview') {
        return res.status(401).json({ error: 'Invalid token type' });
      }

      // Ensure token is for this specific attachment
      if (decoded.attachmentId !== req.params.id) {
        return res.status(403).json({ error: 'Token not valid for this attachment' });
      }

      // Token is valid - mark request as preview token auth and proceed
      req.isPreviewToken = true;
      return next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ error: 'Preview link has expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // No token provided - fall back to standard auth
  return requireAuth(req, res, next);
};

// GET /api/attachments/:id/preview-url - Generate a short-lived signed preview URL
router.get('/:id/preview-url', requireAuth, getPreviewUrl);

// GET /api/attachments/:id/download - Download an attachment (auth OR signed token)
router.get('/:id/download', requireAuthOrToken, downloadAttachment);

// DELETE /api/attachments/:id - Delete an attachment (uploader or admin)
router.delete('/:id', requireAuth, requireRole('ADMIN', 'AGENT'), deleteAttachment);

module.exports = router;
