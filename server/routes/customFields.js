const express = require('express');
const router = express.Router();
const {
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
} = require('../controllers/customFieldController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate, createCustomFieldValidation } = require('../middleware/validate');

// All routes require authentication
router.use(requireAuth);

// GET /api/custom-fields - Get all custom fields
router.get('/', getCustomFields);

// POST /api/custom-fields - Create custom field (ADMIN only)
router.post('/', requireRole('ADMIN'), validate(createCustomFieldValidation), createCustomField);

// PUT /api/custom-fields/:id - Update custom field (ADMIN only)
router.put('/:id', requireRole('ADMIN'), updateCustomField);

// DELETE /api/custom-fields/:id - Delete custom field (ADMIN only)
router.delete('/:id', requireRole('ADMIN'), deleteCustomField);

module.exports = router;
