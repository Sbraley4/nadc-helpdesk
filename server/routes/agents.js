const express = require('express');
const router = express.Router();
const {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  updateAvailability,
  deleteAgent,
} = require('../controllers/agentController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const {
  validate,
  createAgentValidation,
  updateAgentValidation,
  updateAvailabilityValidation,
} = require('../middleware/validate');

// All routes require authentication
router.use(requireAuth);

// GET /api/agents - Get all agents
router.get('/', getAgents);

// GET /api/agents/:id - Get single agent
router.get('/:id', getAgent);

// POST /api/agents - Create agent (ADMIN only)
router.post(
  '/',
  requireRole('ADMIN'),
  validate(createAgentValidation),
  createAgent
);

// PUT /api/agents/:id - Update agent (ADMIN only)
router.put(
  '/:id',
  requireRole('ADMIN'),
  validate(updateAgentValidation),
  updateAgent
);

// PATCH /api/agents/:id/availability - Update availability
router.patch(
  '/:id/availability',
  validate(updateAvailabilityValidation),
  updateAvailability
);

// DELETE /api/agents/:id - Soft delete agent (ADMIN only)
router.delete('/:id', requireRole('ADMIN'), deleteAgent);

module.exports = router;
