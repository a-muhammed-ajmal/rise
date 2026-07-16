# /ship — Quality Gate + Doc Sync + Commit

You are executing the `/ship` workflow for the RISE OS project. Follow every step in order. Do not skip steps. Do not commit until all quality gates pass.

---

## Step 1 — Lint

```bash
npm run lint
```

- Passes → continue.
- Fails → run `npx eslint --fix --ext .js,.jsx,.ts,.tsx .` then re-run `npm run lint`.
  - Now passes → continue.
  - Still fails → **STOP.** List the files and error messages. Tell the user exactly what to fix. Do not proceed.

---

## Step 2 — Tests

```bash
npm run test:coverage
```

Capture from the output:
- **Test count** — the number of passing tests (e.g. `318`)
- **Line coverage %** — the `Lines` percentage for `lib/**` (e.g. `52.27`)

If the command exits non-zero → **STOP.** Report which tests failed. Do not proceed.

---

## Step 3 — Build

```bash
npm run build
```

- Passes → continue.
- Fails → **STOP.** Report the TypeScript or import errors exactly as shown. Do not proceed.

---

## Step 4 — Understand What Changed

Run these two commands:

```bash
git diff HEAD --name-only
git diff HEAD
```

From the output, identify which categories apply (there can be multiple):

| Category | Signal |
| --- | --- |
| `NEW_MODULE` | A new directory appeared under `app/(app)/` |
| `NEW_AI_TOOL` | A new tool name added in `lib/ai/tools.ts` (either array) |
| `NEW_MIGRATION` | A new `.sql` file added to `supabase/migrations/` |
| `NEW_TABLE` | A `CREATE TABLE` statement in the diff |
| `STACK_CHANGE` | `package.json` changed |
| `HOOK_CHANGE` | A file added or modified in `lib/hooks/` |
| `API_ROUTE` | A new directory added under `app/api/` |
| `PHASE_COMPLETE` | Large breadth of changes spanning multiple modules (use judgment) |

---

## Step 5 — Update SPEC.md

Read `SPEC.md` in full. Then edit it based on what Step 4 found.

**Always (every run) — Current State Snapshot table:**
Update these rows with the live values from Step 2 and from counting the repo:
- `Test count` → new test count
- `Line coverage` → new coverage %
- `Migrations` → count `.sql` files in `supabase/migrations/`, update the range (e.g. `16 (001–016)`)
- `DB tables` → count unique `CREATE TABLE` names across all migration files
- `AI tools` → count `name:` entries in `AUTO_TOOLS` and `APPROVAL_TOOLS` in `lib/ai/tools.ts`

**Conditional updates:**

- `NEW_MODULE` → **Modules table**: add a new row — module name (bold) and what it does (one sentence describing its core capability, matching the existing row style).
- `NEW_AI_TOOL` → **Inputs/Outputs › AI tool set**: update the `(N total)` count in the AUTO or APPROVAL header; add the tool name to the correct group row (or add a new group row if it's the first tool for that group). Keep the `·` separator style.
- `NEW_MIGRATION` + `NEW_TABLE` → **Data model section**: update the header to show new table count and migration range; add the new table(s) with column descriptions matching the existing format (e.g. `table_name   id, col1, col2(type), ...`).
- `STACK_CHANGE` → **Technology Constraints table**: update the affected row(s) with the new version or library.
- `PHASE_COMPLETE` → **Shipped History table**: add a new row — increment the phase number, write the feature name, set date to today, list 3–6 key files touched.

**Never touch:** Decision Log, Next Phase, Out of Scope, Success Criteria, Developer Tooling, Performance Targets — these are human-authored sections.

---

## Step 6 — Update CLAUDE.md

Read `CLAUDE.md` in full. Then edit it based on what Step 4 found.

**Always (every run) — Objectives section:**
Find the line `Current: N tests, X%` and update it with the new test count and coverage %.

**Conditional updates:**

- `NEW_MODULE` → **Complete File Structure**: add the new directory under `app/(app)/` with a one-line description matching the existing indentation and comment style.
- `NEW_AI_TOOL` → **AI Tool System**: update the AUTO/APPROVAL counts if they appear in prose. If the new tool has non-obvious behavior (fuzzy match, upsert, dual-write, special logic found in `execute-tool.ts`), add a bullet under **Non-obvious behaviors in `execute-tool.ts`** describing what is surprising.
- `HOOK_CHANGE` → **Complete File Structure**: add or update the file entry under `lib/hooks/` with a one-line description.
- `NEW_TABLE` → **Complete File Structure**: update the `database.ts` comment to reflect the new table count (e.g. `25 Supabase tables`).
- `NEW_MIGRATION` → **Complete File Structure**: update the migration range (e.g. `001 through 016`).

**Never touch:** Hard Rules, Security guardrails, Decision Routing, Build Sequence, Intake Mode Defaults, Subagents, Working Style, Design System Rules, Testing Patterns — these are governance sections.

---

## Step 7 — Update README.md

Read `README.md` in full. Then edit it based on what Step 4 found.

**Always (every run) — Project Stats table:**
Update these rows:
- `Test count` → new test count
- `DB tables` → new table count (keep the `(RLS on all)` suffix)
- `AI tools` → new total (`N (AUTO + APPROVAL)` format)
- `Migrations` → new count and range (e.g. `16 (001–016)`)

Also update the **Stack table**:
- `Database` row → update table count in parentheses
- `Testing` row → update test count in parentheses

**Conditional updates:**

- `NEW_MODULE` → **Modules table**: add the new row — module name (bold) and `What it does` (one sentence, matching existing row style).
- `NEW_AI_TOOL` → **AI Tool System section**: update the `AUTO_TOOLS (N)` count; add the tool name to the correct group row in the table. If it's an APPROVAL tool, add it to the APPROVAL list. Keep the `·` separator style.
- `NEW_MIGRATION` + `NEW_TABLE` → **Database Schema section**: update the header count and migration range; add the new table name to the code block, grouped logically with related tables.
- `STACK_CHANGE` → **Stack table**: update the affected row(s).
- `PHASE_COMPLETE` → **Project Stats table**: update the `Last phase` row label.

**Never touch:** "What is RISE?" narrative, MCP Connector section, Architecture Notes, Deployment section, Local Development env vars listing — these are human-authored.

---

## Step 8 — Commit

```bash
git add -A
git commit --author="Muhammed Ajmal <ajmalconsults@gmail.com>" -m "chore: ship — [N] tests, [X]% — [YYYY-MM-DD]"
```

Replace `[N]` with the test count, `[X]` with the coverage %, `[YYYY-MM-DD]` with today's date.

If the commit fails → **STOP.** Report exactly what the pre-commit hook or git error said.

---

## Step 9 — Push

```bash
git push https://github.com/a-muhammed-ajmal/rise main
```

If the push fails → **STOP.** Report the error. Tell the user to check network/GitHub access and retry manually with the command above.

---

## Step 10 — Final Report

Print this report exactly:

```
=== /ship Report ===

Quality Gates
  Lint:    PASS
  Tests:   [N] passing, [X]% — PASS
  Build:   PASS

Docs Updated
  SPEC.md:   updated — [list what sections changed, e.g. "Current State Snapshot, Modules (added: Settings)"]
  CLAUDE.md: updated — [list what changed]
  README.md: updated — [list what changed]

Commit:  [short hash]  chore: ship — [N] tests, [X]% — [date]
Push:    SUCCESS

User Action Required
  [One bullet per item that needs human attention, e.g.:]
  — SPEC.md / Next Phase: no next phase defined — add what you plan to build next.
  — SPEC.md / Decision Log: a new APPROVAL tool was added — consider logging the rationale.
  — Coverage is at [X]% (target ≥ 85%) — tests need to catch up before the next ship.
  [OR if nothing needs attention:]
  None.
```

Flag "User Action Required" when any of these are true:
- A new module was added but the Next Phase section is empty
- A new APPROVAL tool was added (security-sensitive, worth a Decision Log entry)
- Coverage dropped compared to the previous run, or is below 85%
- The push failed (user must push manually)
- Nothing applies → print `None.`
