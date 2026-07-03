# RISE OS - Visual Aesthetics & Motion

## Typography & Hierarchy
- **Pairing**: Use **Playfair Display** (Serif) for high-impact page headings and **Inter** (Sans-serif) for body and UI text [10, 13].
- **Fluid Scaling**: Use `clamp()` for all font sizes to ensure typography scales smoothly across viewports without rigid media queries [10, 14].
- **Weight**: Use font weight (500-700) and letter-spacing strategically to create hierarchy in dense dashboards [10, 13].

## Orchestrated Motion
- **Deceleration**: Use the RISE OS signature easing: `cubic-bezier(0.32, 0.72, 0, 1)` for a snappy, iOS-style feel [15].
- **Staggered Delays**: Sequence the entrance of elements (e.g., cards in a list) with 0.1s increments (0.1s, 0.2s, 0.3s) to guide user attention [14, 16].
- **Micro-interactions**: Every button and card must have a hover state that includes a subtle "lift" (shift up 2-4px) and a shadow increase [14, 17].

## Visual Finish
- **Glassmorphism**: Use `backdrop-filter: blur(12px)` for headers and popups to create depth [15, 16].
- **Purposeful Gradients**: Use gradients only for branding or to denote active state