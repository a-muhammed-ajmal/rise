-- ─── 022_soft_delete.sql ─────────────────────────────────────────────────────
-- Reversible delete for the 17 tool-addressable entities, so the MCP connector
-- can be given a delete capability without giving it an irreversible one.
--
--   1. deleted_at timestamptz on the 17 tables that have a delete_* AI tool.
--      Nullable with no default so every existing row reads as live and every
--      existing INSERT keeps type-checking (see lib/types/database.ts —
--      MakeNullableOptional routes nullable columns to the optional branch).
--
--      Deliberately NOT added to: ai_memory, ai_conversations, categories,
--      user_profile, task_labels, oauth_* (no delete tool addresses them),
--      payment_methods (no create/update/delete tool at all), and
--      push_subscriptions — which has SELECT/INSERT/DELETE policies but NO
--      UPDATE policy (007:64-78), so an in-place soft delete there would be
--      silently blocked for the authenticated role.
--
--   2. Partial indexes. The live-row predicate is on every read path, and the
--      dead-row predicate backs list_deleted (the recycle bin). Partial rather
--      than full, matching the WHERE is_starred = true precedent at 006:15.
--
--   3. update_payment_method_balance() must learn about soft delete. This is
--      the sharp edge of the whole change: a soft delete is an UPDATE, so the
--      function's DELETE branch never fires. The UPDATE branch reverses OLD
--      then re-applies NEW — and since a soft delete changes only deleted_at,
--      those two cancel out to a net zero. The wallet balance would silently
--      keep counting a transaction the user had deleted.
--
--      Fix: gate each half on the row being live. Reverse OLD only when OLD was
--      counted, apply NEW only when NEW is counted. That one rule covers every
--      case — soft delete (reverse, no re-apply), restore (apply, no reverse),
--      editing an already-deleted row (neither), ordinary edit (both), and
--      purging an already-soft-deleted row (neither, because the balance was
--      already reversed when it was soft-deleted).
--
-- RLS is unchanged. Adding a column inherits the table's existing policies
-- (precedent: 016, 017:19-21), and all 17 tables already carry
-- SELECT/INSERT/UPDATE/DELETE policies from 007_rls_hardening.sql — so soft
-- delete (UPDATE), restore (UPDATE) and purge (DELETE) are already authorised
-- for the owner and denied for everyone else.
--
-- deleted_at IS NULL is deliberately NOT folded into the SELECT policies:
-- that would make the recycle bin and restore unreadable, and it would not
-- cover the service-role paths (MCP, daily digest, send-push) that bypass RLS
-- anyway. Filtering is explicit at the query layer and guarded by tests.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── SECTION 1: deleted_at columns ───────────────────────────────────────────

ALTER TABLE tasks            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE projects         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE goals            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE milestones       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE habits           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE habit_logs       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE transactions     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE budgets          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE debts            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE contacts         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE interactions     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE notes            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE documents        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE links            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE journal_entries  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE reviews          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE focus_sessions   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN tasks.deleted_at IS
  'Soft delete marker. NULL = live. Set by the delete_* AI tools; cleared by restore_record. Every read path must filter "deleted_at IS NULL".';

-- ─── SECTION 2: Partial indexes ──────────────────────────────────────────────
-- Live-row lookups on the three highest-volume tables, and the matching
-- dead-row index that list_deleted pages through.

CREATE INDEX IF NOT EXISTS idx_tasks_user_live
  ON tasks (user_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_user_live
  ON transactions (user_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_live
  ON habit_logs (user_id, deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_deleted
  ON tasks (user_id, deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_user_deleted
  ON transactions (user_id, deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_deleted
  ON habit_logs (user_id, deleted_at DESC) WHERE deleted_at IS NOT NULL;

-- ─── SECTION 3: Balance trigger, soft-delete aware ───────────────────────────
-- Retains 021's SECURITY DEFINER + SET search_path + per-user ownership
-- predicate on every UPDATE. The only change is the live-row gate described in
-- the header: was_counted / is_counted.

CREATE OR REPLACE FUNCTION update_payment_method_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Did OLD contribute to the balance, and should NEW contribute to it?
  -- A soft-deleted transaction contributes nothing.
  --
  -- These are assigned in guarded IF blocks rather than in the DECLARE
  -- defaults: OLD is unassigned during INSERT and NEW is unassigned during
  -- DELETE, and SQL boolean AND does not promise short-circuit evaluation, so
  -- a combined "TG_OP <> 'DELETE' AND NEW.deleted_at IS NULL" initialiser
  -- would raise "record new is not assigned yet" on every DELETE.
  was_counted BOOLEAN := FALSE;
  is_counted  BOOLEAN := FALSE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    was_counted := (OLD.deleted_at IS NULL);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    is_counted := (NEW.deleted_at IS NULL);
  END IF;

  -- ── Reverse OLD's effect (UPDATE and DELETE) ─────────────
  IF was_counted THEN
    IF OLD.type = 'income' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance - OLD.amount
        WHERE id = OLD.payment_method_id AND user_id = OLD.user_id;
    ELSIF OLD.type = 'expense' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance + OLD.amount
        WHERE id = OLD.payment_method_id AND user_id = OLD.user_id;
    ELSIF OLD.type = 'adjustment' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance - OLD.amount
        WHERE id = OLD.payment_method_id AND user_id = OLD.user_id;
    ELSIF OLD.type = 'transfer' THEN
      IF OLD.from_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods SET balance = balance + OLD.amount
          WHERE id = OLD.from_payment_method_id AND user_id = OLD.user_id;
      END IF;
      IF OLD.to_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods SET balance = balance - OLD.amount
          WHERE id = OLD.to_payment_method_id AND user_id = OLD.user_id;
      END IF;
    END IF;
  END IF;

  -- ── Apply NEW's effect (INSERT and UPDATE) ───────────────
  IF is_counted THEN
    IF NEW.type = 'income' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance + NEW.amount
        WHERE id = NEW.payment_method_id AND user_id = NEW.user_id;
    ELSIF NEW.type = 'expense' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance - NEW.amount
        WHERE id = NEW.payment_method_id AND user_id = NEW.user_id;
    ELSIF NEW.type = 'adjustment' AND NEW.payment_method_id IS NOT NULL THEN
      -- amount may be negative for a downward adjustment
      UPDATE payment_methods SET balance = balance + NEW.amount
        WHERE id = NEW.payment_method_id AND user_id = NEW.user_id;
    ELSIF NEW.type = 'transfer' THEN
      IF NEW.from_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods SET balance = balance - NEW.amount
          WHERE id = NEW.from_payment_method_id AND user_id = NEW.user_id;
      END IF;
      IF NEW.to_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods SET balance = balance + NEW.amount
          WHERE id = NEW.to_payment_method_id AND user_id = NEW.user_id;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ─── Verification ────────────────────────────────────────────────────────────
-- All 17 tables carry the column:
--   select table_name from information_schema.columns
--   where table_schema = 'public' and column_name = 'deleted_at' order by 1;
--   -- expect 17 rows
--
-- The function still pins search_path:
--   select p.proname, p.proconfig
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef;
--   -- expect update_payment_method_balance with {search_path=public,pg_temp}
--
-- Soft delete reverses the wallet balance (run as the owning user):
--   select balance from payment_methods where id = '<pm>';
--   insert into transactions (user_id, type, amount, category, description, date, payment_method_id)
--     values ('<uid>', 'expense', 100, 'test', 'trigger check', current_date, '<pm>');
--   -- expect balance - 100
--   update transactions set deleted_at = now() where description = 'trigger check';
--   -- expect balance back to its original value
--   update transactions set deleted_at = null where description = 'trigger check';
--   -- expect balance - 100 again
--   delete from transactions where description = 'trigger check';
--   -- expect balance back to its original value
--
-- Every deletable table still has all four policy types:
--   select tablename, count(distinct cmd) from pg_policies
--   where schemaname = 'public' and tablename in (
--     'tasks','projects','goals','milestones','habits','habit_logs','transactions',
--     'budgets','debts','contacts','interactions','notes','documents','links',
--     'journal_entries','reviews','focus_sessions')
--   group by tablename having count(distinct cmd) <> 4;
--   -- expect zero rows
