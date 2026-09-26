import { Router } from 'express';
import { db } from '../db.js';
import { newId } from '../crypto.js';
import { authRequired } from '../middleware/auth.js';
import { err, asyncHandler } from '../utils/http.js';
import { add, balance } from '../services/credits.js';

const router = Router();
router.use(authRequired);

/** Whether the task's completion condition is currently met. */
function isComplete(userId, taskId) {
  if (taskId === 'complete-profile') {
    const u = db.prepare('SELECT profile_completed FROM users WHERE id = ?').get(userId);
    return !!u?.profile_completed;
  }
  if (taskId === 'connect-provider') {
    return !!db.prepare('SELECT 1 FROM provider_keys WHERE user_id = ?').get(userId);
  }
  if (taskId === 'first-generation') {
    return !!db.prepare("SELECT 1 FROM jobs WHERE user_id = ? AND status = 'completed'").get(userId);
  }
  if (taskId === 'invite-friend') {
    return !!db.prepare('SELECT 1 FROM referrals WHERE referrer_id = ?').get(userId);
  }
  return false;
}

// GET /tasks
router.get('/', asyncHandler(async (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks WHERE active = 1 ORDER BY rowid ASC').all();
  const claimed = new Set(
    db.prepare('SELECT task_id FROM task_completions WHERE user_id = ?').all(req.user.id).map((r) => r.task_id)
  );
  const tasks = rows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    credits: t.credits,
    status: claimed.has(t.id) ? 'completed' : 'available',
  }));
  return res.json({ tasks });
}));

// POST /tasks/:id/claim
router.post('/:id/claim', asyncHandler(async (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND active = 1').get(req.params.id);
  if (!task) return err(res, 404, 'NOT_FOUND', 'Task not found.');
  const existing = db.prepare('SELECT 1 FROM task_completions WHERE user_id = ? AND task_id = ?')
    .get(req.user.id, task.id);
  if (existing) return err(res, 422, 'VALIDATION_ERROR', 'This reward has already been claimed.');
  if (!isComplete(req.user.id, task.id)) {
    return err(res, 422, 'VALIDATION_ERROR', 'This task is not complete yet.');
  }
  db.prepare('INSERT INTO task_completions (id, user_id, task_id, claimed_at) VALUES (?, ?, ?, ?)')
    .run(newId('tc_'), req.user.id, task.id, new Date().toISOString());
  add({ userId: req.user.id, delta: task.credits, reason: 'task_reward', ref: task.id });
  return res.json({ ok: true, creditsAdded: task.credits, credits: balance(req.user.id) });
}));

export default router;
