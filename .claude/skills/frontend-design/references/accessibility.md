# Accessibility — WCAG 2.2 AA, mapped to RISE's actual tokens

Target **WCAG 2.2 Level AA**. This file maps the standard checklist onto
RISE's real values from `SKILL.md` so there's nothing to re-derive when
shipping a screen — and flags where RISE intentionally exceeds the floor.

---

## Perceivable

- **Text contrast ≥ 4.5:1** — already verified for RISE's two main text
  tokens against `--surface-1`:
  - `--text-primary` (`#E8E8F0`) on `--surface-1` (`#17171C`) = **9.8:1** ✓
  - `--text-secondary` (`#8E8EA0`) on `--surface-1` = **4.6:1** ✓ (just
    passes — don't darken `--text-secondary` further without re-checking
    this number)
  - Any new text/surface pairing (e.g. text on `--surface-2` or
    `--surface-overlay`) needs its own contrast check before shipping —
    don't assume the `--surface-1` numbers carry over, since those
    surfaces are deliberately brighter.
- **Non-text contrast ≥ 3:1** for card borders, nav icons, and focus
  rings against their surface. `--border-active` is tuned for this against
  `--surface-1`/`--surface-2` — re-check if it's ever used against
  `--surface-overlay`.
- **Never rely on color alone.** This is explicit in `SKILL.md`'s
  Anti-Patterns: module colors and semantic data colors (success/warning/
  danger/info) must pair with an icon or label, not stand alone — true
  for the 4px module border *and* for any chart legend.
- **Respect `prefers-reduced-motion`, `prefers-contrast`.** The reduced-
  motion query is mandatory and already specified in `SKILL.md`'s Motion
  System — implement it once, globally, not per-component.
- Content reflows to **320px** without horizontal scroll or loss of
  function — test RISE's `.grid-safe` two-column card grid at this width
  specifically, since two columns is where overflow bugs show up first.

---

## Operable

- **Touch targets: RISE's floor is 44×44px**, stricter than WCAG 2.2's
  24×24px minimum. This is set in `SKILL.md`'s `.nav-item` rule and
  applies to every tappable element, not just nav — it does not shrink
  even when the type scale around it gets smaller.
- **Visible focus on every interactive element.** Use `--border-active`
  for the focus ring, ≥2px, ≥3:1 contrast. RISE is touch-first, but
  keyboard and switch-control access still has to work end to end.
- **Focus not obscured.** RISE's bottom nav and any sticky chrome are
  fixed and glass — make sure a focused element scrolled near the bottom
  edge isn't fully hidden behind `.glass-chrome`; add `scroll-margin-
  bottom` sized to the nav height + safe-area inset.
- **Dragging has a tap alternative.** Anything using a swipe gesture
  (dismissing a bottom sheet, the day-strip calendar) needs an equivalent
  single-tap path — a close button on the sheet, tap-to-jump on the
  calendar strip.
- Logical tab order; manage focus when a bottom sheet opens (move focus
  in, trap within, restore to the trigger on close).

---

## Understandable

- **Label every control.** Inputs inside bottom sheets (settings, filters)
  get real `<label>`s — a placeholder in `--text-muted` is not a label.
- **Errors** (sync failure, invalid input): identify the field, describe
  the fix, use `--color-danger` paired with text — never a red border
  alone.
- **Don't force re-entry** across a multi-step flow (e.g. onboarding into
  a new module) — prefill from what's already known.
- **Accessible authentication:** allow paste and password managers on any
  RISE login/PIN screen; no memorize-and-retype-only flow.

---

## Robust

- **Semantic first:** `<button>` for the AI compose FAB and nav items,
  `<nav>` for the bottom nav, one `<h1>` per screen, heading levels by
  document structure — not by which `--text-h*` size looks right (size is
  CSS, hierarchy is HTML).
- **ARIA only to fill gaps.** The bottom-nav active indicator needs
  `aria-current` on the active tab; the AI compose states (idle/pressed/
  typing/done) need `aria-busy`/`aria-live` so a screen reader user gets
  the same "AI is thinking" signal sighted users get from the shimmer.
- Live regions for async status: sync completion, count-up value landing,
  toast confirmations.

---

## RISE-specific quick audit

- [ ] Tab through the screen — every tappable element reachable, focus
      ring visible (`--border-active`, ≥2px), never hidden behind
      `.glass-chrome`.
- [ ] `--text-secondary` contrast re-confirmed if used on anything other
      than `--surface-1`.
- [ ] Every module color (data viz, card border) is paired with an icon
      or label, not standing alone.
- [ ] No tappable element smaller than 44×44px, including icon-only nav
      items.
- [ ] No body/label text below `--text-micro` (11px).
- [ ] `prefers-reduced-motion` query present and global, not duplicated
      per component.
- [ ] Bottom sheets trap and restore focus correctly on open/close.
