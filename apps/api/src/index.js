// Must be the first import: loads .env before any other module (e.g. crypto.js)
// reads process.env at import time. Static imports hoist, so dotenv.config()
// in the module body would run too late.
import 'dotenv/config';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { err } from './utils/http.js';
import { startWorker } from './services/queue.js';

import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import uploadsRoutes from './routes/uploads.js';
import jobsRoutes from './routes/jobs.js';
import batchesRoutes from './routes/batches.js';
import platformsRoutes from './routes/platforms.js';
import settingsRoutes from './routes/settings.js';
import billingRoutes from './routes/billing.js';
import creditsRoutes from './routes/credits.js';
import { referralRouter, redeemRouter } from './routes/referral.js';
import tasksRoutes from './routes/tasks.js';
import reviewsRoutes from './routes/reviews.js';
import trackerRoutes from './routes/tracker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const WEB_URL = process.env.WEB_URL || 'http://localhost:5173';
const PORT = Number(process.env.PORT) || 4000;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: WEB_URL.split(',').map((s) => s.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// ---- API ----
const v1 = express.Router();
v1.use('/health', healthRoutes);
v1.use('/auth', authRoutes);
v1.use('/uploads', uploadsRoutes);
v1.use('/jobs', jobsRoutes);
v1.use('/batches', batchesRoutes);
v1.use('/platforms', platformsRoutes);
v1.use('/settings', settingsRoutes);
v1.use('/billing', billingRoutes);
v1.use('/credits', creditsRoutes);
v1.use('/referral', referralRouter);
v1.use('/redeem', redeemRouter);
v1.use('/tasks', tasksRoutes);
v1.use('/reviews', reviewsRoutes);
v1.use('/tracker', trackerRoutes);
app.use('/api/v1', v1);

// ---- Uploaded files ----
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false }));

// ---- Web client (production): serve apps/web/dist with SPA fallback ----
const webDist = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist, { maxAge: '1h', index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// ---- 404 + error handling (contract-shaped errors) ----
app.use('/api', (req, res) => err(res, 404, 'NOT_FOUND', 'The requested endpoint does not exist.'));

// eslint-disable-next-line no-unused-vars
app.use((e, req, res, next) => {
  const status = e.status || 500;
  const code = e.code || 'INTERNAL_ERROR';
  if (status >= 500 && code === 'INTERNAL_ERROR') {
    console.error(`[api] ${req.method} ${req.path} -> ${status}: ${e.message}`);
  }
  // Never leak stack traces or internals to clients. Deliberate contract
  // errors (explicit code) keep their message; true 500s are masked.
  const message = code === 'INTERNAL_ERROR'
    ? 'Something went wrong on our side. Please try again.'
    : (e.message || 'The request could not be completed.');
  err(res, status, code, message);
});

app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT} (web: ${WEB_URL})`);
  startWorker();
});

export default app;
