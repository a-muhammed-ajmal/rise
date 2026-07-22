---
name: frontend-design
version: 2.1.0
description: Single source of truth for RISE OS frontend. Orange brand, Inter-only typography, mandatory graph-paper texture, strict token system. Apply to every UI component and page.
---

# Frontend Design Skill — RISE OS

**This is the single source of truth.** Every visual and implementation decision is defined here. Do not deviate.

---

## Stack

| Concern          | Technology                                                                 |
|------------------|----------------------------------------------------------------------------|
| Framework        | Next.js 16 (App Router)                                                    |
| UI Runtime       | React 19                                                                   |
| Styling          | Tailwind CSS v4 + CSS Variables (`@theme {}`)                              |
| State            | Zustand v5 with `persist` middleware                                       |
| Language         | TypeScript — strict mode, `any` forbidden                                  |
| Icons            | `lucide-react` only                                                        |
| Class Merging    | `cn()` = `twMerge(clsx(...inputs))`                                        |
| Dates            | `date-fns` + `date-fns-tz` (Asia/Dubai, UTC+4)                             |

---

## Typography — Inter Only

**Only font allowed: Inter.** Loaded via `next/font/google`.

```tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
```

**Font stack:** `'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

| Role                    | Size   | Weight | Letter-spacing   | Notes / Tailwind                     |
|-------------------------|--------|--------|------------------|--------------------------------------|
| Hero Display            | 48px   | 800    | −0.02em          | `text-5xl font-extrabold tracking-tight` |
| Section Heading         | 36px   | 700    | −0.02em          | `text-4xl font-bold tracking-tight` |
| Page Title              | 20px   | 700    | −0.02em          | `text-xl font-bold tracking-tight` |
| Card / Section Title    | 16px   | 700    | −0.01em          | `text-base font-bold` |
| Body / Task             | 14px   | 500    | 0                | `text-sm font-medium` |
| Meta / Caption          | 12px   | 400–500| 0                | `text-xs` |
| Eyebrow Label           | 11px   | 700    | +0.15em uppercase| `.eyebrow` class |
| Micro Label / Chip      | 11px   | 600    | +0.05em          | `text-[11px] font-semibold` |

---

## Color System

**Never hardcode any hex.** Use CSS custom properties defined in `tokens.css`.

### Core Brand Palette

| Token                | Hex            | Role |
|----------------------|----------------|------|
| `--brand`            | `#FF6535`      | Primary CTA, accents, focus rings |
| `--brand-hover`      | `#FF8159`      | Hover states |
| `--brand-text`       | `#D6450F`      | Orange text on light (AA 4.5:1) |
| `--brand-tint`       | `#FFF0EB`      | Badges, chips, icon containers |
| `--surface-base`     | `#FFFFFF`      | Main background |
| `--surface-paper`    | `#F9FAFB`      | Alternating sections |
| `--surface-card`     | `#FFFFFF`      | Cards, modals, inputs |
| `--surface-dark`     | `#1A1A2E`      | Dark sections |
| `--surface-footer`   | `#0B1120`      | Footer |
| `--text-strong`      | `#1A1A2E`      | Headings |
| `--text-body`        | `rgba(26,26,46,0.70)` | Body copy |
| `--text-muted`       | `rgba(26,26,46,0.50)` | Captions |
| `--text-on-dark`     | `#FFFFFF`      | Text on dark backgrounds |
| `--color-success`    | `#10B981`      | Success |
| `--color-danger`     | `#E11D48`      | Error |
| `--color-warning`    | `#F59E0B`      | Warning |

### Priority Config

```ts
export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bgColor: string }> = {
  P1: { label: 'P1 Urgent',  color: '#EF4444', bgColor: '#FEF2F2' },
  P2: { label: 'P2 High',    color: '#FF6535', bgColor: '#FFF0EB' },
  P3: { label: 'P3 Medium',  color: '#3B82F6', bgColor: '#EFF6FF' },
  P4: { label: 'P4 Low',     color: '#9CA3AF', bgColor: '#F9FAFB' },
};
```

### Module Accent Tokens

| Module     | Color      | Tint        |
|------------|------------|-------------|
| Tasks      | `#2563EB`  | `#EFF6FF`   |
| Finance    | `#059669`  | `#ECFDF5`   |
| Wellness   | `#BE123C`  | `#FFF1F2`   |
| Goals      | `#7C3AED`  | `#F5F3FF`   |
| Knowledge  | `#D97706`  | `#FFFBEB`   |
| CRM        | `#0891B2`  | `#ECFEFF`   |

**AI** uses `--brand` / `--brand-tint` directly.

---

## Dark Mode (`.dark`)

Opt-in via `<html class="dark">`. Persisted in localStorage.

- Navy-based surfaces
- Off-white text
- Orange remains primary accent
- Graph paper auto-switches to orange grid

---

## Brand Signature: Graph Paper

```css
/* Light */
.graph-bg {
  background-image: linear-gradient(rgba(26,26,46,0.045) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(26,26,46,0.045) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* Dark */
.graph-bg-dark {
  background-image: linear-gradient(rgba(255,101,53,0.07) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,101,53,0.07) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

**Must be applied to every section.**

---

## Borders, Radii & Shadows

- **All cards, inputs, buttons, etc.** must have visible resting border (`1.5px`).
- Focus ring is mandatory.

| Token             | Value          | Usage |
|-------------------|----------------|-------|
| `--radius-sm`     | `4px`          | Buttons, chips |
| `--radius-input`  | `8px`          | Inputs |
| `--radius-card`   | `12px`         | Cards |
| `--radius-panel`  | `16px`         | Modals, sheets |

**Card Hover Pattern** (canonical):
- Orange top wipe (3px)
- Border turns orange
- Subtle lift (`translateY(-1px)`)

---

## Motion

- Use defined easing and duration tokens
- Animate only `transform` + `opacity`
- Respect `prefers-reduced-motion`

---

## Layout Rules

- **Content rail**: `max-width: 1280px; margin-inline: auto; padding-inline: 24px`
- Single breakpoint: `md` (768px)
- Mobile-first
- Dashboard stats: max 3 columns on mobile

---

## Custom Utility Classes

`.eyebrow`, `.graph-bg`, `.graph-bg-dark`, `.tap-target`, `.slide-up`, `.card`, `.tappable`, `.scrollbar-hide`, etc.

---

## Implementation Rules

- Always use `cn()` for classes
- Dynamic colors via inline `style={{ color: var, backgroundColor: color + '20' }}`
- Semantic HTML + ARIA
- Every icon button must have `.tap-target` (44×44px)
- Tests required for every new component (≥80% coverage)

---

## Anti-Patterns (Never Do)

- Hardcoded hex
- Any font except Inter
- Borderless elements
- Hover-only feedback (must have `:active`)
- Glassmorphism on content cards
- `any` in TypeScript
- Arbitrary Tailwind for dynamic colors

---

## Checklist (Mandatory)

- [ ] All colors from tokens
- [ ] Inter font only
- [ ] Visible 1.5px borders
- [ ] Graph paper applied
- [ ] `cn()` used
- [ ] Dynamic colors via inline styles
- [ ] `.tap-target` on icon buttons
- [ ] Focus rings present
- [ ] Mobile responsive + active states
- [ ] Test file created

---
