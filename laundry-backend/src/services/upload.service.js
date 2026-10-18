const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// laundry-backend/uploads, whatever folder the server is started from (app.js serves it at /uploads)
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const uploadError = (message) => Object.assign(new Error(message), { statusCode: 422 });

/**
 * Saves a base64 data URL image (as the apps send it, e.g. "data:image/jpeg;base64,...") under uploads/<folder>
 * and returns its public path (/uploads/<folder>/<file>).
 */
const saveDataUrlImage = async (dataUrl, folder, prefix = 'img') => {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
  if (!match) throw uploadError('Photo must be a JPEG, PNG or WebP image');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0) throw uploadError('Photo is empty');
  if (bytes.length > MAX_IMAGE_BYTES) throw uploadError('Photo is too large (max 5 MB)');

  const dir = path.join(UPLOADS_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  const name = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${TYPES[match[1]]}`;
  await fs.writeFile(path.join(dir, name), bytes);
  return `/uploads/${folder}/${name}`;
};

/** Absolute file path of a public /uploads/... path (for deleting a saved upload) */
const uploadedFilePath = (publicPath) => path.join(UPLOADS_DIR, String(publicPath).replace(/^\/uploads\//, ''));

module.exports = { saveDataUrlImage, uploadedFilePath, UPLOADS_DIR, MAX_IMAGE_BYTES };
