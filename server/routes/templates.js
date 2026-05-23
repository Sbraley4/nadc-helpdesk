const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createTicketFromTemplate,
} = require('../controllers/templateController');

// All routes require authentication
router.use(requireAuth);

// GET /api/templates
router.get('/', getTemplates);

// GET /api/templates/:id
router.get('/:id', getTemplate);

// POST /api/templates - Admin or Agent
router.post('/', requireRole('ADMIN', 'AGENT'), createTemplate);

// PUT /api/templates/:id - Admin or Agent
router.put('/:id', requireRole('ADMIN', 'AGENT'), updateTemplate);

// DELETE /api/templates/:id - Admin only
router.delete('/:id', requireRole('ADMIN'), deleteTemplate);

// POST /api/templates/:id/create-ticket
router.post('/:id/create-ticket', createTicketFromTemplate);

module.exports = router;
