import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Budget, Debt, Transaction } from "@/lib/types/database";
import { ACTIVITY_PAGE, ActivityView } from "./activity-view";
import { BudgetsView } from "./budgets-view";
import { DebtsView } from "./debts-view";
import { formatAED } from "@/lib/format";

afterEach(cleanup);

const aed = (amount: number) => formatAED(amount).replace(/\s+/g, " ");
const TODAY = "2026-11-18";

let seq = 0;
function txn(over: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    user_id: "u1",
    type: "expense",
    amount: 10,
    category: "Food",
    description: null,
    date: TODAY,
    payment_method: null,
    payment_method_id: "w1",
    from_payment_method_id: null,
    to_payment_method_id: null,
    tags: [],
    deleted_at: null,
    created_at: `2026-11-18T10:${String(seq % 60).padStart(2, "0")}:00Z`,
    ...over,
  };
}

const wallets = { w1: "Mashreq", w2: "Savings" };
const noop = () => {};

function renderActivity(transactions: Transaction[], extra: Partial<Parameters<typeof ActivityView>[0]> = {}) {
  return render(
    <ActivityView
      transactions={transactions}
      walletNameById={wallets}
      today={TODAY}
      onAddExpense={noop}
      onAddIncome={noop}
      onTransfer={noop}
      onEdit={noop}
      onDelete={noop}
      {...extra}
    />,
  );
}

describe("ActivityView", () => {
  it("groups rows by day and shows each kind with its sign", () => {
    renderActivity([
      txn({ type: "income", amount: 5000, category: "Salary", description: "Pay" }),
      txn({ type: "expense", amount: 42, description: "Lunch", date: "2026-11-17" }),
      txn({ type: "transfer", amount: 300, payment_method_id: null, from_payment_method_id: "w1", to_payment_method_id: "w2", date: "2026-11-16" }),
      txn({ type: "adjustment", amount: -12.4, description: "Bank fee", date: "2026-11-16" }),
    ]);

    expect(screen.getByRole("region", { name: "Today" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Yesterday" })).toBeDefined();
    const older = within(screen.getByRole("region", { name: "Mon, 16/11/2026" }));
    expect(older.getByText("Mashreq → Savings")).toBeDefined();
    expect(older.getByText(aed(300))).toBeDefined();
    expect(older.getByText("Balance adjusted")).toBeDefined();
    expect(older.getByText("Mashreq · Bank fee")).toBeDefined();
    expect(older.getByText(`−${aed(12.4)}`)).toBeDefined();
    expect(screen.getByText(`+${aed(5000)}`)).toBeDefined();
    expect(screen.getByText("Salary · Mashreq")).toBeDefined();
    expect(screen.getByText(`−${aed(42)}`)).toBeDefined();
    // Only income and expense rows can be edited or deleted here.
    expect(screen.getAllByRole("button", { name: /^Actions for/ })).toHaveLength(2);
  });

  it("wires the add, income and transfer buttons", () => {
    const onAddExpense = vi.fn();
    const onAddIncome = vi.fn();
    const onTransfer = vi.fn();
    renderActivity([], { onAddExpense, onAddIncome, onTransfer });
    expect(screen.getByText("No activity yet")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    fireEvent.click(screen.getByRole("button", { name: "Add income" }));
    fireEvent.click(screen.getByRole("button", { name: "New transfer" }));
    expect([onAddExpense, onAddIncome, onTransfer].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it("shows the first page and loads more on request", () => {
    const many = Array.from({ length: ACTIVITY_PAGE + 5 }, (_, i) =>
      txn({ description: `Row ${i}`, date: `2026-11-${String((i % 18) + 1).padStart(2, "0")}` }),
    );
    renderActivity(many);
    expect(screen.getAllByRole("button", { name: /^Actions for/ })).toHaveLength(ACTIVITY_PAGE);
    fireEvent.click(screen.getByRole("button", { name: "Show 5 more" }));
    expect(screen.getAllByRole("button", { name: /^Actions for/ })).toHaveLength(ACTIVITY_PAGE + 5);
    expect(screen.queryByRole("button", { name: /Show \d+ more/ })).toBeNull();
  });

  it("names debt movements and transfer fees instead of calling them adjustments", () => {
    renderActivity([
      txn({ type: "adjustment", amount: -450, category: "Debt", description: "Lent to Ahmed", payment_method_id: "w1" }),
      txn({ type: "adjustment", amount: 200, category: "Debt", description: "Repayment from Ahmed", payment_method_id: "w2" }),
      txn({ type: "expense", amount: 5, category: "Transfer fee", description: "Fee · Mashreq → Savings" }),
    ]);
    expect(screen.getByText("Lent to Ahmed")).toBeDefined();
    expect(screen.getByText("Debt · Mashreq")).toBeDefined();
    expect(screen.getByText(`−${aed(450)}`)).toBeDefined();
    expect(screen.getByText("Repayment from Ahmed")).toBeDefined();
    expect(screen.getByText(`+${aed(200)}`)).toBeDefined();
    expect(screen.getByText("Fee · Mashreq → Savings")).toBeDefined();
    expect(screen.getByText(`−${aed(5)}`)).toBeDefined();
    expect(screen.queryByText("Balance adjusted")).toBeNull();
  });
});

function budget(id: string, category: string, amount: number, period: Budget["period"] = "monthly"): Budget {
  return { id, user_id: "u1", category, amount, period, period_start: "2026-11-01", period_end: "2026-11-30", deleted_at: null, created_at: "2026-11-01T00:00:00Z" };
}

describe("BudgetsView", () => {
  it("shows each budget's use, the total, and spending with no budget", () => {
    render(
      <BudgetsView
        monthLabel="November 2026"
        budgets={[budget("b1", "Food", 1000), budget("b2", "Fuel", 200, "yearly")]}
        spent={{ Food: 1100, Fuel: 50, Gifts: 75 }}
        onAdd={noop}
        onEdit={noop}
        onDelete={noop}
        onCategories={noop}
      />,
    );
    expect(screen.getByText("110%")).toBeDefined();
    expect(screen.getByText(`over by ${aed(100)}`)).toBeDefined();
    expect(screen.getByText("25%")).toBeDefined();
    expect(screen.getByText("· yearly")).toBeDefined();
    // One bar for the total and one per budget, each read out as words.
    const meters = screen.getAllByRole("meter");
    expect(meters).toHaveLength(3);
    expect(meters.map((m) => m.getAttribute("aria-valuetext"))).toEqual(["95% used", "110% used", "25% used"]);
    const unbudgeted = within(screen.getByRole("region", { name: "Spent without a budget" }));
    expect(unbudgeted.getByText("Gifts")).toBeDefined();
    expect(unbudgeted.queryByText("Food")).toBeNull();
  });

  it("shows an empty state and opens categories", () => {
    const onCategories = vi.fn();
    const onAdd = vi.fn();
    render(
      <BudgetsView monthLabel="November 2026" budgets={[]} spent={{}} onAdd={onAdd} onEdit={noop} onDelete={noop} onCategories={onCategories} />,
    );
    expect(screen.getByText("No budgets yet")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("button", { name: "Add budget" }));
    expect(onCategories).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

function debt(over: Partial<Debt>): Debt {
  return { id: "d", user_id: "u1", creditor: "Sam", type: "i_owe", amount: 100, description: null, due_date: null, paid_at: null, deleted_at: null, created_at: "2026-11-01T00:00:00Z", ...over };
}

describe("DebtsView", () => {
  it("shows both totals, due badges and who owes whom", () => {
    render(
      <DebtsView
        openDebts={[
          debt({ id: "a", creditor: "Rahul", type: "they_owe", amount: 1500, due_date: "2026-11-12" }),
          debt({ id: "b", creditor: "Loan", amount: 4000, due_date: "2026-11-19" }),
        ]}
        settledDebts={[debt({ id: "c", creditor: "Priya", amount: 300, paid_at: "2026-11-08T21:30:00Z" })]}
        owedToYou={1500}
        youOwe={4000}
        owedToYouCount={1}
        youOweCount={1}
        today={TODAY}
        onAdd={noop}
        onMarkPaid={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText("Owed to me")).toBeDefined();
    expect(screen.getByText("I owe")).toBeDefined();
    expect(screen.getByText("Overdue")).toBeDefined();
    expect(screen.getByText("Tomorrow")).toBeDefined();
    expect(screen.getByText("Owes you")).toBeDefined();
    expect(screen.getByText("You owe")).toBeDefined();

    expect(screen.queryByText("Priya")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show settled (1)" }));
    expect(screen.getByText("Priya")).toBeDefined();
    // Paid late evening UTC is the next morning in Dubai.
    expect(screen.getByText("Paid 09/11/2026")).toBeDefined();
  });

  it("shows an empty state when nothing is owed", () => {
    const onAdd = vi.fn();
    render(
      <DebtsView openDebts={[]} settledDebts={[]} owedToYou={0} youOwe={0} owedToYouCount={0} youOweCount={0} today={TODAY} onAdd={onAdd} onMarkPaid={noop} onEdit={noop} onDelete={noop} />,
    );
    expect(screen.getByText("Nothing owed either way")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Add a debt" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
