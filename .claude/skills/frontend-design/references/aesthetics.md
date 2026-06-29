# Aesthetics — why RISE looks the way it does

This file is the reasoning layer behind the tokens in `SKILL.md`. Read it
when you're deciding how to extend the system to a new screen, not when
you already know the token value — the values themselves live in
`SKILL.md`, not here.

**Locked direction: Dark Cockpit.** Not Dark Premium Green, not Aurora,
not Editorial. If a reference, asset, or old note anywhere mentions Lato,
Inter, or a green (`#138A57` / `#0B1612`) palette, that belongs to a
**different project** (the consulting/zenabm brand system) — it does not
apply to RISE. Importing it here is the single fastest way to make RISE
look like a different product wearing RISE's nav bar.

---

## 1. Typography — editorial intelligence + precision data

**Rule:** two type families for personality and legibility, plus one
monospace family reserved for numbers. No fourth family, ever.

| Role | Font | Weight ceiling | Why |
|---|---|---|---|
| Headings | **Lexend** | 600 (SemiBold) — 500 (Medium) is the default | Designed by reading researchers to improve reading speed; right for a cockpit you read constantly, not a landing page you glance at once. Capping at SemiBold keeps headlines feeling designed without the marketing-page shout Bold introduces. |
| Body / UI | **IBM Plex Sans** (+ IBM Plex Sans Arabic) | 400–500 | Same precision-at-12–14px profile as a generic grotesk, but reads engineered and tool-like rather than generic-SaaS. Native Arabic companion covers bilingual UI without a font swap later. |
| Data / metrics | **JetBrains Mono** | 500 | Tabular figures never shift width between characters — non-negotiable for scannable balances, streaks, and calorie totals. |

**Why Bold is banned, not just discouraged:** the entire color system spends
its "loud" budget on one purple accent. A Bold headline competes with that
accent for attention and reads as generic SaaS marketing the moment it
appears. SemiBold is the deliberate, rare exception for the one hero number
that needs to outrank a sibling on the same screen — never the default.

**Load as variable fonts** (`wght` axis) rather than static weight files —
smaller payload, smoother transitions between 500/600, and `font-display:
swap` so text renders in a system font during load instead of staying
invisible.

**Slop to avoid:** Inter, Plus Jakarta Sans, Roboto, system-font stacks for
headings, any heading at 700+, body text below 14px, mono used for
anything that isn't a number.

---

## 2. Color & theme — one accent, four elevations

**Rule:** the surface system carries the layout through luminance, not
hue. Purple is the only color allowed to mean "the AI is active" — it
appears nowhere else.

**Why purple is rationed to ≤10%:** RISE replaces 7+ single-purpose apps.
If purple decorated buttons, links, and chrome indiscriminately, the user
loses the one visual cue that currently means "this is RISE's
intelligence layer, not just RISE's UI." Scarcity is what gives the color
meaning.

**Why module colors exist:** seven modules competing for the same purple
would collapse the cockpit's spatial memory back into one undifferentiated
app. Each module's accent (green/tasks, blue/finance, amber/habits,
pink/journal, lavender/contacts, silver/notes) is a wayfinding signal —
glanceable on a 4px card border or nav icon, never a background fill.

**Why no pure black/white:** `#000000` and `#FFFFFF` cause halation on
OLED panels, which is materially worse for the roughly half of users with
some degree of astigmatism. `#0E0E11` and `#E8E8F0` give the same "true
dark / near-white" read without the glare.

**Why luminance over shadows:** drop shadows on a dark surface either
disappear or look muddy. Elevation here is built by stepping the surface
token brighter (`--surface-base` → `--surface-1` → `--surface-2` →
`--surface-overlay`), which reads as depth under any ambient lighting
condition a phone screen will actually be viewed in.

---

## 3. Motion — spring, not linear, spent on touch feedback

**Rule:** every state change gets a spring or smooth ease curve, never a
flat linear transition. The motion budget is spent on touch feedback and
one orchestrated load sequence, not scattered decoration.

**Why spring easing:** `cubic-bezier(0.34, 1.56, 0.64, 1)` overshoots
slightly before settling — that small overshoot is what makes a tap feel
like it landed on something physical rather than a flat UI event. Linear
or pure ease-in/out reads as "generated," not designed.

**Where the motion budget goes, in priority order:**
1. **Touch feedback** (`.tappable:active`, `scale(0.96)`) — every single
   tappable element, no exceptions. Mobile has no hover, so this *is* the
   primary feedback channel, not a nice-to-have.
2. **Dashboard load stagger** — cards entering with a 60ms step and a
   12px slide-up. One orchestrated moment per screen load, not per
   scroll.
3. **AI compose state changes** — idle → pressed → typing → done. This is
   the one place a slightly more elaborate animation (the pulsing
   gradient shimmer) is justified, because it's reinforcing the purple
   "AI is thinking" cue, not decorating an unrelated control.
4. **Count-up on metric values** — capped at 600ms specifically so it
   never reads as the app "thinking too hard" about a number it should
   already have.

**Always respect `prefers-reduced-motion`** — see `SKILL.md` for the exact
media query. This is non-negotiable, not a nice-to-have.

---

## 4. Backgrounds & atmosphere

**Rule:** the base surface is flat and quiet. Atmosphere comes from the
accent glow and from glass chrome on structural elements — never from a
busy gradient mesh or grain texture, which would fight the dense data
cards RISE is full of.

- **`--accent-glow`** (`rgba(124, 92, 252, 0.15)`) is the only ambient
  glow in the system, reserved for active/AI states (`.card--active`
  box-shadow, the AI compose FAB). It is not a background decoration —
  it always signals "AI touched this."
- **Glass chrome** (`.glass-chrome`, `backdrop-filter: blur(20px)
  saturate(160%)`) is for structural elements that float above content:
  bottom nav, modals, sticky headers. It is never applied to a content
  card or a chart, where blur would make data illegible.
- **No noise/grain, no mesh gradients, no busy patterned backgrounds.**
  RISE's density is in the cards, not the canvas behind them — a textured
  background would compete with content the user actually needs to read.

---

## Direction lock

| | RISE — Dark Cockpit (this project) | NOT this project |
|---|---|---|
| Type | Lexend 500/600 + IBM Plex Sans 400/500 + JetBrains Mono | Lato 700/900 + Inter, or Plus Jakarta Sans + Nunito Sans |
| Color | Near-black `#0E0E11` + purple `#7C5CFC` AI accent + per-module accents | Green `#138A57` / `#0B1612` (consulting/zenabm brand) |
| Background | Flat surfaces + purple glow only | Aurora green radial glow, mesh gradients, grain |
| Motion | Spring/smooth, touch-feedback-first | Generic ease-out/ease-in page-load reveal only |

If you're ever unsure which system applies, check the project: this file
only governs `RISE OS/rise/`. Anything else (consulting site, other
client work) has its own separate design system and should not borrow
RISE's tokens or vice versa.
