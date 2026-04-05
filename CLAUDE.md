# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server with Turbopack
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint
```

No test framework is configured in this project.

Environment: copy `.env.example` to `.env.local` and fill in Firebase and Gemini API keys before running.

## Terminology

RISE uses a strict hierarchy of terms throughout all UI, code, and documentation:

| Term | Meaning | Old term (never use) |
|------|---------|---------------------|
| **Realm** | High-level life domain | Life Area, LifeArea |
| **Target** | Outcome or objective inside a Realm | Project |
| **Action** | Small, concrete step to complete a Target | Task |
| **Rhythm** | Recurring behavior or routine | Habit |

**Hierarchy**: Realm → Target → Action → Rhythm

Rules:
- Every Target belongs to exactly one Realm
- Every Action belongs to exactly one Target
- Every Rhythm is linked to a Realm or Target
- All UI labels, button text, headings, descriptions, and toast messages must use these terms
- Internal TypeScript interfaces (`Task`, `Project`, `Habit`) and Firestore collection names (`tasks`, `projects`, `habits`) remain unchanged for backward compatibility

## Architecture Overview

**RISE** is a Next.js 15 (App Router) personal life management app with Firebase backend and Google Gemini AI integration.

### Routing & Layout

- `app/(auth)/login/` — unauthenticated Google OAuth login
- `app/(main)/` — protected routes; all share `app/(main)/layout.tsx` which renders `AppLayout` (sidebar on desktop, bottom tab bar on mobile)
- `app/api/chat/route.ts` — Gemini 2.5-flash AI chat endpoint
- `app/api/ai-tip/route.ts` — daily AI motivational tip endpoint

### Data Layer

All Firestore interaction goes through `lib/firestore.ts`:
- `useCollection<T>(collectionPath, userId)` — real-time subscription hook; queries by `userId` only (no composite indexes), sorts client-side
- `addDocument` / `updateDocument` / `deleteDocument` — CRUD helpers that auto-inject `userId` and `createdAt`, strip undefined values

**Important**: Queries intentionally avoid `orderBy()` to eliminate composite index requirements. All sorting happens client-side.

Each feature module uses its own Firestore collection (e.g. `tasks`, `projects`, `goals`, `habits`, `transactions`, `leads`, `connections`, `journal-entries`, `reviews`, `documents`).

### Auth

`components/providers/AuthProvider.tsx` wraps the app with Firebase Auth context. Use the `useAuth()` hook anywhere to access `user` and `signOut`.

### Type System

`lib/types.ts` is the single source of truth for all data models. Key interfaces: `Task` (Action), `Project` (Target), `Habit` (Rhythm), `Goal`, `Label`, `Transaction`, `Lead`, `Deal`, `Connection`, `Review`, `ChatMessage`. Also exports configuration constants: `REALMS`, `LIFE_AREAS` (legacy alias), `PRIORITY_CONFIG`, `GTD_CONFIG`, `QUADRANT_CONFIG`, `UAE_BANKS`, `EXPENSE_CATEGORIES`.

### UI Components

Reusable primitives live in `components/ui/`: `Button`, `Input`, `Modal`, `Badge`, `EmptyState`. Use the `cn()` utility from `lib/utils.ts` for conditional Tailwind class merging.

### Styling

Tailwind CSS 4 with a custom theme defined in `app/globals.css`. Primary brand color: `--color-rise: #FF9933` (orange). Dark mode supported. Mobile-specific: `safe-area-*` padding classes and a `slideUp` animation for bottom sheets.

### AI Integration

- Chat (`/api/chat`): accepts `{ message, context, history }` — `context` is the user's full RISE data sent from the client so Gemini can give personalized answers
- AI Tip (`/api/ai-tip`): generates a daily motivational tip from user data; has a hardcoded fallback string

### Feature Modules

| Module | Collection(s) | Notes |
|--------|--------------|-------|
| Actions | `tasks`, `projects`, `labels` | Priority P1-P4, GTD contexts, Eisenhower quadrant, recurrence, target grouping |
| Visions | `goals`, `milestones`, `goal-actions` | NICE framework |
| Finance | `transactions`, `budgets`, `debts` | AED currency |
| Wellness | `habits`, `pomodoro-sessions` | Rhythm streak tracking |
| Professional | `leads`, `deals` | UAE banking CRM (13 banks, 7 emirates) |
| Relationships | `connections` | Contact types, important dates |
| Reviews | `reviews` | GPS framework (Goals, Progress, Strategy) |
| Journal | `journal-entries` | Energy/mood per entry |
| Documents | `documents` | Categorized file metadata |

### Security

`firestore.rules` and `storage.rules` enforce per-user data isolation — users can only read/write documents where `userId == request.auth.uid`.
