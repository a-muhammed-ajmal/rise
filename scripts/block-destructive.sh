#!/usr/bin/env bash
# Blocks shell commands that are hard to reverse or have wide blast radius.
# Invoked as a Claude Code PreToolUse hook before every Bash call.
# Exit 2 = block; exit 0 = allow.

CMD="${CLAUDE_TOOL_INPUT:-}"

BLOCKED_PATTERNS=(
  "rm -rf"
  "rm -fr"
  "git reset --hard"
  "git push --force"
  "git push -f"
  "git clean -f"
  "git branch -D"
  "drop table"
  "drop database"
  "truncate "
  "delete from"
  "> /dev/sda"
  "mkfs"
  "dd if="
  "chmod -R 777"
  "chown -R"
  "kill -9"
  "pkill -9"
)

lower_cmd=$(echo "$CMD" | tr '[:upper:]' '[:lower:]')

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$lower_cmd" | grep -qF "$pattern"; then
    echo "BLOCKED by block-destructive.sh: matched pattern '${pattern}'" >&2
    echo "If this is intentional, run the command manually in your terminal." >&2
    exit 2
  fi
done

exit 0
