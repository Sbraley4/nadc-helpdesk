const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  searchCompanies,
} = require('../controllers/companyController');

// All routes require authentication
router.use(requireAuth);

// GET /api/companies/search - Search companies (typeahead) - MUST BE BEFORE /:id
router.get('/search', searchCompanies);

// GET /api/companies - List companies
router.get('/', listCompanies);

// GET /api/companies/:id - Get single company
router.get('/:id', getCompany);

// POST /api/companies - Create company
router.post('/', createCompany);

// PUT /api/companies/:id - Update company
router.put('/:id', updateCompany);

// DELETE /api/companies/:id - Delete company (ADMIN only)
router.delete('/:id', requireRole('ADMIN'), deleteCompany);

module.exports = router;
