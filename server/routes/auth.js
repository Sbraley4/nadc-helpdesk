const express = require('express');
const router = express.Router();
const {
  login,
  refresh,
  logout,
  me,
  verifySetupToken,
  setupPassword,
  changePassword,
  forgotPassword,
  verifyResetToken,
  resetPassword,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { validate, loginValidation } = require('../middleware/validate');

// POST /api/auth/login
router.post('/login', validate(loginValidation), login);

// POST /api/auth/refresh
router.post('/refresh', refresh);

// POST /api/auth/logout
router.post('/logout', requireAuth, logout);

// GET /api/auth/me
router.get('/me', requireAuth, me);

// PUT /api/auth/change-password - change password for authenticated user
router.put('/change-password', requireAuth, changePassword);

// POST /api/auth/forgot-password - request password reset email
router.post('/forgot-password', forgotPassword);

// GET /api/auth/verify-reset-token/:token - verify reset token is valid
router.get('/verify-reset-token/:token', verifyResetToken);

// POST /api/auth/reset-password - reset password using token
router.post('/reset-password', resetPassword);

// GET /api/auth/verify-setup-token/:token - verify setup token is valid
router.get('/verify-setup-token/:token', verifySetupToken);

// POST /api/auth/setup-password - set password using setup token
router.post('/setup-password', setupPassword);

module.exports = router;
