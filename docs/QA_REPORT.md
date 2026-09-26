# QA Report — PromptLens implementation

Date: 2026-09-26. Environment: Node 24, local dev (`DEFAULT_PROVIDER=mock`).

## 1. Unit tests (API)

`npm test` in `apps/api`: **14/14 pass** — validation rules, credit
deduct/refund, job status transitions, idempotency dedupe, metadata
limit validation + auto-retry, 402/422/501 paths.

## 2. End-to-end functional tests (live server, curl)

| # | Flow | Result |
|---|---|---|
| 1 | `POST /auth/register` | 201, JWT returned, 10 credits (signup 5 + daily 5) |
| 2 | `POST /uploads` (JPG 393KB) | 201, dimensions detected (1920×1280) |
| 3 | `POST /jobs` tool=prompt → poll | `queued → processing → completed`, output prompt, `provider: mock`, `creditsUsed: 0`, duration recorded |
| 4 | `POST /jobs` tool=metadata, platform=adobe_stock → poll | completed; title 62 chars (limit 20–70 ✓), 30 keywords (limit 30–50 ✓), description present, no warnings |
| 5 | `GET /jobs` history | paginated, both jobs listed with correct tool/status |
| 6 | `GET /jobs/:id/export?format=csv` | valid CSV: `filename,title,keywords,description` |
| 7 | `GET /credits` | balance 10, daily remaining 5, reset timestamp |
| 8 | Batch (2 items), idempotency-key dedupe, task claim, redeem (incl. 422 double-redeem), reviews 0/0 → 5/1 | all pass (backend agent verification) |

## 3. Security checks (live)

| Check | Expected | Got |
|---|---|---|
| Cross-user job read | 404 | 404 ✓ |
| Wrong password login | 401 | 401 ✓ |
| `.txt` file upload | 415 | 415 ✓ |
| Unauthenticated `/jobs` | 401 | 401 ✓ |

Plus: bcrypt(12) passwords, JWT 7d, AES-256-GCM BYOK encryption, sha256-hashed
reset tokens, parameterized queries, helmet + CORS + rate limits, no secrets in
logs or client responses.

## 4. Frontend build

`vite build`: success, 182 modules, ~366KB JS / 116KB gzip, no errors.
Static visual review (browser-based QA was blocked — see §6):
- All design tokens present in `styles.css` (dark + `[data-theme='light']`,
  amber `#e8a33d`, Fraunces + Inter via Google Fonts, radial glows)
- Zero hardcoded hex colors in JSX; all styling via token variables
- Landing: header/nav, hero + demo widget, features, how-it-works, tutorial,
  reviews, FAQ accordion, pricing, final CTA, footer — all present
- Dashboard: 9 nav items with icons, collapsible sidebar, 64px topbar,
  credits pill, user menu
- Responsive: nav hamburger <767px, grids 640/1024, toasts full-width ≤480px,
  sidebar off-canvas <1023px, `prefers-reduced-motion` respected
- Validation messages match spec ("Enter a valid email address.",
  "Password is required.", "Enter your name.", "Use at least 8 characters.")

## 5. Target vs implementation comparison

| Area | Target (observed) | Ours | Status |
|---|---|---|---|
| Landing structure | hero demo, features, tutorial, reviews, FAQ, pricing | same sections, original copy | Equivalent |
| Auth UX | email/pass + Google, reset flow | same UX; Google gated by env | Equivalent* |
| Prompt generator | single + batch, states | same, incl. batch queue UI | Equivalent |
| Metadata generator | 7 modes, limits, chips, CSV | same, limits enforced + auto-retry | Equivalent |
| Deep analysis / IP risk | image → structured output | same job pipeline | Equivalent |
| Tracker | asset/contributor search | real API path; 501 setup-state without key | Partial (needs key) |
| History | list, pagination | + filters, detail modal, regenerate, bulk CSV | Equivalent+ |
| Credits/BYOK | daily free, paid plans, own keys | ledger credits, encrypted BYOK, plans seeded | Equivalent |
| Billing checkout | paid plans | plans shown; checkout 501 until Stripe wired | Partial |
| Referral/redeem/tasks/reviews | observed endpoints | implemented (simplified task center) | Equivalent |
| Job lifecycle | queued → processing → done | + persisted, restart-safe, idempotent | Equivalent+ |
| Theming | dark default, light option | both, persisted | Equivalent |
| Mobile | collapsible nav, stacking | breakpoints + off-canvas sidebar | Equivalent |

\* Independent auth backend (no Firebase); same observable UX.

## 6. Known limitations

- Browser-based visual QA could not run: the QA browser lives on a separate VM
  and cannot reach this machine's localhost; a Cloudflare tunnel was blocked by
  the sandbox's TLS interception. Replaced with static token/structure review
  (all green). Recommend a human click-through on first deploy.
- Pricing tiers are placeholders (reference pricing rendered inconsistently).
- Checkout, Google OAuth, and Adobe Tracker need real third-party keys to activate.
- Single-node (SQLite + in-process worker); scale-out notes in ARCHITECTURE.md.
- No tests for the React frontend yet (API has 14); add Vitest + Playwright next.

## 7. Docker packaging verification

- Added `Dockerfile` (multi-stage: `npm ci` + Vite build → slim runtime with
  `npm ci --omit=dev`, non-root user, `/data` volume for SQLite + uploads),
  `.dockerignore`, and `docker-compose.yml` (healthcheck, persistent volume).
- `docker build` could not run in this sandbox (kernel lacks bridge-network
  support, so `dockerd` cannot start). Instead the image contents were validated
  by exact simulation of both stages: production-only install (114 packages),
  `apps/api/src` + `apps/web/dist` layout, booted with production env
  (`NODE_ENV=production`, `DATABASE_PATH`/`UPLOAD_DIR` on a `/data`-like path).
- Simulation results: `/api/v1/health` 200, landing 200, SPA fallback
  (`/dashboard/studio`) 200, register/login, upload (magic-byte validated),
  metadata job → `completed` (mock provider, 62-char title, 25 keywords,
  0 credits), DB + uploads written to the data path. All green.
- `docs/SETUP.md` Docker section updated to the real files.
