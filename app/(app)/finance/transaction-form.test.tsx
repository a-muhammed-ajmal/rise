import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Category, PaymentMethod, Transaction } from "@/lib/types/database";
import { TransactionForm } from "./transaction-form";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

afterEach(cleanup);

const WALLET_ID = "2d1f7073-0991-4a1b-bb0c-000000000001";

const wallet: PaymentMethod = {
  id: WALLET_ID,
  user_id: "u1",
  name: "Mashreq",
  balance: 5.16,
  color: "#10B981",
  is_active: true,
  display_order: 0,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const category: Category = {
  id: "c1",
  user_id: "u1",
  name: "Groceries",
  type: "expense",
  created_at: "2026-09-01T00:00:00Z",
};

const txn: Transaction = {
  id: "t1",
  user_id: "u1",
  type: "expense",
  amount: 12,
  category: "Groceries",
  description: null,
  date: "2026-09-24",
  payment_method: "Mashreq",
  payment_method_id: WALLET_ID,
  from_payment_method_id: null,
  to_payment_method_id: null,
  tags: [],
  deleted_at: null,
  created_at: "2026-09-24T00:00:00Z",
};

function renderForm(initial: Transaction | null) {
  render(
    <TransactionForm
      open
      onOpenChange={vi.fn()}
      defaultType="expense"
      initial={initial}
      onSaved={vi.fn()}
      paymentMethods={[wallet]}
      findOrCreateByName={vi.fn()}
      categories={[category]}
      createCategory={vi.fn()}
    />
  );
}

describe("TransactionForm", () => {
  it("shows the selected wallet by name, not its id", () => {
    renderForm(txn);
    expect(screen.getByText("Mashreq")).toBeTruthy();
    expect(screen.queryByText(WALLET_ID)).toBeNull();
  });

  it("shows a dash rather than the sentinel when no wallet is chosen", () => {
    renderForm(null);
    expect(screen.queryByText("none")).toBeNull();
  });
});
