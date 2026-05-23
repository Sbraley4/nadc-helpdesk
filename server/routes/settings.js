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

// GET /api/settings/full - Get all settings with descriptions (MUST be before /:key)
router.get('/full', getSettingsFull);

// GET /api/settings/email-preview - Preview email template (MUST be before /:key)
router.get('/email-preview', previewEmailTemplate);

// POST /api/settings/test-email - Test SMTP connection (MUST be before /:key)
router.post('/test-email', testEmail);

// POST /api/settings/test-imap - Test IMAP connection (MUST be before /:key)
router.post('/test-imap', testImap);

// POST /api/settings/reset - Reset all settings to defaults (MUST be before /:key)
router.post('/reset', resetSettings);

// PUT /api/settings - Bulk update settings
router.put('/', updateSettings);

// PATCH /api/settings/:key - Update single setting (MUST be LAST - catches all other paths)
router.patch('/:key', updateSetting);

module.exports = router;
