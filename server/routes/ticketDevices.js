const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth');
const {
  linkDeviceToTicket,
  unlinkDeviceFromTicket,
  getTicketDevices,
} = require('../controllers/deviceController');

// All routes require authentication
router.use(requireAuth);

// GET /api/tickets/:ticketId/devices
router.get('/', getTicketDevices);

// POST /api/tickets/:ticketId/devices
router.post('/', linkDeviceToTicket);

// DELETE /api/tickets/:ticketId/devices/:deviceId
router.delete('/:deviceId', unlinkDeviceFromTicket);

module.exports = router;
