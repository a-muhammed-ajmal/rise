# Archived — concept mockups only

The files in this folder (`html/`, `screenshots/`, `rise-login-v2.png`) are
AI-generated concept explorations from an early design pass. They are **not**
a current source of truth and are not wired into the running app — nothing
under `app/` or `components/` references this folder.

Notably, the bottom-nav label sets shown across these mockups are mutually
inconsistent (e.g. Home/Tasks/Finance/Wellness/More vs. Focus/Insights/Rewind/
Tasks/Settings vs. Nexus/Threads/Compute/Vault/System). The shipped navigation
in [`components/layout/nav-items.ts`](../../components/layout/nav-items.ts) and
[`components/layout/bottom-nav.tsx`](../../components/layout/bottom-nav.tsx)
is authoritative — treat these mockups as historical reference only.

For the current design system, see `.claude/skills/frontend-design/`.
