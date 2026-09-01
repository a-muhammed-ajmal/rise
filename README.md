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
| **Productivity** | Tasks with priority, due dates, subtasks, tags, attachments. Filter tabs (Today / All / Done), sort, group, and list / grid / calendar views |
| **Projects** | Dedicated workspace with 8 fixed category tabs (personal, professional, financial, wellness, relationship, vision, legal, default); project cards per category; task drill-down per project; Area field on tasks filters the project dropdown |
| **Finance** | AED income/expense/transfer ledger with category budgets, debt tracking, and live wallet balances |
| **Wellness** | Habit tracker with daily/weekly schedules, reminder times, streak logic, and 30-day progress view |
| **Goals** | Goal cards with % progress slider, milestone tracking, and journal entries with mood/energy ratings |
| **CRM** | Contacts with pipeline stages, deal values, interaction logs (call/email/meeting), and follow-up tracking |
| **Knowledge** | Rich-text notes (Tiptap), document metadata, and links — all searchable by the AI |
| **AI Assistant** | Gemini 2.5 Flash chat with SSE streaming, pgvector memory, file/image uploads, and 82 executable tools |
| **Analytics** | Recharts dashboards aggregating cross-module data — finance has Monthly / Daily view toggle |

---

## AI Tool System

The assistant runs 84 tools across every module — split into three tiers:

**AUTO_TOOLS (61)** — execute immediately without user confirmation:

| Group | Tools |
| --- | --- |
| Tasks | `create_task` · `list_tasks` · `update_task` · `complete_task` |
| Projects | `list_projects` · `create_project` · `update_project` |
| Goals | `list_goals` · `create_goal` · `update_goal` · `complete_goal` |
| Milestones | `list_milestones` · `create_milestone` · `update_milestone` · `complete_milestone` |
| Habits | `create_habit` · `list_habits` · `log_habit` · `update_habit` |
| Finance | `log_expense` · `log_income` · `list_transactions` · `list_payment_methods` |
| Budgets | `list_budgets` · `create_budget` · `update_budget` |
| Debts | `list_debts` · `create_debt` |
| Contacts | `list_contacts` · `add_contact` · `update_contact` |
| Interactions | `list_interactions` · `create_interaction` · `update_interaction` |
| Notes | `add_note` · `list_notes` · `update_note` |
| Documents | `list_documents` · `create_document` · `update_document` |
| Links | `list_links` · `create_link` · `update_link` |
| Journal | `list_journal_entries` · `create_journal_entry` · `update_journal_entry` |
| Reviews | `list_reviews` · `create_review` · `update_review` |
| Focus Sessions | `list_focus_sessions` · `create_focus_session` · `update_focus_session` |
| Memory | `remember_user_fact` · `recall_memories` |
| Analytics | `get_daily_briefing` · `get_analytics` · `search_data` |
| WhatsApp | `set_whatsapp_reminders` · `list_whatsapp_reminders` |
| Recycle bin | `list_deleted` · `restore_record` |

**REVERSIBLE_TOOLS (17)** — soft deletes. Confirmed in the app chat, but exposed over MCP because every one of them can be undone with `restore_record`:

`delete_task` · `delete_project` · `delete_goal` · `delete_milestone` · `delete_habit` · `delete_habit_log` · `delete_transaction` · `delete_budget` · `delete_debt` · `delete_contact` · `delete_interaction` · `delete_note` · `delete_document` · `delete_link` · `delete_journal_entry` · `delete_review` · `delete_focus_session`

**APPROVAL_TOOLS (6)** — stream pauses, a confirmation banner appears, user approves before execution:

`purge_record` · `bulk_delete_records` · `forget_user_fact` · `bulk_complete_tasks` · `update_transaction` · `update_debt`

The tiers split on **MCP reach, not the in-app gate** — REVERSIBLE and APPROVAL both prompt via `ConfirmDialog` in chat. What separates them is that a soft delete is recoverable, which is what makes it safe on a transport with no confirmation UI. Everything irreversible stays in APPROVAL and is never reachable over MCP.

`log_expense` and `log_income` are AUTO, but the chat route escalates them to the same signed-approval flow when the amount exceeds AED 500 or the payload is ambiguous — see `lib/ai/financial-safety.ts`.

---

## AI Daily Digest

At **11:59 PM Dubai time** every day, a Vercel cron job fires `POST /api/ai/daily-digest`. The route:

1. Fetches the day's completed tasks, habit logs, transactions, pending tasks, and active goals via the Supabase service-role client
2. Calls Gemini 2.5 Flash to generate a structured markdown digest (wins, finance, goals pulse, upcoming tasks, one insight)
3. Saves the result as a note tagged `daily-digest` in the Knowledge module (inserted, or updated in place if the day's digest already exists)

`CRON_SECRET` is required — the route authenticates on `Authorization: Bearer $CRON_SECRET` only, and returns `503` when the secret is missing. The `x-vercel-cron` header is never accepted as proof of a cron run: it is caller-controlled, so trusting it would let anyone trigger service-role reads and Gemini spend.

---

## WhatsApp Reminders

An hourly Supabase Edge Function (`supabase/functions/send-whatsapp/`) delivers
habit nudges, CRM follow-ups and task-due reminders over the Meta WhatsApp Cloud
API. Configure recipients from chat with `set_whatsapp_reminders`; inspect
delivery with `list_whatsapp_reminders`.

**Business-initiated messages require an approved template.** A reminder is
business-initiated by definition, so this needs a Meta developer account, a
WhatsApp Business Account, a permanent system-user token
(`whatsapp_business_messaging` + `whatsapp_business_management` +
`business_management`) and an approved template with exactly one body variable.
Meta answers `200` and silently drops a message whose template does not match,
which is why every attempt is recorded in `whatsapp_log`.

**Idempotency.** The function runs hourly, but a task due today matches on every
run. Before calling Meta it claims a slot in `whatsapp_log`, guarded by a unique
index on `(user_id, reminder_type, coalesce(entity_id, sentinel), dedup_key)`.
A `23505` means the reminder already went out for that window, so it is skipped.
Without the claim you would get the same reminder 24 times a day.

**Scheduling is on Supabase, not Vercel** — Vercel Hobby cron is limited to
roughly once a day, which is useless for hourly reminders.

Not scheduled through `pg_cron`: set the cadence under
**Dashboard → Edge Functions → send-whatsapp → Schedule**.


## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16.3.0 (App Router) |
| Language | TypeScript strict — no `any`, no type assertions |
| Styling | Tailwind CSS v4 + shadcn/ui (`@base-ui/react`) + Lucide icons |
| AI | Google Gemini 2.5 Flash via `@google/genai` (SSE streaming + function calling) |
| Embeddings | Voyage AI `voyage-3` (1024-dim pgvector) — keyword ILIKE fallback when key absent |
| Database | Supabase — Postgres + pgvector + Row Level Security (26 tables) |
| Auth | Google OAuth via Supabase; single-user gate via `ALLOWED_USER_EMAIL` |
| PWA | Service worker (`sw.js`) + Web Push via Supabase Edge Function (Deno, SubtleCrypto VAPID) |
| Rich text | Tiptap (knowledge module) |
| Charts | Recharts |
| Testing | Vitest 4 + Testing Library (924 tests) |
| Hosting | Vercel (Fluid Compute) |

---

## Design System

RISE uses a locked light-first orange brand system (full spec in `.claude/skills/frontend-design/`):

- **Brand:** `#FF6535` orange — accents, borders, icon fills, focus rings; `#C2410C` for filled button/FAB surfaces with white text (raw `#FF6535` is only 2.93:1 there — fails AA); `#CC4400` for orange text on white (AA 4.8:1); `#FFF0EB` tint for chips/badges
- **Surfaces:** light-first — `#FFFFFF` base · `#F9FAFB` paper · navy `#1A1A2E` for dark sections; opt-in dark mode uses the navy family (`#0B1120` / `#1A1A2E`)
- **Typography:** Inter only (400–800); page titles 700, headings 600; 11px eyebrow labels in brand orange
- **Borders:** always visible at rest — `1.5px rgba(26,26,46,0.16)` on cards, orange `rgba(255,101,53,0.50)` on hover; graph-paper background signature (40×40px grid)
- **Module colors (text + tint pairs):** Tasks `#2563EB` · Finance `#059669` · Wellness `#BE123C` · Goals `#7C3AED` · Knowledge `#D97706` · CRM `#0891B2` — AI inherits the brand orange
- **Layout:** 5-slot bottom nav on mobile (`[Home][Tasks][AI-FAB][Finance][More]`) · sticky sidebar on desktop (64px collapsed / 224px expanded)
- **Motion:** 150–400ms tokens, transform/opacity only, `prefers-reduced-motion` support; `.tappable` scale feedback on touch

---

## Database Schema

26 tables — all RLS-enforced on `user_id = auth.uid()`, migrations 001–022. The 17 tables with a
`delete_*` tool also carry `deleted_at` for soft delete (022):

```text
projects · tasks · goals · milestones · reviews · journal_entries
payment_methods · transactions · budgets · debts · categories
habits · habit_logs · focus_sessions
contacts · interactions
notes · documents · links
ai_conversations · ai_memory (pgvector 1024-dim)
push_subscriptions · user_profile
oauth_authorization_codes · oauth_tokens
task_labels
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
RISE data directly. It exposes **78 tools** — the 61 `AUTO_TOOLS` plus the 17
`REVERSIBLE_TOOLS`, so Claude can delete as well as create, and undo any of it with
`restore_record`. The 6 irreversible `APPROVAL_TOOLS` (`purge_record`,
`bulk_delete_records`, `forget_user_fact`, `bulk_complete_tasks`, `update_transaction`,
`update_debt`) are never reachable over MCP. It accepts **two** kinds of auth — a static
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

Apply migrations 001–022 in your Supabase SQL editor (in order), then:

```bash
npm run dev   # Turbopack dev server → http://localhost:3000
```

### Supabase Storage Buckets

| Bucket | Visibility | Created by | Purpose |
| --- | --- | --- | --- |
| `chat-attachments` | **Private** | migration 020 | File/image/audio uploads in AI chat |
| `task-attachments` | **Private** | migration 020 | File attachments on tasks |
| `avatars` | Public | manual | User profile photos |

Both attachment buckets are private by design: content is served through
short-lived signed URLs, and RLS on `storage.objects` restricts every operation
to objects under the caller's own `<user_uuid>/` path prefix. Making either
bucket public would expose every attachment to anyone holding the object URL.

Create `avatars` manually (**Dashboard → Storage → New bucket**, public) — it
holds profile photos that are intentionally world-readable.

#### Storage policies — Dashboard only

**Storage policies cannot be created from the SQL editor on this project.**
`storage.objects` is owned by `supabase_storage_admin`; the SQL editor runs as
`postgres`, which is not a member of that role. Any `CREATE POLICY`,
`DROP POLICY` or `ALTER TABLE` against it fails with
`ERROR: 42501: must be owner of table objects`. Migration 020 therefore handles
only bucket creation and the private flag (`storage.buckets` does grant
`postgres` DML).

Create these six policies under **Dashboard → Storage → \<bucket\> → Policies**,
all targeting the `authenticated` role. RLS is already enabled by Supabase.

| Bucket | Operation | Expression |
| --- | --- | --- |
| `chat-attachments` | INSERT (WITH CHECK) | `bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = (select auth.uid())::text` |
| `chat-attachments` | SELECT (USING) | same expression |
| `chat-attachments` | DELETE (USING) | same expression |
| `task-attachments` | INSERT (WITH CHECK) | `bucket_id = 'task-attachments' AND (storage.foldername(name))[1] = (select auth.uid())::text` |
| `task-attachments` | SELECT (USING) | same expression |
| `task-attachments` | DELETE (USING) | same expression |

**Do not add an UPDATE policy.** With RLS on and no UPDATE policy, updates are
denied outright. A USING-only UPDATE policy would constrain which rows may
change but not the resulting row, letting a user rename an object into
`<other-user-uuid>/…` where the other user's SELECT policy would then serve it.
Nothing in the app needs it — uploads use `upsert: false` and delete on failure
rather than overwriting. If a future feature needs overwrite, add the policy
with **both** `USING` and `WITH CHECK`.

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
- **Security** — HMAC-signed, user-bound approval tokens (2-minute expiry, single-use nonce) gate every destructive tool call. In-memory sliding-window rate limits cap `/api/ai/chat`, `/api/ai/upload`, `/api/oauth/token` and the digest cron. AI routes return a stable generic message plus a correlation id; the detail stays in the server log. All server secrets (`GEMINI_API_KEY`, `VOYAGE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`) are never exposed to client components.
- **Locale** — AED currency throughout (`Intl.NumberFormat('en-AE', { currency: 'AED' })`), DD/MM/YYYY dates, 12-hour time — all via `lib/format.ts`. Timezone and format preferences stored in Supabase user_metadata and configurable in Settings.
- **Profile** — Display name and avatar photo stored in Supabase auth `user_metadata` (`full_name`, `avatar_url`). Google OAuth photo is used by default; custom photos can be uploaded to the `avatars` storage bucket.

---

## Deployment

Deployed on Vercel. Push to `main` triggers a production deploy.

Set environment variables via the Vercel dashboard or `vercel env pull`. Supabase migrations must be applied manually in the SQL editor — never auto-migrated in CI.

### Deployment checklist

Run through this for every environment. Each step has a verification query so
nothing depends on remembering an undocumented dashboard click.

**1. Environment variables** — all of the following must be set in Vercel:

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `APPROVAL_HMAC_SECRET`,
`ALLOWED_USER_EMAIL`, `CRON_SECRET`.

> `CRON_SECRET` is **required**, not optional. The daily-digest route fails
> closed with `503` when it is unset or shorter than 16 characters — the route
> spends money on Gemini and reads with the service-role key, so it will not run
> without a credential to check.

Optional: `VOYAGE_API_KEY` (keyword fallback without it), `VAPID_*` (push),
`MCP_ACCESS_TOKEN` (Claude Code), `MCP_OAUTH_CLIENT_ID` / `MCP_OAUTH_CLIENT_SECRET`
(claude.ai connector).

**2. Migrations** — apply `001` … `022` in order in the Supabase SQL editor.
Migrations are append-only; never edit an applied file.

**3. Storage** — migration `020` creates both buckets and pins them private.
The six object policies are a **Dashboard** step (see "Storage policies —
Dashboard only" above); they cannot be created from the SQL editor. Verify:

```sql
-- Both buckets exist and are private
select id, public from storage.buckets
where id in ('chat-attachments','task-attachments');
-- expect public = false for both

-- Six object policies, three per bucket (INSERT / SELECT / DELETE)
select policyname, cmd, roles::text from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
-- expect 6 rows, all TO {authenticated}

-- No UPDATE policy at all — see the note above on the rename vector
select policyname from pg_policies
where schemaname = 'storage' and tablename = 'objects' and cmd = 'UPDATE';
-- expect zero rows
```

**4. RLS** — verify no user table is left open:

```sql
-- Every public table has RLS enabled
select tablename from pg_tables t
where schemaname = 'public'
  and not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = t.tablename and c.relrowsecurity
  );
-- expect zero rows

-- Every policy binds an explicit role
select tablename, policyname from pg_policies
where schemaname = 'public' and roles = '{public}';
-- expect zero rows

-- Every UPDATE policy constrains the resulting row
select tablename, policyname from pg_policies
where schemaname = 'public' and cmd = 'UPDATE' and with_check is null;
-- expect zero rows
```

**5. Cron** — the Vercel cron (`59 19 * * *` UTC = 11:59 PM Dubai) fires the
daily digest automatically on Pro/Enterprise; Vercel attaches
`Authorization: Bearer $CRON_SECRET` itself. On Hobby, point an external cron
(e.g. cron-job.org) at `POST /api/ai/daily-digest` with that same header.

Confirm the endpoint is not publicly triggerable:

```bash
# Must return 401 — the x-vercel-cron header is caller-controlled and untrusted
curl -i -X POST https://<your-app>/api/ai/daily-digest -H 'x-vercel-cron: 1'

# Must return 405 — there is no GET handler
curl -i https://<your-app>/api/ai/daily-digest
```

**6. MCP** — confirm no destructive tool is reachable over the connector:

```bash
curl -s https://<your-app>/api/mcp \
  -H "Authorization: Bearer $MCP_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | grep -o '"name":"delete_[a-z_]*"'
# expect no output
```

---

## Project Stats

| Metric | Value |
| --- | --- |
| Test count | 924 passing |
| DB tables | 28 (RLS on all) |
| AI tools | 84 (61 AUTO + 17 REVERSIBLE + 6 APPROVAL) |
| Migrations | 23 (001–023) |
| Last phase | Phase 21 — WCAG AA contrast pass: `--brand-action` fill token, darkened status/priority/brand-text tokens, P2 color-source unification across 20 files |
