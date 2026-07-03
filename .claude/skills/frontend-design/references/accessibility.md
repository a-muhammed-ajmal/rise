# RISE OS — Accessibility Standards

## Core Requirements
- **Semantic HTML**: Use appropriate tags (`<main>`, `<nav>`, `<section>`, `<article>`) instead of generic `<div>` wrappers for screen reader compatibility.
- **Interactive Elements**: Every interactive element must be keyboard-accessible. Never remove the focus ring (`outline`) without providing a visible replacement using `--border-focus` (`#FF6535`).
- **ARIA Labels**: All icon-only buttons or interactive elements without visible text must have descriptive `aria-label` attributes.
- **Color Contrast**: Minimum 4.5:1 for body text, 3.0:1 for large text/UI elements. Note: `--brand-text` (`#D6450F`) is the correct token for orange text on white — not `--brand` (`#FF6535`), which fails AA at small sizes.
- **Form Labels**: Every input must have a programmatically associated `<label>` or `aria-labelledby`.

## Focus Ring — Mandatory
```css
*:focus-visible {
  outline: 2px solid var(--border-focus); /* #FF6535 */
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
- [ ] Use `--brand-text` (`#D6450F`) for orange text on white, never raw `--brand`.
- [ ] `prefers-reduced-motion` respected — tokens.css handles this globally.
