import { Router } from 'express';
import multer from 'multer';
import probe from 'probe-image-size';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db.js';
import { newId } from '../crypto.js';
import { authRequired } from '../middleware/auth.js';
import { uploadsLimiter } from '../middleware/rateLimit.js';
import { err, asyncHandler } from '../utils/http.js';

const router = Router();

const MAX_MB = Number(process.env.MAX_UPLOAD_MB) || 100;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './data/uploads';
const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
});

function uploadToJson(row) {
  const ext = ALLOWED[row.mime_type] || 'bin';
  return {
    id: row.id,
    url: `/uploads/${row.user_id}/${row.id}.${ext}`,
    mimeType: row.mime_type,
    size: row.size,
    width: row.width,
    height: row.height,
  };
}

// POST /uploads — multipart, field "file"
router.post('/', authRequired, uploadsLimiter, (req, res, next) => {
  upload.single('file')(req, res, (multerErr) => {
    if (multerErr) {
      if (multerErr.code === 'LIMIT_FILE_SIZE') {
        return err(res, 413, 'FILE_TOO_LARGE', `Images must be smaller than ${MAX_MB} MB.`);
      }
      return err(res, 400, 'VALIDATION_ERROR', 'The upload could not be read. Please try again.');
    }
    next();
  });
}, asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return err(res, 422, 'VALIDATION_ERROR', 'Please choose an image file to upload.');
  }
  // Validate magic bytes + dimensions (not just the extension).
  let info = null;
  try {
    info = probe.sync(req.file.buffer);
  } catch {
    info = null;
  }
  const mime = info?.mime;
  const ext = mime ? ALLOWED[mime] : null;
  if (!info || !ext) {
    return err(res, 415, 'UNSUPPORTED_FILE_TYPE', 'Only JPEG, PNG, and WebP images are supported.');
  }

  const id = newId('up_');
  const userDir = path.join(path.resolve(UPLOAD_DIR), req.user.id);
  fs.mkdirSync(userDir, { recursive: true });
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(userDir, filename), req.file.buffer);

  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO uploads (id, user_id, filename, mime_type, size, width, height, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.user.id, req.file.originalname || filename, mime, req.file.buffer.length,
    info.width || null, info.height || null, path.join(userDir, filename), now);

  const row = db.prepare('SELECT * FROM uploads WHERE id = ?').get(id);
  return res.status(201).json(uploadToJson(row));
}));

// DELETE /uploads/:id (owner only)
router.delete('/:id', authRequired, asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!row) return err(res, 404, 'NOT_FOUND', 'Upload not found.');
  try { fs.unlinkSync(row.path); } catch { /* file may already be gone */ }
  db.prepare('DELETE FROM uploads WHERE id = ?').run(row.id);
  return res.json({ ok: true });
}));

export default router;
