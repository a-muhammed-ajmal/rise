---
name: review
description: Security, performance, type-safety and RISE-convention review of the current git diff
---

# /review — RISE Code Review

Review the current git diff across these dimensions. Output a structured findings table.

## Gathering the diff

1. Run `git diff HEAD`. If it is empty, run `git diff --staged`.
2. If both are empty, output "No changes to review." and stop.
3. Review only hunks present in the diff. Every `File:Line` in your findings
   must correspond to a line that actually appears in the diff — do not infer
   or invent locations, and do not flag pre-existing code the diff doesn't touch.

## Dimensions

### 1. Security

- Are `GEMINI_API_KEY`, `VOYAGE_API_KEY`, `VAPID_PRIVATE_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` referenced in client components?
- Is any secret exposed via a `NEXT_PUBLIC_` env var? Anything prefixed
  `NEXT_PUBLIC_` is inlined into the client bundle — no `*_API_KEY`,
  `*_SERVICE_ROLE_KEY`, or `VAPID_PRIVATE_KEY` should ever carry that prefix.
- Is a service-role Supabase client instantiated anywhere outside a server
  route or server action?
- Are `APPROVAL_TOOLS` being auto-executed without user confirmation?
- Is user input validated at API route boundaries (`/api/**`)?
- Do `/api/**` routes verify `supabase.auth.getUser()` before reading another
  user's rows, not just before writes?
- Are Supabase writes guarded by `supabase.auth.getUser()` + `user_id = user.id`?
- Any `dangerouslySetInnerHTML` fed with user- or DB-sourced content?
- Any `any` type used as an escape hatch that could mask injection?

### 2. TypeScript correctness

- Any `any` types introduced?
- Any `@ts-ignore`, `@ts-expect-error`, non-null assertions (`x!`), or `as`
  casts used to silence the compiler instead of fixing the underlying type?
- Are database types from `lib/types/database.ts` used correctly?
- All new functions fully typed (no implicit `any` params)?

### 3. Performance

- N+1 queries (sequential Supabase calls inside loops)?
- Unbounded Supabase reads (no `.limit()` / `.range()`) that could pull a whole table?
- `select('*')` where only specific columns are used?
- Missing `useCallback` on functions used in `useEffect` deps arrays?
- Values read inside `useEffect` / `useCallback` but missing from the deps array?
- Large synchronous imports that should be dynamic?

### 4. RISE conventions

- Currency formatted with `formatAED()` from `@/lib/format`?
- Dates formatted with `formatDate()` from `@/lib/format`?
- Destructive actions going through `<ConfirmDialog>` from `@/components/ui/confirm-dialog`?
- Feedback via `toast.success()` / `toast.error()` (not `alert()`)?
- New module pages have `"use client"` at line 1?

### 5. Test coverage

- Does new `lib/**` code have a corresponding test file? Flag any new exported
  function in `lib/**` with no test touching it in the diff.
- Coverage % cannot be judged from the diff alone. If you need the real number,
  run `npm run test:coverage` and report the `lib/**` line coverage; otherwise
  flag the gap as Medium and let /ship's coverage gate enforce the ≥85% bar.

## Output format

| # | Severity | Dimension | Finding | File:Line | Fix |
|---|----------|-----------|---------|-----------|-----|
| 1 | 🔴 High | Security | Service role key referenced in client component | foo.tsx:12 | Move to server route |
| 2 | 🟡 Medium | Performance | N+1 query inside contact loop | crm/page.tsx:230 | Batch outside loop |
| 3 | 🟢 Low | Convention | `amount.toFixed(2)` instead of `formatAED()` | finance/page.tsx:88 | Use formatAED(amount) |

Severity scale:
- 🔴 **High** — must fix before merge (security, data loss, broken RLS)
- 🟡 **Medium** — should fix (performance, correctness, coverage gaps)
- 🟢 **Low** — nice to have (convention, style)

End with: **Overall: PASS** (no 🔴 findings) or **FAIL** (has 🔴 findings — do not merge).