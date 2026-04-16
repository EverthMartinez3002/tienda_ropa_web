const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

function ensureUploadDir(uploadDirPath) {
  fs.mkdirSync(uploadDirPath, { recursive: true });
}

function createFilename(file) {
  const preferredExt = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname || '').toLowerCase() || '.bin';
  return `${Date.now()}-${crypto.randomUUID()}${preferredExt}`;
}

function createProductImageUpload(env) {
  ensureUploadDir(env.uploadDirPath);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, env.uploadDirPath),
    filename: (_req, file, cb) => cb(null, createFilename(file)),
  });

  return multer({
    storage,
    limits: { fileSize: 4 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME_TYPES[file.mimetype]) {
        return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'));
      }
      cb(null, true);
    },
  }).single('image');
}

function deleteUploadByUrl(imageUrl = '', env) {
  const value = String(imageUrl || '').trim();
  if (!value.startsWith(`${env.uploadBaseUrl}/`)) return;

  const filename = path.basename(value);
  const target = path.join(env.uploadDirPath, filename);
  if (!target.startsWith(env.uploadDirPath)) return;

  fs.promises.unlink(target).catch(() => {});
}

function imageUrlFromFile(file, env) {
  return `${env.uploadBaseUrl}/${file.filename}`;
}

module.exports = {
  ALLOWED_MIME_TYPES,
  ensureUploadDir,
  createProductImageUpload,
  deleteUploadByUrl,
  imageUrlFromFile,
};
