import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { jobsLimiter } from '../middleware/rateLimit.js';
import { err, asyncHandler } from '../utils/http.js';
import { searchAssets, contributorAssets } from '../services/tracker.js';
import { createJob, getJobRow, setJobFields } from '../services/jobs.js';
import { refundJob } from '../services/credits.js';

const router = Router();
router.use(authRequired, jobsLimiter);

/**
 * Tracker endpoints run synchronously but are wrapped as jobs so they appear
 * in history uniformly. 1 credit each (refunded on provider failure).
 */

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// GET /tracker/search?q=&limit=20&offset=0
router.get('/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return err(res, 422, 'VALIDATION_ERROR', 'A search query "q" is required.');
  const input = {
    q: q.slice(0, 200),
    limit: clampInt(req.query.limit, 1, 100, 20),
    offset: clampInt(req.query.offset, 0, 10000, 0),
    byok: false,
  };
  return res.json(await runTrackerJob(req.user.id, 'tracker-search', input, searchAssets));
}));

// GET /tracker/contributor?creatorId=&limit=20&offset=0
router.get('/contributor', asyncHandler(async (req, res) => {
  const creatorId = String(req.query.creatorId || '').trim();
  if (!creatorId) return err(res, 422, 'VALIDATION_ERROR', 'A "creatorId" is required.');
  const input = {
    creatorId: creatorId.slice(0, 100),
    limit: clampInt(req.query.limit, 1, 100, 20),
    offset: clampInt(req.query.offset, 0, 10000, 0),
    byok: false,
  };
  return res.json(await runTrackerJob(req.user.id, 'tracker-contributor', input, contributorAssets));
}));

/**
 * Create the job record, charge, call the provider inline, then mark completed.
 * A 501 (tracker not configured) surfaces from createJob before any charge.
 */
async function runTrackerJob(userId, tool, input, fn) {
  // enqueue:false — the worker must not pick this up; we drive it inline.
  const { job } = createJob({ userId, tool, input, enqueue: false });
  const startedAt = Date.now();
  try {
    setJobFields(job.id, { status: 'processing', progress: 40 });
    const output = await fn(input);
    const now = new Date().toISOString();
    setJobFields(job.id, {
      status: 'processing',
      progress: 100,
      output_json: JSON.stringify(output),
      duration_ms: Date.now() - startedAt,
    });
    setJobFields(job.id, { status: 'completed', completed_at: now });
    return output;
  } catch (e) {
    const now = new Date().toISOString();
    setJobFields(job.id, {
      status: 'failed',
      error: String(e?.message || 'The tracker request failed. Please try again.').slice(0, 500),
      completed_at: now,
    });
    const row = getJobRow(job.id);
    if (row && row.credits_used > 0) refundJob(userId, job.id, row.credits_used);
    throw e;
  }
}

export default router;
