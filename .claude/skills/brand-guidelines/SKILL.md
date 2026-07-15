---
name: brand-guidelines
description: Applies RISE OS's official brand — orange accent, Inter-only type, charcoal-navy dark mode, graph-paper signature — to any artifact, document, or UI surface that should carry RISE's look-and-feel. Use when brand colors, style guidelines, visual formatting, or company design standards apply outside of full component implementation (e.g. one-off artifacts, marketing copy, presentations, README banners). For building actual app components, pages, or interfaces, use frontend-design instead — it owns the complete token system and implementation rules.
---

# RISE OS Brand Guidelines

Quick-reference brand identity for anything that needs RISE's look without full component engineering. For building real UI (components, pages), defer to the `frontend-design` skill — it is the source of truth for tokens, accessibility, and implementation rules; this skill is a distilled subset of it.

---

## Identity in one line

**Charcoal-navy + orange.** No black, no purple, no decorative gradients. A single typeface (Inter) carries all hierarchy through weight, not font-switching. A faint graph-paper grid is the recurring brand signature — it should read as "product OS," not "marketing site."

---

## Color

| Token             | Hex       | Use                                                  |
|--------------------|-----------|-------------------------------------------------------|
| `--brand`          | `#FF6535` | Primary accent — CTAs, active states, focus rings     |
| `--brand-hover`     | `#FF8159` | Hover state / gradient end for orange elements        |
| `--brand-text`      | `#D6450F` | Orange text on white (meets WCAG AA 4.5:1 — `#FF6535` fails on white) |
| `--brand-tint`      | `#FFF0EB` | Badge / chip / tinted fill backgrounds                |
| `--surface-dark`    | `#1A1A2E` | Dark sections — navy, never pure black                |
| `--text-strong`     | `#1A1A2E` | Headings, primary text                                |

Semantic status colors (not brand accents — use only for their meaning):

| Status    | Hex       |
|-----------|-----------|
| Success   | `#10B981` |
| Danger    | `#E11D48` |
| Warning   | `#F59E0B` |

**Rule:** Orange is the *only* brand accent. Never introduce a second accent hue for emphasis — reach for weight, size, or the orange instead.

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
