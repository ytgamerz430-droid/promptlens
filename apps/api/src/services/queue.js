import { db } from '../db.js';
import { refundJob } from './credits.js';
import { resolveProvider, instantiate } from './providers.js';
import { searchAssets, contributorAssets } from './tracker.js';
import { generateMetadata, extractJson } from '../tools/metadata.js';
import { buildArtPrompt, buildDeepPrompt, buildIpRiskPrompt } from '../tools/prompts.js';
import {
  getJobRow, setJobFields, getUploadForUser, readUploadBuffer, jobToJson,
  VISION_TOOLS, TRACKER_TOOLS,
} from './jobs.js';

const CONCURRENCY = 2;
const POLL_MS = 1000;

const pending = [];
let active = 0;
let timer = null;
const cancelled = new Set();

/** Hand a job id to the worker. */
export function enqueueJob(jobId) {
  if (!pending.includes(jobId)) pending.push(jobId);
  kick();
}

export function markCancelled(jobId) {
  cancelled.add(jobId);
}

function kick() {
  while (active < CONCURRENCY && pending.length > 0) {
    const id = pending.shift();
    active += 1;
    processJob(id).finally(() => {
      active -= 1;
      kick();
    });
  }
}

/** Start the background worker loop (called once by index.js). */
export function startWorker() {
  // Jobs left in "processing" by a previous process go back to the queue.
  requeueStale();
  const rows = db.prepare("SELECT id FROM jobs WHERE status = 'queued' ORDER BY created_at ASC").all();
  for (const r of rows) pending.push(r.id);
  if (timer) clearInterval(timer);
  timer = setInterval(kick, POLL_MS);
  timer.unref?.();
  kick();
  console.log(`[worker] started (concurrency ${CONCURRENCY}, ${pending.length} queued job(s) reloaded)`);
}

export function requeueStale() {
  const now = new Date().toISOString();
  db.prepare("UPDATE jobs SET status = 'queued', progress = 0, updated_at = ? WHERE status = 'processing'")
    .run(now);
}

function isCancelled(id) {
  if (cancelled.has(id)) return true;
  const row = getJobRow(id);
  return row && row.status === 'cancelled';
}

function getPlatform(platformId) {
  const row = db.prepare('SELECT * FROM platforms WHERE id = ?').get(platformId);
  if (!row) return null;
  return {
    id: row.id, name: row.name,
    titleMin: row.title_min, titleMax: row.title_max,
    keywordMin: row.keyword_min, keywordMax: row.keyword_max,
    keywordType: row.keyword_type, notes: row.notes,
  };
}

/**
 * Execute one job through queued → processing → completed|failed|cancelled.
 * Safe to call directly (tests) or via the worker loop.
 */
export async function processJob(jobId) {
  const row = getJobRow(jobId);
  if (!row || row.status === 'cancelled' || row.status === 'completed' || row.status === 'failed') return;
  cancelled.delete(jobId);

  // Atomic claim: only one worker may move a job out of "queued".
  const now = new Date().toISOString();
  const claimed = db.prepare(
    "UPDATE jobs SET status = 'processing', progress = 10, updated_at = ? WHERE id = ? AND status = 'queued'"
  ).run(now, jobId);
  if (claimed.changes === 0) return; // claimed by someone else (e.g. inline tracker run)

  const startedAt = Date.now();
  const input = JSON.parse(getJobRow(jobId).input_json);

  try {
    let output;
    if (TRACKER_TOOLS.includes(row.tool)) {
      setJobFields(jobId, { progress: 40 });
      output = row.tool === 'tracker-search'
        ? await searchAssets(input)
        : await contributorAssets(input);
      if (isCancelled(jobId)) return finishCancelled(jobId);
    } else {
      output = await runVisionTool(jobId, row, input);
      if (isCancelled(jobId)) return finishCancelled(jobId);
    }

    setJobFields(jobId, {
      status: 'completed',
      progress: 100,
      output_json: JSON.stringify(output),
      duration_ms: Date.now() - startedAt,
      completed_at: new Date().toISOString(),
    });
  } catch (e) {
    if (isCancelled(jobId)) return finishCancelled(jobId);
    const message = sanitizeError(e);
    // Refund provider failures; validation failures never deducted.
    if (row.credits_used > 0) {
      try { refundJob(row.user_id, jobId, row.credits_used); } catch { /* never fail the job on refund issues */ }
    }
    setJobFields(jobId, {
      status: 'failed',
      error: message,
      duration_ms: Date.now() - startedAt,
      completed_at: new Date().toISOString(),
    });
    console.error(`[worker] job ${jobId} failed: ${message}`);
  }
}

function finishCancelled(jobId) {
  const now = new Date().toISOString();
  setJobFields(jobId, { status: 'cancelled', completed_at: now });
}

async function runVisionTool(jobId, row, input) {
  const upload = getUploadForUser(input.uploadId, row.user_id);
  if (!upload) throw new Error('The uploaded image is no longer available.');
  const imageBuffer = readUploadBuffer(upload);

  const resolved = resolveProvider(row.user_id, input.byok);
  const provider = instantiate(resolved);
  const vision = async ({ systemPrompt, userPrompt, maxTokens = 2048, extra = {} }) => {
    const r = await provider.generateVision({
      imageBuffer, mimeType: upload.mime_type, systemPrompt, userPrompt, maxTokens,
      extra: { tool: row.tool, ...extra },
    });
    return r.text;
  };

  setJobFields(jobId, { progress: 30 });
  let output;
  if (row.tool === 'prompt') {
    const p = buildArtPrompt(input);
    const text = await vision({ ...p, maxTokens: 1024, extra: { tool: 'prompt' } });
    output = { prompt: text.trim() };
  } else if (row.tool === 'metadata') {
    const platform = getPlatform(input.platform || 'adobe_stock');
    const limits = {
      titleMin: input.titleMin ?? platform?.titleMin ?? null,
      titleMax: input.titleMax ?? platform?.titleMax ?? null,
      keywordMin: input.keywordMin ?? platform?.keywordMin ?? null,
      keywordMax: input.keywordMax ?? platform?.keywordMax ?? null,
      keywordType: input.keywordType ?? platform?.keywordType ?? 'mixed',
    };
    const { output: meta, warnings } = await generateMetadata({ vision, platform, limits, input });
    output = { ...meta, warnings };
  } else if (row.tool === 'deep') {
    const p = buildDeepPrompt();
    const text = await vision({ ...p, maxTokens: 2048, extra: { tool: 'deep' } });
    const parsed = extractJson(text);
    output = {
      components: (parsed.components || []).map((c) => ({
        name: String(c.name || ''), detail: String(c.detail || ''),
      })),
      summary: String(parsed.summary || ''),
    };
  } else if (row.tool === 'ip-risk') {
    const p = buildIpRiskPrompt();
    const text = await vision({ ...p, maxTokens: 2048, extra: { tool: 'ip-risk' } });
    const parsed = extractJson(text);
    const risk = ['low', 'medium', 'high'].includes(parsed.risk) ? parsed.risk : 'medium';
    output = {
      risk,
      findings: (parsed.findings || []).map(String),
      summary: String(parsed.summary || ''),
    };
  } else {
    throw new Error(`Unknown tool "${row.tool}".`);
  }

  setJobFields(jobId, { progress: 80 });
  if (isCancelled(jobId)) return finishCancelled(jobId);
  return output;
}

function sanitizeError(e) {
  const msg = e && e.message ? String(e.message) : 'The generation failed. Please try again.';
  // Never leak key material or stack traces to the client.
  return msg.slice(0, 500);
}

export { jobToJson };
