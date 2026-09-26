import { Router } from 'express';
import { db } from '../db.js';
import { newId } from '../crypto.js';
import { authRequired } from '../middleware/auth.js';
import { err, asyncHandler, paginate, pageEnvelope } from '../utils/http.js';
import { add, balance } from '../services/credits.js';

const WEB_URL = (process.env.WEB_URL || 'http://localhost:5173').replace(/\/$/, '');

// ---- /referral ----
export const referralRouter = Router();
referralRouter.use(authRequired);

// GET /referral/me
referralRouter.get('/me', asyncHandler(async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const referredCount = db.prepare('SELECT COUNT(*) AS c FROM referrals WHERE referrer_id = ?').get(req.user.id).c;
  const earned = db.prepare(
    "SELECT COALESCE(SUM(delta), 0) AS total FROM credit_ledger WHERE user_id = ? AND reason = 'referral'"
  ).get(req.user.id).total;
  return res.json({
    code: user.referral_code,
    url: `${WEB_URL}/register?ref=${user.referral_code}`,
    referredCount,
    earnedCredits: earned,
  });
}));

// ---- /redeem ----
export const redeemRouter = Router();
redeemRouter.use(authRequired);

// POST /redeem
redeemRouter.post('/', asyncHandler(async (req, res) => {
  const { code } = req.body || {};
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return err(res, 422, 'VALIDATION_ERROR', 'Please enter a redeem code.');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (normalized === user.referral_code) {
    return err(res, 422, 'VALIDATION_ERROR', 'You cannot redeem your own referral code.');
  }

  const row = db.prepare('SELECT * FROM redeem_codes WHERE code = ? AND active = 1').get(normalized);
  if (!row) return err(res, 422, 'VALIDATION_ERROR', 'This code is invalid or has expired.');
  if (row.uses >= row.max_uses) {
    return err(res, 422, 'VALIDATION_ERROR', 'This code has already been fully redeemed.');
  }
  const already = db.prepare('SELECT 1 FROM redeem_history WHERE user_id = ? AND code = ?')
    .get(req.user.id, normalized);
  if (already) return err(res, 422, 'VALIDATION_ERROR', 'You have already redeemed this code.');

  db.prepare('UPDATE redeem_codes SET uses = uses + 1 WHERE code = ?').run(normalized);
  db.prepare('INSERT INTO redeem_history (id, user_id, code, credits_added, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(newId('rh_'), req.user.id, normalized, row.credits, new Date().toISOString());
  add({ userId: req.user.id, delta: row.credits, reason: 'redeem', ref: normalized });

  return res.json({ ok: true, creditsAdded: row.credits, credits: balance(req.user.id) });
}));

// GET /redeem/history
redeemRouter.get('/history', asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req);
  const total = db.prepare('SELECT COUNT(*) AS c FROM redeem_history WHERE user_id = ?').get(req.user.id).c;
  const rows = db.prepare(
    'SELECT id, code, credits_added AS creditsAdded, created_at AS createdAt FROM redeem_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(req.user.id, limit, offset);
  return res.json({ data: rows, ...pageEnvelope(total, page, limit) });
}));
