const fs = require('fs');
const path = require('path');

// Get upload directory from env, default to ./uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const uploadPath = path.resolve(__dirname, '..', UPLOAD_DIR);

/**
 * Delete a file from the uploads folder
 * @param {string} storedName - The stored filename (UUID + extension)
 */
function deleteFile(storedName) {
  const filePath = path.join(uploadPath, storedName);

  // Silently ignore if file doesn't exist
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error(`Failed to delete file ${storedName}:`, error.message);
    }
  }
}

/**
 * Get the public URL path for a file
 * @param {string} storedName - The stored filename
 * @returns {string} The public URL path
 */
function getFileUrl(storedName) {
  return `/uploads/${storedName}`;
}

/**
 * Format file size to human-readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} Human-readable size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  // Round to 2 decimal places for KB and above
  if (i === 0) {
    return `${bytes} Bytes`;
  }
  return `${size.toFixed(i > 1 ? 2 : 0)} ${sizes[i]}`;
}

module.exports = {
  deleteFile,
  getFileUrl,
  formatFileSize,
};
