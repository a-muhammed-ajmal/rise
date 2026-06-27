# RISE — Frontend Design Skill

## Identity & Soul

RISE is a **dark-first personal AI OS** — a singular product that replaces 7+ apps without feeling like any of them. The aesthetic draws from Linear's precision, Superhuman's premium dark UI, and the Glume diabetes app design language visible in your mockups: deep graphite surfaces, neon accent spots, compact data cards, and a glassmorphic bottom nav. It must feel more like a cockpit than a dashboard. Calm, dense, intelligent.

---

## Color System

**Primary Surfaces — 4-Level Elevation (mandatory, never use one shade of dark)**

```css
:root {
  /* Surfaces */
  --surface-base: #0E0E11;       /* True base: OLED-black-adjacent, not pure black */
  --surface-1: #17171C;          /* Cards, panels — primary elevated */
  --surface-2: #1F1F27;          /* Nested cards, hover states */
  --surface-overlay: #2A2A35;    /* Modals, sheets, tooltips */

  /* Brand accent — primary AI intelligence cue */
  --accent-primary: #7C5CFC;     /* Purple: "AI is active" — used sparingly, max 10% */
  --accent-glow: rgba(124, 92, 252, 0.15); /* For glow/radial ambient behind accent */

  /* Semantic data colors — match the Glume health data language */
  --color-success: #34D399;      /* Green — positive metrics, habits complete */
  --color-warning: #FBBF24;      /* Amber — caution, budgets near limit */
  --color-danger: #F87171;       /* Red — overdue, over budget */
  --color-info: #60A5FA;         /* Blue — neutral data, AI suggestions */

  /* Text hierarchy */
  --text-primary: #E8E8F0;       /* Main content — NOT pure white (avoids halation) */
  --text-secondary: #8E8EA0;     /* Labels, metadata */
  --text-muted: #52525E;         /* Placeholder, disabled */

  /* Borders — luminance-based depth (shadows don't work on dark) */
  --border-subtle: rgba(255,255,255,0.06);
  --border-active: rgba(124, 92, 252, 0.4);
}
```

**Rules:**
- Never use `#000000` or `#FFFFFF` directly — they cause halation on OLED, especially for the ~50% of users with astigmatism.
- Purple (`--accent-primary`) is the "AI is thinking / active" color. Reserve it for AI responses, active states, and the FAB/compose button. Don't bleed it everywhere.
- Use `--color-success` (green) for completed habits, positive balances, and streaks — exactly how Glume uses it for glucose in range.
- Depth is created with luminance layering, not shadows. `--surface-1` sits visually above `--surface-base` through brightness, not drop shadows.

---

## Typography

**Font Stack — dual personality: editorial intelligence + precision data**

```css
/* Headings: personality, editorial weight */
font-family: 'Cabinet Grotesk', 'Plus Jakarta Sans', system-ui;

/* Body + UI: precision, legibility at small sizes */
font-family: 'Inter', 'SF Pro Text', system-ui;

/* Data + metrics: monospaced for number alignment */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

**Why these choices:**
- **Cabinet Grotesk / Plus Jakarta Sans**: Available free on Google Fonts. Has personality without being loud — headlines feel "designed", not "defaulted to Inter". Heavier weights give premium feel.
- **Inter**: Best legibility at 12–14px on mobile screens, which is where your data labels live.
- **JetBrains Mono**: For all numeric values (blood sugar, bank balance, habit streak counts, calorie totals). Mono-spaced numbers don't shift width between "1" and "8" — critical for scannable dashboards.

**Type Scale (mobile-optimized with `clamp()`):**

```css
--text-display: clamp(1.75rem, 5vw, 2.5rem);  /* Dashboard greeting "Hi, Emily!" */
--text-h1: clamp(1.25rem, 4vw, 1.75rem);       /* Section headers */
--text-h2: 1.0625rem;                            /* Card titles */
--text-body: 0.9375rem;                          /* Primary content, 15px */
--text-label: 0.8125rem;                         /* Metadata labels, 13px */
--text-micro: 0.6875rem;                         /* Chart axes, timestamps, 11px */
--text-metric: clamp(1.5rem, 4vw, 2.25rem);     /* Big data numbers, mono */
```

**Line height + spacing:**
- Body: `line-height: 1.5`
- Headings: `line-height: 1.2`, `letter-spacing: -0.02em` (tight, modern)
- Metric numbers: `letter-spacing: -0.03em`, `font-variant-numeric: tabular-nums`

---

## Spacing System — 8pt Grid

Consistent spacing systems using an 8pt grid are non-negotiable in 2026 mobile design. Every value must be a multiple of 4px.

```css
--space-1: 4px;    /* Icon internal padding */
--space-2: 8px;    /* Tight component gaps */
--space-3: 12px;   /* Within-card padding */
--space-4: 16px;   /* Standard card padding */
--space-5: 20px;   /* Section spacing */
--space-6: 24px;   /* Card-to-card gap */
--space-8: 32px;   /* Section-to-section */
--space-10: 40px;  /* Large separations */
--space-12: 48px;  /* Bottom nav safe zone */
```

---

## Layout & Mobile Architecture

**Thumb Zone Law — the most important structural rule**

75% of phone interactions use a single thumb, and the top 40% of a modern phone screen is a dead zone for comfortable reach.

```
┌─────────────────────┐
│  ░░░ DEAD ZONE ░░░  │  ← Headers, page title only
│  ─────────────────  │
│                     │
│  ████ CONTENT ████  │  ← Cards, data, reading
│  ████ ZONE    ████  │
│  ─────────────────  │
│  ████ ACTION  ████  │  ← Buttons, FAB, inputs
│  ████ ZONE    ████  │
│  ═════════════════  │
│  ▓▓▓ BOTTOM NAV ▓▓▓│  ← 5 tabs, always visible
└─────────────────────┘
```

- **All primary CTAs** live in the bottom 60% of the screen.
- **Search, compose, AI chat** → integrated into the bottom bar or a persistent input at bottom.
- **Page titles and greeting text** → top area only. Never put tappable navigation at the top.
- The bottom sheet pattern is the dominant container for secondary content — settings, filters, confirmations, previews. Use it for everything that doesn't deserve full-screen.

**Bottom Navigation — 5 Modules:**

```
Home | Today | + (AI Compose) | Insights | Profile
```

- The `+` center button is the AI compose FAB (purple, glowing) — identical to the Glume app's center `+` pattern you already have.
- Bottom navigation places 3–5 core destinations within natural thumb reach. Tab bars exceeding 5 items should introduce a 'More' overflow menu. RISE has exactly 5. Never exceed this.

**Bottom Nav Component:**
```css
.bottom-nav {
  position: fixed;
  bottom: 0;
  background: rgba(23, 23, 28, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid var(--border-subtle);
  padding-bottom: env(safe-area-inset-bottom); /* iPhone home indicator */
  height: 56px + safe-area-inset-bottom;
}

.nav-item {
  min-width: 44px;
  min-height: 44px; /* WCAG 2.2 touch target minimum */
}
```

---

## Component System

**Cards — the primary container unit**

Looking at your Glume mockups, cards are the building block of every screen. RISE extends this pattern:

```css
.card {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;            /* Soft, friendly — not sharp, not pill */
  padding: var(--space-4);        /* 16px */
}

.card--metric {
  /* Big number cards: glucose, balance, habit streak */
  display: grid;
  grid-template: "label unit" auto
                 "value value" auto / 1fr auto;
}

.card--active {
  border-color: var(--border-active);
  box-shadow: 0 0 0 1px var(--border-active), 
              0 4px 24px var(--accent-glow);
}

.card:hover, .card:focus-within {
  background: var(--surface-2);
  transform: translateY(-1px);
  transition: all 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

**Module Color Coding (critical for RISE's "replaces 7 apps" identity):**

Each module gets a unique semantic accent to build spatial memory:
```css
--module-tasks: #34D399;      /* Green — Todoist replacement */
--module-finance: #60A5FA;    /* Blue — Finance app */
--module-habits: #FBBF24;     /* Amber — Habit tracker */
--module-journal: #F472B6;    /* Pink — Journal */
--module-contacts: #A78BFA;   /* Lavender — CRM */
--module-notes: #94A3B8;      /* Silver — Knowledge base */
--module-ai: #7C5CFC;         /* Purple — AI assistant (master accent) */
```

These appear as a 4px top border on cards, colored left-border on list items, and filled icon backgrounds in the bottom nav — not splashed across the whole UI.

---

## Data Visualization Style

Looking at your Glume Insights screens, charts are first-class content, not decorations. Apply:

```css
/* Chart lines */
--chart-line-before: #60A5FA;   /* Before meal / past data */
--chart-line-after: #34D399;    /* After meal / goal line */
--chart-grid: rgba(255,255,255,0.04);  /* Near-invisible grid */
--chart-dot-active: #FFFFFF;    /* Active/highlighted point */

/* Chart sizing on mobile */
.chart-container {
  height: 140px;          /* Compact — match Glume's proportions */
  overflow: hidden;
  border-radius: 0 0 16px 16px;
}
```

Progress rings (like the Glume "36% eaten" circle):
```css
.progress-ring circle {
  stroke-linecap: round;
  filter: drop-shadow(0 0 4px var(--color-success));  /* Glow on the arc */
}
```

---

## Motion System

Spring-based animations (not linear) give apps a natural feel in 2026.

**Easing tokens:**
```css
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);   /* Elements appearing, confirmations */
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);         /* State changes, nav transitions */
--ease-exit: cubic-bezier(0.4, 0, 1, 1);             /* Elements leaving */
```

**Duration tokens:**
```css
--dur-instant: 80ms;    /* Tap feedback */
--dur-fast: 150ms;      /* Hover, icon state */
--dur-normal: 250ms;    /* Card transitions, nav switch */
--dur-slow: 400ms;      /* Sheet open, modal enter */
--dur-enter: 350ms;     /* Screen transitions */
```

**Stagger animations — for dashboard cards loading:**
```css
.card:nth-child(1) { animation-delay: 0ms; }
.card:nth-child(2) { animation-delay: 60ms; }
.card:nth-child(3) { animation-delay: 120ms; }
.card:nth-child(4) { animation-delay: 180ms; }

@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Mandatory: respect `prefers-reduced-motion`**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Glassmorphism — Correct Usage

Glassmorphism is valid for overlays on capable devices, but only for structural chrome, never for content cards.

```css
/* Bottom nav, modals, sticky headers */
.glass-chrome {
  background: rgba(14, 14, 17, 0.75);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

/* AI response bubbles / floating AI panel */
.glass-ai {
  background: rgba(124, 92, 252, 0.08);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(124, 92, 252, 0.2);
  border-radius: 20px;
}
```

**Never:** glass on data cards (illegible over chart backgrounds), glass on text-heavy content, glass stacked on glass.

---

## Daily Meal Tracker Module (from your mockups)

Looking at the Glume daily meals screen, here's the RISE interpretation:

- Day strip scrolling calendar at top (same pattern) → keep it but style with `--accent-primary` pill on active day, muted circles on others.
- Calorie/macro number = `--text-metric` size + `--module-tasks` color for "on track" state.
- Meal sections (Breakfast, Snack) → collapsible cards using the bottom sheet pattern on expand.
- "Add meal" CTA → fixed above bottom nav, full-width, `--accent-primary` fill, white text.

---

## AI Compose Layer

The center `+` button in the bottom nav opens RISE's "Command Layer" — the universal input that routes to any module:

```
State: idle    → purple glowing circle
State: pressed → spring-expands to full bottom sheet with pulsing gradient
State: AI typing → shimmer animation across the input field
State: done    → spring-collapses back with a ✓ micro-tick
```

The gradient for the AI thinking state:
```css
@keyframes aiPulse {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.ai-input-active {
  background: linear-gradient(135deg, #7C5CFC, #60A5FA, #34D399, #7C5CFC);
  background-size: 300% 300%;
  animation: aiPulse 3s ease infinite;
}
```

---

## Accessibility — Non-Negotiable

WCAG 2.2 Level AA is the current baseline, covering touch targets (24×24px minimum), color contrast (4.5:1), and screen reader compatibility. The EU Accessibility Act has been enforced since June 2025.

- All touch targets: **minimum 44×44px** (Apple HIG standard, stricter than WCAG's 24px)
- Text contrast: `--text-primary` on `--surface-1` = **#E8E8F0 on #17171C = 9.8:1** ✓
- `--text-secondary` on `--surface-1` = **#8E8EA0 on #17171C = 4.6:1** ✓ (just passes AA)
- All interactive states: visible focus ring using `--border-active` color
- Never rely on color alone to convey state — pair color with icon or label

---

## Anti-Patterns — What RISE Must Never Do

These are the "AI slop" signals that will make RISE look like every other generated app:

- ❌ **Pure black `#000000` backgrounds** — use `#0E0E11` instead
- ❌ **Single-surface dark mode** — every elevation needs a distinct surface token
- ❌ **Generic purple gradient everywhere** — purple is ONLY for the AI layer
- ❌ **Linear animations** — always use spring or ease curves
- ❌ **Top-anchored primary navigation** — everything primary belongs bottom 60%
- ❌ **Thin (weight 300) fonts on dark backgrounds** — halation kills legibility; use 400+ for body, 500+ for labels
- ❌ **Module color bleeding** — green (tasks), blue (finance), etc. are accents, not backgrounds
- ❌ **More than 5 bottom nav items** — use "More" if needed
- ❌ **Static metric cards** — every data card should have a micro-trend sparkline or change indicator
- ❌ **Drop shadows for depth** — depth on dark surfaces = luminance shifts and subtle borders, not shadows

---

## Success Check

Before shipping any screen, run this:

1. **Surfaces**: Can you identify 3+ distinct elevation levels by eye?
2. **Typography**: Are numbers in mono? Are headings in Cabinet Grotesk? Is body in Inter?
3. **Module identity**: Does the card's accent color tell you what module you're in without reading text?
4. **Thumb reach**: Is every tap target in the bottom 60% of the screen or within a bottom sheet?
5. **AI layer**: Is purple used for AI actions only and nothing else?
6. **Motion**: Does every state change have a spring animation? Does it respect `prefers-reduced-motion`?
7. **Contrast**: Does `--text-secondary` pass 4.5:1 on its background?
8. **Bottom nav**: Exactly 5 items. Glassmorphic. Purple glowing center FAB.

---
