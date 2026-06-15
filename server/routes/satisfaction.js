const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const {
  getReviewDetails,
  submitReview,
  optOut,
  getRatings,
} = require('../controllers/satisfactionController');

// PUBLIC routes - accessed via email links (no auth)

// GET /api/satisfaction/review/:token - Get review details for React page
router.get('/review/:token', getReviewDetails);

// POST /api/satisfaction/review/:token - Submit star rating and comment
router.post('/review/:token', submitReview);

// GET /api/satisfaction/opt-out - Opt out from review requests
router.get('/opt-out', optOut);

// PROTECTED routes - Admin only
// GET /api/satisfaction/ratings - Get all ratings with stats
router.get('/ratings', requireAuth, requireRole('ADMIN'), getRatings);

module.exports = router;
