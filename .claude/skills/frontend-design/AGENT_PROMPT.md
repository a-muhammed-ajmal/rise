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
