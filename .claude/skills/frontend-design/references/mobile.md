# RISE OS — Mobile-First Optimization

## Viewport Strategy
- **Binary breakpoint**: RISE OS uses a single `md` breakpoint at **768px**. Design mobile first, add `md:` for desktop.
- **Content rail**: `max-width: 1280px; margin-inline: auto; padding-inline: var(--space-6)` (24px).
- No `sm`, `lg`, `xl` breakpoints — they don't exist in this system.

## Touch Interactions
- **Tap targets**: Every icon-only button and checkbox **must** use `.tap-target` for a minimum 44×44px touch area.
- **Active feedback**: Use `.tappable` class (`transform: scale(0.96)` on `:active`) on all interactive surfaces.
- **BottomSheet**: Complex forms and menus slide up with `border-radius: var(--radius-panel) var(--radius-panel) 0 0` and a 40px drag handle. Use `.slide-up` animation.
- **Bottom nav**: `.bottom-nav` pattern — `md:hidden`, glassmorphism chrome (`backdrop-filter: blur(20px)`), `env(safe-area-inset-bottom)` padding, 5 items max.
- **FAB**: `md:hidden`, `position: fixed; bottom: calc(56px + 16px + env(safe-area-inset-bottom)); right: 16px`.

## Readability
- No horizontal scrolling at 375px width — test every layout.
- Minimum font size 14px (`var(--text-sm)`) — prevents iOS zoom on inputs if using `var(--text-base)` (16px) on inputs.
- Use `.scrollbar-hide` on horizontally scrolling containers.

## Safe Area
```css
padding-bottom: env(safe-area-inset-bottom);
height: calc(56px + env(safe-area-inset-bottom));
```
Always account for iPhone home indicator on fixed-bottom elements.
