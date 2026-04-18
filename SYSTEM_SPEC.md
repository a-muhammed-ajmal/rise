# RISE — As-built status & agent rules

> **This file is the living companion to the frozen product plan.**  
> Full product behavior, data models, target stack, and UI intent live in **`# RISE — System Specification.txt`** at the repo root. Read that file first for *what RISE is meant to be*. Read *this* file for *what the repository implements today*, how to work on it safely, and mandatory rules for AI-assisted edits.

**Last updated:** 2026-04-18 (ActionDetailPopup: Priority chip shows current P1/P2/P3/P4 label in priority color; Due Date chip shows selected DD/MM/YYYY label + X-to-clear button, active blue tint when set; Repeat chip shows current recurrence value, active blue tint; Reminder chip shows active label with blue tint; getDueDateDisplay now converts 24h dueTime to 12h AM/PM; TargetCard dueDate formatted explicitly as DD/MM/YYYY to prevent locale/hydration issues)

---

## Table of contents

1. [Reading order & document roles](#1-reading-order--document-roles)
2. [As-built technology stack](#2-as-built-technology-stack)
3. [Plan vs code: intentional deltas](#3-plan-vs-code-intentional-deltas)
4. [Implementation status (vs plan §9)](#4-implementation-status-vs-plan-9)
5. [Project structure (as-built)](#5-project-structure-as-built)
6. [Firestore & data](#6-firestore--data)
7. [API routes (as-built)](#7-api-routes-as-built)
8. [AI agent rules (mandatory)](#8-ai-agent-rules-mandatory)
9. [Next steps](#9-next-steps)
10. [Known issues & risk areas](#10-known-issues--risk-areas)

---

## 1. Reading order & document roles

| Document | Role |
|----------|------|
| `# RISE — System Specification.txt` | **Frozen plan**: pages, modules, terminology, behaviors, data models, *target* technology table, styling, security, PWA intent. Do not strip or replace this file with a shorter summary. |
| `SYSTEM_SPEC.md` (this file) | **As-built + process**: verified dependencies, file layout, implementation status, gaps vs the plan, and **single** set of rules agents must follow when editing. |

If the codebase diverges from the `.txt` plan, the mismatch is documented **here**, not by editing away detail in the plan file.

---

## 2. As-built technology stack

Pinned from `package.json` and config (not from the plan's §2 table, which describes a *target* stack).

| Layer | As implemented |
|-------|----------------|
| Framework | Next.js **14.2.x** (App Router) |
| Language | TypeScript **5.5.x** |
| UI | React **18.3.x** |
| Styling | Tailwind CSS **3.4.x** |
| Database | Firebase **^10.14** (Firestore) |
| Auth | Firebase Auth (Google popup) |
| Storage | Firebase Storage (initialized in `lib/firebase.ts`) |
| AI | `@google/generative-ai` **^0.24.1** — see `lib/gemini.ts` (model `gemini-2.0-flash`) |
| Icons | `lucide-react` **0.446.0** |
| PWA | `next-pwa` **^2.0.2** — `next.config.js`, output under `public/` |
| Class merge | `clsx`, `tailwind-merge` |

**Not present in `package.json` today** (but may appear in the plan): React 19, Next 15, Tailwind 4, Serwist, Framer Motion, Recharts, React Hook Form, Zod, Zustand, date-fns (is present), `@google/genai` package name.

---

## 3. Plan vs code: intentional deltas

| Topic | Plan (`.txt`) | Code (as-built) |
|-------|----------------|-------------------|
| §2 Technology table | Next 15, React 19, Tailwind 4, Serwist, etc. | Next 14, React 18, Tailwind 3, `next-pwa` |
| §9.1 Dashboard | Quick stats, Today's Focus, Be Consistent, Winner's Mindset, Get Things Done, Target Progress | **Complete**: dynamic greeting, Today's Focus, Be Consistent, Get Things Done, Target Progress (top 3 goals). **Quick Stats grid removed** by user decision. Winner's Mindset moved to Wellness page. |
| §9.5 Wellness | Rhythms KPIs, cards, popup, Pomodoro | **Winner's Mindset** collapsible panel now lives at top of Wellness page (37 affirmations, shuffled on load, collapsed by default) |
| §9.11 AI Chat | Rich context blob, markdown rendering, TTS, voice pipeline | Firestore history, `/api/chat` with context injected **once per session** (not every message) to minimize token usage; chat history sanitized; markdown rendered; **TTS implemented** via browser `speechSynthesis`; voice uses **Web Speech API** client-side (no server cost) |
| §11 API | POST `/api/ai-tip` with body, daily rate limit | **POST** `/api/ai-tip` — 10 req/24hr/user via `checkTipRateLimit` in `lib/rate-limiter.ts` |
| §11 `/api/transcribe` | Gemini multimodal + cleanup | **Stub** — returns empty; voice input now uses Web Speech API directly in `useVoiceRecorder.ts` (browser-native, Chrome/Edge) |
| §16 PWA | Serwist `app/sw.ts` | **`next-pwa`** — `pwa.dest: 'public'`; `navigateFallback` intentionally omitted |
| §18 Env | `.env.example` | **`.env.local.example`** committed at repo root |
| Onboarding | Multi-step wizard | **Removed** — single-user app, no onboarding needed; `app/onboarding/` directory and `hooks/useOnboarding.ts` deleted |
| Vision categories (plan §17.10) | Six categories | **`lib/constants.ts`** `VISION_CATEGORIES`: `Personal, Professional, Financial, Relationships, Health, Learning` |
| Realm colors | Per §14.1 spec | **Corrected**: Personal=#800080, Financial=#00A86B, Vision=#FFD700 (were wrong before) |
| Priority colors | Per §17.2 spec | **Corrected**: P1=#EF4444, P2=#F59E0B(amber), P3=#3B82F6(blue), P4=#6B7280 — all inline maps unified |
| Date format | DD/MM/YYYY everywhere | **Fixed**: `formatCardDate` in `TaskCard.tsx` now returns DD/MM/YYYY |
| Priority P4 label | "Default" | **Fixed** in tasks/page.tsx and dashboard page.tsx |

---

## 4. Implementation status (vs plan §9)

Statuses: **Complete** (usable end-to-end), **Partial** (works but missing plan details), **Stub** (placeholder only).

| Area | Plan § | Status | Notes |
|------|--------|--------|--------|
| Auth / session | §6 | **Complete** | `AuthProvider`; `initializeAuth` + `browserLocalPersistence`; `(main)/layout.tsx` guard |
| Login | §9.12 | **Complete** | Google sign-in; authed users → `/` |
| Dashboard | §9.1 | **Complete** | Greeting, Today's Focus, Be Consistent, Get Things Done, Target Progress. Quick Stats grid intentionally removed. |
| Actions | §9.2 | **Complete** | Five tabs; standardized TaskCard; TaskModal; TargetPopup; bulk select; recurring auto-create |
| Visions | §9.3 | **Complete** | NICE info box, timeline filters, vision cards, milestones modal |
| Finance | §9.4 | **Complete** | Transactions / Budgets / Debts tabs with CRUD |
| Wellness | §9.5 | **Complete** | Winner's Mindset panel + Rhythms KPIs + cards + popup + Pomodoro |
| Professional CRM | §9.6 | **Partial** | Leads/Deals tabs; Deal modal fields subset vs full plan |
| Relationships | §9.7 | **Partial** | Connections CRUD; modal fields subset vs plan |
| Reviews | §9.8 | **Partial** | Weekly/monthly/quarterly/yearly tabs; not full plan matrix |
| Journal | §9.9 | **Partial** | Energy, mood, text; voice input via Web Speech API |
| Documents | §9.10 | **Partial** | Filter, search, CRUD |
| AI Chat | §9.11 | **Partial** | Persistence, Gemini reply, context injected once per session, TTS buttons, Web Speech API voice; no rich sanitized context pipeline per full spec |
| Onboarding | — | **Removed** | Single-user app — stub and hook deleted |
| PWA | §16 | **Partial** | `next-pwa` + install prompt; not Serwist strategy from plan |

---

## 5. Project structure (as-built)

```
rise/
  app/
    (auth)/login/page.tsx
    (main)/
      layout.tsx                 # Auth guard + AppLayout
      page.tsx                   # Dashboard
      tasks/page.tsx             # Actions
      goals/page.tsx             # Visions
      finance/page.tsx
      wellness/page.tsx          # Rhythms + Winner's Mindset panel
      professional/page.tsx
      relationships/page.tsx
      reviews/page.tsx
      journal/page.tsx
      documents/page.tsx
      chat/page.tsx              # AI Chat with TTS + Web Speech API
    api/
      chat/route.ts
      transcribe/route.ts        # Stub — returns empty (voice uses Web Speech API)
      ai-tip/route.ts            # POST, 10/day rate limit
    layout.tsx
    globals.css
  components/
    layout/                      # AppLayout, DesktopSidebar, MobileHeader/BottomNav, GlobalFab
    providers/                   # Auth, PWA, SW registrar
    tasks/
      TaskCard.tsx               # Shared TaskCard
    ui/                          # Button, Input, Modal, Badge, etc.
  hooks/
    useAuth.ts
    useFirestore.ts              # useCollection + mutations (constraints stability fixed)
    usePomodoroTimer.ts
    useToast.ts
    useVoiceRecorder.ts          # Web Speech API (browser-native, no server)
  lib/
    types.ts
    constants.ts                 # Colors corrected: realm, priority
    firebase.ts
    firestore.ts
    utils.ts
    sanitizer.ts
    verify-auth.ts
    rate-limiter.ts              # chatRateLimiter (30/min) + tipRateLimiter (10/day)
    toast.ts
    gemini.ts
    validations.ts               # Field-level helpers only (no Zod schemas)
  .env.local.example             # Environment variable template
  firestore.rules
  storage.rules
  SYSTEM_SPEC.md
  # RISE — System Specification.txt
```

---

## 6. Firestore & data

- **Collection names** are **frozen** — see `COLLECTIONS` in `lib/constants.ts` and the plan §8.
- **Firestore init:** `memoryLocalCache()` in `lib/firebase.ts`.
- **Auth persistence:** `browserLocalPersistence` — session survives closing the browser.

---

## 7. API routes (as-built)

| Route | Method | Auth | Behavior |
|-------|--------|------|----------|
| `/api/chat` | POST | Bearer Firebase ID token | `verifyAuthToken`, rate limit 30/min, `generateChatResponse` |
| `/api/transcribe` | POST | Bearer | **Stub** — returns `{ text: '' }`; voice now uses Web Speech API client-side |
| `/api/ai-tip` | POST | Bearer | Rate limit 10/day (`checkTipRateLimit`), `generateText`, fallback string |

---

## 8. AI agent rules (mandatory)

### 8.1 Mandatory first step

1. Read **`# RISE — System Specification.txt`** for product intent, terminology, and data shapes.  
2. Read **this file** for as-built status and gaps.

### 8.2 Execution discipline

1. Do **only** what the task explicitly asks. Do not refactor, rename, or "clean up" unrelated code.  
2. If something is not requested, do not change it.  
3. **Do not add** new files, folders, tooling, or editor config unless the user explicitly asked.  
4. **Do not guess.** If scope is unclear, read the spec files and/or ask the user.  
5. After completing a **code** task: update **this** `SYSTEM_SPEC.md`, run **`./node_modules/.bin/next build`** (zero errors), then **commit** and **push** only when the task says so.  
6. No assumptions, no extras, no "while I'm here" changes.  
7. **Always commit and push directly to `main`.** Never create a feature branch.

### 8.3 UI terminology (non-negotiable)

| UI label | Internal / Firestore |
|----------|----------------------|
| Realm | `area` / legacy LifeArea |
| Target | `Project` — collection `projects` |
| Action | `Task` — collection `tasks` |
| Rhythm | `Habit` — collection `habits` |
| Vision | `Goal` — collection `goals` |
| Connection | `Connection` — collection `connections` |

### 8.4 Global Data Formats (non-negotiable)

- **Date:** Must always be shown in DD/MM/YYYY format everywhere in the application.
- **Time:** Must always be shown in 12-hour AM/PM format everywhere in the application (Example: 8:00 PM, not 20:00).
- **Modification Rule:** This must be followed strictly. No AI must ever change this without the user's explicit instruction.

### 8.5 Key files

- `lib/types.ts` — TypeScript interfaces  
- `lib/constants.ts` — constants, colors (authoritative — always import from here, never redefine inline)
- `lib/firestore.ts` — CRUD and subscriptions  
- `hooks/useFirestore.ts` — `useCollection` and related hooks  
- `lib/gemini.ts` — Gemini calls  
- `components/layout/AppLayout.tsx` — shell layout

### 8.6 Environment variables

For local development, copy `.env.local.example` to `.env.local` and fill in values (see plan §18 for variable names).

---

## 9. Next steps

1. **AI Chat rich context pipeline** — currently context is a lean summary injected once per session; plan §9.11 describes a fully sanitized per-collection context blob including leads/deals/connections/reviews.
2. **Dashboard Quick Stats grid** — removed by user decision; can be re-added if needed (Done today, Active targets, Avg streak, Surplus/Deficit).
3. **Zod validation** — `lib/validations.ts` has field-level helpers only; full Zod schemas + `validateDocument` wired into Firestore writes are not yet implemented.
4. **`/api/transcribe`** — still a stub; Web Speech API is used client-side instead; server transcription not needed unless offline/background processing required.
5. **Professional CRM, Relationships, Reviews, Journal, Documents** — all Partial; modal fields are subsets of the full plan spec.
6. **PWA strategy** — `next-pwa` / Workbox v4; plan describes Serwist with custom runtime cache order.

---

## 10. Known issues & risk areas

| Issue | Detail |
|-------|--------|
| **ESLint / Next mismatch** | `eslint-config-next` **^14** with `next` **14** — aligned. |
| **Rate limiter in production** | In-memory `Map` store resets on every serverless cold start (Vercel). For real rate limiting in production, use Upstash Redis or Vercel KV. |
| **AI tip fetch** | Dashboard does not currently call `/api/ai-tip`. Wire up if daily tip display is required on the home screen. |
| **Chat context** | Lean context is injected once per session (resets on page reload or chat clear). Full sanitized per-collection pipeline from plan §9.11 not yet wired. |
| **`next.config.js` + `next-pwa`** | Next may log "Unrecognized key(s): `pwa`" — expected; `next-pwa` reads `pwa` at webpack time. |
| **Web Speech API** | Only available in Chrome, Edge, and some mobile browsers. Safari support is partial. |

---

## 11. Patch history

| Date | Files | Summary |
|------|-------|---------|
| 2026-04-18 | `components/tasks/ActionDetailPopup.tsx`, `app/(main)/tasks/page.tsx` | **ActionDetailPopup chips now reflect current values**: Priority chip shows P1/P2/P3/P4 label in priority color; Due Date chip shows selected date (DD/MM/YYYY) + active blue tint + ×-to-clear; Repeat chip shows active recurrence; Reminder chip shows active label with blue tint. `getDueDateDisplay` fixed to output 12h AM/PM for `dueTime`. `TargetCard` due date uses explicit DD/MM/YYYY format (no `toLocaleDateString`). |
| 2026-04-17 | `app/(main)/tasks/page.tsx` | **Fix Action save bug**: removed `customDateTime: undefined` from `ReminderPickerSheet.onSave` call — Firebase SDK 10 throws on nested `undefined` values; `stripUndefined` in `lib/firestore.ts` only strips top-level keys so the nested field bypassed it. |
| 2026-04-17 | `app/(main)/tasks/page.tsx` | **ActionDetailPopup header unified**: switched from custom header div to Modal's built-in `title` prop; bottom buttons changed from `sm:grid-cols-3` (stacked on mobile) to `grid-cols-3 gap-2` with `size="sm"`. |
| 2026-04-17 | `app/(main)/tasks/page.tsx` | **TaskModal footer**: new-action mode shows single full-width "Add Action" button; edit mode shows 3-column `grid-cols-3 gap-2` with `size="sm"` buttons. Description `rows` reduced 3→2. |
| 2026-04-17 | `app/(main)/finance/page.tsx` | **KPI card overflow**: `text-lg` → `text-sm truncate`, `gap-3`/`p-3` → `gap-2`/`p-2`, icons 16→14, added `overflow-hidden` on each card. |
| 2026-04-17 | `app/(main)/finance/page.tsx` | **Debt card overflow**: remaining-balance `text-lg` → `text-sm truncate`; total-amount `text-sm` → `text-xs flex-shrink-0`; added `gap-2` on the row; debt action buttons `flex gap-2` → `flex flex-wrap gap-2`. |
| 2026-04-17 | `app/(main)/finance/page.tsx` | **Budget planner overflow**: spent-amount `text-lg font-bold` → `text-sm font-bold truncate`. |

---

*End of `SYSTEM_SPEC.md`.*
