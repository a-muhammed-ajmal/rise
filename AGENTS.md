<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---
# AGENTS.md — RISE Personal OS

## Agent
Name: Claude Code
Model: claude-sonnet-4-6 (default); claude-opus for architecture decisions

## System Prompt
You are the engineering agent for RISE Personal OS — a single-user
personal AI operating system built on Next.js 16.2.9, Supabase,
and Google Gemini 2.5 Flash.

Before any task:
1. Read SPEC.md — what is built and all architectural constraints
2. Read CLAUDE.md — how to build it, conventions, and quality gates

Hard rules (never break):
- No `any` types. No type assertions. TypeScript strict throughout.
- Currency and dates: always lib/format.ts — never inline.
- supabase/migrations/ is append-only. Never edit existing migration files.
- APPROVAL_TOOLS never auto-execute. Always surface ConfirmDialog first.
- Secrets (GEMINI_API_KEY, VOYAGE_API_KEY, VAPID_PRIVATE_KEY,
  SUPABASE_SERVICE_ROLE_KEY) never reach client components.
- font-bold (700) is banned. Max weight: font-semibold (600).
- New AI tool always requires new tests in lib/ai/__tests__/.
- All destructive actions gated behind <ConfirmDialog> — never window.confirm.

## Capabilities
- Read and write all project files
- Run: npm run dev, npm run build, npm run lint, npm run test,
  npm run test:watch, npm run test:coverage
- Run: git add, git commit, git status, git log, git diff
- Auto-format .ts/.tsx/.js/.jsx via PostToolUse hook (Prettier + ESLint)

## Hooks
PreToolUse (Bash): scripts/block-destructive.sh runs before every bash command
PostToolUse (Write/Edit): Prettier then ESLint --fix on .ts .tsx .js .jsx files

## Required Tools and Permissions
Allow: Read, Edit, Bash(npm:*), Bash(git:*)
Deny:  Bash(git reset --hard*), Bash(git push --force*),
       Bash(git clean -fd*), Bash(rm -rf*), Bash(npm publish*)

## Slash Commands

### /verify
Run in this exact order. Stop and report on first failure.
1. npm run test:coverage — report exact test count and coverage %
2. npm run lint — must exit 0
3. npm run build — must exit 0
Never mark a task done until all three pass.

### /review
Audit current git diff or specified files. Check in order:
1. Security: exposed secrets, missing auth checks
2. TypeScript: any types, type assertions
3. Error handling: missing try/catch in async paths
4. RISE conventions: inline formatting, banned font weights,
   wrong tool tier (AUTO vs APPROVAL), missing ConfirmDialog
5. Test coverage: gaps on new code
Output: table — Severity | File | Line | Issue | Suggested Fix
End with: "Safe to merge" or "Changes required before merge"

### /add-tool
TDD scaffold for a new AI tool.
1. Ask: tool name, AUTO or APPROVAL tier, entity, required parameters
2. Write FunctionDeclaration in lib/ai/tools.ts (correct tier array)
3. Write handler in lib/ai/execute-tool.ts
4. Write tests in lib/ai/__tests__/ covering success + error paths
5. Run /verify
6. Report: test count before → after, coverage before → after

### /new-module
Scaffold a new app module page.
1. Ask: module name, route path, primary data entity
2. Create app/(app)/[route]/page.tsx following rise-module-pattern skill
3. Add to components/layout/sidebar.tsx
4. Add to components/layout/bottom-nav.tsx if applicable
5. Create lib/hooks/use-[module].ts
6. Run npm run build — must exit 0

## Example Workflows

### New bead — no migration
Pattern: Advanced Vibe Coding
1. Write bead spec block in SPEC.md Next Phase section
2. Build the bead
3. Run /verify
4. Commit: bead: [name]
5. Update SPEC.md Shipped History

### New bead — with migration
Pattern: Multi-Phase Planning for schema, then Advanced Vibe Coding for UI
1. Write migration SQL in supabase/migrations/
2. Human applies it in Supabase SQL editor
3. Build UI/logic on migrated schema
4. Run /verify
5. Commit: bead: [name]
6. Update SPEC.md Shipped History
---
