# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> SPEC.md owns **what is built** and architectural constraints. This file owns **how to build it** — conventions, patterns, and quality gates.

## Overview

RISE is a single-user personal AI operating system that consolidates task management, finance tracking, habit logging, goal setting, CRM, and a knowledge base into one application. It utilizes an integrated Gemini-powered assistant (Google Gemini 2.5 Flash) capable of executing verified, state-changing operations across the system.

## Objectives

- **Zero Regressions:** Ensure all 8 core functional modules render and operate error-free across updates.
- **Architectural Parity:** Extend or remediate capabilities matching localized component and hook implementation styles.
- **Testing Standard:** Maintain ≥ 85% Vitest line coverage strictly inside `lib/**` paths (excluding `lib/types/`). Current: 298 tests, 48.67% — below target due to execute-tool.ts expansion, use-payment-methods.ts and use-categories.ts at 0% coverage; recovery is next priority.
- **Authorization Verification:** Enforce explicit confirmation dialog gates for destructive AI assistant operations—never bypass `APPROVAL_TOOLS`.

## Tech Stack & Core Constraints

- **Core Architecture:** Next.js 16.2.9 (App Router) · TypeScript Strict · Tailwind CSS v4 · shadcn/ui (`@base-ui/react`) · Supabase (Postgres + pgvector + RLS) · Google Gemini 2.5 Flash via `@google/genai` (SSE streaming + function calling) · Vitest + Testing Library · Vercel.
- **AI SDKs:** `@google/genai` drives the chat assistant. `@anthropic-ai/sdk` is also present — used exclusively for the MCP server endpoint. Never swap them.
- **State Management:** Zustand v5 with `persist` middleware. Not React context, not useState for cross-component state.
- **Middleware Infrastructure:** Routing rules live exclusively within `proxy.ts` (Next.js 16 naming — equivalent to `middleware.ts` in older versions). It calls `updateSession()` from `lib/supabase/middleware.ts`, which is where the `ALLOWED_USER_EMAIL` restriction and token refresh logic actually live.
- **Component Paradigm:** Prioritize React Server Components (RSC) for initial page layouts and base data extraction. Restrict `'use client'` tags to low-level leaf components requiring stateful client operations or interface triggers.
- **Data Flow & Hooks:** Business transactions route through isolated hooks (e.g., `use-tasks.ts`), consuming the client-side Supabase browser instantiation. All tables map strictly to Row-Level Security profiles checking `user_id = auth.uid()`.
- **System Presentation Standards:** Enforce values using `lib/format.ts`. Currency: AED (`Intl.NumberFormat('en-AE', { currency: 'AED' })`). Dates: DD/MM/YYYY formatters. Time: 12-hour presentation. Timezone: Asia/Dubai, UTC+4, no DST.

## Commands

```bash
npm run dev           # Dev server (Turbopack execution)
npm run build         # Production optimization compilation
npm run lint          # ESLint — must produce 0 errors AND 0 warnings to pass /verify
npm run test          # Single Vitest test execution run
npm run test:watch    # Active Vitest watching engine state
npm run test:coverage # Full coverage calculation metrics inside lib/**

npx vitest run lib/ai/__tests__/execute-tool.test.ts   # Execute isolated test targets
```

## Code Conventions & Standards

- **Module Exports:** Enforce named exports for all UI components, custom hooks, and layout utilities.
- **TypeScript Integrity:** Strict mode is enforced. Do not introduce type assertions (`as CustomType`) or utilize the `any` type keyword under any condition.
- **Error Remediation:** Use structured try/catch blocks within async handlers. Client interfaces should surface issues through standard functional toast alerts, while server logic throws contextual errors avoiding internal variable exposures.
- **Commits:** Use `bead: [name]` format (e.g., `bead: add-habit-streak`). Run `/verify` before committing.

## Design System Rules

These rules are enforced by the `frontend-design` skill and must be followed for all UI work:

- **Tailwind v4:** No `tailwind.config.ts`. All design tokens live in the `@theme {}` block in CSS.
- **Single breakpoint:** Only `md` (768px). Never use `sm`, `lg`, `xl`, or `2xl` breakpoints.
- **Conditional classes:** Use `cn()` (= `twMerge(clsx(...))`) for all conditional class merging.
- **Dynamic colors:** Use `style={{ color: varValue }}` for computed/dynamic colors. Never use arbitrary Tailwind `bg-[${color}]`.
- **Typography:** Inter only. Max Tailwind weight class is `font-semibold` (600). `font-bold` (700) is banned — use the design token heading scale instead.
- **Brand color:** `#FF6535` for backgrounds/fills. For orange text on white backgrounds use `--brand-text: #D6450F` (AA contrast requirement — `#FF6535` fails WCAG AA on white).
- **Module identity colors:** Use CSS variables `--mod-tasks`, `--mod-wellness`, `--mod-goals`, `--mod-finance`, `--mod-crm` for border colors and tints. Never use raw Tailwind color utilities for module-specific identity.
- **Graph-paper background:** Every section requires `.graph-bg` (light) or `.graph-bg-dark` (dark) — navy grid on light, orange grid on dark, 40px background-size.
- **Glassmorphism:** Glass effect only on structural chrome (sidebar, modals, topbar). Never on content cards.
- **Dialogs:** `window.confirm` is banned. Use `<ConfirmDialog>` for all confirmation flows.
- **Animations:** Use `.slide-up .stagger-N` for section entrance animations (stagger-1 through stagger-4). Page modules use `animate-rise-in stagger-1` on the heading.
- **BottomNav:** Maximum 5 items (mobile). Adding a 6th requires replacing an existing item.
- **Update pattern:** `updateProject(id, { field: value })` — never `updateProject({ ...project, changes })`.

## Security & Architectural Guardrails

- **Database Schemas:** Do not alter contents inside `supabase/migrations/`. Schema evolutions are append-only and executed via the Supabase Dashboard SQL Command Editor interface.
- **Credential Protection:** Secrets (`GEMINI_API_KEY`, `VOYAGE_API_KEY`, `VAPID_PRIVATE_KEY`, `APPROVAL_HMAC_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY`) are server-only dependencies. Never expose or reference them inside Client Components.
- **Agent Interferences:** Destructive AI tool actions must generate an intermediate client approval state (`ConfirmDialog`) before triggering engine executors in `execute-tool.ts`.

## AI Tool System

The tool system has two tiers defined in `lib/ai/tools.ts`:

- **AUTO_TOOLS:** All non-destructive CRUD. Executed directly in the SSE route.
- **APPROVAL_TOOLS:** Destructive or high-risk operations. Gated by HMAC-signed approval token in `app/api/ai/chat/route.ts` — **the gate lives in the route, not in `execute-tool.ts`**. `executeTool()` runs unconditionally when called.

**Non-obvious tier assignments:**

- `delete_link` → AUTO (only delete that bypasses approval)
- `update_transaction`, `update_debt` → APPROVAL (financial edits are high-risk)
- `bulk_complete_tasks` → APPROVAL

**When adding a new APPROVAL tool:** The `FunctionDeclaration` must include a human-readable `*_title`, `*_name`, or `*_summary` field alongside the UUID — this text is what `ConfirmDialog` displays to the user.

**Tool schema format:** Uses `@google/genai` `FunctionDeclaration` with `Type.STRING` / `Type.OBJECT` / `Type.NUMBER` enum values. Not OpenAI function call format, not Anthropic tool format.

**MCP endpoint** (`/api/mcp`): Exposes only `AUTO_TOOLS`. `APPROVAL_TOOLS` are never reachable via MCP.

**Non-obvious behaviors in `execute-tool.ts`:**

- `log_habit`: Uses fuzzy `ilike` name match, not ID lookup. First result wins — can silently log the wrong habit if names are similar.
- `create_journal_entry`: Upserts on `(user_id, date)` — one entry per day. Calling it twice on the same date updates, never duplicates.
- `remember_user_fact`: Writes to both `user_profile.facts` (JSONB column, drives profile context) AND `ai_memory` vector store via `storeMemory()` (drives semantic `recall_memories()`).

**`executeTool` contract:** Always returns `{ success: boolean; message: string; data?: unknown }`. Every handler calls `getUser()` and returns early if no user. Every query filters by `user_id`.

## Testing Patterns

All `execute-tool` tests live in `lib/ai/__tests__/execute-tool.test.ts` and use:

```ts
// Chainable Supabase mock factory — use this, not raw vi.fn() per method
const createMockQuery = (data, error = null) => {
  const q: any = {}
  ;['select','insert','update','delete','eq','neq','ilike','order','limit','range','upsert'].forEach(m => { q[m] = vi.fn(() => q) })
  q.single = vi.fn(() => Promise.resolve({ data, error }))
  q.maybeSingle = vi.fn(() => Promise.resolve({ data, error }))
  // For queries that don't call .single(), patch .then:
  Object.defineProperty(q, 'then', { get: () => Promise.resolve({ data, error }).then.bind(Promise.resolve({ data, error })) })
  return q
}
```

Route queries to specific tables: `mock.from = vi.fn((table) => queries[table] ?? defaultQuery)`.

Freeze time in `beforeEach`: `vi.setSystemTime(new Date("2026-06-23T12:00:00Z"))` for deterministic date-dependent behavior.

Each tool requires: happy path + not-authenticated + supabase-error + edge cases.

**Coverage lesson:** Expanding `execute-tool.ts` (adding tools) without a matching test bead caused coverage to drop from 97% → 48%. Every tool addition must be paired with tests in the same commit.

## Available Skills & Commands

**Skills** (in `.claude/skills/`):

- `frontend-design` — full design system, token system, component patterns
- `db-schema` — RLS-first migration design (RLS + policies in the same migration file)
- `git-commit` — bead commit format with locked git identity
- `security-audit` — security review patterns

**Commands** (in `.claude/commands/`):

- `/verify` — runs test:coverage (≥85% lib/**), lint (0 errors + 0 warnings), build (exit 0). All three must pass.
- `/review` — code quality review
- `/add-tool` — TDD-first recipe: write tests first, add FunctionDeclaration to tools.ts, add case to execute-tool.ts switch block
- `/new-module` — scaffold recipe: page.tsx → Sidebar link → BottomNav link → database.ts types → spec.md update

## Complete File Structure

```text
app/
  (auth)/                   Login page routes and Google OAuth handler pipelines
  (app)/                    Authenticated core workspace shell (layout.tsx handles auth protection)
    page.tsx                Central OS Executive Dashboard (async RSC, 11 parallel Supabase queries, no Suspense)
    productivity/           Task orchestration and project boards
    finance/                Income, expense, transfer and adjustment ledgers; wallet/payment method balance tracking (Strict AED)
    wellness/               Habit tracker with reminder_time scheduling, done/not-done marking, streak logic
    goals/                  Strategic goal tracking and milestone matrices
    crm/                    Contact lifecycle managers and interaction logs
    knowledge/              Rich-text documentation workspace (Tiptap implementation)
    assistant/              Gemini AI chat view utilizing SSE streaming interfaces
    analytics/              Cross-modular reporting graphics powered by Recharts
    settings/               User localization preferences and application controls
  api/ai/chat/              SSE chat route — approval gate (HMAC token), tool dispatch, Gemini streaming
  api/[transport]/          Remote MCP endpoint (/api/mcp) — bearer-token auth, exposes AUTO_TOOLS only
  api/push/                 Web Push subscription management (subscribe, unsubscribe, vapid-public-key)
  auth/callback/            OAuth verification interchange and session validation routes

components/
  ui/                       Core design architecture primitive assets (@base-ui/react)
  layout/                   Universal frame shells: Sidebar (Desktop), BottomNav (Mobile, max 5 items), Topbar
  analytics/                Isolated Recharts rendering structures per module
  productivity/             Task entry forms and visualization cards
  pwa/                      Service Worker setup toasts, caching, and installation components

lib/
  ai/
    tools.ts                AUTO_TOOLS + APPROVAL_TOOLS + ALL_TOOLS + APPROVAL_TOOL_NAMES (Set)
    execute-tool.ts         executeTool(name, input, ctx?) — switch-case, returns ToolResult
    memory.ts               Voyage AI (1024-dim pgvector) tracking logic with keyword fallback
    mcp.ts                  MCP tool registry (AUTO_TOOLS only), bearer-token auth guard, service-role ToolContext
    mcp-schema.ts           Gemini FunctionDeclaration → JSON Schema converter for MCP tools/list
    upload-helpers.ts       File upload parsing and text/audio extraction for chat attachments
  hooks/
    use-tasks.ts            Task CRUD with Supabase Realtime subscription
    use-projects.ts         Project CRUD with Supabase Realtime subscription
    use-push-subscription.ts Push notification subscription management
    use-payment-methods.ts  Wallet balance state and CRUD operations (currently 0% test coverage)
    use-theme.tsx           Dark/light mode toggle; persists to localStorage
  supabase/
    client.ts               Client-side client initializations for browser interactions
    server.ts               Server-side isolated client handlers
    middleware.ts           Session lifecycle handlers, ALLOWED_USER_EMAIL enforcement, token refresh
  types/
    database.ts             Single Source of Truth — 21 Supabase tables with Row/Insert/Update types
  format.ts                 System formatting scripts (Strict AED, DD/MM/YYYY, 12h)
  utils.ts                  cn() utility (twMerge + clsx) and general class utilities

supabase/migrations/        001 through 011 (append-only; execute via Supabase SQL editor)
supabase/functions/
  send-push/                Deno edge function — VAPID JWT push delivery (hourly cron)
proxy.ts                    Next.js 16 middleware entry point — calls lib/supabase/middleware.ts
public/sw.js                Service worker script managing stale-while-revalidate data paths

.claude/
  skills/                   frontend-design, db-schema, git-commit, security-audit
  commands/                 /verify, /review, /add-tool, /new-module
  settings.json             MCP server and permission configuration
```
