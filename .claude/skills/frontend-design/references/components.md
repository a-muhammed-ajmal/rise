# Components, states & the token system — RISE specifics

`SKILL.md` already gives the canonical `.card` and bottom-nav CSS. This
file covers what's *not* repeated there: how the token layer is organized,
the full state contract every component must satisfy, reusable layout
primitives, and how the tokens wire into the actual Next.js/Tailwind stack.

---

## 1. Token layer — single dark theme, semantic only

RISE has **no light mode and no theme remap.** Every token in `SKILL.md`'s
`:root` block (surfaces, accent, semantic data colors, text, borders) is
already semantic and already dark-first — there is no separate primitive
layer to abstract and no `prefers-color-scheme` branch to write.

> **Assumption flagged:** this file assumes RISE stays dark-only (cockpit
> identity, not a toggle). If a light mode or a tablet/desktop variant
> ever gets scoped in, that needs a new remap layer added to `SKILL.md`
> first — don't invent one ad hoc inside a single component.

Components reference **only** the named tokens (`var(--surface-1)`,
`var(--accent-primary)`, etc.) — never a raw hex value, even one copied
from `SKILL.md`. If a new color is needed that isn't in `SKILL.md`'s
token list, that's a sign the token list needs an addition, not that the
component should hardcode a one-off.

---

## 2. Component state contract

Every interactive component in RISE must define **all** applicable
states below. A card or button that only styles default + active is
unfinished — touch devices have no reliable hover, so the active and
focus-visible states are doing the work hover does on desktop.

| State | Required for | RISE implementation |
|---|---|---|
| Default | all | the resting look from `SKILL.md`'s `.card` / nav-item rules |
| Hover | desktop pointer only | guard with `@media (hover: hover)`; never the only signal, and not required on touch-only components |
| **Active / pressed** | all tappable elements | `.tappable:active { transform: scale(0.96) }` — see Motion System in `SKILL.md`. This is RISE's primary feedback channel, not optional polish |
| **Focus-visible** | all | `outline`/border using `--border-active`, ≥2px — mandatory for keyboard and switch-control users even though RISE is touch-first |
| Disabled | actions, inputs | reduced opacity, `cursor: not-allowed`, `aria-disabled` |
| Loading | async actions, data cards | `.skeleton` shimmer (see Motion System) for waits >200ms; spinner only for in-button actions |
| Selected / current | bottom nav, day-strip calendar | `.nav-indicator` sliding pill/dot, never a jump-cut; active day in the meal tracker gets the `--accent-primary` pill |
| Error / invalid | inputs, sync failures | `--color-danger`, paired with text/icon — never color alone (see Anti-Patterns in `SKILL.md`) |
| Empty | lists, modules with no data yet | a designed empty state per module, not a blank card — e.g. "No habits logged yet" with the module's accent, not a generic spinner forever |

---

## 3. Layout primitives

Reuse these rather than re-deriving card-grid CSS per screen:

- **Grid-safe card grid** — RISE's own primitive, defined in `SKILL.md`:
  ```css
  .grid-safe {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
  ```
  Always `minmax(0, 1fr)`, never bare `1fr` — see Typography overflow
  rules in `SKILL.md` for why.
- **Bottom sheet** — the dominant container for secondary content
  (settings, filters, confirmations, expanded meal sections). Slides up
  from the bottom edge, uses `--dur-slow` (400ms) and `--ease-spring`,
  respects `env(safe-area-inset-bottom)`.
- **Stack** for vertical card rhythm: `display:flex; flex-direction:
  column; gap: var(--space-4)`.
- **Cluster** for wrapping rows (chips, tags, module filters):
  `display:flex; flex-wrap:wrap; gap: var(--space-2)`.

---

## 4. Framework wiring — Next.js + Tailwind

RISE's stack is Next.js / TypeScript / Tailwind / Supabase. Drive Tailwind
from the CSS variables already defined in `SKILL.md`, so the tokens stay
the single source of truth and nothing gets duplicated as a raw hex in
`tailwind.config`:

```ts
// tailwind.config.ts — extend, don't replace
export default {
  theme: {
    extend: {
      colors: {
        'surface-base': 'var(--surface-base)',
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'surface-overlay': 'var(--surface-overlay)',
        'accent-primary': 'var(--accent-primary)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'module-tasks': 'var(--module-tasks)',
        'module-finance': 'var(--module-finance)',
        'module-habits': 'var(--module-habits)',
        'module-journal': 'var(--module-journal)',
        'module-contacts': 'var(--module-contacts)',
        'module-notes': 'var(--module-notes)',
        'module-ai': 'var(--module-ai)',
      },
      fontFamily: {
        heading: ['Lexend', 'system-ui', 'sans-serif'],
        body: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: { card: '16px' },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
};
```

Load Lexend and IBM Plex Sans via `next/font/google` as variable fonts
(see Typography in `SKILL.md`) rather than `<link>` tags, so Next.js
self-hosts and preloads them automatically.

---

## 5. Component pre-ship checklist

- [ ] Uses only `SKILL.md` tokens — no literal hex, no arbitrary spacing.
- [ ] Active + focus-visible implemented; hover (if any) is additive, not
      load-bearing.
- [ ] Correct semantic element (`<button>`, not a styled `<div>` with a
      click handler).
- [ ] Every text node that can overflow has `.text-truncate` or
      `.text-clamp-2`.
- [ ] If it's a card: lives on `--surface-1` or `--surface-2`, never bare
      `--surface-base`, and uses luminance — not a shadow — for any "lift."
- [ ] If it's tappable: has `.tappable` and a 44×44px minimum target.
- [ ] If it shows data: has a loading (skeleton) and an empty state
      designed, not just a default state.
- [ ] If it carries a module identity: the module accent appears as a 4px
      border / icon fill, never a background wash.
