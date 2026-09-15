---
name: brand-guidelines
description: Applies RISE OS's official brand — the three-leaf mark, deep-navy identity with a golden-yellow accent, Inter-only type, charcoal-navy dark mode, graph-paper signature — to any artifact, document, or UI surface that should carry RISE's look-and-feel. Use when brand colors, style guidelines, visual formatting, or company design standards apply outside of full component implementation (e.g. one-off artifacts, marketing copy, presentations, README banners). For building actual app components, pages, or interfaces, use frontend-design instead — it owns the complete token system and implementation rules.
---

# RISE OS Brand Guidelines

Quick-reference brand identity for anything that needs RISE's look without full component engineering. For building real UI (components, pages), defer to the `frontend-design` skill — it is the source of truth for tokens, accessibility, and implementation rules; this skill is a distilled subset of it.

---

## Identity in one line

**Deep navy + golden yellow**, the two colours of the three-leaf mark. No black, no purple, no decorative gradients. A single typeface (Inter) carries all hierarchy through weight, not font-switching. A faint graph-paper grid is the recurring brand signature — it should read as "product OS," not "marketing site."

---

## Logo

The mark is a **three-leaf growth symbol** — one golden-yellow leaf above two
deep-navy leaves, around clean central negative space. It is final artwork:
never redraw, recolour, rotate, stretch, crop, outline, add gradients or
shadows to it, or place it inside a decorative container.

**Source of truth:** `public/rise-logo.svg`. In the app, always render it
through the single `<RiseLogo />` component (`components/brand/rise-logo.tsx`),
which inlines that geometry — never hardcode an `<img>` or re-paste the paths.

| Need | Use |
|---|---|
| Scalable UI (sidebar, topbar, nav, login) | `<RiseLogo />` — inline SVG |
| App icons, favicons, social metadata | the supplied PNGs in `public/` |
| Print / export | `RISE-logo-vector.pdf` |

**Dark surfaces.** The navy leaves measure 1.2:1 on the `#0B1120` ground, so
the mark is never dropped bare onto a dark background. Prominent placements pass
`plate`, which sits the mark on a light container at its master colours. Small
inline uses (16–20px feature icons) instead rely on `--brand-mark`, which
lightens **only** the navy group in dark mode to `#8FA8C8` (7.0:1); the golden
leaf and the geometry never change. Never invert the mark to a silhouette — that
destroys its two-tone character.

**Clear space** is ~20% of the mark's width on all sides; the supplied square
PNGs already carry it, so use those as-is for icon contexts.

**Naming and accessibility.** The product is spelled exactly **RISE** — never
Rise, RISE AI, or RISE OS. Do not add a tagline, and never put text inside the
mark. Where the mark sits beside visible "RISE" text it is decorative
(`aria-hidden`); where it stands alone its accessible name is `RISE`, never a
description of the artwork.

---

## Color

| Token             | Hex       | Use                                                  |
|--------------------|-----------|-------------------------------------------------------|
| `--brand`            | `#0C2443` | Primary identity — accents, borders, icon fills, focus |
| `--brand-action`     | `#0C2443` | Filled surfaces (buttons, FABs) — white text 15.6:1    |
| `--brand-hover`      | `#16365C` | Hover / gradient end — white text 12.2:1               |
| `--brand-text`       | `#0C2443` | Navy text on white — 15.6:1                            |
| `--brand-tint`       | `#EEF2F8` | Badge / chip / tinted fill backgrounds                 |
| `--brand-accent`     | `#FDB304` | Golden yellow — highlights and active/selected only    |
| `--brand-accent-tint`| `#FFF6E0` | Accent chip backgrounds                                |
| `--surface-dark`     | `#1A1A2E` | Dark sections — navy, never pure black                 |
| `--text-strong`      | `#1A1A2E` | Headings, primary text                                 |

**Dark mode shifts the roles.** Navy is invisible on the dark ground (1.2:1 on `#0B1120`), so `--brand-action` lifts to `#2E5488` (white text 7.7:1) for fills and the golden yellow takes over `--brand` / `--brand-text` for accents, rings and indicators (10.4:1).

Semantic status colors (not brand accents — use only for their meaning):

| Status    | Hex       |
|-----------|-----------|
| Success   | `#10B981` |
| Danger    | `#E11D48` |
| Warning   | `#F59E0B` |

**Rule:** Navy and golden yellow are the *only* brand colours, and they are not interchangeable — navy carries identity and fills, yellow is reserved for highlights and active/selected state. Never introduce a third accent hue for emphasis; reach for weight, size, or the accent instead. Never set yellow as text on white (1.8:1).

## Typography

- **Single typeface: Inter.** No exceptions — no serif, no secondary display font.
- Hierarchy comes from **weight**, not font changes: 400 body → 500 medium emphasis → 600 section heads → 700 titles → 800 hero display.
- **`font-bold` (700 as a Tailwind class) is banned in-app** — use the heading scale token instead. 800 is reserved for hero display only.
- Tracking: `-0.02em` on anything ≥20px (tightens large type). Eyebrow labels go the other way: `+0.15em` uppercase.
- No fluid `clamp()` scaling — use the fixed type scale.

## Brand Signature: Graph-paper grid

The one non-negotiable visual motif. Every section carries a faint grid:
- Light sections → faint **navy** lines
- Dark sections → faint **orange** lines
- Cell size: 40×40px

This is what makes an artifact read as "RISE" at a glance — a plain white or navy fill without it is off-brand.

## Motion character

- Signature ease: `cubic-bezier(0.16, 1, 0.3, 1)` for brand slide-ins.
- Entrances stagger in 0.08s increments.
- Hover = subtle lift (`translateY(-1px)`) + shadow increase. Active = scale to `0.96–0.97`.
- Nothing longer than 400ms for UI interactions. Respect `prefers-reduced-motion`.
- No AI-pulse / glow effects except the orange CTA shadow (`--shadow-brand`) — AI has no separate visual identity from the core brand.

## Dark mode

Opt-in, not default. Navy family throughout — **never pure black, never pure white text**:
- Surfaces: `#0B1120` → `#151527` → `#1A1A2E` → `#232338` (elevation via lighter surface, not shadow)
- Text: off-white `#E9EAF2`, not `#FFFFFF` (avoids glare)
- Orange appears on hover/focus/active only — hairline neutral borders at rest
- Graph-paper grid flips to orange automatically

## Do / Don't

| Don't | Do |
|---|---|
| Any font other than Inter | `font-family: var(--font-sans)` always |
| Hardcoded hex in code | CSS custom property token |
| A second accent color for "variety" | Orange only — vary weight/size instead |
| Pure black dark mode | Navy family (`#1A1A2E` base) |
| Pure white text on dark | Off-white (`#E9EAF2`) |
| Decorative/rainbow gradients | Orange CTA glow + graph-paper only |
| Flat background with no texture | Graph-paper grid (40×40px) |

---

For full implementation detail — component tokens, radii, shadows, layout breakpoints, accessibility requirements, and anti-patterns for actual code — see [`frontend-design`](../frontend-design/SKILL.md).
