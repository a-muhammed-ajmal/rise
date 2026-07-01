-- ============================================================
-- 011_fix_payment_methods.sql
-- Complete payment methods migration (010 was a no-op due to
-- constraint naming mismatch causing full rollback in the editor).
-- Run via Supabase Dashboard SQL Editor.
-- ============================================================

-- ============================================================
-- Section 1: payment_methods table
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_methods (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  balance       NUMERIC(12,2) NOT NULL DEFAULT 0,
  color         TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_methods_select" ON payment_methods
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "payment_methods_insert" ON payment_methods
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "payment_methods_update" ON payment_methods
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "payment_methods_delete" ON payment_methods
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user
  ON payment_methods (user_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_active
  ON payment_methods (user_id, is_active);

-- Case-insensitive unique name per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_user_name
  ON payment_methods (user_id, LOWER(name));

DROP TRIGGER IF EXISTS payment_methods_updated_at ON payment_methods;
CREATE TRIGGER payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Section 2: Add FK columns to transactions
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_method_id      UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS from_payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_payment_method_id   UUID REFERENCES payment_methods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_payment_method_id
  ON transactions (payment_method_id);

CREATE INDEX IF NOT EXISTS idx_transactions_from_pm
  ON transactions (from_payment_method_id);

CREATE INDEX IF NOT EXISTS idx_transactions_to_pm
  ON transactions (to_payment_method_id);

-- ============================================================
-- Section 3: Replace constraints
-- DROP and ADD are separate ALTER TABLE statements so a DROP
-- success cannot be rolled back by a subsequent ADD failure.
-- ============================================================

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check,
  DROP CONSTRAINT IF EXISTS transactions_amount_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('income', 'expense', 'transfer', 'adjustment')),
  ADD CONSTRAINT transactions_amount_check
    CHECK (
      (type IN ('income', 'expense', 'transfer') AND amount > 0)
      OR type = 'adjustment'
    ),
  ADD CONSTRAINT transactions_transfer_no_self_loop
    CHECK (
      from_payment_method_id IS DISTINCT FROM to_payment_method_id
      OR from_payment_method_id IS NULL
    );

-- ============================================================
-- Section 4: Backfill — runs BEFORE trigger to avoid double-counting
-- ============================================================

-- Create one payment_method row per distinct existing text value
INSERT INTO payment_methods (user_id, name, balance, is_active, display_order)
SELECT DISTINCT
  t.user_id,
  t.payment_method                                                            AS name,
  0                                                                           AS balance,
  true                                                                        AS is_active,
  (ROW_NUMBER() OVER (PARTITION BY t.user_id ORDER BY t.payment_method) - 1) AS display_order
FROM transactions t
WHERE t.payment_method IS NOT NULL AND t.payment_method <> ''
ON CONFLICT DO NOTHING;

-- Link existing transactions to their new FK
UPDATE transactions t
SET payment_method_id = pm.id
FROM payment_methods pm
WHERE LOWER(t.payment_method) = LOWER(pm.name)
  AND t.user_id = pm.user_id
  AND t.payment_method IS NOT NULL;

-- Recalculate balances from all historical income/expense rows
UPDATE payment_methods pm
SET balance = COALESCE(calc.net, 0)
FROM (
  SELECT
    payment_method_id,
    SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net
  FROM transactions
  WHERE payment_method_id IS NOT NULL
    AND type IN ('income', 'expense')
  GROUP BY payment_method_id
) calc
WHERE pm.id = calc.payment_method_id;

-- ============================================================
-- Section 5: Balance trigger (created AFTER backfill)
-- ============================================================

CREATE OR REPLACE FUNCTION update_payment_method_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- ── INSERT ───────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'income' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance + NEW.amount
        WHERE id = NEW.payment_method_id;
    ELSIF NEW.type = 'expense' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance - NEW.amount
        WHERE id = NEW.payment_method_id;
    ELSIF NEW.type = 'adjustment' AND NEW.payment_method_id IS NOT NULL THEN
      -- amount may be negative for a downward adjustment
      UPDATE payment_methods SET balance = balance + NEW.amount
        WHERE id = NEW.payment_method_id;
    ELSIF NEW.type = 'transfer' THEN
      IF NEW.from_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods SET balance = balance - NEW.amount
          WHERE id = NEW.from_payment_method_id;
      END IF;
      IF NEW.to_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods SET balance = balance + NEW.amount
          WHERE id = NEW.to_payment_method_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- ── DELETE (reverse original effect) ─────────────────────
  IF TG_OP = 'DELETE' THEN
    IF OLD.type = 'income' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance - OLD.amount
        WHERE id = OLD.payment_method_id;
    ELSIF OLD.type = 'expense' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance + OLD.amount
        WHERE id = OLD.payment_method_id;
    ELSIF OLD.type = 'adjustment' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance - OLD.amount
        WHERE id = OLD.payment_method_id;
    ELSIF OLD.type = 'transfer' THEN
      IF OLD.from_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods SET balance = balance + OLD.amount
          WHERE id = OLD.from_payment_method_id;
      END IF;
      IF OLD.to_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods SET balance = balance - OLD.amount
          WHERE id = OLD.to_payment_method_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- ── UPDATE (reverse OLD, apply NEW) ──────────────────────
  IF TG_OP = 'UPDATE' THEN
    -- Reverse OLD effect
    IF OLD.type = 'income' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance - OLD.amount
        WHERE id = OLD.payment_method_id;
    ELSIF OLD.type = 'expense' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance + OLD.amount
        WHERE id = OLD.payment_method_id;
    ELSIF OLD.type = 'adjustment' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance - OLD.amount
        WHERE id = OLD.payment_method_id;
    ELSIF OLD.type = 'transfer' THEN
      IF OLD.from_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods SET balance = balance + OLD.amount
          WHERE id = OLD.from_payment_method_id;
      END IF;
      IF OLD.to_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods SET balance = balance - OLD.amount
          WHERE id = OLD.to_payment_method_id;
      END IF;
    END IF;

    -- Apply NEW effect
    IF NEW.type = 'income' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance + NEW.amount
        WHERE id = NEW.payment_method_id;
    ELSIF NEW.type = 'expense' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance - NEW.amount
        WHERE id = NEW.payment_method_id;
    ELSIF NEW.type = 'adjustment' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods SET balance = balance + NEW.amount
        WHERE id = NEW.payment_method_id;
    ELSIF NEW.type = 'transfer' THEN
      IF NEW.from_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods SET balance = balance - NEW.amount
          WHERE id = NEW.from_payment_method_id;
      END IF;
      IF NEW.to_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods SET balance = balance + NEW.amount
          WHERE id = NEW.to_payment_method_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS transactions_balance_trigger ON transactions;
CREATE TRIGGER transactions_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_payment_method_balance();
