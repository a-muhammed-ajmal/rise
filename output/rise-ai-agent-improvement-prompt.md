# RISE App Improvement Prompt

You are a senior Next.js, TypeScript, Supabase, AI-security, and product-engineering agent working on the RISE Personal AI OS repository.

Repository: `E:\Muhammed Ajmal\Dev\Projects\Rise\rise`

Your job is to audit and improve the app carefully. Do not rewrite unrelated code. Preserve the existing architecture, design system, comments, tests, and single-user behavior unless a change is required for correctness or security.

## Before editing

1. Read `README.md`, `CLAUDE.md`, `AGENTS.md`, `spec.md`, `package.json`, and the relevant skills under `.claude/skills/`.
2. Inspect the current implementation before deciding what is already fixed.
3. Create a short implementation plan and identify files that will change.
4. Do not install packages or change environment/system configuration without explicit approval.
5. Never print, commit, or expose secrets from `.env.local` or deployment configuration.

## Priority 0 — fix first

### 1. Secure the daily digest cron
Inspect `app/api/ai/daily-digest/route.ts`.

- Do not treat a caller-controlled `x-vercel-cron: 1` header as sufficient authentication.
- Require a valid `Authorization: Bearer ${CRON_SECRET}` secret, or implement Vercel's verified cron authentication correctly.
- Apply the same protection to both `POST` and `GET`; preferably remove `GET` unless it is needed for a separately authenticated test route.
- Fail closed when `CRON_SECRET` is missing.
- Do not reveal environment-variable details in production responses.
- Add tests proving spoofed headers are rejected and the valid secret is accepted.

### 2. Fix daily digest habit mapping
Inspect `lib/ai/automation.ts` and related tests.

- Habit logs use `habit_id`.
- Build a map from habit ID to habit name and use IDs consistently.
- Ensure done and missed habits are accurate.
- Check the Dubai timezone date calculation and the due-soon calculation.
- Add regression tests for completed, missed, and unknown habit IDs.

### 3. Fix analytics date filtering
Inspect `lib/ai/execute-tool.ts`, especially `get_analytics`.

- The schema uses `habit_logs.logged_date`, not `habit_logs.date`.
- Change the query to use the correct column.
- Check all analytics date columns against the actual migrations.
- Handle query errors explicitly instead of silently returning misleading empty analytics.
- Add tests for week and month analytics.

### 4. Put every destructive AI action behind approval
Inspect `lib/ai/tools.ts`, `app/api/ai/chat/route.ts`, and `lib/ai/execute-tool.ts`.

- `delete_link` and `delete_focus_session` must not auto-execute.
- Add them to the approval-required tool set and approval-name set.
- Verify their resource ownership before displaying approval.
- Require a signed, user-bound, short-lived approval token before execution.
- Ensure MCP cannot expose destructive tools.
- Review all delete, bulk, financial, and irreversible actions for the same behavior.

## Priority 1 — security and reliability

### Rate limiting and abuse prevention
Add a lightweight, production-suitable rate-limit strategy for:

- `/api/ai/chat`
- `/api/ai/upload`
- `/api/oauth/token`
- login/auth-related flows where applicable

The limits must protect Gemini calls, transcription, file processing, OAuth token issuance, and brute-force attempts. Fail closed or degrade safely if the limiter cannot operate. Do not add a package without approval; first check whether an existing Vercel/Supabase-compatible mechanism exists in the project.

### Safe error handling
Inspect all AI API routes.

- Never return raw exception messages, stack traces, provider errors, database errors, or environment-variable names to clients in production.
- Log detailed errors server-side with a request/correlation ID.
- Return stable generic messages such as `AI request failed. Please try again.`
- Preserve useful user-facing validation errors where safe.
- Ensure stream errors close correctly and do not leak secrets.

### Service-role and MCP isolation
Inspect `lib/ai/mcp.ts`, `lib/ai/mcp-oauth.ts`, `app/api/[transport]/route.ts`, and every tool in `lib/ai/execute-tool.ts`.

- Service-role access bypasses RLS, so every MCP tool must enforce the authenticated `userId` explicitly.
- Never accept a user ID from tool input or an untrusted request body.
- Ensure static bearer and OAuth tokens resolve only to the allowed user.
- Keep destructive tools unavailable over MCP.
- Verify OAuth authorization-code single use, PKCE S256, redirect allowlisting, resource/audience matching, token expiry, refresh rotation, and revocation.
- Add tests for cross-user attempts, invalid tokens, replayed codes, wrong redirect URIs, wrong resources, and refresh-token reuse.

### Storage security
Inspect chat and task attachment configuration.

- Confirm both `chat-attachments` and `task-attachments` are private buckets.
- Confirm policies restrict paths to the authenticated user's UUID prefix.
- Confirm upload, select, update/upsert, and delete policies are complete.
- Do not depend on undocumented manual dashboard steps without documenting them in a repeatable deployment checklist or migration-safe setup.
- Validate file size, detected MIME type, extension/path handling, and processing failures.
- Add cleanup behavior for files uploaded before extraction/transcription fails.
- Add tests for cross-user access and oversized or spoofed files.

## Priority 2 — code quality

- Remove production `any` types, especially in `app/(app)/assistant/page.tsx`.
- Use the typed Supabase client and `Database` type.
- Avoid unnecessary `eslint-disable` comments; fix the underlying issue where practical.
- Keep TypeScript strict and do not introduce `any` or unsafe type assertions.
- Refactor repeated tool ownership checks, error handling, pagination, and query patterns into small typed helpers without rewriting all 77 tools at once.
- Ensure every update/delete uses both resource ID and `user_id` when using a non-RLS service-role context.
- Ensure parent-child operations verify ownership across both records, such as interaction/contact, milestone/goal, task/project, and focus-session/task.
- Add pagination and appropriate indexes for notes, tasks, contacts, transactions, AI memory, and other growing tables.
- Review all fixed `.limit()` calls so the UI and AI do not silently hide important records.

## Financial safety

- Require explicit confirmation for logging expenses/income if the request is ambiguous or the amount is material.
- Keep confirmation required for transaction amount changes, deletion, debt updates, and other financial mutations.
- Validate positive amounts, currency assumptions, date ranges, payment-method ownership, and category values.
- Prevent duplicate writes on retries where possible using idempotency keys or safe request handling.
- Add tests for duplicate requests, invalid amounts, foreign payment-method IDs, and transaction ownership.

## Frontend and UX review
Follow `.claude/skills/frontend-design/SKILL.md`.

- Use the existing RISE orange, Inter typography, token system, borders, graph-paper signature, dark mode, and mobile-first layout.
- Do not introduce hardcoded hex colors in new or modified UI code.
- Keep semantic HTML, ARIA labels, visible focus states, 44px touch targets, active feedback, and reduced-motion support.
- Add consistent loading, empty, error, retry, and offline states across modules.
- Ensure the PWA does not show stale or misleading data after failed mutations.
- Check attachment previews, signed URL failures, long text, narrow mobile layouts, keyboard navigation, and screen-reader labels.
- Preserve the current navigation structure and avoid unnecessary visual redesign.

## Database and RLS audit

Review all migrations from `001_schema.sql` through the latest migration.

- Confirm every user-data table has RLS enabled.
- Confirm policies use `TO authenticated` and ownership predicates.
- Confirm `UPDATE` policies include both `USING` and `WITH CHECK`.
- Confirm `user_profile`, push subscriptions, OAuth tables, and any newer tables are covered.
- Check views and functions for `SECURITY INVOKER`/`SECURITY DEFINER` risks.
- Check foreign-key ownership boundaries and indexes used by RLS.
- Check that schema names used by TypeScript match migration names and columns.
- Do not modify production schema directly. If a migration is needed, create a new descriptive migration following the repository workflow.

## Testing and verification

After changes:

1. Run `npm ci` only if dependencies are absent and only after receiving approval.
2. Run `npm run lint`.
3. Run `npm run test`.
4. Run `npm run build`.
5. Run `npm audit --audit-level=high`.
6. Run focused tests for cron auth, digest mapping, analytics, approval tokens, AI tools, OAuth, storage, and RLS.
7. If a command cannot run, report the exact reason; do not claim success.
8. Review the final diff for secrets, unrelated changes, disabled security checks, and accidental data-destructive behavior.

## Acceptance criteria

The work is complete only when:

- Spoofed cron requests cannot trigger service-role reads or Gemini calls.
- Daily digest habit results use correct habit names and statuses.
- Analytics filters habit logs using `logged_date` and reports query failures safely.
- Every destructive AI tool requires approval; no delete tool is accidentally auto-executable or exposed through MCP.
- AI and upload routes have abuse controls or a documented reason and approved follow-up for the chosen rate-limit implementation.
- Production responses do not expose raw internal errors.
- MCP and OAuth tests demonstrate user isolation and token safety.
- Storage policies and setup are documented and tested.
- TypeScript remains strict and new `any` usage is zero.
- Lint, tests, build, and dependency audit results are reported honestly.

## Final response format

Return:

1. Summary of changes
2. Files changed
3. Security findings fixed
4. Tests and commands run with results
5. Remaining risks or blocked items
6. Recommended next steps

Do not silently skip a failed check. Do not install packages, modify secrets, deploy, delete data, or change production infrastructure without explicit approval.
