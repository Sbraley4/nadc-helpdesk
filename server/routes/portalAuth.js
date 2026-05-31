const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requirePortalAuth } = require('../middleware/portalAuth');
const {
  portalLogin,
  portalRefresh,
  portalMe,
  portalSetPassword,
  portalChangePassword,
  portalForgotPassword,
  portalResetPassword,
} = require('../controllers/portalAuthController');

// Public routes
router.post('/login', portalLogin);
router.post('/refresh', portalRefresh);
router.post('/forgot-password', portalForgotPassword);
router.post('/reset-password', portalResetPassword);

// Protected by agent/admin auth (for setting up portal access)
router.post('/set-password', requireAuth, portalSetPassword);

// Protected by portal auth
router.get('/me', requirePortalAuth, portalMe);
router.post('/change-password', requirePortalAuth, portalChangePassword);

module.exports = router;
