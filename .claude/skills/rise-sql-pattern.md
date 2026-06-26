---
name: rise-sql-pattern
description: Enforce RLS + user_id pattern, append-only migrations, and no breaking changes when working with Supabase schema in RISE
triggers:
  - "database schema"
  - "migration"
  - "supabase table"
  - "RLS"
  - "row level security"
  - "sql"
---

# RISE SQL / Migration Pattern

## When to apply
Creating migrations, modifying `lib/types/database.ts`, or writing SQL for Supabase.

## Hard rules

1. **Append-only** — `supabase/migrations/` files are never modified after creation. Each change is a new numbered file: `006_<description>.sql`.
2. **Never auto-apply** — migrations are applied manually via the Supabase SQL editor. Never run `supabase db push` autonomously.
3. **RLS on every table** — every new table must have:
   ```sql
   alter table <table> enable row level security;
   create policy "<table>_select_own" on <table>
     for select using (user_id = auth.uid());
   create policy "<table>_insert_own" on <table>
     for insert with check (user_id = auth.uid());
   -- add update/delete policies as needed
   ```
4. **user_id required** — every table that stores user data must have `user_id uuid not null references auth.users(id) on delete cascade`.
5. **Type sync** — after any schema change, update `lib/types/database.ts` with the corresponding `Row`, `Insert`, and `Update` types. This is the single source of truth.
6. **No breaking changes** — never drop or rename columns in production. Add new columns with defaults or `nullable`. Use a new table if the shape changes significantly.
7. **pgvector** — the `ai_memory` table uses `float[1024]` embeddings. The `match_memories` function uses cosine similarity. Migration 004 already sets this up — do not modify it.

## Migration file naming
```
supabase/migrations/
  001_schema.sql          ← initial schema
  002_rls.sql             ← RLS policies
  003_crm.sql             ← CRM tables
  004_vector_dimension.sql ← pgvector 1024-dim
  005_push_subscriptions.sql ← web push
  006_<your_feature>.sql  ← next migration
```

## New table template
```sql
create table if not exists my_table (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- your columns here
  created_at timestamptz not null default now()
);

alter table my_table enable row level security;

create policy "my_table_select_own" on my_table
  for select using (user_id = auth.uid());
create policy "my_table_insert_own" on my_table
  for insert with check (user_id = auth.uid());
create policy "my_table_update_own" on my_table
  for update using (user_id = auth.uid());
create policy "my_table_delete_own" on my_table
  for delete using (user_id = auth.uid());
```

## lib/types/database.ts template
```ts
export type MyTableRow = {
  id: string;
  user_id: string;
  // your columns
  created_at: string;
};
export type MyTableInsert = Omit<MyTableRow, "id" | "created_at">;
export type MyTableUpdate = Partial<MyTableInsert>;
```

## Bad examples
```sql
-- ❌ Modifying existing migration file
-- (edit 003_crm.sql to add a column) → NEVER do this

-- ❌ Table without RLS
create table secrets (id uuid, data text);
-- Missing: alter table secrets enable row level security;

-- ❌ Table without user_id
create table public_thing (id uuid, value text);
-- Every RISE table must be single-user scoped
```

## Verification checklist
- [ ] New migration file is the next sequential number
- [ ] Table has `user_id` referencing `auth.users(id)`
- [ ] RLS enabled + select/insert policies created
- [ ] `lib/types/database.ts` updated with new Row types
- [ ] No existing migration files modified
- [ ] Migration applied manually in Supabase SQL editor (not auto-applied)
