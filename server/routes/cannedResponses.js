const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const {
  getCannedResponses,
  getCannedResponse,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
  previewCannedResponse,
} = require('../controllers/cannedResponseController');

// All routes require authentication
router.use(requireAuth);

// GET /api/canned-responses - Get all canned responses
router.get('/', getCannedResponses);

// GET /api/canned-responses/:id - Get a single canned response
router.get('/:id', getCannedResponse);

// POST /api/canned-responses - Create a canned response (ADMIN/AGENT)
router.post('/', requireRole('ADMIN', 'AGENT'), createCannedResponse);

// PUT /api/canned-responses/:id - Update a canned response (ADMIN/AGENT)
router.put('/:id', requireRole('ADMIN', 'AGENT'), updateCannedResponse);

// DELETE /api/canned-responses/:id - Delete a canned response (ADMIN only)
router.delete('/:id', requireRole('ADMIN'), deleteCannedResponse);

// POST /api/canned-responses/:id/preview - Preview with resolved variables
router.post('/:id/preview', previewCannedResponse);

module.exports = router;
