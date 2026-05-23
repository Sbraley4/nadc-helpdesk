const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const {
  submitRating,
  submitFeedback,
  optOut,
  getRatings,
} = require('../controllers/satisfactionController');

// PUBLIC routes - accessed via email links (no auth)
// GET /api/satisfaction/:ticketId/rate - Rate from email
router.get('/:ticketId/rate', submitRating);

// POST /api/satisfaction/:ticketId/feedback - Submit feedback from form
router.post('/:ticketId/feedback', express.urlencoded({ extended: true }), submitFeedback);

// GET /api/satisfaction/opt-out - Opt out from review requests
router.get('/opt-out', optOut);

// PROTECTED routes - Admin only
// GET /api/satisfaction/ratings - Get all ratings
router.get('/ratings', requireAuth, requireRole('ADMIN'), getRatings);

module.exports = router;
