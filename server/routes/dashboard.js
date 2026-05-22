const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getDashboardTrends
} = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/stats', getDashboardStats);
router.get('/trends', getDashboardTrends);

module.exports = router;
