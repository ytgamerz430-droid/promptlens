# API Contract — PromptLens independent implementation

Base URL: `/api/v1`. All responses JSON. Authenticated routes require
`Authorization: Bearer <jwt>`. Token also accepted from localStorage key
`promptlens_token` by the web client (client concern).

Error shape (non-2xx):
```json
{ "error": { "code": "STRING_CODE", "message": "Human readable message" } }
```
Codes: `VALIDATION_ERROR` (400/422), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `INAPPROPRIATE` n/a, `INSUFFICIENT_CREDITS` (402),
`PROVIDER_NOT_CONFIGURED` (503), `PROVIDER_ERROR` (502), `RATE_LIMITED` (429),
`FILE_TOO_LARGE` (413), `UNSUPPORTED_FILE_TYPE` (415).

Timestamps: ISO 8601 UTC. Pagination: `?page=1&limit=20` →
`{ "data": [...], "pagination": { "page": 1, "limit": 20, "total": 42, "pages": 3 } }`.
For jobs list the key is `jobs` instead of `data` (see below).

---

## Auth

- `POST /auth/register` `{name, email, password}` → `201 { token, user }`
  - Validation: name ≥ 2 chars; email format; password ≥ 8 chars.
  - Creates user, grants signup credit bonus, generates referral code.
  - If `referredBy` code supplied and valid → credit both parties.
- `POST /auth/login` `{email, password}` → `200 { token, user }`
  - `401 { error: { code: "UNAUTHORIZED", message: "Invalid email or password." } }`
- `POST /auth/logout` → `200 { ok: true }` (stateless JWT; client discards token)
- `GET /auth/me` → `200 { user }`
- `PATCH /auth/me` `{name?}` → `200 { user }`
- `POST /auth/password` `{currentPassword, newPassword}` → `200 { ok: true }`
- `POST /auth/forgot-password` `{email}` → `200 { ok: true }` always (no enumeration).
  Sends reset email if SMTP configured, else logs token (dev).
- `POST /auth/reset-password` `{token, password}` → `200 { ok: true }`
- `GET /auth/google/url` → `200 { url }` or `501 { error: { code: "PROVIDER_NOT_CONFIGURED" } }`
  when Google OAuth env vars are absent.
- `GET /auth/google/callback?code=...` → `302` to web `/login?token=...` or
  `200 { token, user }` for API clients.

`user` shape:
```json
{ "id": "u_...", "name": "Jane", "email": "jane@x.com",
  "plan": "free", "credits": 5, "referralCode": "ABC123",
  "createdAt": "..." }
```

## Uploads

- `POST /uploads` — multipart, field `file`. → `201`
  ```json
  { "id": "up_...", "url": "/uploads/u_.../up_....jpg",
    "mimeType": "image/jpeg", "size": 123456, "width": 1024, "height": 768 }
  ```
  - Allowed: `image/jpeg`, `image/png`, `image/webp`. Max 100MB (`FILE_TOO_LARGE`).
  - Stored at `data/uploads/<userId>/<id>.<ext>`; served statically at `/uploads/*`.
- `DELETE /uploads/:id` → `200 { ok: true }` (owner only)

## Jobs (tool execution)

Job statuses: `queued` → `processing` → `completed` | `failed` | `cancelled`.
`progress`: 0–100 integer while processing.

Tool ids: `prompt` | `metadata` | `deep` | `ip-risk` | `tracker-search` | `tracker-contributor`.
(Tracker tools are synchronous lookups, still wrapped as jobs for uniform history.)

- `POST /jobs` `{ tool, input }` → `201 { job }`
  - `input.prompt`: `{ uploadId, outputStyle?: "art_prompt", ipSafe?: bool, iconMode?: bool, byok?: bool }`
  - `input.metadata`: `{ uploadId, platform?: "adobe_stock"|"shutterstock"|"vecteezy"|"depositphotos"|"123rf"|"dreamstime"|"general", titleMin?, titleMax?, keywordMin?, keywordMax?, keywordType?: "mixed"|"single"|"phrase", customPrompt?, customKeywords?, byok? }`
  - `input.deep` / `input.ip-risk`: `{ uploadId, byok? }`
  - `input.tracker-search`: `{ q, limit?, offset? }`; `input.tracker-contributor`: `{ creatorId, limit?, offset? }`
  - Costs 1 credit unless `byok: true` with a configured provider key.
    `402 INSUFFICIENT_CREDITS` when balance < cost.
  - Idempotency: client may send `Idempotency-Key` header; duplicate key within
    24h returns the original job instead of creating a new one.
- `GET /jobs/:id` → `200 { job }` (owner only)
- `GET /jobs?tool=&status=&page=&limit=` → `200 { jobs: [...], pagination }`
- `POST /jobs/:id/cancel` → `200 { job }` (only when queued/processing)
- `POST /jobs/:id/regenerate` → `201 { job }` (new job, same tool+input; costs credit)
- `DELETE /jobs/:id` → `200 { ok: true }`
- `DELETE /jobs?tool=` → `200 { ok: true, deleted: n }`
- `GET /jobs/:id/export?format=csv` → CSV download (metadata jobs).
  Columns: `filename,title,keywords,description` (keywords joined per platform template).
- `POST /jobs/export` `{ ids: [...], format: "csv" }` → CSV download of many.

`job` shape:
```json
{
  "id": "job_...", "tool": "metadata", "status": "completed", "progress": 100,
  "input": { "uploadId": "up_...", "platform": "adobe_stock" },
  "output": {
    "title": "...", "keywords": ["...", "..."], "description": "...",
    "platform": "adobe_stock"
  },
  "error": null,
  "creditsUsed": 1, "provider": "gemini", "model": "gemini-2.0-flash",
  "durationMs": 2800, "createdAt": "...", "completedAt": "..."
}
```
`output.prompt` for tool `prompt`: `{ "prompt": "..." }`.
`output.deep`: `{ "components": [{ "name": "...", "detail": "..." }], "summary": "..." }`.
`output.ip-risk`: `{ "risk": "low|medium|high", "findings": ["..."], "summary": "..." }`.
`output.tracker-search`: `{ "assets": [{ "id": "...", "title": "...", "thumbnail": "..." }], "total": n }`.

### Batch

- `POST /jobs/batch` `{ tool: "prompt"|"metadata", items: [ {uploadId, ...overrides} ], common?: {...} }`
  → `201 { batch: { id: "batch_...", status: "queued", total: n, jobs: [{id, status}] } }`
  - Costs 1 credit per item (or byok). Fails fast with 402 if balance insufficient.
- `GET /batches/:id` → `200 { batch: { id, status, total, queued, processing, completed, failed, jobs: [...] } }`

## Platforms

- `GET /platforms` → `200 { platforms: [ { id: "adobe_stock", name: "Adobe Stock", titleMin: 20, titleMax: 70, keywordMin: 30, keywordMax: 50, keywordType: "mixed", notes: "..." }, ... ] }`
  Include: adobe_stock, shutterstock (titleMax 200, keywordMin 25, keywordMax 50),
  vecteezy, depositphotos, 123rf, dreamstime, general (no limits).

## Settings

- `GET /settings` → `200 { settings: {
    "defaultPlatform": "adobe_stock", "theme": "dark"|"light",
    "defaultProvider": "gemini",
    "providers": {
      "gemini":  { "configured": true,  "masked": "••••ab12", "model": "gemini-2.0-flash" },
      "groq":    { "configured": false, "masked": null, "model": "llama-3.2-90b-vision-preview" },
      "mistral": { "configured": false, "masked": null, "model": "pixtral-12b-2409" },
      "openai":  { "configured": false, "masked": null, "model": "gpt-4o-mini" }
    } } }`
- `PUT /settings` `{ defaultPlatform?, theme?, defaultProvider?, providers?: { gemini?: { apiKey?: string, model?: string }, ... } }`
  → `200 { settings }` (same masked shape). Empty-string apiKey clears the key.
  Keys encrypted at rest (AES-256-G. Never returned in full.
- `POST /settings/providers/:name/test` → `200 { ok: true, model, latencyMs }`
  or `200 { ok: false, error }` (provider auth/network failure surfaced readably).

## Billing & credits

- `GET /billing/plans` → `200 { plans: [ { id: "newbie", name: "Newbie", price: 49, currency: "BDT", interval: "month", creditsPerMonth: 30, features: [...] }, { id: "pro", ... 99, 60 credits ... }, { id: "free", price: 0, creditsPerDay: 5, ... } ] }`
- `GET /billing/me` → `200 { plan: "free", credits: 5, creditsResetAt: "...", subscription: null }`
- `POST /billing/checkout-session` `{ planId }` → `501 { error: { code: "PROVIDER_NOT_CONFIGURED", message: "Checkout is not configured yet." } }`
  until Stripe env vars exist; then `200 { url }`.
- `GET /credits` → `200 { balance, dailyFreeRemaining, resetsAt }`
- `GET /credits/ledger?page=&limit=` → `200 { data: [{ id, delta, reason, jobId, createdAt }], pagination }`
  Reasons: `signup_bonus`, `daily_grant`, `job_spend`, `job_refund`, `redeem`, `referral`, `task_reward`, `plan_grant`.

## Referral & redeem

- `GET /referral/me` → `200 { code, url, referredCount, earnedCredits }`
- `POST /redeem` `{ code }` → `200 { ok: true, creditsAdded }` / `422` invalid|used|own-code.
- `GET /redeem/history` → `200 { data: [...], pagination }`

## Task Center (simplified)

- `GET /tasks` → `200 { tasks: [ { id: "complete-profile", title, description, credits: 2, status: "available"|"completed" }, ... ] }`
  Tasks: `complete-profile` (set name), `connect-provider` (save a provider key),
  `first-generation` (complete first job), `invite-friend` (first referral signup).
- `POST /tasks/:id/claim` → `200 { ok: true, creditsAdded }` / `422` if incomplete.

## Reviews

- `GET /reviews/summary` → `200 { average: 4.8, count: 132 }`
- `GET /reviews?page=&limit=` → `200 { data: [{ id, name, rating, comment, createdAt }], pagination }`
- `POST /reviews` `{ rating: 1..5, comment }` → `201 { review }` (auth; one per user — update if exists)

## Tracker (optional external API)

- `GET /tracker/search?q=&limit=20&offset=0` → `200 { assets: [...], total }`
  or `501 PROVIDER_NOT_CONFIGURED` when `ADOBE_STOCK_API_KEY` is unset.
- `GET /tracker/contributor?creatorId=&limit=20&offset=0` → same.

## Health

- `GET /health` → `200 { ok: true, version }` (no auth)
