# Design Tokens — PromptLens implementation

Single source of truth for both apps. Implement as CSS variables; Tailwind maps to them.

## Themes

Default: **dark**. Toggle to **light** via `html[data-theme="light"]`.
Persist in localStorage key `promptlens_theme`.

### Dark
```
--bg-0: #08090d   (page background)
--bg-1: #0f111a   (card background)
--bg-2: #161925   (input / inset background)
--bg-3: #1f2333   (raised / hover surface)
--bg-4: #2a2f42   (strongest surface)
--text: #f5f2e9
--text-muted: #b7bacb
--text-faint: #7c7f95
--accent: #e8a33d
--accent-strong: #f4c078
--accent-ink: #14110a   (text on accent)
--success: #6fd39a
--danger: #e2604b
--info: #5fb2ea
--border: rgba(255,255,255,0.08)
--border-strong: rgba(255,255,255,0.14)
--glow: fixed radial gradients, amber + green at ~6-10% alpha, behind content
```

### Light
```
--bg-0: #f4efe4
--bg-1: #ffffff
--bg-2: #faf7f0
--bg-3: #efe8d8
--bg-4: #e2d7bd
--text: #1c1710
--text-muted: #474b60
--text-faint: #5c5f74
--accent: #92400e
--accent-strong: #7c3d10
--accent-ink: #ffffff
(same success/danger/info)
--border: rgba(20,15,5,0.10)
--border-strong: rgba(20,15,5,0.18)
```

## Typography

- Display: **Fraunces** (serif) — headlines, hero, section titles. Weights 500–700.
- Body: **Inter** — everything else. Weights 400/500/600/700.
- Mono: `ui-monospace, SFMono-Regular, Menlo, monospace` — ids, timings, code.
- Load Fraunces + Inter from Google Fonts.
- Scale: hero clamp(2.5rem, 6vw, 4.5rem) Fraunces; h2 ~2rem Fraunces; body 1rem/1.6 Inter;
  small 0.875rem; tiny 0.75rem.

## Components

- `.card`: var(--bg-1), 1px var(--border), radius 16px, padding 20–24px.
  Light theme: soft shadow `0 8px 30px rgba(60,40,10,.08)`.
- `.input`: var(--bg-2), 1px var(--border-strong), radius 10px, padding 9px 12px,
  font-size 14px. Focus: accent border + subtle accent ring. Error: danger border.
- `.btn`: radius 10px, padding 9px 16px, 14px/600, inline-flex, gap 8px, centered.
  - `.btn-primary`: accent bg, accent-ink text; hover: accent-strong.
  - `.btn-secondary`: var(--bg-3) bg, var(--border) border, text.
  - `.btn-ghost`: transparent, text-muted; hover text.
  - `.btn-danger`: danger tint bg (`color-mix`), danger text.
  - Disabled: 50% opacity, no pointer.
- `.badge`: 11px, uppercase, 700, pill, variants success/danger/info/accent/neutral
  (tinted bg + colored text).
- `.chip`: 12.5px pill, var(--bg-2), border; `.chip-copy` hover → accent border,
  click copies with toast.
- `.skeleton`: shimmer loading block.
- Toasts: bottom-right (full-width ≤480px), react-toastify styled to theme.
- Focus states: visible accent outline on all interactive elements.

## Layout

- App shell: sidebar 260px (collapsible to 76px icon rail), topbar 64px.
- Marketing: max-w-7xl container, generous section padding (py-20/28), single
  column → sm:2 → lg:4 grids, sticky translucent header.
- Breakpoints: sm 640, md 768, lg 1024. Nav collapses < 768px behind menu button.

## Voice (original copy — do not lift target text)

Warm, plain-spoken, creator-focused. Short sentences. No hype adjectives.
Buttons: "Get started free", "Sign in", "Generate", "Copy all", "Regenerate".
