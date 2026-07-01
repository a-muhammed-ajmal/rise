-- ─── 010_payment_methods.sql ────────────────────────────────────────────────
-- Purpose: Introduce user-managed payment methods (wallets) with real-time
--          balance tracking via DB trigger, wallet-to-wallet transfers, and
--          manual balance adjustments.
--
-- Execution order (critical — do NOT reorder):
--   1. Create payment_methods table + RLS
--   2. Alter transactions: add FK columns, update CHECK constraints
--   3. Backfill payment_methods rows from existing text values (BEFORE trigger)
--   4. Recalculate initial balances from historical transactions
--   5. Create balance trigger (AFTER backfill — avoids double-counting)
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── SECTION 1: payment_methods table ────────────────────────────────────────

CREATE TABLE payment_methods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  balance       NUMERIC(12,2) NOT NULL DEFAULT 0,
  color         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique wallet name per user (case-insensitive) — prevents race-condition duplicates
CREATE UNIQUE INDEX idx_payment_methods_user_name
  ON payment_methods (user_id, LOWER(name));

CREATE INDEX idx_payment_methods_user
  ON payment_methods (user_id);

CREATE INDEX idx_payment_methods_user_active
  ON payment_methods (user_id, is_active);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Hardened RLS pattern from 007_rls_hardening.sql:
-- (select auth.uid()) evaluated once per statement, TO authenticated for explicit role binding
CREATE POLICY "payment_methods_select" ON payment_methods
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "payment_methods_insert" ON payment_methods
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "payment_methods_update" ON payment_methods
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "payment_methods_delete" ON payment_methods
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Reuse existing set_updated_at() function (defined in 001_schema.sql)
CREATE TRIGGER payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── SECTION 2: Alter transactions table ─────────────────────────────────────

-- Add FK columns for the new payment method system
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_method_id      UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS from_payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_payment_method_id   UUID REFERENCES payment_methods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_payment_method_id
  ON transactions (payment_method_id);

-- Safely drop old CHECK constraints by looking up their actual auto-generated names.
-- PostgreSQL names inline column CHECKs as {table}_{column}_check, but we look them
-- up dynamically to be 100% safe regardless of the actual generated name.
DO $$
DECLARE
  c_type   text;
  c_amount text;
BEGIN
  -- Find the type CHECK constraint
  SELECT conname INTO c_type
  FROM pg_constraint
  WHERE conrelid = 'transactions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%income%expense%';

  IF c_type IS NOT NULL THEN
    EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT %I', c_type);
  END IF;

  -- Find the amount CHECK constraint (amount > 0)
  SELECT conname INTO c_amount
  FROM pg_constraint
  WHERE conrelid = 'transactions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%amount > 0%';

  IF c_amount IS NOT NULL THEN
    EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT %I', c_amount);
  END IF;
END $$;

-- Recreate constraints with extended values
ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('income', 'expense', 'transfer', 'adjustment')),
  ADD CONSTRAINT transactions_amount_check
    -- income / expense / transfer must be positive
    -- adjustment can be any numeric (negative = balance correction downward)
    CHECK (
      (type IN ('income', 'expense', 'transfer') AND amount > 0)
      OR type = 'adjustment'
    ),
  ADD CONSTRAINT transactions_transfer_no_self_loop
    -- Prevent transferring from a wallet to itself
    CHECK (
      from_payment_method_id IS DISTINCT FROM to_payment_method_id
      OR from_payment_method_id IS NULL
    );


-- ─── SECTION 3: Backfill payment_methods from existing text values ────────────
-- Run BEFORE the trigger so historical data is not double-counted.

INSERT INTO payment_methods (user_id, name, balance, is_active, display_order)
SELECT DISTINCT ON (user_id, LOWER(payment_method))
  user_id,
  payment_method AS name,
  0              AS balance,
  true           AS is_active,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY payment_method) - 1 AS display_order
FROM transactions
WHERE payment_method IS NOT NULL
  AND payment_method <> ''
ON CONFLICT DO NOTHING;

-- Link existing transactions to their newly created payment_method rows
UPDATE transactions t
SET payment_method_id = pm.id
FROM payment_methods pm
WHERE LOWER(t.payment_method) = LOWER(pm.name)
  AND t.user_id = pm.user_id
  AND t.payment_method IS NOT NULL
  AND t.payment_method <> '';


-- ─── SECTION 4: Recalculate initial balances from all historical transactions ─
-- Starting balance for migrated wallets = sum(income) - sum(expense) for that wallet.
-- Adjustment/transfer types don't exist yet in existing data, so only income/expense matter.

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


-- ─── SECTION 5: Balance trigger (created AFTER backfill) ─────────────────────

CREATE OR REPLACE FUNCTION update_payment_method_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- bypass RLS on payment_methods during trigger execution
AS $$
BEGIN

  -- ── INSERT ────────────────────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN

    IF NEW.type = 'income' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods
        SET balance = balance + NEW.amount
        WHERE id = NEW.payment_method_id;

    ELSIF NEW.type = 'expense' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods
        SET balance = balance - NEW.amount
        WHERE id = NEW.payment_method_id;

    ELSIF NEW.type = 'adjustment' AND NEW.payment_method_id IS NOT NULL THEN
      -- amount can be negative (correcting balance downward)
      UPDATE payment_methods
        SET balance = balance + NEW.amount
        WHERE id = NEW.payment_method_id;

    ELSIF NEW.type = 'transfer' THEN
      IF NEW.from_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods
          SET balance = balance - NEW.amount
          WHERE id = NEW.from_payment_method_id;
      END IF;
      IF NEW.to_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods
          SET balance = balance + NEW.amount
          WHERE id = NEW.to_payment_method_id;
      END IF;
    END IF;

    RETURN NEW;
  END IF;


  -- ── DELETE ────────────────────────────────────────────────────────────────
  -- Reverse exactly what INSERT applied.
  IF TG_OP = 'DELETE' THEN

    IF OLD.type = 'income' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods
        SET balance = balance - OLD.amount
        WHERE id = OLD.payment_method_id;

    ELSIF OLD.type = 'expense' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods
        SET balance = balance + OLD.amount
        WHERE id = OLD.payment_method_id;

    ELSIF OLD.type = 'adjustment' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods
        SET balance = balance - OLD.amount
        WHERE id = OLD.payment_method_id;

    ELSIF OLD.type = 'transfer' THEN
      IF OLD.from_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods
          SET balance = balance + OLD.amount
          WHERE id = OLD.from_payment_method_id;
      END IF;
      IF OLD.to_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods
          SET balance = balance - OLD.amount
          WHERE id = OLD.to_payment_method_id;
      END IF;
    END IF;

    RETURN OLD;
  END IF;


  -- ── UPDATE ────────────────────────────────────────────────────────────────
  -- Step 1: reverse the OLD row's effect (identical to DELETE logic above).
  -- Step 2: apply the NEW row's effect (identical to INSERT logic above).
  -- Both steps are necessary even when only the amount changes on the same
  -- payment_method_id, because the delta may be non-trivial.
  IF TG_OP = 'UPDATE' THEN

    -- Reverse OLD effect ──────────────────────────────────────────────────────
    IF OLD.type = 'income' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods
        SET balance = balance - OLD.amount
        WHERE id = OLD.payment_method_id;

    ELSIF OLD.type = 'expense' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods
        SET balance = balance + OLD.amount
        WHERE id = OLD.payment_method_id;

    ELSIF OLD.type = 'adjustment' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods
        SET balance = balance - OLD.amount
        WHERE id = OLD.payment_method_id;

    ELSIF OLD.type = 'transfer' THEN
      IF OLD.from_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods
          SET balance = balance + OLD.amount
          WHERE id = OLD.from_payment_method_id;
      END IF;
      IF OLD.to_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods
          SET balance = balance - OLD.amount
          WHERE id = OLD.to_payment_method_id;
      END IF;
    END IF;

    -- Apply NEW effect ─────────────────────────────────────────────────────────
    IF NEW.type = 'income' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods
        SET balance = balance + NEW.amount
        WHERE id = NEW.payment_method_id;

    ELSIF NEW.type = 'expense' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods
        SET balance = balance - NEW.amount
        WHERE id = NEW.payment_method_id;

    ELSIF NEW.type = 'adjustment' AND NEW.payment_method_id IS NOT NULL THEN
      UPDATE payment_methods
        SET balance = balance + NEW.amount
        WHERE id = NEW.payment_method_id;

    ELSIF NEW.type = 'transfer' THEN
      IF NEW.from_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods
          SET balance = balance - NEW.amount
          WHERE id = NEW.from_payment_method_id;
      END IF;
      IF NEW.to_payment_method_id IS NOT NULL THEN
        UPDATE payment_methods
          SET balance = balance + NEW.amount
          WHERE id = NEW.to_payment_method_id;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER transactions_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_payment_method_balance();
