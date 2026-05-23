const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth');
const {
  getChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  reorderChecklist,
} = require('../controllers/checklistController');

// All routes require authentication
router.use(requireAuth);

// GET /api/tickets/:ticketId/checklist
router.get('/', getChecklist);

// POST /api/tickets/:ticketId/checklist
router.post('/', addChecklistItem);

// PUT /api/tickets/:ticketId/checklist/reorder - must come before /:itemId
router.put('/reorder', reorderChecklist);

// PUT /api/tickets/:ticketId/checklist/:itemId
router.put('/:itemId', updateChecklistItem);

// DELETE /api/tickets/:ticketId/checklist/:itemId
router.delete('/:itemId', deleteChecklistItem);

module.exports = router;
