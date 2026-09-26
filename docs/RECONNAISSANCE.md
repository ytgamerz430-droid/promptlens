# Reconnaissance Report — PromptLens (target: promptlens.site)

Observed 2026-09-26 via live browser session. No accounts created, no jobs submitted;
only public pages and safe client-side validation probes. All copy below is paraphrased.

## 1. What the product is

PromptLens turns an uploaded photo into ready-to-use text for AI image tools and
stock-photo marketplaces. Two headline workflows:

1. **AI Prompt Generator** — upload an image, get a free-form descriptive prompt
   suitable for Midjourney / DALL-E / Stable Diffusion style generators.
2. **Stock Metadata Generator** — upload an image, pick a marketplace, get a title,
   keyword set, and description shaped to that marketplace's submission rules
   (title length limits, keyword count limits), with per-keyword copy chips and
   CSV export matching each marketplace's upload template.

Supporting tools: batch processing of multiple images, a deep visual analysis view,
an IP/trademark risk check, and an "Adobe Tracker" for looking up stock assets or
contributors. Auth-gated areas (observed only as redirects): dashboard, history,
settings, billing, referral, redeem codes, a task center that grants credits, and
a reviews surface.

Credit model: free credits granted at signup (public copy mentions a small daily
free allowance); generation costs credits. BYOK supported — users may supply their
own Gemini / Groq / Mistral API keys instead of spending platform credits.

## 2. Route map (observed)

| URL | Purpose | Auth | Notes |
|---|---|---|---|
| `/` | Marketing landing | No | Sticky header, hero with animated demo widget, features, how-it-works, tutorial, reviews, FAQ, pricing, CTA, footer |
| `/login` | Sign in | No | Email + password, "forgot password" link, Google OAuth button, link to register |
| `/register` | Sign up | No | Name + email + password (min 8 chars), Google OAuth, link to login |
| `/forgot-password` | Reset request | No | Email only, "send reset link" |
| `/dashboard` | App shell | Yes → redirects to `/login` | Not observable anonymously |
| `/robots.txt`, `/sitemap.xml` | — | — | Both serve the app's 404 page |

No terms/privacy pages exist; the footer repeats nav anchors plus auth links.

Observed client validation messages (empty-submit probes, nothing submitted):
- login: invalid email / missing password messages; native browser email check
- register: name required, valid email required, password min 8 chars

## 3. Auth architecture (from shipped client bundle)

- Firebase Auth for identity (email/password + Google), client exchanges the
  Firebase ID token at `POST /auth/firebase` (optional referral code) for a
  first-party JWT.
- JWT stored in browser localStorage, sent as `Authorization: Bearer` on API calls.
- 401 responses trigger global logout handlers.
- Our implementation will use an independent auth system (own passwords/ sessions)
  with the same observable UX.

## 4. Tool specifications (reconstructed)

### 4.1 AI Prompt Generator (single + batch)
- Inputs: image file upload (multipart) or `imageUrl` (JSON); output style
  (default "art_prompt"); flags for IP-safe wording, icon mode, and BYOK.
- Batch: array of items in one request; queue shows per-item states
  (queued → generating → success/failed).
- Output: free-form prompt text, generation time shown (e.g. "generated in 2.8s"),
  copy actions.

### 4.2 Stock Metadata Generator
- Inputs: image file or URL; `platform` (default adobe_stock); six marketplaces:
  Adobe Stock, Shutterstock, Vecteezy, Depositphotos, 123RF, Dreamstime; plus a
  "General" free-form mode. Optional: title min/max length, keyword min/max count,
  keyword type (default "mixed"), custom prompt text, custom keywords, BYOK flag.
- Advertised per-marketplace rules (to reproduce as defaults):
  - Adobe Stock: title 20–70 chars, 30–50 keywords
  - Shutterstock: title ≤ 200 chars
  - (other marketplaces: apply sensible analogous limits, documented as our defaults)
- One automatic retry if the first draft violates the limits.
- Outputs: title, keyword chips (individually copyable), description; "Copy all";
  CSV export shaped per marketplace template.

### 4.3 Deep Analysis
- Image in → structured breakdown of visual components (subject, composition,
  lighting, color, style, mood, etc.).

### 4.4 IP Risk Check
- Image in → assessment of trademark/logo/recognizable-IP risk.

### 4.5 Adobe Tracker
- Search stock assets (`q`, limit/offset) and look up contributors (`creatorId`).

### Lifecycle states (from marketing demo + tour)
idle → ANALYZING (spinner) → SUCCESS badge → results card with timing.
Batch queue: queued → generating… → SUCCESS / failed.

## 5. Pricing / limits (partially observed, inconsistent)

One homepage load showed real plans (currency BDT): a starter tier (~49/mo, ~30
metadata credits/mo, all marketplaces, keyword chips + CSV, BYOK, monthly reset)
and a popular pro tier (~99/mo, ~60 credits/mo, adds batch + custom prompts +
priority queue). Later loads showed placeholder "$9/$29/$79" filler tiers —
treat pricing as unverified. Other observed limits: JPG/PNG/WebP, ≤100MB per file;
batch processed a few at a time; referral program grants BYOK credits; task center
grants temporary credits.

## 6. Design tokens (from stylesheet)

- Theme: dark default, light optional (`html[data-theme]`). Dark surfaces:
  near-black blues (`#08090d`, `#0f111a`, `#161925`, `#1f2333`, `#2a2f42`);
  text warm off-white `#f5f2e9`, muted `#b7bacb`/`#7c7f95`. Accent amber `#e8a33d`
  (bright `#f4c078`, ink `#14110a`). Success `#6fd39a`, danger `#e2604b`,
  info `#5fb2ea`; hairline borders (white 8–14%).
- Light theme: warm ivory (`#f4efe4`, `#ffffff`, `#faf7f0`), deep amber accent
  (`#92400e`), dark-ink text.
- Body background has fixed radial accent glows (amber/green, low alpha).
- Fonts: Fraunces (display serif for headlines) + Inter (body), monospace stack
  for code. Loaded from Google Fonts.
- Components: 16px-radius cards with 1px border; 10px-radius inputs
  (bg-2 surface, strong border, 9px/12px padding, accent focus ring, danger error
  state); buttons 10px radius, 9px/16px, 14px semibold — primary (solid amber,
  dark text, brightens on hover), secondary (surface + border), ghost, danger
  tint; 11px uppercase pill badges (success/danger/info/accent/neutral); 12.5px
  copyable keyword chips (accent border on hover); shimmer skeletons; toasts;
  Lucide-style icons. App shell: 260px sidebar (76px collapsed) + 64px topbar.

## 7. Responsive

Breakpoints ~640/768/1024px. Header nav collapses below 768px (menu control
rendered only on small screens). Grids go single-column → 2/4 columns at sm/lg.
Hero type scales up at sm. Toasts full-width ≤480px. Sidebar collapsible.

## 8. Observed API shape (method + path + purpose only; their host, not ours)

- `POST /auth/firebase` — exchange IdP token (+ optional referral) for app JWT
- `GET /auth/me`, `PATCH /auth/me` — profile
- `POST /generate` — single prompt job (multipart or JSON)
- `POST /generate/batch` — batch prompt jobs
- `POST /adobe-stock/metadata` — marketplace metadata job
- `GET /adobe-tracker/search`, `GET /adobe-tracker/contributor`
- `POST /analyze/deep`, `POST /analyze/ip-risk`
- `GET /history?page&limit`, `DELETE /history/:id`, `DELETE /history`
- `GET /settings`, `PUT /settings`, `GET /settings/platform`
- `GET /billing/plans`, `POST /billing/checkout-session`
- `GET /unlock/tasks`, `POST /unlock/start`, `POST /unlock/claim`
- `GET /referral/me`, `POST /redeem`, `GET /redeem/history`
- `GET /reviews/summary`, `GET /reviews`, `GET /reviews/me`, `POST /reviews`

Client used 60s HTTP timeout, TanStack Query caching, no WebSocket/SSE/polling
strings found — status likely via request/response + refetch.

## 9. Limitations / unknowns (require an account)

Actual tool workspace UI, batch queue UI, history UI, credit-balance display,
settings screens, task center, checkout, referral dashboard, review submission,
real backend validation messages, generation lifecycle details, and file error
messages could not be observed. The referenced `app.*` subdomain is dead.
Pricing renders inconsistently — unverified. A Chrome extension is mentioned in
metadata but not linked on-site.
