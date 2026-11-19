import { describe, expect, it } from "vitest";
import {
  AVERAGE_MONTHS,
  averageMonthlySpend,
  budgetLines,
  budgetSettingRows,
  hasChanges,
  periodBounds,
  planBudgetChanges,
  spentInRange,
  standingBudgets,
  summarizeBudgets,
  unbudgetedSpend,
  type BudgetRow,
  type SpendRow,
} from "../budgets";

const budget = (id: string, category: string, amount: number, over: Partial<BudgetRow> = {}): BudgetRow => ({
  id,
  category,
  amount,
  period: "monthly",
  period_start: "2026-11-01",
  created_at: "2026-11-20T08:00:00Z",
  ...over,
});
const spend = (category: string, amount: number, date: string, type: SpendRow["type"] = "expense"): SpendRow => ({
  type,
  category,
  amount,
  date,
});

describe("standingBudgets", () => {
  it("keeps one budget per category (any case): the latest set wins, majors first", () => {
    const result = standingBudgets([
      budget("old", "Food & Dining", 300, { period_start: "2026-10-01" }),
      budget("new", "food & dining", 500, { period_start: "2026-11-01" }),
      budget("a", "Baddy", 100),
      budget("b1", "Groceries", 200, { created_at: "2026-11-01T00:00:00Z" }),
      budget("b2", "Groceries", 250, { created_at: "2026-11-02T00:00:00Z" }),
    ]);
    expect(result.map((b) => b.id)).toEqual(["new", "b2", "a"]);
  });
});

describe("periodBounds", () => {
  it("covers the month, quarter or year containing the date", () => {
    expect(periodBounds("monthly", "2026-11-20")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(periodBounds("monthly", "2028-02-10")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(periodBounds("quarterly", "2026-11-20")).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    expect(periodBounds("quarterly", "2026-02-01")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
    expect(periodBounds("yearly", "2026-07-04")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});

describe("spentInRange", () => {
  it("adds expenses in the category, any case, inside the range only", () => {
    const rows = [
      spend("Personal care", 196.88, "2026-11-15"),
      spend("Personal Care", 12, "2026-11-15"),
      spend("personal care", 15, "2026-10-31"),
      spend("Personal Care", 999, "2026-11-15", "income"),
      spend("Groceries", 10, "2026-11-15"),
    ];
    expect(spentInRange(rows, "Personal Care", "2026-11-01", "2026-11-30")).toBe(208.88);
    expect(spentInRange(rows, "Transport", "2026-11-01", "2026-11-30")).toBe(0);
  });
});

describe("budgetLines", () => {
  it("measures each standing budget against its own period", () => {
    const lines = budgetLines(
      [
        budget("f", "Food & Dining", 500),
        budget("p", "Personal Care", 200),
        budget("t", "Transport", 300, { period: "quarterly" }),
      ],
      [
        spend("Food & Dining", 125, "2026-11-04"),
        spend("Food & Dining", 400, "2026-10-04"),
        spend("Personal care", 210, "2026-11-15"),
        spend("Transport", 100, "2026-10-02"),
        spend("Transport", 140, "2026-11-02"),
      ],
      "2026-11-01",
    );
    expect(lines).toEqual([
      { id: "f", category: "Food & Dining", amount: 500, period: "monthly", spent: 125, left: 375, percent: 25, level: "ok" },
      { id: "t", category: "Transport", amount: 300, period: "quarterly", spent: 240, left: 60, percent: 80, level: "warn" },
      { id: "p", category: "Personal Care", amount: 200, period: "monthly", spent: 210, left: -10, percent: 105, level: "over" },
    ]);
  });
});

describe("summarizeBudgets", () => {
  const lines = budgetLines(
    [budget("f", "Food & Dining", 500), budget("g", "Groceries", 300), budget("t", "Transport", 900, { period: "yearly" })],
    [spend("Food & Dining", 450, "2026-11-04"), spend("Groceries", 320, "2026-11-04"), spend("Transport", 10, "2026-03-01")],
    "2026-11-20",
  );

  it("totals the monthly budgets, counts each state and works out a daily allowance", () => {
    expect(summarizeBudgets(lines, "2026-11-30", "2026-11-20", true)).toEqual({
      budgeted: 800,
      spent: 770,
      left: 30,
      onTrack: 1,
      close: 1,
      over: 1,
      daysLeft: 11,
      perDay: 2.73,
    });
  });

  it("has no daily allowance for another month", () => {
    const summary = summarizeBudgets(lines, "2026-10-31", "2026-11-20", false);
    expect(summary.daysLeft).toBeNull();
    expect(summary.perDay).toBeNull();
  });

  it("never offers a negative daily allowance", () => {
    const over = budgetLines([budget("f", "Food & Dining", 100)], [spend("Food & Dining", 150, "2026-11-02")], "2026-11-20");
    expect(summarizeBudgets(over, "2026-11-30", "2026-11-30", true)).toMatchObject({ left: -50, daysLeft: 1, perDay: 0 });
  });

  it("is empty without budgets", () => {
    expect(summarizeBudgets([], "2026-11-30", "2026-11-20", true)).toMatchObject({ budgeted: 0, perDay: null });
  });
});

describe("unbudgetedSpend", () => {
  it("lists this month's spending on categories with no budget, any case, largest first", () => {
    const result = unbudgetedSpend(
      [
        spend("Afridi", 1000, "2026-11-13"),
        spend("Afridi", 2000, "2026-11-12"),
        spend("Baddy", 56.39, "2026-11-14"),
        spend("baddy", 18.5, "2026-11-16"),
        spend("Personal care", 196.88, "2026-11-15"),
        spend("Afridi", 5, "2026-10-31"),
        spend("Salary", 900, "2026-11-01", "income"),
        spend(" ", 3, "2026-11-01"),
      ],
      [{ category: "Personal Care" }],
      "2026-11-01",
      "2026-11-30",
    );
    expect(result).toEqual([
      ["Afridi", 3000],
      ["Baddy", 74.89],
    ]);
  });
});

describe("averageMonthlySpend", () => {
  it("averages over the tracked months in the window", () => {
    const averages = averageMonthlySpend(
      [
        spend("Food & Dining", 300, "2026-11-05"),
        spend("food & dining", 100, "2026-08-20"),
        spend("Baddy", 60, "2026-09-01"),
        spend("Food & Dining", 5000, "2026-07-31"),
        spend("Salary", 9000, "2026-11-01", "income"),
      ],
      "2026-11-20",
    );
    expect(AVERAGE_MONTHS).toBe(4);
    // Aug, Sep and Nov were tracked; October was not.
    expect(averages).toEqual({ "food & dining": 133.33, baddy: 20 });
  });

  it("crosses a year boundary", () => {
    expect(averageMonthlySpend([spend("X", 10, "2025-10-01"), spend("X", 20, "2025-11-01")], "2026-02-03")).toEqual({ x: 20 });
  });
});

describe("budget settings", () => {
  const categories = [
    { name: "Food & Dining", type: "expense" as const },
    { name: "Personal care", type: "expense" as const },
    { name: "Baddy", type: "expense" as const },
    { name: "food & dining", type: "expense" as const },
    { name: "Salary", type: "income" as const },
  ];
  const budgets = [budget("f", "Food & Dining", 500), budget("p", "Personal Care", 200), budget("x", "Old one", 50)];

  it("lists every expense category once with its budget, plus budgeted names not in the list", () => {
    const rows = budgetSettingRows(categories, budgets);
    expect(rows.map((r) => [r.category, r.budget?.id ?? null])).toEqual([
      ["Food & Dining", "f"],
      ["Personal care", "p"],
      ["Baddy", null],
      ["Old one", "x"],
    ]);
  });

  it("plans creates, updates and removals from the boxes", () => {
    const rows = budgetSettingRows(categories, budgets);
    const plan = planBudgetChanges(rows, {
      "Food & Dining": "650.556",
      "Personal care": "200",
      Baddy: " 150 ",
      "Old one": "",
    });
    expect(plan).toEqual({
      ok: true,
      changes: {
        create: [{ category: "Baddy", amount: 150 }],
        update: [{ id: "f", amount: 650.56 }],
        remove: [{ id: "x", category: "Old one" }],
      },
    });
    expect(plan.ok && hasChanges(plan.changes)).toBe(true);
  });

  it("keeps untouched rows as they are and treats 0 like empty", () => {
    const rows = budgetSettingRows(categories, budgets);
    const untouched = planBudgetChanges(rows, {});
    expect(untouched.ok && hasChanges(untouched.changes)).toBe(false);
    expect(planBudgetChanges(rows, { Baddy: "0", "Personal care": "0" })).toEqual({
      ok: true,
      changes: { create: [], update: [], remove: [{ id: "p", category: "Personal care" }] },
    });
  });

  it("refuses a negative or non-numeric amount and names the category", () => {
    const rows = budgetSettingRows(categories, budgets);
    expect(planBudgetChanges(rows, { Baddy: "-1" })).toEqual({ ok: false, category: "Baddy" });
    expect(planBudgetChanges(rows, { "Food & Dining": "abc" })).toEqual({ ok: false, category: "Food & Dining" });
  });
});
