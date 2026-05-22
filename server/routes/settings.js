const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const {
  getSettings,
  getSettingsFull,
  updateSetting,
  updateSettings,
  testEmail,
  testImap,
  previewEmailTemplate,
  resetSettings,
} = require('../controllers/settingsController');

// All routes require admin role
router.use(requireAuth);
router.use(requireRole('ADMIN'));

// GET /api/settings - Get all settings as key-value
router.get('/', getSettings);

// GET /api/settings/full - Get all settings with descriptions
router.get('/full', getSettingsFull);

// PATCH /api/settings/:key - Update single setting
router.patch('/:key', updateSetting);

// PUT /api/settings - Bulk update settings
router.put('/', updateSettings);

// POST /api/settings/test-email - Test SMTP connection
router.post('/test-email', testEmail);

// POST /api/settings/test-imap - Test IMAP connection
router.post('/test-imap', testImap);

// GET /api/settings/email-preview - Preview email template
router.get('/email-preview', previewEmailTemplate);

// POST /api/settings/reset - Reset all settings to defaults
router.post('/reset', requireRole('ADMIN'), resetSettings);

module.exports = router;
