# RISE — Personal AI OS

A single-user personal operating system that replaces Todoist, a finance app, a habit tracker, a journal, a CRM, a knowledge base, and an AI assistant — in one cohesive app.

**Live:** [rise.muhammedajmal.com](https://rise.muhammedajmal.com) · [rise-aid-plug.vercel.app](https://rise-aid-plug.vercel.app)

---

## Modules

| Module | What it does |
| --- | --- |
| Dashboard | Daily overview — tasks, habits, goals, and transactions at a glance |
| Productivity | Task management with priorities, due dates, and status tracking |
| Finance | Income/expense tracking in AED with categorisation |
| Wellness | Habit tracking with streak logging and daily progress |
| Goals | Long-term goal tracking with progress percentage |
| CRM | Personal contact and relationship management |
| Knowledge | Note-taking and knowledge base with rich text (Tiptap) |
| AI Assistant | Gemini-powered assistant (Google Gemini 2.5 Flash) with SSE streaming and memory via pgvector |
| Analytics | Charts across all modules (Recharts) |

---

## Stack

- **Framework:** Next.js 16.2.9 (App Router) + TypeScript strict
- **UI:** Tailwind CSS v4 + shadcn/ui + Lucide icons
- **Database:** Supabase (Postgres + pgvector + Row Level Security)
- **AI:** Google Gemini 2.5 Flash via `@google/genai` (SSE streaming + function calling), Voyage AI embeddings (optional)
- **Auth:** Supabase Auth (single-user, Google OAuth)
- **Testing:** Vitest + Testing Library
- **Hosting:** Vercel (Fluid Compute)

---

## Local Development

### Prerequisites

- Node.js 20+
- A Supabase project
- A Google AI (Gemini) API key

### Setup

```bash
git clone https://github.com/a-muhammed-ajmal/rise
cd rise
npm install
```

Copy the environment template and fill in your keys:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
# Optional — keyword fallback activates when absent
VOYAGE_API_KEY=
# Required for Web Push notifications
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

Run migrations in your Supabase dashboard (SQL editor), then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest watch mode
npm run test:coverage
```

---

## Architecture Notes

- **Middleware** lives in `proxy.ts` (Next.js 16 renames `middleware.ts`).
- **RLS pattern:** every table enforces `user_id = auth.uid()` — single-user by design.
- **AI memory:** `match_memories` SQL function uses 1024-dimensional Voyage AI embeddings (migration 004); falls back to keyword search without `VOYAGE_API_KEY`.
- **Currency:** AED throughout; locale is UAE (DD/MM/YYYY, 12-hour time).
- **PWA:** installable with service worker and install prompt.

---

## Deployment

Deployed on Vercel. Push to `main` triggers a production deploy.

For environment variables, use `vercel env` or the Vercel dashboard. Migration 004 must be applied in the Supabase dashboard before the AI memory feature works at full fidelity.
