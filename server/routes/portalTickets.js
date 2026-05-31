const express = require('express');
const router = express.Router();
const { requirePortalAuth } = require('../middleware/portalAuth');
const {
  portalGetTickets,
  portalGetTicket,
  portalCreateTicket,
  portalReplyToTicket,
  portalGetReplies,
} = require('../controllers/portalTicketController');

// All routes require portal authentication
router.use(requirePortalAuth);

// GET /api/portal/tickets - List contact's tickets
router.get('/', portalGetTickets);

// POST /api/portal/tickets - Create new ticket
router.post('/', portalCreateTicket);

// GET /api/portal/tickets/:id - Get single ticket
router.get('/:id', portalGetTicket);

// GET /api/portal/tickets/:id/replies - Get ticket replies
router.get('/:id/replies', portalGetReplies);

// POST /api/portal/tickets/:id/replies - Add reply to ticket
router.post('/:id/replies', portalReplyToTicket);

module.exports = router;
