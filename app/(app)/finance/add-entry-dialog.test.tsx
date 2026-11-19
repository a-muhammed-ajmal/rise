import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { Category, Debt, PaymentMethod } from "@/lib/types/database";
import { AddEntryDialog, ENTRY_KINDS, isEntryKind, type EntryKind } from "./add-entry-dialog";

type Call = { table: string; op: "insert" | "update" | "delete"; payload: unknown };

const h = vi.hoisted(() => ({
  calls: [] as { table: string; op: "insert" | "update" | "delete"; payload: unknown }[],
  failTable: null as string | null,
}));

vi.mock("@/lib/supabase/client", () => {
  function query(table: string) {
    const result = () => ({
      data: { id: "debt-new" },
      error: h.failTable === table ? { message: "boom" } : null,
    });
    const q = {
      insert: (payload: unknown) => {
        h.calls.push({ table, op: "insert", payload });
        return q;
      },
      update: (payload: unknown) => {
        h.calls.push({ table, op: "update", payload });
        return q;
      },
      delete: () => {
        h.calls.push({ table, op: "delete", payload: null });
        return q;
      },
      select: () => q,
      eq: () => q,
      is: () => q,
      single: () => Promise.resolve(result()),
      then: (resolve: (value: ReturnType<typeof result>) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject),
    };
    return q;
  }
  return { createClient: () => ({ from: (table: string) => query(table) }) };
});
vi.mock("@/lib/supabase/current-user", () => ({ currentUserId: () => Promise.resolve("u1") }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  h.calls = [];
  h.failTable = null;
});
afterEach(cleanup);

const wallet = (id: string, name: string, order: number): PaymentMethod => ({
  id,
  user_id: "u1",
  name,
  balance: 1000,
  color: null,
  is_active: true,
  display_order: order,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
});
const WALLETS = [wallet("w-botim", "Botim", 0), wallet("w-mashreq", "Mashreq", 1), wallet("w-cash", "Cash", 2)];
const CATEGORIES: Category[] = [
  { id: "c1", user_id: "u1", name: "Food", type: "expense", created_at: "2026-11-01T00:00:00Z" },
];

const debt = (over: Partial<Debt>): Debt => ({
  id: "d1",
  user_id: "u1",
  creditor: "Ahmed",
  type: "they_owe",
  amount: 450,
  description: null,
  due_date: null,
  paid_at: null,
  deleted_at: null,
  created_at: "2026-11-01T00:00:00Z",
  ...over,
});

function Harness({
  initialKind = "expense",
  openDebts = [],
  onSaved = vi.fn(),
  onTransactionSaved = vi.fn(),
}: {
  initialKind?: EntryKind;
  openDebts?: Debt[];
  onSaved?: () => void;
  onTransactionSaved?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [kind, setKind] = useState<EntryKind>(initialKind);
  return (
    <AddEntryDialog
      open={open}
      onOpenChange={setOpen}
      kind={kind}
      onKindChange={setKind}
      paymentMethods={WALLETS}
      findOrCreateByName={vi.fn()}
      categories={CATEGORIES}
      createCategory={vi.fn()}
      openDebts={openDebts}
      onTransactionSaved={onTransactionSaved}
      onSaved={onSaved}
    />
  );
}

const of = (table: string, op: Call["op"]) => h.calls.filter((c) => c.table === table && c.op === op);

/** Open a Base UI select by its accessible name and pick an option. */
async function choose(selectName: string, option: string | RegExp) {
  fireEvent.click(screen.getByRole("combobox", { name: selectName }));
  const item = await screen.findByRole("option", { name: option });
  // A real tap: Base UI only commits a mouse click that started on the item.
  fireEvent.pointerDown(item, { pointerType: "mouse" });
  fireEvent.click(item);
}

describe("AddEntryDialog", () => {
  it("offers Expense, Income, Transfer and Debt, starting on Expense", () => {
    render(<Harness />);
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["Expense", "Income", "Transfer", "Debt"]);
    expect(screen.getByRole("tab", { name: "Expense" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Record expense" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Save expense" })).toBeDefined();
  });

  it.each([
    ["Income", "Record income"],
    ["Transfer", "Transfer money"],
    ["Debt", "Debt or repayment"],
  ])("switches to the %s tab", (tab, title) => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: tab }));
    expect(screen.getByRole("tab", { name: tab }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: title })).toBeDefined();
  });

  it("has an optional fee field on the Transfer tab", () => {
    render(<Harness initialKind="transfer" />);
    const fee = screen.getByLabelText(/Fee/);
    expect(fee.getAttribute("type")).toBe("number");
    expect(fee.hasAttribute("required")).toBe(false);
    expect(screen.getByText(/saved as a “Transfer fee” expense/)).toBeDefined();
  });

  it("saves a transfer and its fee in one insert", async () => {
    const onSaved = vi.fn();
    render(<Harness initialKind="transfer" onSaved={onSaved} />);
    await choose("From wallet", "Botim");
    await choose("To wallet", "Mashreq");
    fireEvent.change(screen.getByLabelText("Amount (AED)"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText(/Fee/), { target: { value: "5" } });

    // The summary shows what leaves and what arrives.
    expect(screen.getByText("Botim pays")).toBeDefined();
    expect(screen.getByText("Mashreq receives")).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    const inserts = of("transactions", "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toEqual([
      expect.objectContaining({ type: "transfer", amount: 500, from_payment_method_id: "w-botim", to_payment_method_id: "w-mashreq" }),
      expect.objectContaining({ type: "expense", amount: 5, category: "Transfer fee", payment_method_id: "w-botim" }),
    ]);
  });

  it("records money lent without touching a wallet by default", async () => {
    const onSaved = vi.fn();
    render(<Harness initialKind="debt" onSaved={onSaved} />);
    expect(screen.getByRole("button", { name: "I lent" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.change(screen.getByLabelText("Lent to"), { target: { value: " Ahmed " } });
    fireEvent.change(screen.getByLabelText("Amount (AED)"), { target: { value: "450" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save debt" }));
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    expect(of("debts", "insert")[0].payload).toEqual({
      user_id: "u1",
      creditor: "Ahmed",
      type: "they_owe",
      amount: 450,
      description: null,
      due_date: null,
    });
    expect(of("transactions", "insert")).toHaveLength(0);
  });

  it("moves the chosen wallet when money is borrowed into it", async () => {
    const onSaved = vi.fn();
    render(<Harness initialKind="debt" onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "I borrowed" }));
    fireEvent.change(screen.getByLabelText("Borrowed from"), { target: { value: "Bank" } });
    fireEvent.change(screen.getByLabelText("Amount (AED)"), { target: { value: "200" } });
    await choose("Received into wallet", "Cash");
    expect(screen.getByText(/Cash goes up by this amount/)).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save debt" }));
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    expect(of("debts", "insert")[0].payload).toMatchObject({ type: "i_owe", creditor: "Bank", amount: 200 });
    expect(of("transactions", "insert")[0].payload).toMatchObject({
      type: "adjustment",
      amount: 200,
      category: "Debt",
      description: "Borrowed from Bank",
      payment_method_id: "w-cash",
    });
  });

  it("undoes the new debt if its wallet movement fails", async () => {
    h.failTable = "transactions";
    const onSaved = vi.fn();
    render(<Harness initialKind="debt" onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("Lent to"), { target: { value: "Ahmed" } });
    fireEvent.change(screen.getByLabelText("Amount (AED)"), { target: { value: "100" } });
    await choose("Paid from wallet", "Botim");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save debt" }));
    });
    await waitFor(() => expect(of("debts", "delete")).toHaveLength(1));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("explains that a repayment needs an open debt", () => {
    render(<Harness initialKind="debt" />);
    fireEvent.click(screen.getByRole("button", { name: "Repayment" }));
    expect(screen.getByText("Nothing is owed either way")).toBeDefined();
  });

  it("records a part repayment by lowering what is still owed", async () => {
    const onSaved = vi.fn();
    render(<Harness initialKind="debt" openDebts={[debt({})]} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Repayment" }));
    await choose("Debt being repaid", /Ahmed · owes you/);

    const amount = screen.getByLabelText("Amount received (AED)");
    // Defaults to the whole balance.
    expect(amount).toHaveProperty("value", "450");
    expect(screen.getByText(/the debt will be settled/)).toBeDefined();

    fireEvent.change(amount, { target: { value: "100" } });
    expect(screen.getByText(/will still be owed/)).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Record repayment" }));
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(of("debts", "update")[0].payload).toEqual({ amount: 350 });
    expect(of("transactions", "insert")).toHaveLength(0);
  });

  it("refuses a repayment larger than the debt", async () => {
    render(<Harness initialKind="debt" openDebts={[debt({})]} />);
    fireEvent.click(screen.getByRole("button", { name: "Repayment" }));
    await choose("Debt being repaid", /Ahmed · owes you/);
    fireEvent.change(screen.getByLabelText("Amount received (AED)"), { target: { value: "500" } });
    expect(screen.getByText("That is more than is still owed.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Record repayment" }).hasAttribute("disabled")).toBe(true);
  });

  it("knows its entry kinds", () => {
    expect(ENTRY_KINDS.map((k) => k.value)).toEqual(["expense", "income", "transfer", "debt"]);
    expect(isEntryKind("transfer")).toBe(true);
    expect(isEntryKind("adjustment")).toBe(false);
    expect(isEntryKind(null)).toBe(false);
  });
});
