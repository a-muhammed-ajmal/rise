# Performance — Core Web Vitals for RISE

Fast *is* good design on mobile, and RISE's cockpit density (charts,
skeletons, glass chrome, count-up numbers) makes it easier than most apps
to accidentally blow the budget below. Three field metrics, measured at
the 75th percentile. "Good" means **all three** pass.

| Metric | Measures | Good | Needs work | Poor |
|---|---|---|---|---|
| **LCP** Largest Contentful Paint | loading | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| **INP** Interaction to Next Paint | responsiveness | ≤ 200ms | ≤ 500ms | > 500ms |
| **CLS** Cumulative Layout Shift | visual stability | ≤ 0.1 | ≤ 0.25 | > 0.25 |

---

## LCP ≤ 2.5s

- **Preload the LCP element** and mark it urgent. On most RISE screens
  this is the greeting/top metric card, not an image — preload the
  Lexend/IBM Plex Sans variable font files instead:
  ```html
  <link rel="preload" as="font" type="font/woff2" href="/fonts/lexend-var.woff2" crossorigin>
  ```
- If a screen's LCP element *is* an image (e.g. a journal photo), follow
  the standard rule: AVIF/WebP, sized for display, `fetchpriority="high"`,
  never `loading="lazy"` on it.
- Server-render/stream above-the-fold content (Next.js App Router defaults
  to this — don't fight it with unnecessary `"use client"` on the
  top-of-screen greeting and metric cards).

---

## INP ≤ 200ms — the one RISE has to watch closest

RISE's bottom nav and modals use `backdrop-filter: blur(20px)
saturate(160%)` (`.glass-chrome` in `SKILL.md`). Backdrop blur is
GPU-expensive and on a mid-range Android it can show up as dropped frames
during scroll or nav-switch — test this specifically, don't assume the
dev machine's GPU represents the target device.

- **Keep the blur surface small and static.** Apply `.glass-chrome` to
  the fixed bottom nav and modal sheets only — never to a scrolling
  container, where the browser has to recompute the blur every frame.
- **Break up long tasks** (chart rendering, large list filtering) with
  `scheduler.yield()` or move them off the main thread.
- **Ship less JS per route.** Code-split each module (Tasks, Finance,
  Habits, etc.) — a user opening the Habits tab shouldn't pay for the
  Finance chart library.
- Use `content-visibility: auto` on cards below the fold in long lists
  (journal entries, transaction history) so they don't get laid out and
  painted before they're scrolled into view.

---

## CLS ≤ 0.1

- Every chart container has a fixed `height` (RISE's `.chart-container`
  is 140px by convention — see `SKILL.md`) so nothing reflows when chart
  data finishes loading.
- **Skeletons prevent shift, but only if sized to match the real content.**
  A `.skeleton` card must be the same height as the loaded card it
  replaces — a skeleton that's shorter than the real card *causes* the
  shift it's supposed to prevent.
- Fonts: `font-display: swap` plus Next.js's automatic font-metric
  fallback (via `next/font`) to minimize reflow when Lexend/IBM Plex Sans
  swap in.
- Never insert content above existing content (a new notification banner,
  a sync-status pill) unless it's a direct response to something the user
  just tapped.

---

## RISE-specific timing rules (from `SKILL.md`'s Motion System — repeated
here because they're a performance budget, not just a motion choice)

- **Skeleton threshold: 200ms.** If data resolves faster than that, skip
  the skeleton — showing and immediately hiding it just looks like a
  flash/glitch, and it's wasted paint work.
- **Count-up animation cap: 600ms.** Beyond that, a metric update reads as
  the app struggling rather than computing — and it's also more frames of
  main-thread work than a glance-able number needs.
- **Stagger entrance, don't compute it on every render.** The card-load
  stagger (`nth-child` + `animation-delay`) is a load-time effect — it
  should not re-run every time the same screen's data refreshes in the
  background.

---

## Verify

- [ ] Lighthouse (mobile preset) + a real mid-range Android check — not
      just the dev machine — specifically around the bottom nav and any
      modal open/close.
- [ ] Chart containers have fixed height before data arrives; no shift
      when it loads.
- [ ] Skeleton dimensions match their resolved content exactly.
- [ ] `backdrop-filter` is confined to fixed/static chrome, never a
      scrolling surface.
- [ ] Each module route ships only the JS that module needs.
