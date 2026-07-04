# RISE OS — Frontend Design System
> Orange brand · Inter-only type · Graph-paper texture · All 9 files combined

---

## File Index

| File | Purpose |
|------|---------|
| `SKILL.md` | Master design rules & token reference |
| `AGENT_PROMPT.md` | Drop-in prompt for any AI agent |
| `assets/tokens.css` | CSS custom properties — single source of truth |
| `assets/demo.html` | Live component showcase |
| `references/accessibility.md` | Accessibility standards |
| `references/aesthetics.md` | Visual & motion guidelines |
| `references/components.md` | Component architecture patterns |
| `references/mobile.md` | Mobile-first optimization |
| `references/performance.md` | Performance targets |

---

## AGENT_PROMPT.md

# RISE OS — Agent Implementation Prompt

Copy this prompt verbatim into any AI agent (Claude, GPT-4, Cursor, etc.) that needs to build UI for RISE OS. It defines every visual and implementation decision — do not deviate.

---

## Prompt

You are building UI for **RISE OS**, a productivity operating system for founder-led SMEs. Follow every rule below exactly. These are not suggestions — they are binding.

---

### 1. Typography — Inter Only

**One font family: Inter.** No other font is permitted.

```css
font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
```

Load via Google Fonts:
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
```

| Use case          | Size  | Weight | Letter-spacing |
|-------------------|-------|--------|----------------|
| Hero display      | 48px  | 800    | −0.02em        |
| Section heading   | 36px  | 700    | −0.02em        |
| Page title        | 20px  | 700    | −0.02em        |
| Card title        | 16px  | 600    | 0              |
| Body / task       | 14px  | 500    | 0              |
| Caption / meta    | 12px  | 400    | 0              |
| Eyebrow label     | 11px  | 700    | +0.15em + uppercase |

---

### 2. Color Tokens

Never hardcode hex in components. Use these tokens:

```css
:root {
  --brand:           #FF6535;   /* primary CTA, accents */
  --brand-hover:     #FF8159;   /* hover / gradient end */
  --brand-text:      #D6450F;   /* orange text on white — AA 4.5:1 */
  --brand-tint:      #FFF0EB;   /* chip/badge backgrounds */
  --surface-base:    #FFFFFF;
  --surface-paper:   #F9FAFB;
  --surface-card:    #FFFFFF;
  --surface-dark:    #1A1A2E;
  --surface-footer:  #0B1120;
  --text-strong:     #1A1A2E;
  --text-body:       rgba(26,26,46,0.70);
  --text-muted:      rgba(26,26,46,0.50);
  --text-on-dark:    #FFFFFF;
  --text-on-brand:   #FFFFFF;   /* white text ON orange fill */
  --color-success:   #10B981;
  --color-danger:    #E11D48;
  --color-warning:   #F59E0B;
  --border-focus:    #FF6535;
}
```

**Priority colors — always read from this map, never inline:**
```js
const PRIORITY_CONFIG = {
  P1: { color: '#EF4444', bgColor: '#FEF2F2', label: 'P1 Urgent'  },
  P2: { color: '#FF6535', bgColor: '#FFF0EB', label: 'P2 High'    },
  P3: { color: '#3B82F6', bgColor: '#EFF6FF', label: 'P3 Medium'  },
  P4: { color: '#9CA3AF', bgColor: '#F9FAFB', label: 'P4 Low'     },
};
```

---

### 3. Graph-paper Background — Required Everywhere

Every light section gets a navy grid. Every dark section gets an orange grid. This is the brand signature — do not omit it.

```css
/* Light sections */
background-image:
  linear-gradient(rgba(26,26,46,0.08) 1px, transparent 1px),
  linear-gradient(90deg, rgba(26,26,46,0.08) 1px, transparent 1px);
background-size: 40px 40px;

/* Dark / navy sections */
background-image:
  linear-gradient(rgba(255,101,53,0.07) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,101,53,0.07) 1px, transparent 1px);
background-size: 40px 40px;
```

---

### 4. Border Standard — Always Visible

**Every interactive or container element must have a visible border at rest.** Nothing borderless.

| Element             | Resting border                        | Hover / focus border              |
|---------------------|---------------------------------------|-----------------------------------|
| Card                | `1.5px solid rgba(26,26,46,0.16)`     | `rgba(255,101,53,0.50)`           |
| Input / Select      | `1.5px solid rgba(26,26,46,0.18)`     | `var(--brand)` + glow ring        |
| Button (secondary)  | `1.5px solid rgba(26,26,46,0.18)`     | `rgba(255,101,53,0.50)`           |
| Option button       | `1.5px solid rgba(26,26,46,0.16)`     | `rgba(255,101,53,0.50)`           |
| Task card           | `1.5px solid rgba(26,26,46,0.16)`     | `rgba(255,101,53,0.50)`           |
| Checkbox            | `2px solid rgba(26,26,46,0.22)`       | `var(--brand)` + glow ring        |
| Chip / badge        | `1px solid rgba(26,26,46,0.10)`       | `rgba(255,101,53,0.35)`           |
| Progress track      | `1px solid rgba(26,26,46,0.14)`       | —                                 |
| Kanban column       | `1.5px solid rgba(26,26,46,0.14)`     | —                                 |
| Icon button         | `1.5px solid rgba(26,26,46,0.16)`     | `var(--brand)` + tint fill        |
| Divider             | `1px solid rgba(26,26,46,0.13)`       | —                                 |

Focus ring — mandatory on all focusable elements:
```css
*:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
```

---

### 5. Buttons

```css
/* Primary — orange, white text */
.btn-primary {
  background: #FF6535;
  color: #FFFFFF;           /* white — NOT navy */
  border: 1.5px solid rgba(255,101,53,0.20);
  border-radius: 4px;
  font-weight: 700;
  min-height: 44px;
  padding: 0 20px;
  box-shadow: 0 4px 16px rgba(255,101,53,0.25);
}
.btn-primary:hover {
  background: #FF8159;
  box-shadow: 0 0 0 3px rgba(255,101,53,0.14), 0 3px 12px rgba(255,101,53,0.2);
}
.btn-primary:active { transform: scale(0.95); box-shadow: none; }

/* Secondary — outline */
.btn-secondary {
  background: transparent;
  color: #1A1A2E;
  border: 1.5px solid rgba(26,26,46,0.18);
  border-radius: 4px;
  font-weight: 700;
  min-height: 44px;
  padding: 0 20px;
}
.btn-secondary:hover { border-color: rgba(255,101,53,0.50); }
```

---

### 6. Cards

```css
.card {
  background: #FFFFFF;
  border: 1.5px solid rgba(26,26,46,0.16);
  border-radius: 12px;
  padding: 20px;
  box-shadow:
    0 1px 3px rgba(26,26,46,0.07),
    0 2px 8px rgba(26,26,46,0.05),
    inset 0 1px 0 rgba(255,255,255,0.9);
  position: relative;
  overflow: hidden;
  transition: border-color 200ms ease, box-shadow 200ms ease, transform 180ms cubic-bezier(0.16,1,0.3,1);
}

/* Top orange wipe on hover */
.card::before {
  content: '';
  position: absolute; top: 0; left: 0;
  width: 100%; height: 2px;
  background: linear-gradient(90deg, #FF6535, #FF8159);
  transform: scaleX(0); transform-origin: left;
  transition: transform 240ms cubic-bezier(0.16,1,0.3,1);
}
.card:hover { border-color: rgba(255,101,53,0.50); transform: translateY(-1px); }
.card:hover::before { transform: scaleX(1); }
.card:active { transform: scale(0.995); }
```

---

### 7. Icons

Use **Lucide icons** (outline, 2px stroke, rounded). Never use emoji for UI icons.

Load Lucide:
```html
<script src="https://unpkg.com/lucide@latest"></script>
<script>lucide.createIcons();</script>
```

Use in HTML:
```html
<i data-lucide="zap" style="width:18px;height:18px;stroke:var(--brand);stroke-width:2;"></i>
```

Icon container (for feature cards, list items):
```css
.icon-wrap {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: var(--brand-tint);
  border: 1.5px solid rgba(255,101,53,0.22);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(255,101,53,0.10), inset 0 1px 0 rgba(255,255,255,0.6);
}
```

Common icon → Lucide name mapping:
| Purpose       | Lucide name    |
|---------------|----------------|
| Lightning/fast| `zap`          |
| Target/goal   | `crosshair`    |
| Grid/layout   | `grid`         |
| Settings      | `settings`     |
| Close / X     | `x`            |
| Check         | `check`        |
| Arrow right   | `arrow-right`  |
| Plus          | `plus`         |
| User          | `user`         |
| Calendar      | `calendar`     |
| Filter        | `sliders`      |
| Search        | `search`       |

---

### 8. Mobile Active States (Touch Feedback)

Hover doesn't fire on touch. Always pair every `:hover` rule with an `:active` rule so mobile users get feedback:

```css
.card:hover, .card:active    { border-color: rgba(255,101,53,0.50); }
.card:active                 { transform: scale(0.995); }

.task-card:hover, .task-card:active { border-color: rgba(255,101,53,0.50); }
.task-card:active            { transform: scale(0.975); }

.option-btn:hover, .option-btn:active { border-color: rgba(255,101,53,0.50); }
.option-btn:active           { transform: scale(0.99); }

.check-row:hover, .check-row:active  { background: rgba(255,101,53,0.04); }

.btn:active                  { transform: scale(0.95) !important; box-shadow: none !important; }
.icon-btn:active             { background: var(--brand-tint) !important; }
```

Minimum tap target: **44×44px** on all interactive elements.

---

### 9. Shadows

```css
--shadow-card:  0 1px 3px rgba(26,26,46,0.07), 0 2px 8px rgba(26,26,46,0.05), inset 0 1px 0 rgba(255,255,255,0.9);
--shadow-hover: 0 4px 16px rgba(26,26,46,0.10);
--shadow-popup: 0 24px 64px rgba(26,26,46,0.18), 0 8px 24px rgba(26,26,46,0.10);
--shadow-brand: 0 4px 16px rgba(255,101,53,0.25);
--glow-focus:   0 0 0 3px rgba(255,101,53,0.13);
```

---

### 10. Motion

```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);

--dur-fast:   150ms;
--dur-normal: 250ms;
--dur-enter:  350ms;
```

Animate `transform` and `opacity` only — never layout properties (width, height, top, left).

Always respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### 11. Spacing

8pt grid — use multiples of 8:
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96px`

Uniform gaps:
- Section gap: `56px`
- Grid gap: `16px`
- Card padding: `20px`
- Stack gap (form fields, list items): `16px`
- Inline gap (chips, buttons): `8–12px`

---

### 12. Layout

- Content rail: `max-width: 960px; margin-inline: auto; padding-inline: 32px`
- One breakpoint: `768px` (mobile vs desktop)
- Bottom nav: `md:hidden`, fixed, glass blur
- Sidebar: `hidden md:flex`, fixed left rail
- No `sm`, `lg`, `xl` breakpoints

---

### 13. Anti-patterns — Never Do

- `color: #FF6535` on white background for text → use `#D6450F` (`--brand-text`)
- White text on orange button → ✓ correct; navy text on orange → ✗ wrong
- Emoji for UI icons → use Lucide SVG
- Hover-only interactive feedback → always add `:active` for mobile
- Transparent border at rest → always visible border (`rgba(26,26,46,0.16)`)
- Hardcoded hex in JSX/HTML → use CSS token variable
- Any font other than Inter → forbidden
- Graph paper missing from a section background → always include it
- Aggressive glow / heavy drop shadows → keep diffuse and subtle

---

### 14. Quick Component Recipes

**Input with label:**
```html
<div style="display:flex;flex-direction:column;gap:4px;">
  <label style="font-size:11px;font-weight:600;color:rgba(26,26,46,0.50);letter-spacing:0.05em;text-transform:uppercase;">
    Field Label
  </label>
  <input style="font-family:Inter,sans-serif;font-size:14px;font-weight:500;color:#1A1A2E;background:#fff;border:1.5px solid rgba(26,26,46,0.18);border-radius:8px;padding:10px 12px;outline:none;transition:border-color 180ms,box-shadow 180ms;" placeholder="Placeholder…">
</div>
```

**Chip:**
```html
<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:9999px;border:1px solid rgba(26,26,46,0.10);background:#FFF0EB;color:#D6450F;font-size:11px;font-weight:600;">
  <span style="width:6px;height:6px;border-radius:50%;background:#FF6535;"></span>
  P2 High
</span>
```

**Icon button:**
```html
<button style="width:34px;height:34px;border-radius:8px;border:1.5px solid rgba(26,26,46,0.16);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(26,26,46,0.50);transition:all 160ms;" aria-label="Settings">
  <i data-lucide="settings" style="width:14px;height:14px;"></i>
</button>
```

**Eyebrow:**
```html
<span style="font-family:Inter,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#FF6535;">
  Section Label
</span>
```

---

### 15. File Reference

All tokens, utilities, and component patterns are in:

```
.claude/skills/frontend-design/
├── SKILL.md                        ← Master rules
├── AGENT_PROMPT.md                 ← This file
├── DESIGN_SYSTEM.md                ← All files combined
├── assets/
│   ├── tokens.css                  ← CSS custom properties
│   └── demo.html                   ← Live component showcase
└── references/
    ├── accessibility.md
    ├── aesthetics.md
    ├── components.md
    ├── mobile.md
    └── performance.md
```

Link tokens in any HTML page:
```html
<link rel="stylesheet" href=".claude/skills/frontend-design/assets/tokens.css">
```


---

## SKILL.md

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


---

## assets/tokens.css

```css
/* ============================================================
   RISE OS — Design Tokens (Orange Brand Edition)
   Color palette: Muhammed Ajmal Consulting orange system.
   Typography: Inter only — no other typefaces.
   Import once at app root via @import or <link>.
   Never hardcode hex values in components — use tokens only.
   ============================================================ */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

:root {

  /* ── Brand palette ──────────────────────────────────────── */
  --color-navy:         #1A1A2E;   /* charcoal — primary text & dark sections */
  --color-navy-deep:    #0B1120;   /* deepest navy — footer */
  --color-orange:       #FF6535;   /* brand orange — CTAs, accents, primary */
  --color-orange-hover: #FF8159;   /* lighter orange — hover / gradient end */
  --color-orange-ink:   #D6450F;   /* deep orange — text on white (AA 4.5:1) */
  --color-orange-tint:  #FFF0EB;   /* 6% orange — badge/chip backgrounds */
  --color-ivory:        #FFFFFF;   /* white base */
  --color-paper:        #F9FAFB;   /* gray-50 — alternating light sections */
  --color-crimson:      #E11D48;   /* error / danger */
  --color-emerald:      #10B981;   /* success / positive */
  --color-slate:        #6B6B6B;   /* secondary text */
  --color-line:         #E5E5E5;   /* borders / dividers */

  /* ── Semantic surface aliases ───────────────────────────── */
  --surface-base:       var(--color-ivory);
  --surface-paper:      var(--color-paper);
  --surface-card:       var(--color-ivory);
  --surface-dark:       var(--color-navy);
  --surface-footer:     var(--color-navy-deep);
  --surface-overlay:    rgba(26, 26, 46, 0.60);  /* modal scrim */

  /* ── Semantic text aliases ──────────────────────────────── */
  --text-strong:        var(--color-navy);
  --text-body:          rgba(26, 26, 46, 0.70);   /* navy/70 — paragraph copy */
  --text-muted:         rgba(26, 26, 46, 0.50);   /* navy/50 — captions */
  --text-on-dark:       #FFFFFF;
  --text-on-dark-soft:  rgba(255, 255, 255, 0.70);
  --text-on-brand:      #FFFFFF;                   /* text on orange fill */

  /* ── Brand semantic ─────────────────────────────────────── */
  --brand:              var(--color-orange);
  --brand-hover:        var(--color-orange-hover);
  --brand-text:         var(--color-orange-ink);   /* orange text on white */
  --brand-tint:         var(--color-orange-tint);

  /* ── Borders ────────────────────────────────────────────── */
  --border-subtle:      rgba(26, 26, 46, 0.10);    /* default card border */
  --border-line:        var(--color-line);
  --border-brand:       rgba(255, 101, 53, 0.30);  /* orange border accent */
  --border-on-dark:     rgba(255, 101, 53, 0.20);  /* borders in dark sections */
  --border-focus:       var(--color-orange);        /* focus ring */

  /* ── Semantic status ────────────────────────────────────── */
  --color-success:      var(--color-emerald);
  --color-success-tint: #D1FAE5;
  --color-danger:       var(--color-crimson);
  --color-danger-tint:  #FEE2E2;
  --color-warning:      #F59E0B;
  --color-warning-tint: #FEF3C7;

  /* ── Priority tokens ─────────────────────────────────────  */
  --color-p1:           #EF4444;   /* P1 Urgent */
  --color-p2:           var(--color-orange);   /* P2 High — brand orange */
  --color-p3:           #3B82F6;   /* P3 Medium */
  --color-p4:           #9CA3AF;   /* P4 Low */

  /* ── Typography — Inter only ────────────────────────────── */
  --font-sans:   'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono:   'JetBrains Mono', 'Fira Code', ui-monospace, monospace;

  /* Weights */
  --fw-regular:   400;
  --fw-medium:    500;
  --fw-semibold:  600;
  --fw-bold:      700;
  --fw-extrabold: 800;

  /* Type scale */
  --text-eyebrow: 0.6875rem;  /* 11px — uppercase section labels */
  --text-xs:      0.75rem;    /* 12px */
  --text-sm:      0.875rem;   /* 14px — base body */
  --text-base:    1rem;       /* 16px — min input (prevents iOS zoom) */
  --text-lg:      1.125rem;   /* 18px */
  --text-xl:      1.25rem;    /* 20px — page title */
  --text-2xl:     1.5rem;     /* 24px */
  --text-3xl:     1.875rem;   /* 30px */
  --text-4xl:     2.25rem;    /* 36px */
  --text-5xl:     3rem;       /* 48px — hero display */

  /* Letter-spacing */
  --tracking-tight:   -0.02em;  /* display headings */
  --tracking-normal:   0;
  --tracking-wide:     0.05em;
  --tracking-widest:   0.15em;  /* uppercase eyebrows */

  /* Line-height */
  --leading-tight:    1.15;
  --leading-snug:     1.35;
  --leading-normal:   1.5;
  --leading-relaxed:  1.65;

  /* ── Spacing — 8pt grid ─────────────────────────────────── */
  --space-1:   4px;
  --space-2:   8px;
  --space-3:   12px;
  --space-4:   16px;
  --space-5:   20px;
  --space-6:   24px;
  --space-8:   32px;
  --space-10:  40px;
  --space-12:  48px;
  --space-16:  64px;
  --space-20:  80px;
  --space-24:  96px;

  /* ── Radii ──────────────────────────────────────────────── */
  --radius-sm:     4px;    /* buttons, chips */
  --radius-input:  8px;    /* inputs */
  --radius-card:   12px;   /* cards */
  --radius-panel:  16px;   /* feature panels, modals */
  --radius-full:   9999px; /* pills, badges, dots */

  /* ── Shadows ────────────────────────────────────────────── */
  --shadow-sm:     0 1px 3px rgba(26, 26, 46, 0.08);
  --shadow-card:   0 1px 3px rgba(26, 26, 46, 0.08);
  --shadow-hover:  0 4px 16px rgba(26, 26, 46, 0.12);
  --shadow-popup:  0 8px 32px rgba(26, 26, 46, 0.14);
  --shadow-brand:  0 4px 16px rgba(255, 101, 53, 0.25);  /* orange glow CTAs */

  /* ── Motion ─────────────────────────────────────────────── */
  --ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);  /* entrances / confirmations */
  --ease-smooth:  cubic-bezier(0.4, 0, 0.2, 1);        /* state changes */
  --ease-out:     cubic-bezier(0.16, 1, 0.3, 1);       /* brand easing */
  --ease-exit:    cubic-bezier(0.4, 0, 1, 1);           /* exits */

  --dur-instant:  80ms;
  --dur-fast:     150ms;
  --dur-normal:   250ms;
  --dur-slow:     400ms;
  --dur-enter:    350ms;
}


/* ============================================================
   Base reset
   ============================================================ */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--fw-regular);
  line-height: var(--leading-normal);
  color: var(--text-strong);
  background: var(--surface-base);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-sans);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
  color: var(--text-strong);
}

/* ── Global focus ring ──────────────────────────────────── */
*:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}


/* ============================================================
   Typography utilities
   ============================================================ */

.eyebrow {
  font-family: var(--font-sans);
  font-size: var(--text-eyebrow);
  font-weight: var(--fw-bold);
  letter-spacing: var(--tracking-widest);
  text-transform: uppercase;
  color: var(--brand);
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.text-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-title-complete {
  text-decoration: line-through;
  color: var(--text-muted);
}


/* ============================================================
   Layout primitives
   ============================================================ */

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cluster {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.content-rail {
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: var(--space-6);
}


/* ============================================================
   Card system
   ============================================================ */

.card {
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: var(--space-5);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition:
    border-color var(--dur-fast) var(--ease-smooth),
    box-shadow   var(--dur-fast) var(--ease-smooth),
    transform    var(--dur-fast) var(--ease-smooth);
}

.card:hover {
  border-color: var(--brand);
  box-shadow: var(--shadow-hover);
  transform: translateY(-1px);
}

/* Orange top-bar wipe on hover */
.card::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 3px;
  background: var(--brand);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--dur-normal) var(--ease-out);
}
.card:hover::before {
  transform: scaleX(1);
}

.card--dark {
  background: var(--surface-dark);
  border-color: var(--border-on-dark);
  color: var(--text-on-dark);
}

.card--active {
  border-color: var(--brand);
  box-shadow: var(--shadow-brand);
}


/* ============================================================
   Buttons
   ============================================================ */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 44px;
  min-width: 44px;
  padding-inline: var(--space-5);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--fw-bold);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  text-decoration: none;
  transition:
    background var(--dur-fast) var(--ease-smooth),
    box-shadow  var(--dur-fast) var(--ease-smooth),
    transform   var(--dur-instant) var(--ease-smooth);
}

/* Primary — orange fill */
.btn--primary {
  background: var(--brand);
  color: var(--text-on-brand);
  box-shadow: var(--shadow-brand);
}
.btn--primary:hover {
  background: var(--brand-hover);
}
.btn--primary:active {
  transform: scale(0.97);
}

/* Secondary — navy outline */
.btn--secondary {
  background: transparent;
  color: var(--text-strong);
  border-color: var(--border-subtle);
}
.btn--secondary:hover {
  border-color: var(--brand);
  color: var(--brand-text);
}

/* Ghost — on dark sections */
.btn--ghost {
  background: transparent;
  color: var(--text-on-dark);
  border-color: var(--border-on-dark);
}
.btn--ghost:hover {
  background: rgba(255, 101, 53, 0.10);
  border-color: var(--brand);
}


/* ============================================================
   Badge / Chip
   ============================================================ */

.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  font-size: var(--text-eyebrow);
  font-weight: var(--fw-bold);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  border-radius: var(--radius-full);
  background: var(--brand-tint);
  color: var(--brand-text);
}


/* ============================================================
   Tap target
   ============================================================ */

.tap-target {
  min-height: 44px;
  min-width: 44px;
}


/* ============================================================
   Touch feedback
   ============================================================ */

.tappable {
  transition: transform var(--dur-instant) var(--ease-smooth);
}
.tappable:active {
  transform: scale(0.96);
}


/* ============================================================
   Skeleton loader
   ============================================================ */

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-paper) 25%,
    var(--color-line)  50%,
    var(--color-paper) 75%
  );
  background-size: 200% 100%;
  animation: skeletonPulse 1.4s ease-in-out infinite;
  border-radius: var(--radius-input);
}
@keyframes skeletonPulse {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}


/* ============================================================
   Animations
   ============================================================ */

@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.slide-up {
  animation: slideUp var(--dur-enter) var(--ease-out) both;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.fade-in {
  animation: fadeIn var(--dur-normal) var(--ease-smooth) both;
}

@keyframes checkmark {
  0%   { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: 0; }
}
.checkmark-path {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
  animation: checkmark 0.25s ease forwards;
}

/* Stagger helpers */
.stagger-1 { animation-delay: 0.08s; }
.stagger-2 { animation-delay: 0.16s; }
.stagger-3 { animation-delay: 0.24s; }
.stagger-4 { animation-delay: 0.32s; }


/* ============================================================
   Graph-paper texture (brand signature)
   ============================================================ */

.graph-bg {
  background-image:
    linear-gradient(rgba(26, 26, 46, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(26, 26, 46, 0.08) 1px, transparent 1px);
  background-size: 40px 40px;
}

.graph-bg-dark {
  background-image:
    linear-gradient(rgba(255, 101, 53, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 101, 53, 0.07) 1px, transparent 1px);
  background-size: 40px 40px;
}


/* ============================================================
   Scrollbar
   ============================================================ */

.scrollbar-hide {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scrollbar-hide::-webkit-scrollbar { display: none; }


/* ============================================================
   Bottom navigation (mobile only)
   ============================================================ */

.bottom-nav {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: rgba(255, 255, 255, 0.90);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid var(--border-subtle);
  padding-bottom: env(safe-area-inset-bottom);
  height: calc(56px + env(safe-area-inset-bottom));
}

.nav-item {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-smooth);
}
.nav-item[aria-current="true"] {
  color: var(--brand);
}


/* ============================================================
   Accessibility
   ============================================================ */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

```

---

## assets/demo.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RISE OS — Design System Demo</title>
  <link rel="stylesheet" href="tokens.css">
  <style>

    /* ── Keyframes ──────────────────────────────────────────── */
    @keyframes shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes borderPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,101,53,0); }
      50%       { box-shadow: 0 0 0 4px rgba(255,101,53,0.15); }
    }
    @keyframes checkPop {
      0%   { transform: scale(0.7); }
      60%  { transform: scale(1.15); }
      100% { transform: scale(1); }
    }
    @keyframes progressLoad {
      from { width: 0; }
    }
    @keyframes progressShimmer {
      0%   { background-position: -300% 0; }
      100% { background-position: 300% 0; }
    }
    @keyframes glowPulse {
      0%, 100% { opacity: 0.5; }
      50%       { opacity: 1; }
    }
    @keyframes toastIn {
      from { transform: translateX(120%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }

    /* ── Page shell ─────────────────────────────────────────── */
    body {
      min-height: 100vh;
      padding: 64px 32px 96px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 56px;
      background-color: var(--surface-base);
      background-image:
        linear-gradient(rgba(26,26,46,0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(26,26,46,0.08) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    /* ── Sections ───────────────────────────────────────────── */
    .section { width: 100%; max-width: 960px; }
    .section-head { margin-bottom: 20px; }

    /* ── Demo grids ─────────────────────────────────────────── */
    .demo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    .demo-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    @media (max-width: 640px) { .demo-grid-3 { grid-template-columns: 1fr; } }

    /* ── Card — always-visible border, subtle hover ───────────── */
    .card {
      position: relative;
      overflow: hidden;
      background: var(--surface-card);
      border: 1.5px solid rgba(26,26,46,0.16);
      border-radius: var(--radius-card);
      padding: 20px;
      box-shadow:
        0 1px 3px rgba(26,26,46,0.07),
        0 2px 8px rgba(26,26,46,0.05),
        inset 0 1px 0 rgba(255,255,255,0.9);
      transition:
        border-color 200ms ease,
        box-shadow   200ms ease,
        transform    180ms var(--ease-out);
    }
    .card > * { position: relative; z-index: 1; }
    /* Top-bar wipe */
    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 2px;
      background: linear-gradient(90deg, var(--brand), var(--brand-hover));
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 240ms var(--ease-out);
      z-index: 2;
    }
    .card:hover {
      border-color: rgba(255,101,53,0.50);
      box-shadow:
        0 0 0 3px rgba(255,101,53,0.08),
        0 6px 20px rgba(26,26,46,0.10);
      transform: translateY(-1px);
    }
    .card:hover::before { transform: scaleX(1); }

    /* ── Divider ─────────────────────────────────────────────── */
    .divider {
      width: 100%; height: 1px;
      background: rgba(26,26,46,0.13);
      margin: 16px 0;
    }

    /* ── Form fields ─────────────────────────────────────────── */
    .field { display: flex; flex-direction: column; gap: var(--space-1); }
    .field-label {
      font-size: var(--text-xs);
      font-weight: var(--fw-semibold);
      color: var(--text-muted);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      transition: color 150ms ease;
    }
    .field:focus-within .field-label { color: var(--brand-text); }

    .input, .select {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      font-weight: var(--fw-medium);
      color: var(--text-strong);
      background: var(--surface-card);
      border: 1.5px solid rgba(26,26,46,0.18);
      border-radius: var(--radius-input);
      padding: 10px 12px;
      width: 100%;
      outline: none;
      transition:
        border-color 180ms ease,
        box-shadow   180ms ease,
        background   180ms ease;
      appearance: none;
      -webkit-appearance: none;
    }
    .input:hover:not(:focus), .select:hover:not(:focus) {
      border-color: rgba(255,101,53,0.50);
    }
    .input:focus, .select:focus {
      border-color: var(--brand);
      background: rgba(255,101,53,0.015);
      box-shadow: 0 0 0 3px rgba(255,101,53,0.10);
    }
    .input::placeholder { color: var(--text-muted); }

    /* Custom select arrow */
    .select-wrap { position: relative; }
    .select-wrap::after {
      content: '';
      position: absolute;
      right: 13px; top: 50%;
      transform: translateY(-50%);
      width: 0; height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 5px solid var(--text-muted);
      pointer-events: none;
      transition: border-top-color 150ms ease;
    }
    .select-wrap:focus-within::after { border-top-color: var(--brand); }
    .select { padding-right: 32px; cursor: pointer; }

    /* ── Checkbox ────────────────────────────────────────────── */
    .check-row {
      display: flex; align-items: center;
      gap: 12px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid rgba(26,26,46,0.10);
      cursor: pointer;
      transition: background 150ms ease, border-color 150ms ease;
    }
    .check-row:hover {
      background: rgba(255,101,53,0.03);
      border-color: rgba(255,101,53,0.35);
    }
    .check-box {
      width: 19px; height: 19px;
      border-radius: 5px;
      border: 2px solid rgba(26,26,46,0.22);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition:
        background 180ms var(--ease-spring),
        border-color 180ms ease,
        box-shadow   180ms ease,
        transform    180ms var(--ease-spring);
    }
    .check-box:hover { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(255,101,53,0.12); }
    .check-box.checked {
      background: var(--brand);
      border-color: var(--brand);
      box-shadow: 0 0 0 3px rgba(255,101,53,0.15), 0 2px 6px rgba(255,101,53,0.3);
      animation: checkPop 0.3s var(--ease-spring);
    }
    .check-box.checked::after {
      content: '';
      width: 5px; height: 9px;
      border: 2px solid white;
      border-top: none; border-left: none;
      transform: rotate(45deg) translateY(-1px);
      display: block;
    }
    .check-label { font-size: var(--text-sm); font-weight: var(--fw-medium); color: var(--text-strong); transition: color 180ms ease; }
    .check-label.done { text-decoration: line-through; color: var(--text-muted); }

    /* ── Option buttons (radio-style) ────────────────────────── */
    .option-group { display: flex; flex-direction: column; gap: var(--space-2); }
    .option-btn {
      display: flex; align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border: 1.5px solid rgba(26,26,46,0.16);
      border-radius: var(--radius-card);
      background: var(--surface-card);
      cursor: pointer;
      font-family: var(--font-sans);
      text-align: left;
      transition:
        border-color 180ms ease,
        background   180ms ease,
        box-shadow   180ms ease;
    }
    .option-btn:hover {
      border-color: rgba(255,101,53,0.50);
      background: rgba(255,101,53,0.025);
    }
    .option-btn.selected {
      border-color: var(--brand);
      background: var(--brand-tint);
      box-shadow: 0 0 0 3px rgba(255,101,53,0.10);
    }
    .option-dot {
      width: 17px; height: 17px;
      border-radius: var(--radius-full);
      border: 2px solid rgba(26,26,46,0.22);
      flex-shrink: 0;
      transition:
        border-color 180ms ease,
        background   180ms var(--ease-spring),
        box-shadow   180ms ease,
        transform    180ms var(--ease-spring);
    }
    .option-btn:hover .option-dot { border-color: var(--brand); }
    .option-btn.selected .option-dot {
      border-color: var(--brand);
      background: var(--brand);
      box-shadow: inset 0 0 0 3px white, 0 0 6px rgba(255,101,53,0.4);
      transform: scale(1.1);
    }
    .option-text { font-size: var(--text-sm); font-weight: var(--fw-semibold); color: var(--text-strong); }

    /* ── Chips ───────────────────────────────────────────────── */
    .chip {
      display: inline-flex; align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: var(--radius-full);
      border: 1px solid rgba(26,26,46,0.10);
      font-size: 11px; font-weight: var(--fw-semibold);
      letter-spacing: 0.02em;
      transition: transform 150ms ease, box-shadow 150ms ease;
    }
    .chip:hover { border-color: rgba(255,101,53,0.35); }
    .chip:hover { transform: translateY(-1px); }
    .chip-dot { width: 6px; height: 6px; border-radius: var(--radius-full); flex-shrink: 0; }

    /* ── Progress bar — animated shimmer fill ────────────────── */
    .progress-track {
      height: 8px;
      background: rgba(26,26,46,0.05);
      border-radius: var(--radius-full);
      overflow: hidden;
      border: 1px solid rgba(26,26,46,0.14);
    }
    .progress-fill {
      height: 100%;
      border-radius: var(--radius-full);
      background: linear-gradient(
        90deg,
        var(--brand) 0%,
        var(--brand-hover) 50%,
        var(--brand) 100%
      );
      background-size: 300% 100%;
      animation:
        progressLoad 0.9s var(--ease-out) both,
        progressShimmer 2.5s linear 0.9s infinite;
    }

    /* ── Modal ───────────────────────────────────────────────── */
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(26,26,46,0.5);
      backdrop-filter: blur(6px) saturate(140%);
      display: flex; align-items: center; justify-content: center;
      z-index: 100;
      opacity: 0; pointer-events: none;
      transition: opacity var(--dur-normal) ease;
    }
    .modal-backdrop.open { opacity: 1; pointer-events: all; }
    .modal {
      background: var(--surface-card);
      border: 1.5px solid rgba(255,101,53,0.15);
      border-radius: var(--radius-panel);
      box-shadow:
        0 0 0 1px rgba(255,101,53,0.06),
        0 24px 64px rgba(26,26,46,0.18),
        0 8px 24px rgba(26,26,46,0.10);
      width: 100%; max-width: 480px;
      margin: var(--space-4);
      transform: translateY(16px) scale(0.98);
      transition: transform var(--dur-normal) var(--ease-out), box-shadow var(--dur-normal) ease;
      overflow: hidden;
    }
    .modal-backdrop.open .modal {
      transform: translateY(0) scale(1);
      box-shadow:
        0 0 0 1px rgba(255,101,53,0.1),
        0 32px 80px rgba(26,26,46,0.2),
        0 12px 32px rgba(26,26,46,0.12);
    }
    /* Orange top accent on modal */
    .modal::before {
      content: '';
      display: block;
      height: 3px;
      background: linear-gradient(90deg, var(--brand), var(--brand-hover));
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-5) var(--space-5) var(--space-4);
      border-bottom: 1px solid rgba(26,26,46,0.14);
    }
    .modal-body { padding: var(--space-5); }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-top: 1px solid rgba(26,26,46,0.14);
      background: var(--surface-paper);
    }
    .icon-btn {
      width: 34px; height: 34px;
      border-radius: var(--radius-input);
      border: 1.5px solid rgba(26,26,46,0.16);
      background: transparent; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; color: var(--text-muted);
      transition: all 160ms ease;
    }
    .icon-btn:hover {
      border-color: var(--brand);
      color: var(--brand);
      background: var(--brand-tint);
      box-shadow: 0 0 0 3px rgba(255,101,53,0.1);
      transform: rotate(90deg);
    }

    /* ── Tooltip ─────────────────────────────────────────────── */
    .tooltip-wrap { position: relative; display: inline-flex; }
    .tooltip-wrap:hover .tooltip { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }
    .tooltip {
      position: absolute;
      bottom: calc(100% + 8px); left: 50%;
      transform: translateX(-50%) translateY(5px);
      background: var(--color-navy);
      border: 1px solid rgba(255,101,53,0.2);
      color: white;
      font-size: 11px; font-weight: var(--fw-medium);
      white-space: nowrap;
      padding: 5px 11px;
      border-radius: 7px;
      opacity: 0; pointer-events: none;
      box-shadow: 0 4px 14px rgba(26,26,46,0.25);
      transition: opacity 160ms ease, transform 160ms var(--ease-out);
    }
    .tooltip::after {
      content: '';
      position: absolute; top: 100%; left: 50%;
      transform: translateX(-50%);
      border: 4px solid transparent;
      border-top-color: var(--color-navy);
    }

    /* ── Toast ───────────────────────────────────────────────── */
    .toast-area {
      position: fixed; bottom: var(--space-6); right: var(--space-6);
      display: flex; flex-direction: column; gap: var(--space-2);
      z-index: 200;
    }
    .toast {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: var(--color-navy);
      border: 1px solid rgba(255,101,53,0.2);
      border-left: 3px solid var(--brand);
      color: white;
      border-radius: var(--radius-card);
      box-shadow: 0 8px 32px rgba(26,26,46,0.2), 0 0 0 1px rgba(255,101,53,0.08);
      font-size: var(--text-sm); font-weight: var(--fw-medium);
      min-width: 260px;
      transform: translateX(120%); opacity: 0;
      transition: transform var(--dur-enter) var(--ease-out), opacity var(--dur-enter) ease;
    }
    .toast.show { transform: translateX(0); opacity: 1; }
    .toast-icon {
      width: 24px; height: 24px;
      border-radius: var(--radius-full);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; flex-shrink: 0;
    }

    /* ── Dark CTA strip ──────────────────────────────────────── */
    .dark-strip {
      background: var(--surface-dark);
      border-radius: var(--radius-panel);
      border: 1px solid rgba(255,101,53,0.15);
      padding: var(--space-10) var(--space-8);
      text-align: center;
      position: relative; overflow: hidden;
      box-shadow: 0 4px 24px rgba(26,26,46,0.2), inset 0 1px 0 rgba(255,101,53,0.15);
    }
    .dark-strip::before {
      content: ''; position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(255,101,53,0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,101,53,0.07) 1px, transparent 1px);
      background-size: 40px 40px;
    }
    /* Radial orange glow center */
    .dark-strip::after {
      content: ''; position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 500px; height: 300px;
      background: radial-gradient(ellipse, rgba(255,101,53,0.12) 0%, transparent 70%);
      pointer-events: none;
    }
    .dark-strip > * { position: relative; z-index: 1; }

    /* ── Kanban ──────────────────────────────────────────────── */
    .kanban-col {
      background: var(--surface-paper);
      border: 1.5px solid rgba(26,26,46,0.14);
      border-radius: var(--radius-card);
      padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .kanban-header {
      font-size: 11px; font-weight: var(--fw-bold);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase; color: var(--text-muted);
      padding: 0 var(--space-1) var(--space-2);
      border-bottom: 1px solid rgba(26,26,46,0.14);
      display: flex; align-items: center; justify-content: space-between;
    }
    .task-card {
      background: var(--surface-card);
      border: 1.5px solid rgba(26,26,46,0.16);
      border-radius: 8px;
      padding: 12px;
      cursor: pointer;
      position: relative; overflow: hidden;
      transition:
        border-color 180ms ease,
        box-shadow   180ms ease,
        transform    160ms var(--ease-out);
    }
    /* Left orange accent bar */
    .task-card::before {
      content: '';
      position: absolute; top: 0; left: 0;
      width: 3px; height: 100%;
      background: linear-gradient(to bottom, var(--brand), var(--brand-hover));
      transform: scaleY(0);
      transform-origin: top;
      transition: transform 220ms var(--ease-out);
    }
    .task-card:hover {
      border-color: rgba(255,101,53,0.50);
      box-shadow: 0 0 0 3px rgba(255,101,53,0.07), 0 3px 10px rgba(26,26,46,0.08);
      transform: translateY(-1px);
    }
    .task-card:hover::before { transform: scaleY(1); }
    .task-title { font-size: var(--text-sm); font-weight: var(--fw-medium); color: var(--text-strong); margin-bottom: var(--space-2); }
    .task-meta { display: flex; align-items: center; gap: var(--space-2); }

    /* ── Swatches ────────────────────────────────────────────── */
    .swatch-row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
    .swatch { display: flex; flex-direction: column; align-items: center; gap: 5px; }
    .swatch-dot {
      width: 40px; height: 40px; border-radius: var(--radius-full);
      border: 1.5px solid rgba(26,26,46,0.15);
      transition: transform 150ms var(--ease-spring), box-shadow 150ms ease;
    }
    .swatch-dot:hover { transform: scale(1.15); box-shadow: 0 4px 12px rgba(26,26,46,0.15); }
    .swatch-name { font-size: 9px; font-weight: var(--fw-semibold); color: var(--text-muted); text-align: center; max-width: 52px; }

    /* ── Type rows ───────────────────────────────────────────── */
    .type-row {
      display: flex; align-items: baseline; gap: var(--space-4);
      padding: var(--space-3) 0;
      border-bottom: 1px solid rgba(26,26,46,0.12);
      transition: background 150ms ease;
    }
    .type-row:last-child { border-bottom: none; }
    .type-row:hover { background: rgba(255,101,53,0.02); border-radius: 6px; }
    .type-meta { min-width: 72px; font-size: 10px; font-weight: var(--fw-semibold); color: var(--text-muted); letter-spacing: 0.06em; text-transform: uppercase; }

    /* ── Buttons (augment tokens.css) ───────────────────────── */
    .btn {
      border: 1.5px solid transparent;
    }
    .btn--primary {
      position: relative; overflow: hidden;
      border-color: rgba(255,101,53,0.2);
    }
    /* Shimmer sweep */
    .btn--primary::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.18) 50%, transparent 65%);
      background-size: 200% 100%;
      background-position: -200% 0;
      transition: background-position 0s;
    }
    .btn--primary:hover::after {
      background-position: 200% 0;
      transition: background-position 500ms ease;
    }
    .btn--primary:hover {
      box-shadow: 0 0 0 3px rgba(255,101,53,0.14), 0 3px 12px rgba(255,101,53,0.2);
    }
    .btn--secondary {
      border-color: rgba(26,26,46,0.18);
    }
    .btn--secondary:hover {
      border-color: rgba(255,101,53,0.50);
      box-shadow: 0 0 0 3px rgba(255,101,53,0.07);
    }

    /* ── Mobile :active states (touch feedback) ─────────────── */
    .card:active        { transform: scale(0.995); box-shadow: 0 1px 3px rgba(26,26,46,0.07); }
    .task-card:active   { transform: scale(0.975); border-color: rgba(255,101,53,0.45) !important; }
    .check-row:active   { background: rgba(255,101,53,0.07) !important; border-color: rgba(255,101,53,0.35) !important; }
    .option-btn:active  { border-color: rgba(255,101,53,0.55) !important; background: rgba(255,101,53,0.06) !important; transform: scale(0.99); }
    .btn:active         { transform: scale(0.95) !important; box-shadow: none !important; }
    .swatch-dot:active  { transform: scale(1.12); }
    .icon-btn:active    { background: var(--brand-tint) !important; border-color: var(--brand) !important; }

    /* ── Premium icon container ──────────────────────────────── */
    .icon-wrap {
      width: 40px; height: 40px;
      border-radius: 10px;
      background: var(--brand-tint);
      border: 1.5px solid rgba(255,101,53,0.22);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px;
      box-shadow: 0 2px 8px rgba(255,101,53,0.10), inset 0 1px 0 rgba(255,255,255,0.6);
      flex-shrink: 0;
    }

    /* ── Premium progress track ──────────────────────────────── */
    .progress-wrap {
      display: flex; justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .progress-label { font-size: var(--text-sm); font-weight: var(--fw-semibold); color: var(--text-strong); }
    .progress-pct   { font-size: var(--text-sm); font-weight: var(--fw-bold); }
  </style>
</head>
<body>

  <!-- ── Hero ─────────────────────────────────────────────── -->
  <header class="section slide-up" style="text-align:center;">
    <div class="eyebrow" style="margin-bottom:var(--space-3);">Design System — Inter / Orange</div>
    <h1 style="font-size:var(--text-5xl);font-weight:var(--fw-extrabold);letter-spacing:var(--tracking-tight);line-height:1.1;margin-bottom:var(--space-4);">
      RISE OS <span style="color:var(--brand);">Components</span>
    </h1>
    <p style="font-size:var(--text-lg);color:var(--text-body);max-width:560px;margin:0 auto var(--space-6);line-height:var(--leading-relaxed);">
      Orange brand palette · Inter-only type · Graph-paper texture · Every token and pattern.
    </p>
    <div style="display:flex;gap:var(--space-3);justify-content:center;flex-wrap:wrap;">
      <button class="btn btn--primary" onclick="openModal()">Open Modal →</button>
      <button class="btn btn--secondary" onclick="showToast()">Show Toast</button>
    </div>
  </header>


  <!-- ── Color Palette ─────────────────────────────────────── -->
  <section class="section slide-up stagger-1">
    <div class="section-head">
      <div class="eyebrow">Color Tokens</div>
    </div>
    <div class="card">
      <div class="swatch-row">
        <div class="swatch"><div class="swatch-dot" style="background:#FF6535;border-color:#FF6535;"></div><span class="swatch-name">--brand</span></div>
        <div class="swatch"><div class="swatch-dot" style="background:#FF8159;border-color:#FF8159;"></div><span class="swatch-name">--brand-hover</span></div>
        <div class="swatch"><div class="swatch-dot" style="background:#D6450F;border-color:#D6450F;"></div><span class="swatch-name">--brand-text</span></div>
        <div class="swatch"><div class="swatch-dot" style="background:#FFF0EB;"></div><span class="swatch-name">--brand-tint</span></div>
        <div class="swatch"><div class="swatch-dot" style="background:#1A1A2E;border-color:#1A1A2E;"></div><span class="swatch-name">--surface-dark</span></div>
        <div class="swatch"><div class="swatch-dot" style="background:#0B1120;border-color:#0B1120;"></div><span class="swatch-name">--surface-footer</span></div>
        <div class="swatch"><div class="swatch-dot" style="background:#F9FAFB;"></div><span class="swatch-name">--surface-paper</span></div>
        <div class="swatch"><div class="swatch-dot" style="background:#10B981;border-color:#10B981;"></div><span class="swatch-name">--color-success</span></div>
        <div class="swatch"><div class="swatch-dot" style="background:#E11D48;border-color:#E11D48;"></div><span class="swatch-name">--color-danger</span></div>
        <div class="swatch"><div class="swatch-dot" style="background:#F59E0B;border-color:#F59E0B;"></div><span class="swatch-name">--color-warning</span></div>
        <div class="swatch"><div class="swatch-dot" style="background:#3B82F6;border-color:#3B82F6;"></div><span class="swatch-name">--color-p3</span></div>
        <div class="swatch"><div class="swatch-dot" style="background:#6B6B6B;border-color:#6B6B6B;"></div><span class="swatch-name">--color-slate</span></div>
      </div>
    </div>
  </section>


  <!-- ── Typography ────────────────────────────────────────── -->
  <section class="section slide-up stagger-2">
    <div class="section-head">
      <div class="eyebrow">Typography — Inter Only</div>
    </div>
    <div class="card">
      <div class="type-row">
        <span class="type-meta">48 / 800</span>
        <span style="font-size:var(--text-5xl);font-weight:var(--fw-extrabold);letter-spacing:var(--tracking-tight);line-height:1.1;color:var(--text-strong);">Hero Display</span>
      </div>
      <div class="type-row">
        <span class="type-meta">36 / 700</span>
        <span style="font-size:var(--text-4xl);font-weight:var(--fw-bold);letter-spacing:var(--tracking-tight);">Section Heading</span>
      </div>
      <div class="type-row">
        <span class="type-meta">24 / 700</span>
        <span style="font-size:var(--text-2xl);font-weight:var(--fw-bold);">Card Group Title</span>
      </div>
      <div class="type-row">
        <span class="type-meta">20 / 700</span>
        <span style="font-size:var(--text-xl);font-weight:var(--fw-bold);">Page Title</span>
      </div>
      <div class="type-row">
        <span class="type-meta">16 / 600</span>
        <span style="font-size:var(--text-base);font-weight:var(--fw-semibold);">Card / Section Title</span>
      </div>
      <div class="type-row">
        <span class="type-meta">14 / 500</span>
        <span style="font-size:var(--text-sm);font-weight:var(--fw-medium);color:var(--text-body);">Body — readable paragraph copy for dashboards and lists.</span>
      </div>
      <div class="type-row">
        <span class="type-meta">12 / 400</span>
        <span style="font-size:var(--text-xs);color:var(--text-muted);">Meta / Caption — created Jan 3, 2026 · 4 comments · Dubai, UAE</span>
      </div>
      <div class="type-row">
        <span class="type-meta">11 / 700</span>
        <span class="eyebrow">Eyebrow Label — All Caps</span>
      </div>
    </div>
  </section>


  <!-- ── Buttons ───────────────────────────────────────────── -->
  <section class="section slide-up stagger-1">
    <div class="section-head">
      <div class="eyebrow">Buttons</div>
    </div>
    <div class="card">
      <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;align-items:center;margin-bottom:var(--space-4);">
        <button class="btn btn--primary">Primary →</button>
        <button class="btn btn--secondary">Secondary</button>
        <button class="btn btn--primary" style="background:var(--surface-dark);color:white;border:1px solid rgba(255,101,53,0.3);box-shadow:none;">Dark Ghost</button>
        <button class="btn btn--primary" style="background:var(--brand-tint);color:var(--color-navy);box-shadow:none;pointer-events:none;border:1px solid rgba(255,101,53,0.2);">Disabled</button>
      </div>
      <div class="divider"></div>
      <p style="font-size:var(--text-xs);color:var(--text-muted);">
        Primary: white text on orange · 4px radius · 44px min height · hover lightens · active scales 0.97
      </p>
    </div>
  </section>


  <!-- ── Badges / Chips / Status ────────────────────────────── -->
  <section class="section slide-up stagger-2">
    <div class="section-head">
      <div class="eyebrow">Badges, Chips & Status</div>
    </div>
    <div class="demo-grid">
      <div class="card">
        <div class="card-title" style="font-size:var(--text-base);font-weight:var(--fw-bold);margin-bottom:var(--space-3);">Priority</div>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
          <span class="chip" style="background:#FEF2F2;color:#EF4444;"><span class="chip-dot" style="background:#EF4444;"></span>P1 Urgent</span>
          <span class="chip" style="background:#FFF0EB;color:#D6450F;"><span class="chip-dot" style="background:#FF6535;"></span>P2 High</span>
          <span class="chip" style="background:#EFF6FF;color:#3B82F6;"><span class="chip-dot" style="background:#3B82F6;"></span>P3 Medium</span>
          <span class="chip" style="background:#F9FAFB;color:#6B7280;"><span class="chip-dot" style="background:#9CA3AF;"></span>P4 Low</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title" style="font-size:var(--text-base);font-weight:var(--fw-bold);margin-bottom:var(--space-3);">Status</div>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
          <span class="chip" style="background:#F3F4F6;color:#6B6B6B;">Todo</span>
          <span class="chip" style="background:#FFF0EB;color:#D6450F;"><span class="chip-dot" style="background:#FF6535;"></span>In Progress</span>
          <span class="chip" style="background:#FEF2F2;color:#E11D48;">Blocked</span>
          <span class="chip" style="background:#FEF3C7;color:#D97706;">On Hold</span>
          <span class="chip" style="background:#D1FAE5;color:#059669;">✔ Done</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title" style="font-size:var(--text-base);font-weight:var(--fw-bold);margin-bottom:var(--space-3);">Badges</div>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center;">
          <span class="badge">Active</span>
          <span class="badge" style="background:#D1FAE5;color:#059669;">✔ Done</span>
          <span class="badge" style="background:#FEF2F2;color:#E11D48;">Blocked</span>
          <span style="background:var(--brand);color:white;border-radius:var(--radius-full);font-size:11px;font-weight:700;padding:3px 10px;letter-spacing:0.05em;text-transform:uppercase;">New</span>
        </div>
      </div>
    </div>
  </section>


  <!-- ── Form Controls ─────────────────────────────────────── -->
  <section class="section slide-up stagger-1">
    <div class="section-head">
      <div class="eyebrow">Form Controls</div>
    </div>
    <div class="demo-grid">
      <!-- Text inputs -->
      <div class="card">
        <div style="font-size:var(--text-base);font-weight:var(--fw-bold);margin-bottom:var(--space-4);">Text Inputs</div>
        <div class="stack" style="gap:var(--space-4);">
          <div class="field">
            <label class="field-label">Full Name</label>
            <input class="input" type="text" placeholder="Muhammed Ajmal">
          </div>
          <div class="field">
            <label class="field-label">Email</label>
            <input class="input" type="email" placeholder="hello@rise.os">
          </div>
          <div class="field">
            <label class="field-label">Message</label>
            <textarea class="input" rows="3" placeholder="Write something..." style="resize:vertical;"></textarea>
          </div>
        </div>
      </div>

      <!-- Dropdowns -->
      <div class="card">
        <div style="font-size:var(--text-base);font-weight:var(--fw-bold);margin-bottom:var(--space-4);">Dropdowns (Select)</div>
        <div class="stack" style="gap:var(--space-4);">
          <div class="field">
            <label class="field-label">Priority</label>
            <div class="select-wrap">
              <select class="select">
                <option value="">Select priority…</option>
                <option value="p1">P1 — Urgent</option>
                <option value="p2" selected>P2 — High</option>
                <option value="p3">P3 — Medium</option>
                <option value="p4">P4 — Low</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label class="field-label">Module</label>
            <div class="select-wrap">
              <select class="select">
                <option value="">Assign to module…</option>
                <option value="tasks">Tasks</option>
                <option value="finance">Finance</option>
                <option value="habits">Habits</option>
                <option value="journal">Journal</option>
                <option value="contacts">Contacts</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label class="field-label">Due Date</label>
            <div class="select-wrap">
              <select class="select">
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom…</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Option buttons (radio-style) -->
      <div class="card">
        <div style="font-size:var(--text-base);font-weight:var(--fw-bold);margin-bottom:var(--space-4);">Choice Selection</div>
        <div class="option-group" id="optionGroup">
          <button class="option-btn selected" onclick="selectOption(this)">
            <span class="option-dot"></span>
            <div>
              <div class="option-text">Diagnostic Report</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Full 5-dimension scan</div>
            </div>
          </button>
          <button class="option-btn" onclick="selectOption(this)">
            <span class="option-dot"></span>
            <div>
              <div class="option-text">Strategy Session</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">90-min deep dive call</div>
            </div>
          </button>
          <button class="option-btn" onclick="selectOption(this)">
            <span class="option-dot"></span>
            <div>
              <div class="option-text">SGA™ Full Program</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">12-week implementation</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </section>


  <!-- ── Checkboxes ────────────────────────────────────────── -->
  <section class="section slide-up stagger-2">
    <div class="section-head">
      <div class="eyebrow">Task List</div>
    </div>
    <div class="card">
      <div class="check-row" onclick="toggleCheck(this)">
        <div class="check-box checked"></div>
        <span class="check-label done">Diagnose business constraints</span>
        <span class="chip" style="margin-left:auto;background:#D1FAE5;color:#059669;font-size:10px;">✔ Done</span>
      </div>
      <div class="divider" style="margin:var(--space-1) 0;"></div>
      <div class="check-row" onclick="toggleCheck(this)">
        <div class="check-box checked"></div>
        <span class="check-label done">Design growth architecture</span>
        <span class="chip" style="margin-left:auto;background:#D1FAE5;color:#059669;font-size:10px;">✔ Done</span>
      </div>
      <div class="divider" style="margin:var(--space-1) 0;"></div>
      <div class="check-row" onclick="toggleCheck(this)">
        <div class="check-box"></div>
        <span class="check-label">Build system infrastructure</span>
        <span class="chip" style="margin-left:auto;background:#FFF0EB;color:#D6450F;font-size:10px;">In Progress</span>
      </div>
      <div class="divider" style="margin:var(--space-1) 0;"></div>
      <div class="check-row" onclick="toggleCheck(this)">
        <div class="check-box"></div>
        <span class="check-label">Optimize for scale</span>
        <span class="chip" style="margin-left:auto;background:#F3F4F6;color:#6B6B6B;font-size:10px;">Todo</span>
      </div>
      <div class="divider" style="margin:var(--space-1) 0;"></div>
      <div class="check-row" onclick="toggleCheck(this)">
        <div class="check-box"></div>
        <span class="check-label">Scale across GCC</span>
        <span class="chip" style="margin-left:auto;background:#FEF3C7;color:#D97706;font-size:10px;">On Hold</span>
      </div>
    </div>
  </section>


  <!-- ── Progress bars ─────────────────────────────────────── -->
  <section class="section slide-up stagger-1">
    <div class="section-head">
      <div class="eyebrow">Progress & Metrics</div>
    </div>
    <div class="card">
      <div class="stack" style="gap:var(--space-5);">
        <div>
          <div class="progress-wrap">
            <span class="progress-label">Strategic Clarity</span>
            <span class="progress-pct" style="color:var(--brand);">72%</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:72%;"></div></div>
        </div>
        <div>
          <div class="progress-wrap">
            <span class="progress-label">Financial Visibility</span>
            <span class="progress-pct" style="color:#059669;">88%</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:88%;background:linear-gradient(90deg,#10B981,#34D399,#10B981);background-size:300% 100%;"></div></div>
        </div>
        <div>
          <div class="progress-wrap">
            <span class="progress-label">Operations & Execution</span>
            <span class="progress-pct" style="color:#D97706;">45%</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:45%;background:linear-gradient(90deg,#F59E0B,#FCD34D,#F59E0B);background-size:300% 100%;"></div></div>
        </div>
        <div>
          <div class="progress-wrap">
            <span class="progress-label">People & Leadership</span>
            <span class="progress-pct" style="color:#3B82F6;">61%</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:61%;background:linear-gradient(90deg,#3B82F6,#60A5FA,#3B82F6);background-size:300% 100%;"></div></div>
        </div>
      </div>
    </div>
  </section>


  <!-- ── Kanban ─────────────────────────────────────────────── -->
  <section class="section slide-up stagger-2">
    <div class="section-head">
      <div class="eyebrow">Kanban Board</div>
    </div>
    <div class="demo-grid-3">
      <div class="kanban-col">
        <div class="kanban-header">Todo <span class="chip" style="background:var(--color-paper);color:var(--text-muted);font-size:10px;padding:1px 7px;">3</span></div>
        <div class="task-card">
          <div class="task-title">Review SGA framework docs</div>
          <div class="task-meta">
            <span class="chip" style="background:#F9FAFB;color:#9CA3AF;font-size:10px;padding:1px 7px;">P4</span>
            <span style="font-size:11px;color:var(--text-muted);">Jul 10</span>
          </div>
        </div>
        <div class="task-card">
          <div class="task-title">Set up client onboarding flow</div>
          <div class="task-meta">
            <span class="chip" style="background:#EFF6FF;color:#3B82F6;font-size:10px;padding:1px 7px;">P3</span>
            <span style="font-size:11px;color:var(--text-muted);">Jul 15</span>
          </div>
        </div>
      </div>
      <div class="kanban-col">
        <div class="kanban-header">In Progress <span class="chip" style="background:#FFF0EB;color:#D6450F;font-size:10px;padding:1px 7px;">2</span></div>
        <div class="task-card" style="border-color:var(--brand);">
          <div class="task-title">Diagnostic tool integration</div>
          <div class="task-meta">
            <span class="chip" style="background:#FFF0EB;color:#D6450F;font-size:10px;padding:1px 7px;">P2</span>
            <span style="font-size:11px;color:var(--color-danger);">Overdue</span>
          </div>
        </div>
        <div class="task-card">
          <div class="task-title">GCC market research</div>
          <div class="task-meta">
            <span class="chip" style="background:#FEF2F2;color:#EF4444;font-size:10px;padding:1px 7px;">P1</span>
            <span style="font-size:11px;color:var(--text-muted);">Jul 5</span>
          </div>
        </div>
      </div>
      <div class="kanban-col">
        <div class="kanban-header">Done <span class="chip" style="background:#D1FAE5;color:#059669;font-size:10px;padding:1px 7px;">4</span></div>
        <div class="task-card" style="opacity:0.7;">
          <div class="task-title task-title-complete">Brand audit complete</div>
          <div class="task-meta">
            <span class="chip" style="background:#D1FAE5;color:#059669;font-size:10px;padding:1px 7px;">✔</span>
          </div>
        </div>
        <div class="task-card" style="opacity:0.7;">
          <div class="task-title task-title-complete">Design system tokens</div>
          <div class="task-meta">
            <span class="chip" style="background:#D1FAE5;color:#059669;font-size:10px;padding:1px 7px;">✔</span>
          </div>
        </div>
      </div>
    </div>
  </section>


  <!-- ── Tooltips ──────────────────────────────────────────── -->
  <section class="section slide-up stagger-1">
    <div class="section-head">
      <div class="eyebrow">Tooltips</div>
    </div>
    <div class="card" style="display:flex;gap:var(--space-6);flex-wrap:wrap;align-items:center;">
      <div class="tooltip-wrap">
        <button class="btn btn--primary">Hover me</button>
        <div class="tooltip" style="left:50%;transform:translateX(-50%) translateY(4px);">Primary CTA tooltip</div>
      </div>
      <div class="tooltip-wrap">
        <button class="btn btn--secondary">Settings</button>
        <div class="tooltip" style="left:50%;transform:translateX(-50%) translateY(4px);">Open settings panel</div>
      </div>
      <div class="tooltip-wrap">
        <div class="icon-btn" title=""><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></div>
        <div class="tooltip" style="left:50%;transform:translateX(-50%) translateY(4px);">Configure</div>
      </div>
      <div class="tooltip-wrap">
        <span class="chip" style="background:#FFF0EB;color:#D6450F;cursor:default;">P2 High</span>
        <div class="tooltip" style="left:50%;transform:translateX(-50%) translateY(4px);">Priority 2 — high impact</div>
      </div>
    </div>
  </section>


  <!-- ── Feature cards (hover) ─────────────────────────────── -->
  <section class="section slide-up stagger-2">
    <div class="section-head">
      <div class="eyebrow">Feature Cards (hover for animation)</div>
    </div>
    <div class="demo-grid">
      <div class="card">
        <div class="icon-wrap"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></div>
        <div style="font-size:var(--text-base);font-weight:var(--fw-bold);margin-bottom:var(--space-2);">Smart Defaults</div>
        <p style="font-size:var(--text-sm);color:var(--text-body);line-height:var(--leading-relaxed);">Orange top-bar wipes in from the left on hover. Border turns orange. Shadow lifts.</p>
      </div>
      <div class="card">
        <div class="icon-wrap"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg></div>
        <div style="font-size:var(--text-base);font-weight:var(--fw-bold);margin-bottom:var(--space-2);">Engineered Growth</div>
        <p style="font-size:var(--text-sm);color:var(--text-body);line-height:var(--leading-relaxed);">Every interaction is intentional. 150ms transitions, ease-out easing, 1px border shifts.</p>
      </div>
      <div class="card">
        <div class="icon-wrap"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg></div>
        <div style="font-size:var(--text-base);font-weight:var(--fw-bold);margin-bottom:var(--space-2);">Graph-paper Texture</div>
        <p style="font-size:var(--text-sm);color:var(--text-body);line-height:var(--leading-relaxed);">Blueprint aesthetic on every surface. Navy grid on light, orange grid on dark.</p>
      </div>
    </div>
  </section>


  <!-- ── Dark CTA strip ────────────────────────────────────── -->
  <section class="section slide-up stagger-1">
    <div class="dark-strip">
      <div class="eyebrow" style="margin-bottom:var(--space-4);">The System</div>
      <h2 style="font-size:var(--text-3xl);font-weight:var(--fw-extrabold);letter-spacing:var(--tracking-tight);color:var(--text-on-dark);margin-bottom:var(--space-3);">
        Engineered, not designed.
      </h2>
      <p style="font-size:var(--text-base);color:var(--text-on-dark-soft);margin-bottom:var(--space-6);max-width:480px;margin-inline:auto;">
        One font. One brand color. One grid. Consistency is the product.
      </p>
      <div style="display:flex;gap:var(--space-3);justify-content:center;flex-wrap:wrap;">
        <button class="btn btn--primary" onclick="openModal()">Start Building →</button>
        <button class="btn" style="background:transparent;border:1px solid rgba(255,101,53,0.3);color:white;min-height:44px;padding-inline:var(--space-5);border-radius:var(--radius-sm);font-size:var(--text-sm);font-weight:var(--fw-bold);cursor:pointer;" onclick="showToast()">Show Toast</button>
      </div>
    </div>
  </section>


  <!-- ── Modal ─────────────────────────────────────────────── -->
  <div class="modal-backdrop" id="modalBackdrop" onclick="handleBackdropClick(event)">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-header">
        <div>
          <div class="eyebrow" style="margin-bottom:var(--space-1);">Popup Card</div>
          <h2 id="modalTitle" style="font-size:var(--text-xl);font-weight:var(--fw-bold);color:var(--text-strong);">Create New Task</h2>
        </div>
        <button class="icon-btn" onclick="closeModal()" aria-label="Close"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body">
        <div class="stack" style="gap:var(--space-4);">
          <div class="field">
            <label class="field-label" for="m-title">Task Title</label>
            <input class="input" id="m-title" type="text" placeholder="e.g. Diagnose business constraints">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
            <div class="field">
              <label class="field-label">Priority</label>
              <div class="select-wrap">
                <select class="select">
                  <option value="p2" selected>P2 — High</option>
                  <option value="p1">P1 — Urgent</option>
                  <option value="p3">P3 — Medium</option>
                  <option value="p4">P4 — Low</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label class="field-label">Module</label>
              <div class="select-wrap">
                <select class="select">
                  <option value="tasks" selected>Tasks</option>
                  <option value="finance">Finance</option>
                  <option value="habits">Habits</option>
                </select>
              </div>
            </div>
          </div>
          <div class="field">
            <label class="field-label">Notes</label>
            <textarea class="input" rows="2" placeholder="Optional notes…"></textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn--secondary" style="min-height:40px;padding-inline:var(--space-4);" onclick="closeModal()">Cancel</button>
        <button class="btn btn--primary" style="min-height:40px;padding-inline:var(--space-4);" onclick="closeModal();showToast()">Create Task →</button>
      </div>
    </div>
  </div>


  <!-- ── Toast area ─────────────────────────────────────────── -->
  <div class="toast-area" id="toastArea"></div>


  <script>
    // Modal
    function openModal() {
      document.getElementById('modalBackdrop').classList.add('open');
    }
    function closeModal() {
      document.getElementById('modalBackdrop').classList.remove('open');
    }
    function handleBackdropClick(e) {
      if (e.target === e.currentTarget) closeModal();
    }

    // Toast
    let toastCount = 0;
    const messages = [
      { text: 'Task created successfully.', icon: '✔', bg: '#10B981' },
      { text: 'Saved to RISE OS.',           icon: '⚡', bg: '#FF6535' },
      { text: 'Diagnostic complete →',        icon: '📐', bg: '#1A1A2E' },
    ];
    function showToast() {
      const msg = messages[toastCount % messages.length];
      toastCount++;
      const area = document.getElementById('toastArea');
      const t = document.createElement('div');
      t.className = 'toast';
      t.innerHTML = `
        <span class="toast-icon" style="background:${msg.bg}20;color:${msg.bg};">${msg.icon}</span>
        <span>${msg.text}</span>
      `;
      area.appendChild(t);
      requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
      setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 400);
      }, 3000);
    }

    // Checkbox toggle
    function toggleCheck(row) {
      const box = row.querySelector('.check-box');
      const label = row.querySelector('.check-label');
      box.classList.toggle('checked');
      label.classList.toggle('done');
    }

    // Option button group
    function selectOption(btn) {
      document.querySelectorAll('#optionGroup .option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    }
  </script>

</body>
</html>

```

---

## references/accessibility.md

# RISE OS — Accessibility Standards

## Core Requirements
- **Semantic HTML**: Use appropriate tags (`<main>`, `<nav>`, `<section>`, `<article>`) instead of generic `<div>` wrappers for screen reader compatibility.
- **Interactive Elements**: Every interactive element must be keyboard-accessible. Never remove the focus ring (`outline`) without providing a visible replacement using `--border-focus` (`#FF6535`).
- **ARIA Labels**: All icon-only buttons or interactive elements without visible text must have descriptive `aria-label` attributes.
- **Color Contrast**: Minimum 4.5:1 for body text, 3.0:1 for large text/UI elements. Note: `--brand-text` (`#D6450F`) is the correct token for orange text on white — not `--brand` (`#FF6535`), which fails AA at small sizes.
- **Form Labels**: Every input must have a programmatically associated `<label>` or `aria-labelledby`.

## Focus Ring — Mandatory
```css
*:focus-visible {
  outline: 2px solid var(--border-focus); /* #FF6535 */
  outline-offset: 2px;
}
```
Never override this to `outline: none` without adding a replacement.

## Implementation Checklist
- [ ] Use `lucide-react` icons with `aria-hidden="true"` when decorative.
- [ ] Tab order follows the logical visual flow.
- [ ] All images have an `alt` attribute; decorative images use `alt=""`.
- [ ] Status messages (e.g. "Task Saved") announced via `aria-live` regions.
- [ ] All icon-only buttons use `.tap-target` (44×44px minimum).
- [ ] Use `--brand-text` (`#D6450F`) for orange text on white, never raw `--brand`.
- [ ] `prefers-reduced-motion` respected — tokens.css handles this globally.


---

## references/aesthetics.md

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


---

## references/components.md

# RISE OS — Component Architecture

## Standards
- **Strict Typing**: All props must have an explicit TypeScript `interface`. `any` is forbidden.
- **Named Exports**: Use `export const Component = …` over default exports for IDE safety.
- **Class Merging**: Always use `cn()` from `lib/cn.ts` for conditional Tailwind classes.
- **Dynamic Colors**: Data-driven hex values use the **Hex Alpha Trick** with inline style — never arbitrary Tailwind:
  ```tsx
  style={{ backgroundColor: color + '20', borderColor: color + '40' }}
  ```
- **Font**: Every component inherits `var(--font-sans)` (Inter) from `body`. Never set a different font-family on any component.

## File Structure Pattern
1. Imports — external libs → internal hooks/utils → types
2. TypeScript interface definition
3. Component definition using `cn()`
4. Sub-components or helper functions (if small)
5. Named export

## Token Usage Pattern
```tsx
// Correct — semantic token
<div style={{ color: 'var(--brand-text)', background: 'var(--brand-tint)' }}>

// Wrong — hardcoded hex
<div style={{ color: '#D6450F', background: '#FFF0EB' }}>
```

## Priority Color Pattern
```tsx
import { PRIORITY_CONFIG } from '@/lib/constants';

// Correct
const { color, bgColor } = PRIORITY_CONFIG[task.priority];
<span style={{ color, backgroundColor: bgColor }}>

// Wrong — switch/case on priority string
```

## Button Usage
| Variant         | Context                              | Token used           |
|-----------------|--------------------------------------|----------------------|
| `btn--primary`  | Main CTA, destructive confirm        | `--brand` fill       |
| `btn--secondary`| Secondary actions on light sections  | `--border-subtle`    |
| `btn--ghost`    | Actions on dark/navy sections        | `--border-on-dark`   |

Every button and icon-only control must meet the `.tap-target` requirement (44×44px).


---

## references/mobile.md

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


---

## references/performance.md

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

