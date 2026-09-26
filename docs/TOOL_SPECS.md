# Tool Specifications — PromptLens

All tools run as async jobs: `POST /api/v1/jobs { tool, input }` →
`queued → processing → completed|failed`. Cost: 1 credit, or 0 with
`byok:true` + your own configured provider key, or 0 on the mock provider
(demo output, labeled in UI). Frontend polls every 2s while active.

## 1. AI Prompt Generator (`tool: "prompt"`) — single + batch

**Purpose:** turn an image into a free-form descriptive prompt for AI image
generators (Midjourney / DALL-E / Stable Diffusion style).

**Inputs**
| field | required | notes |
|---|---|---|
| uploadId | yes | from `POST /uploads` (JPG/PNG/WebP ≤100MB) |
| outputStyle | no | default `"art_prompt"` |
| ipSafe | no | bool — avoid brand/IP-specific wording |
| iconMode | no | bool — concise icon-style wording |
| byok | no | bool — use your own provider key, no credits |

Batch: `POST /jobs/batch { tool:"prompt", items:[{uploadId,…}], common:{…} }`;
per-item statuses aggregated at `GET /batches/:id`.

**Processing:** image + `art_prompt` template → vision model → free text.
**Output:** `{ prompt }` plus `durationMs`, `provider`, `model` on the job.
**UI:** result card, Copy, Regenerate (new job, same input), "generated in Xs".

## 2. Stock Metadata Generator (`tool: "metadata"`)

**Purpose:** title + keywords + description shaped to a marketplace's
submission rules.

**Inputs:** `uploadId` (req), `platform` (default `adobe_stock`; one of
`adobe_stock, shutterstock, vecteezy, depositphotos, 123rf, dreamstime, general`),
`titleMin/titleMax`, `keywordMin/keywordMax` (default from platform),
`keywordType` (`mixed` default), `customPrompt`, `customKeywords`, `byok`.

**Platform rules (defaults, editable per request):**
- Adobe Stock: title 20–70 chars, 30–50 keywords
- Shutterstock: title ≤200 chars, 25–50 keywords
- Vecteezy / Depositphotos / 123RF / Dreamstime: analogous limits (see `platforms` table)
- General: no limits

**Processing:** vision model instructed to return strict JSON
`{title, keywords[], description}` → validated against limits → **one automatic
correction retry** if invalid → warnings recorded if still off (never silently
truncated).

**Outputs:** title (with char count vs limits), keyword chips (click-to-copy),
Copy all, description, CSV export (`filename,title,keywords,description`;
keywords joined per marketplace template).

## 3. Deep Analysis (`tool: "deep"`)

**Purpose:** structured breakdown of an image's visual components.

**Inputs:** `uploadId`, `byok`. **Output:** `{ components: [{name, detail}…],
summary }` — subject, composition, lighting, color, style, mood, etc.
**UI:** component cards.

## 4. IP Risk Check (`tool: "ip-risk"`)

**Purpose:** flag recognizable trademarks, logos, characters, or other IP risk.

**Inputs:** `uploadId`, `byok`. **Output:** `{ risk: low|medium|high,
findings[], summary }`. **UI:** risk badge + findings list. (Advisory, not legal advice.)

## 5. Adobe Tracker (`tool: "tracker-search" | "tracker-contributor"`)

**Purpose:** search stock assets / look up a contributor.

**Inputs:** `tracker-search`: `{q, limit?, offset?}`; `tracker-contributor`:
`{creatorId, limit?, offset?}`. **Requires** `ADOBE_STOCK_API_KEY`; without it
the API returns `501 PROVIDER_NOT_CONFIGURED` and the UI shows a setup-state
empty page. Results are still wrapped as jobs for uniform history.

## Common behaviors

- **Validation:** 422 with field messages before any credit is touched.
- **Insufficient credits:** 402 `INSUFFICIENT_CREDITS`.
- **Provider failure:** job `failed`, credit **refunded**, human-readable
  `error.message` (no stack traces to clients).
- **Cancel:** `POST /jobs/:id/cancel` while queued/processing.
- **Regenerate:** `POST /jobs/:id/regenerate` (new job, costs again).
- **History:** `GET /jobs?tool=&status=` + pagination; detail modal; delete
  single / clear all; bulk CSV export for metadata jobs.
- **Idempotency:** `Idempotency-Key` header dedupes job creation for 24h
  (prevents double-charge on network retries).
