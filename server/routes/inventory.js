const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getItems,
  createItem,
  updateItem,
  deleteItem,
} = require('../controllers/inventoryController');

// All routes require authentication
router.use(requireAuth);

// GET /api/inventory
router.get('/', getItems);

// POST /api/inventory
router.post('/', createItem);

// PUT /api/inventory/:id
router.put('/:id', updateItem);

// DELETE /api/inventory/:id
router.delete('/:id', deleteItem);

module.exports = router;
