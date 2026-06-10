const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const importController = require('../controllers/importController');

const router = express.Router();

// Configure multer for memory storage (CSV files are small)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV files only
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
});

// All routes require admin authentication
router.use(requireAuth, (req, res, next) => { if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' }); next(); });

// Preview CSV file
router.post('/preview', upload.single('file'), importController.previewCSV);

// Import companies
router.post('/companies', upload.single('file'), importController.importCompanies);

// Import contacts
router.post('/contacts', upload.single('file'), importController.importContacts);

// Import tickets
router.post('/tickets', upload.single('file'), importController.importTickets);

module.exports = router;
