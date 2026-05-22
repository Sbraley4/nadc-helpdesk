// server/routes/businessHours.js
const express = require('express');
const router = express.Router();
const {
  getBusinessHours,
  updateBusinessHours
} = require('../controllers/businessHoursController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');

router.use(requireAuth);

router.get('/', getBusinessHours);
router.put('/', requireRole('ADMIN'), updateBusinessHours);

module.exports = router;
