---
name: frontend-design
version: 1.0.0
description: Use this skill whenever building new UI components, pages, or interfaces. Defines the design token system, color rules, typography, motion, component patterns, accessibility requirements, and anti-patterns for all frontend work.
---

# Frontend Design Skill

This skill is the single source of truth for all visual and implementation decisions. Apply it before writing any component, page, or style. Every value here is intentional — do not deviate without explicit instruction.

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

## Typography

Single typeface: **Inter** via `next/font/google`.
Font stack fallback: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
Base: `font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased`

| Role                  | Size | Weight          | Tailwind                                    |
|-----------------------|------|-----------------|---------------------------------------------|
| Page title            | 20px | 700             | `text-xl font-bold`                         |
| Card / section title  | 16px | 700             | `text-base font-bold`                       |
| Section heading       | 14px | 600             | `text-sm font-semibold`                     |
| Body / task title     | 14px | 500             | `text-sm font-medium`                       |
| Meta / caption        | 12px | 400–500         | `text-xs`                                   |
| Micro label / chip    | 11px | 600             | `text-[11px] font-semibold`                 |
| Kanban column header  | 12px | 700             | `text-xs font-bold tracking-wider uppercase`|
| Progress label        | 11px | 500             | `text-[11px] font-medium`                   |

---

## Color System

All colors live in `@theme {}` as CSS custom properties. Never hardcode hex values in JSX — always use the token.

### Core Palette

| Token                   | Hex       | Role                                              |
|-------------------------|-----------|---------------------------------------------------|
| `--color-base`          | `#F4F5F7` | App background (`<body>`)                         |
| `--color-surface`       | `#FFFFFF` | Cards, modals, input backgrounds                  |
| `--color-surface-alt`   | `#F9FAFB` | Hover states, alternate row backgrounds           |
| `--color-primary`       | `#663399` | Brand — CTAs, active states, focus rings          |
| `--color-primary-light` | `#F0E8F7` | Active tab background, primary tinted fills       |
| `--color-focus-accent`  | `#669933` | Focus / Today feature highlight                   |
| `--color-focus-light`   | `#EEF5E3` | Focus accent tint                                 |
| `--color-success`       | `#22C55E` | Completed tasks, done checkboxes                  |
| `--color-success-light` | `#DCFCE7` | Success tint backgrounds                          |
| `--color-warning`       | `#F59E0B` | On Hold status, overdue date badges               |
| `--color-danger`        | `#EF4444` | Blocked status, P1 priority, delete actions       |
| `--color-content`       | `#111827` | Primary body text                                 |
| `--color-subtle`        | `#6B7280` | Secondary text, muted icons, labels               |
| `--color-muted`         | `#9CA3AF` | Placeholder text, disabled states, strikethrough  |
| `--color-border`        | `#E5E7EB` | All borders, dividers                             |

### Priority Tokens — Do Not Change

| Token          | Hex       | Priority                          |
|----------------|-----------|-----------------------------------|
| `--color-p1`   | `#EF4444` | P1 Urgent                         |
| `--color-p2`   | `#F97316` | P2 High                           |
| `--color-p3`   | `#3B82F6` | P3 Medium                         |
| `--color-p4`   | `#9CA3AF` | P4 Low                            |

Always read priority colors from `PRIORITY_CONFIG[task.priority]` — never switch/case on priority string.

```ts
export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bgColor: string }> = {
  P1: { label: 'P1', color: '#EF4444', bgColor: '#FEF2F2' },
  P2: { label: 'P2', color: '#F97316', bgColor: '#FFF7ED' },
  P3: { label: 'P3', color: '#3B82F6', bgColor: '#EFF6FF' },
  P4: { label: 'P4', color: '#9CA3AF', bgColor: '#F9FAFB' },
};
```

### Status Colors — Do Not Change

| Status        | Color     | Token reference       |
|---------------|-----------|-----------------------|
| `todo`        | `#6B7280` | `--color-subtle`      |
| `in_progress` | `#663399` | `--color-primary`     |
| `blocked`     | `#EF4444` | `--color-danger`      |
| `on_hold`     | `#F59E0B` | `--color-warning`     |
| `done`        | `#22C55E` | `--color-success`     |

---

## Shadows & Elevation

| Token                | Value                           | Usage                              |
|----------------------|---------------------------------|------------------------------------|
| `--shadow-card`      | `0 1px 3px rgba(0,0,0,0.08)`   | Resting cards                      |
| `--shadow-card-hover`| `0 2px 8px rgba(0,0,0,0.10)`   | Card on hover                      |
| `--shadow-popup`     | `0 4px 12px rgba(0,0,0,0.12)`  | BottomSheet, Modal, dropdowns      |

Standard hover lift — apply on all interactive cards:

```tsx
className="shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all duration-150"
```

---

## Border Radius

| Token             | Value  | Usage                                   |
|-------------------|--------|-----------------------------------------|
| `--radius-card`   | `10px` | Task cards, Kanban cards, progress bars |
| `--radius-popup`  | `16px` | BottomSheet, Modal top corners          |

Use `rounded-xl` (12px) for bordered containers: `border border-border rounded-xl`

---

## Animations

### slideUp / slideDown
```css
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.slide-up { animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
```

### fadeIn
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.fade-in { animation: fadeIn 0.2s ease; }
```

### checkmark
```css
@keyframes checkmark {
  0%   { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: 0; }
}
.checkmark-path {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
  animation: checkmark 0.25s ease forwards;
}
```

Animate transforms only — never properties that trigger layout reflow.

---

## Custom Utility Classes

| Class                 | Purpose                                              |
|-----------------------|------------------------------------------------------|
| `.scrollbar-hide`     | Hide scrollbars on overflow containers               |
| `.shadow-card`        | Resting card elevation                               |
| `.shadow-card-hover`  | Hover elevation                                      |
| `.shadow-popup`       | Sheet / modal elevation                              |
| `.radius-card`        | Card border radius                                   |
| `.radius-popup`       | Popup border radius                                  |
| `.tap-target`         | `min-height: 44px; min-width: 44px` — all icon buttons|
| `.slide-up`           | BottomSheet entrance animation                       |
| `.fade-in`            | Overlay fade animation                               |
| `.checkmark-path`     | Checkbox checked stroke animation                    |
| `.task-title-complete`| `line-through` + `--color-muted` for completed tasks |

Global focus ring — never remove without a replacement:
```css
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

---

## Layout
## Layout

​```
┌──────────────────────────────────────┐
│ Sidebar (hidden md:flex, fixed left) │
│  ┌─────────────────────────────────┐ │
│  │ Main — max-w-5xl mx-auto        │ │
│  └─────────────────────────────────┘ │
└──────────────────────────────────────┘
      BottomNav (md:hidden, fixed bottom)
      FAB      (md:hidden, fixed bottom-right)
​```

- Single breakpoint: `md` at 768px — no `sm`, `lg`, `xl`
- Main content: `max-w-5xl mx-auto px-4 md:px-6`
- FAB: `fixed bottom-20 right-4`

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

- Use semantic HTML elements
- Add ARIA labels to all interactive elements
- Ensure full keyboard navigability
- Never remove focus outlines without a replacement
- All icon-only buttons must have `.tap-target` class (44×44px minimum)

---

## Testing — Required on Every New File

- Create a corresponding test file alongside every new component
- Cover happy path, edge cases, and error cases
- Use `describe` / `it` blocks with clear descriptions
- Minimum 80% coverage for all new code

---

## Anti-Patterns

| Wrong                                      | Right                                              |
|--------------------------------------------|----------------------------------------------------|
| Hardcoded hex in JSX                       | CSS var or `PRIORITY_CONFIG[p].color`              |
| `text-gray-*` / `bg-gray-*`               | Semantic tokens: `text-subtle`, `bg-surface-alt`   |
| `any` TypeScript type                      | Correct type or proper generic                     |
| Arbitrary Tailwind for dynamic color       | Inline `style={{}}`                                |
| Template literals for class merging        | `cn()` always                                      |
| Icon button without `.tap-target`          | Always add `.tap-target`                           |
| `updateProject({ ...project, changes })`   | `updateProject(id, { field: value })`              |

---

## Checklist — Before Every Component

- [ ] All colors use CSS tokens — no hardcoded hex in JSX
- [ ] `--color-primary` is `#663399`, `--color-focus-accent` is `#669933`
- [ ] Priority colors read from `PRIORITY_CONFIG[priority]` only
- [ ] `cn()` used for all conditional class merging
- [ ] Dynamic colors use inline `style={{}}`
- [ ] Icon buttons have `.tap-target`
- [ ] Semantic HTML and ARIA labels present
- [ ] Keyboard navigability confirmed
- [ ] Responsive at < 768px and ≥ 768px
- [ ] No `any` types — strict TypeScript enforced
- [ ] Test file created with ≥ 80% coverage
