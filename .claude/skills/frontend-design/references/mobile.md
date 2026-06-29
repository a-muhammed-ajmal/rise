# Mobile-first playbook — RISE specifics

RISE is built mobile-first by definition — it's a cockpit meant to be read
and tapped one-handed, not a responsive site that happens to work on a
phone. This file expands the Thumb Zone Law from `SKILL.md` into the
practical viewport/breakpoint mechanics.

---

## 1. The Thumb Zone Law, in full

75% of phone interactions use a single thumb, and the top ~40% of a modern
phone screen is a dead zone for comfortable one-handed reach. RISE's
entire screen architecture follows from this:

```
┌─────────────────────┐
│  ░░░ DEAD ZONE ░░░  │  ← Headers, page title, greeting only.
│  ─────────────────  │     No tappable nav lives here.
│                     │
│  ████ CONTENT ████  │  ← Cards, charts, reading. Scrollable.
│  ████ ZONE    ████  │
│  ─────────────────  │
│  ████ ACTION  ████  │  ← Buttons, FAB, inputs, primary CTAs.
│  ████ ZONE    ████  │
│  ═════════════════  │
│  ▓▓▓ BOTTOM NAV ▓▓▓│  ← 5 tabs, always visible, glass chrome.
└─────────────────────┘
```

This means, concretely:
- A screen's `<h1>`/greeting can sit in the dead zone because it's read,
  not tapped.
- Any primary CTA — "Add meal," "Log habit," the AI compose FAB — must be
  reachable in the action zone or inside a bottom sheet triggered from it.
  If a CTA design puts a primary button at the *top* of a screen, that's
  a layout bug per `SKILL.md`'s Anti-Patterns, not a style preference.
- Secondary actions and rarely-used settings can live in the dead zone or
  behind a bottom sheet — the thumb zone is a budget for *primary* actions
  specifically, not everything.

---

## 2. Bottom navigation — the exact spec

```
Home | Today | + (AI Compose) | Insights | Profile
```

- Exactly 5 items. Never more — RISE has no "More" overflow because the
  module set is fixed by design, not user-extensible.
- `height: calc(56px + env(safe-area-inset-bottom))`, `position: fixed`,
  `bottom: 0`, glass chrome (`backdrop-filter: blur(20px)
  saturate(180%)`).
- Every `.nav-item` is `min-width: 44px; min-height: 44px` regardless of
  icon size — this is the touch-target floor, not the icon's visual size.
- The center `+` is the AI compose FAB — purple, glowing, visually
  distinct from the other four (it opens a layer, the other four switch
  screens).

---

## 3. Viewport, safe areas, units

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

- Use `100dvh` for any full-height container (the AI compose bottom sheet
  expanded state, a full-screen onboarding step) so the address bar
  showing/hiding doesn't clip or jump the layout.
- Safe-area insets, always:
  ```css
  .bottom-nav  { padding-bottom: env(safe-area-inset-bottom); }
  .app-header  { padding-top:    max(1rem, env(safe-area-inset-top)); }
  ```
- `font-size: 16px` minimum on any input inside a bottom sheet (settings,
  add-entry forms) — smaller triggers iOS auto-zoom and breaks the sheet's
  layout.

---

## 4. Container queries for the card grid

RISE's `.grid-safe` two-column card layout (defined in `SKILL.md`) should
adapt to *where it's placed*, not just the viewport — a metric card grid
inside a bottom sheet is narrower than the same grid on the Home screen:

```css
.card-grid { container-type: inline-size; }
@container (min-width: 22rem) {
  .card--metric { grid-template-columns: auto 1fr; }
}
```

Use container query units (`cqw`) for type/spacing *inside* a card if the
same card component ever needs to render at two different widths (full
Home screen vs. embedded in a bottom sheet preview).

---

## 5. Breakpoint posture

> **Assumption flagged — confirm this:** RISE is currently scoped as a
> mobile/PWA cockpit, not a responsive desktop product. The breakpoints
> below are a minimal "don't break on a slightly bigger phone or a
> foldable" posture, not a tablet/desktop layout system. If RISE ever
> needs a real tablet or desktop view, that's a new layout pass (sidebar
> nav replacing bottom nav, multi-column dashboard) — not something to
> improvise inside a single component when it comes up. Flag it back to
> me if that's already planned and I'll fold it into `SKILL.md` properly.

```css
/* base = 360px+, single column, bottom nav */
@media (min-width: 28rem)  { /* 448px: large phones, foldables unfolded — grid-safe stays 2-col, just more breathing room */ }
@media (min-width: 40rem)  { /* 640px: small tablets in portrait — only relevant if the assumption above changes */ }
```

Foldables: keep the layout fluid (it already is, via `.grid-safe` and
`clamp()` type) — don't hard-assume one folded/unfolded width.

---

## Mobile pre-ship pass

- [ ] Usable at exactly **360px**, no horizontal scroll, `.grid-safe`
      two-column grid doesn't overflow.
- [ ] No primary CTA placed above the action zone.
- [ ] Bottom nav: exactly 5 items, 44px targets, safe-area padding
      correct on a notched device.
- [ ] `100dvh` used for any full-height sheet/overlay; no jump when the
      address bar shows/hides.
- [ ] Inputs inside bottom sheets are ≥16px font, ≥48px height.
- [ ] Card grids use container queries if the same card type renders at
      more than one width in the app.
