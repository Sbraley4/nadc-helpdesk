const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getCalendarTickets,
  getWorkloadSummary,
} = require('../controllers/calendarController');

// All routes require authentication
router.use(requireAuth);

// GET /api/calendar - Get tickets and time entries for date range
router.get('/', getCalendarTickets);

// GET /api/calendar/workload - Get workload summary by agent
router.get('/workload', getWorkloadSummary);

module.exports = router;
