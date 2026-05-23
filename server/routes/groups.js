const express = require('express');
const router = express.Router();
const { getGroups, createGroup } = require('../controllers/agentController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate, createGroupValidation } = require('../middleware/validate');

// All routes require authentication
router.use(requireAuth);

// GET /api/groups - Get all groups with members
router.get('/', getGroups);

// POST /api/groups - Create group (ADMIN only)
router.post(
  '/',
  requireRole('ADMIN'),
  validate(createGroupValidation),
  createGroup
);

module.exports = router;
