---
name: ship
description: Ship the current work — lint, test:coverage, build, sync doc metrics, then commit and push to main
---

# /ship — RISE Ship Pipeline

Run the ship script and relay its output to the user.

## Steps

1. Execute the script and stream its full output:

   ```bash
   bash .claude/commands/ship.sh
   ```

2. The script runs, in order (stopping on the first failure):
   - **Lint** — `npm run lint` (auto-fixes with `eslint --fix`, then re-lints)
   - **Test coverage** — `npm run test:coverage`; extracts test count + line coverage
   - **Build** — `npm run build`
   - **Doc sync** — updates `SPEC.md`, `CLAUDE.md`, `README.md` metrics from the
     source of truth (test count, coverage, AI-tool counts, DB tables, migrations)
   - **Commit** — `chore: ship — <N> tests, <X>% — <date>` (author `ajmalconsults@gmail.com`)
   - **Push** — to `main` on `origin`

3. Show the user the script's final **Report** block verbatim. It always prints
   (via an EXIT trap) — on success it ends with `USER ACTION REQUIRED: None.`,
   and on an early failure it ends with `Ship stopped early (exit N)`.

## Notes

- The actual logic lives in [`ship.sh`](./ship.sh) — this command is just its
  entry point, so the script is shell-linted (not markdown-linted) and stays
  consistent with the other `.claude/commands/*.md` files.
- If the script stops early, do **not** attempt to hand-finish the commit/push.
  Surface the reported failure and the `USER ACTION REQUIRED` guidance instead.
