-- ─── 007_rls_hardening.sql ────────────────────────────────────────────────────
-- Purpose: Harden all RLS policies across 19 user-data tables and
--          push_subscriptions. Three fixes applied:
--
--   1. (select auth.uid()) wrapper — evaluates auth.uid() once per
--      statement (Postgres initPlan) rather than once per row.
--      Without the wrapper, a SELECT touching 1,000 rows calls
--      auth.uid() 1,000 times. Affects all 79 policies.
--
--   2. TO authenticated — makes the role binding explicit so that
--      anonymous requests are denied at the policy level rather than
--      relying on auth.uid() returning NULL.
--
--   3. Missing user_id indexes — adds 12 indexes that were absent,
--      preventing full sequential scans on every RLS-filtered query.
--
-- Note on storage: see comment block at the bottom.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── SECTION 1: Replace policies on the 19 DO-block tables ───────────────────

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'projects','tasks','goals','milestones','reviews','journal_entries',
    'transactions','budgets','debts','habits','habit_logs','focus_sessions',
    'contacts','interactions','notes','documents','links',
    'ai_conversations','ai_memory'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP

    -- Drop old policies (bare auth.uid(), no role binding)
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I', tbl, tbl);

    -- Recreate with (select auth.uid()) and TO authenticated
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT TO authenticated USING ((select auth.uid()) = user_id)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON %I FOR DELETE TO authenticated USING ((select auth.uid()) = user_id)',
      tbl, tbl
    );

  END LOOP;
END $$;


-- ─── SECTION 2: Replace policies on push_subscriptions ───────────────────────

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON push_subscriptions;

CREATE POLICY "push_subscriptions_select_own" ON push_subscriptions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "push_subscriptions_insert_own" ON push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "push_subscriptions_delete_own" ON push_subscriptions
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);


-- ─── SECTION 3: Missing user_id indexes (12 tables) ──────────────────────────
-- Already indexed (from 001_schema.sql):
--   tasks, habits, habit_logs, transactions, contacts,
--   journal_entries, notes, ai_memory
-- The 12 below were missing.

CREATE INDEX IF NOT EXISTS idx_projects_user_id
  ON projects (user_id);

CREATE INDEX IF NOT EXISTS idx_goals_user_id
  ON goals (user_id);

CREATE INDEX IF NOT EXISTS idx_milestones_user_id
  ON milestones (user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_user_id
  ON reviews (user_id);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id
  ON budgets (user_id);

CREATE INDEX IF NOT EXISTS idx_debts_user_id
  ON debts (user_id);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id
  ON focus_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_interactions_user_id
  ON interactions (user_id);

CREATE INDEX IF NOT EXISTS idx_documents_user_id
  ON documents (user_id);

CREATE INDEX IF NOT EXISTS idx_links_user_id
  ON links (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id
  ON ai_conversations (user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions (user_id);


-- ─── SECTION 4: Storage bucket policies (manual step — not applied here) ──────
-- The task-attachments bucket policies in 006_task_enhancements.sql are
-- commented out because the bucket must exist before the policies can be
-- created. This is a known gap.
--
-- REQUIRED MANUAL STEP (one-time, per environment):
--   1. Supabase Dashboard → Storage → New bucket
--      Name: task-attachments | Public: NO
--   2. In the Dashboard SQL editor, run the three policies from
--      006_task_enhancements.sql (INSERT / SELECT / DELETE on storage.objects).
-- ─────────────────────────────────────────────────────────────────────────────
