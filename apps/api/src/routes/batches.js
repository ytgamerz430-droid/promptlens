import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { err, asyncHandler } from '../utils/http.js';
import { jobToJson } from '../services/jobs.js';

const router = Router();
router.use(authRequired);

function batchStatus(counts, total) {
  if (counts.queued > 0) return 'queued';
  if (counts.processing > 0) return 'processing';
  if (counts.failed > 0 && counts.completed + counts.cancelled + counts.failed === total) return 'failed';
  if (counts.completed === total) return 'completed';
  if (counts.cancelled === total) return 'cancelled';
  return 'processing';
}

// GET /batches/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!batch) return err(res, 404, 'NOT_FOUND', 'Batch not found.');

  const jobs = db.prepare('SELECT * FROM jobs WHERE batch_id = ? ORDER BY created_at ASC')
    .all(batch.id).map(jobToJson);
  const counts = { queued: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
  for (const j of jobs) counts[j.status] = (counts[j.status] || 0) + 1;

  return res.json({
    batch: {
      id: batch.id,
      status: batchStatus(counts, jobs.length || batch.total),
      total: batch.total,
      queued: counts.queued,
      processing: counts.processing,
      completed: counts.completed,
      failed: counts.failed,
      cancelled: counts.cancelled,
      jobs,
    },
  });
}));

export default router;
