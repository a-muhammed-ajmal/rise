# RISE — My Organized Hub for Everything

A personal life management PWA built with Next.js 14, Firebase, and Google Gemini AI.

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/a-muhammed-ajmal/rise.git
cd rise
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your Firebase project config and Gemini API key (see variable names in `.env.local.example`).

### 3. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5.5 |
| UI | React 18 + Tailwind CSS 3 |
| Database | Firebase Firestore |
| Auth | Firebase Auth (Google OAuth) |
| AI | Google Gemini 2.0 Flash |
| PWA | next-pwa |

---

## Features

- **Actions** — Tasks with priorities, targets, recurring schedules, My Day focus
- **Visions** — Goals with NICE framework, milestones, progress tracking
- **Finance** — Income, expenses, debts, budgets in AED
- **Wellness** — Daily rhythms/habits, Pomodoro timer, Winner's Mindset affirmations
- **Professional CRM** — UAE bank leads and deals pipeline
- **Relationships** — Connections with important dates
- **Reviews** — Weekly/monthly/quarterly/yearly GPS reflections
- **Journal** — Daily energy, mood, and text entries
- **Documents** — Document metadata and links
- **AI Chat** — Gemini-powered assistant with voice input and TTS

---

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

---

## Environment variables

See `.env.local.example` for all required variables.

| Variable | Scope |
|----------|-------|
| `NEXT_PUBLIC_FIREBASE_*` | Client + Server |
| `GEMINI_API_KEY` | Server only |
| `NEXT_PUBLIC_APP_URL` | Client + Server |

---

## Project documentation

- [`SYSTEM_SPEC.md`](./SYSTEM_SPEC.md) — As-built status, implementation gaps, and AI agent rules
- [`# RISE — System Specification.txt`](./%23%20RISE%20%E2%80%94%20System%20Specification.txt) — Full frozen product specification
