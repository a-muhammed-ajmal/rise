---
name: frontend-design
version: 2.0.0
description: Use this skill whenever building new UI components, pages, or interfaces. Defines the design token system, color rules, typography, motion, component patterns, accessibility requirements, and anti-patterns for all frontend work. Orange brand palette, Inter-only type.
---

# Frontend Design Skill

Single source of truth for all visual and implementation decisions. Apply before writing any component, page, or style. Every value is intentional — do not deviate without explicit instruction.

---

## Stack

| Concern       | Technology                                                                 |
|---------------|----------------------------------------------------------------------------|
| Framework     | Next.js 16 (App Router)                                                    |
| UI runtime    | React 19                                                                   |
| Styling       | Tailwind CSS v4 — all tokens in `@theme {}`, no config file                |
| State         | Zustand v5 with `persist` middleware                                       |
| Language      | TypeScript — strict mode, `any` is forbidden                               |
| Icons         | lucide-react only — no hand-authored SVGs                                  |
| Class merging | `cn()` = `twMerge(clsx(...inputs))`                                        |
| Date handling | date-fns + date-fns-tz (timezone: Asia/Dubai, UTC+4, no DST)              |

---

## Typography — Inter only

**Single typeface: Inter** (loaded via `next/font/google`). No other font families — not Playfair, not Plus Jakarta Sans, not Lexend.

Font stack: `'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
Base: `font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased`

| Role                  | Size | Weight | Letter-spacing | Notes                              |
|-----------------------|------|--------|----------------|------------------------------------|
| Hero display          | 48px | 800    | −0.02em        | `font-extrabold tracking-tight`    |
| Page title            | 20px | 700    | −0.02em        | `text-xl font-bold`                |
| Card / section title  | 16px | 700    | −0.01em        | `text-base font-bold`              |
| Section heading       | 14px | 600    | 0              | `text-sm font-semibold`            |
| Body / task title     | 14px | 500    | 0              | `text-sm font-medium`              |
| Meta / caption        | 12px | 400–500| 0              | `text-xs`                          |
| Eyebrow label         | 11px | 700    | +0.15em        | uppercase, brand orange            |
| Micro label / chip    | 11px | 600    | +0.05em        | `text-[11px] font-semibold`        |
| Kanban column header  | 12px | 700    | +0.05em        | uppercase                          |

---

## Color System

All colors live as CSS custom properties in `tokens.css`. **Never hardcode hex in JSX** — use the token.

### Core Brand Palette

| Token                  | Hex       | Role                                                   |
|------------------------|-----------|--------------------------------------------------------|
| `--brand`              | `#FF6535` | Primary CTA, active states, accents, focus rings       |
| `--brand-hover`        | `#FF8159` | Hover / gradient end for orange elements               |
| `--brand-text`         | `#D6450F` | Orange text on white (AA 4.5:1 contrast)               |
| `--brand-tint`         | `#FFF0EB` | Badge/chip backgrounds, tinted fills                   |
| `--surface-base`       | `#FFFFFF` | Page background                                        |
| `--surface-paper`      | `#F9FAFB` | Alternating light sections                             |
| `--surface-card`       | `#FFFFFF` | Cards, modals, inputs                                  |
| `--surface-dark`       | `#1A1A2E` | Dark inverted sections                                 |
| `--surface-footer`     | `#0B1120` | Footer                                                 |
| `--text-strong`        | `#1A1A2E` | Primary headings / strong body text                    |
| `--text-body`          | `navy/70` | Paragraph copy                                         |
| `--text-muted`         | `navy/50` | Captions, disabled                                     |
| `--text-on-dark`       | `#FFFFFF` | Text on navy sections                                  |
| `--color-success`      | `#10B981` | Completed, done, positive                              |
| `--color-danger`       | `#E11D48` | Error, blocked, delete                                 |
| `--color-warning`      | `#F59E0B` | On hold, overdue                                       |
| `--border-subtle`      | `navy/10` | Default card borders                                   |
| `--border-focus`       | `#FF6535` | Focus rings                                            |

### Priority Tokens — Do Not Change

| Token        | Hex       | Priority   |
|--------------|-----------|------------|
| `--color-p1` | `#EF4444` | P1 Urgent  |
| `--color-p2` | `#FF6535` | P2 High (brand orange) |
| `--color-p3` | `#3B82F6` | P3 Medium  |
| `--color-p4` | `#9CA3AF` | P4 Low     |

Always read priority colors from `PRIORITY_CONFIG[task.priority]`:

```ts
export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bgColor: string }> = {
  P1: { label: 'P1', color: '#EF4444', bgColor: '#FEF2F2' },
  P2: { label: 'P2', color: '#FF6535', bgColor: '#FFF0EB' },
  P3: { label: 'P3', color: '#3B82F6', bgColor: '#EFF6FF' },
  P4: { label: 'P4', color: '#9CA3AF', bgColor: '#F9FAFB' },
};
```

### Status Colors

| Status        | Color     | Token                |
|---------------|-----------|----------------------|
| `todo`        | `#6B6B6B` | `--color-slate`      |
| `in_progress` | `#FF6535` | `--brand`            |
| `blocked`     | `#E11D48` | `--color-danger`     |
| `on_hold`     | `#F59E0B` | `--color-warning`    |
| `done`        | `#10B981` | `--color-success`    |

---

## Borders & Radii

| Token             | Value  | Usage                                 |
|-------------------|--------|---------------------------------------|
| `--radius-sm`     | `4px`  | Buttons, chips                        |
| `--radius-input`  | `8px`  | Form inputs                           |
| `--radius-card`   | `12px` | Cards, task cards, progress bars      |
| `--radius-panel`  | `16px` | Feature panels, modals, bottom sheets |
| `--radius-full`   | `9999px` | Pills, badges, avatar dots          |

---

## Shadows

| Token             | Value                                       | Usage                    |
|-------------------|---------------------------------------------|--------------------------|
| `--shadow-card`   | `0 1px 3px rgba(26,26,46,0.08)`             | Resting cards            |
| `--shadow-hover`  | `0 4px 16px rgba(26,26,46,0.12)`            | Cards on hover           |
| `--shadow-popup`  | `0 8px 32px rgba(26,26,46,0.14)`            | Modals, sheets           |
| `--shadow-brand`  | `0 4px 16px rgba(255,101,53,0.25)`          | Orange CTA glow          |

Standard hover lift for interactive cards:
```css
transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
/* hover: */
border-color: var(--brand);
box-shadow: var(--shadow-hover);
transform: translateY(-1px);
```

---

## Motion

```css
--ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);  /* entrances, confirmations */
--ease-smooth:  cubic-bezier(0.4, 0, 0.2, 1);         /* state changes */
--ease-out:     cubic-bezier(0.16, 1, 0.3, 1);        /* brand slide */
--ease-exit:    cubic-bezier(0.4, 0, 1, 1);            /* exits */

--dur-instant:  80ms;
--dur-fast:     150ms;
--dur-normal:   250ms;
--dur-slow:     400ms;
--dur-enter:    350ms;
```

### slideUp
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### fadeIn
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

Animate `transform` and `opacity` only — never layout-triggering properties.

---

## Brand Signature: Graph-paper Background

White sections use a faint navy grid. Dark navy sections use an orange grid.

```css
/* Light section */
background-image:
  linear-gradient(rgba(26,26,46,0.045) 1px, transparent 1px),
  linear-gradient(90deg, rgba(26,26,46,0.045) 1px, transparent 1px);
background-size: 40px 40px;

/* Dark section */
background-image:
  linear-gradient(rgba(255,101,53,0.07) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,101,53,0.07) 1px, transparent 1px);
background-size: 40px 40px;
```

---

## Layout

- **Content rail** — `max-width: 1280px; margin-inline: auto; padding-inline: 24px`
- **Prose / forms** — `max-width: 768px`
- **Sidebar** — `hidden md:flex`, fixed left rail, desktop only
- **BottomNav** — `md:hidden`, fixed bottom, mobile only
- **FAB** — `md:hidden`, `fixed bottom-20 right-4`, mobile only
- Single breakpoint: `md` at 768px — no `sm`, `lg`, `xl`
- Sections alternate `--surface-base` / `--surface-paper` ↔ `--surface-dark`

---

## Custom Utility Classes

| Class                 | Purpose                                               |
|-----------------------|-------------------------------------------------------|
| `.scrollbar-hide`     | Hide scrollbars on overflow containers                |
| `.shadow-card`        | Resting card elevation                                |
| `.shadow-hover`       | Hover elevation                                       |
| `.shadow-popup`       | Sheet / modal elevation                               |
| `.tap-target`         | `min-height: 44px; min-width: 44px` — all icon buttons|
| `.slide-up`           | Sheet entrance animation                              |
| `.fade-in`            | Overlay fade                                          |
| `.checkmark-path`     | Checkbox checked stroke animation                     |
| `.task-title-complete`| `line-through` + `--text-muted` for completed tasks   |
| `.eyebrow`            | 11px bold uppercase orange label                      |
| `.graph-bg`           | Light section graph-paper texture                     |
| `.graph-bg-dark`      | Dark section orange graph-paper texture               |
| `.stagger-1`–`.stagger-4` | Animation delay helpers (0.08s increments)       |

Global focus ring — never remove:
```css
*:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
```

---

## Implementation Rules

### cn() — always use for conditional classes
```tsx
// Correct
className={cn('base', condition && 'extra', variant === 'x' && 'active')}

// Wrong
className={`base ${condition ? 'extra' : ''}`}
```

### Dynamic colors — always inline style, never arbitrary Tailwind
```tsx
// Correct
style={{ backgroundColor: color + '20' }}

// Wrong
className={`bg-[${color}]`}
```

### Hex alpha tint pattern
```tsx
style={{ backgroundColor: color + '20' }}  // ~12% opacity
style={{ borderColor: color + '40' }}       // ~25% opacity
```

---

## Accessibility — Required on Every Component

- Semantic HTML: `<main>`, `<nav>`, `<section>`, `<article>` over bare `<div>`
- ARIA labels on all icon-only interactive elements
- Full keyboard navigability; never remove focus ring without replacement
- Color contrast: 4.5:1 body text, 3.0:1 large text / UI elements
- All inputs have a `<label>` or `aria-labelledby`
- Decorative icons: `aria-hidden="true"`
- Status messages use `aria-live` regions
- All icon buttons have `.tap-target` (44×44px minimum)

---

## Testing — Required on Every New File

- Corresponding test file alongside every new component
- Cover happy path, edge cases, error cases
- `describe` / `it` blocks with clear descriptions
- Minimum 80% coverage for all new code

---

## Anti-Patterns

| Wrong                                   | Right                                              |
|-----------------------------------------|----------------------------------------------------|
| Hardcoded hex in JSX                    | CSS var or `PRIORITY_CONFIG[p].color`              |
| Any font other than Inter               | `font-family: var(--font-sans)` always             |
| `text-gray-*` / `bg-gray-*`            | Semantic tokens: `--text-muted`, `--surface-paper` |
| `any` TypeScript type                   | Correct type or proper generic                     |
| Arbitrary Tailwind for dynamic color    | Inline `style={{}}`                                |
| Template literals for class merging     | `cn()` always                                      |
| Icon button without `.tap-target`       | Always add `.tap-target`                           |
| `updateProject({ ...project, changes })`| `updateProject(id, { field: value })`              |
| Glassmorphism on content cards          | Glass only on structural chrome (nav, modals)      |

---

## Checklist — Before Every Component

- [ ] All colors use CSS tokens — no hardcoded hex in JSX
- [ ] Font is Inter only — `var(--font-sans)` on every element
- [ ] `--brand` is `#FF6535` (orange), not purple or any other color
- [ ] Priority colors read from `PRIORITY_CONFIG[priority]` only
- [ ] `cn()` used for all conditional class merging
- [ ] Dynamic colors use inline `style={{}}`
- [ ] Icon buttons have `.tap-target` (44×44px)
- [ ] Semantic HTML and ARIA labels present
- [ ] Keyboard navigability confirmed
- [ ] Responsive at < 768px and ≥ 768px
- [ ] No `any` types — strict TypeScript enforced
- [ ] Test file created with ≥ 80% coverage
