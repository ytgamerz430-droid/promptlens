# Setup Guide — PromptLens

## Prerequisites

- Node.js 18+ (24 recommended), npm 9+
- No database server needed (SQLite file). No Redis needed (in-process worker).

## 1. Install

```bash
cd promptlens-clone
npm install            # installs api + web workspaces
```

## 2. Configure

```bash
cp .env.example apps/api/.env
```

Edit `apps/api/.env` — the important keys:

| Key | Purpose |
|---|---|
| `SESSION_SECRET` | **Required.** Long random string (JWT signing + provider-key encryption). |
| `DEFAULT_PROVIDER` | `mock` for demo output without keys; otherwise the provider to use. |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `MISTRAL_API_KEY` / `OPENAI_API_KEY` | Server-level AI keys (optional — users can also add their own in Settings → AI Providers). |
| `*_MODEL` | Override default models per provider. |
| `SIGNUP_CREDITS`, `DAILY_FREE_CREDITS` | Credit economy tuning. |
| `SMTP_*` | Optional — password-reset emails. Without it, tokens are logged (dev). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional — enables "Continue with Google". |
| `ADOBE_STOCK_API_KEY` | Optional — enables the Tracker tool. |

## 3. Run (development)

```bash
npm run dev            # API on :4000, web on :5173 (proxies /api + /uploads)
```

Open http://localhost:5173. Register an account — with `DEFAULT_PROVIDER=mock`
tools work immediately with clearly-labeled demo output.

## 4. Add a real AI provider (two ways)

**A. Your own key (recommended for testing):** log in → Settings → AI Providers →
paste a key for Gemini, Groq, Mistral, or OpenAI → Test connection. Jobs with
`byok` use it and cost 0 credits. Keys are AES-256-GCM encrypted at rest.

**B. Server key:** set e.g. `GEMINI_API_KEY` in `apps/api/.env` and restart.
All non-BYOK jobs use it (1 credit each).

Get keys: [Google AI Studio](https://aistudio.google.com/app/apikey),
[Groq Console](https://console.groq.com/keys), [Mistral Console](https://console.mistral.ai/api-keys),
[OpenAI](https://platform.openai.com/api-keys).

## 5. Tests

```bash
npm test               # API unit tests (validation, job lifecycle, credits)
```

## 6. Production build

```bash
npm run build          # builds web → apps/web/dist
npm start --workspace apps/api   # serves API + frontend on PORT (single port)
```

The API serves `apps/web/dist` with SPA fallback in production. Set
`WEB_URL` to your public URL, `SESSION_SECRET` to a strong secret, and run
behind HTTPS (Caddy/nginx).

### Docker

A production `Dockerfile` (multi-stage: builds the frontend, runs the API as a
non-root user) and `docker-compose.yml` are included at the repo root.

```bash
cp .env.example apps/api/.env   # set SESSION_SECRET at minimum
docker compose up --build -d
```

The app is then at http://localhost:4000. SQLite + uploads live in the
`promptlens-data` volume (`/data` in the container), so state survives
restarts and redeploys. Health: `GET /api/v1/health`.

## 7. Troubleshooting

- `PROVIDER_NOT_CONFIGURED` on jobs → set a provider key (step 4).
- Port in use → change `PORT` (and the Vite proxy in `apps/web/vite.config.js` for dev).
- Reset everything → stop server, delete `apps/api/data/`, restart (fresh DB + seeds).
