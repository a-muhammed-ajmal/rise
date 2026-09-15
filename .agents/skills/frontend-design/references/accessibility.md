# RISE OS — Accessibility Standards

## Core Requirements
- **Semantic HTML**: Use appropriate tags (`<main>`, `<nav>`, `<section>`, `<article>`) instead of generic `<div>` wrappers for screen reader compatibility.
- **Interactive Elements**: Every interactive element must be keyboard-accessible. Never remove the focus ring (`outline`) without providing a visible replacement using `--border-focus` (`#0C2443`).
- **ARIA Labels**: All icon-only buttons or interactive elements without visible text must have descriptive `aria-label` attributes.
- **Color Contrast**: Minimum 4.5:1 for body text, 3.0:1 for large text/UI elements. Note: `--brand-text` (`#0C2443`) is the correct token for orange text on white — not `--brand` (`#0C2443`), which fails AA at small sizes. Likewise, filled button/FAB surfaces use `--brand-action` (`#0C2443`) with white text, not raw `--brand` — white on `#0C2443` is only 2.93:1.
- **Form Labels**: Every input must have a programmatically associated `<label>` or `aria-labelledby`.

## Focus Ring — Mandatory
```css
*:focus-visible {
  outline: 2px solid var(--border-focus); /* #0C2443 */
  outline-offset: 2px;
}
```
Never override this to `outline: none` without adding a replacement.

## Implementation Checklist
- [ ] Use `lucide-react` icons with `aria-hidden="true"` when decorative.
- [ ] Tab order follows the logical visual flow.
- [ ] All images have an `alt` attribute; decorative images use `alt=""`.
- [ ] Status messages (e.g. "Task Saved") announced via `aria-live` regions.
- [ ] All icon-only buttons use `.tap-target` (44×44px minimum).
- [ ] Use `--brand-text` (`#0C2443`) for orange text on white, never raw `--brand`.
- [ ] Use `--brand-action` (`#0C2443`) for filled button/FAB surfaces with white text, never raw `--brand`.
- [ ] `prefers-reduced-motion` respected — tokens.css handles this globally.
