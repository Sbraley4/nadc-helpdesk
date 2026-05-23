const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth');
const {
  getMaterialEntries,
  createMaterialEntry,
  updateMaterialEntry,
  deleteMaterialEntry,
} = require('../controllers/materialEntryController');

// All routes require authentication
router.use(requireAuth);

// GET /api/tickets/:ticketId/materials
router.get('/', getMaterialEntries);

// POST /api/tickets/:ticketId/materials
router.post('/', createMaterialEntry);

// PUT /api/tickets/:ticketId/materials/:entryId
router.put('/:entryId', updateMaterialEntry);

// DELETE /api/tickets/:ticketId/materials/:entryId
router.delete('/:entryId', deleteMaterialEntry);

module.exports = router;
