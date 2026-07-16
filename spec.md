# SPEC.md — RISE Personal OS

Living specification for the RISE codebase. Describes what is currently implemented, what architectural decisions were made, and what constraints govern future development. CLAUDE.md governs code conventions.

---

## Current State Snapshot

| Metric | Value |
| --- | --- |
| Test count | 318 passing |
| Line coverage | 52.27% on `lib/**` |
| Migrations | 16 (001–016) |
| DB tables | 25 (across 16 migrations) |
| AI tools | 60 AUTO + 17 APPROVAL = 77 total |
| Last feature shipped | Phase 12 — Persistent chat history, real memory, user profile, remember/recall tools (2026-07-08) |

_Update this table each time a phase completes or metrics change._

---

## Objective

RISE is a single-user personal operating system that replaces Todoist, a finance app, a habit tracker, a journal, a CRM, and a knowledge base in one app. The distinguishing feature is an AI assistant powered by Google Gemini 2.5 Flash (`gemini-2.5-flash` via `@google/genai`) that can *read all user data* and *execute real actions* inside the system — creating tasks, logging expenses, logging habits, searching notes — via a two-tier tool system: auto-execute for low-risk operations, approval-gated for destructive ones.

Built for one person (UAE-based): AED currency, DD/MM/YYYY dates, 12-hour time.

---

## Technology Constraints

| Concern | Constraint |
| --- | --- |
| Framework | Next.js 16.2.9 (App Router) — `proxy.ts` replaces `middleware.ts` at the project root |
| Language | TypeScript strict — no `any`, no type assertions |
| Styling | Tailwind CSS v4 + shadcn/ui built on `@base-ui/react` |
| AI provider | Google Gemini 2.5 Flash (`@google/genai ^2.10.0`) — function calling via `FunctionDeclaration` / `Type.*` schema format |
| Memory / embeddings | Voyage AI (`voyage-3`, 1024-dim) via REST; pgvector cosine similarity in Supabase |
| Database | Supabase (Postgres + pgvector + RLS). All tables enforce `user_id = auth.uid()` |
| Auth | Google OAuth via Supabase; single allowed email enforced in `proxy.ts` via `ALLOWED_USER_EMAIL` |
| Edge runtime | Supabase Edge Functions (Deno runtime, `jsr:@supabase/supabase-js@2`) — no npm packages |
| Testing | Vitest ^4 + Testing Library; `jsdom` environment; coverage via `@vitest/coverage-v8` |
| Deployment | Vercel (Next.js preset); Supabase project for DB + Edge Functions |
| Build | `npm run build` must exit 0 with 0 TypeScript errors and 0 lint warnings |

### Excluded from the stack

- No native mobile apps (iOS / Android)
- No third-party calendar, bank, or email sync
- `@anthropic-ai/sdk` is present in `package.json` but dormant — not the active AI provider; remove in next cleanup pass

---

## Modules

| Module | Core capability |
| --- | --- |
| **Productivity** | Tasks with status (inbox / todo / in_progress / done), priority (low → urgent), due dates, time, reminders, subtasks, attachments, recurring flag, Projects (color-coded grouping) |
| **Finance** | Income and expense transactions in AED; category budgets; debt ledger (i_owe / they_owe) |
| **Wellness** | Habit tracking with daily / weekly / custom schedules, 30-day streak view, focus session log |
| **Goals** | Goal cards with % progress slider and milestones; Journal tab with mood + energy rating (1–5) |
| **CRM** | Contacts with pipeline stage (new → won / lost), deal values, interaction log (call / email / meeting / message / other), follow-up date tracking |
| **Knowledge** | Notes (plain text, tags, linkable to task / goal / contact), Document metadata, Links |
| **Analytics** | Recharts dashboards aggregating cross-module data |
| **AI Assistant** | SSE-streaming chat with context injection (today's tasks, habits, goals, pgvector memories); `?q=` deep-link; quick-prompt shortcuts; approval banner for destructive tools |

---

## Visual Requirements

> Full system: `.claude/skills/frontend-design/` (SKILL.md + AGENT_PROMPT.md + assets/tokens.css). Light-first orange brand; Inter-only type.

### Typography

- **Single typeface: Inter** (400/500/600/700/800), loaded via `next/font/google`; CSS var `--font-inter`. No other font family — `--font-sans`, `--font-heading`, `--font-display`, and `--font-mono` all resolve to Inter.
- Fixed type scale utilities in `app/globals.css`: `text-display` (24px, greeting), `text-h1` (20px page titles, weight 700), `text-h2` (16px card titles, 600), `text-body` (14px), `text-label` (12px), `text-micro` (11px floor), `text-metric` (24px, tabular-nums). No fluid `clamp()` scaling.
- Headings: h1 = 700 / −0.02em; h2–h6 = 600 / −0.02em. `font-bold` (700) and `font-extrabold` (800) are permitted per the Inter weight ladder.
- Eyebrow labels: 11px / 700 / +0.15em uppercase, brand orange (`.eyebrow`).

### Color system

- **Brand**: `--brand: #FF6535` (primary CTA, accents, focus), `--brand-hover: #FF8159`, `--brand-text: #D6450F` (orange text on white, AA 4.5:1), `--brand-tint: #FFF0EB` (chips/badges).
- **Light-first surfaces**: `--surface-base: #FFFFFF`, `--surface-paper: #F9FAFB`, `--surface-dark: #1A1A2E` (navy, inverted sections), `--surface-footer: #0B1120`.
- **Text**: `--text-strong: #1A1A2E`, `--text-body: navy/70`, `--text-muted: navy/50`.
- **Borders — always visible at rest**: cards `1.5px rgba(26,26,46,0.16)`, inputs `1.5px rgba(26,26,46,0.18)`, hover/focus `rgba(255,101,53,0.50)` / `--border-focus: #FF6535`. Nothing borderless.
- **Status**: success `#10B981`, danger `#E11D48`, warning `#F59E0B` (each with a `-tint` background). Priority: P1 `#EF4444`, P2 `#FF6535`, P3 `#3B82F6`, P4 `#9CA3AF`.
- Module accent tokens (text/icon color + `-tint` background; tints for badges/chips, solid for icons/labels — never button fills):

| Module | Token | Text/icon | Tint |
| --- | --- | --- | --- |
| Tasks | `mod-tasks` | `#2563EB` | `#EFF6FF` |
| Finance | `mod-finance` | `#059669` | `#ECFDF5` |
| Wellness | `mod-wellness` | `#BE123C` | `#FFF1F2` |
| Goals | `mod-goals` | `#7C3AED` | `#F5F3FF` |
| Knowledge | `mod-knowledge` | `#D97706` | `#FFFBEB` |
| CRM | `mod-crm` | `#0891B2` | `#ECFEFF` |

- **AI has no module token** — `mod-ai` is retired; AI surfaces inherit `--brand` / `--brand-tint` and use the standard card treatment (no glassmorphism). AI-active state: orange `brand-pulse` glow (`--shadow-brand`).
- **Graph-paper background** (brand signature): `.graph-bg` navy grid on light, orange grid on dark, 40×40px — applied to the app shell `<main>` and login.
- Dark mode: opt-in `.dark` class on `<html>`, toggled via `lib/hooks/use-theme.tsx`, persisted to `localStorage` key `rise-theme`; falls back to `prefers-color-scheme`. Navy elevation ladder (`#0B1120` → `#151527` → `#1A1A2E` → `#232338`), off-white text (`#E9EAF2`, never pure white), neutral white/12 hairline borders with orange reserved for hover/focus/active, desaturated 400-series module accents. Light mode is the default.

### Animation system

- Entry: `.slide-up` — 350ms `--ease-out` fade + 16px Y translate. Stagger: `.stagger-1`–`.stagger-4` (0.08s increments).
- Motion tokens: `--dur-instant` (80ms), `--dur-fast` (150ms), `--dur-normal` (250ms), `--dur-enter` (350ms), `--dur-slow` (400ms). Easing: `--ease-out`, `--ease-spring`, `--ease-smooth`, `--ease-exit`.
- Animate `transform` and `opacity` only; reduced motion collapses all durations to `0.01ms`.
- Touch feedback: `.tappable` scales to 0.96 on `:active`; every `:hover` is paired with an `:active` state (hover alone is insufficient on touch).
- Interactive cards: `.card-hover` — orange top-bar wipe, `translateY(-1px)` lift, orange border on hover.
- Glass blur is permitted only on structural chrome (bottom nav, topbar); never on content cards or AI bubbles.

### Layout / responsive

- Breakpoint: `md` (768px), the only breakpoint. Below → `BottomNav` 5-slot `[Home][Tasks][AI-FAB][Finance][More]`; center AI FAB (brand orange, `--shadow-brand`) routes to `/assistant` and protrudes above the nav bar. Above → `Sidebar` (sticky, 64px collapsed / 224px expanded, all 10 nav items).
- "More" overflow sheet (shadcn `Sheet`, `side="bottom"`) exposes Wellness, Goals, Analytics, Knowledge, CRM, Settings in a 3×2 grid.
- Radii: buttons 4px, inputs 8px, cards 12px, panels/sheets 16px, pills 9999px.
- Touch targets: minimum 44×44px on every tappable element; buttons default to 44px height.
- Floating actions: brand-orange circles with `--shadow-brand`, hover lift, `active:scale-95`.

### Accessibility

- Focus ring: 2px solid `var(--border-focus)` at 2px offset on `:focus-visible`.
- All destructive actions gated behind `<ConfirmDialog>` — never `window.confirm`.

---

## Performance Targets

| Metric | Target |
| --- | --- |
| Test coverage | ≥ 85% line on `lib/**` excluding `lib/types/` (current: 49.38% — below target; `execute-tool.ts` expansion and new `use-payment-methods.ts` at 0% drove the drop) |
| Build | `next build` exits 0; 0 TypeScript errors |
| Lint | ESLint exits 0; 0 errors, 0 warnings (previously-tracked warnings cleared 2026-07-04) |
| SSE first chunk | < 3 s under normal Gemini API latency |
| Supabase queries | < 500 ms per module-load query (indexed columns only; no full-table scans) |
| PWA offline | `/offline` serves from cache within 200 ms |
| Bundle | No hard size budget yet — track via Vercel deployment analytics |

---

## Inputs / Outputs

### AI chat endpoint

```http
POST /api/ai/chat
Body: { messages: MessageParam[], approvedTool?: { name, input } }
      MessageParam: { role: "user" | "assistant" | "model", content: string }
      (Gemini uses "model" for assistant turns in stateful chat sessions)

SSE events:
  { type: "text",              text: string }
  { type: "tool_result",       tool: string, result: { success, message, data? } }
  { type: "approval_required", tool: { id, name, input } }
  { type: "error",             message: string }
  data: [DONE]
```

Second leg for approved tools: same endpoint with `approvedTool` set, returns `Response.json({ type: "tool_result", result })`.

**Gemini streaming internals:** The route establishes a stateful Gemini chat session via `GoogleGenAI`. Each streamed chunk yields `.candidates[0].content.parts[]`. Text parts emit `{ type: "text" }` SSE events; function-call parts accumulate and are processed after the stream ends. After tool execution, a follow-up `sendMessageStream` passes `functionResponse` parts back to the model. Approval-gated tools skip follow-up — the stream ends after `approval_required`.

### AI tool set

**AUTO_TOOLS** (execute immediately, 60 total):

| Group | Tools |
| --- | --- |
| Tasks (4) | `create_task` · `list_tasks` · `update_task` · `complete_task` |
| Projects (3) | `list_projects` · `create_project` · `update_project` |
| Goals (4) | `list_goals` · `create_goal` · `update_goal` · `complete_goal` |
| Milestones (4) | `create_milestone` · `list_milestones` · `update_milestone` · `complete_milestone` |
| Habits (5) | `log_habit` · `list_habits` · `create_habit` · `update_habit` · `delete_habit_log` |
| Finance (4) | `list_payment_methods` · `log_expense` · `log_income` · `list_transactions` |
| Budgets (3) | `list_budgets` · `create_budget` · `update_budget` |
| Debts (2) | `list_debts` · `create_debt` |
| Contacts (3) | `list_contacts` · `add_contact` · `update_contact` |
| Interactions (3) | `create_interaction` · `list_interactions` · `update_interaction` |
| Notes (3) | `add_note` · `list_notes` · `update_note` |
| Documents (3) | `list_documents` · `create_document` · `update_document` |
| Links (4) | `list_links` · `create_link` · `update_link` · `delete_link` |
| Journal entries (3) | `list_journal_entries` · `create_journal_entry` · `update_journal_entry` |
| Reviews (3) | `list_reviews` · `create_review` · `update_review` |
| Focus sessions (4) | `list_focus_sessions` · `create_focus_session` · `update_focus_session` · `delete_focus_session` |
| Analytics & Search (3) | `get_daily_briefing` · `get_analytics` · `search_data` |
| Personal Memory (2) | `remember_user_fact` · `recall_memories` |

**APPROVAL_TOOLS** (SSE pauses, user clicks Approve, second POST executes, 17 total):
`delete_task` · `bulk_complete_tasks` · `delete_project` · `delete_goal` · `delete_milestone` · `delete_habit` · `update_transaction` · `delete_transaction` · `delete_budget` · `update_debt` · `delete_debt` · `delete_contact` · `delete_interaction` · `delete_note` · `delete_document` · `delete_journal_entry` · `delete_review`

> Tool schemas use Google GenAI's `FunctionDeclaration` format (`Type.OBJECT`, `Type.STRING`, etc.) from `@google/genai` — not the Anthropic `input_schema` format.

### Data model (25 Supabase tables, all RLS-enforced on `user_id = auth.uid()`, migrations 001–016)

```text
projects            id, name, description, status(active|completed|archived), color
tasks               id, title, description, status, priority, due_date, due_time,
                    completed_at, is_recurring, recurrence_rule, reminder_at,
                    is_starred, tags[], subtasks(JSONB), estimated_minutes,
                    attachments(JSONB), project_id
goals               id, title, description, category, target_date, status, progress(0-100)
milestones          id, goal_id, title, due_date, completed_at
reviews             id, type, period_start, period_end, content(Json), mood, energy
journal_entries     id, date(unique/day), content, mood(1-5), energy(1-5), tags
payment_methods     id, name, balance, color, is_active, display_order
transactions        id, type(income|expense|transfer|adjustment), amount, category, description,
                    date, payment_method, payment_method_id, from_payment_method_id,
                    to_payment_method_id, tags
budgets             id, category, amount, period, period_start, period_end
debts               id, creditor, type(i_owe|they_owe), amount, description, due_date, paid_at
habits              id, name, description, frequency, target_days(int[0-6]), color, icon,
                    reminder_time("HH:MM:SS" | null), active
habit_logs          id, habit_id, logged_date, completed, note
focus_sessions      id, task_id, duration_minutes, started_at, ended_at, notes
contacts            id, name, email, phone, company, role, type, stage, deal_value,
                    notes, tags, last_contacted_at
interactions        id, contact_id, type, notes, date, follow_up_date
notes               id, title, content, tags, linked_to_type, linked_to_id
documents           id, name, file_path, file_type, file_size, tags, notes
links               id, url, title, description, tags
ai_conversations    id, messages(Json)
ai_memory           id, content, metadata(Json), embedding(float[1024])
push_subscriptions  id, user_id, endpoint, p256dh, auth, reminder_types(text[]), created_at
categories          id, name, type(income|expense), color, icon
user_profile        id, user_id(unique), facts(JSONB), created_at, updated_at
oauth_authorization_codes  id, client_id, code_hash, user_id, redirect_uri,
                           code_challenge, expires_at, used_at
oauth_tokens        id, client_id, access_token_hash, refresh_token_hash,
                    user_id, audience, expires_at, revoked_at
```

pgvector function: `match_memories(query_embedding, match_user_id, match_count?, match_threshold?)` — default `match_threshold: 0.7`. Returns `{ id, content, metadata, similarity }[]`.

### AI memory

User messages embedded via Voyage AI (1024-dim) and stored in `ai_memory`. On each request, top-10 memories retrieved by cosine similarity (`match_threshold: 0.7`) and injected into the system prompt. Keyword ILIKE fallback activates when `VOYAGE_API_KEY` is absent. Conversation compaction runs server-side on long threads (fire-and-forget).

### PWA specification

- **Manifest** (`public/manifest.webmanifest`): `display: standalone`, `start_url: /`, `scope: /`, icons at 192×192 and 512×512 (both `any` and `maskable`). Shortcuts: "Add Task" → `/productivity?action=new-task`, "Log Expense" → `/finance?action=new-expense`.
- **Service worker** (`public/sw.js`): cache name `rise-v3`. Caching strategies:
  - `/api/**` — network-only (never cache)
  - `/_next/static/**` — cache-first (content-hashed, immutable)
  - Navigation requests — network-first → cached page → `/offline` fallback
  - Other assets — stale-while-revalidate
- **Push notifications**: Web Push API. Subscriptions stored in `push_subscriptions` table. Delivery via `supabase/functions/send-push` (Deno edge function, hourly cron `0 * * * *`). Notification types: `habit_nudge` (unlogged habits due today) and `crm_followup` (interactions with `follow_up_date = today`). Required env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- **SW update flow**: new worker sends `SKIP_WAITING` on activation; client prompts via toast.
- **Offline page**: `app/offline/page.tsx` — static, no Supabase calls.

### Real-time subscriptions

Hooks subscribe to Supabase Realtime channels for live UI updates without polling:

| Hook | Channel | Events |
| --- | --- | --- |
| `use-tasks.ts` | `tasks` | `postgres_changes` on `public.tasks` (INSERT / UPDATE / DELETE) |
| `use-projects.ts` | `projects` | `postgres_changes` on `public.projects` |

All channels scope to `public` schema. RLS ensures only the authenticated user's rows fire events. Hooks call `supabase.removeChannel(channel)` on unmount to prevent leaks.

---

## Constraints

- **Single user**: `proxy.ts` middleware enforces `ALLOWED_USER_EMAIL`; every Supabase table enforces `user_id = auth.uid()` via RLS.
- **Auth**: Google OAuth via Supabase. `app/(app)/layout.tsx` (server component) redirects unauthenticated sessions to `/login`.
- **Server-only secrets** — must never reach client components:
  - `GEMINI_API_KEY` — Google AI (Gemini 2.5 Flash)
  - `VOYAGE_API_KEY` — Voyage AI embeddings (optional; ILIKE fallback activates when absent)
  - `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin (Edge Function only)
  - `VAPID_PRIVATE_KEY` — Web Push signing key
- **Client-safe env vars** (`NEXT_PUBLIC_` prefix enforced by Next.js): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- **Approval gate**: No `APPROVAL_TOOLS` call may auto-execute. The SSE `approval_required` event must surface a `<ConfirmDialog>` before the follow-up POST fires `execute-tool.ts`.
- **Migrations**: `supabase/migrations/` is append-only; changes are applied manually via the Supabase SQL editor.
- **Locale**: All currency via `Intl.NumberFormat('en-AE', { currency: 'AED' })`, all dates/times via `lib/format.ts` — never inline.
- **TypeScript strict**: no `any`, no `.env.local` committed.
- **Middleware name**: Next.js 16 places routing logic in `proxy.ts` at the project root (not `middleware.ts`).

---

## Developer Tooling (`.claude/`)

RISE ships Claude Code skills and commands that enforce architectural patterns during AI-assisted development sessions.

### Skills (`/.claude/skills/`)

| Skill | Purpose |
| --- | --- |
| `rise-module-pattern.md` | Page structure, shadcn components, `lib/format.ts` usage, animation classes, `<ConfirmDialog>` for destructive actions |
| `rise-tool-pattern.md` | `FunctionDeclaration` / `Type.*` schema format; `executeTool` handler shape; AUTO vs APPROVAL tier rules |
| `rise-test-pattern.md` | Vitest + Testing Library conventions; Supabase mock template; `vi.mock()` hoisting rules |
| `rise-sql-pattern.md` | Append-only migrations; RLS + `user_id` template; type-sync rule for `lib/types/database.ts` |

### Commands (`/.claude/commands/`)

| Command | Purpose |
| --- | --- |
| `/verify` | Runs `test:coverage` → `lint` → `build`; stops and reports on first failure |
| `/review` | Security, TypeScript, performance, and RISE-convention audit |
| `/add-tool` | TDD scaffold for a new AI tool (definition + handler + tests) |
| `/new-module` | Scaffold a new app module page with sidebar/nav wiring |

---

## Success Criteria

- All 8 module pages (productivity, finance, wellness, goals, CRM, knowledge, analytics, assistant) render without runtime errors.
- AI assistant streams text and executes approved tool calls end-to-end.
- `npm run build` exits 0 (0 TypeScript errors, 0 lint warnings).
- `npm run test:coverage` reports ≥ 85% line coverage over `lib/**` (excluding `lib/types/`). Current: 318 tests, 52.27% (below target — see Performance Targets note).
- Pushing `main` produces a working Vercel production deployment.

---

## Out of Scope

- Multi-user / team workspaces
- Native mobile apps (iOS / Android)
- Third-party calendar, bank account, or email sync
- Outbound email from the app
- Voice input for the AI assistant
- Real-time collaborative editing
- Public-facing pages or unauthenticated access beyond `/login`

---

## Decision Log

| Date | Decision | Rationale |
| --- | --- | --- |
| ~2026-06-21 | Switched AI provider from Anthropic to Google Gemini 2.5 Flash | Free-tier availability and sufficient function-calling capability. `@anthropic-ai/sdk` remains in `package.json` but is dormant — remove in next cleanup pass. |
| 2026-06-26 | Tool schemas use `Type.OBJECT` / `Type.STRING` from `@google/genai` | Gemini's `FunctionDeclaration` type requires this format; incompatible with Anthropic's `input_schema` format. |
| 2026-06-26 | VAPID JWT signed via SubtleCrypto in Deno edge function (no npm web-push) | Deno runtime in Supabase Edge Functions has no npm compatibility for `web-push`. SubtleCrypto is a Deno built-in. |
| 2026-06-26 | Migrations are append-only, applied manually via Supabase SQL editor | Prevents accidental schema drift in CI; single-person project means manual apply is low overhead. |
| 2026-06-28 | RISE design spec applied app-wide: Lexend + JetBrains Mono, 4-level surface elevation, spec type utilities, 5-slot bottom nav | Design system overhaul for the dark-first cockpit aesthetic. `font-bold` (700) is now banned; weight ceiling is 600. Purple `#7C5CFC` is the sole AI-accent. |
| 2026-06-29 | RLS hardening applied (migration 007) | Additional row-level security policies strengthened across all 20 user-data tables; AI approval token flow hardened with HMAC signing and 5-minute expiry. |
| 2026-06-30 | AI tools expanded to full CRUD across all 17 user-facing entities (58 AUTO + 17 APPROVAL = 75 total) | Systematic tool addition to enable the AI assistant to create, read, update, and delete every entity type. `update_task`, `update_goal`, and equivalent tools for all other entities were added as AUTO_TOOLS. Destructive/financial updates moved to APPROVAL_TOOLS. |
| 2026-06-30 | Multimodal chat attachments added (migration 008) | `chat-attachments` Supabase Storage bucket created; `ChatAttachment` type defined in `lib/types/database.ts`; image download and injection wired into `/api/ai/chat` for Gemini vision. |
| 2026-07-01 | `reminder_time` column added to `habits` table (migration 009) | Enables time-based habit reminders. Stored as `"HH:MM:SS"` or `null`. Habit cards and form overhauled; cards now sort by `reminder_time` ascending, nulls last. |
| 2026-07-01 | `payment_methods` table added (migrations 010, 011) | Wallet/balance tracking for the finance module. `transactions` extended with `payment_method_id`, `from_payment_method_id`, `to_payment_method_id` FK columns and two new types: `transfer` and `adjustment`. |
| 2026-07-04 | Light-first orange design system replaces the Phase 5 dark-first system app-wide | Dark/purple/Lexend cockpit aesthetic → light/orange/Inter. Inter is the single typeface (`font-bold` 700 and weight 800 now permitted). Brand `#FF6535` with visible-border standard and graph-paper signature. Two resolved decisions: (1) AI elements folded into the standard card treatment — glassmorphism removed, `aiPulse`/`glow-pulse` recolored to an orange `brand-pulse` built on `--shadow-brand`, `mod-ai` retired in favour of `--brand`/`--brand-tint`; (2) module accent tokens kept as light-mode text+tint pairs (`--mod-*` / `--mod-*-tint`): Tasks `#2563EB`/`#EFF6FF`, Finance `#059669`/`#ECFDF5`, Wellness `#BE123C`/`#FFF1F2`, Goals `#7C3AED`/`#F5F3FF`, Knowledge `#D97706`/`#FFFBEB`, CRM `#0891B2`/`#ECFEFF`. Dark mode retained as an opt-in navy-family theme rebuilt to dark-UI best practice: elevation ladder `#0B1120`→`#232338`, off-white `#E9EAF2` text, neutral white/12 hairlines with orange only on interactive emphasis, desaturated 400-series accents — light is the default. |

---

## Next Phase

No phase is currently in progress. Define the next feature area here before starting work.

Candidate areas (not prioritized):

- Task attachments UI (storage bucket `task-attachments` created in migration 006; no upload UI yet)
- Recurring task generation (schema has `is_recurring` / `recurrence_rule`; no recurrence engine yet)
- Analytics deep-dive: per-category spending charts, habit streak history
- AI Assistant CRUD — full create/read/update/delete for all user-facing entities (tasks, goals, habits, transactions, contacts and related tables) via AI tools; excludes ai_conversations, ai_memory, push_subscriptions
- Multimodal chat input — image, file, and audio upload support in the AI assistant via Supabase Storage with per-user RLS
- Habit UX improvements — revised creation form with time/reminder settings, repeat-frequency dropdown, icon removal, green tick / red cross done/not-done marking on habit cards, read-time auto-fail logic for unmarked past days

---

## Shipped History

| Phase | Feature | Date | Key files |
| --- | --- | --- | --- |
| 1 | Push notification infrastructure | 2026-06-26 | `lib/types/database.ts` (PushSubscriptionRow), `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `public/sw.js`, `app/offline/page.tsx`, `public/manifest.webmanifest` |
| 2 | Push delivery via Supabase Edge Function | 2026-06-26 | `supabase/functions/send-push/index.ts` (Deno, SubtleCrypto VAPID), `GET /api/push/vapid-public-key` |
| 3 | Push notification settings UI | 2026-06-26 | `lib/hooks/use-push-subscription.ts`, `app/(app)/settings/page.tsx` |
| 4 | AI-assisted development framework | 2026-06-26 | `.claude/skills/` (4 skills), `.claude/commands/` (4 commands), `get_analytics` AUTO_TOOL, 151 tests at 97.21% coverage |
| 5 | RISE design system implementation | 2026-06-28 | `app/globals.css` (RISE spec tokens + type utilities + glassmorphism classes), `app/layout.tsx` (Lexend + JetBrains Mono via `next/font/google`), `components/layout/bottom-nav.tsx` (5-slot with center AI FAB), `components/layout/sidebar.tsx`, `components/layout/topbar.tsx`, all 8 module pages (font-bold → spec weights), `.claude/skills/frontend-design.md` |
| 6 | Security hardening | 2026-06-29 | `supabase/migrations/007_rls_hardening.sql` (RLS policies strengthened on all 20 tables), `app/api/ai/chat/route.ts` (HMAC-signed approval tokens with 5-min expiry, timing-safe comparison) |
| 7 | AI tools expansion to full CRUD + multimodal chat | 2026-06-30 | `lib/ai/tools.ts` (58 AUTO + 17 APPROVAL = 75 tools), `lib/ai/execute-tool.ts` (handlers for all new tools), `supabase/migrations/008_chat_attachments.sql` (chat-attachments bucket), `lib/types/database.ts` (ChatAttachment types), `app/api/ai/chat/route.ts` (image download + Gemini vision injection) |
| 8 | Habit UX overhaul + reminder_time | 2026-07-01 | `supabase/migrations/009_habit_reminder_time.sql` (adds `reminder_time` column), `lib/types/database.ts` (HabitRow updated), `app/(app)/wellness/page.tsx` (form overhaul, card marking, streak logic, sort by reminder_time) |
| 9 | Payment methods / wallets | 2026-07-01 | `supabase/migrations/010_payment_methods.sql`, `011_fix_payment_methods.sql`, `lib/types/database.ts` (PaymentMethodRow, TransactionRow with transfer/adjustment types + FK columns), `app/(app)/finance/` (wallet cards, live balance tracking) |
| 10 | Light-first orange design system | 2026-07-04 | `app/globals.css` (full token rewrite: brand/module/status/priority tokens, navy dark mode, `.card`/`.card-hover`, `brand-pulse`, graph-paper), `app/layout.tsx` (viewport theme colors), `app/(app)/layout.tsx` (graph-bg shell), `components/ui/` (button/card/input/textarea/badge/tabs/dialog/sheet — 4/8/12/16px radii, 1.5px borders, 44px buttons, bold CTAs), `components/layout/` (sidebar/topbar/bottom-nav), all 8 module pages + dashboard + login (slide-up/stagger/card-hover/mod-tint swaps, page-glow and glassmorphism removed), `components/assistant/` (card-style bubbles, orange recording pulse), `components/analytics/` (6 chart palettes), `.claude/skills/frontend-design/` (module token table, AI resolution, tokens.css Inter-only mono) |
| 11 | RISE bee logo rollout + icon pipeline | 2026-07-04 | `scripts/generate-icons.mjs` (sharp pipeline from `public/rise-ai.png` master), `public/` (icon-192/512, maskable pair, apple-touch-icon, rise-logo transparent mark), `app/icon.png` (favicon), `public/manifest.webmanifest` (orange theme, maskable entries), `public/sw.js` (rise-v4, fixed icon paths), `components/brand/rise-logo.tsx` (RiseLogo with mono/keepColor variants), sidebar/bottom-nav/nav-items/assistant/dashboard/settings (Sparkles → bee), `app/globals.css` (bee-float), lint warnings cleared |
