# RISE OS — Performance Targets

## Core Web Vitals
- **LCP** < 2.5s — optimize the critical rendering path; fonts load via `next/font/google` (Inter) which self-hosts and avoids FOUT.
- **CLS** < 0.1 — always provide `width` and `height` on images; reserve space for dynamic content with skeleton loaders (`.skeleton` class).
- **FID** < 100ms — avoid blocking the main thread with tasks > 50ms.

## Font Loading
Inter is the only typeface. Load it once:
```ts
// app/layout.tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
```
Never use a `<link>` to Google Fonts in production — `next/font` self-hosts and eliminates the round-trip. The `tokens.css` `@import` is for demo/storybook only.

## Optimization Rules
- **Images**: WebP/AVIF formats, `loading="lazy"` for off-screen assets, `next/image` for all production images.
- **State**: Zustand for lightweight state — avoid heavy React Context for frequently-updating data.
- **Layout thrashing**: Never read and write DOM style in the same loop; batch all reads before any writes.
- **Animations**: Animate `transform` and `opacity` only — never `width`, `height`, `top`, `left`, or any layout-triggering property.
- **Transitions**: Keep all UI transitions ≤ `--dur-slow` (400ms). Respect `prefers-reduced-motion` — tokens.css handles this globally via `@media (prefers-reduced-motion: reduce)`.

## Bundle
- No icon sets beyond `lucide-react` — tree-shakes per icon.
- No utility-heavy dependencies (lodash, moment) — use native JS and `date-fns`.
- Zustand stores should use `persist` middleware sparingly; only persist state the user explicitly owns.
