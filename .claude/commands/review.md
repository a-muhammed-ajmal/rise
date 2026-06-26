---
name: review
description: Security, performance, type-safety and RISE-convention review of the current git diff
---

# /review — RISE Code Review

Review `git diff HEAD` (or staged changes) across these dimensions. Output a structured findings table.

## Dimensions

### 1. Security
- Are `ANTHROPIC_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` referenced in client components?
- Are `APPROVAL_TOOLS` being auto-executed without user confirmation?
- Is user input validated at API route boundaries (`/api/**`)?
- Are Supabase writes guarded by `supabase.auth.getUser()` + `user_id = user.id`?
- Any `any` type used as an escape hatch that could mask injection?

### 2. TypeScript correctness
- Any `any` types introduced?
- Are database types from `lib/types/database.ts` used correctly?
- All new functions fully typed (no implicit `any` params)?

### 3. Performance
- N+1 queries (sequential Supabase calls inside loops)?
- Missing `useCallback` on functions used in `useEffect` deps arrays?
- Large synchronous imports that should be dynamic?

### 4. RISE conventions
- Currency formatted with `formatAED()` from `@/lib/format`?
- Dates formatted with `formatDate()` from `@/lib/format`?
- Destructive actions going through `<ConfirmDialog>` from `@/components/ui/confirm-dialog`?
- Feedback via `toast.success()` / `toast.error()` (not `alert()`)?
- New module pages have `"use client"` at line 1?

### 5. Test coverage
- New `lib/**` code covered by tests?
- Will `npm run test:coverage` still report ≥85% line coverage on `lib/**`?

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
