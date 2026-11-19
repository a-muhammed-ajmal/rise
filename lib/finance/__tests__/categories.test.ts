import { describe, expect, it } from "vitest";
import {
  BUDGET_LOOKBACK_MONTHS,
  KEEP,
  MAJOR_CATEGORIES,
  collectLabels,
  defaultMapping,
  initialBudgetAmounts,
  majorNamed,
  mappingKey,
  needsTidyUp,
  normalizeLabel,
  planTidyUp,
  resolveExpense,
  roundBudget,
  sortCategories,
  suggestBudgets,
  suggestMajor,
  type TidyTransaction,
} from "../categories";

const cat = (id: string, name: string, type: "income" | "expense" = "expense") => ({ id, name, type });
const tx = (category: string, amount: number, date = "2026-11-10", type: TidyTransaction["type"] = "expense"): TidyTransaction => ({
  type,
  category,
  amount,
  date,
});

describe("MAJOR_CATEGORIES", () => {
  it("keeps each list within the 10-per-type limit and free of duplicates", () => {
    for (const list of Object.values(MAJOR_CATEGORIES)) {
      expect(list.length).toBeLessThanOrEqual(10);
      expect(new Set(list.map(normalizeLabel)).size).toBe(list.length);
    }
  });
});

describe("normalizeLabel / majorNamed", () => {
  it("ignores case and extra spaces", () => {
    expect(normalizeLabel("  Personal   CARE ")).toBe("personal care");
    expect(majorNamed("expense", "groceries")).toBe("Groceries");
    expect(majorNamed("expense", "Lunch")).toBeNull();
    expect(majorNamed("income", "salary")).toBe("Salary");
  });
});

describe("suggestMajor", () => {
  it.each([
    ["Breakfast", "Food & Dining"],
    ["Lunch", "Food & Dining"],
    ["Dinner", "Food & Dining"],
    ["Night food", "Food & Dining"],
    ["Water bottle", "Food & Dining"],
    ["Grocery", "Groceries"],
    ["Room Rent", "Rent & Housing"],
    ["Transportation", "Transport"],
    ["Sim Data", "Bills & Subscriptions"],
    ["Telecommunications", "Bills & Subscriptions"],
    ["Subscription", "Bills & Subscriptions"],
    ["Personal care", "Personal Care"],
    ["Personal Care", "Personal Care"],
    ["Family Support", "Family Support"],
    ["D-Business", "Business"],
    ["Transaction fee", "Fees & Charges"],
    ["Bank changes", "Fees & Charges"],
    ["VAT", "Fees & Charges"],
    ["Mobile holder", "Shopping & Other"],
    ["Unwanted", "Shopping & Other"],
  ])("files the expense %s under %s", (name, major) => {
    expect(suggestMajor("expense", name)).toBe(major);
  });

  it("never guesses names it cannot know", () => {
    for (const name of ["Baddy", "Afridi", "Anna", "Dept Given", "Loan given"]) {
      expect(suggestMajor("expense", name)).toBe(KEEP);
    }
    expect(suggestMajor("income", "IN-IN")).toBe(KEEP);
    expect(suggestMajor("income", "Afridi")).toBe(KEEP);
  });

  it("maps income separately from expense", () => {
    expect(suggestMajor("income", "D-Business")).toBe("Business Income");
    expect(suggestMajor("income", "Gift")).toBe("Other Income");
    expect(suggestMajor("income", "Lunch")).toBe(KEEP);
  });
});

describe("sortCategories", () => {
  it("lists expense then income, majors first in their set order, then the rest A–Z", () => {
    const sorted = sortCategories([
      cat("1", "Zakat"),
      cat("2", "Transport"),
      cat("3", "Baddy"),
      cat("4", "Food & Dining"),
      cat("5", "Salary", "income"),
    ]);
    expect(sorted.map((c) => c.name)).toEqual(["Food & Dining", "Transport", "Baddy", "Zakat", "Salary"]);
  });
});

describe("collectLabels", () => {
  it("counts usage, skips majors and non income/expense rows, and lists expense first by use", () => {
    const labels = collectLabels(
      [cat("c-lunch", "Lunch"), cat("c-food", "Food & Dining"), cat("c-in", "IN-IN", "income"), cat("c-unused", "Old")],
      [
        tx("Lunch", 16),
        tx("Lunch", 19.5),
        tx("Grocery", 10.1),
        tx("Food & Dining", 50),
        tx("IN-IN", 100, "2026-11-10", "income"),
        tx("Transfer", 500, "2026-11-10", "transfer"),
        tx("Debt", -300, "2026-11-10", "adjustment"),
        tx("  ", 1),
      ],
    );
    expect(labels).toEqual([
      { kind: "expense", name: "Lunch", count: 2, total: 35.5, categoryId: "c-lunch" },
      { kind: "expense", name: "Grocery", count: 1, total: 10.1, categoryId: null },
      { kind: "expense", name: "Old", count: 0, total: 0, categoryId: "c-unused" },
      { kind: "income", name: "IN-IN", count: 1, total: 100, categoryId: "c-in" },
    ]);
  });

  it("keeps the same name apart by type", () => {
    const labels = collectLabels([], [tx("D-Business", 10), tx("D-Business", 20, "2026-11-10", "income")]);
    expect(labels.map(mappingKey)).toEqual(["expense:D-Business", "income:D-Business"]);
  });
});

describe("defaultMapping / needsTidyUp", () => {
  it("pre-fills the suggestions", () => {
    const labels = collectLabels([], [tx("Lunch", 1), tx("Baddy", 1)]);
    expect(defaultMapping(labels)).toEqual({ "expense:Lunch": "Food & Dining", "expense:Baddy": KEEP });
  });

  it("is needed while a known small category remains", () => {
    expect(needsTidyUp([], [tx("Lunch", 1)])).toBe(true);
    expect(needsTidyUp([], [tx("Baddy", 1)])).toBe(false);
    expect(needsTidyUp([], [])).toBe(false);
  });

  it("is needed while a user with categories lacks a major one", () => {
    const all = [
      ...MAJOR_CATEGORIES.expense.map((name, i) => cat(`e${i}`, name)),
      ...MAJOR_CATEGORIES.income.map((name, i) => cat(`i${i}`, name, "income")),
    ];
    expect(needsTidyUp(all, [tx("Baddy", 1)])).toBe(false);
    expect(needsTidyUp(all.slice(1), [])).toBe(true);
  });
});

describe("planTidyUp", () => {
  it("adds missing majors, re-labels mapped names and removes their rows", () => {
    const categories = [cat("c-lunch", "Lunch"), cat("c-baddy", "Baddy"), cat("c-food", "food & dining")];
    const labels = collectLabels(categories, [tx("Lunch", 16), tx("Lunch", 9), tx("Grocery", 10), tx("Baddy", 5)]);
    const mapping = { ...defaultMapping(labels), "expense:Baddy": "Shopping & Other" };
    const plan = planTidyUp(labels, mapping, categories);

    // "food & dining" already exists (any case), so it is not created again.
    expect(plan.createCategories.map((c) => c.name)).not.toContain("Food & Dining");
    expect(plan.createCategories).toHaveLength(MAJOR_CATEGORIES.expense.length - 1 + MAJOR_CATEGORIES.income.length);
    expect(plan.relabel).toEqual([
      { kind: "expense", from: "Lunch", to: "Food & Dining" },
      { kind: "expense", from: "Baddy", to: "Shopping & Other" },
      { kind: "expense", from: "Grocery", to: "Groceries" },
    ]);
    expect(plan.deleteCategoryIds).toEqual(["c-lunch", "c-baddy"]);
    expect(plan.transactionCount).toBe(4);
  });

  it("leaves kept names, unknown targets and wrong-type targets alone", () => {
    const labels = collectLabels([], [tx("Baddy", 1), tx("Lunch", 1), tx("IN-IN", 1, "2026-11-01", "income")]);
    const plan = planTidyUp(
      labels,
      { "expense:Baddy": KEEP, "expense:Lunch": "Not a major", "income:IN-IN": "Groceries" },
      [],
    );
    expect(plan.relabel).toEqual([]);
    expect(plan.transactionCount).toBe(0);
  });
});

describe("budgets", () => {
  it("rounds suggestions up to the next 50", () => {
    expect(roundBudget(0)).toBe(0);
    expect(roundBudget(-5)).toBe(0);
    expect(roundBudget(Number.NaN)).toBe(0);
    expect(roundBudget(1)).toBe(50);
    expect(roundBudget(50)).toBe(50);
    expect(roundBudget(50.01)).toBe(100);
    expect(roundBudget(437.2)).toBe(450);
  });

  it("resolves an expense to its major through the mapping", () => {
    const mapping = { "expense:Lunch": "Food & Dining", "expense:Baddy": KEEP, "expense:Odd": "Nope" };
    expect(resolveExpense("Groceries", mapping)).toBe("Groceries");
    expect(resolveExpense("Lunch", mapping)).toBe("Food & Dining");
    expect(resolveExpense("Baddy", mapping)).toBeNull();
    expect(resolveExpense("Odd", mapping)).toBeNull();
    expect(resolveExpense("Unseen", mapping)).toBeNull();
  });

  it("averages spending over the tracked months in the look-back window", () => {
    const mapping = { "expense:Lunch": "Food & Dining", "expense:Grocery": "Groceries" };
    const { suggestions, months } = suggestBudgets(
      [
        tx("Lunch", 300, "2026-11-05"),
        tx("Lunch", 100, "2026-08-20"),
        tx("Grocery", 90, "2026-11-01"),
        tx("Baddy", 999, "2026-09-01"), // tracked month, but kept as its own
        tx("Lunch", 5000, "2026-07-31"), // before the window
        tx("Lunch", 5000, "2026-12-01"), // after today
        tx("Salary", 9000, "2026-11-01", "income"),
      ],
      mapping,
      "2026-11-20",
    );
    expect(BUDGET_LOOKBACK_MONTHS).toBe(4);
    // October was never tracked, so it does not count.
    expect(months).toEqual(["2026-08", "2026-09", "2026-11"]);
    const food = suggestions.find((s) => s.category === "Food & Dining");
    expect(food).toEqual({ category: "Food & Dining", average: 133.33, suggested: 150 });
    expect(suggestions.find((s) => s.category === "Groceries")).toEqual({ category: "Groceries", average: 30, suggested: 50 });
    expect(suggestions.find((s) => s.category === "Transport")).toEqual({ category: "Transport", average: 0, suggested: 0 });
    expect(suggestions).toHaveLength(MAJOR_CATEGORIES.expense.length);
  });

  it("crosses a year boundary when looking back", () => {
    const { months } = suggestBudgets([tx("Lunch", 1, "2025-10-01"), tx("Lunch", 1, "2025-11-01")], {}, "2026-02-03");
    expect(months).toEqual(["2025-11"]);
  });

  it("suggests nothing when nothing was tracked", () => {
    const { suggestions, months } = suggestBudgets([], {}, "2026-11-20");
    expect(months).toEqual([]);
    expect(suggestions.every((s) => s.suggested === 0 && s.average === 0)).toBe(true);
  });

  it("starts from an existing budget, then folded budgets, then the suggestion", () => {
    const suggestions = [
      { category: "Food & Dining", average: 120, suggested: 150 },
      { category: "Groceries", average: 80, suggested: 100 },
      { category: "Transport", average: 0, suggested: 0 },
    ];
    const amounts = initialBudgetAmounts(
      suggestions,
      [
        { category: "groceries", amount: 300 },
        { category: "Lunch", amount: 200 },
        { category: "Dinner", amount: 100 },
      ],
      { "expense:Lunch": "Food & Dining", "expense:Dinner": "Food & Dining" },
    );
    expect(amounts).toEqual({ "Food & Dining": 300, Groceries: 300, Transport: 0 });
  });
});
