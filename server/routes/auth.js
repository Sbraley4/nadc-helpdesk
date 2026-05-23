const express = require('express');
const router = express.Router();
const { login, refresh, logout, me } = require('../controllers/authController');
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

module.exports = router;
