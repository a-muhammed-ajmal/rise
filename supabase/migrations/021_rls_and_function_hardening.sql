-- ─── 021_rls_and_function_hardening.sql ──────────────────────────────────────
-- Three fixes plus supporting indexes.
--
--   1. update_payment_method_balance() is SECURITY DEFINER and adjusts
--      payment_methods by id with no ownership predicate. transactions RLS only
--      checks transactions.user_id, so a row referencing ANOTHER user's
--      payment_method_id moved that user's balance. The AI tool surface makes
--      this reachable: log_expense accepts any UUID. (execute-tool.ts now also
--      verifies ownership before insert — this is the database-side backstop.)
--      It also lacked SET search_path, the standard Supabase advisor finding for
--      SECURITY DEFINER functions.
--
--   2. user_profile (014) and categories (012) were created after the
--      007_rls_hardening pass and never picked up its shape: no
--      TO authenticated role binding, no (select auth.uid()) initplan wrapper,
--      and user_profile relies on FOR ALL's implicit WITH CHECK.
--
--   3. Indexes backing the paginated list_* AI tools and the module screens.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── SECTION 1: Balance trigger ──────────────────────────────────────────────
-- Every UPDATE gains "AND user_id = <owning row>.user_id" so a foreign
-- payment_method_id silently affects nothing instead of another user's wallet.

CREATE OR REPLACE FUNCTION update_payment_method_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- ── INSERT ───────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
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
    RETURN NEW;
  END IF;

  -- ── DELETE (reverse original effect) ─────────────────────
  IF TG_OP = 'DELETE' THEN
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
    RETURN OLD;
  END IF;

  -- ── UPDATE (reverse OLD, apply NEW) ──────────────────────
  IF TG_OP = 'UPDATE' THEN
    -- reverse OLD
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

    -- apply NEW
    IF NEW.type = 'income' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance + NEW.amount
        WHERE id = NEW.payment_method_id AND user_id = NEW.user_id;
    ELSIF NEW.type = 'expense' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance - NEW.amount
        WHERE id = NEW.payment_method_id AND user_id = NEW.user_id;
    ELSIF NEW.type = 'adjustment' AND NEW.payment_method_id IS NOT NULL THEN
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
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- ─── SECTION 2: user_profile policies ────────────────────────────────────────
-- Explicit per-command policies with TO authenticated and both USING and
-- WITH CHECK, matching the 007 shape.

DROP POLICY IF EXISTS "own_profile" ON user_profile;
DROP POLICY IF EXISTS "user_profile_select" ON user_profile;
DROP POLICY IF EXISTS "user_profile_insert" ON user_profile;
DROP POLICY IF EXISTS "user_profile_update" ON user_profile;
DROP POLICY IF EXISTS "user_profile_delete" ON user_profile;

CREATE POLICY "user_profile_select" ON user_profile
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "user_profile_insert" ON user_profile
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "user_profile_update" ON user_profile
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "user_profile_delete" ON user_profile
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ─── SECTION 3: categories policies ──────────────────────────────────────────

DROP POLICY IF EXISTS "Users can manage their own categories" ON categories;
DROP POLICY IF EXISTS "categories_select" ON categories;
DROP POLICY IF EXISTS "categories_insert" ON categories;
DROP POLICY IF EXISTS "categories_update" ON categories;
DROP POLICY IF EXISTS "categories_delete" ON categories;

CREATE POLICY "categories_select" ON categories
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "categories_insert" ON categories
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "categories_update" ON categories
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "categories_delete" ON categories
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories (user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_user_id ON user_profile (user_id);

-- ─── SECTION 4: Pagination indexes ───────────────────────────────────────────
-- Ordered composites matching the (user_id, <sort column> DESC) shape the
-- paginated list_* AI tools and the module screens issue.

CREATE INDEX IF NOT EXISTS idx_notes_user_updated
  ON notes (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_user_name
  ON contacts (user_id, name);

CREATE INDEX IF NOT EXISTS idx_links_user_created
  ON links (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_user_created
  ON documents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date
  ON journal_entries (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_started
  ON focus_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_user_created
  ON reviews (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interactions_contact_date
  ON interactions (user_id, contact_id, date DESC);

-- ─── Verification ────────────────────────────────────────────────────────────
-- SECURITY DEFINER functions all pin search_path:
--   select p.proname, p.proconfig
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef;
--   -- expect update_payment_method_balance with {search_path=public,pg_temp}
--
-- No user table has a policy without a role binding:
--   select tablename, policyname, roles from pg_policies
--   where schemaname = 'public' and roles = '{public}';
--   -- expect zero rows
--
-- Every UPDATE policy has a WITH CHECK:
--   select tablename, policyname from pg_policies
--   where schemaname = 'public' and cmd = 'UPDATE' and with_check is null;
--   -- expect zero rows
--
-- A foreign payment method is now inert (run as user A, pm owned by user B):
--   insert into transactions (user_id, type, amount, category, date, payment_method_id)
--   values (auth.uid(), 'expense', 100, 'test', current_date, '<user-B-pm-uuid>');
--   -- user B's balance must be unchanged
