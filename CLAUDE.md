# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Overview

RISE is a single-user personal AI operating system that consolidates task management, finance tracking, habit logging, goal setting, CRM, and a knowledge base into one app, with a Claude-powered assistant that can execute real actions inside the system.

## Objectives

- Keep all modules (Productivity, Finance, Wellness, Goals, CRM, Knowledge, AI Assistant, Analytics) working without regressions
- Extend or fix features using the existing patterns in each module page and its associated hooks
- Maintain ≥85% Vitest coverage on `lib/**` when adding or changing logic
- Surface AI tool calls that are destructive through the approval gate — never auto-execute `APPROVAL_TOOLS`

## Context

**Stack:** Next.js 16.2.9 (App Router) · TypeScript strict · Tailwind CSS v4 · shadcn/ui (`@base-ui/react`) · Supabase (Postgres + pgvector + RLS) · Anthropic Claude `claude-sonnet-4-6` (SSE streaming) · Vitest + Testing Library · Vercel

**Key architectural facts:**

- Middleware lives in `proxy.ts`, not `middleware.ts` — Next.js 16 renamed it. It refreshes the Supabase session and enforces the `ALLOWED_USER_EMAIL` allowlist.
- Auth is Google OAuth via Supabase. The `app/(app)/layout.tsx` server component checks `supabase.auth.getUser()` and redirects to `/login` if no session.
- All Supabase tables enforce `user_id = auth.uid()` via RLS — single-user by design. The type definitions for all 19 tables live in `lib/types/database.ts`.
- The AI assistant uses two tool lists: `AUTO_TOOLS` (low-risk, auto-executed) and `APPROVAL_TOOLS` (destructive, require user confirmation before `execute-tool.ts` runs them). Memory is stored as pgvector embeddings (`ai_memory` table, 1024-dim via Voyage AI) with a keyword fallback when `VOYAGE_API_KEY` is absent.
- `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only — never reference them in Client Components.
- Currency: AED via `Intl.NumberFormat('en-AE', { currency: 'AED' })`. Dates: DD/MM/YYYY. Time: 12-hour. Always use `lib/format.ts` formatters.
- Tests run in jsdom via Vitest; coverage is measured over `lib/**` only (excluding `lib/types/`).

**Commands:**

```bash
npm run dev              # Dev server (Turbopack)
npm run build            # Production build
npm run lint             # ESLint
npm run test             # Vitest single run
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Coverage report

npx vitest run lib/ai/__tests__/memory.test.ts   # Run a single test file
```

## Success Criteria

All 8 modules render without errors, the AI assistant streams responses and executes approved tool calls, 0 TypeScript errors, 0 lint warnings, ≥85% line coverage on `lib/**`, and the app is deployable to Vercel by pushing to `main`.

## Constraints and Boundaries

- Never modify `supabase/migrations/` — migrations are applied manually in the Supabase dashboard SQL editor and are append-only
- Never expose `ANTHROPIC_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to client-side code
- Never bypass the approval gate for `APPROVAL_TOOLS` in `lib/ai/tools.ts`
- Never use `any` in TypeScript
- Never commit `.env.local`
- All AI destructive actions (bulk-delete, bulk-update) must surface a `ConfirmDialog` before execution

## File Structure

```text
app/
  (auth)/           Login page and OAuth callback routes
  (app)/            Authenticated shell — layout.tsx guards auth server-side
    page.tsx        Dashboard
    productivity/   Task management
    finance/        Income/expense tracking (AED)
    wellness/       Habit tracking + streaks
    goals/          Goal + milestone tracking
    crm/            Contact and relationship management
    knowledge/      Rich-text notes (Tiptap)
    assistant/      Claude AI chat with SSE streaming
    analytics/      Recharts dashboards across modules
    settings/       User preferences
  api/ai/chat/      SSE streaming route for the AI assistant
  auth/callback/    OAuth code-to-session exchange

components/
  ui/               shadcn/ui primitives (@base-ui/react)
  layout/           Sidebar (desktop), BottomNav (mobile), Topbar
  analytics/        Per-module Recharts components
  productivity/     Task form and card components
  pwa/              Install prompt, SW update toast, SW registration

lib/
  ai/
    tools.ts        AUTO_TOOLS and APPROVAL_TOOLS definitions
    execute-tool.ts Routes tool calls to Supabase operations
    memory.ts       Voyage AI embedding, pgvector storage/retrieval, compaction
  hooks/            use-tasks.ts, use-projects.ts, use-theme.tsx
  supabase/
    client.ts       Browser Supabase client
    server.ts       Server-side Supabase client
    middleware.ts   Session refresh + email allowlist guard
  types/
    database.ts     All 19 Supabase table types (single source of truth)
  format.ts         AED, DD/MM/YYYY, 12h formatters — always use these
  utils.ts          Shared utilities

supabase/migrations/   001_schema → 004_vector_dimension (apply in order)
proxy.ts               Next.js 16 middleware entry point
public/sw.js           Service worker (stale-while-revalidate)
```
