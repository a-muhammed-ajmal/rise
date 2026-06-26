# SPEC.md — RISE Personal OS

Retroactive spec — written after the initial build. Covers what is already live, not what is planned.

---

## Objective

RISE is a single-user personal operating system that replaces Todoist, a finance app, a habit tracker, a journal, a CRM, and a knowledge base in one app. The distinguishing feature is an AI assistant (Claude `claude-sonnet-4-6`) that can *read all user data* and *execute real actions* inside the system — creating tasks, logging expenses, logging habits, searching notes — via a two-tier tool system: auto-execute for low-risk operations, approval-gated for destructive ones.

Built for one person (UAE-based): AED currency, DD/MM/YYYY dates, 12-hour time.

---

## Modules

| Module | Core capability |
| --- | --- |
| **Productivity** | Tasks with status (inbox / todo / in_progress / done), priority (low → urgent), due dates, recurring flag, Projects (color-coded grouping) |
| **Finance** | Income and expense transactions in AED; category budgets; debt ledger (i_owe / they_owe) |
| **Wellness** | Habit tracking with daily / weekly / custom schedules, 30-day streak view, focus session log |
| **Goals** | Goal cards with % progress slider and milestones; Journal tab with mood + energy rating (1–5) |
| **CRM** | Contacts with pipeline stage (new → won / lost), deal values, interaction log (call / email / meeting / message / other), follow-up date tracking |
| **Knowledge** | Notes (plain text, tags, linkable to task / goal / contact), Document metadata, Links |
| **Analytics** | Recharts dashboards aggregating cross-module data |
| **AI Assistant** | SSE-streaming chat with context injection (today's tasks, habits, goals, pgvector memories); `?q=` deep-link; quick-prompt shortcuts; approval banner for destructive tools |

---

## Inputs / Outputs

### AI chat endpoint

```http
POST /api/ai/chat
Body: { messages: MessageParam[], approvedTool?: { name, input } }

SSE events:
  { type: "text",             text: string }
  { type: "tool_result",      tool: string, result: { success, message, data? } }
  { type: "approval_required", tool: { id, name, input } }
  { type: "error",            message: string }
  data: [DONE]
```

Second leg for approved tools: same endpoint with `approvedTool` set, returns `Response.json({ type: "tool_result", result })`.

### AI tool set

**AUTO_TOOLS** (execute immediately):
`create_task` · `list_tasks` · `complete_task` · `log_expense` · `log_income` · `log_habit` · `create_goal` · `add_note` · `add_contact` · `get_daily_briefing` · `search_data`

**APPROVAL_TOOLS** (SSE pauses, user clicks Approve, second POST executes):
`delete_task` · `bulk_complete_tasks` · `delete_note`

### Data model (19 Supabase tables, all RLS-enforced on `user_id = auth.uid()`)

```text
projects          id, name, description, status(active|completed|archived), color
tasks             id, title, description, status, priority, due_date, completed_at,
                  is_recurring, recurrence_rule, project_id
goals             id, title, description, category, target_date, status, progress(0-100)
milestones        id, goal_id, title, due_date, completed_at
reviews           id, type, period_start, period_end, content(Json), mood, energy
journal_entries   id, date(unique/day), content, mood(1-5), energy(1-5), tags
transactions      id, type(income|expense), amount, category, description, date,
                  payment_method, tags
budgets           id, category, amount, period, period_start, period_end
debts             id, creditor, type(i_owe|they_owe), amount, description, due_date, paid_at
habits            id, name, description, frequency, target_days(int[0-6]), color, icon, active
habit_logs        id, habit_id, logged_date, completed, note
focus_sessions    id, task_id, duration_minutes, started_at, ended_at, notes
contacts          id, name, email, phone, company, role, type, stage, deal_value,
                  notes, tags, last_contacted_at
interactions      id, contact_id, type, notes, date, follow_up_date
notes             id, title, content, tags, linked_to_type, linked_to_id
documents         id, name, file_path, file_type, file_size, tags, notes
links             id, url, title, description, tags
ai_conversations  id, messages(Json)
ai_memory         id, content, metadata(Json), embedding(float[1024])
```

pgvector function: `match_memories(query_embedding, match_user_id, match_count?, match_threshold?)` returns `{ id, content, metadata, similarity }[]`.

### AI memory

User messages embedded via Voyage AI (1024-dim) and stored in `ai_memory`. On each request, top-10 memories retrieved by cosine similarity and injected into the system prompt. Keyword ILIKE fallback when `VOYAGE_API_KEY` is absent. Conversation compaction runs server-side on long threads (fire-and-forget).

---

## Constraints

- **Single user**: `proxy.ts` middleware enforces `ALLOWED_USER_EMAIL`; every Supabase table enforces `user_id = auth.uid()` via RLS.
- **Auth**: Google OAuth via Supabase. `app/(app)/layout.tsx` (server component) redirects unauthenticated sessions to `/login`.
- **Server-only secrets**: `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must never reach client components.
- **Approval gate**: No `APPROVAL_TOOLS` call may auto-execute. The SSE `approval_required` event must surface a UI confirmation before the follow-up POST fires `execute-tool.ts`.
- **Migrations**: `supabase/migrations/` is append-only; changes are applied manually via the Supabase SQL editor.
- **Locale**: All currency via `Intl.NumberFormat('en-AE', { currency: 'AED' })`, all dates/times via `lib/format.ts` — never inline.
- **TypeScript strict**: no `any`, no `.env.local` committed.
- **Middleware name**: Next.js 16 renamed `middleware.ts` → `proxy.ts` at the project root.

---

## Success Criteria

- All 8 module pages render without runtime errors.
- AI assistant streams text and executes approved tool calls end-to-end.
- `npm run build` exits 0 (0 TypeScript errors, 0 lint warnings).
- `npm run test:coverage` reports ≥ 85% line coverage over `lib/**` (excluding `lib/types/`).
- Pushing `main` produces a working Vercel production deployment.

---

## Out of Scope

- Multi-user / team workspaces
- Native mobile apps (iOS / Android)
- Third-party calendar, bank account, or email sync
- Push notifications or outbound email from the app (sending — see Phase 2)
- Voice input for the AI assistant
- Real-time collaborative editing
- Public-facing pages or unauthenticated access beyond `/login`

---

## Phase 1 — Push Notification Infrastructure (Habit Nudges + CRM Follow-ups)

**Status:** In progress

### Phase 1 Objective

Subscription infrastructure for web push: push_subscriptions table (already applied manually), subscribe/unsubscribe routes, SW push handler. Covers both reminder types.

### Phase 1 Deliverables

- lib/types/database.ts — PushSubscriptionRow
- POST /api/push/subscribe, POST /api/push/unsubscribe
- public/sw.js — push + notificationclick handlers

### Phase 1 Out of Scope

- Sending pushes (Phase 2 — Edge Function cron)
- Settings UI / permission flow (Phase 3)
