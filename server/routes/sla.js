const express = require('express');
const router = express.Router();
const {
  getSLAPolicies,
  createSLAPolicy,
  updateSLAPolicy,
  deleteSLAPolicy,
} = require('../controllers/slaController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate, createSLAPolicyValidation } = require('../middleware/validate');

// All routes require authentication
router.use(requireAuth);

// GET /api/sla-policies - Get all SLA policies
router.get('/', getSLAPolicies);

// POST /api/sla-policies - Create SLA policy (ADMIN only)
router.post('/', requireRole('ADMIN'), validate(createSLAPolicyValidation), createSLAPolicy);

// PUT /api/sla-policies/:id - Update SLA policy (ADMIN only)
router.put('/:id', requireRole('ADMIN'), updateSLAPolicy);

// DELETE /api/sla-policies/:id - Delete SLA policy (ADMIN only)
router.delete('/:id', requireRole('ADMIN'), deleteSLAPolicy);

module.exports = router;
