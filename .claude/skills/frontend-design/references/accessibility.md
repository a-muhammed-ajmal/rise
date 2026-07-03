# RISE OS - Accessibility Standards

## Core Requirements
- **Semantic HTML**: Always use appropriate tags (e.g., `<main>`, `<nav>`, `<section>`, `<article>`) instead of generic `<div>` wrappers to ensure screen reader compatibility [6, 8].
- **Interactive Elements**: Every interactive element must be keyboard-accessible. Never remove the focus ring (`outline`) without providing a visible, high-contrast replacement [6, 8].
- **ARIA Labels**: All icon-only buttons or interactive elements without visible text must have descriptive `aria-label` attributes [6, 7].
- **Color Contrast**: Maintain a minimum contrast ratio of **4.5:1** for all body text and **3.0:1** for large text/UI elements [6, 9, 10].
- **Form Labels**: Every input field must have a programmatically associated `<label>` or an `aria-labelledby` attribute [6, 9].

## Implementation Checklist
- [ ] Use `lucide-react` icons with `aria-hidden="true"` when they are decorative.
- [ ] Ensure the tab order follows the logical visual flow of the page [6].
- [ ] All images must have an `alt` attribute; decorative images use `alt=""` [6, 9].
- [ ] Status messages (like "Task Saved") must be announced using `aria-live` regions.