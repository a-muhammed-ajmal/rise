# RISE — Personal AI Operating System
**Spec created:** 2026-06-23 (retroactive — built first, documented after)
**Decision routing:** Multi-phase build (rule 4) → single-agent execution
**Done looks like:** All 6 modules live at rise.muhammedajmal.com, AI assistant executes real actions, sessions persist, 0 TypeScript errors, 0 lint warnings, ≥85% test coverage.

---

## What RISE Is

A single-user personal operating system that replaces Todoist + a finance app + a habit tracker + a journal + a CRM + a knowledge base + an AI assistant. The AI must actually execute approved actions inside the system — not just chat. Built for Ajmal, UAE-based (AED currency, DD/MM/YYYY dates, 12h time).

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.9 (App Router, Turbopack) |
| Language | TypeScript strict |
| Styling | Tailwind CSS + shadcn/ui v4 (@base-ui/react) |
| Database | Supabase (PostgreSQL + pgvector + RLS) |
| AI | Claude claude-sonnet-4-6 via Anthropic SDK (tool use + SSE streaming) |
| Deployment | Vercel → rise.muhammedajmal.com (in progress) |

---

## Modules

| Module | Status |
|---|---|
| Productivity (tasks, projects) | ✅ Built |
| Finance (transactions, budgets, debts) | ✅ Built |
| Wellness (habits, habit logs, focus sessions) | ✅ Built |
| Goals & Reflection (goals, milestones, journal) | ✅ Built |
| CRM (contacts, interactions) | ✅ Built |
| Knowledge (notes, links) | ✅ Built |
| AI Assistant (streaming, tool use, approval flow) | ✅ Built (basic) |

---

## Auth

| Item | Status |
|---|---|
| Google OAuth (replace magic link) | ✅ Code done |
| Supabase Google provider enabled | ⏳ Manual step — user must do in Supabase dashboard |
| Google Cloud OAuth credentials created | ⏳ Manual step — user must do in Google Cloud Console |
| Redirect URL added in Supabase | ⏳ Manual step |
| Persistent sessions (refresh token via cookie) | ✅ Done — `access_type: offline` |

---

## Infrastructure

| Item | Status |
|---|---|
| Supabase project created | ✅ |
| 3 SQL migrations applied | ✅ (001_schema, 002_pgvector, 003_rls) |
| `.env.local` with 4 env vars | ✅ Local only — never committed |
| Vercel deployment (rise-aid-plug.vercel.app) | ✅ Live |
| Custom domain (rise.muhammedajmal.com) | ⏳ User to add subdomain in Vercel + DNS CNAME |
| Env vars set in Vercel dashboard | ✅ (confirmed by successful build) |
| GitHub repo | ✅ github.com/a-muhammed-ajmal/rise |

---

## What Is Left

### P0 — Blocking (must do before calling it done)

- [ ] **Google OAuth manual setup** — Supabase dashboard + Google Cloud Console (user action)
- [ ] **Custom domain DNS** — Add `rise.muhammedajmal.com` CNAME in Vercel + DNS registrar (user action)
- [ ] **Tests** — ≥85% coverage on all modules per CLAUDE.md. Currently 0 tests exist. Required before next feature commit.

### P1 — AI Memory System (Phase 6 incomplete)

The AI assistant works but has no long-term memory. Each conversation starts cold.

- [ ] `lib/ai/memory.ts` — embed user messages → store in `ai_memory` table (pgvector)
- [ ] On context build: pgvector similarity search top-10 relevant memories → inject into system prompt
- [ ] Every 20 turns: summarize oldest messages → replace with summary embedding
- [ ] `match_memories` SQL function already defined in database schema

### P2 — PWA Polish

- [ ] Verify PWA icons (192px + 512px in `/public/icons/`) render correctly on iOS/Android
- [ ] Fix manifest.webmanifest 401 on login page (low priority — only affects unauthenticated state)
- [ ] Web push notifications for habit nudges + follow-up reminders (Supabase Edge Function)
- [ ] Offline support: service worker caches app shell + recent data

### P3 — Quality

- [ ] Lighthouse audit ≥ 90 on mobile
- [ ] Smoke test golden path: login → dashboard → create task → log AED expense → toggle habit → test AI
- [ ] Performance: lazy-load heavy pages (knowledge, CRM) to reduce initial bundle

---

## Key Constraints (non-negotiable)

- AED currency everywhere: `Intl.NumberFormat('en-AE', { currency: 'AED' })`
- DD/MM/YYYY dates, 12h time
- `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only — never expose to client
- All AI actions that delete or bulk-modify require user approval before execution
- Never use `any` in TypeScript
- Single user only — RLS enforces `user_id = auth.uid()` on every table

---

## Key Files

| Path | Purpose |
|---|---|
| `lib/types/database.ts` | Full Supabase type definitions (all 19 tables) |
| `lib/ai/tools.ts` | All Claude tool definitions + approval gate |
| `lib/ai/execute-tool.ts` | Tool execution router |
| `app/api/ai/chat/route.ts` | Streaming AI endpoint with SSE |
| `app/(auth)/login/page.tsx` | Google OAuth login |
| `app/auth/callback/route.ts` | OAuth code → session exchange |
| `lib/supabase/middleware.ts` | Session refresh + auth guard |
| `proxy.ts` | Next.js 16 middleware (renamed from middleware.ts) |
| `supabase/migrations/` | 3 SQL migration files |
| `lib/format.ts` | AED, DD/MM/YYYY, 12h formatters |
