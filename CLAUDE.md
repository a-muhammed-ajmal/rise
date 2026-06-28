# CLAUDE.md

> SPEC.md owns **what is built** and architectural constraints. This file owns **how to build it** — conventions, patterns, and quality gates.

This file provides strict architectural alignment, code quality parameters, and structural rules for automated engineering sessions within this repository.

## Overview

RISE is a single-user personal AI operating system that consolidates task management, finance tracking, habit logging, goal setting, CRM, and a knowledge base into one application. It utilizes an integrated Gemini-powered assistant (Google Gemini 2.5 Flash) capable of executing verified, state-changing operations across the system.

## Objectives

- **Zero Regressions:** Ensure all 8 core functional modules render and operate error-free across updates.
- **Architectural Parity:** Extend or remediate capabilities matching localized component and hook implementation styles.
- **Testing Standard:** Maintain ≥ 85% Vitest line coverage strictly inside `lib/**` paths (excluding `lib/types/`). Current: 151 tests at 97.21%.
- **Authorization Verification:** Enforce explicit confirmation dialog gates for destructive AI assistant operations—never bypass `APPROVAL_TOOLS`.

## Tech Stack & Core Constraints

- **Core Architecture:** Next.js 16.2.9 (App Router) · TypeScript Strict · Tailwind CSS v4 · shadcn/ui (`@base-ui/react`) · Supabase (Postgres + pgvector + RLS) · Google Gemini 2.5 Flash via `@google/genai` (SSE streaming + function calling) · Vitest + Testing Library · Vercel.
- **Middleware Infrastructure:** Routing rules live exclusively within `proxy.ts` (Next.js 16 structure). This file manages Supabase token refreshes and enforces the `ALLOWED_USER_EMAIL` baseline restriction.
- **Component Paradigm:** Prioritize React Server Components (RSC) for initial page layouts and base data extraction. Restrict `'use client'` tags to low-level leaf components requiring stateful client operations or interface triggers.
- **Data Flow & Hooks:** Business transactions route through isolated hooks (e.g., `use-tasks.ts`), consuming the client-side Supabase browser instantiation. All tables map strictly to Row-Level Security profiles checking `user_id = auth.uid()`.
- **System Presentation Standards:** Enforce values using `lib/format.ts`. Currency: AED (`Intl.NumberFormat('en-AE', { currency: 'AED' })`). Dates: DD/MM/YYYY formatters. Time: 12-hour presentation.

## Code Conventions & Standards

- **Module Exports:** Enforce named exports for all UI components, custom hooks, and layout utilities.
- **TypeScript Integrity:** Strict mode is enforced. Do not introduce type assertions (`as CustomType`) or utilize the `any` type keyword under any condition.
- **Error Remediation:** Use structured try/catch blocks within async handlers. Client interfaces should surface issues through standard functional toast alerts, while server logic throws contextual errors avoiding internal variable exposures.

## Commands

```bash
npm run dev           # Dev server (Turbopack execution)
npm run build         # Production optimization compilation
npm run lint          # ESLint code syntax verification
npm run test          # Single Vitest test execution run
npm run test:watch    # Active Vitest watching engine state
npm run test:coverage # Full coverage calculation metrics inside lib/**

npx vitest run lib/ai/__tests__/memory.test.ts   # Execute isolated test targets

```

## Security & Architectural Guardrails

- **Database Schemas:** Do not alter contents inside `supabase/migrations/`. Schema evolutions are append-only and executed via the Supabase Dashboard SQL Command Editor interface.
- **Credential Protection:** Secrets (`GEMINI_API_KEY`, `VOYAGE_API_KEY`, `VAPID_PRIVATE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`) are server-only dependencies. Never expose or reference them inside Client Components.
- **Agent Interferences:** Destructive AI tool actions (such as bulk deletions or schema clear downs) must generate an intermediate client approval state (`ConfirmDialog`) before triggering engine executors in `execute-tool.ts`.

## Complete File Structure

```text
app/
  (auth)/                   Login page routes and Google OAuth handler pipelines
  (app)/                    Authenticated core workspace shell (layout.tsx handles auth protection)
    page.tsx                Central OS Executive Dashboard
    productivity/           Task orchestration and project boards
    finance/                Income and expense monitoring ledgers (Strict AED)
    wellness/               Habit tracker sheets and performance streaks
    goals/                  Strategic goal tracking and milestone matrices
    crm/                    Contact lifecycle managers and interaction logs
    knowledge/              Rich-text documentation workspace (Tiptap implementation)
    assistant/              Gemini AI chat view utilizing SSE streaming interfaces
    analytics/              Cross-modular reporting graphics powered by Recharts
    settings/               User localization preferences and application controls
  api/ai/chat/              Server-Sent Events (SSE) chat connection routes for the AI agent
  api/push/                 Web Push subscription management (subscribe, unsubscribe, vapid-public-key)
  auth/callback/            OAuth verification interchange and session validation routes

components/
  ui/                       Core design architecture primitive assets (@base-ui/react)
  layout/                   Universal frame shells: Sidebar (Desktop), BottomNav (Mobile), Topbar
  analytics/                Isolated Recharts rendering structures per module
  productivity/             Task entry forms and visualization cards
  pwa/                      Service Worker setup toasts, caching, and installation components

lib/
  ai/
    tools.ts                System parameters for AUTO_TOOLS and APPROVAL_TOOLS arrays
    execute-tool.ts         Core tool executors bridging Gemini function calls to database functions
    memory.ts               Voyage AI (1024-dim pgvector) tracking logic with keyword fallback
  hooks/                    Localized state tools (use-tasks.ts, use-projects.ts, use-theme.tsx)
  supabase/
    client.ts               Client-side client initializations for browser interactions
    server.ts               Server-side isolated client handlers
    middleware.ts           Session lifecycle handlers and authentication filters
  types/
    database.ts             Single Source of Truth mapping for the 20 Supabase database tables
  format.ts                 System formatting scripts (Strict AED presentation, DD/MM/YYYY, 12h)
  utils.ts                  General design tool utilities and class consolidations

supabase/migrations/        001_schema through 006_task_enhancements scripts (Run in order)
supabase/functions/
  send-push/                Deno edge function — VAPID JWT push delivery (hourly cron)
proxy.ts                    Next.js 16 centralized gateway logic entry point
public/sw.js                Service worker script managing stale-while-revalidate data paths

.claude/
  skills/                   rise-module-pattern, rise-tool-pattern, rise-test-pattern, rise-sql-pattern
  commands/                 /verify, /review, /add-tool, /new-module
  settings.json             MCP server and permission configuration

```
