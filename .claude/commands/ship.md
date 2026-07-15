#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------
# /ship Workflow Script (Anchored + Git-Diff Enhanced)
# - Runs lint, test:coverage, build
# - Auto-fixes obvious errors when possible
# - Updates SPEC.md, CLAUDE.md, README.md using anchors
# - Uses git diff to detect structural changes for README
# - Commits and pushes
# - Outputs final report
# -------------------------------------------------

REPO_URL="https://github.com/a-muhammed-ajmal/rise"
BRANCH="main"
USER_EMAIL="ajmalconsults@gmail.com"

# Today's date in YYYY-MM-DD
TODAY=$(date +%Y-%m-%d)

# Flags
LINT_STATUS="FAIL"
TEST_STATUS="FAIL"
BUILD_STATUS="FAIL"
SPEC_UPDATED="unchanged"
CLAUDE_UPDATED="unchanged"
README_UPDATED="unchanged"
COMMIT_HASH=""
PUSH_STATUS="FAILED"

TEST_COUNT=""
LINE_COVERAGE=""

# Structural-change flags (computed once, before any doc edits)
HAS_MODULE_CHANGE=false
HAS_AI_TOOL_CHANGE=false
HAS_DB_MIGRATION_CHANGE=false
HAS_DB_TABLE_CHANGE=false

# -------------------------------------------------
# Helper: Extract "Lines" coverage from Jest/Vitest style output
# -------------------------------------------------
extract_lines_coverage() {
  local output="$1"
  local val=""

  # Pattern: "Lines: NUM%"
  val=$(echo "$output" | grep -E 'Lines:' | grep -Eo '[0-9]+\.?[0-9]*' | head -n1)
  if [ -n "$val" ]; then
    echo "$val"
    return 0
  fi

  # Pattern: "Line coverage: NUM%"
  val=$(echo "$output" | grep -E 'Line coverage:' | grep -Eo '[0-9]+\.?[0-9]*' | head -n1)
  if [ -n "$val" ]; then
    echo "$val"
    return 0
  fi

  return 1
}

# -------------------------------------------------
# Helper: Replace the single value line sitting between a pair of
# identical anchors, e.g.:
#   <!--ANCHOR-->
#   old value
#   <!--ANCHOR-->
#
# A counter ensures ONLY the first (opening) anchor triggers the
# replacement, so the closing anchor is left intact and the line
# after it is never consumed. Assumes exactly one value line.
# -------------------------------------------------
replace_between_anchors() {
  local file="$1"
  local anchor="$2"
  local value="$3"

  awk -v anchor="$anchor" -v value="$value" '
    index($0, anchor) {
      cnt++
      if (cnt == 1) {
        print          # print opening anchor
        getline        # consume the single old value line
        print value    # print the new value in its place
        next
      } else {
        print          # print closing (or any later) anchor as-is
        next
      }
    }
    { print }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
}

# -------------------------------------------------
# 1. Lint
# -------------------------------------------------
echo "=== 1. Lint ==="
if ! npm run lint; then
  echo "Lint failed. Attempting auto-fix with eslint --fix ..."

  if npx eslint --fix --ext .js,.jsx,.ts,.tsx .; then
    echo "eslint --fix succeeded. Re-running lint..."
    if npm run lint; then
      LINT_STATUS="PASS"
    else
      echo "Lint still failing after auto-fix. Stopping."
      echo "USER ACTION REQUIRED:"
      echo "  - Review remaining lint errors (npm run lint output)."
      echo "  - Fix them manually or adjust eslint config, then re-run ./ship.sh"
      exit 1
    fi
  else
    echo "eslint --fix failed or could not fix all issues. Stopping."
    echo "USER ACTION REQUIRED:"
    echo "  - Run: npm run lint"
    echo "  - Inspect errors and fix them manually."
    echo "  - Then re-run ./ship.sh"
    exit 1
  fi
else
  LINT_STATUS="PASS"
fi

# -------------------------------------------------
# 2. Test coverage
# -------------------------------------------------
echo "=== 2. Test coverage ==="
TEST_OUTPUT=$(npm run test:coverage | tee /tmp/test_coverage_output.txt)

# Extract test count
TEST_COUNT=""
if [ -z "$TEST_COUNT" ]; then
  TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -Eo 'Tests:\s*[0-9]+\s*passed' | grep -Eo '[0-9]+' | head -n1) || true
fi
if [ -z "$TEST_COUNT" ]; then
  TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -Eo 'test count:\s*[0-9]+' | grep -Eo '[0-9]+' | head -n1) || true
fi
if [ -z "$TEST_COUNT" ]; then
  TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -Eo 'passed [0-9]+' | grep -Eo '[0-9]+' | head -n1) || true
fi

if [ -z "$TEST_COUNT" ]; then
  echo "Could not extract test count from test output. Stopping."
  echo "USER ACTION REQUIRED:"
  echo "  - Run: npm run test:coverage"
  echo "  - Inspect the output and identify the exact test count."
  echo "  - Either adjust the extraction logic in ship.sh or provide the count manually."
  exit 1
fi

# Extract "Lines" coverage using helper
if ! LINE_COVERAGE=$(extract_lines_coverage "$TEST_OUTPUT"); then
  echo "Could not extract 'Lines' coverage from test output. Stopping."
  echo "USER ACTION REQUIRED:"
  echo "  - Run: npm run test:coverage"
  echo "  - Inspect the output and identify the exact 'Lines' coverage percentage."
  echo "  - Either adjust the extraction logic in ship.sh or provide the coverage manually."
  exit 1
fi

echo "Test count: $TEST_COUNT, Lines coverage: $LINE_COVERAGE%"

# We assume PASS if npm didn't fail (set -e would have exited otherwise)
TEST_STATUS="PASS"

# -------------------------------------------------
# 3. Build
# -------------------------------------------------
echo "=== 3. Build ==="
if npm run build; then
  BUILD_STATUS="PASS"
else
  echo "Build failed. Inspect error output above."
  echo "USER ACTION REQUIRED:"
  echo "  - If the error is a TypeScript type error, missing import, or lint issue explicitly described:"
  echo "    - Fix it in the indicated file."
  echo "    - Re-run ./ship.sh"
  echo "  - If the error requires assumptions about intent or architecture:"
  echo "    - Stop and decide on the correct approach."
  echo "    - Then re-run ./ship.sh"
  exit 1
fi

# -------------------------------------------------
# 3b. Capture structural changes BEFORE editing any doc files,
#     so the script's own SPEC/CLAUDE/README edits don't pollute
#     the diff and cause false-positive notes below.
# -------------------------------------------------
GIT_DIFF_NAMES=$(git diff HEAD --name-only 2>/dev/null || true)
GIT_DIFF_FULL=$(git diff HEAD 2>/dev/null || true)

# 1) Module directory created/removed/renamed (top level of common source dirs)
if echo "$GIT_DIFF_NAMES" | grep -qE '^(src|app|modules|features)/[^/]+$'; then
  HAS_MODULE_CHANGE=true
fi

# 2) AI provider/tool added to production code
if echo "$GIT_DIFF_FULL" | grep -qEi '(openai|anthropic|cohere|llama|mistral|supabase-ai)'; then
  HAS_AI_TOOL_CHANGE=true
fi

# 3) DB migration file added/changed
if echo "$GIT_DIFF_NAMES" | grep -qE '^(migrations/|supabase/migrations/|db/migrations/)'; then
  HAS_DB_MIGRATION_CHANGE=true
fi

# 4) DB table added/removed/renamed in migration
if echo "$GIT_DIFF_FULL" | grep -qEi '(CREATE TABLE|DROP TABLE|ALTER TABLE.*RENAME TO)'; then
  HAS_DB_TABLE_CHANGE=true
fi

# -------------------------------------------------
# 4. Update SPEC.md (anchor-based)
# -------------------------------------------------
echo "=== 4. Update SPEC.md ==="
SPEC_FILE="SPEC.md"

if [ ! -f "$SPEC_FILE" ]; then
  echo "SPEC.md not found. Skipping update."
else
  # Anchors expected (one value line between each pair):
  #   <!--SPEC_TEST_COUNT-->
  #   142
  #   <!--SPEC_TEST_COUNT-->
  #
  #   <!--SPEC_LINE_COVERAGE-->
  #   87.6
  #   <!--SPEC_LINE_COVERAGE-->

  if grep -q '<!--SPEC_TEST_COUNT-->' "$SPEC_FILE"; then
    replace_between_anchors "$SPEC_FILE" '<!--SPEC_TEST_COUNT-->' "$TEST_COUNT"
    SPEC_UPDATED="updated"
  else
    echo "SPEC.md does not contain <!--SPEC_TEST_COUNT--> anchor. Skipping test count update."
  fi

  if grep -q '<!--SPEC_LINE_COVERAGE-->' "$SPEC_FILE"; then
    replace_between_anchors "$SPEC_FILE" '<!--SPEC_LINE_COVERAGE-->' "$LINE_COVERAGE"
    SPEC_UPDATED="updated"
  else
    echo "SPEC.md does not contain <!--SPEC_LINE_COVERAGE--> anchor. Skipping coverage update."
  fi
fi

# -------------------------------------------------
# 5. Update CLAUDE.md (anchor-based)
# -------------------------------------------------
echo "=== 5. Update CLAUDE.md ==="
CLAUDE_FILE="CLAUDE.md"

if [ ! -f "$CLAUDE_FILE" ]; then
  echo "CLAUDE.md not found. Skipping update."
else
  # Anchor expected (one line between the pair):
  #   <!--CLAUDE_TESTING_STANDARD-->
  #   - Testing Standard: run 123 tests with 87.6% coverage
  #   <!--CLAUDE_TESTING_STANDARD-->

  if grep -q '<!--CLAUDE_TESTING_STANDARD-->' "$CLAUDE_FILE"; then
    CLAUDE_LINE="- Testing Standard: run ${TEST_COUNT} tests with ${LINE_COVERAGE}% coverage"
    replace_between_anchors "$CLAUDE_FILE" '<!--CLAUDE_TESTING_STANDARD-->' "$CLAUDE_LINE"
    CLAUDE_UPDATED="updated"
  else
    echo "CLAUDE.md does not contain <!--CLAUDE_TESTING_STANDARD--> anchor. Skipping update."
  fi
fi

# -------------------------------------------------
# 6. Update README.md (anchor-based + structural notes)
# -------------------------------------------------
echo "=== 6. Update README.md ==="
README_FILE="README.md"

if [ ! -f "$README_FILE" ]; then
  echo "README.md not found. Skipping update."
else
  # Anchor expected (one value line between the pair):
  #   <!--README_TEST_COUNT-->
  #   142
  #   <!--README_TEST_COUNT-->

  if grep -q '<!--README_TEST_COUNT-->' "$README_FILE"; then
    replace_between_anchors "$README_FILE" '<!--README_TEST_COUNT-->' "$TEST_COUNT"
    README_UPDATED="updated"
  else
    echo "README.md does not contain <!--README_TEST_COUNT--> anchor. Skipping test count update."
  fi

  # Structural rows are NOT auto-incremented (that would require guessing
  # the new count). We only flag them for a manual decision.
  if [ "$HAS_MODULE_CHANGE" = true ]; then
    if grep -q '<!--README_MODULES-->' "$README_FILE"; then
      echo "NOTE: Module changes detected. README.md <!--README_MODULES--> row should be updated manually."
    else
      echo "NOTE: Module changes detected but README.md has no <!--README_MODULES--> anchor."
    fi
  fi

  if [ "$HAS_AI_TOOL_CHANGE" = true ]; then
    if grep -q '<!--README_AI_TOOLS-->' "$README_FILE"; then
      echo "NOTE: AI tool changes detected. README.md <!--README_AI_TOOLS--> row should be updated manually."
    else
      echo "NOTE: AI tool changes detected but README.md has no <!--README_AI_TOOLS--> anchor."
    fi
  fi

  if [ "$HAS_DB_MIGRATION_CHANGE" = true ] || [ "$HAS_DB_TABLE_CHANGE" = true ]; then
    if grep -q '<!--README_MIGRATIONS-->' "$README_FILE"; then
      echo "NOTE: DB migration/table changes detected. README.md <!--README_MIGRATIONS--> and/or <!--README_DB_TABLES--> rows should be updated manually."
    else
      echo "NOTE: DB changes detected but README.md has no migration/table anchors."
    fi
  fi
fi

# -------------------------------------------------
# 7. Commit
# -------------------------------------------------
echo "=== 7. Commit ==="
git add -A

COMMIT_MSG="chore: ship — $TEST_COUNT tests, $LINE_COVERAGE% — $TODAY"
if git -c user.email="$USER_EMAIL" commit -m "$COMMIT_MSG"; then
  COMMIT_HASH=$(git rev-parse HEAD)
else
  echo "Commit failed. Stopping."
  echo "USER ACTION REQUIRED:"
  echo "  - Check git status and any pre-commit hooks or lint/test hooks."
  echo "  - Resolve issues, then re-run: git commit -m \"$COMMIT_MSG\""
  echo "  - Then re-run ./ship.sh (or just push if commit succeeded externally)."
  exit 1
fi

# -------------------------------------------------
# 8. Push
# -------------------------------------------------
echo "=== 8. Push ==="
if git push "$REPO_URL" "$BRANCH"; then
  PUSH_STATUS="SUCCESS"
else
  echo "Push failed. Stopping."
  echo "USER ACTION REQUIRED:"
  echo "  - Check your network and GitHub access (SSH token, HTTPS credentials)."
  echo "  - Ensure you have write access to $REPO_URL on branch $BRANCH."
  echo "  - Run manually: git push $REPO_URL $BRANCH"
  echo "  - Then re-run ./ship.sh (or just continue if push succeeds externally)."
  exit 1
fi

# -------------------------------------------------
# Report
# -------------------------------------------------
echo ""
echo "================================================================"
echo "Report"
echo "================================================================"
echo ""
echo "  Lint:           $LINT_STATUS"
echo "  Tests:          $TEST_COUNT passing, $LINE_COVERAGE% — $TEST_STATUS"
echo "  Build:          $BUILD_STATUS"
echo "  SPEC.md:        $SPEC_UPDATED"
echo "  CLAUDE.md:      $CLAUDE_UPDATED"
echo "  README.md:      $README_UPDATED"
echo "  Commit:         $COMMIT_HASH $COMMIT_MSG"
echo "  Push:           $PUSH_STATUS"
echo ""
echo "  USER ACTION REQUIRED:"
echo "    None."
echo ""