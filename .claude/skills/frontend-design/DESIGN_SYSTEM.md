# RISE — Frontend Design System

Current specification: 20 September 2026. This is the single visual specification for the app. SPEC.md owns product behavior; CLAUDE.md and AGENTS.md own engineering and safety rules. Historical phase notes and the standalone assets demo do not override this document.

## Identity

RISE is one person's personal operating system. Preserve the exact name RISE, the existing three-leaf mark, all module names, and existing data semantics.

- Deep Navy #0C2443 carries identity and primary actions in light mode.
- Golden Yellow #FDB304 is reserved for small highlights and active indicators. Never use yellow text on white.
- Inter is the only typeface. Maximum weight is 600, including headings and metrics; font-bold and font-extrabold are prohibited.
- Render the mark through components/brand/rise-logo.tsx. Its source geometry is public/rise-logo.svg. Do not redraw or alter its geometry or golden leaf. Use the existing plate variant for prominent dark placements and --brand-mark for small inline uses.
- Keep the faint 40px graph-paper signature on the app shell and login. Do not layer more grids inside content cards.

## Runtime source of truth

app/globals.css owns actual values and theme overrides. components/ui owns shared controls. Update these together with this specification when a visual decision changes.

The files assets/tokens.css and assets/demo.html are historical standalone examples, retained for reference. They are not imported by the app and must not be copied into production. Read the live stylesheet for tokens. The .agents skill directory is a local mirror of .claude, not a separate authority.

## Color roles

| Role | Light | Dark |
| --- | --- | --- |
| Action fill: --brand-action | #0C2443 | #2E5488 |
| Action hover: --brand-hover | #16365C | #3A6AA8 |
| Brand text and focus: --brand-text / --brand | #0C2443 | #FDB304 |
| Small highlight: --brand-accent | #FDB304 | #FDB304 |
| Brand tint: --brand-tint | #EEF2F8 | golden yellow at 15% |
| Background: --surface-base | #FFFFFF | #0B1120 |
| Supporting surface: --surface-paper | #F9FAFB | #151527 |
| Card: --surface-card | #FFFFFF | #1A1A2E |
| Main text: --text-strong | #1A1A2E | #E9EAF2 |
| Body color: --text-body | navy at 70% | off-white at 72% |
| Muted text: --text-muted | navy at 62% | off-white at 68% |

White on the light action fill has approximately 15.6:1 contrast; white on the dark action fill has approximately 7.7:1. Yellow on white is approximately 1.8:1 and is not an accessible text color. These ratios describe those exact pairs, not every component state.

Module identity remains distinct from status and life-area identity. Use --mod-tasks, --mod-finance, --mod-wellness, --mod-goals, --mod-knowledge, --mod-crm and their tints for small icons and labels. Keep --area-* and --color-p1 through --color-p4 mappings intact. A high-priority orange is a priority semantic, not an old brand color. AI uses the core brand and standard cards, without a separate accent.

Success, danger, warning and info use their own semantic tokens. Do not communicate status through color alone. Normal balances and expenditure totals can use neutral text; a deficit remains explicitly labeled and uses danger text.

## Typography

| Role | Utility | Size | Weight |
| --- | --- | --- | --- |
| Dashboard greeting | text-display | 24px | 600 |
| Page title | text-h1 | 20px | 600 |
| Section/card title | text-h2 | 16px | 600 |
| Body/task | text-body or text-sm | 14px | 400–500 |
| Metadata | text-label or text-xs | 12px | 400–500 |
| Compact navigation | text-micro | 11px floor | 400–600 |
| Metric | text-metric | 24px | 600 |

Use the fixed scale, no fluid clamp(). Titles of 20px and above use -0.02em tracking. Financial amounts and metrics use tabular numerals. Important labels and warnings wrap instead of truncating. Forms may use 16px input text on mobile.

--text-body is exclusively a COLOR. --font-size-body is the 14px SIZE used by the text-body utility. Never reuse a CSS custom property for incompatible value types.

## Layout and spacing

- Use PageShell and PageHeader from components/layout/page-shell.tsx for updated modules.
- PageShell: centered, maximum 1280px; mobile side padding 16px, desktop 24px; 24px between major sections.
- Only md (768px) is a viewport breakpoint. Columns may wrap intrinsically when the available content width is too narrow.
- Desktop can show related sections side by side; text and task rows should remain at a comfortable reading width.
- Card interior: normally 16px, compact summaries 12px. Avoid stacked parent/child vertical padding on repeated rows.
- Shared radius scale: 4px buttons, 8px inputs, 12px cards, 16px dialogs/sheets, fully rounded pills only where appropriate.
- Navigation retains the desktop sidebar and five mobile slots: Home, Tasks, AI, Finance, More. Keep safe-area bottom padding and room for floating actions.

## Surfaces and controls

- Neutral resting borders on cards and inputs. Repeated rows inside a card may use separators instead of nested bordered cards.
- Use small module icons/tints rather than bright borders around every panel. Preserve meaningful task area and priority indicators.
- Light cards have a subtle shadow; dark cards use surface elevation. Interactive cards may lift 1px, without decorative top-edge wipes.
- Static information should not animate as if clickable. Glass blur belongs only to structural chrome and overlays.
- All shared button sizes have at least 44px height; icon controls have at least a 44×44px hit area. Avoid shrinking these in page overrides.
- One clearly labeled primary header action; secondary actions use outline/ghost. Use shared Button, Card, Tabs, DropdownMenu and Dialog primitives.
- Use consistent 16px inline icons and 20px navigation icons. Add accessible names to icon-only actions.

## Home and Finance reference patterns

Home: greeting and three summaries, then Today's Focus and Today's Tasks. Habits sit alongside on wide screens and follow tasks on mobile. Show three pending habits initially with an accessible expand control. Keep goals, AI assistance, contact follow-ups, transactions and the smaller motivation message available. Choosing focus tasks opens the existing task workflow.

Finance: labeled Add income/Add expense actions, a visible total wallet balance, wrapping wallet details, readable monthly income/spending/net values, and three main navigation buttons (Overview, Transactions, Wallets). Transfers, Budgets, Debts and Categories stay reachable in the More menu, which displays the selected secondary view. Preserve date filtering, amounts, all existing forms and every ConfirmDialog.

## Accessibility and motion

- Target WCAG AA: at least 4.5:1 for normal text, 3:1 for large text and essential graphical controls. Measure actual adjacent colors in each theme.
- Visible keyboard focus: 2px ring with 2px offset, or an equally visible primitive focus treatment.
- Programmatic form labels; decorative icons are aria-hidden. Announce meaningful loading/error/result states.
- Keyboard order follows document order; secondary menus support Escape. Never rely on hover to expose essential controls on touch.
- Use --dur-fast (150ms), --dur-normal (250ms), --dur-enter (350ms), and --dur-slow (400ms maximum). Animate transform/opacity; respect prefers-reduced-motion.

## Performance

- Keep the existing targets: LCP below 2.5 seconds and CLS below 0.1. Avoid synchronous work that blocks the main thread for more than 50ms.
- Load Inter once through next/font. Do not add a production Google Fonts stylesheet request.
- Reserve image dimensions and loading space. Prefer next/image for content images and lazy-load off-screen assets; use RiseLogo for the inline brand mark.
- Keep lucide-react as the icon set. Prefer native JavaScript and the existing date-fns helpers over additional utility libraries.
- Batch DOM measurements before style writes. Reuse existing hooks and dependencies instead of introducing another state-management layer.

## Implementation and verification

Use TypeScript strict without any or type assertions, cn() from lib/utils.ts for conditional classes, and lib/format.ts for user-facing dates/currency. Pass dynamic data colors through styles; do not construct arbitrary Tailwind class names. Preserve server-only secrets, auth checks, approval tiers and append-only migrations.

Read the installed Next.js docs before framework edits. Keep server rendering for data/layout and client boundaries around interactions. Reuse existing hooks; no provider, database or state-management migration is part of a visual refresh.

For visual changes, inspect mobile and desktop, light and dark, long labels/amounts, empty/loading states, and keyboard controls. Add behavioral regression tests where interactions change. Run the required gate in order: npm run test:coverage, npm run lint, npm run build. Report exact results and distinguish local verification from deployed state.
