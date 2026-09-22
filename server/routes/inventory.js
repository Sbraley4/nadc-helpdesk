const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  getPendingDeductions,
  approveDeduction,
  rejectDeduction,
  recheckDeductionMatch,
  restockItem,
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

// PATCH /api/inventory/:id/restock - quick restock
router.patch('/:id/restock', restockItem);

// Deduction routes
// GET /api/inventory/deductions - get all pending deductions
router.get('/deductions', getPendingDeductions);

// PUT /api/inventory/deductions/:id/approve - approve a deduction
router.put('/deductions/:id/approve', approveDeduction);

// PUT /api/inventory/deductions/:id/reject - reject a deduction
router.put('/deductions/:id/reject', rejectDeduction);

// PATCH /api/inventory/deductions/:id/recheck - re-run matching for a deduction
router.patch('/deductions/:id/recheck', recheckDeductionMatch);

module.exports = router;
