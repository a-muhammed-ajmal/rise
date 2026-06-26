# Frontend Design Skill

## Purpose
This skill helps Claude create distinctive, memorable frontends that avoid generic AI-generated design patterns — using the violet / IBM Plex Sans system as the working default palette and type system, not just an example.

## Principles

### 1. Distinctive Typography
- **Single-family system, not a serif + sans pairing.** The generic version of this principle calls for a display serif paired with a sans body face. This system deliberately breaks that: IBM Plex Sans handles every role — headline, body, label, nav — with hierarchy built from weight (400/500/600/700) and tracking, not a font swap. This is a verified pattern (context.dev's compiled CSS resolves `--font-sans`, `--font-display`, and `--font-body` to the same Plex Sans variable), not a shortcut.
- Reserve **IBM Plex Mono** for genuinely numeric/data/code content (stats, dashboard figures, API snippets) — never for general UI text.
- Use the verified type scale below rather than ad hoc sizing:

| Role | Size | Weight | Tracking |
|---|---|---|---|
| headline-display | 60px | 700 | -0.02em |
| headline-lg | 48px | 700 | -0.02em |
| headline-md | 35px | 500 | -0.02em |
| headline-sm | 26px | 500 | -0.02em |
| body-lg/md/sm | 16/14/12px | 400 | 0 |
| label-lg/md/sm | 16/14/12px | 600 | 0 |
| eyebrow | 12px | 600 | 0.06em |

- Avoid: default system fonts, inconsistent sizes outside this scale, poor line-height, dropping mid-heading weight back to 400 (Plex Sans Regular reads thin at 26–35px without the 500-weight bump).

### 2. Cohesive Color Systems
- Primary palette is fixed, not improvised per project: `#6D28D9` (primary/CTA), `#2E1065` (text/headline), `#5B21B6` (hover/pressed), `#FAF8FD` (page background), `#FFFFFF` (surfaces), `#5E6C7A` (muted), `#6D28D933` (border).
- Semantic tokens are **decoupled from brand color**: `#E92D2D` for error, `#16A34A` for success. Don't let the brand hue absorb a semantic role — violet reading as "success" isn't intuitive the way green is, and it collapses a meaningful distinction.
- Contrast isn't optional and isn't eyeballed: white text on `#6D28D9` measures 7.10:1 (WCAG AA pass for normal text); `#2E1065` on white measures 15.24:1. Compute the actual ratio for any new color combination before shipping it — don't assume a "brand-looking" color clears AA.
- Avoid: random hex colors outside this set, unnamed colors scattered across CSS, gradients applied without checking that every text/background combination inside the gradient still clears contrast at both ends.

### 3. Orchestrated Motion & Animation
- Apply staggered entrance animations (offset delays) to sequenced elements.
- Use easing like `cubic-bezier(0.34, 1.56, 0.64, 1)` for personality on key moments — not on every element.
- Animate transforms (scale, rotate, translateY), never properties that trigger layout reflow.
- Reserve `backdrop-filter: blur()` for glass/overlay moments where it earns its cost — not as default card styling.
- Avoid: motion without functional purpose, jarring or excessive transitions.

### 4. High-Impact Micro-Interactions
- Hover/active feedback should route through the system's own tokens, not arbitrary darkening: buttons hover to `#5B21B6` (accent-strong), never a generic `darken(10%)`.
- Focus rings: `#6D28D9` at reduced opacity (e.g. `#6D28D933`), consistent with the existing border token rather than a new ad hoc color.
- Animated underlines on nav links, icon micro-animations on hover, smooth state transitions, visible loading/confirmation states.
- Avoid: static, unresponsive interfaces; hover states that introduce a color outside the defined palette.

### 5. Layout & Spacing
- Spacing scale is fixed: `6px / 16px / 24px / 32px / 40px / 64px`. No arbitrary pixel values outside this set.
- Card radius: 16px. Button/chip radius: full pill. Input radius: 8px. This is a closed set — don't introduce a new radius value without updating the token list.
- Depth is border-led, not shadow-heavy: thin `#6D28D933` borders on white surfaces against the `#FAF8FD` page background, light shadows only where separation genuinely needs it.
- Mobile-first, responsive breakpoints at 640px / 1024px / 1440px, 16px base unit held across all of them.

### 6. Anti-Patterns to Avoid (AI Slop)
- **Important distinction:** this system's violet is not the anti-pattern. The generic warning against "flat, colorless purple/blue gradients without intention" is about *unverified, decorative* purple slapped on without contrast checking or semantic logic. This system's violet has computed contrast ratios, a decoupled success/error pair, and a documented reason for the hue (AI-agent category fit, accessibility upgrade over the source green). The anti-pattern is the absence of that reasoning, not the color itself.
- System font (Inter) with no personality — not a risk here since IBM Plex Sans is the deliberate, verified choice, but don't let a future component quietly fall back to a browser default.
- Pure white backgrounds with gray text — this system uses `#FAF8FD` and `#2E1065` specifically to avoid that flatness; don't substitute generic grays.
- Generic emoji icons, no visual hierarchy, static content with zero interactivity, generic marketing copy ("Streamline Your Workflow").

## Implementation Checklist
- [ ] CSS variables defined for every token above (colors, spacing, radius, typography) — no hardcoded hex/px outside the variable set
- [ ] IBM Plex Sans loaded for all text roles; IBM Plex Mono loaded only where data/code content appears
- [ ] Heading hierarchy built from weight (500/700) and tracking (-0.02em), not multiple font families
- [ ] Success (`#16A34A`) and error (`#E92D2D`) kept distinct from brand violet in every component
- [ ] Contrast ratio computed (not assumed) for any new color pairing before it ships
- [ ] Entrance animations staggered; transforms used instead of layout-triggering properties
- [ ] Hover/focus states use accent-strong (`#5B21B6`) or border-alpha (`#6D28D933`) tokens, not ad hoc colors
- [ ] Spacing and radius values drawn only from the fixed scales above
- [ ] Mobile responsiveness verified at 640px / 1024px / 1440px breakpoints
- [ ] No element named generically ("container", "wrapper") where a semantic name is available

## Example Patterns

### CSS Variables Pattern
```css
:root {
    --color-primary: #6D28D9;
    --color-accent-strong: #5B21B6;
    --color-secondary: #2E1065;
    --color-background: #FAF8FD;
    --color-surface: #FFFFFF;
    --color-muted: #5E6C7A;
    --color-border: #6D28D933;
    --color-error: #E92D2D;
    --color-success: #16A34A;
    --font-sans: "IBM Plex Sans", system-ui, sans-serif;
    --font-mono: "IBM Plex Mono", ui-monospace, monospace;
    --spacing-xs: 6px;
    --spacing-sm: 16px;
    --spacing-md: 24px;
    --spacing-lg: 32px;
    --spacing-xl: 40px;
    --spacing-2xl: 64px;
    --radius-card: 16px;
    --radius-input: 8px;
    --radius-pill: 9999px;
}
```

### Staggered Animation Pattern
```css
.element {
    animation: fadeInUp 0.8s ease-out 0.2s both;
}
.element:nth-child(2) {
    animation-delay: 0.3s;
}
```

### Hover Interaction Pattern
```css
.button-primary {
    background: var(--color-primary);
    color: #FFFFFF;
    font-family: var(--font-sans);
    font-weight: 600;
    border-radius: var(--radius-pill);
    transition: background 0.2s ease, transform 0.2s ease;
}
.button-primary:hover {
    background: var(--color-accent-strong);
    transform: translateY(-2px);
}
.button-primary:focus-visible {
    outline: 3px solid var(--color-border);
    outline-offset: 2px;
}
```

### Typography Scale Pattern
```css
h1 {
    font-family: var(--font-sans);
    font-size: clamp(2.25rem, 6vw, 3.75rem); /* 36px → 60px, matches headline-display/lg */
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -0.02em;
    color: var(--color-secondary);
}
h2 {
    font-family: var(--font-sans);
    font-size: clamp(1.625rem, 4vw, 2.1875rem); /* 26px → 35px, matches headline-sm/md */
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: var(--color-secondary);
}
.data-figure {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--color-secondary);
}
```

## When to Apply
- Building new UI components or pages for this brand
- Redesigning existing interfaces that feel generic or inherited the source green/Montserrat system
- Creating marketing landing pages, dashboards, or client-facing deliverables under this identity
- Adding polish and personality without inventing a new palette per project

## Success Metrics
- Does the design feel intentional, not AI-generated?
- Is every color pairing's contrast ratio computed, not assumed?
- Is typographic hierarchy built from IBM Plex Sans weight/tracking alone, with no stray font families?
- Are success/error states kept semantically distinct from the brand violet?
- Do animations and hover states route through the defined token set rather than ad hoc values?
- Is the interface responsive across the three defined breakpoints?

## References
- https://fonts.google.com/specimen/IBM+Plex+Sans
- https://fonts.google.com/specimen/IBM+Plex+Mono
- https://webaim.org/resources/contrastchecker/
- https://easings.net/
- https://web.dev/responsive-web-design-basics/
