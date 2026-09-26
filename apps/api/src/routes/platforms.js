import { Router } from 'express';
import { db } from '../db.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

// GET /platforms — public marketplace rule list
router.get('/', asyncHandler(async (req, res) => {
  const rows = db.prepare('SELECT * FROM platforms ORDER BY rowid ASC').all();
  const platforms = rows.map((p) => ({
    id: p.id,
    name: p.name,
    titleMin: p.title_min,
    titleMax: p.title_max,
    keywordMin: p.keyword_min,
    keywordMax: p.keyword_max,
    keywordType: p.keyword_type,
    notes: p.notes,
  }));
  return res.json({ platforms });
}));

export default router;
