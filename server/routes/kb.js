const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requirePortalAuth } = require('../middleware/portalAuth');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  searchArticles,
} = require('../controllers/kbController');

// Middleware to optionally authenticate (agent or portal)
function optionalAnyAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(); // No auth, continue as public
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  // Try agent auth first, then portal auth
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET;
  const PORTAL_JWT_SECRET = JWT_SECRET + '_portal';

  try {
    // Try agent token
    const agentPayload = jwt.verify(token, JWT_SECRET);
    req.user = { id: agentPayload.userId, role: agentPayload.role };
    return next();
  } catch (e) {
    // Not an agent token, try portal
    try {
      const portalPayload = jwt.verify(token, PORTAL_JWT_SECRET);
      if (portalPayload.type === 'portal') {
        req.contact = { id: portalPayload.contactId, email: portalPayload.email };
      }
    } catch (e2) {
      // Invalid token, continue as public
    }
    return next();
  }
}

// ============================================================================
// PUBLIC/PORTAL ROUTES (read-only, published articles only unless agent)
// ============================================================================

// GET /api/kb/categories - List categories
router.get('/categories', optionalAnyAuth, getCategories);

// GET /api/kb/categories/:slug - Get category with articles
router.get('/categories/:slug', optionalAnyAuth, getCategory);

// GET /api/kb/articles - List articles
router.get('/articles', optionalAnyAuth, getArticles);

// GET /api/kb/articles/:slug - Get single article
router.get('/articles/:slug', optionalAnyAuth, getArticle);

// GET /api/kb/search - Search articles
router.get('/search', optionalAnyAuth, searchArticles);

// ============================================================================
// AGENT-ONLY ROUTES (full CRUD)
// ============================================================================

// POST /api/kb/categories - Create category
router.post('/categories', requireAuth, createCategory);

// PUT /api/kb/categories/:id - Update category
router.put('/categories/:id', requireAuth, updateCategory);

// DELETE /api/kb/categories/:id - Delete category
router.delete('/categories/:id', requireAuth, deleteCategory);

// POST /api/kb/articles - Create article
router.post('/articles', requireAuth, createArticle);

// PUT /api/kb/articles/:id - Update article
router.put('/articles/:id', requireAuth, updateArticle);

// DELETE /api/kb/articles/:id - Delete article
router.delete('/articles/:id', requireAuth, deleteArticle);

module.exports = router;
