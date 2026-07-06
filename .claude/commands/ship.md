# /ship

## Rules
- Run every step in order.
- If a step fails and the fix is obvious from the error (missing import,
  type error, unused variable, lint warning) — fix it and re-run that
  step. Do not ask. Only fix what the error explicitly says to fix.
- If a step fails and fixing it requires any assumption or user decision —
  stop. Report exactly what failed and exactly what the user must do.
  Do not proceed.
- When all steps pass — update files, commit, push. No confirmation needed.

## Steps

### 1. Lint
Run: npm run lint
On failure:
- Run npx eslint --fix on the affected files then re-run npm run lint.
- If errors remain after auto-fix: stop. List every error with file
  path, line number, and error message. Wait for user.

### 2. Test coverage
Run: npm run test:coverage
Capture: exact test count and exact coverage % from output.
On failure:
- If the failure is a broken import, missing mock, or type mismatch
  the error explicitly describes: fix it and re-run.
- If fixing requires understanding business logic or behaviour: stop.
  Report which test failed, the exact error, what the user must decide.

### 3. Build
Run: npm run build
On failure:
- If it is a TypeScript type error, missing import, or lint issue the
  error explicitly describes: fix it and re-run.
- If it requires any assumption about intent or architecture: stop.
  Report the exact error. Wait for user.

### 4. Update SPEC.md
Find the Current State Snapshot table.
Update only these two rows with values from step 2:
- "Test count" → exact number from step 2
- "Line coverage" → exact % from step 2
Do not touch any other row.

### 5. Update CLAUDE.md
Find the Testing Standard bullet under Objectives.
Update the test count and coverage % to match step 2.
Do not change anything else.

### 6. Update README.md
Find the Project Stats table at the bottom of README.md.
Update only the "Test count" row with the value from step 2.
If the work done since the last ship added, removed, or renamed a module,
an AI tool, a DB table, or a migration — update the relevant row(s).
Do not rewrite prose or touch any other row.
If nothing has changed: leave the file untouched.

### 7. Commit
Run: git add -A
Run: git commit -m "chore: ship — [count] tests, [coverage]% — [YYYY-MM-DD]"
Use actual values. Use today's date.

### 8. Push
Run: git push https://github.com/a-muhammed-ajmal/rise main
User Email ID: ajmalconsults@gmail.com
On any other failure: stop. Report the exact error and what the
user must do to resolve it.

## Report
Output only this at the end:

  Lint:       PASS / FAIL
  Tests:      [count] passing, [coverage]% — PASS / FAIL
  Build:      PASS / FAIL
  SPEC.md:    updated / unchanged
  CLAUDE.md:  updated / unchanged
  README.md:  updated / unchanged
  Commit:     [hash] [message]
  Push:       SUCCESS / FAILED

  USER ACTION REQUIRED:
  If nothing: None.

  If there are Supabase migration to run, list them like this:

  1. Go to Supabase Dashboard → SQL Editor
     Run this SQL:

     ```sql
     ALTER TABLE habits ADD COLUMN reminder_time TIME DEFAULT NULL;
     ```
SQL block must be copy-pasteable exactly as shown.
Never summarise or describe the SQL — always output the full statement.
