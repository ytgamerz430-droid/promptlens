import { Router } from 'express';
import { db } from '../db.js';
import { newId } from '../crypto.js';
import { authRequired } from '../middleware/auth.js';
import { err, asyncHandler, paginate, pageEnvelope } from '../utils/http.js';

const router = Router();

// GET /reviews/summary — public
router.get('/summary', asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS avg FROM reviews').get();
  return res.json({
    average: Math.round(Number(row.avg) * 10) / 10,
    count: row.count,
  });
}));

// GET /reviews — public, paginated
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req);
  const total = db.prepare('SELECT COUNT(*) AS c FROM reviews').get().c;
  const rows = db.prepare(
    'SELECT id, name, rating, comment, created_at AS createdAt FROM reviews ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
  return res.json({ data: rows, ...pageEnvelope(total, page, limit) });
}));

// GET /reviews/me — the caller's own review, if any
router.get('/me', authRequired, asyncHandler(async (req, res) => {
  const row = db.prepare(
    'SELECT id, name, rating, comment, created_at AS createdAt FROM reviews WHERE user_id = ?'
  ).get(req.user.id);
  return res.json({ review: row || null });
}));

// POST /reviews — one per user (updates the existing one)
router.post('/', authRequired, asyncHandler(async (req, res) => {
  const { rating, comment } = req.body || {};
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return err(res, 422, 'VALIDATION_ERROR', 'Rating must be a number between 1 and 5.');
  }
  if (typeof comment !== 'string' || !comment.trim() || comment.trim().length > 2000) {
    return err(res, 422, 'VALIDATION_ERROR', 'Please write a short review comment.');
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM reviews WHERE user_id = ?').get(req.user.id);
  if (existing) {
    db.prepare('UPDATE reviews SET rating = ?, comment = ?, updated_at = ? WHERE id = ?')
      .run(r, comment.trim(), now, existing.id);
  } else {
    db.prepare(
      'INSERT INTO reviews (id, user_id, name, rating, comment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(newId('rev_'), req.user.id, user.name, r, comment.trim(), now, now);
  }
  const row = db.prepare(
    'SELECT id, name, rating, comment, created_at AS createdAt FROM reviews WHERE user_id = ?'
  ).get(req.user.id);
  return res.status(201).json({ review: row });
}));

export default router;
