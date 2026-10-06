const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const {
  getReviewDetails,
  submitReview,
  optOutPage,
  optOutConfirm,
  getRatings,
  getReviewRequests,
} = require('../controllers/satisfactionController');

// PUBLIC routes - accessed via email links (no auth)

// GET /api/satisfaction/review/:token - Get review details for React page
router.get('/review/:token', getReviewDetails);

// POST /api/satisfaction/review/:token - Submit star rating and comment
router.post('/review/:token', submitReview);

// GET /api/satisfaction/opt-out - Show opt-out confirmation page
router.get('/opt-out', optOutPage);

// POST /api/satisfaction/opt-out - Actually perform the opt-out
router.post('/opt-out', optOutConfirm);

// PROTECTED routes - Admin only
// GET /api/satisfaction/ratings - Get all ratings with stats
router.get('/ratings', requireAuth, requireRole('ADMIN'), getRatings);

// GET /api/satisfaction/requests - Get review request stats and pending list
router.get('/requests', requireAuth, requireRole('ADMIN'), getReviewRequests);

module.exports = router;
