import fs from 'node:fs';
import { db } from '../db.js';
import { newId } from '../crypto.js';
import { httpError } from '../utils/http.js';
import { validateTool, validateJobInput } from '../utils/validate.js';
import { spendForJob } from './credits.js';
import { resolveProvider } from './providers.js';
import { enqueueJob } from './queue.js';

export const VISION_TOOLS = ['prompt', 'metadata', 'deep', 'ip-risk'];
export const TRACKER_TOOLS = ['tracker-search', 'tracker-contributor'];

export function jobToJson(row) {
  if (!row) return null;
  return {
    id: row.id,
    tool: row.tool,
    status: row.status,
    progress: row.progress,
    input: JSON.parse(row.input_json),
    output: row.output_json ? JSON.parse(row.output_json) : null,
    error: row.error || null,
    creditsUsed: row.credits_used,
    byok: !!row.byok,
    provider: row.provider || null,
    model: row.model || null,
    durationMs: row.duration_ms,
    batchId: row.batch_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || null,
  };
}

export function getJobRow(id) {
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) || null;
}

export function getJobForUser(id, userId) {
  return db.prepare('SELECT * FROM jobs WHERE id = ? AND user_id = ?').get(id, userId) || null;
}

export function setJobFields(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE jobs SET ${sets}, updated_at = ? WHERE id = ?`)
    .run(...keys.map((k) => fields[k]), new Date().toISOString(), id);
}

export function getUploadForUser(uploadId, userId) {
  return db.prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?').get(uploadId, userId) || null;
}

export function readUploadBuffer(upload) {
  const abs = upload.path;
  if (!fs.existsSync(abs)) {
    throw httpError(500, 'NOT_FOUND', 'The uploaded image is no longer available.');
  }
  return fs.readFileSync(abs);
}

function findByIdempotencyKey(userId, key) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return db.prepare(
    'SELECT * FROM jobs WHERE user_id = ? AND idempotency_key = ? AND created_at >= ?'
  ).get(userId, key, cutoff) || null;
}

/**
 * Validate, charge, and persist a job, then hand it to the worker.
 * Pass enqueue:false when the caller will drive the job itself (tracker).
 * Returns { job, deduped }.
 */
export function createJob({ userId, tool, input, idempotencyKey = null, batchId = null, enqueue = true }) {
  validateTool(tool);
  const normalized = validateJobInput(tool, input);

  // Validate before deducting anything.
  if (VISION_TOOLS.includes(tool)) {
    const upload = getUploadForUser(normalized.uploadId, userId);
    if (!upload) throw httpError(422, 'VALIDATION_ERROR', 'The selected upload was not found.');
  }
  if (TRACKER_TOOLS.includes(tool) && !process.env.ADOBE_STOCK_API_KEY) {
    throw httpError(501, 'PROVIDER_NOT_CONFIGURED',
      'The stock tracker is not configured yet. Set ADOBE_STOCK_API_KEY to enable it.');
  }

  if (idempotencyKey) {
    const existing = findByIdempotencyKey(userId, idempotencyKey);
    if (existing) return { job: jobToJson(existing), deduped: true };
  }

  // Resolve provider now so we know the real cost (and fail fast when unconfigured).
  const resolved = resolveProvider(userId, normalized.byok);
  const cost = resolved.cost;

  spendForJob(userId, null, cost); // throws 402 before anything is persisted

  const now = new Date().toISOString();
  const id = newId('job_');
  db.prepare(
    `INSERT INTO jobs (id, user_id, tool, status, progress, input_json, output_json, error,
      credits_used, byok, provider, model, duration_ms, idempotency_key, batch_id,
      created_at, updated_at, completed_at)
     VALUES (?, ?, ?, 'queued', 0, ?, NULL, NULL, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL)`
  ).run(id, userId, tool, JSON.stringify(normalized), cost, resolved.byokUsed ? 1 : 0,
    resolved.name, resolved.model, idempotencyKey, batchId, now, now);

  if (enqueue) enqueueJob(id);
  return { job: jobToJson(getJobRow(id)), deduped: false };
}

export function listJobs(userId, { tool, status, page, limit, offset }) {
  const where = ['user_id = ?'];
  const params = [userId];
  if (tool) { where.push('tool = ?'); params.push(tool); }
  if (status) { where.push('status = ?'); params.push(status); }
  const clause = `WHERE ${where.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) AS c FROM jobs ${clause}`).get(...params).c;
  const rows = db.prepare(
    `SELECT * FROM jobs ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
  return { jobs: rows.map(jobToJson), total };
}

export function cancelJob(userId, id) {
  const job = getJobForUser(id, userId);
  if (!job) throw httpError(404, 'NOT_FOUND', 'Job not found.');
  if (job.status !== 'queued' && job.status !== 'processing') {
    throw httpError(422, 'VALIDATION_ERROR', 'Only queued or processing jobs can be cancelled.');
  }
  const now = new Date().toISOString();
  db.prepare("UPDATE jobs SET status = 'cancelled', updated_at = ?, completed_at = ? WHERE id = ?")
    .run(now, now, id);
  return jobToJson(getJobRow(id));
}

export function deleteJob(userId, id) {
  const job = getJobForUser(id, userId);
  if (!job) throw httpError(404, 'NOT_FOUND', 'Job not found.');
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
}

export function deleteJobs(userId, tool) {
  const params = [userId];
  let clause = 'user_id = ?';
  if (tool) { clause += ' AND tool = ?'; params.push(tool); }
  const result = db.prepare(`DELETE FROM jobs WHERE ${clause}`).run(...params);
  return result.changes;
}
