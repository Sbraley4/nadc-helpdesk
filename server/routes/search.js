// server/routes/search.js
const express = require('express');
const router = express.Router();
const { globalSearch } = require('../controllers/searchController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', globalSearch);

module.exports = router;
