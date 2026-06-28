# RISE — Frontend Design Skill

## Identity & Soul

RISE is a **dark-first personal AI OS** — a singular product that replaces 7+ apps without feeling like any of them. The aesthetic draws from Linear's precision, Superhuman's premium dark UI, and the Glume diabetes app design language: deep graphite surfaces, neon accent spots, compact data cards, and a glassmorphic bottom nav. It must feel more like a cockpit than a dashboard. Calm, dense, intelligent.

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

**Font Stack — dual personality: editorial intelligence + precision data, capped weights throughout**

```css
/* Headings: personality, editorial weight — capped, never heavy */
font-family: 'Lexend', system-ui, sans-serif;
/* Default weight: 500 (Medium) — every heading, every screen, no exceptions
   by default. 600 (SemiBold) is allowed only when a heading genuinely needs
   to out-rank a sibling on the same screen (rare — maybe one hero number a
   session). 700+ (Bold) is banned outright. Never use it, anywhere. */

/* Body + UI: precision, legibility at small sizes, Arabic-ready */
font-family: 'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui;

/* Data + metrics: monospaced for number alignment */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

**Why these choices:**
- **Lexend (Medium default, SemiBold exception, no Bold)**: Lexend was designed by reading researchers specifically to improve reading speed and proficiency — the right personality for a cockpit you read constantly rather than a landing page you glance at once. Capping the weight keeps headlines feeling "designed" without the loud, marketing-page shout that Bold introduces, which would fight the "purple is the only loud thing on screen" rule.
- **IBM Plex Sans**: same precision-at-12–14px profile Inter had, but reads more engineered and tool-like (angled terminals, double-storey g) and less like a generic SaaS default. It also ships with native Arabic support (IBM Plex Sans Arabic) if RISE ever needs bilingual UI.
- **JetBrains Mono**: unchanged. Numeric values (bank balance, habit streak counts, calorie totals) never shift width between characters — critical for scannable dashboards.
- Load both Lexend and IBM Plex Sans as **variable fonts** (`font-variation-settings` / variable `wght` axis) rather than static weight files — smaller payload, smoother weight transitions, and you only need two declared weights (500, 600) per family. Always set `font-display: swap` so text renders in a system font during load instead of staying invisible.

**Type Scale — medium-small, mobile-first (revised down from the original pass, which ran large):**

```css
--text-display: clamp(1.375rem, 4.2vw, 1.625rem);  /* 22–26px — greeting ONLY, e.g. "Hi, Ajmal" */
--text-h1: clamp(1rem, 3.2vw, 1.125rem);            /* 16–18px — section headers */
--text-h2: 0.9375rem;                                /* 15px — card titles */
--text-body: 0.875rem;                               /* 14px — primary content */
--text-label: 0.75rem;                               /* 12px — metadata labels */
--text-micro: 0.6875rem;                             /* 11px — chart axes, timestamps. Accessibility floor: never go below this. */
--text-metric: clamp(1.25rem, 3.8vw, 1.625rem);      /* 20–26px — mono metric numbers */
```

**Heading weight tokens:**

```css
--weight-heading-default: 500;   /* Lexend Medium — use everywhere */
--weight-heading-emphasis: 600;  /* Lexend SemiBold — exception only, see above */
/* There is no 700 token. Don't add one. */
```

**Line height + spacing:**
- Body: `line-height: 1.5`
- Card labels / metadata: `line-height: 1.3` (tighter — these are short, dense strings, not reading copy)
- Headings: `line-height: 1.2`, `letter-spacing: -0.02em`
- Metric numbers: `letter-spacing: -0.03em`, `font-variant-numeric: tabular-nums`

**Truncation & overflow rules — mandatory on every text node inside a fixed-width card:**

```css
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

/* Apply to any grid/flex container holding cards — prevents children from
   forcing the row wider than the viewport, which is the #1 cause of
   horizontal scroll/overflow on narrow phones. */
.grid-safe {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
```

- Card titles (`--text-h2`) and labels (`--text-label`) get `.text-truncate` by default — a single line, ellipsis if it doesn't fit. Never let a label wrap and push a card taller than its siblings in the same row.
- Card body copy (e.g. an AI suggestion line) gets `.text-clamp-2` — two lines max, ellipsis after. If the full text matters, the tap target opens the bottom sheet with the full string.
- Any grid of cards uses `minmax(0, 1fr)` columns, never bare `1fr` — bare `1fr` has `min-width: auto` and will let a long unbroken string (a long category name, an email address) push the column past the card width.

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

- The `+` center button is the AI compose FAB (purple, glowing) — identical to the Glume app's center `+` pattern.
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
  height: calc(56px + env(safe-area-inset-bottom));
}

.nav-item {
  min-width: 44px;
  min-height: 44px; /* WCAG 2.2 touch target minimum — never shrink this for a smaller type scale */
}
```

---

## Component System

**Cards — the primary container unit**

```css
.card {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;            /* Soft, friendly — not sharp, not pill */
  padding: var(--space-4);        /* 16px */
  overflow: hidden;                /* contains any child overflow, never lets content bleed past the card edge */
}

.card__label {
  font-family: 'IBM Plex Sans', system-ui;
  font-size: var(--text-label);   /* 12px */
  color: var(--text-secondary);
  line-height: 1.3;
}

.card__title {
  font-family: 'Lexend', system-ui;
  font-weight: var(--weight-heading-default); /* 500 */
  font-size: var(--text-h2);      /* 15px */
  color: var(--text-primary);
}

.card__value {
  font-family: 'JetBrains Mono', monospace;
  font-size: var(--text-metric);  /* clamp 20–26px */
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
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

/* Touch feedback replaces hover on mobile — see Motion System */
.card:active {
  background: var(--surface-2);
  transform: scale(0.98);
  transition: transform var(--dur-instant) var(--ease-smooth);
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

Charts are first-class content, not decorations. Apply:

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

.progress-ring text {
  font-family: 'JetBrains Mono', monospace;
  font-size: var(--text-label);
  fill: var(--text-primary);
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
--dur-fast: 150ms;      /* Icon state, nav indicator */
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

**Micro-interactions — touch feedback & loading states (new — mobile has no hover, so every tappable element needs an explicit active state):**

```css
/* Universal tap feedback — apply to every button, card, nav item, list row */
.tappable {
  transition: transform var(--dur-instant) var(--ease-smooth);
}
.tappable:active {
  transform: scale(0.96);
}

/* Skeleton loading state — for cards waiting on data (Todoist sync,
   bank balance refresh, etc.) instead of a blank or jumping layout */
.skeleton {
  background: linear-gradient(90deg, var(--surface-1) 25%, var(--surface-2) 50%, var(--surface-1) 75%);
  background-size: 200% 100%;
  animation: skeletonPulse 1.4s ease-in-out infinite;
  border-radius: 8px;
}
@keyframes skeletonPulse {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Count-up on metric values when fresh data lands — short, snappy, never
   exceeds 600ms so it never feels like the app is "thinking" too hard */
/* JS: animate from 0 (or previous value) to target over 400–600ms using
   --ease-smooth; round every intermediate frame through the same
   formatting rule the final value uses (no flashing decimals). */

/* Bottom nav active indicator — a small dot or pill sliding to the
   active tab, not a jump-cut */
.nav-indicator {
  transition: transform var(--dur-fast) var(--ease-smooth);
}
```

- Every `:hover` rule in this system must have a matching `:active` rule — on a touch device, hover either never fires or sticks after the tap. Don't rely on hover alone to confirm a tap landed.
- Skeletons replace empty/blank states during network waits longer than ~200ms. Anything faster than that, skip the skeleton — it'll just flash.
- Count-up animations are for metric cards only, not for every number on screen. A list of 12 task rows updating their counts on every render would be noisy, not delightful.

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

- Day strip scrolling calendar at top → keep the Glume pattern, style with `--accent-primary` pill on active day, muted circles on others.
- Calorie/macro number = `--text-metric` size + `--module-tasks` color for "on track" state.
- Meal sections (Breakfast, Snack) → collapsible cards using the bottom sheet pattern on expand.
- "Add meal" CTA → fixed above bottom nav, full-width, `--accent-primary` fill, white text, `.tappable` active state.

---

## AI Compose Layer

The center `+` button in the bottom nav opens RISE's "Command Layer" — the universal input that routes to any module:

```
State: idle    → purple glowing circle, .tappable active-scale on press
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

- All touch targets: **minimum 44×44px** (Apple HIG standard, stricter than WCAG's 24px) — this does not shrink even as the type scale gets smaller.
- Never set body or label text below `--text-micro` (11px) — that's the legibility floor at typical phone viewing distance.
- Text contrast: `--text-primary` on `--surface-1` = **#E8E8F0 on #17171C = 9.8:1** ✓
- `--text-secondary` on `--surface-1` = **#8E8EA0 on #17171C = 4.6:1** ✓ (just passes AA)
- Every `:hover` state has a matching `:active`/touch equivalent — see Motion System.
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
- ❌ **Lexend Bold (700+) anywhere** — ceiling is SemiBold (600), default is Medium (500). Bold breaks the calm-cockpit tone and pushes RISE toward generic SaaS marketing.
- ❌ **`--text-display` outside the top-of-screen greeting** — don't apply it to card titles, section headers, or anywhere inside the content zone. That's exactly how a screen ends up feeling oversized. Section headers stay at `--text-h1` or smaller.
- ❌ **Hover-only interaction states** — touch devices don't reliably fire `:hover`; every tappable element needs `.tappable` or an explicit `:active` rule.
- ❌ **Unhandled text overflow** — any label or title in a fixed-width card needs `.text-truncate` or `.text-clamp-2`. A card that grows taller than its row siblings because a label wrapped is a bug, not a layout quirk.
- ❌ **Module color bleeding** — green (tasks), blue (finance), etc. are accents, not backgrounds
- ❌ **More than 5 bottom nav items** — use "More" if needed
- ❌ **Static metric cards** — every data card should have a micro-trend sparkline or change indicator
- ❌ **Drop shadows for depth** — depth on dark surfaces = luminance shifts and subtle borders, not shadows

---

## Success Check

Before shipping any screen, run this:

1. **Surfaces**: Can you identify 3+ distinct elevation levels by eye?
2. **Typography**: Are numbers in mono? Are headings in Lexend, capped at Medium (SemiBold only as a deliberate exception, never Bold)? Is body in IBM Plex Sans? Is `--text-display` used only for the top greeting, nowhere else?
3. **Module identity**: Does the card's accent color tell you what module you're in without reading text?
4. **Thumb reach**: Is every tap target in the bottom 60% of the screen or within a bottom sheet?
5. **AI layer**: Is purple used for AI actions only and nothing else?
6. **Motion**: Does every state change have a spring animation? Does every tappable element have an `:active` state, not just `:hover`? Does it respect `prefers-reduced-motion`?
7. **Contrast**: Does `--text-secondary` pass 4.5:1 on its background?
8. **Overflow**: At 340px width, does any label, title, or value wrap, clip, or push a card taller than its row siblings? If yes, apply `.text-truncate` or `.text-clamp-2`.
9. **Bottom nav**: Exactly 5 items. Glassmorphic. Purple glowing center FAB. Active tab has a sliding indicator, not a jump-cut.

---