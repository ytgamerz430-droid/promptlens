# Database Schema — PromptLens

Engine: SQLite (`node:sqlite`, WAL mode, foreign keys enforced). File:
`DATABASE_PATH` (default `./data/app.db`). Schema auto-created on boot;
idempotent `CREATE TABLE IF NOT EXISTS`. Timestamps are ISO-8601 UTC text.

## Tables

### users
| field | type | notes |
|---|---|---|
| id | TEXT PK | `u_…` random |
| name | TEXT | |
| email | TEXT UNIQUE | case-normalized |
| password_hash | TEXT NULL | bcrypt; null for Google-only accounts |
| google_id | TEXT UNIQUE NULL | |
| plan | TEXT | `free` default |
| referral_code | TEXT UNIQUE | issued at signup |
| referred_by | TEXT NULL | referrer user id |
| profile_completed | INTEGER | task-center flag |
| created_at / updated_at | TEXT | |

### provider_keys — BYOK credentials, encrypted at rest (AES-256-GCM)
`id PK, user_id FK→users (CASCADE), provider TEXT, encrypted TEXT, model TEXT NULL,
created_at, updated_at`, `UNIQUE(user_id, provider)`.

### user_settings
`user_id PK→users (CASCADE), default_platform ('adobe_stock'), theme ('dark'),
default_provider ('mock'), updated_at`.

### uploads
`id PK (up_…), user_id FK (CASCADE), filename, mime_type, size INTEGER,
width/height INTEGER NULL, path TEXT (disk), created_at`. Index `idx_uploads_user`.

### jobs — the durable queue + result store
| field | notes |
|---|---|
| id | `job_…` PK |
| user_id | FK→users (CASCADE), indexed |
| batch_id | NULL or `batch_…` FK→batches |
| tool | `prompt \| metadata \| deep \| ip-risk \| tracker-search \| tracker-contributor` |
| status | `queued \| processing \| completed \| failed \| cancelled`, indexed |
| progress | 0–100 |
| input_json | TEXT (tool input incl. uploadId, platform, options) |
| output_json | TEXT NULL (tool result) |
| error_code / error_message | NULL on success |
| warnings_json | TEXT NULL (e.g. metadata limit misses after retry) |
| credits_used | 0 or 1 |
| provider / model | adapter + model used (or `mock`) |
| duration_ms | INTEGER NULL |
| idempotency_key | TEXT UNIQUE NULL (24h dedupe window) |
| created_at / updated_at / completed_at | |

Indexes: `(user_id, created_at)`, `(status)`, `(batch_id)`.

### batches
`id PK (batch_…), user_id FK (CASCADE), tool, status, total INTEGER,
created_at, completed_at NULL`.

### credit_ledger — append-only; balance derived
`id PK, user_id FK (CASCADE) indexed, delta INTEGER, reason TEXT
(signup_bonus|daily_grant|job_spend|job_refund|redeem|referral|task_reward|plan_grant),
job_id NULL, note TEXT NULL, created_at`.

### daily_grants
`user_id + day TEXT PK` — one free-credit grant per user per UTC day.

### password_resets
`id PK, user_id FK (CASCADE), token_hash TEXT (sha256), expires_at, used INTEGER,
created_at`.

### referrals
`id PK, referrer_id FK, referred_id FK UNIQUE, credits_awarded, created_at`.

### redeem_codes / redeem_history
`redeem_codes(code TEXT PK, credits INTEGER, max_uses INTEGER, uses INTEGER,
expires_at NULL)`. `redeem_history(id PK, user_id FK, code FK, credits_added, created_at)`.

### tasks / task_completions
`tasks(id PK, slug UNIQUE, title, description, credits)`. Seeded: `complete-profile`,
`connect-provider`, `first-generation`, `invite-friend`.
`task_completions(user_id, task_id, completed_at, PK(user_id, task_id))`.

### reviews
`id PK, user_id UNIQUE FK (CASCADE), rating 1–5, comment TEXT, created_at`
(one review per user; resubmission updates).

### platforms / billing_plans — seeded reference data
`platforms(id PK e.g. adobe_stock, name, title_min, title_max, keyword_min,
keyword_max, keyword_type, notes)`. 7 rows: 6 marketplaces + general.
`billing_plans(id PK, name, price, currency, interval, credits_per_month NULL,
credits_per_day NULL, features_json, sort)`. Seeded: free / newbie / pro.

## Relationships (summary)

users 1—1 user_settings · 1—N provider_keys, uploads, jobs, credit_ledger,
password_resets, reviews · batches 1—N jobs · redeem_codes 1—N redeem_history.

## Migrations

Single idempotent schema bootstrap in `apps/api/src/db.js` (`CREATE TABLE IF
NOT EXISTS` + seed inserts guarded by existence checks). For production
evolution, add versioned migration files under `apps/api/migrations/` and a
`schema_version` table — the bootstrap is structured to allow this.
