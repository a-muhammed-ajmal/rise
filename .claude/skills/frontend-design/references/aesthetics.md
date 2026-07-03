# RISE OS — Visual Aesthetics & Motion

## Typography
- **Single typeface: Inter.** No exceptions — not Playfair Display, not Plus Jakarta Sans, not Lexend, not system-serif. Use `var(--font-sans)` on every element.
- **Weight drives hierarchy**, not font changes. Use 400 (body), 500 (medium emphasis), 600 (section heads), 700 (titles), 800 (hero display).
- **Tracking on display**: `letter-spacing: -0.02em` on anything 20px and above. Eyebrows go the other way: `+0.15em` uppercase.
- **No fluid `clamp()` scaling** unless a specific breakpoint won't handle it — prefer the fixed type scale tokens.

## Color Aesthetic
- **Orange is the only brand accent.** `--brand` (`#FF6535`) for fills, `--brand-hover` (`#FF8159`) on hover, `--brand-text` (`#D6450F`) for colored text on white.
- **Dark sections use navy** (`#1A1A2E`), not black. The brand is charcoal-navy + orange — not monochrome.
- **No decorative gradients** except the orange CTA glow shadow (`--shadow-brand`) and the graph-paper overlay. No rainbow gradients, no purple, no AI pulse effects.

## Brand Signature: Graph-paper Grid
Apply on every section. Light sections: faint navy lines. Dark sections: faint orange lines. Cell size 40×40px. This is the aesthetic — it must be present.

## Motion
- **Signature easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (`--ease-out`) for brand slide-ins.
- **Stagger entrances**: 0.08s increments (`.stagger-1` through `.stagger-4`) for lists and card grids.
- **Micro-interactions**: Every button and card hover includes a subtle "lift" (`translateY(-1px)`) and shadow increase. Active state scales to `0.96–0.97`.
- **Glassmorphism**: Only for structural chrome (nav bar, modal overlays, bottom sheets). Never on content cards.
- No animation longer than `--dur-slow` (400ms) for UI interactions. Respect `prefers-reduced-motion`.

## Card Hover Pattern
```css
/* On hover: orange top-bar wipes in from the left */
.card::before {
  content: ''; position: absolute; top: 0; left: 0;
  width: 100%; height: 3px;
  background: var(--brand);
  transform: scaleX(0); transform-origin: left;
  transition: transform 250ms var(--ease-out);
}
.card:hover::before { transform: scaleX(1); }
```
