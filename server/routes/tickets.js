const express = require('express');
const router = express.Router();
const {
  listTickets,
  getViews,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  mergeTicket,
  addWatcher,
  removeWatcher,
  linkTickets,
  unlinkTickets,
  getTicketActivity,
  updateResolutionSummary,
  getTicketSchedules,
  createTicketSchedule,
  deleteTicketSchedule,
  updateTicketSchedule,
} = require('../controllers/ticketController');
const { getTicketDeductions } = require('../controllers/inventoryController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate, createTicketValidation, updateTicketValidation } = require('../middleware/validate');

// All routes require authentication
router.use(requireAuth);

// IMPORTANT: /views must be before /:id to prevent "views" being treated as an ID
// GET /api/tickets/views - Get saved view definitions
router.get('/views', getViews);

// GET /api/tickets - List all tickets with filters
router.get('/', listTickets);

// GET /api/tickets/:id - Get single ticket
router.get('/:id', getTicket);

// POST /api/tickets - Create ticket
router.post('/', validate(createTicketValidation), createTicket);

// PUT /api/tickets/:id - Update ticket
router.put('/:id', validate(updateTicketValidation), updateTicket);

// DELETE /api/tickets/:id - Delete ticket (ADMIN only)
router.delete('/:id', requireRole('ADMIN'), deleteTicket);

// POST /api/tickets/:id/merge - Merge ticket into another
router.post('/:id/merge', requireRole('ADMIN', 'AGENT'), mergeTicket);

// Watchers
router.post('/:id/watchers', addWatcher);
router.delete('/:id/watchers/:userId', removeWatcher);

// Related tickets
router.post('/:id/related', linkTickets);
router.delete('/:id/related/:relatedTicketId', unlinkTickets);

// Activity
router.get('/:id/activity', getTicketActivity);

// Resolution summary
router.patch('/:id/resolution', updateResolutionSummary);

// Ticket schedules (multi-day calendar scheduling)
router.get('/:id/schedules', getTicketSchedules);
router.post('/:id/schedules', createTicketSchedule);
router.put('/:id/schedules/:scheduleId', updateTicketSchedule);
router.delete('/:id/schedules/:scheduleId', deleteTicketSchedule);

// Inventory deductions for this ticket
router.get('/:id/inventory-deductions', getTicketDeductions);

module.exports = router;
