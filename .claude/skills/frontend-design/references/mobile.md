# RISE OS - Mobile-First Optimization

## Viewport Strategy
- **Binary Breakpoint**: RISE OS uses a single `md` breakpoint at **768px**. Design for mobile first, then add `md:` classes for desktop.
- **Containers**: Use `max-w-5xl mx-auto px-4 md:px-6` for consistent page alignment.

## Touch Interactions
- **Tap Targets**: Every icon-only button and checkbox **must** use the `.tap-target` utility to ensure a minimum 44x44px touch area.
- **BottomSheet**: On mobile, complex forms and menus should slide up from the bottom with `rounded-t-3xl` and a 40px drag handle.

## Readability
- Ensure no horizontal scrolling exists at 375px width.
- Text must remain readable (min 14px) without zooming.