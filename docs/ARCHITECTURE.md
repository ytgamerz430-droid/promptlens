# System Architecture — PromptLens (independent implementation)

## Overview

A monorepo with two apps that deploy together or separately:

```
promptlens-clone/
├── apps/
│   ├── api/          # Node.js + Express REST API, job queue + worker, AI providers
│   └── web/          # React 18 + Vite SPA (landing + dashboard)
├── docs/             # Reconnaissance, contracts, specs, guides
├── package.json      # npm workspaces, dev/build scripts
└── .env.example
```

No dependency on any third-party site or backend. All state lives in our own
SQLite database; all AI calls go through provider adapters using our own keys.

## Runtime topology

```
Browser (React SPA)
   │  HTTPS/JSON, Authorization: Bearer <JWT>
   ▼
Express API (/api/v1)
   ├── Auth (bcrypt passwords, JWT sessions, optional Google OAuth)
   ├── REST resources (uploads, jobs, settings, billing, ...)
   └── Job service ──► SQLite (jobs table = durable queue)
                            ▲
                     Worker loop (in-process, 1s poll, concurrency 2)
                            │  atomic claim → no double processing
                            ▼
                     Provider adapter (Gemini | Groq | Mistral | OpenAI | mock)
                            │  60s timeout, retries on transient errors
                            ▼
                     Result parsed/validated → jobs.output_json
                            │
Browser ◄── polling (2s while queued/processing) ──┘
```

The worker runs inside the API process (no Redis needed at this scale). On boot,
jobs stuck in `processing` are re-queued, so restarts never lose work. A
standalone worker process can be added later by importing `services/queue.js`
without the HTTP server.

## Request flows

### Authentication
1. `POST /auth/register` — validate, bcrypt-hash (12 rounds), create user,
   grant signup + daily credits, issue JWT (7d).
2. Client stores JWT in localStorage (`promptlens_token`), sends
   `Authorization: Bearer` per request.
3. `401` → client clears token, redirects to `/login`.
4. Forgot password: single-use token (sha256-hashed in DB, 1h expiry) emailed
   via SMTP if configured, else logged in dev.

### Tool execution (async job lifecycle)
1. `POST /uploads` (multipart) → magic-byte validated image stored at
   `data/uploads/<userId>/`, dimensions probed, returns `uploadId`.
2. `POST /jobs { tool, input }` →
   - validate input; check credits (1/job, 0 for BYOK-with-own-key or mock);
   - deduct credits, write ledger entry;
   - insert job `status=queued`; optional `Idempotency-Key` dedupe (24h).
3. Worker claims job atomically → `processing` (progress 10 → 30 → 80 → 100).
4. Provider adapter called with image bytes + tool prompt template.
5. Output parsed/validated (metadata: platform limits + one auto-retry).
6. `completed` (output stored) or `failed` (credit refunded, human-readable error).
7. Frontend polls `GET /jobs/:id` every 2s while active; history via `GET /jobs`.

### Batch
`POST /jobs/batch` creates N jobs under a `batch_id`; `GET /batches/:id`
aggregates per-item statuses for the queue UI.

## Provider abstraction

```js
class AIProvider {
  async generateVision({ imageBuffer, mimeType, systemPrompt, userPrompt, maxTokens })
    // → { text, model, usage? }
  async testConnection() // → { ok, latencyMs, model?, error? }
}
```

Adapters: `gemini` (AI Studio REST, inlineData), `groq` / `mistral` / `openai`
(OpenAI-compatible chat completions, image as data URI), `mock` (deterministic
demo output, cost 0, clearly labeled in UI).

Selection order per job: user's BYOK key for their default provider → server
env key for that provider → `mock` (if `DEFAULT_PROVIDER=mock`) → 501
`PROVIDER_NOT_CONFIGURED`. BYOK keys are AES-256-GCM encrypted at rest and
never returned in full (masked `••••ab12` + test endpoint).

## Credits

Ledger-based (`credit_ledger`): every grant/spend/refund is a row; balance is
derived. Reasons: `signup_bonus`, `daily_grant`, `job_spend`, `job_refund`,
`redeem`, `referral`, `task_reward`, `plan_grant`. Daily free credits reset at
midnight UTC (`daily_grants` table).

## Frontend state

- `zustand`: auth (user/token), theme (`dark`/`light`, localStorage persisted).
- `@tanstack/react-query`: server state (jobs, history, settings, plans…),
  2s refetch while jobs are active, invalidation after mutations.
- `axios`: baseURL `/api/v1`, Bearer injection, global 401 handler.
- `react-toastify`: success/error toasts, themed.

## Security

- helmet, CORS restricted to `WEB_URL`, rate limits (auth 20/15min/IP,
  jobs+uploads 60/hr/user).
- Parameterized queries only; ownership check on every `:id` route
  (cross-user access → 404, verified in tests).
- Uploads: magic-byte type check, 100MB cap, random unguessable ids, per-user dirs.
- Secrets: env-only, never logged, never sent to the client in full.

## Configuration

Everything via env (see `.env.example`): `PORT`, `WEB_URL`, `SESSION_SECRET`,
`DATABASE_PATH`, provider keys/models, `DEFAULT_PROVIDER`, credit amounts,
`MAX_UPLOAD_MB`, SMTP, Google OAuth, Adobe Stock key. Production: serve
`apps/web/dist` from the API (SPA fallback built in) or deploy separately.

## Scaling notes

SQLite + in-process worker fits single-node deploys. To scale: move the worker
to its own process (already isolated in `services/queue.js`), swap SQLite for
Postgres (queries are parameterized; add a Postgres adapter), and put uploads
on S3-compatible storage.
