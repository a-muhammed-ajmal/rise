---
name: git-commit
description: Write a Conventional Commits-formatted message from the staged diff, using the correct locked git identity. Use when the user says "commit this", "write a commit message", "commit my changes", or after a logical chunk of work is done and ready to save. Always verify git identity before committing — this account has a specific identity rule that must never be violated.
---

# Git Commit — identity-locked, Conventional Commits

## 0. Identity check — before anything else, every time

This account's git identity is fixed:
- **Always**: `ajmalconsults@gmail.com` (personal Gmail / GitHub account
  email) — this is the only email that should ever appear as commit
  author or co-author.
- **Never**: `writeajmal@gmail.com` — this is a secondary address that
  must never be used, suggested, or added anywhere: not as author, not as
  co-author, not in `.gitconfig`, not in a `Signed-off-by` line. If this
  address appears anywhere in a diff, a config file, or a suggested
  commit trailer, stop and flag it rather than committing.

Before writing any commit, run:
```bash
git config user.email
```
If it doesn't return `ajmalconsults@gmail.com`, **fix the local repo
config** (`git config user.email "ajmalconsults@gmail.com"`) rather than
just overriding the one commit — a per-commit override means the next
commit drifts back to whatever the wrong default was.

## 1. Secret check — before proposing a message

Scan the staged diff for anything that looks like a credential, API key,
`.env` content, or a private key block before doing anything else. If
something matches, **stop and flag it** — don't write a commit message
that would ship it. This is cheap insurance against the single most
common "oh no" in any repo's history.

## 2. Read the actual diff

```bash
git diff --staged
```
If nothing is staged, say so and ask whether to stage everything
(`git add -A`) or specific files — don't guess at what should be included.

## 3. Write the message — Conventional Commits

```
<type>(<scope>): <short imperative subject, ≤50 chars, no period>

<body — what changed and why, wrapped at ~72 chars, bullet points ok>

<footer — only if needed>
```

**Types:**
| Type | Use for |
|---|---|
| `feat` | a new feature or capability |
| `fix` | a bug fix |
| `docs` | documentation only |
| `style` | formatting, no logic change |
| `refactor` | code change that's neither a fix nor a feature |
| `perf` | a performance improvement |
| `test` | adding or fixing tests |
| `chore` | tooling, deps, config — no app code change |
| `ci` | CI/CD pipeline changes |
| `build` | build system or external dependency changes |
| `revert` | reverts a previous commit |

- **Scope** is the module/area touched — `feat(habits): add streak
  calculation`, `fix(auth): correct session refresh timing`. Omit if the
  change spans too many areas to name one.
- **Subject**: imperative mood ("add", not "added" or "adds"), no
  trailing period, ≤50 characters where possible.
- **Body**: explain *why*, not just *what* — the diff already shows what
  changed; the message earns its place by saying why the change was
  necessary.
- **Breaking changes**: a `BREAKING CHANGE:` footer line, always, even if
  the rest of the message is short.
- If the diff touches a Supabase migration, mention that explicitly in
  the body (`Includes migration: enables RLS on habits table`) — schema
  changes are exactly the kind of thing a future `git log` skim should
  surface without opening the diff.

## 4. Confirm before committing

Show the proposed message. Don't run `git commit` until the user
confirms it — committing changes repo history, and a wrong identity or a
leaked secret is much cheaper to catch before the commit than after. If
the user has explicitly said "just commit it" for this session, skip the
confirmation step for that one action only — don't treat it as a
standing instruction for future commits without being told again.

## 5. After commit

Run `git log -1 --format='%an <%ae>'` and confirm the author line shows
`ajmalconsults@gmail.com`. If it doesn't, the commit needs to be amended
(`git commit --amend --reset-author`) before anything else happens —
don't leave a wrong-identity commit in history "to fix later."

## 6. Push to origin/main

After identity is confirmed, push:

```bash
git push origin main
```

Remote: https://github.com/a-muhammed-ajmal/rise

Confirm the push succeeded by checking the output line
(`main -> main`). Never force-push unless the user explicitly asks.
