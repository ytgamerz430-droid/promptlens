import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolated env BEFORE any app module loads.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-api-test-'));
process.env.DATABASE_PATH = path.join(tmp, 'test.db');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.SESSION_SECRET = 'test-secret-0123456789abcdef';
process.env.DEFAULT_PROVIDER = 'mock';
process.env.SIGNUP_CREDITS = '5';
process.env.DAILY_FREE_CREDITS = '5';

const { db } = await import('../src/db.js');
const cryptoMod = await import('../src/crypto.js');
const credits = await import('../src/services/credits.js');
const providers = await import('../src/services/providers.js');
const jobsSvc = await import('../src/services/jobs.js');
const queue = await import('../src/services/queue.js');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let userCounter = 0;

function makeUser() {
  userCounter += 1;
  const now = new Date().toISOString();
  const id = cryptoMod.newId('u_');
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, plan, referral_code, referred_by, profile_completed, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'free', ?, NULL, 0, ?, ?)`
  ).run(id, `Test User ${userCounter}`, `test${userCounter}@example.com`, 'hash', `REF${userCounter}T`, now, now);
  db.prepare(
    'INSERT INTO user_settings (user_id, default_platform, theme, default_provider, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, 'adobe_stock', 'dark', 'mock', now);
  return id;
}

function makeUpload(userId) {
  const id = cryptoMod.newId('up_');
  const dir = path.join(process.env.UPLOAD_DIR, userId);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${id}.png`);
  fs.writeFileSync(filePath, TINY_PNG);
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO uploads (id, user_id, filename, mime_type, size, width, height, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, userId, 'tiny.png', 'image/png', TINY_PNG.length, 1, 1, filePath, now);
  return id;
}

before(() => {
  // Failing stub provider to exercise the refund path.
  providers.registerProvider('failing', {
    defaultModel: 'failing-1',
    create() {
      return {
        async generateVision() {
          const e = new Error('Simulated provider outage');
          e.status = 502; e.code = 'PROVIDER_ERROR';
          throw e;
        },
        async testConnection() { return { ok: false, error: 'down' }; },
      };
    },
  });
});

test('job creation deducts exactly 1 credit', () => {
  const userId = makeUser();
  credits.add({ userId, delta: 10, reason: 'signup_bonus' });
  // Non-mock provider with a stored key: cost = 1 (mock jobs cost 0).
  const now = new Date().toISOString();
  db.prepare('UPDATE user_settings SET default_provider = ? WHERE user_id = ?').run('failing', userId);
  db.prepare(
    'INSERT INTO provider_keys (id, user_id, provider, encrypted, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(cryptoMod.newId('pk_'), userId, 'failing', cryptoMod.encrypt('dummy-key'), 'failing-1', now, now);
  const uploadId = makeUpload(userId);
  const beforeBal = credits.balance(userId);
  const { job, deduped } = jobsSvc.createJob({ userId, tool: 'prompt', input: { uploadId }, enqueue: false });
  assert.equal(deduped, false);
  assert.equal(job.status, 'queued');
  assert.equal(job.creditsUsed, 1);
  assert.equal(job.byok, false);
  assert.equal(credits.balance(userId), beforeBal - 1);
});

test('mock provider job runs to completed with a prompt output', async () => {
  const userId = makeUser();
  credits.add({ userId, delta: 10, reason: 'signup_bonus' });
  const uploadId = makeUpload(userId);
  const { job } = jobsSvc.createJob({ userId, tool: 'prompt', input: { uploadId }, enqueue: false });
  await queue.processJob(job.id);
  const done = jobsSvc.getJobRow(job.id);
  assert.equal(done.status, 'completed');
  assert.equal(done.progress, 100);
  const out = JSON.parse(done.output_json);
  assert.ok(out.prompt && out.prompt.length > 10, 'expected prompt text');
  assert.equal(done.provider, 'mock');
});

test('provider failure marks job failed and refunds the credit', async () => {
  const userId = makeUser();
  credits.add({ userId, delta: 10, reason: 'signup_bonus' });
  db.prepare('UPDATE user_settings SET default_provider = ? WHERE user_id = ?').run('failing', userId);
  // The failing provider has no key and is not mock -> creation must 501 before charging.
  assert.throws(
    () => jobsSvc.createJob({ userId, tool: 'prompt', input: { uploadId: makeUpload(userId) }, enqueue: false }),
    (e) => e.code === 'PROVIDER_NOT_CONFIGURED' && e.status === 501
  );

  // Give it a key so creation succeeds, then fail at generation time -> refund.
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO provider_keys (id, user_id, provider, encrypted, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(cryptoMod.newId('pk_'), userId, 'failing', cryptoMod.encrypt('dummy-key'), 'failing-1', now, now);

  const beforeBal = credits.balance(userId);
  const { job } = jobsSvc.createJob({ userId, tool: 'prompt', input: { uploadId: makeUpload(userId) }, enqueue: false });
  assert.equal(credits.balance(userId), beforeBal - 1);
  await queue.processJob(job.id);
  const done = jobsSvc.getJobRow(job.id);
  assert.equal(done.status, 'failed');
  assert.ok(done.error && done.error.length > 0);
  assert.equal(credits.balance(userId), beforeBal, 'credit should be refunded on provider failure');
});

test('idempotency key returns the original job without double-charging', () => {
  const userId = makeUser();
  credits.add({ userId, delta: 10, reason: 'signup_bonus' });
  const uploadId = makeUpload(userId);
  const key = `idem-${Date.now()}`;
  const first = jobsSvc.createJob({ userId, tool: 'prompt', input: { uploadId }, idempotencyKey: key, enqueue: false });
  const balAfterFirst = credits.balance(userId);
  const second = jobsSvc.createJob({ userId, tool: 'prompt', input: { uploadId }, idempotencyKey: key, enqueue: false });
  assert.equal(second.deduped, true);
  assert.equal(second.job.id, first.job.id);
  assert.equal(credits.balance(userId), balAfterFirst, 'no second charge for duplicate key');
});

test('insufficient credits -> 402 and no job is created', () => {
  const userId = makeUser(); // no credits granted
  const now = new Date().toISOString();
  // Use a non-mock provider (mock jobs cost 0) with a stored key so cost = 1.
  db.prepare('UPDATE user_settings SET default_provider = ? WHERE user_id = ?').run('failing', userId);
  db.prepare(
    'INSERT INTO provider_keys (id, user_id, provider, encrypted, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(cryptoMod.newId('pk_'), userId, 'failing', cryptoMod.encrypt('dummy-key'), 'failing-1', now, now);
  const uploadId = makeUpload(userId);
  const before = db.prepare('SELECT COUNT(*) AS c FROM jobs WHERE user_id = ?').get(userId).c;
  assert.throws(
    () => jobsSvc.createJob({ userId, tool: 'prompt', input: { uploadId }, enqueue: false }),
    (e) => e.code === 'INSUFFICIENT_CREDITS' && e.status === 402
  );
  const after = db.prepare('SELECT COUNT(*) AS c FROM jobs WHERE user_id = ?').get(userId).c;
  assert.equal(after, before);
});

test('validation failure charges nothing', () => {
  const userId = makeUser();
  credits.add({ userId, delta: 10, reason: 'signup_bonus' });
  const beforeBal = credits.balance(userId);
  assert.throws(
    () => jobsSvc.createJob({ userId, tool: 'prompt', input: { uploadId: 'up_doesnotexist' }, enqueue: false }),
    (e) => e.code === 'VALIDATION_ERROR'
  );
  assert.equal(credits.balance(userId), beforeBal);
});

test('status transitions: queued -> processing -> completed, survives re-claim', async () => {
  const userId = makeUser();
  credits.add({ userId, delta: 10, reason: 'signup_bonus' });
  const uploadId = makeUpload(userId);
  const { job } = jobsSvc.createJob({ userId, tool: 'deep', input: { uploadId }, enqueue: false });
  assert.equal(jobsSvc.getJobRow(job.id).status, 'queued');
  const p = queue.processJob(job.id);
  // While processing, a second claim must be a no-op.
  await queue.processJob(job.id);
  await p;
  const done = jobsSvc.getJobRow(job.id);
  assert.equal(done.status, 'completed');
  const out = JSON.parse(done.output_json);
  assert.ok(Array.isArray(out.components) && out.components.length === 10);
});

test('metadata job produces platform-shaped output', async () => {
  const userId = makeUser();
  credits.add({ userId, delta: 10, reason: 'signup_bonus' });
  const uploadId = makeUpload(userId);
  const { job } = jobsSvc.createJob({
    userId, tool: 'metadata', input: { uploadId, platform: 'adobe_stock' }, enqueue: false,
  });
  await queue.processJob(job.id);
  const done = jobsSvc.getJobRow(job.id);
  assert.equal(done.status, 'completed');
  const out = JSON.parse(done.output_json);
  assert.equal(out.platform, 'adobe_stock');
  assert.ok(out.title && out.title.length >= 20, 'title respects platform minimum');
  assert.ok(out.keywords.length >= 30 && out.keywords.length <= 50, 'keywords respect platform limits');
  assert.ok(out.description);
});
