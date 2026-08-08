# RISE App Analysis

**Review type:** Static architecture, security, product, and code-quality review
**Scope:** Next.js app, Supabase/RLS, AI tools, PWA, migrations, CI configuration

## Overall assessment

RISE has a strong foundation and unusually broad product scope for a personal OS. The modular structure, typed tool executor, Zod validation, signed approval tokens, Supabase RLS, OAuth/PKCE work, and existing tests are all good decisions.

The main risk is not lack of features; it is that the system is becoming complex faster than its verification and operational safeguards. Prioritize correctness and security hardening before adding more modules.

## Priority 0 — fix before relying on production

1. **Daily digest authentication:** `app/api/ai/daily-digest/route.ts` accepts `x-vercel-cron: 1` as sufficient authentication. A public caller can potentially spoof this header and trigger service-role database reads plus Gemini spend. Require `CRON_SECRET` for every request, or verify Vercel's signed cron mechanism exactly as documented.
2. **Daily digest habit status bug:** `runDailyDigestWorkflow` builds a set of `habit_id` values, then checks it with `h.name`; completed habits will be reported as incomplete. Compare IDs consistently.
3. **Analytics column bug:** `get_analytics` filters `habit_logs` with `gte("date", startDate)`, but the schema uses `logged_date`. This can produce errors or empty habit analytics.
4. **Review destructive AI scope:** `delete_link` and `delete_focus_session` appear in the automatic tool set even though they are destructive. Put all delete operations behind the same approval flow.

## Priority 1 — security and reliability

- Add rate limiting and abuse controls to `/api/ai/chat`, `/api/ai/upload`, OAuth token endpoints, and login-related flows. AI calls and audio transcription can create direct cost exposure.
- Do not return raw exception text from the AI SSE endpoint. Log the detailed error server-side and return a generic user-safe message.
- The MCP service-role path bypasses RLS. This is acceptable only while the app is strictly single-user, but every tool should still enforce `userId` explicitly so a future multi-user change cannot create cross-account access.
- Add integration tests that exercise RLS, storage policies, MCP auth, OAuth code replay, refresh-token rotation, and approval-token tampering.
- Convert the manual storage setup notes into repeatable deployment migrations or a documented environment checklist. Missing bucket policies can break uploads or expose private files.

## Priority 2 — code quality and product

- Remove production `any` usage in `app/(app)/assistant/page.tsx`; use the typed Supabase client (`SupabaseClient<Database>`).
- Add a single server-side data-access layer for repeated ownership checks, error handling, and pagination instead of duplicating query patterns across 77 tools.
- Add pagination and search indexes for large notes, tasks, contacts, and transaction lists. Several AI tools and screens currently use fixed limits.
- Make financial writes more conservative: require confirmation for logging income/expenses and changing transaction amounts, not only deletion.
- Add empty, loading, retry, and offline states consistently across every module. The PWA makes this especially important.
- Keep design tokens as the only source for colors. The token system is strong, but direct color literals remain in code/CSS and can drift from the brand rules.

## Validation status

`npm run lint` and `npm run test` could not execute because dependencies are not installed in this checkout (`eslint` and `vitest` were unavailable). No package installation was performed.

## Recommended order

1. Fix cron auth, digest habit mapping, analytics date column, and destructive-tool approval.
2. Add rate limiting and safe production error responses.
3. Add integration/security tests around RLS, Storage, MCP, OAuth, and AI approvals.
4. Run lint, tests, build, and dependency audit in CI.
5. Only then continue expanding modules or AI capabilities.
