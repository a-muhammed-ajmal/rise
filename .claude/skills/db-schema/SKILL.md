---
name: db-schema
description: Supabase/Postgres schema design, migrations, and Row Level Security review. Use when creating or modifying a table, writing a migration, designing or reviewing an RLS policy, or answering "is this table secure" / "does this leak data". Triggers on "design this table", "add a migration for X", "create the schema for X", "review this RLS policy", "can other users see this data". Treat RLS as the default security boundary, not an optional hardening pass — a table holding user data is not done until RLS is enabled and policy-tested, in the same migration.
---

# DB Schema — Supabase Schema, Migrations & RLS

You are reviewing or designing database changes for a Supabase/Postgres
project. The rule that overrides convenience every time: **a table is not
shipped until it has RLS enabled AND at least one tested policy, added in
the same migration.** Enabling RLS with zero policies is safe (deny-all);
shipping a table with RLS disabled is not — it's publicly readable and
writable through the auto-generated API the moment it exists.

A real example of what happens otherwise: in January 2026, a Supabase
project shipped a table without RLS and exposed 1.5 million users' API
keys and auth tokens. The fix was two SQL statements. Don't be the
two-statements-too-late case.

---

## 1. Migration workflow

- Local-first: `supabase start` (local Postgres/Auth/Storage via Docker),
  develop and test migrations there before touching staging or production.
- Every schema change is a file via `supabase migration new <name>`,
  committed to git — never a hand-edit through the Supabase Studio table
  editor for anything beyond throwaway prototyping.
- Bundle the `CREATE TABLE`, the `GRANT`s, the `ENABLE ROW LEVEL SECURITY`,
  and the policies in **one migration file**. They're one unit of work —
  splitting them across migrations is how a table ends up live with RLS
  enabled and zero policies (silently breaks every query) or RLS never
  enabled at all (silently public).
- Apply to staging first (`supabase db push` against a staging project),
  verify, then promote the same migration file to production. Never write
  a different migration per environment.

---

## 2. The RLS checklist — apply to every table holding user data

```sql
-- 1. Enable, in the same migration as the CREATE TABLE
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

-- 2. Explicit role — don't rely on auth.uid() alone to exclude 'anon'
CREATE POLICY "Users read own habits" ON public.habits
  FOR SELECT TO authenticated
  USING ( (select auth.uid()) = user_id );

-- 3. INSERT/UPDATE need WITH CHECK, not just USING — otherwise a user
--    can insert/reassign rows to someone else's user_id
CREATE POLICY "Users insert own habits" ON public.habits
  FOR INSERT TO authenticated
  WITH CHECK ( (select auth.uid()) = user_id );

CREATE POLICY "Users update own habits" ON public.habits
  FOR UPDATE TO authenticated
  USING ( (select auth.uid()) = user_id )
  WITH CHECK ( (select auth.uid()) = user_id );

-- 4. Index every column referenced in a policy — an unindexed policy
--    column turns into a full sequential scan on every query
CREATE INDEX idx_habits_user_id ON public.habits(user_id);
```

Non-negotiables, every time:
- **Wrap `auth.uid()`/`auth.jwt()` as `(select auth.uid())`** — this lets
  Postgres cache the result per statement (initPlan) instead of
  re-evaluating per row. Skipping this is the single most common RLS
  performance bug.
- **`UPDATE` policies need a paired `SELECT` policy** — Postgres has to
  read the existing row to evaluate the `USING` clause on update.
- **For recursive or join-heavy checks** (team membership, role lookups),
  use a `SECURITY DEFINER` helper function instead of a nested `EXISTS`
  subquery — it avoids re-running RLS on the joined table and is
  measurably faster. But: `SECURITY DEFINER` functions are callable
  through the API like anything else — put genuinely sensitive ones in a
  non-exposed schema, and never trust input parameters from a
  `SECURITY DEFINER` function without validating them.
- **Never expose the `service_role` key client-side.** It bypasses RLS
  entirely — server-only (API routes, edge functions), never in a
  `NEXT_PUBLIC_*` env var or anywhere that ships to the browser.

---

## 3. Pattern: which shape does this table need?

- **User-scoped** (the default for most RISE tables — habits, journal
  entries, finance transactions): `user_id = auth.uid()` on every policy,
  as above.
- **Shared/multi-tenant** (if a module ever needs team or household
  sharing): add a membership table and check it via a `SECURITY DEFINER`
  function, not a raw join inside the policy.
- **Public-read / authenticated-write** (reference/lookup tables —
  categories, module metadata): `SELECT` open to `anon`, `INSERT`/
  `UPDATE`/`DELETE` restricted to a specific role or service-side only.
- **Soft-delete visibility**: a `deleted_at` column plus `deleted_at IS
  NULL` folded into every policy's `USING` clause — don't handle
  soft-delete filtering only in application code, since that's exactly
  the kind of check RLS exists to make impossible to forget.

---

## 4. Testing — the SQL editor lies to you

The Supabase SQL Editor runs as the `postgres` superuser, which **bypasses
RLS entirely.** A query that looks correct there can return nothing (or
everything) for a real user. Test through:
- The Supabase client SDK with an actual signed-in user's session, or
- Local role simulation (`set role authenticated; set request.jwt.claims
  = '{"sub": "<test-uuid>"}';` in a local psql session) before trusting a
  policy.

Never sign off a new policy based on SQL Editor results alone.

---

## 5. Migration pre-ship checklist

- [ ] `ENABLE ROW LEVEL SECURITY` and every policy are in the same
      migration file as the `CREATE TABLE`.
- [ ] Every policy targets an explicit role (`authenticated`/`anon`), not
      implicit public.
- [ ] `INSERT`/`UPDATE` policies have `WITH CHECK`, not just `USING`.
- [ ] `UPDATE` policies have a paired `SELECT` policy.
- [ ] Every column referenced in a policy has an index.
- [ ] `auth.uid()`/`auth.jwt()` calls are wrapped in `(select ...)`.
- [ ] Tested via the client SDK or role simulation — not the SQL Editor.
- [ ] No `service_role` key anywhere that reaches the client bundle.
- [ ] Migration applied to staging and verified before promoting to
      production.
