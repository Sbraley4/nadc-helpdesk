const express = require('express');
const router = express.Router();
const { getTags, createTag, updateTag, deleteTag } = require('../controllers/tagController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate, createTagValidation, updateTagValidation } = require('../middleware/validate');

// All routes require authentication
router.use(requireAuth);

// GET /api/tags - Get all tags
router.get('/', getTags);

// POST /api/tags - Create tag (ADMIN or AGENT)
router.post('/', requireRole('ADMIN', 'AGENT'), validate(createTagValidation), createTag);

// PUT /api/tags/:id - Update tag (ADMIN only)
router.put('/:id', requireRole('ADMIN'), validate(updateTagValidation), updateTag);

// DELETE /api/tags/:id - Delete tag (ADMIN only)
router.delete('/:id', requireRole('ADMIN'), deleteTag);

module.exports = router;
