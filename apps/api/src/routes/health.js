import { Router } from 'express';
import pkg from '../../package.json' with { type: 'json' };

const router = Router();

// GET /health — no auth
router.get('/', (req, res) => {
  res.json({ ok: true, version: pkg.version || '0.1.0' });
});

export default router;
