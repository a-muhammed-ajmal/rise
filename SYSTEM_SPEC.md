# RISE — System Specification

> **Single source of truth for the entire application.**
> Every page, module, name, behavior, rule, UI element, logic flow, and data model is documented here.
> This file MUST be read before any task and updated after every change.

**Last updated:** 2026-04-10

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Terminology](#2-terminology)
3. [Project Structure](#3-project-structure)
4. [Routing & Navigation](#4-routing--navigation)
5. [Authentication](#5-authentication)
6. [Data Models](#6-data-models)
7. [Firestore Collections](#7-firestore-collections)
8. [Pages — Detailed Specification](#8-pages--detailed-specification)
   - 8.1 [Dashboard (Home)](#81-dashboard-home)
   - 8.2 [Actions (Tasks)](#82-actions-tasks)
   - 8.3 [Visions (Goals)](#83-visions-goals)
   - 8.4 [Finance](#84-finance)
   - 8.5 [Wellness (Rhythms)](#85-wellness-rhythms)
   - 8.6 [Professional (CRM)](#86-professional-crm)
   - 8.7 [Relationships](#87-relationships)
   - 8.8 [Reviews](#88-reviews)
   - 8.9 [Journal](#89-journal)
   - 8.10 [Documents](#810-documents)
   - 8.11 [AI Chat](#811-ai-chat)
   - 8.12 [Login](#812-login)
   - 8.13 [Onboarding](#813-onboarding)
9. [Reusable Components](#9-reusable-components)
10. [Configuration Constants](#10-configuration-constants)
11. [Build Phase Status](#11-build-phase-status)

---

## 1. Application Overview

**RISE** is a personal life management application. Full name: **RISE — My Organized Hub for Everything**.

It tracks actions, targets, visions, finances, rhythms, professional CRM, relationships, reviews, journal entries, and documents. It includes an AI assistant powered by Google Gemini.

- **Currency:** AED (UAE Dirham)
- **Region:** UAE-specific (banks, emirates, visa statuses)
- **User:** Single-user app with Google OAuth
- **Framework:** Next.js 14 App Router, TypeScript strict mode
- **Database:** Firebase Firestore
- **Styling:** Tailwind CSS with custom design tokens
- **PWA:** next-pwa for offline support

---

## 2. Terminology

RISE enforces a strict hierarchy of terms. These names MUST be used in all UI labels, headings, buttons, descriptions, and toast messages.

| Term | Meaning | Old term (never use in UI) |
|------|---------|---------------------------|
| **Realm** | High-level life domain | Life Area, LifeArea |
| **Target** | Outcome or objective inside a Realm | Project |
| **Action** | Small, concrete step to complete a Target | Task |
| **Rhythm** | Recurring behavior or routine | Habit |

**Hierarchy:** Realm → Target → Action → Rhythm

**Rules:**
- Every Target belongs to exactly one Realm
- Every Action belongs to exactly one Target (optional) and one Realm
- Every Rhythm is linked to a category
- Internal TypeScript interfaces (`Task`, `Project`, `Habit`) and Firestore collection names (`tasks`, `projects`, `habits`) remain unchanged for backward compatibility

---

## 3. Project Structure

```
rise/
  app/
    (auth)/login/page.tsx          # Login page
    (main)/                        # Protected routes (requires auth)
      layout.tsx                   # Auth guard + AppLayout wrapper
      page.tsx                     # Dashboard / Home
      tasks/page.tsx               # Actions page (5 tabs + Targets tab)
      goals/page.tsx               # Visions page
      finance/page.tsx             # Finance page
      wellness/page.tsx            # Wellness / Rhythms page
      professional/page.tsx        # CRM page (Leads & Deals)
      relationships/page.tsx       # Relationships page
      reviews/page.tsx             # Reviews / GPS page
      journal/page.tsx             # Journal page
      documents/page.tsx           # Documents page
      chat/page.tsx                # AI Chat page
    api/
      chat/route.ts                # AI chat endpoint
      transcribe/route.ts          # Voice-to-text endpoint
      ai-tip/route.ts              # Daily AI tip endpoint
    layout.tsx                     # Root layout
    globals.css                    # Theme, animations, utilities
    sw.ts                          # Service worker
    onboarding/page.tsx            # First-run onboarding wizard
  components/
    providers/
      AuthProvider.tsx             # Firebase Auth context
      SWRegistrar.tsx              # Service worker registration
      PWAInstallPrompt.tsx         # PWA install prompt
    layout/
      AppLayout.tsx                # Sidebar + bottom nav + FAB + toasts
      DesktopSidebar.tsx           # Fixed left sidebar (200px)
      MobileHeader.tsx             # Top 40px header (hamburger + logo)
      MobileBottomNav.tsx          # 3-button sticky bottom bar
      MobileSidebarDrawer.tsx      # Slide-in drawer from left
      MoreSheet.tsx                # "More" overflow sheet
      GlobalFab.tsx                # Floating action button + QuickCreateSheet
      DesktopFab.tsx               # Fixed bottom-right FAB (desktop)
    ui/
      Button.tsx
      Input.tsx                    # Input, Textarea, Select
      Modal.tsx                    # ConfirmModal + Modal (bottom sheet / centered)
      Badge.tsx                    # Badge, PriorityBadge, PriorityDot, StatusBadge
      EmptyState.tsx
      ToastContainer.tsx
      ProgressBar.tsx
      SkeletonCard.tsx             # SkeletonCard, SkeletonListItem, SkeletonStats
      LoadingSpinner.tsx           # LoadingSpinner, FullPageLoader
  hooks/
    useAuth.ts                     # Reads AuthContext
    useFirestore.ts                # useCollection<T> real-time hook
    usePomodoroTimer.ts            # Pomodoro state machine + Firestore save
    useToast.ts                    # Toast queue manager
    useVoiceRecorder.ts            # MediaRecorder wrapper
  lib/
    types.ts                       # All TypeScript interfaces
    constants.ts                   # All constants, color tokens, terminology
    firestore.ts                   # Firestore CRUD helpers
    firebase.ts                    # Firebase init (auth, db, storage)
    utils.ts                       # Date, currency, avatar, string helpers
    sanitizer.ts                   # Input sanitizer + validators
    verify-auth.ts                 # Server-side token verification
    rate-limiter.ts                # API rate limiter
    toast.ts                       # Toast event bus
  firestore.rules
  storage.rules
  CLAUDE.md
  SYSTEM_SPEC.md
```

---

## 4. Routing & Navigation

### 4.1 Route Groups

| Route Group | Purpose | Auth Required |
|-------------|---------|---------------|
| `(auth)` | Login page | No |
| `(main)` | All app pages | Yes — redirects to `/login` if unauthenticated |
| `api` | Server endpoints | Token-based auth per route |
| `onboarding` | First-run wizard | Requires auth but no onboarding check |

### 4.2 Navigation Structure

#### Left Sidebar (All devices)
Fixed 200px on desktop; slide-in drawer on mobile.

| Path | Icon | Label |
|------|------|-------|
| `/` | Home | Home |
| `/tasks` | CheckSquare | Actions |
| `/goals` | Eye | Visions |
| `/finance` | Wallet | Finance |
| `/wellness` | Activity | Wellness |
| `/professional` | Briefcase | Professional |
| `/relationships` | Users | Relationships |
| `/reviews` | Compass | Reviews |
| `/journal` | BookOpen | Journal |
| `/documents` | FileText | Documents |
| `/chat` | MessageSquare | AI Chat |

Active link: orange highlight + dot indicator.

#### Bottom Sticky Bar (Mobile only)
3 quick-access buttons + FAB:

```
[ 🏠 Home ]   [ + FAB ]   [ ✓ Actions ]   [ 🤖 AI Chat ]
```

#### Top Header Bar (Mobile only)
- Height: 40px (h-10)
- Left: Hamburger → opens sidebar drawer
- Center: RISE logo
- Right: Sign-out button (icon only)

### 4.3 Global FAB (Quick-Create)

FAB is pinned to bottom bar center (mobile) and bottom-right (desktop).

| Item | Status |
|------|--------|
| Action | **Enabled** — opens TaskModal on `/tasks?create=true` |
| Lead, Deal, Connection, Income, Expense, Rhythm, Document | Routes to respective page |

---

## 5. Authentication

### 5.1 Client-Side Auth

- `lib/firebase.ts` initializes Firebase Auth
- **Persistence:** explicitly set to `browserLocalPersistence` via `setPersistence()` — session survives browser restarts and new tabs
- `onAuthStateChanged` listener in `AuthProvider.tsx` tracks session state
- Exposes: `user`, `loading`, `signInWithGoogle`, `signOut`
- `useAuth()` hook provides auth context

**Login flow:**
1. User visits `/login`
2. Taps "Sign in with Google" → Firebase `GoogleAuthProvider` popup
3. On success → check `onboardingComplete` in Firestore → redirect to `/onboarding` or `/`
4. `(main)/layout.tsx` auth guard → redirects to `/login` if no user

**Loading state:** `FullPageLoader` (centered pulsing RISE logo)

**Sign out:** Only via explicit user tap on sign-out button in sidebar/header. Never triggered automatically.

### 5.2 Server-Side Auth

All API routes extract and verify Firebase ID token from `Authorization: Bearer <token>` header. Invalid/missing token → 401.

---

## 6. Data Models

### 6.1 Action (interface: `Task`, collection: `tasks`)

```typescript
{
  id: string
  userId: string
  title: string                 // 1–200 characters, required
  description?: string
  realm: string                 // One of 6 REALMS
  area?: string                 // Legacy compat
  targetId?: string             // Link to Target (Project)
  projectId?: string            // Legacy alias for targetId
  goalId?: string
  connectionId?: string
  labelIds?: string[]
  dueDate?: string              // YYYY-MM-DD
  dueTime?: string              // HH:mm (24h)
  priority: Priority            // P1 | P2 | P3 | P4
  isMyDay: boolean
  isStarred: boolean
  isCompleted: boolean
  completedAt?: string          // ISO timestamp
  recurring?: Recurrence        // None | Daily | Weekly | Monthly | Yearly
  parentId?: string
  order: number
  createdAt: string
}
```

### 6.2 Target (interface: `Project`, collection: `projects`)

```typescript
{
  id: string
  userId: string
  title: string                 // 1–100 characters, required
  realm: string                 // One of 6 REALMS
  area?: string                 // Legacy compat
  color: string                 // Auto-assigned from REALM_CONFIG
  icon: string                  // Emoji auto-assigned from REALM_CONFIG
  goalId?: string
  order: number
  isFavorite: boolean
  dueDate?: string
  createdAt: string
}
```

### 6.3 Label (interface: `Label`, collection: `labels`)

```typescript
{ id, userId, name, color, createdAt }
```

### 6.4 Vision (interface: `Goal`, collection: `goals`)

```typescript
{
  id, userId, title, description?, category: VisionCategory,
  why, metric, crystal, timeline: GoalTimeline,
  targetDate?, progress: number, progressHistory: ProgressEntry[],
  isCompleted, completedAt?, createdAt
}
```

### 6.5 Milestone (interface: `Milestone`, collection: `milestones`)

```typescript
{ id, userId, goalId, text, date, type: MilestoneType, done, createdAt }
```

### 6.6 Goal Action (interface: `GoalAction`, collection: `goal-actions`)

```typescript
{ id, userId, goalId, text, done, priority: GoalActionPriority, dueDate?, createdAt }
```

### 6.7 Rhythm (interface: `Habit`, collection: `habits`)

```typescript
{
  id: string
  userId: string
  name: string                  // 1–100 characters, required
  note?: string
  icon: string                  // Emoji (default '💪')
  color: string                 // Hex from RHYTHM_COLORS palette
  category: string              // One of 20 RHYTHM_CATEGORIES
  project: HabitProject
  time?: string                 // HH:mm
  frequency: HabitFrequency     // daily | weekly | monthly | yearly
  customDays?: number[]
  targetCount: number
  goalId?: string
  trigger?: string
  reminder: { enabled: boolean; time: string }
  completions: Record<string, number>    // { 'YYYY-MM-DD': count }
  statusLog: Record<string, HabitStatus> // { 'YYYY-MM-DD': 'pending'|'done'|'failed' }
  streak: number
  bestStreak: number
  isActive: boolean
  order: number
  createdAt: string
}
```

**Status logic:**
- Default: `pending` (key absent from statusLog)
- Mark Done → `statusLog[date] = 'done'`, `completions[date] = 1`, recalculate streak
- Mark Failed → `statusLog[date] = 'failed'`, delete `completions[date]`, recalculate streak
- Reset → delete `statusLog[date]` and `completions[date]`, recalculate streak

**Streak logic:** Count consecutive days ending on today (if done) or yesterday (if today not done) where `statusLog[date] === 'done'`. `bestStreak` updated whenever streak exceeds it.

### 6.8 Pomodoro Session (interface: `PomodoroSession`, collection: `pomodoro-sessions`)

```typescript
{ id, userId, taskId?, startedAt, duration, type: PomodoroType, completed }
```

### 6.9 Pomodoro Settings (localStorage: `rise_pomodoro_settings`)

```typescript
{
  workDuration: number           // default 25
  shortBreakDuration: number     // default 5
  longBreakDuration: number      // default 15
  sessionsBeforeLongBreak: number // default 4
  autoStartBreak: boolean
  autoStartWork: boolean
}
```

### 6.10 Transaction (interface: `Transaction`, collection: `transactions`)

```typescript
{
  id, userId, type: TransactionType, amount, category, date,
  description?, source?, status?: TransactionStatus,
  expenseType?: ExpenseType, paymentMethod?, notes?, createdAt
}
```

### 6.11 Budget / Debt / Lead / Deal / Connection / Review / Journal / Document / ChatMessage

See `lib/types.ts` for complete interface definitions. All collections listed in section 7.

---

## 7. Firestore Collections

| Collection | Interface | Notes |
|-----------|-----------|-------|
| `tasks` | Task | Actions — FROZEN name |
| `projects` | Project | Targets — FROZEN name |
| `labels` | Label | Tags |
| `goals` | Goal | Visions — FROZEN name |
| `milestones` | Milestone | Vision milestones |
| `goal-actions` | GoalAction | Steps for visions |
| `habits` | Habit | Rhythms — FROZEN name |
| `pomodoro-sessions` | PomodoroSession | Timer sessions |
| `leads` | Lead | CRM leads |
| `deals` | Deal | CRM deals |
| `transactions` | Transaction | Income/expense |
| `budgets` | Budget | Monthly limits |
| `debts` | Debt | Debt tracking |
| `connections` | Connection | Relationships |
| `reviews` | Review | GPS reviews |
| `journal-entries` | Journal | Journal entries |
| `documents` | RiseDocument | Document metadata |
| `chat-messages` | ChatMessage | AI chat history |
| `users` | UserMeta | User metadata (onboarding, lastLogin) |

**Query pattern:** All queries filter by `userId == currentUser.uid`.

**Firestore init:** `memoryLocalCache()` — no IndexedDB. Real-time `onSnapshot` listeners. Cross-device sync via Firestore server state.

---

## 8. Pages — Detailed Specification

### 8.1 Dashboard (Home)

**Path:** `/`  
**Status:** Implemented

**Sections:**
1. **Dynamic Greeting** — time-based (Good morning/afternoon/evening + first name), date + time (updates every 60s)
2. **Quick Stats** (2×2 grid) — Done today, Active Targets, Avg Streak, Surplus/Deficit (AED)
3. **Winner's Mindset** — collapsible, 37 hardcoded affirmations, shuffled on load, refresh button
4. **AI Tip Card** — daily tip from `/api/ai-tip`, cached in localStorage per day
5. **Today's Rhythms** — horizontal scroll of daily rhythms, quick Done button
6. **Upcoming Actions** — top 5 overdue/due-today, completion toggle, link to `/tasks`
7. **AI Chat shortcut** — navigates to `/chat`

---

### 8.2 Actions (Tasks)

**Path:** `/tasks`  
**Status:** Fully implemented

**Header:** "Actions" + "New Action" button

**5-Tab Navigation:**

| Tab | Content |
|-----|---------|
| **Today** | Overdue (red section header) + due today. Sorted: overdue first, then by priority |
| **Inbox** | No `targetId`/`projectId`, not completed. Sorted by priority |
| **Upcoming** | `dueDate > today`, not completed. Sorted by `dueDate` ascending |
| **Completed** | `isCompleted && completedAt >= 7 days ago`. Sorted newest first |
| **Targets** | All Targets grouped by Realm with progress bar |

**Tab badges:** Today tab shows count when > 0. Inbox tab shows count when > 0.

**TaskModal fields:**
- Title (required, autofocus)
- Realm selector (6 fixed realms, Select dropdown with emoji prefix)
- Target selector (filtered by selected Realm; resets when Realm changes)
- Priority (4 buttons: Do Now / Important / Get Done / Default — colored by priority)
- Due Date + Due Time (2-column grid)
- Recurring (None / Daily / Weekly / Monthly / Yearly)
- Notes (textarea)
- Today's Focus toggle (sun icon, pill toggle)

**TaskCard layout:**
- Left edge: 4px priority-colored border (P1=`#FF4F6D`, P2=`#FF9933`, P3=`#1E4AFF`, P4=`#8A8A8A`)
- Completion circle (colored by priority, turns teal CheckCircle2 when done)
- Title (strikethrough + muted when completed)
- Badges: `P# · Label` colored badge, recurring letter (D/W/M/Y), sun icon if `isMyDay`
- Due date row (red if overdue; "⚠ Overdue ·" prefix)
- Right: three-dot menu (Edit / Duplicate / Delete) + target/realm label below
- Long-press (600ms): enters bulk selection mode for that card

**Three-dot menu dropdown:** Edit Action, Duplicate, Delete (closes on outside click)

**Bulk selection mode:**
- Long-press any card → enters bulk mode, selects that card
- Banner appears: "{N} selected" + Cancel / Complete / Delete buttons
- Tapping card in bulk mode toggles selection
- Exits when no items selected or Cancel pressed

**Completing recurring Actions:**
- When `recurring !== 'None'` and `dueDate` exists: auto-create next instance before marking done
- Next due: Daily +1d, Weekly +7d, Monthly +1 month, Yearly +1 year

**Duplicate Action:** Same fields, title appended " (Copy)", new `createdAt`/`order`, `isCompleted: false`.

**Targets tab:**
- "New Target" button at top
- Targets grouped by Realm (only shows realms that have at least one Target)
- Realm group header: emoji + realm name + divider line
- TargetCard: realm emoji + title + realm badge + due date + progress bar (done/total actions) + "X/Y actions done"
- TargetCard actions: ★ favorite toggle, pencil edit, trash delete
- Delete Target: orphans linked Actions (sets `targetId`/`projectId` to `undefined`), does NOT delete Actions

**ProjectModal fields:**
- Target Name (required)
- Realm selector (6 fixed realms)
- Due Date (optional)
- Realm preview card (emoji + name + description)
- Color + emoji auto-assigned from `REALM_CONFIG`

**URL param:** `?create=true` opens TaskModal immediately, then clears param from URL.

---

### 8.3 Visions (Goals)

**Path:** `/goals`  
**Status:** Basic implementation (not in current task scope)

---

### 8.4 Finance

**Path:** `/finance`  
**Status:** Basic implementation (not in current task scope)

---

### 8.5 Wellness (Rhythms)

**Path:** `/wellness`  
**Status:** Fully implemented

**Header:** "My Rhythms" + Timer button + "Add Rhythm" button

**KPI Cards (shown only when rhythms exist):**
- Today's Completion — `done/total` with teal progress bar + %
- Avg Streak — mean of all active rhythm `streak` values (days)
- Best Streak — max `bestStreak` across all active rhythms (days)
- Pending Today — count of active rhythms with no `statusLog[today]` entry

**RhythmCard layout:**
- Name (strikethrough + muted text when `done`)
- Time in AM/PM format with clock icon (if set)
- Category badge (colored pill from `CATEGORY_COLORS`)
- Right side when `pending`: green Done button (round 40px) + red Failed button (round 40px)
- Right side when `done`/`failed`: clickable status badge ("✓ Done" or "✕ Failed") → tap resets to pending
- Card opacity 50% when `done` or `failed`

**Card sorting:** pending first → by time ascending (no time = last) → alphabetically

**Tapping the card (not action buttons):** Opens `RhythmPopup`

**RhythmPopup — View mode:**
- Title as modal heading
- Note text (if any)
- 2×3 info grid: Time, Category, Frequency, Reminder (ON/OFF + time), Streak (🔥 if >3d), Best Streak 🏆
- 7-day activity strip: ✓ green for done, ✕ red for failed, empty for pending/future
- Footer buttons: Edit | Duplicate | Delete

**RhythmPopup — Edit mode (inline):**
- Replaces view content with form fields: Title, Short Note, Category, Time, Frequency, Reminder toggle
- Footer buttons: Cancel | Save Changes

**RhythmModal (create new):**
- Fields: Title (required), Short Note (2-row textarea), Category (20 options), Time, Frequency, Reminder toggle
- Color auto-assigned from category index in `RHYTHM_COLORS`
- Icon defaults to '💪'

**Duplicate:** Same fields, name gets " (Copy)" suffix, `streak`/`bestStreak` reset to 0, empty `completions`/`statusLog`.

**Delete:** Confirmation dialog → `deleteDocById`.

**Pomodoro Timer:**
- Toggle button (Timer icon) in header
- Appears as floating panel (bottom-right)
- Circular SVG progress ring with time in center (MM:SS) + session counter
- Reset | Play/Pause | Skip controls
- Settings modal: work/short/long durations (number inputs)
- Settings persisted in `localStorage` (`rise_pomodoro_settings`)
- Completed sessions saved to `pomodoro-sessions` collection

---

### 8.6 Professional (CRM)

**Path:** `/professional`  
**Status:** Basic implementation (not in current task scope)

---

### 8.7 Relationships

**Path:** `/relationships`  
**Status:** Basic implementation (not in current task scope)

---

### 8.8 Reviews

**Path:** `/reviews`  
**Status:** Basic implementation (not in current task scope)

---

### 8.9 Journal

**Path:** `/journal`  
**Status:** Basic implementation (not in current task scope)

---

### 8.10 Documents

**Path:** `/documents`  
**Status:** Basic implementation (not in current task scope)

---

### 8.11 AI Chat

**Path:** `/chat`  
**Status:** Implemented (Phase 4)

Chat history persisted in Firestore `chat-messages`. Voice input via `/api/transcribe`. Context sent per message includes Actions, Visions, Rhythms, Transactions, Leads, Deals, Connections, Reviews.

---

### 8.12 Login

**Path:** `/login`  
**Status:** Implemented

Centered card, Google sign-in, auto-redirects if already authenticated. No re-prompt if session active.

---

### 8.13 Onboarding

**Path:** `/onboarding`  
**Status:** Implemented

3-step wizard: Welcome → Choose Realms (from preset list + custom) → Create first Target. Sets `onboardingComplete: true` in Firestore user doc on completion.

---

## 9. Reusable Components

### 9.1 Button
Variants: `primary` (orange), `secondary` (bordered), `ghost`, `danger` (red).  
Sizes: `sm` (h-8), `md` (h-11, default), `lg` (h-14).  
Props: `loading` (shows spinner), `fullWidth`, standard HTML button attrs.

### 9.2 Input / Textarea / Select
All share: `label`, `error`, `helper`, `required` (red asterisk), `disabled`.  
Dark styling: `bg-[#1C1C1C]`, `border-[#2A2A2A]`, orange focus ring.

### 9.3 Modal / ConfirmModal
- **Modal:** Bottom sheet (mobile) / centered dialog (desktop). `title`, `footer`, `forceModal` prop to always show as dialog.
- **ConfirmModal:** `title`, `message`, `confirmLabel`, `confirmVariant` (danger/primary).
- Body scroll locked when open. Escape key closes. Backdrop tap closes.

### 9.4 Badge / PriorityBadge / PriorityDot / StatusBadge
`Badge`: colored pill with custom `color` (hex → bg/text/border with opacity). Default: gray.  
`PriorityBadge`: `P# · Label` with priority color.  
`PriorityDot`: small colored circle.

### 9.5 ProgressBar
`value`, `max` (default 100), `color`, `height` (px), `showLabel`, `label`. Smooth CSS transition.

### 9.6 EmptyState
Centered icon + title + subtitle + optional action button.

### 9.7 ToastContainer
Position: bottom-center (mobile) / bottom-right (desktop). Types: success/error. Auto-dismiss 3s. Optional undo action button.

### 9.8 SkeletonCard / SkeletonListItem / SkeletonStats
Animated pulse loading placeholders.

### 9.9 GlobalFab / QuickCreateSheet
QuickCreateSheet: 2×4 grid of quick-create icons. Navigates to respective page. Desktop FAB: fixed bottom-right.

### 9.10 AppLayout
Wraps all `(main)` pages. Composes: DesktopSidebar, MobileHeader, MobileSidebarDrawer, MoreSheet, QuickCreateSheet, DesktopFab, MobileBottomNav, ToastContainer, PWAInstallPrompt.

---

## 10. Configuration Constants

### 10.1 Realms (6 — FROZEN)

| ID | Emoji | Color | Description |
|----|-------|-------|-------------|
| Professional | 💼 | #1E4AFF | Focus, clarity, execution |
| Personal | 🎯 | #FF6B35 | Identity, creativity, self-expression |
| Financial | 💰 | #FFD700 | Growth, stability, wealth |
| Relationship | ❤️ | #FF4F6D | Connection, empathy, warmth |
| Wellness | 🧘 | #1ABC9C | Balance, health, vitality |
| Vision | ✨ | #800080 | Purpose, long-term direction, ambition |

`REALM_CONFIG` in `lib/constants.ts` maps realm name → `{ emoji, color, description }`.

### 10.2 Priority Labels

| ID | UI Label | Color |
|----|----------|-------|
| P1 | Do Now | #FF4F6D (red) |
| P2 | Important | #FF9933 (amber) |
| P3 | Get Done | #1E4AFF (blue) |
| P4 | Default | #8A8A8A (gray) |

### 10.3 GTD / Quadrant — Removed from UI

Fields still exist in `Task` interface and `lib/types.ts` for backward compatibility. `GTD_CONFIG` and `QUADRANT_CONFIG` constants must not be deleted if they exist.

### 10.4 Rhythm Categories (20)

Affirmation, Meditation, Dedication, Discipline, Fitness, Learning, Spiritual, Personal Growth, Health, Work, Productivity, Morning Routine, Evening Routine, Finance, Social, Creativity, Mindfulness, Nutrition, Self-Care, Other

### 10.5 Vision Categories (6)

Personal, Professional, Financial, Relationships, Health, Learning

### 10.6 Goal Timelines

`1yr`, `3yr`, `5yr`

### 10.7 UAE Banks (14)

Emirates NBD, Abu Dhabi Commercial Bank (ADCB), First Abu Dhabi Bank (FAB), Dubai Islamic Bank (DIB), Mashreq Bank, RAKBANK, Commercial Bank of Dubai (CBD), Sharjah Islamic Bank, National Bank of Fujairah, United Arab Bank, Standard Chartered, HSBC, Citibank, Other

### 10.8 UAE Emirates (7)

Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Fujairah, Umm Al Quwain

### 10.9 Income Categories (8)

Salary, Freelance, Commission, Bonus, Investment, Rental, Business, Other Income

### 10.10 Expense Categories (17)

Housing, Food & Dining, Transport, Healthcare, Education, Entertainment, Shopping, Utilities, Insurance, Travel, Fitness, Subscriptions, Loans & Debt, Charity, Family, Personal Care, Other

### 10.11 Payment Methods (7)

Cash, Credit Card, Debit Card, Bank Transfer, Cheque, Apple Pay, Other

### 10.12 Document Categories (8)

Legal, Financial, Medical, Travel, Educational, Personal, Work, Other

### 10.13 Connection Types (9)

Spouse, Child, Parent, Sibling, Friend, Colleague, Mentor, Client, Other

### 10.14 Review Types

weekly, monthly, quarterly, yearly

### 10.15 Target Preset Colors (18)

`#b8255f` `#db4035` `#ff9933` `#fad000` `#7ecc49` `#299438` `#6accbc` `#158fad` `#14aaf5` `#96c3eb` `#4073ff` `#884dff` `#af38eb` `#eb96eb` `#e05194` `#ff8d85` `#808080` `#b8b8b8`

### 10.16 Rhythm Preset Colors (10)

`#FF9933` `#DC4C3E` `#4073FF` `#2D7C3E` `#7B4B9E` `#E8849B` `#4A9B8E` `#F49C18` `#10B981` `#EF4444`

### 10.17 Design Tokens

| Token | Value |
|-------|-------|
| background | #0A0A0A |
| surface | #141414 |
| surfaceElevated | #1C1C1C |
| border | #2A2A2A |
| textPrimary | #F0F0F0 |
| textSecondary | #8A8A8A |
| textPlaceholder | #505050 |
| orange | #FF6B35 |
| green | #1ABC9C |
| red | #FF4F6D |
| blue | #1E4AFF |
| yellow | #FFD700 |
| purple | #800080 |

---

## 11. Build Phase Status

| Module | Status | Notes |
|--------|--------|-------|
| Authentication | ✅ Complete | `browserLocalPersistence` explicit, persists across restarts |
| Dashboard | ✅ Complete | Stats, affirmations, AI tip, rhythm strip, upcoming actions |
| Actions (Tasks) | ✅ Complete | 5 tabs, TaskModal, 3-dot menu, bulk select, recurring, Targets tab |
| Targets (Projects) | ✅ Complete | ProjectModal, realm grouping, progress bar, favorite, orphan handling |
| Rhythms (Habits) | ✅ Complete | KPI cards, Done/Failed/Reset, popup view/edit, duplicate, delete, streak calc, Pomodoro |
| Visions (Goals) | 🟡 Partial | Basic CRUD, progress slider, timeline filter |
| Finance | 🟡 Partial | Income/Expense tracker, Debt tracker, Budget planner |
| Professional CRM | 🟡 Partial | Leads tab, Deals tab with status filters |
| Relationships | 🟡 Partial | Connection cards, important dates |
| Reviews | 🟡 Partial | GPS review form, history list |
| Journal | 🟡 Partial | Entry form with energy/mood, history list |
| Documents | 🟡 Partial | Category filter, search, document cards |
| AI Chat | 🟡 Partial | Gemini integration, voice input, TTS, Firestore persistence |
| Onboarding | ✅ Complete | 3-step wizard, realm seeding |
| PWA | ✅ Complete | next-pwa, service worker, install prompt |
