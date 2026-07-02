# RISE — Personal AI OS

> A single-user personal operating system that replaces Todoist, a finance app, a habit tracker, a journal, a CRM, and a knowledge base — unified in one dark-first web app, powered by an AI assistant that can actually *do* things.

**Live:** [rise.muhammedajmal.com](https://rise.muhammedajmal.com) · [rise-aid-plug.vercel.app](https://rise-aid-plug.vercel.app)

---

## What is RISE?

RISE is a personal productivity OS built for a single user. Instead of juggling five apps, everything lives in one place — tasks, money, habits, goals, relationships, notes — and a Gemini-powered AI assistant can read all of it and take real actions on your behalf.

The AI isn't just a chatbot. It can create a task, log an expense, mark a habit done, update a goal, search your notes, and more — with a two-tier safety system: low-risk actions execute automatically; destructive ones pause and ask for explicit approval before running.

---

## Modules

| Module | What it does |
| --- | --- |
| **Dashboard** | Daily overview — tasks due, habits to log, goal progress, and recent transactions at a glance |
| **Productivity** | Tasks with status, priority, due dates, subtasks, tags, attachments, and Projects (color-coded grouping) |
| **Finance** | AED income/expense/transfer ledger with category budgets, debt tracking, and live wallet balances |
| **Wellness** | Habit tracker with daily/weekly schedules, reminder times, streak logic, and 30-day progress view |
| **Goals** | Goal cards with % progress slider, milestone tracking, and journal entries with mood/energy ratings |
| **CRM** | Contacts with pipeline stages, deal values, interaction logs (call/email/meeting), and follow-up tracking |
| **Knowledge** | Rich-text notes (Tiptap), document metadata, and links — all searchable by the AI |
| **AI Assistant** | Gemini 2.5 Flash chat with SSE streaming, pgvector memory, file/image uploads, and 75 executable tools |
| **Analytics** | Recharts dashboards aggregating cross-module data |

---

## AI Tool System

The assistant runs 75 tools across every module — split into two tiers:

**AUTO_TOOLS (58)** — execute immediately without user confirmation:

| Group | Tools |
| --- | --- |
| Tasks | `create_task` · `list_tasks` · `update_task` · `complete_task` |
| Projects | `list_projects` · `create_project` · `update_project` |
| Goals & Milestones | `create_goal` · `update_goal` · `complete_goal` · `create_milestone` · `complete_milestone` |
| Habits | `create_habit` · `log_habit` · `list_habits` · `update_habit` · `delete_habit_log` |
| Finance | `log_expense` · `log_income` · `list_transactions` · `list_payment_methods` |
| Budgets & Debts | `create_budget` · `update_budget` · `create_debt` · `list_debts` |
| CRM | `add_contact` · `update_contact` · `create_interaction` · `list_interactions` |
| Knowledge | `add_note` · `update_note` · `create_document` · `create_link` |
| Goals / Journal | `create_journal_entry` · `create_review` · `create_focus_session` |
| Analytics | `get_daily_briefing` · `get_analytics` · `search_data` |

**APPROVAL_TOOLS (17)** — stream pauses, a confirmation banner appears, user approves before execution:

`delete_task` · `bulk_complete_tasks` · `delete_project` · `delete_goal` · `delete_habit` · `update_transaction` · `delete_transaction` · `delete_budget` · `delete_debt` · `delete_contact` · `delete_interaction` · `delete_note` · `delete_document` · `delete_journal_entry` · `delete_review` + 2 more

---

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16.2.9 (App Router) |
| Language | TypeScript strict — no `any`, no type assertions |
| Styling | Tailwind CSS v4 + shadcn/ui (`@base-ui/react`) + Lucide icons |
| AI | Google Gemini 2.5 Flash via `@google/genai` (SSE streaming + function calling) |
| Embeddings | Voyage AI `voyage-3` (1024-dim pgvector) — keyword ILIKE fallback when key absent |
| Database | Supabase — Postgres + pgvector + Row Level Security (21 tables) |
| Auth | Google OAuth via Supabase; single-user gate via `ALLOWED_USER_EMAIL` |
| PWA | Service worker (`sw.js`) + Web Push via Supabase Edge Function (Deno, SubtleCrypto VAPID) |
| Rich text | Tiptap (knowledge module) |
| Charts | Recharts |
| Testing | Vitest 4 + Testing Library (265 tests) |
| Hosting | Vercel (Fluid Compute) |

---

## Design System

RISE uses a locked dark-first "cockpit" UI:

- **Surfaces:** 4-level elevation — `#0E0E11` → `#17171C` → `#1F1F27` → `#2A2A35`
- **AI accent:** `#7C5CFC` (purple) — used only for AI-active states, max 10% of surface
- **Typography:** Lexend (headings, max weight 600) · IBM Plex Sans (body) · JetBrains Mono (metrics/data)
- **Module colors:** Tasks `#60a5fa` · Finance `#34d399` · Wellness `#fb7185` · Goals `#a78bfa` · Knowledge `#fbbf24` · CRM `#22d3ee`
- **Layout:** 5-slot bottom nav on mobile (`[Home][Tasks][AI-FAB][Finance][More]`) · sticky sidebar on desktop (64px collapsed / 224px expanded)
- **Motion:** Spring-based with `prefers-reduced-motion` support; `.tappable` scale feedback on touch

---

## Database Schema

21 tables — all RLS-enforced on `user_id = auth.uid()`, migrations 001–011:

```text
projects · tasks · goals · milestones · reviews · journal_entries
payment_methods · transactions · budgets · debts
habits · habit_logs · focus_sessions
contacts · interactions
notes · documents · links
ai_conversations · ai_memory (pgvector 1024-dim)
push_subscriptions
```

---

## AI Chat Endpoint

```http
POST /api/ai/chat
Content-Type: application/json

Body: {
  messages: { role: "user" | "model", content: string }[],
  approvedTool?: { name: string, input: object }
}

SSE events:
  { type: "text",              text: string }
  { type: "tool_result",       tool: string, result: { success, message, data? } }
  { type: "approval_required", tool: { id, name, input } }
  { type: "error",             message: string }
  data: [DONE]
```

Destructive tool calls halt streaming and emit `approval_required`. The client shows a `<ConfirmDialog>`; on approval a second POST fires with `approvedTool` set.

---

## Local Development

### Prerequisites

- Node.js 20+
- Supabase project (free tier works)
- Google AI (Gemini) API key

### Setup

```bash
git clone https://github.com/a-muhammed-ajmal/rise
cd rise
npm install
cp .env.example .env.local   # fill in your keys
```

### Environment variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
GEMINI_API_KEY=
VOYAGE_API_KEY=        # optional — keyword fallback activates when absent

# Web Push
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# Auth gate
ALLOWED_USER_EMAIL=    # only this email can log in
```

Apply migrations 001–011 in your Supabase SQL editor (in order), then:

```bash
npm run dev   # Turbopack dev server → http://localhost:3000
```

### Commands

```bash
npm run dev            # Dev server (Turbopack)
npm run build          # Production build — must exit 0
npm run lint           # ESLint
npm run test           # Vitest single run
npm run test:watch     # Vitest watch mode
npm run test:coverage  # Coverage report for lib/**
```

---

## Architecture Notes

- **Middleware** lives in `proxy.ts` at the project root — Next.js 16 convention (not `middleware.ts`).
- **RLS pattern** — every table enforces `user_id = auth.uid()`; no cross-user data access is possible.
- **AI memory** — user messages embedded via Voyage AI and stored in `ai_memory` (pgvector). Top-10 memories retrieved by cosine similarity (`threshold: 0.7`) and injected into each system prompt. ILIKE keyword fallback activates when `VOYAGE_API_KEY` is absent.
- **Realtime** — `use-tasks.ts` and `use-projects.ts` subscribe to Supabase Realtime channels for live UI updates; channels are cleaned up on unmount.
- **PWA** — installable; service worker uses stale-while-revalidate for assets, network-only for `/api/**`, and `/offline` fallback for navigation. Push notifications delivered hourly via Supabase Edge Function.
- **Security** — HMAC-signed approval tokens with 5-minute expiry prevent replay attacks on destructive tool calls. All server secrets (`GEMINI_API_KEY`, `VOYAGE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`) are never exposed to client components.
- **Locale** — AED currency throughout (`Intl.NumberFormat('en-AE', { currency: 'AED' })`), DD/MM/YYYY dates, 12-hour time — all via `lib/format.ts`.

---

## Deployment

Deployed on Vercel. Push to `main` triggers a production deploy.

Set environment variables via the Vercel dashboard or `vercel env pull`. Supabase migrations must be applied manually in the SQL editor — never auto-migrated in CI.

---

## Project Stats

| Metric | Value |
| --- | --- |
| Test count | 265 passing |
| DB tables | 21 (RLS on all) |
| AI tools | 75 (58 AUTO + 17 APPROVAL) |
| Migrations | 11 (001–011) |
| Last phase | Phase 9 — Payment methods / wallets (2026-07-01) |
