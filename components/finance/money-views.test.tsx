import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Budget, Debt, Transaction } from "@/lib/types/database";
import { ACTIVITY_PAGE, ActivityView } from "./activity-view";
import { BudgetsView } from "./budgets-view";
import { DebtsView } from "./debts-view";
import { budgetLines, summarizeBudgets, unbudgetedSpend } from "@/lib/finance/budgets";
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
      txn({ type: "expense", amount: 5, category: "Fees & Charges", description: "Transfer fee · Mashreq → Savings" }),
    ]);
    expect(screen.getByText("Lent to Ahmed")).toBeDefined();
    expect(screen.getByText("Debt · Mashreq")).toBeDefined();
    expect(screen.getByText(`−${aed(450)}`)).toBeDefined();
    expect(screen.getByText("Repayment from Ahmed")).toBeDefined();
    expect(screen.getByText(`+${aed(200)}`)).toBeDefined();
    expect(screen.getByText("Transfer fee · Mashreq → Savings")).toBeDefined();
    expect(screen.getByText(`−${aed(5)}`)).toBeDefined();
    expect(screen.queryByText("Balance adjusted")).toBeNull();
  });
});

const budget = (id: string, category: string, amount: number, period: Budget["period"] = "monthly"): Budget => ({
  id,
  user_id: "u1",
  category,
  amount,
  period,
  period_start: "2026-11-01",
  period_end: "2026-11-30",
  deleted_at: null,
  created_at: "2026-11-01T00:00:00Z",
});

function renderBudgets(extra: Partial<Parameters<typeof BudgetsView>[0]> = {}, budgets: Budget[] = [], spending: Transaction[] = []) {
  const lines = budgetLines(budgets, spending, "2026-11-01");
  const props = {
    monthLabel: "November 2026",
    lines,
    summary: summarizeBudgets(lines, "2026-11-30", "2026-11-20", true),
    unbudgeted: unbudgetedSpend(spending, budgets, "2026-11-01", "2026-11-30"),
    onPrevMonth: noop,
    onNextMonth: noop,
    onSettings: noop,
    onDelete: noop,
    onCategories: noop,
    ...extra,
  };
  return render(<BudgetsView {...props} />);
}

describe("BudgetsView", () => {
  const budgets = [budget("b1", "Food & Dining", 500), budget("b2", "Groceries", 100), budget("b3", "Transport", 300, "quarterly")];
  const spending = [
    txn({ category: "food & dining", amount: 125, date: "2026-11-04" }),
    txn({ category: "Groceries", amount: 120, date: "2026-11-05" }),
    txn({ category: "Transport", amount: 230, date: "2026-10-05" }),
    txn({ category: "Afridi", amount: 2000, date: "2026-11-06" }),
  ];

  it("summarises the month: total, spent, left, states and a daily allowance", () => {
    renderBudgets({}, budgets, spending);
    const summary = within(screen.getByRole("region", { name: /Monthly budget/ }));
    // Only monthly budgets count toward the month: 500 + 100.
    expect(summary.getByText(aed(600))).toBeDefined();
    expect(summary.getByText(aed(245))).toBeDefined();
    expect(summary.getByText("Left")).toBeDefined();
    expect(summary.getByText(aed(355))).toBeDefined();
    expect(summary.getByText(/1 on track/)).toBeDefined();
    expect(summary.getByText(/1 close to the limit/)).toBeDefined();
    expect(summary.getByText(/1 over/)).toBeDefined();
    expect(summary.getByText(/About AED.*a day for the 11 days left this month/)).toBeDefined();
  });

  it("shows each budget with what is left or how much it is over, matching categories in any case", () => {
    renderBudgets({}, budgets, spending);
    const rows = within(screen.getByRole("list", { name: "Budgets" })).getAllByRole("listitem");
    expect(within(rows[0]).getByText("Food & Dining")).toBeDefined();
    expect(within(rows[0]).getByText(`${aed(125)} of ${aed(500)}`)).toBeDefined();
    expect(within(rows[0]).getByText(`${aed(375)} left`)).toBeDefined();
    expect(within(rows[0]).getByText("25%")).toBeDefined();
    expect(within(rows[1]).getByText(`${aed(20)} over`)).toBeDefined();
    expect(within(rows[1]).getByText("Over")).toBeDefined();
    // The quarterly budget counts October too.
    expect(within(rows[2]).getByText(/per quarter/)).toBeDefined();
    expect(within(rows[2]).getByText(`${aed(70)} left`)).toBeDefined();
  });

  it("lists spending with no budget and opens the settings from it", () => {
    const onSettings = vi.fn();
    renderBudgets({ onSettings }, budgets, spending);
    const section = within(screen.getByRole("region", { name: "Spent without a budget" }));
    expect(section.getByText("Afridi")).toBeDefined();
    expect(section.getByText(aed(2000))).toBeDefined();
    fireEvent.click(section.getByRole("button", { name: "Set budgets" }));
    expect(onSettings).toHaveBeenCalledWith();
  });

  it("opens the settings from the header and focused on a budget from its menu", async () => {
    const onSettings = vi.fn();
    const onDelete = vi.fn();
    renderBudgets({ onSettings, onDelete }, budgets, spending);
    fireEvent.click(screen.getByRole("button", { name: /Edit budgets/ }));
    expect(onSettings).toHaveBeenLastCalledWith();

    fireEvent.click(screen.getByRole("button", { name: "Actions for Groceries budget" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Edit amount/ }));
    expect(onSettings).toHaveBeenLastCalledWith("Groceries");

    fireEvent.click(screen.getByRole("button", { name: "Actions for Groceries budget" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Remove budget/ }));
    expect(onDelete).toHaveBeenCalledWith("b2");
  });

  it("has an empty state that sets budgets, and opens categories", () => {
    const onSettings = vi.fn();
    const onCategories = vi.fn();
    renderBudgets({ onSettings, onCategories });
    expect(screen.getByText("No budgets yet")).toBeDefined();
    expect(screen.queryByRole("region", { name: /Monthly budget/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Set budgets/ }));
    expect(onSettings).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Categories/ }));
    expect(onCategories).toHaveBeenCalledTimes(1);
  });

  it("does not offer the removed tidy-up", () => {
    renderBudgets({}, budgets, spending);
    expect(screen.queryByText(/Tidy up/)).toBeNull();
    expect(screen.queryByText(/Organise your categories/)).toBeNull();
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
