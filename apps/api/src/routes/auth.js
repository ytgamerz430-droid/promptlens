import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { newId, referralCode, randomToken, sha256Hex } from '../crypto.js';
import { signToken, authRequired } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { err, asyncHandler } from '../utils/http.js';
import { validateRegister, validatePassword, isEmail } from '../utils/validate.js';
import { balance, add, ensureDailyGrant, SIGNUP_CREDITS, REFERRAL_CREDITS } from '../services/credits.js';
import { sendPasswordReset } from '../utils/email.js';

const router = Router();
router.use(authLimiter);

function userToJson(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    plan: row.plan,
    credits: balance(row.id),
    referralCode: row.referral_code,
    createdAt: row.created_at,
  };
}

function createUser({ name, email, passwordHash = null, googleId = null, referredBy = null }) {
  const now = new Date().toISOString();
  const id = newId('u_');
  let code = referralCode();
  while (db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(code)) code = referralCode();
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, google_id, plan, referral_code, referred_by, profile_completed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'free', ?, ?, ?, ?, ?)`
  ).run(id, name.trim(), email.trim().toLowerCase(), passwordHash, googleId, code,
    referredBy, googleId ? 1 : 0, now, now);
  db.prepare(
    'INSERT INTO user_settings (user_id, default_platform, theme, default_provider, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, 'adobe_stock', 'dark', process.env.DEFAULT_PROVIDER || 'mock', now);
  add({ userId: id, delta: SIGNUP_CREDITS, reason: 'signup_bonus' });
  ensureDailyGrant(id);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function applyReferral(newUser, code) {
  if (!code) return;
  const referrer = db.prepare('SELECT * FROM users WHERE referral_code = ?').get(String(code).toUpperCase());
  if (!referrer || referrer.id === newUser.id) return;
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrer.id, newUser.id);
  db.prepare('INSERT INTO referrals (id, referrer_id, referee_id, credits_granted, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(newId('ref_'), referrer.id, newUser.id, REFERRAL_CREDITS, now);
  add({ userId: referrer.id, delta: REFERRAL_CREDITS, reason: 'referral', ref: newUser.id });
  add({ userId: newUser.id, delta: REFERRAL_CREDITS, reason: 'referral', ref: referrer.id });
}

// POST /auth/register
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, referredBy } = req.body || {};
  validateRegister({ name, email, password });
  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (exists) return err(res, 422, 'VALIDATION_ERROR', 'This email is already registered. Try signing in instead.');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = createUser({ name, email, passwordHash });
  applyReferral(user, referredBy);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  return res.status(201).json({ token: signToken(user.id), user: userToJson(fresh) });
}));

// POST /auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!isEmail(email) || typeof password !== 'string') {
    return err(res, 401, 'UNAUTHORIZED', 'Invalid email or password.');
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !user.password_hash) {
    return err(res, 401, 'UNAUTHORIZED', 'Invalid email or password.');
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return err(res, 401, 'UNAUTHORIZED', 'Invalid email or password.');
  ensureDailyGrant(user.id);
  return res.json({ token: signToken(user.id), user: userToJson(user) });
}));

// POST /auth/logout (stateless JWT — the client discards the token)
router.post('/logout', (req, res) => res.json({ ok: true }));

// GET /auth/me
router.get('/me', authRequired, asyncHandler(async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return err(res, 401, 'UNAUTHORIZED', 'Authentication is required.');
  return res.json({ user: userToJson(user) });
}));

// PATCH /auth/me
router.patch('/me', authRequired, asyncHandler(async (req, res) => {
  const { name } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2) {
    return err(res, 422, 'VALIDATION_ERROR', 'Please enter your name (at least 2 characters).');
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET name = ?, profile_completed = 1, updated_at = ? WHERE id = ?')
    .run(name.trim(), now, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  return res.json({ user: userToJson(user) });
}));

// POST /auth/password
router.post('/password', authRequired, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user?.password_hash) {
    return err(res, 422, 'VALIDATION_ERROR', 'This account does not use a password. Use your sign-in provider instead.');
  }
  const ok = await bcrypt.compare(String(currentPassword || ''), user.password_hash);
  if (!ok) return err(res, 401, 'UNAUTHORIZED', 'Your current password is incorrect.');
  validatePassword(newPassword);
  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(hash, new Date().toISOString(), req.user.id);
  return res.json({ ok: true });
}));

// POST /auth/forgot-password — always 200 (no account enumeration)
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (isEmail(email)) {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (user && user.password_hash) {
      const raw = randomToken(32);
      const now = new Date().toISOString();
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);
      db.prepare(
        'INSERT INTO password_resets (id, user_id, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)'
      ).run(newId('pr_'), user.id, sha256Hex(raw), expires, now);
      await sendPasswordReset(user.email, user.name, raw);
    }
  }
  return res.json({ ok: true });
}));

// POST /auth/reset-password
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};
  validatePassword(password);
  if (typeof token !== 'string' || !token) {
    return err(res, 422, 'VALIDATION_ERROR', 'The reset link is invalid or has expired.');
  }
  const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used = 0')
    .get(sha256Hex(token));
  if (!row || row.expires_at < new Date().toISOString()) {
    return err(res, 422, 'VALIDATION_ERROR', 'The reset link is invalid or has expired.');
  }
  const hash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(hash, new Date().toISOString(), row.user_id);
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(row.id);
  return res.json({ ok: true });
}));

// GET /auth/google/url
router.get('/google/url', (req, res) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URL } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URL) {
    return err(res, 501, 'PROVIDER_NOT_CONFIGURED',
      'Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.');
  }
  const state = randomToken(16);
  oauthStates.set(state, Date.now() + 10 * 60 * 1000);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'online');
  return res.json({ url: url.toString() });
});

const oauthStates = new Map();

// GET /auth/google/callback
router.get('/google/callback', asyncHandler(async (req, res) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL, WEB_URL } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return err(res, 501, 'PROVIDER_NOT_CONFIGURED', 'Google sign-in is not configured yet.');
  }
  const { code, state } = req.query;
  const validUntil = oauthStates.get(String(state || ''));
  oauthStates.delete(String(state || ''));
  if (!code || !validUntil || validUntil < Date.now()) {
    return err(res, 422, 'VALIDATION_ERROR', 'The Google sign-in attempt expired. Please try again.');
  }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(code),
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URL,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !tokens?.access_token) {
    return err(res, 502, 'PROVIDER_ERROR', 'Google sign-in failed. Please try again.');
  }
  const meRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await meRes.json().catch(() => null);
  if (!meRes.ok || !profile?.sub || !profile?.email) {
    return err(res, 502, 'PROVIDER_ERROR', 'Google sign-in failed. Please try again.');
  }

  let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.sub);
  if (!user) {
    const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(String(profile.email).toLowerCase());
    if (byEmail) {
      db.prepare('UPDATE users SET google_id = ?, updated_at = ? WHERE id = ?')
        .run(profile.sub, new Date().toISOString(), byEmail.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(byEmail.id);
    } else {
      user = createUser({
        name: profile.name || String(profile.email).split('@')[0],
        email: profile.email,
        googleId: profile.sub,
      });
    }
  }
  ensureDailyGrant(user.id);
  const token = signToken(user.id);
  const wantsJson = (req.headers.accept || '').includes('application/json') || req.query.format === 'json';
  if (wantsJson) return res.json({ token, user: userToJson(user) });
  const web = (WEB_URL || 'http://localhost:5173').replace(/\/$/, '');
  return res.redirect(302, `${web}/login?token=${encodeURIComponent(token)}`);
}));

export default router;
