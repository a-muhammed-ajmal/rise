# RISE — CLAUDE.md

This file contains session-specific instructions for AI coding sessions on the RISE project.

## MANDATORY FIRST STEP

Read `/SYSTEM_SPEC.md` completely before doing anything.

## PROJECT LOCATION

`E:/Muhammed Ajmal OS/Rise`

## QUICK REFERENCE

- **Framework**: Next.js 14 App Router, TypeScript strict
- **Database**: Firebase Firestore (collection names are FROZEN — never rename)
- **AI**: Gemini via `@google/generative-ai` — see `lib/gemini.ts`
- **Styling**: Tailwind CSS — design tokens in `tailwind.config.ts` and `lib/constants.ts`
- **Auth**: Firebase Google OAuth — `components/providers/AuthProvider.tsx`

## UI TERMINOLOGY (NON-NEGOTIABLE)

| UI shows | Internal code |
|----------|--------------|
| Realm    | area/LifeArea (legacy) |
| Target   | Project (collection: `projects`) |
| Action   | Task (collection: `tasks`) |
| Rhythm   | Habit (collection: `habits`) |
| Vision   | Goal (collection: `goals`) |
| Connection | Contact (collection: `connections`) |

## KEY FILES

- `lib/types.ts` — all TypeScript interfaces
- `lib/constants.ts` — all constants, color tokens, terminology
- `lib/firestore.ts` — Firestore CRUD helpers
- `hooks/useCollection` — real-time Firestore hook
- `components/layout/AppLayout.tsx` — main app wrapper
- `components/ui/Modal.tsx` — bottom sheet on mobile, centered on desktop

## CURRENT BUILD PHASE

Phase 1 complete (Core Loop).
Phase 2: Visions, Reviews, Finance — partially complete.
Phase 3: Relationships, Journal, Documents — partially complete.
Phase 4: Professional CRM, AI Chat — partially complete.

## ENV VARIABLES NEEDED

Copy `.env.local.example` to `.env.local` and fill in:
- Firebase project credentials
- `GEMINI_API_KEY`
