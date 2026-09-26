import rateLimit from 'express-rate-limit';
import { err } from '../utils/http.js';

const tooMany = (message) => (req, res) =>
  err(res, 429, 'RATE_LIMITED', message);

/** Auth endpoints: 20 requests / 15 min per IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: tooMany('Too many sign-in attempts. Please wait a few minutes and try again.'),
});

/** Job creation: 60 requests / hour per user (falls back to IP). */
export const jobsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : `ip:${req.ip}`),
  handler: tooMany('You have reached the hourly generation limit. Please try again later.'),
});

/** Uploads: 60 requests / hour per user (falls back to IP). */
export const uploadsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : `ip:${req.ip}`),
  handler: tooMany('You have reached the hourly upload limit. Please try again later.'),
});
