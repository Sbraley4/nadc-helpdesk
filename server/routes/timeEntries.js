const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth');
const {
  getTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
} = require('../controllers/timeEntryController');

// All routes require authentication
router.use(requireAuth);

// GET /api/tickets/:ticketId/time
router.get('/', getTimeEntries);

// POST /api/tickets/:ticketId/time
router.post('/', createTimeEntry);

// PUT /api/tickets/:ticketId/time/:entryId
router.put('/:entryId', updateTimeEntry);

// DELETE /api/tickets/:ticketId/time/:entryId
router.delete('/:entryId', deleteTimeEntry);

module.exports = router;
