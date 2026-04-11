# RISE — As-built status & agent rules

> **This file is the living companion to the frozen product plan.**  
> Full product behavior, data models, target stack, and UI intent live in **`# RISE — System Specification.txt`** at the repo root. Read that file first for *what RISE is meant to be*. Read *this* file for *what the repository implements today*, how to work on it safely, and mandatory rules for AI-assisted edits.

**Last updated:** 2026-04-11 (§8: no extras without explicit user request; verify spec or ask)

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

Pinned from `package.json` and config (not from the plan’s §2 table, which describes a *target* stack).

| Layer | As implemented |
|-------|----------------|
| Framework | Next.js **14.2.x** (App Router) |
| Language | TypeScript **5.5.x** |
| UI | React **18.3.x** |
| Styling | Tailwind CSS **3.4.x** |
| Database | Firebase **^10.14** (Firestore) |
| Auth | Firebase Auth (Google popup) |
| Storage | Firebase Storage (initialized in `lib/firebase.ts`) |
| AI | `@google/generative-ai` **0.15.0** — see `lib/gemini.ts` (default model name `gemini-1.5-flash`) |
| Icons | `lucide-react` **0.446.0** |
| PWA | `next-pwa` **^2.0.2** — `next.config.js`, output under `public/` |
| Class merge | `clsx`, `tailwind-merge` |

**Not present in `package.json` today** (but may appear in the plan): React 19, Next 15, Tailwind 4, Serwist, Framer Motion, Recharts, React Hook Form, Zod, Zustand, date-fns, `@google/genai` package name.

---

## 3. Plan vs code: intentional deltas

These are notable differences between `# RISE — System Specification.txt` and this repository.

| Topic | Plan (`.txt`) | Code (as-built) |
|-------|----------------|-------------------|
| §2 Technology table | Next 15, React 19, Tailwind 4, Serwist, etc. | Next 14, React 18, Tailwind 3, `next-pwa` |
| §4 Project structure | `components/tasks/TaskCard.tsx`, `app/sw.ts` Serwist | `TaskCard` is **inline** in `app/(main)/tasks/page.tsx`; **no** `app/sw.ts` |
| §5.4 Global FAB | Most quick actions “disabled/coming soon” | **All** quick actions **navigate** via `AppLayout` (`/tasks?create=true`, `/professional?…`, `/finance?…`, etc.) |
| §9.1 Dashboard | Quick stats, Today’s Focus, Be Consistent list, Get Things Done, Target Progress | **Simpler** home: greeting, Winner’s Mindset, AI tip, Today’s Rhythms **strip**, Upcoming Actions, AI chat shortcut — **no** stats grid, **no** `isMyDay` block, **no** goal progress section |
| §9.3 Visions | NICE box, milestones, rich cards | Vision **CRUD**, filters, modal with NICE fields, cards with progress — **no** milestone UI, **no** separate NICE info box |
| §9.4 Finance | Rich income/expense/debt/budget per spec | **Transactions / Budgets / Debts** tabs with CRUD; categories from `lib/constants.ts` — **not** identical lists to plan §17.7 in all labels |
| §9.11 AI Chat | Rich context blob, markdown rendering, TTS, voice pipeline | Firestore history, `/api/chat` with **optional** `context` (client **does not** send full sanitized app context today); **no** TTS buttons; **no** markdown renderer in UI; voice uses `/api/transcribe` which is a **stub** |
| §11 API | POST `/api/ai-tip` with body, daily rate limit | **`GET`** `/api/ai-tip` — no separate daily tip rate limiter in code |
| §11 `/api/transcribe` | Gemini multimodal + cleanup | **Stub**: returns placeholder; `useVoiceRecorder` expects `data.text` — **transcription does not populate** from API |
| §16 PWA | Serwist `app/sw.ts`, custom runtime cache order | **`next-pwa`** only |
| §18 Env | `.env.example` | **No** committed `.env.example` / `.env.local.example` in repo (add in next steps) |
| Vision categories (plan §17.10) | Six categories including Relationship, Wellness, Vision naming | **`lib/constants.ts`** `VISION_CATEGORIES`: includes `Relationships`, `Health`, `Learning` — align with code when implementing UI |

---

## 4. Implementation status (vs plan §9)

Statuses: **Complete** (usable end-to-end), **Partial** (works but missing plan details), **Stub** (placeholder only).

| Area | Plan § | Status | Notes |
|------|--------|--------|--------|
| Auth / session | §6 | **Complete** | `AuthProvider`, `browserLocalPersistence`, `(main)/layout.tsx` guard |
| Login | §9.12 | **Complete** | Google sign-in; authed users → `/` — **no** `onboardingComplete` gate |
| Dashboard | §9.1 | **Partial** | Missing plan’s quick stats, Today’s Focus, Be Consistent expanded list, target progress |
| Actions | §9.2 | **Partial** | Five tabs, modals, bulk select, recurring behavior in code — verify parity with plan in a future pass |
| Visions | §9.3 | **Partial** | CRUD + filters; no milestone management UI |
| Finance | §9.4 | **Partial** | Transactions, budgets, debts; field/category sets per `constants.ts` |
| Wellness | §9.5 | **Complete** | Rhythms KPIs, cards, popup, Pomodoro hook — closest to plan |
| Professional CRM | §9.6 | **Partial** | Leads/Deals tabs, modals; Deal modal fields subset vs full plan |
| Relationships | §9.7 | **Partial** | Connections CRUD, filters, upcoming birthdays; modal fields subset vs plan (e.g. date types/reminders) |
| Reviews | §9.8 | **Partial** | Weekly/monthly/quarterly/yearly tabs, GPS fields; not full plan matrix |
| Journal | §9.9 | **Partial** | Energy, mood, text, voice hook (same transcribe limitation) |
| Documents | §9.10 | **Partial** | Filter, search, CRUD; categories per `DOCUMENT_CATEGORIES` |
| AI Chat | §9.11 | **Partial** | Persistence, Gemini reply; missing rich context, TTS, markdown, working server transcription |
| Onboarding | (not in old §9.12 only) | **Stub** | `app/onboarding/page.tsx` immediately redirects to `/`; `useOnboarding` exists but **not** wired from login |
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
      tasks/page.tsx             # Actions (TaskCard defined inline)
      goals/page.tsx
      finance/page.tsx
      wellness/page.tsx
      professional/page.tsx
      relationships/page.tsx
      reviews/page.tsx
      journal/page.tsx
      documents/page.tsx
      chat/page.tsx
    api/
      chat/route.ts
      transcribe/route.ts
      ai-tip/route.ts
    onboarding/page.tsx          # Stub redirect
    layout.tsx
    globals.css
  components/
    layout/                      # AppLayout, sidebars, FAB, sheets, nav
    providers/                   # Auth, PWA, SW registrar
    ui/                          # Button, Input, Modal, Badge, etc.
  hooks/
    useAuth.ts
    useFirestore.ts              # useCollection + mutations
    usePomodoroTimer.ts
    useToast.ts
    useVoiceRecorder.ts
    useOnboarding.ts
  lib/
    types.ts
    constants.ts
    firebase.ts
    firestore.ts
    utils.ts
    sanitizer.ts
    verify-auth.ts
    rate-limiter.ts
    toast.ts
    gemini.ts
    validations.ts
  firestore.rules
  storage.rules
  SYSTEM_SPEC.md                 # This file
  # RISE — System Specification.txt
```

There is **no** `components/tasks/` directory: task UI lives in `app/(main)/tasks/page.tsx`.

---

## 6. Firestore & data

- **Collection names** are **frozen** — see `COLLECTIONS` in `lib/constants.ts` and the plan §8. Never rename collections in Firestore or code without a migration plan.
- **Full field-level schemas** remain in `# RISE — System Specification.txt` §7 and `lib/types.ts`. This file does not duplicate them to avoid drift.
- **Firestore init:** `memoryLocalCache()` in `lib/firebase.ts` — aligns with plan narrative on avoiding IndexedDB cache divergence.
- **User metadata:** `users` collection / `UserMeta` for flags like `onboardingComplete` — see `lib/firestore.ts`.

---

## 7. API routes (as-built)

| Route | Auth | Behavior |
|-------|------|----------|
| `POST /api/chat` | Bearer Firebase ID token | `verifyAuthToken`, rate limit (`lib/rate-limiter.ts`), `generateChatResponse` in `lib/gemini.ts` |
| `POST /api/transcribe` | Bearer | **Stub** — does not return real `text` for `useVoiceRecorder` |
| `GET /api/ai-tip` | Bearer | Generates tip via `generateText`; fallback string on error |

---

## 8. AI agent rules (mandatory)

These rules replace the former `CLAUDE.md` instructions. Follow them on **every** edit unless the human explicitly overrides them for a one-off task.

### 8.1 Mandatory first step

1. Read **`# RISE — System Specification.txt`** for product intent, terminology, and data shapes.  
2. Read **this file** for as-built status and gaps.

### 8.2 Execution discipline

1. Do **only** what the task explicitly asks. Do not refactor, rename, or “clean up” unrelated code.  
2. If something is not requested, do not change it.  
3. **Do not add** new files, folders, tooling, or editor config (including under `.cursor/`, new markdown docs, scripts, or dependencies) **unless the user explicitly asked for that addition.** “Optional” in an old plan is not permission—only the user’s message is.  
4. **Do not guess.** If scope, behavior, or repo state is unclear, **read** `# RISE — System Specification.txt` and this file, and/or **ask the user**. Do not invent workflows, filenames, or git identity.  
5. After completing a **code** task: update **this** `SYSTEM_SPEC.md` if behavior or structure changed, run **`npm run build`** (zero errors), then **commit** and **push** only when the task says so **and** git author config exists—**do not** fabricate `user.name` / `user.email`; if commit is blocked, tell the user to configure identity or commit themselves.  
6. No assumptions, no extras, no “while I’m here” changes.

### 8.3 UI terminology (non-negotiable)

| UI label | Internal / Firestore |
|----------|----------------------|
| Realm | `area` / legacy LifeArea |
| Target | `Project` — collection `projects` |
| Action | `Task` — collection `tasks` |
| Rhythm | `Habit` — collection `habits` |
| Vision | `Goal` — collection `goals` |
| Connection | `Connection` — collection `connections` |

### 8.4 Key files

- `lib/types.ts` — TypeScript interfaces  
- `lib/constants.ts` — constants, colors, frozen collection names  
- `lib/firestore.ts` — CRUD and subscriptions  
- `hooks/useFirestore.ts` — `useCollection` and related hooks  
- `lib/gemini.ts` — Gemini calls  
- `components/layout/AppLayout.tsx` — shell, navigation, FAB routing  

### 8.5 Environment variables

For local development, configure Firebase and `GEMINI_API_KEY` in `.env.local` (see plan §18 for variable names). A committed template file is **missing** — add `.env.local.example` when implementing env docs.

---

## 9. Next steps

1. **Dashboard parity** with plan §9.1 (stats, Today’s Focus, Be Consistent block, goals snippet) **or** formally narrow the plan — do not silently assume.  
2. **Onboarding:** implement the wizard described in the plan **or** remove stub/`useOnboarding` dead paths and document.  
3. **Add `.env.local.example`** mirroring plan §18.  
4. **`/api/transcribe`:** implement real transcription or switch journal/chat to **Web Speech API** client-side and align docs.  
5. **`/api/ai-tip`:** align method, rate limits, and dashboard fetch with plan §11 if product requires it.  
6. **AI Chat:** optional injection of sanitized Firestore context into `POST /api/chat` body to match plan §9.11.  
7. **Dependencies:** align `eslint-config-next` major with Next 14 to reduce tooling drift.  
8. **Optional:** extract `TaskCard` to `components/tasks/` to match plan structure.

---

## 10. Known issues & risk areas

| Issue | Detail |
|-------|--------|
| **ESLint / Next mismatch** | `eslint-config-next` **^16** with `next` **14** — may cause odd lint behavior; align versions when convenient. |
| **Voice transcription** | `/api/transcribe` stub + empty `data.text` → `useVoiceRecorder` does not receive transcripts from the server. |
| **AI tip API** | Implemented as `GET`; plan describes `POST` and stricter daily limits. |
| **Chat context** | Rich, sanitized context pipeline from plan is **not** wired from client to `/api/chat`. |
| **Missing env template** | No `.env.example` in repo; onboarding for new devs is harder. |
| **Onboarding page** | Redirect-only; conflicts with any expectation of a multi-step flow until implemented or removed. |

---

*End of `SYSTEM_SPEC.md`.*
