import { describe, expect, it } from "vitest";
import { needsAttention, type AttentionBudget, type AttentionDebt } from "../attention";
import { formatAED } from "@/lib/format";

const TODAY = "2026-11-18";

const debt = (id: string, over: Partial<AttentionDebt> = {}): AttentionDebt => ({
  id,
  creditor: `Person ${id}`,
  type: "i_owe",
  amount: 100,
  due_date: null,
  paid_at: null,
  deleted_at: null,
  ...over,
});
const budget = (id: string, category: string, amount: number): AttentionBudget => ({ id, category, amount });

describe("needsAttention", () => {
  it("is empty when nothing is late, due or near its budget", () => {
    expect(
      needsAttention({
        debts: [debt("1", { due_date: "2026-12-30" }), debt("2")],
        budgets: [budget("b1", "Food", 1000)],
        spent: { Food: 700 },
        today: TODAY,
      }),
    ).toEqual([]);
  });

  it("orders overdue debts, over budgets, debts due soon, then budgets near their limit", () => {
    const items = needsAttention({
      debts: [
        debt("soon", { due_date: "2026-11-20", creditor: "Sara", type: "they_owe", amount: 250 }),
        debt("late", { due_date: "2026-11-10", creditor: "Bank", amount: 1500 }),
        debt("paid", { due_date: "2026-11-01", paid_at: "2026-11-02T08:00:00Z" }),
      ],
      budgets: [budget("b1", "Food", 1000), budget("b2", "Fuel", 400), budget("b3", "Fun", 200)],
      spent: { Food: 1100, Fuel: 320, Fun: 10 },
      today: TODAY,
    });

    expect(items.map((i) => i.key)).toEqual(["debt-late", "budget-b1", "debt-soon", "budget-b2"]);
    expect(items.map((i) => i.level)).toEqual(["danger", "danger", "warning", "warning"]);
    expect(items.map((i) => i.target)).toEqual(["debts", "budgets", "debts", "budgets"]);

    expect(items[0]).toMatchObject({ title: "Bank — 8 days overdue", detail: `You owe ${formatAED(1500)}` });
    expect(items[1]).toMatchObject({
      title: "Food budget is over",
      detail: `${formatAED(1100)} of ${formatAED(1000)} · over by ${formatAED(100)}`,
    });
    expect(items[2]).toMatchObject({ title: "Sara — due in 2 days", detail: `Owes you ${formatAED(250)}` });
    expect(items[3]).toMatchObject({
      title: "Fuel budget at 80%",
      detail: `${formatAED(320)} of ${formatAED(400)} · ${formatAED(80)} left`,
    });
  });

  it("lists the most used budgets first inside each level", () => {
    const items = needsAttention({
      debts: [],
      budgets: [budget("a", "A", 100), budget("b", "B", 100), budget("c", "C", 100), budget("d", "D", 100)],
      spent: { A: 120, B: 180, C: 76, D: 95 },
      today: TODAY,
    });
    expect(items.map((i) => i.key)).toEqual(["budget-b", "budget-a", "budget-d", "budget-c"]);
  });

  it("treats a category with no spending as untouched", () => {
    expect(needsAttention({ debts: [], budgets: [budget("x", "Rent", 5000)], spent: {}, today: TODAY })).toEqual([]);
  });
});
