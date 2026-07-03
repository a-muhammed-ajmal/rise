### RISE OS - Design System

**name:** RISE OS - Design System
**description:** Source of truth for all visual and component decisions in the RISE OS codebase (Next.js 16, React 19, Tailwind CSS v4, Zustand v5, TypeScript strict). Use this skill whenever building, editing, or reviewing ANY component, page, or UI element in RISE OS — including colors, typography, shadows, animations, layout, or interactive patterns. Also trigger when resolving Tailwind class conflicts, applying priority/status/project colors, or checking anti-patterns. If the task touches RISE OS UI in any way, consult this skill before writing a single line of JSX.

---

#### Core Philosophy
Every value in this document is derived directly from the code. If the code and this document disagree, fix this document.

#### 1. Technical Stack
| Concern | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router) |
| **UI Runtime** | React 19 |
| **Styling** | Tailwind CSS v4 — all tokens in @theme {} in app/globals.css |
| **State** | Zustand v5 with persist middleware (localStorage key: "rise-os-storage") |
| **Language** | TypeScript strict — any is forbidden |
| **Icons** | lucide-react only — no hand-authored SVG |
| **Class Merging** | cn() in lib/cn.ts = twMerge(clsx(...inputs)) |
| **Date Handling** | date-fns + date-fns-tz (timezone: Asia/Dubai, UTC+4, no DST) |

---

#### 2. Typography
Single typeface: **Inter** (Google Fonts, via next/font/google in app/layout.tsx).
CSS variable: `--font-inter`. Applied on `<html>`. Fallback: `--font-sans`.
Base body: `font-size: 14px`; `line-height: 1.5`. Smoothing: `-webkit-font-smoothing: antialiased`.

| Role | Size | Weight | Tailwind Class |
| :--- | :--- | :--- | :--- |
| **Page title** | 20px | 700 | `text-xl font-bold` |
| **Card / section title** | 16px | 700 | `text-base font-bold` |
| **Section heading** | 14px | 600 | `text-sm font-semibold` |
| **Body / task title** | 14px | 500 | `text-sm font-medium` |
| **Meta row / caption** | 12px | 400–500 | `text-xs` |
| **Micro label / chip** | 11px | 600 | `text-[11px] font-semibold` |
| **Column header (kanban)** | 12px | 700 | `text-xs font-bold tracking-wider uppercase` |
| **Progress label** | 11px | 500 | `text-[11px] font-medium` |

---

#### 3. Color System
All colors are CSS custom properties in `@theme {}` in `app/globals.css`. **Never hardcode hex values in JSX** — always use semantic token names.

##### Core Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| `--color-base` | #F4F5F7 | App background (`<body>`) |
| `--color-surface` | #FFFFFF | Cards, modals, input backgrounds |
| `--color-surface-alt` | #F9FAFB | Hover states, alternate rows |
| `--color-primary` | #5B5BD6 | Brand — CTAs, active states, focus rings |
| `--color-primary-light` | #EEEEFF | Active tab background, primary tinted fills |
| `--color-focus-accent` | #FF6B35 | "Focus" / Today feature highlight |
| `--color-focus-light` | #FFF1EC | Focus accent tint |
| `--color-success` | #22C55E | Completed tasks, done checkboxes |
| `--color-success-light` | #DCFCE7 | Success tint backgrounds |
| `--color-warning` | #F59E0B | On Hold status, overdue date badges |
| `--color-danger` | #EF4444 | Blocked status, P1 priority, Delete actions |
| `--color-content` | #111827 | Primary body text |
| `--color-subtle` | #6B7280 | Secondary text, muted icons, labels |
| `--color-muted` | #9CA3AF | Placeholder text, disabled, strikethrough |
| `--color-border` | #E5E7EB | All borders, dividers, calendar gap fill |

##### Priority Color Tokens (mirrored in PRIORITY_CONFIG, lib/types.ts)
| Token | Hex | Priority |
| :--- | :--- | :--- |
| `--color-p1` | #EF4444 | P1 Urgent |
| `--color-p2` | #F97316 | P2 High |
| `--color-p3` | #3B82F6 | P3 Medium |
| `--color-p4` | #9CA3AF | P4 Low |

##### Status Colors (components/projects/ProjectKanbanView.tsx)
| Status | Label | Color |
| :--- | :--- | :--- |
| **todo** | TO DO | #6B7280 |
| **in_progress** | IN PROGRESS | #5B5BD6 |
| **blocked** | BLOCKED | #EF4444 |
| **on_hold** | ON HOLD | #F59E0B |
| **done** | — | #22C55E (not a kanban column) |

---

#### 4. Shadows & Elevation
| Token | Value | Usage |
| :--- | :--- | :--- |
| `--shadow-card` | 0 1px 3px rgba(0,0,0,0.08) | Resting cards |
| `--shadow-card-hover` | 0 2px 8px rgba(0,0,0,0.10) | Card on hover |
| `--shadow-popup` | 0 4px 12px rgba(0,0,0,0.12) | BottomSheet, Modal, dropdowns |

Available as Tailwind utilities: `.shadow-card`, `.shadow-card-hover`, `.shadow-popup`.

---

#### 5. Border Radius
| Token | Value | Usage |
| :--- | :--- | :--- |
| `--radius-card` | 10px | TaskCard, KanbanCard, project cards |
| `--radius-popup` | 16px | BottomSheet, Modal (top corners only) |

---

#### 6. Animations & Motion
*   **slideUp / slideDown:** Used for BottomSheet. Easing: `cubic-bezier(0.32, 0.72, 0, 1)` (snappy iOS-style deceleration).
*   **fadeIn:** Used for Overlays and Modals.
*   **checkmark:** Used for Checkbox SVG stroke animation.

---

#### 7. Custom Utility Classes
| Class | CSS/Behavior | When to use |
| :--- | :--- | :--- |
| `.scrollbar-hide` | `scrollbar-width: none` | Overflow containers without visible bars |
| `.tap-target` | `min-height: 44px; min-width: 44px` | **All icon-only buttons** |
| `.task-title-complete`| `text-decoration: line-through; color: var(--color-muted)` | Completed task titles |
| `.slide-up` | `slideUp` animation | BottomSheet entrance |

---

#### 8. Component Patterns
*   **cn():** Always use for conditional classes.
*   **Hex Alpha Trick:** When color comes from user data (project/label), use inline style for dynamic tints: `style={{ backgroundColor: color + '20', borderColor: color + '40' }}`.
*   **BottomSheet:** Mobile view slides from bottom, `rounded-t-3xl`, `.slide-up`, `bg-black/40` backdrop. Desktop view is a centered modal.
*   **Checkbox:** Always `rounded-full`. Unchecked: `border-border`. Checked: `bg-success border-success` with `.checkmark-path` SVG.

---

#### 9. Layout System
*   **Single breakpoint:** `md` (768px). Binary mobile/desktop only.
*   **Main content:** `max-w-5xl mx-auto px-4 md:px-6`.
*   **Kanban scroll:** `overflow-x-auto` on the outer container; inner container `flex gap-4 min-w-max`.

---

#### 10. Anti-Patterns (Forbidden)
*   **any:** Never use the `any` type in TypeScript.
*   **Hardcoded Hex:** Never use hex colors in JSX. Use semantic tokens.
*   **Generic Gradients:** Avoid purposeless "AI slop" gradients.
*   **Standard Spacing:** Avoid raw `gray-*` palette; use `text-subtle` or `text-muted`.
*   **Missing Tap Targets:** Never create icon-only buttons smaller than 44x44px.

---

#### 11. New Component Checklist
*   [ ] Uses `cn()` for all conditional classes.
*   [ ] Dynamic colors use `style={{}}`, not arbitrary Tailwind values.
*   [ ] All icon-only buttons have `.tap-target`.
*   [ ] Semantic color tokens used (e.g., `text-subtle`, `bg-surface`).
*   [ ] Priority display reads from `PRIORITY_CONFIG[priority]`.
*   [ ] No `any` types — all props have explicit TypeScript interfaces.
*   [ ] Verified at mobile (< 768px) and desktop (≥ 768px).