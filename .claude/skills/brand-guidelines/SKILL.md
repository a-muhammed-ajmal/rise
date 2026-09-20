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

## Visual rules

Read [the canonical frontend design system](../frontend-design/DESIGN_SYSTEM.md) for color roles, typography, graph texture, theme behavior and motion. app/globals.css owns runtime values.

Navy and gold are the brand colors. Keep Inter at 400/500/600, including headings; no 700/800 weights. Use the faint grid on the app shell, neutral cards and small accents. Existing semantic status, module and life-area colors retain their meanings and are not additional brand accents.

The original logo rules above remain in force. Historical orange-theme wording and duplicated token tables are superseded by the canonical specification.
