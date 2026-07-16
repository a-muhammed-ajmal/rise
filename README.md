# RISE — Personal AI OS

> A single-user personal operating system that replaces Todoist, a finance app, a habit tracker, a journal, a CRM, and a knowledge base — unified in one web app, powered by an AI assistant that can actually *do* things.

**Live:** [rise.muhammedajmal.com](https://rise.muhammedajmal.com) · [rise-aid-plug.vercel.app](https://rise-aid-plug.vercel.app)

---

## What is RISE?

RISE is a personal productivity OS built for a single user. Instead of juggling five apps, everything lives in one place — tasks, money, habits, goals, relationships, notes — and a Gemini-powered AI assistant can read all of it and take real actions on your behalf.

The AI isn't just a chatbot. It can create a task, log an expense, mark a habit done, update a goal, search your notes, generate a daily digest, and more — with a two-tier safety system: low-risk actions execute automatically; destructive ones pause and ask for explicit approval before running.

---

## Modules

| Module | What it does |
| --- | --- |
| **Dashboard** | Daily overview — tasks due, habits to log, goal progress, and recent transactions at a glance |
| **Productivity** | Tasks with priority, due dates, subtasks, tags, attachments, and Projects (color-coded grouping). Filter tabs (Today / All / Done / Projects), sort, group, and list / grid / calendar views |
| **Finance** | AED income/expense/transfer ledger with category budgets, debt tracking, and live wallet balances |
| **Wellness** | Habit tracker with daily/weekly schedules, reminder times, streak logic, and 30-day progress view |
| **Goals** | Goal cards with % progress slider, milestone tracking, and journal entries with mood/energy ratings |
| **CRM** | Contacts with pipeline stages, deal values, interaction logs (call/email/meeting), and follow-up tracking |
| **Knowledge** | Rich-text notes (Tiptap), document metadata, and links — all searchable by the AI |
| **AI Assistant** | Gemini 2.5 Flash chat with SSE streaming, pgvector memory, file/image uploads, and 75 executable tools |
| **Analytics** | Recharts dashboards aggregating cross-module data — finance has Monthly / Daily view toggle |

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

## AI Daily Digest

At **11:59 PM Dubai time** every day, a Vercel cron job fires `POST /api/ai/daily-digest`. The route:

1. Fetches the day's completed tasks, habit logs, transactions, pending tasks, and active goals via the Supabase service-role client
2. Calls Gemini 2.5 Flash to generate a structured markdown digest (wins, finance, goals pulse, upcoming tasks, one insight)
3. Saves the result as a note tagged `daily-digest` in the Knowledge module

To enable: set `CRON_SECRET` in Vercel environment variables. The digest note appears in Knowledge the next morning.

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
| Testing | Vitest 4 + Testing Library (268 tests) |
| Hosting | Vercel (Fluid Compute) |

---

## Design System

RISE uses a locked light-first orange brand system (full spec in `.claude/skills/frontend-design/`):

- **Brand:** `#FF6535` orange — CTAs, accents, focus rings; `#D6450F` for orange text on white (AA); `#FFF0EB` tint for chips/badges
- **Surfaces:** light-first — `#FFFFFF` base · `#F9FAFB` paper · navy `#1A1A2E` for dark sections; opt-in dark mode uses the navy family (`#0B1120` / `#1A1A2E`)
- **Typography:** Inter only (400–800); page titles 700, headings 600; 11px eyebrow labels in brand orange
- **Borders:** always visible at rest — `1.5px rgba(26,26,46,0.16)` on cards, orange `rgba(255,101,53,0.50)` on hover; graph-paper background signature (40×40px grid)
- **Module colors (text + tint pairs):** Tasks `#2563EB` · Finance `#059669` · Wellness `#BE123C` · Goals `#7C3AED` · Knowledge `#D97706` · CRM `#0891B2` — AI inherits the brand orange
- **Layout:** 5-slot bottom nav on mobile (`[Home][Tasks][AI-FAB][Finance][More]`) · sticky sidebar on desktop (64px collapsed / 224px expanded)
- **Motion:** 150–400ms tokens, transform/opacity only, `prefers-reduced-motion` support; `.tappable` scale feedback on touch

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

## Connect to Claude (MCP Connector)

RISE ships a **remote MCP server** at `POST /api/mcp` so Claude can read and act on your
RISE data directly. It exposes only the **60 `AUTO_TOOLS`** — the 17 destructive
`APPROVAL_TOOLS` are never reachable over MCP. It accepts **two** kinds of auth — a static
**bearer token** (`MCP_ACCESS_TOKEN`, for Claude Code) or **OAuth 2.1** (for claude.ai web /
Desktop). The endpoint returns `401` for any request without a valid one.

- **Endpoint:** `https://rise.muhammedajmal.com/api/mcp`
- **Header Claude must send:** `Authorization: Bearer <MCP_ACCESS_TOKEN>`

Set `MCP_ACCESS_TOKEN` (a long random string, e.g. `openssl rand -hex 32`) in your Vercel
env vars, then give Claude the **same** value.

### Claude Code (CLI) — recommended; supports the bearer token directly

```bash
claude mcp add --transport http rise \
  https://rise.muhammedajmal.com/api/mcp \
  --header "Authorization: Bearer <MCP_ACCESS_TOKEN>" \
  --scope user
```

`--scope user` makes it available across all your projects while keeping the token out of
version control. (Avoid `--scope project`, which would write the token into a committed
`.mcp.json`.) The equivalent `~/.claude.json` entry:

```json
{
  "mcpServers": {
    "rise": {
      "type": "http",
      "url": "https://rise.muhammedajmal.com/api/mcp",
      "headers": { "Authorization": "Bearer <MCP_ACCESS_TOKEN>" }
    }
  }
}
```

### Claude.ai (web) & Claude Desktop — OAuth 2.1

RISE is a full OAuth 2.1 provider for `/api/mcp`, so it connects **natively** — no bridge:

1. **One-time setup:** run migration `015_oauth.sql` in the Supabase SQL editor, and set
   `MCP_OAUTH_CLIENT_ID` (any id) + `MCP_OAUTH_CLIENT_SECRET` (a long random secret) in Vercel.
2. In Claude.ai: **Customize → Connectors → + → Add custom connector** → URL
   `https://rise.muhammedajmal.com/api/mcp` → **Advanced settings** → paste the same client
   id + secret → **Add**.
3. Claude opens RISE's authorize page → sign in with your Google (`ALLOWED_USER_EMAIL`)
   account → **Approve**. The tools load automatically.

Claude Desktop uses the same custom-connector flow. (A bearer-only alternative for Desktop
is the [`mcp-remote`](https://github.com/geelen/mcp-remote) bridge in
`claude_desktop_config.json`.)

Under the hood: PKCE (S256), single-use 60-second codes, rotating refresh tokens, opaque
tokens hashed at rest, and RFC 8707 audience binding — see `lib/ai/mcp-oauth.ts`.

> **Keep your tokens secret** — anyone holding `MCP_ACCESS_TOKEN` or the OAuth client secret
> can act on your RISE data as you. To rotate: change the value in Vercel, then update your
> Claude connector config.

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

# Cron security (optional but recommended)
CRON_SECRET=           # random secret; set in Vercel env vars too

# MCP connector (Claude)
MCP_ACCESS_TOKEN=          # bearer token for Claude Code (/api/mcp)
MCP_OAUTH_CLIENT_ID=       # OAuth client for claude.ai web / Desktop (any id)
MCP_OAUTH_CLIENT_SECRET=   # OAuth client secret (long random string)
```

Apply migrations 001–011 in your Supabase SQL editor (in order), then:

```bash
npm run dev   # Turbopack dev server → http://localhost:3000
```

### Supabase Storage Buckets

Create these buckets in **Supabase Dashboard → Storage**:

| Bucket | Visibility | Purpose |
| --- | --- | --- |
| `task-attachments` | Public | File attachments on tasks |
| `chat-attachments` | Public | File/image uploads in AI chat |
| `avatars` | Public | User profile photos |

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
- **Locale** — AED currency throughout (`Intl.NumberFormat('en-AE', { currency: 'AED' })`), DD/MM/YYYY dates, 12-hour time — all via `lib/format.ts`. Timezone and format preferences stored in Supabase user_metadata and configurable in Settings.
- **Profile** — Display name and avatar photo stored in Supabase auth `user_metadata` (`full_name`, `avatar_url`). Google OAuth photo is used by default; custom photos can be uploaded to the `avatars` storage bucket.

---

## Deployment

Deployed on Vercel. Push to `main` triggers a production deploy.

Set environment variables via the Vercel dashboard or `vercel env pull`. Supabase migrations must be applied manually in the SQL editor — never auto-migrated in CI.

The Vercel cron (`59 19 * * *` UTC = 11:59 PM Dubai) fires the daily digest endpoint automatically on Pro/Enterprise plans. On Hobby, set up an external cron (e.g. cron-job.org) to hit `POST /api/ai/daily-digest` with `Authorization: Bearer <CRON_SECRET>`.

---

## Project Stats

| Metric | Value |
| --- | --- |
| Test count | 318 passing |
| DB tables | 25 (RLS on all) |
| AI tools | 77 (60 AUTO + 17 APPROVAL) |
| Migrations | 16 (001–016) |
| Last phase | Phase 12 — Persistent chat history, real memory, user profile, remember/recall tools |
