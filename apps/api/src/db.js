import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATABASE_PATH = process.env.DATABASE_PATH || './data/app.db';
fs.mkdirSync(path.dirname(path.resolve(DATABASE_PATH)), { recursive: true });

export const db = new DatabaseSync(DATABASE_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  referral_code TEXT NOT NULL UNIQUE,
  referred_by TEXT,
  profile_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, provider),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  default_platform TEXT NOT NULL DEFAULT 'adobe_stock',
  theme TEXT NOT NULL DEFAULT 'dark',
  default_provider TEXT NOT NULL DEFAULT 'mock',
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  input_json TEXT NOT NULL,
  output_json TEXT,
  error TEXT,
  credits_used INTEGER NOT NULL DEFAULT 0,
  byok INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  model TEXT,
  duration_ms INTEGER,
  idempotency_key TEXT UNIQUE,
  batch_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  total INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  job_id TEXT,
  ref TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ledger_user_created ON credit_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  referee_id TEXT NOT NULL UNIQUE,
  credits_granted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(referee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS redeem_codes (
  code TEXT PRIMARY KEY,
  credits INTEGER NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS redeem_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  credits_added INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, code),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS task_completions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  UNIQUE(user_id, task_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title_min INTEGER,
  title_max INTEGER,
  keyword_min INTEGER,
  keyword_max INTEGER,
  keyword_type TEXT NOT NULL DEFAULT 'mixed',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS billing_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  interval TEXT,
  credits_per_month INTEGER,
  credits_per_day INTEGER,
  features_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS daily_grants (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, day),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

export function migrate() {
  db.exec(SCHEMA);
  seed();
}

function seed() {
  const now = new Date().toISOString();

  // --- Task center ---
  const tasks = [
    ['complete-profile', 'Complete your profile', 'Add your display name in account settings.', 2],
    ['connect-provider', 'Connect an AI provider', 'Save your own API key in Settings to unlock bring-your-own-key generation.', 3],
    ['first-generation', 'Run your first generation', 'Generate a prompt or metadata set from any image.', 2],
    ['invite-friend', 'Invite a friend', 'Share your referral link and earn credits when someone signs up.', 5],
  ];
  const insTask = db.prepare(
    'INSERT INTO tasks (id, title, description, credits, active) VALUES (?, ?, ?, ?, 1) ON CONFLICT(id) DO NOTHING'
  );
  for (const [id, title, description, creditsReward] of tasks) {
    insTask.run(id, title, description, creditsReward);
  }

  // --- Marketplace platforms (per-marketplace submission rules) ---
  const platforms = [
    ['adobe_stock', 'Adobe Stock', 20, 70, 30, 50, 'mixed',
      'Titles should be 20–70 characters. Attach 30–50 relevant keywords.'],
    ['shutterstock', 'Shutterstock', null, 200, 25, 50, 'mixed',
      'Titles up to 200 characters. Attach 25–50 relevant keywords.'],
    ['vecteezy', 'Vecteezy', 10, 150, 10, 50, 'mixed',
      'Titles 10–150 characters. Attach 10–50 relevant keywords.'],
    ['depositphotos', 'Depositphotos', 10, 200, 10, 50, 'mixed',
      'Titles 10–200 characters. Attach 10–50 relevant keywords.'],
    ['123rf', '123RF', 10, 200, 5, 50, 'mixed',
      'Titles 10–200 characters. Attach 5–50 relevant keywords.'],
    ['dreamstime', 'Dreamstime', 20, 200, 10, 50, 'mixed',
      'Titles 20–200 characters. Attach 10–50 relevant keywords.'],
    ['general', 'General', null, null, null, null, 'mixed',
      'No marketplace limits — a balanced title, keywords, and description.'],
  ];
  const insPlat = db.prepare(
    'INSERT INTO platforms (id, name, title_min, title_max, keyword_min, keyword_max, keyword_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING'
  );
  for (const p of platforms) insPlat.run(...p);

  // --- Billing plans ---
  const plans = [
    ['free', 'Free', 0, 'BDT', null, null, 5,
      JSON.stringify(['Daily free credits', 'All generation tools', 'Bring your own API key'])],
    ['newbie', 'Newbie', 49, 'BDT', 'month', 30, null,
      JSON.stringify(['30 credits every month', 'All marketplaces', 'Keyword chips + CSV export', 'Bring your own API key', 'Credits reset monthly'])],
    ['pro', 'Pro', 99, 'BDT', 'month', 60, null,
      JSON.stringify(['60 credits every month', 'Everything in Newbie', 'Batch processing', 'Custom prompts', 'Priority queue'])],
  ];
  const insPlan = db.prepare(
    'INSERT INTO billing_plans (id, name, price, currency, interval, credits_per_month, credits_per_day, features_json, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(id) DO NOTHING'
  );
  for (const p of plans) insPlan.run(...p);

  // --- Demo redeem codes ---
  const codes = [
    ['WELCOME10', 10, 1000, 'Welcome bonus — 10 free credits'],
    ['LAUNCH25', 25, 500, 'Launch bonus — 25 free credits'],
  ];
  const insCode = db.prepare(
    'INSERT INTO redeem_codes (code, credits, max_uses, uses, active, note, created_at) VALUES (?, ?, ?, 0, 1, ?, ?) ON CONFLICT(code) DO NOTHING'
  );
  for (const [code, creditsAmt, maxUses, note] of codes) insCode.run(code, creditsAmt, maxUses, note, now);
}

/** Wipe all rows (tests only). */
export function wipeAll() {
  const tables = ['daily_grants', 'reviews', 'task_completions', 'redeem_history', 'referrals',
    'password_resets', 'credit_ledger', 'jobs', 'batches', 'uploads', 'provider_keys',
    'user_settings', 'users'];
  for (const t of tables) db.exec(`DELETE FROM ${t}`);
  // keep seeds (tasks/platforms/plans/codes) — delete then re-seed to be safe
  db.exec('DELETE FROM tasks; DELETE FROM platforms; DELETE FROM billing_plans; DELETE FROM redeem_codes;');
  seed();
}

migrate();
