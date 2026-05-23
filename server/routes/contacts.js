const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  searchContacts,
} = require('../controllers/contactController');

// All routes require authentication
router.use(requireAuth);

// GET /api/contacts/search - Search contacts (typeahead) - MUST BE BEFORE /:id
router.get('/search', searchContacts);

// GET /api/contacts - List contacts
router.get('/', listContacts);

// GET /api/contacts/:id - Get single contact
router.get('/:id', getContact);

// POST /api/contacts - Create contact
router.post('/', createContact);

// PUT /api/contacts/:id - Update contact
router.put('/:id', updateContact);

// DELETE /api/contacts/:id - Delete contact (ADMIN only)
router.delete('/:id', requireRole('ADMIN'), deleteContact);

module.exports = router;
