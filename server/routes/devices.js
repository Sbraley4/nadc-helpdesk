const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const {
  getDevices,
  getDevice,
  createDevice,
  updateDevice,
  deleteDevice,
} = require('../controllers/deviceController');

// All routes require authentication
router.use(requireAuth);

// GET /api/devices
router.get('/', getDevices);

// GET /api/devices/:id
router.get('/:id', getDevice);

// POST /api/devices
router.post('/', createDevice);

// PUT /api/devices/:id
router.put('/:id', updateDevice);

// DELETE /api/devices/:id - Admin only
router.delete('/:id', requireRole('ADMIN'), deleteDevice);

module.exports = router;
