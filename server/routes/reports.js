const express = require('express');
const router = express.Router();
const {
  getTicketVolumeReport,
  getAgentPerformanceReport,
  getSLAComplianceReport,
  getTimeAndMaterialsReport,
  exportReport,
} = require('../controllers/reportController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');

router.use(requireAuth);

router.get('/ticket-volume', getTicketVolumeReport);
router.get('/agent-performance', getAgentPerformanceReport);
router.get('/sla-compliance', getSLAComplianceReport);
router.get('/time-materials', getTimeAndMaterialsReport);
router.get('/export', requireRole('ADMIN', 'AGENT'), exportReport);

module.exports = router;
