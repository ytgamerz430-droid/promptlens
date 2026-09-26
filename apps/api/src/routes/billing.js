import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { err, asyncHandler } from '../utils/http.js';
import { balance, ensureDailyGrant } from '../services/credits.js';

const router = Router();

// GET /billing/plans — public
router.get('/plans', asyncHandler(async (req, res) => {
  const rows = db.prepare('SELECT * FROM billing_plans WHERE active = 1 ORDER BY price ASC').all();
  const plans = rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    currency: p.currency,
    interval: p.interval,
    creditsPerMonth: p.credits_per_month,
    creditsPerDay: p.credits_per_day,
    features: JSON.parse(p.features_json || '[]'),
  }));
  return res.json({ plans });
}));

// GET /billing/me
router.get('/me', authRequired, asyncHandler(async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  ensureDailyGrant(req.user.id);
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return res.json({
    plan: user.plan,
    credits: balance(req.user.id),
    creditsResetAt: midnight.toISOString(),
    subscription: null,
  });
}));

// POST /billing/checkout-session
router.post('/checkout-session', authRequired, asyncHandler(async (req, res) => {
  const { planId } = req.body || {};
  const plan = planId
    ? db.prepare('SELECT * FROM billing_plans WHERE id = ? AND active = 1').get(String(planId))
    : null;
  if (!plan) return err(res, 422, 'VALIDATION_ERROR', 'Unknown plan.');
  if (!process.env.STRIPE_SECRET_KEY) {
    return err(res, 501, 'PROVIDER_NOT_CONFIGURED', 'Checkout is not configured yet.');
  }
  // TODO: when Stripe is wired up, create a Checkout Session here with the
  // Stripe SDK (stripe.checkout.sessions.create) and return its URL.
  // Kept as a stub so no payment dependency ships half-integrated.
  return err(res, 501, 'PROVIDER_NOT_CONFIGURED', 'Checkout is not configured yet.');
}));

export default router;
