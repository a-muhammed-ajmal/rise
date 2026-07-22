---

# RISE OS — Agent Implementation Prompt

Copy this prompt verbatim into any AI agent (Claude, GPT-4, Cursor, etc.) that needs to build UI for RISE OS. It defines every visual and implementation decision — **do not deviate**.

---

## Prompt

You are building UI for **RISE OS**, a productivity operating system for founder-led SMEs. Follow every rule below exactly. These are binding.

---

### 1. Typography — Inter Only

**One font family: Inter.** No other font is permitted.

```css
font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Recommended production loading (Next.js):**
```ts
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
```

**Type Scale**

| Use case              | Size   | Weight | Letter-spacing   |
|-----------------------|--------|--------|------------------|
| Hero display          | 48px   | 800    | −0.02em          |
| Section heading       | 36px   | 700    | −0.02em          |
| Page title            | 20px   | 700    | −0.02em          |
| Card / section title  | 16px   | 700    | −0.01em          |
| Body / task           | 14px   | 500    | 0                |
| Caption / meta        | 12px   | 400    | 0                |
| Eyebrow label         | 11px   | 700    | +0.15em + uppercase |

---

### 2. Color Tokens (Single Source of Truth)

Never hardcode hex values. Always use CSS custom properties.

```css
:root {
  --brand:           #FF6535;
  --brand-hover:     #FF8159;
  --brand-text:      #D6450F;   /* AA 4.5:1 on white */
  --brand-tint:      #FFF0EB;

  --surface-base:    #FFFFFF;
  --surface-paper:   #F9FAFB;
  --surface-card:    #FFFFFF;
  --surface-dark:    #1A1A2E;
  --surface-footer:  #0B1120;

  --text-strong:     #1A1A2E;
  --text-body:       rgba(26,26,46,0.70);
  --text-muted:      rgba(26,26,46,0.50);
  --text-on-dark:    #FFFFFF;
  --text-on-brand:   #FFFFFF;

  --color-success:   #10B981;
  --color-danger:    #E11D48;
  --color-warning:   #F59E0B;
  --border-focus:    #FF6535;
}
```

**Priority Colors**

```ts
export const PRIORITY_CONFIG = {
  P1: { color: '#EF4444', bgColor: '#FEF2F2', label: 'P1 Urgent'  },
  P2: { color: '#FF6535', bgColor: '#FFF0EB', label: 'P2 High'    },
  P3: { color: '#3B82F6', bgColor: '#EFF6FF', label: 'P3 Medium'  },
  P4: { color: '#9CA3AF', bgColor: '#F9FAFB', label: 'P4 Low'     },
};
```

---

### 3. Graph-Paper Background — Required on Every Section

```css
/* Light sections */
.graph-bg {
  background-image:
    linear-gradient(rgba(26,26,46,0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(26,26,46,0.045) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* Dark sections */
.graph-bg-dark {
  background-image:
    linear-gradient(rgba(255,101,53,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,101,53,0.07) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

---

### 4. Border Standard — Always Visible

Every container and interactive element must have a visible border at rest.

**Resting border:** `1.5px solid rgba(26,26,46,0.16)`  
**Hover / Focus:** `rgba(255,101,53,0.50)` + focus ring

Global focus ring (mandatory):

```css
*:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
```

---

### 5. Buttons

```css
.btn--primary {
  background: var(--brand);
  color: var(--text-on-brand);
  border: 1.5px solid rgba(255,101,53,0.20);
  border-radius: 4px;
  font-weight: 700;
  min-height: 44px;
  padding: 0 20px;
  box-shadow: var(--shadow-brand);
}

.btn--primary:hover {
  background: var(--brand-hover);
  box-shadow: 0 0 0 3px rgba(255,101,53,0.14), 0 3px 12px rgba(255,101,53,0.2);
}

.btn--primary:active {
  transform: scale(0.95);
  box-shadow: none;
}

.btn--secondary {
  background: transparent;
  color: var(--text-strong);
  border: 1.5px solid rgba(26,26,46,0.18);
  border-radius: 4px;
  font-weight: 700;
  min-height: 44px;
  padding: 0 20px;
}

.btn--secondary:hover {
  border-color: rgba(255,101,53,0.50);
}
```

---

### 6. Cards

```css
.card {
  background: var(--surface-card);
  border: 1.5px solid rgba(26,26,46,0.16);
  border-radius: 12px;
  padding: 20px;
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
  transition: border-color 200ms ease, box-shadow 200ms ease, transform 180ms cubic-bezier(0.16,1,0.3,1);
}

.card::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 3px;
  background: linear-gradient(90deg, var(--brand), var(--brand-hover));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 240ms cubic-bezier(0.16,1,0.3,1);
}

.card:hover {
  border-color: rgba(255,101,53,0.50);
  box-shadow: var(--shadow-hover);
  transform: translateY(-1px);
}

.card:hover::before {
  transform: scaleX(1);
}

.card:active {
  transform: scale(0.995);
}
```

---

### 7. Icons, Mobile Feedback, Shadows, Motion, Spacing, Layout

(Use the latest definitions from `tokens.css` and SKILL.md for these sections — they are the refined single source.)

**Key Rules to Enforce:**
- Lucide icons only (2px stroke)
- Minimum 44px tap targets
- Pair every `:hover` with `:active`
- Animate only `transform` and `opacity`
- 8pt grid spacing
- Single breakpoint: `768px` (`md:`)
- Content rail: `max-width: 1280px; margin-inline: auto; padding-inline: 24px`

---

### 8. Anti-Patterns (Never Do)

- Hardcode any hex color
- Use any font other than Inter
- Omit graph-paper background
- Use transparent borders at rest
- Use emoji as UI icons
- Use navy text on orange buttons
- Use `text-gray-*` or `bg-gray-*` classes
- Ignore mobile active states

---

### 9. File Reference & Tokens

All tokens and utilities live in:
```
.claude/skills/frontend-design/assets/tokens.css
```

Link it in every HTML demo:
```html
<link rel="stylesheet" href="assets/tokens.css">
```

**Always consult** `SKILL.md` for TypeScript/React patterns (`cn()`, dynamic colors, etc.).

---
