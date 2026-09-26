# PromptLens — independent implementation

Turn any image into an AI prompt or stock-marketplace-ready metadata
(title, keywords, description). Built from scratch as a functionally
equivalent, architecturally independent reimplementation: our own backend,
database, auth, queue, and provider integrations.

## Quickstart

```bash
npm install
cp .env.example apps/api/.env   # set SESSION_SECRET
npm run dev                      # API :4000, web :5173
```

Then open http://localhost:5173 and register. Tools work out of the box with
clearly-labeled demo output; add a real provider key in Settings → AI Providers
(Gemini, Groq, Mistral, or OpenAI) for live generation.

## What's included

- **Landing page** — hero with live demo widget, features, how-it-works,
  tutorial, reviews, FAQ, pricing, dark/light themes
- **Auth** — email/password (bcrypt + JWT), Google OAuth (when configured),
  forgot/reset password
- **Tools** — AI Prompt Generator (single + batch), Stock Metadata Generator
  (7 platforms, per-marketplace rules, CSV export), Deep Analysis, IP Risk Check,
  Adobe Tracker (needs API key)
- **Platform** — async job queue with worker, credit ledger, history with
  filters/pagination/export, BYOK provider keys (encrypted), referral + redeem
  codes, task center, billing plans, reviews
- **Docs** — see `docs/`

## Repository layout

```
apps/api/      Express API, SQLite, job queue + worker, AI provider adapters
apps/web/      React SPA (landing + dashboard)
docs/          RECONNAISSANCE.md  ARCHITECTURE.md  API_CONTRACT.md
               DATABASE.md  TOOL_SPECS.md  DESIGN_TOKENS.md  SETUP.md
```

## Docs index

| Doc | Contents |
|---|---|
| `docs/RECONNAISSANCE.md` | Behavioral survey of the reference site (routes, tools, auth, design) |
| `docs/ARCHITECTURE.md` | System design, flows, provider abstraction, security |
| `docs/API_CONTRACT.md` | Full REST contract (routes, shapes, errors) |
| `docs/DATABASE.md` | Schema, relationships, indexes |
| `docs/TOOL_SPECS.md` | Per-tool inputs, validation, lifecycle, outputs |
| `docs/DESIGN_TOKENS.md` | Colors, type, components, themes |
| `docs/SETUP.md` | Install, env, providers, tests, production, Docker |

## Status / limitations

- Payments: checkout returns `501` until Stripe is wired (plans + credit display work).
- Google OAuth & Adobe Tracker activate only when their env keys are set (UI degrades gracefully).
- Pricing tiers are placeholders pending real business decisions (reference-site
  pricing rendered inconsistently during research).
- Single-node design (SQLite + in-process worker); see ARCHITECTURE.md for scaling notes.
