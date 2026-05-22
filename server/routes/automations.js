const express = require('express');
const router = express.Router();
const {
  getAutomations,
  createAutomation,
  updateAutomation,
  toggleAutomation,
  deleteAutomation,
  testAutomationEndpoint,
} = require('../controllers/automationController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');

router.use(requireAuth);
router.use(requireRole('ADMIN'));

router.get('/', getAutomations);
router.post('/', createAutomation);
router.put('/:id', updateAutomation);
router.patch('/:id/toggle', toggleAutomation);
router.delete('/:id', deleteAutomation);
router.post('/:id/test', testAutomationEndpoint);

module.exports = router;
