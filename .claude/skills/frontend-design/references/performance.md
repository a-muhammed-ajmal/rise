# RISE OS - Performance Targets

## Core Web Vitals
- **LCP (Largest Contentful Paint)**: Target < 2.5s. Optimize the hero image and critical rendering path.
- **CLS (Cumulative Layout Shift)**: Target < 0.1. Always provide `width` and `height` attributes for images and reserve space for dynamic content.
- **FID (First Input Delay)**: Target < 100ms. Avoid blocking the main thread with long JavaScript tasks.

## Optimization Rules
- **Image Handling**: Use modern formats (WebP/AVIF) and implement lazy-loading (`loading="lazy"`) for all off-screen assets.
- **JavaScript**: Avoid "Long Tasks" exceeding 50ms. Use `Zustand` for lightweight state management rather than complex, heavy context providers.
- **Layout Thrashing**: Never perform DOM reads and writes in a loop; batch all style 