const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Get upload directory from env, default to ./uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
const uploadPath = path.resolve(__dirname, '..', UPLOAD_DIR);
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Spreadsheets
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Text
  'text/plain',
  'text/csv',
];

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate UUID + original extension
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

// File filter for mime type validation
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('File type not allowed');
    error.statusCode = 415;
    cb(error, false);
  }
};

// Get max file size from env (in MB), convert to bytes
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10;
const maxFileSize = MAX_FILE_SIZE_MB * 1024 * 1024;

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
  },
});

// Export single file upload (field name: "file")
const uploadSingle = upload.single('file');

// Export multiple file upload (field name: "files", max 5)
const uploadMultiple = upload.array('files', 5);

// Wrapper to handle multer errors
const handleUpload = (uploadFn) => {
  return (req, res, next) => {
    uploadFn(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
              error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB`
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              error: 'Too many files. Maximum is 5 files'
            });
          }
          return res.status(400).json({ error: err.message });
        }
        // Custom error (file type not allowed)
        if (err.statusCode === 415) {
          return res.status(415).json({ error: err.message });
        }
        return res.status(500).json({ error: 'File upload failed' });
      }
      next();
    });
  };
};

module.exports = {
  uploadSingle: handleUpload(uploadSingle),
  uploadMultiple: handleUpload(uploadMultiple),
  UPLOAD_DIR: uploadPath,
};
