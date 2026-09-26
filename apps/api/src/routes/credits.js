import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { asyncHandler, paginate, pageEnvelope } from '../utils/http.js';
import { creditInfo, ledger } from '../services/credits.js';

const router = Router();
router.use(authRequired);

// GET /credits
router.get('/', asyncHandler(async (req, res) => {
  return res.json(creditInfo(req.user.id));
}));

// GET /credits/ledger
router.get('/ledger', asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req);
  const { rows, total } = ledger(req.user.id, page, limit, offset);
  return res.json({ data: rows, ...pageEnvelope(total, page, limit) });
}));

export default router;
