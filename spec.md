# SPEC.md — RISE Personal OS

Living specification for the RISE codebase. Describes what is currently implemented, what architectural decisions were made, and what constraints govern future development. CLAUDE.md governs code conventions.

---

## Current State Snapshot

| Metric | Value |
| --- | --- |
| Test count | 151 passing |
| Line coverage | 97.21% on `lib/**` |
| Migrations | 6 (001–006) |
| DB tables | 20 (19 core + push_subscriptions) |
| AI tools | 12 AUTO + 3 APPROVAL = 15 total |
| Last feature shipped | Phase 4 — AI dev tooling (2026-06-26) |

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

### Typography

- Font families: IBM Plex Sans (body/headings) and IBM Plex Mono (numeric/data) via Next.js `localFont`.
- Type scale: fluid clamp utilities `text-step--1` through `text-step-4` defined in `app/globals.css`.
- Headings: `font-weight: 700`, `letter-spacing: -0.02em`, `text-wrap: balance`.

### Color system

- Primary palette: violet (`#6D28D9` light / `#7C3AED` dark). All shadcn tokens are violet-derived.
- Module accent tokens (each has a `-soft` background variant):

| Module | Token | Light hex |
| --- | --- | --- |
| Tasks | `mod-tasks` | `#3b82f6` |
| Finance | `mod-finance` | `#10b981` |
| Wellness | `mod-wellness` | `#f43f5e` |
| Goals | `mod-goals` | `#8b5cf6` |
| Knowledge | `mod-knowledge` | `#f59e0b` |
| CRM | `mod-crm` | `#06b6d4` |
| AI | `mod-ai` | `#6D28D9` |

- Dark mode: `.dark` class on `<html>`, toggled via `lib/hooks/use-theme.tsx`. Preference persisted to `localStorage` key `rise-theme`; falls back to `prefers-color-scheme`.

### Animation system

- Entry: `animate-rise-in` — 600ms ease-out fade + 12px Y translate.
- Stagger delays: `.stagger-1` (0ms) through `.stagger-6` (300ms, 60ms increments).
- Reduced motion: `@media (prefers-reduced-motion: reduce)` collapses all durations to `0.01ms`.
- Motion tokens: `--dur-fast` (120ms), `--dur-normal` (220ms), `--dur-slow` (400ms), `--dur-reveal` (600ms).

### Layout / responsive

- Breakpoint: `md` (768px). Below → `BottomNav` (mobile bottom tab bar with Sheet overflow). Above → `Sidebar` (sticky, 64px collapsed / 224px expanded).
- Cards: `--radius: 1rem` (16px). Interactive cards use `.card-interactive` hover-lift class.
- Floating actions: `.fab` utility with shadow + spring hover.

### Accessibility

- Focus ring: 2px solid `var(--color-focus)` at 2px offset on `:focus-visible`.
- All destructive actions gated behind `<ConfirmDialog>` — never `window.confirm`.

---

## Performance Targets

| Metric | Target |
| --- | --- |
| Test coverage | ≥ 85% line on `lib/**` excluding `lib/types/` (current: 97.21%) |
| Build | `next build` exits 0; 0 TypeScript errors |
| Lint | ESLint exits 0; 0 warnings |
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

**AUTO_TOOLS** (execute immediately):
`create_task` · `list_tasks` · `complete_task` · `log_expense` · `log_income` · `log_habit` · `create_goal` · `add_note` · `add_contact` · `get_daily_briefing` · `search_data` · `get_analytics`

**APPROVAL_TOOLS** (SSE pauses, user clicks Approve, second POST executes):
`delete_task` · `bulk_complete_tasks` · `delete_note`

> Tool schemas use Google GenAI's `FunctionDeclaration` format (`Type.OBJECT`, `Type.STRING`, etc.) from `@google/genai` — not the Anthropic `input_schema` format.

### Data model (20 Supabase tables, all RLS-enforced on `user_id = auth.uid()`, migrations 001–006)

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
transactions        id, type(income|expense), amount, category, description, date,
                    payment_method, tags
budgets             id, category, amount, period, period_start, period_end
debts               id, creditor, type(i_owe|they_owe), amount, description, due_date, paid_at
habits              id, name, description, frequency, target_days(int[0-6]), color, icon, active
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
- `npm run test:coverage` reports ≥ 85% line coverage over `lib/**` (excluding `lib/types/`). Current: 151 tests, 97.21%.
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

---

## Next Phase

No phase is currently in progress. Define the next feature area here before starting work.

Candidate areas (not prioritized):

- Task attachments UI (storage bucket `task-attachments` created in migration 006; no upload UI yet)
- Recurring task generation (schema has `is_recurring` / `recurrence_rule`; no recurrence engine yet)
- AI tool expansions: `update_task`, `update_goal`, `log_journal`
- Analytics deep-dive: per-category spending charts, habit streak history

---

## Shipped History

| Phase | Feature | Date | Key files |
| --- | --- | --- | --- |
| 1 | Push notification infrastructure | 2026-06-26 | `lib/types/database.ts` (PushSubscriptionRow), `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `public/sw.js`, `app/offline/page.tsx`, `public/manifest.webmanifest` |
| 2 | Push delivery via Supabase Edge Function | 2026-06-26 | `supabase/functions/send-push/index.ts` (Deno, SubtleCrypto VAPID), `GET /api/push/vapid-public-key` |
| 3 | Push notification settings UI | 2026-06-26 | `lib/hooks/use-push-subscription.ts`, `app/(app)/settings/page.tsx` |
| 4 | AI-assisted development framework | 2026-06-26 | `.claude/skills/` (4 skills), `.claude/commands/` (4 commands), `get_analytics` AUTO_TOOL, 151 tests at 97.21% coverage |
