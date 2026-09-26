import { db } from '../db.js';
import { newId } from '../crypto.js';
import { httpError } from '../utils/http.js';

export const SIGNUP_CREDITS = Number(process.env.SIGNUP_CREDITS) || 5;
export const DAILY_FREE_CREDITS = Number(process.env.DAILY_FREE_CREDITS) || 5;
export const REFERRAL_CREDITS = 5;

/** Current credit balance = sum of ledger deltas. */
export function balance(userId) {
  const row = db.prepare('SELECT COALESCE(SUM(delta), 0) AS total FROM credit_ledger WHERE user_id = ?').get(userId);
  return row.total;
}

export function add({ userId, delta, reason, jobId = null, ref = null }) {
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO credit_ledger (id, user_id, delta, reason, job_id, ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(newId('cr_'), userId, delta, reason, jobId, ref, now);
  return balance(userId);
}

/** Spend credits for a job. Throws 402 INSUFFICIENT_CREDITS when too low. */
export function spendForJob(userId, jobId, amount) {
  if (amount <= 0) return balance(userId);
  if (balance(userId) < amount) {
    throw httpError(402, 'INSUFFICIENT_CREDITS',
      'You do not have enough credits for this generation. Top up, redeem a code, or connect your own API key.');
  }
  return add({ userId, delta: -amount, reason: 'job_spend', jobId });
}

/** Refund a job spend (provider failures — not validation failures). */
export function refundJob(userId, jobId, amount) {
  if (amount <= 0) return balance(userId);
  return add({ userId, delta: amount, reason: 'job_refund', jobId });
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Grant the daily free allowance once per day (lazy, idempotent). */
export function ensureDailyGrant(userId) {
  const day = todayUTC();
  const existing = db.prepare('SELECT 1 FROM daily_grants WHERE user_id = ? AND day = ?').get(userId, day);
  if (existing) return false;
  db.prepare('INSERT INTO daily_grants (user_id, day, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
    .run(userId, day, new Date().toISOString());
  add({ userId, delta: DAILY_FREE_CREDITS, reason: 'daily_grant' });
  return true;
}

export function creditInfo(userId) {
  ensureDailyGrant(userId);
  const day = todayUTC();
  const row = db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN reason = 'daily_grant' THEN delta ELSE 0 END), 0) AS granted,
            COALESCE(SUM(CASE WHEN delta < 0 THEN delta ELSE 0 END), 0) AS spent
     FROM credit_ledger WHERE user_id = ? AND substr(created_at, 1, 10) = ?`
  ).get(userId, day);
  const dailyFreeRemaining = Math.max(0, row.granted + row.spent);
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return {
    balance: balance(userId),
    dailyFreeRemaining,
    resetsAt: midnight.toISOString(),
  };
}

export function ledger(userId, page, limit, offset) {
  const total = db.prepare('SELECT COUNT(*) AS c FROM credit_ledger WHERE user_id = ?').get(userId).c;
  const rows = db.prepare(
    'SELECT id, delta, reason, job_id AS jobId, ref, created_at AS createdAt FROM credit_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(userId, limit, offset);
  return { rows, total };
}
