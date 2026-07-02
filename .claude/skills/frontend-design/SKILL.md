---
name: frontend-design
description: Source of truth for all visual and component decisions in the TaskFlow codebase (Next.js 16, React 19, Tailwind CSS v4, Zustand v5, TypeScript strict). Use this skill whenever building, editing, or reviewing ANY component, page, or UI element in TaskFlow — including colors, typography, shadows, animations, layout, or interactive patterns. Also trigger when resolving Tailwind class conflicts, applying priority/status/project colors, or checking anti-patterns. If the task touches TaskFlow UI in any way, consult this skill before writing a single line of JSX.
---

# TaskFlow — Design System Reference

> Every value in this document is derived directly from the code.
> If the code and this document disagree, fix this document.

---

## Stack

| Concern | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI runtime | React 19 |
| Styling | Tailwind CSS v4 — all tokens in `@theme {}` in `app/globals.css` |
| State | Zustand v5 with `persist` middleware (localStorage key: `"task-app-storage"`) |
| Language | TypeScript strict — `any` is forbidden |
| Icons | lucide-react only — no hand-authored SVG |
| Class merging | `cn()` in `lib/cn.ts` = `twMerge(clsx(...inputs))` |
| Date handling | date-fns + date-fns-tz (timezone: Asia/Dubai, UTC+4, no DST) |

---

## Typography

Single typeface: **Inter** (Google Fonts, via `next/font/google` in `app/layout.tsx`).

CSS variable: `--font-inter`. Applied on `<html>`. Fallback: `--font-sans`.

Base body: `font-size: 14px; line-height: 1.5`. Smoothing: `-webkit-font-smoothing: antialiased`.

| Role | Size | Weight | Tailwind Class |
|---|---|---|---|
| Page title | 20px | 700 | `text-xl font-bold` |
| Card / section title | 16px | 700 | `text-base font-bold` |
| Section heading | 14px | 600 | `text-sm font-semibold` |
| Body / task title | 14px | 500 | `text-sm font-medium` |
| Meta row / caption | 12px | 400–500 | `text-xs` |
| Micro label / chip | 11px | 600 | `text-[11px] font-semibold` |
| Column header (kanban) | 12px | 700 | `text-xs font-bold tracking-wider uppercase` |
| Progress label | 11px | 500 | `text-[11px] font-medium` |

---

## Color System

All colors are CSS custom properties in `@theme {}` in `app/globals.css`.
**Never hardcode hex values in JSX** — always use semantic token names.

### Core Palette

| Token | Hex | Role |
|---|---|---|
| `--color-base` | `#F4F5F7` | App background (`<body>`) |
| `--color-surface` | `#FFFFFF` | Cards, modals, input backgrounds |
| `--color-surface-alt` | `#F9FAFB` | Hover states, alternate rows |
| `--color-primary` | `#5B5BD6` | Brand — CTAs, active states, focus rings |
| `--color-primary-light` | `#EEEEFF` | Active tab background, primary tinted fills |
| `--color-focus-accent` | `#FF6B35` | "Focus" / Today feature highlight |
| `--color-focus-light` | `#FFF1EC` | Focus accent tint |
| `--color-success` | `#22C55E` | Completed tasks, done checkboxes |
| `--color-success-light` | `#DCFCE7` | Success tint backgrounds |
| `--color-warning` | `#F59E0B` | On Hold status, overdue date badges |
| `--color-danger` | `#EF4444` | Blocked status, P1 priority, Delete actions |
| `--color-content` | `#111827` | Primary body text |
| `--color-subtle` | `#6B7280` | Secondary text, muted icons, labels |
| `--color-muted` | `#9CA3AF` | Placeholder text, disabled, strikethrough |
| `--color-border` | `#E5E7EB` | All borders, dividers, calendar gap fill |

### Priority Color Tokens (mirrored in `PRIORITY_CONFIG`, `lib/types.ts`)

| Token | Hex | Priority |
|---|---|---|
| `--color-p1` | `#EF4444` | P1 Urgent |
| `--color-p2` | `#F97316` | P2 High |
| `--color-p3` | `#3B82F6` | P3 Medium |
| `--color-p4` | `#9CA3AF` | P4 Low |

### PRIORITY_CONFIG (`lib/types.ts:152`)

Always read from `PRIORITY_CONFIG[task.priority]` — never switch/case on priority.

```ts
export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bgColor: string }> = {
  P1: { label: 'Urgent', color: '#EF4444', bgColor: '#FEF2F2' },
  P2: { label: 'High',   color: '#F97316', bgColor: '#FFF7ED' },
  P3: { label: 'Medium', color: '#3B82F6', bgColor: '#EFF6FF' },
  P4: { label: 'Low',    color: '#9CA3AF', bgColor: '#F9FAFB' },
};
```

### Status Colors (`components/projects/ProjectKanbanView.tsx`)

| Status | Label | Color |
|---|---|---|
| `todo` | TO DO | `#6B7280` |
| `in_progress` | IN PROGRESS | `#5B5BD6` |
| `blocked` | BLOCKED | `#EF4444` |
| `on_hold` | ON HOLD | `#F59E0B` |
| `done` | — | `#22C55E` — not a kanban column |

---

## Shadows & Elevation

| Token | Value | Usage |
|---|---|---|
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.08)` | Resting cards |
| `--shadow-card-hover` | `0 2px 8px rgba(0,0,0,0.10)` | Card on hover |
| `--shadow-popup` | `0 4px 12px rgba(0,0,0,0.12)` | BottomSheet, Modal, dropdowns |

Available as Tailwind utilities: `.shadow-card`, `.shadow-card-hover`, `.shadow-popup`.

**Standard hover lift:**
```tsx
className="... hover:shadow-card-hover hover:-translate-y-px transition-all duration-150"
```

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-card` | `10px` | TaskCard, KanbanCard, project cards |
| `--radius-popup` | `16px` | BottomSheet, Modal (top corners only: `rounded-t-3xl`) |

In practice, `rounded-xl` (12px) is used for bordered containers. Reserve the CSS var utilities for custom shadow contexts.

---

## Animations & Motion

### slideUp / slideDown — BottomSheet
```css
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.slide-up { animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
```
`cubic-bezier(0.32, 0.72, 0, 1)` = snappy iOS-style deceleration.

### fadeIn — Overlay
```css
.fade-in { animation: fadeIn 0.2s ease; }
```

### checkmark — Checkbox SVG
```css
.checkmark-path {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
  animation: checkmark 0.25s ease forwards;
}
```

---

## Custom Utility Classes

| Class | CSS | When to use |
|---|---|---|
| `.scrollbar-hide` | `scrollbar-width: none` + webkit | Overflow containers |
| `.shadow-card` / `.shadow-card-hover` / `.shadow-popup` | box-shadow vars | Elevation levels |
| `.radius-card` / `.radius-popup` | border-radius vars | Card/popup radius |
| `.tap-target` | `min-height: 44px; min-width: 44px` | All icon-only buttons |
| `.slide-up` | slideUp animation | BottomSheet entrance |
| `.fade-in` | fadeIn animation | Overlay |
| `.checkmark-path` | stroke animation | Checked checkbox SVG |
| `.task-title-complete` | `text-decoration: line-through; color: var(--color-muted)` | Completed task titles |

**Focus ring (global):**
```css
*:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
```

---

## Component Patterns

### `cn()` — Always use for conditional classes
```ts
// lib/cn.ts
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// Correct
className={cn('base', condition && 'extra', variant === 'active' && 'active')}
// Wrong — never concatenate strings
className={`base ${condition ? 'extra' : ''}`}
```

### Hex Alpha Trick — Dynamic Tinted Fills
When color comes from user data (project/label), Tailwind can't generate the class. Use inline style:
```tsx
style={{ backgroundColor: color + '20' }}  // ~12% opacity
style={{ borderColor: color + '40' }}       // ~25% opacity
```
Used in: `LabelChip.tsx`, project header avatar, calendar task dots.

### Dynamic Colors — Always `style={{}}`
```tsx
// Correct
<div style={{ width: `${pct}%`, backgroundColor: project.color }} />
// Wrong — Tailwind can't purge runtime arbitrary values
<div className={`bg-[${project.color}]`} />
```

### Key UI Components

**BottomSheet** (`components/ui/BottomSheet.tsx`): Mobile = slides from bottom, `rounded-t-3xl`, `.slide-up`, `bg-black/40` backdrop. Desktop = centered modal `md:rounded-2xl`. Drag handle: `w-10 h-1 bg-border rounded-full mx-auto mb-4` (mobile only).

**Checkbox** (`components/ui/Checkbox.tsx`): Always `rounded-full`. Unchecked: `border border-border bg-surface`. Checked: `bg-success border-success` + `.checkmark-path` SVG. Sizes: `sm` (16px), `md` (20px). Always in `.tap-target`.

**PriorityBadge** (`components/ui/PriorityBadge.tsx`): Reads `color`/`bgColor` from `PRIORITY_CONFIG[priority]`. Optional `showLabel` prop.

**LabelChip** (`components/ui/LabelChip.tsx`): `bg: label.color + '20'`, `border: label.color + '40'`.

---

## Layout System

```
┌─────────────────────────────────────────┐
│ Sidebar (hidden md:flex, fixed left)    │
│  ┌─────────────────────────────────┐    │
│  │ Main — max-w-5xl mx-auto px-4   │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
         BottomNav (md:hidden, fixed bottom)
         FAB — fixed bottom-20 right-4
```

- **Single breakpoint**: `md` (768px). No `sm`, `lg`, `xl` — binary mobile/desktop only.
- **Main content**: `max-w-5xl mx-auto px-4 md:px-6`
- **Kanban scroll**: `overflow-x-auto` outer → `flex gap-4 min-w-max` inner, each column `w-64 flex-shrink-0`
- **Calendar grid**: `grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border`

---

## File Map

| Concern | File |
|---|---|
| All design tokens | `app/globals.css` — `@theme {}` block |
| Font loading | `app/layout.tsx` |
| Core type definitions | `lib/types.ts` |
| Class merging | `lib/cn.ts` |
| Date utilities | `lib/utils.ts` |
| Global state | `lib/store.ts` |
| Shared UI | `components/ui/` |
| Task UI | `components/tasks/` |
| Project views | `components/projects/` |
| Routes | `app/` |

---

## Anti-Patterns (Forbidden)

| Anti-pattern | Correct alternative |
|---|---|
| `any` TypeScript type | Use the actual type or a proper generic |
| Hardcoding hex colors in JSX | `PRIORITY_CONFIG[p].color` or CSS vars |
| `text-gray-*` / `bg-gray-*` | Semantic tokens: `text-subtle`, `text-muted`, `bg-surface-alt` |
| `updateProject({ ...project, ...changes })` | `updateProject(id, { field: value })` — store takes `(id, Partial<Project>)` |
| String concatenation for class merging | `cn()` always |
| Dynamic colors via Tailwind arbitrary values | Inline `style={{}}` |
| Icon buttons without `.tap-target` | Always add `tap-target` to icon-only buttons |
| Committing `.env` files | Never commit secrets |

---

## New Component Checklist

- [ ] Uses `cn()` for all conditional classes
- [ ] Dynamic/data-driven colors use `style={{}}`, not arbitrary Tailwind values
- [ ] All icon-only buttons have `.tap-target`
- [ ] Semantic color tokens used — not raw `gray-*` palette
- [ ] Priority display reads from `PRIORITY_CONFIG[priority]`
- [ ] Status display maps through STATUS_COLORS constant
- [ ] No `any` types — all props have explicit TypeScript interfaces
- [ ] Tested at mobile (< 768px) and desktop (≥ 768px)
