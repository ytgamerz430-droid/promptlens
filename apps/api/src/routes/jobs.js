import { Router } from 'express';
import { db } from '../db.js';
import { newId } from '../crypto.js';
import { authRequired } from '../middleware/auth.js';
import { jobsLimiter } from '../middleware/rateLimit.js';
import { err, asyncHandler, paginate, pageEnvelope } from '../utils/http.js';
import { validateTool } from '../utils/validate.js';
import {
  createJob, listJobs, getJobForUser, cancelJob, deleteJob, deleteJobs, jobToJson, getJobRow,
} from '../services/jobs.js';
import { markCancelled } from '../services/queue.js';

const router = Router();
router.use(authRequired);

// POST /jobs/batch — handled here for route-ordering (must precede /:id)
router.post('/batch', jobsLimiter, asyncHandler(async (req, res) => {
  const { tool, items, common } = req.body || {};
  validateTool(tool);
  if (tool !== 'prompt' && tool !== 'metadata') {
    return err(res, 422, 'VALIDATION_ERROR', 'Batch processing supports the prompt and metadata tools.');
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    return err(res, 422, 'VALIDATION_ERROR', 'Provide between 1 and 20 items.');
  }

  const batchId = newId('batch_');
  const now = new Date().toISOString();
  db.prepare('INSERT INTO batches (id, user_id, tool, status, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(batchId, req.user.id, tool, 'queued', items.length, now, now);

  const jobs = [];
  try {
    for (const item of items) {
      const merged = { ...(common || {}), ...(item || {}) };
      const { job } = createJob({
        userId: req.user.id,
        tool,
        input: merged,
        batchId,
      });
      jobs.push({ id: job.id, status: job.status });
    }
  } catch (e) {
    // Fail fast: leave already-created jobs running; surface the error (e.g. 402).
    throw e;
  }

  return res.status(201).json({
    batch: { id: batchId, status: 'queued', total: items.length, jobs },
  });
}));

// POST /jobs/export — CSV download for many metadata jobs
router.post('/export', asyncHandler(async (req, res) => {
  const { ids, format } = req.body || {};
  if (format !== 'csv') return err(res, 422, 'VALIDATION_ERROR', 'Only "csv" export is supported.');
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    return err(res, 422, 'VALIDATION_ERROR', 'Provide between 1 and 100 job ids.');
  }
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT j.*, u.filename AS filename FROM jobs j LEFT JOIN uploads u
     ON u.id = json_extract(j.input_json, '$.uploadId')
     WHERE j.user_id = ? AND j.id IN (${placeholders}) AND j.tool = 'metadata' AND j.status = 'completed'`
  ).all(req.user.id, ...ids);
  if (!rows.length) return err(res, 404, 'NOT_FOUND', 'No completed metadata jobs found for export.');
  return sendCsv(res, rows, 'metadata-export.csv');
}));

// POST /jobs — create a job
router.post('/', jobsLimiter, asyncHandler(async (req, res) => {
  const { tool, input } = req.body || {};
  const idempotencyKey = req.headers['idempotency-key']
    ? String(req.headers['idempotency-key']).slice(0, 128)
    : null;
  const { job, deduped } = createJob({ userId: req.user.id, tool, input, idempotencyKey });
  return res.status(deduped ? 200 : 201).json({ job });
}));

// GET /jobs — list with filters
router.get('/', asyncHandler(async (req, res) => {
  const { tool, status } = req.query;
  if (tool) validateTool(String(tool));
  if (status && !['queued', 'processing', 'completed', 'failed', 'cancelled'].includes(String(status))) {
    return err(res, 422, 'VALIDATION_ERROR', 'Unknown status filter.');
  }
  const { page, limit, offset } = paginate(req);
  const { jobs, total } = listJobs(req.user.id, {
    tool: tool ? String(tool) : null,
    status: status ? String(status) : null,
    page, limit, offset,
  });
  return res.json({ jobs, ...pageEnvelope(total, page, limit) });
}));

// GET /jobs/:id/export?format=csv
router.get('/:id/export', asyncHandler(async (req, res) => {
  const { format } = req.query;
  if (format !== 'csv') return err(res, 422, 'VALIDATION_ERROR', 'Only "csv" export is supported.');
  const job = getJobForUser(req.params.id, req.user.id);
  if (!job || job.tool !== 'metadata' || job.status !== 'completed') {
    return err(res, 404, 'NOT_FOUND', 'No completed metadata job found for export.');
  }
  const row = db.prepare(
    `SELECT j.*, u.filename AS filename FROM jobs j LEFT JOIN uploads u
     ON u.id = json_extract(j.input_json, '$.uploadId') WHERE j.id = ?`
  ).get(job.id);
  return sendCsv(res, [row], `metadata-${job.id}.csv`);
}));

// GET /jobs/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const job = getJobForUser(req.params.id, req.user.id);
  if (!job) return err(res, 404, 'NOT_FOUND', 'Job not found.');
  return res.json({ job: jobToJson(job) });
}));

// POST /jobs/:id/cancel
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  markCancelled(req.params.id);
  const job = cancelJob(req.user.id, req.params.id);
  return res.json({ job });
}));

// POST /jobs/:id/regenerate — new job, same tool + input (costs a credit)
router.post('/:id/regenerate', jobsLimiter, asyncHandler(async (req, res) => {
  const job = getJobForUser(req.params.id, req.user.id);
  if (!job) return err(res, 404, 'NOT_FOUND', 'Job not found.');
  const { job: fresh } = createJob({
    userId: req.user.id,
    tool: job.tool,
    input: JSON.parse(job.input_json),
  });
  return res.status(201).json({ job: fresh });
}));

// DELETE /jobs/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  deleteJob(req.user.id, req.params.id);
  return res.json({ ok: true });
}));

// DELETE /jobs?tool=
router.delete('/', asyncHandler(async (req, res) => {
  const { tool } = req.query;
  if (tool) validateTool(String(tool));
  const deleted = deleteJobs(req.user.id, tool ? String(tool) : null);
  return res.json({ ok: true, deleted });
}));

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function sendCsv(res, rows, filename) {
  const lines = ['filename,title,keywords,description'];
  for (const r of rows) {
    const output = r.output_json ? JSON.parse(r.output_json) : {};
    const keywords = Array.isArray(output.keywords) ? output.keywords.join(', ') : '';
    lines.push([
      csvCell(r.filename || ''),
      csvCell(output.title || ''),
      csvCell(keywords),
      csvCell(output.description || ''),
    ].join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(`\uFEFF${lines.join('\r\n')}`);
}

export default router;
