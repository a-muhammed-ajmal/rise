import { describe, expect, it } from "vitest";
import {
  budgetLevel,
  budgetPercent,
  monthBounds,
  savingRate,
  spentByCategory,
  summarizeMonth,
  type MonthTransaction,
} from "../month";

const t = (
  type: MonthTransaction["type"],
  amount: number,
  date: string,
  category = "Food",
): MonthTransaction => ({ type, amount, date, category });

describe("monthBounds", () => {
  it("returns the first and last day of a 30-day month", () => {
    expect(monthBounds("2026-11-18")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });
  it("handles a 31-day month and February in a leap year", () => {
    expect(monthBounds("2026-12-05")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(monthBounds("2028-02-10")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(monthBounds("2027-02-10")).toEqual({ start: "2027-02-01", end: "2027-02-28" });
  });
});

describe("savingRate", () => {
  it("is the whole-percent share of income kept", () => {
    expect(savingRate(10000, 8000)).toBe(20);
    expect(savingRate(3000, 1000)).toBe(67);
  });
  it("goes negative when spending passes income", () => {
    expect(savingRate(1000, 1500)).toBe(-50);
  });
  it("is null with no income, so nothing is divided by zero", () => {
    expect(savingRate(0, 500)).toBeNull();
    expect(savingRate(-1, 0)).toBeNull();
  });
});

describe("summarizeMonth", () => {
  const rows = [
    t("income", 10000, "2026-11-01"),
    t("expense", 1200.5, "2026-11-15"),
    t("expense", 300.25, "2026-11-30"),
    t("transfer", 5000, "2026-11-10"),
    t("adjustment", -40, "2026-11-11"),
    t("expense", 999, "2026-10-31"),
    t("income", 50, "2026-12-01"),
  ];

  it("counts income and expenses inside the month only", () => {
    expect(summarizeMonth(rows, "2026-11-01", "2026-11-30")).toEqual({
      moneyIn: 10000,
      moneyOut: 1500.75,
      net: 8499.25,
      savingRate: 85,
    });
  });

  it("ignores transfers and adjustments", () => {
    const summary = summarizeMonth(
      [t("transfer", 100, "2026-11-02"), t("adjustment", 25, "2026-11-02")],
      "2026-11-01",
      "2026-11-30",
    );
    expect(summary).toEqual({ moneyIn: 0, moneyOut: 0, net: 0, savingRate: null });
  });

  it("rounds float noise to whole fils and never shows -0", () => {
    const summary = summarizeMonth(
      [t("income", 0.1, "2026-11-02"), t("income", 0.2, "2026-11-02"), t("expense", 0.3, "2026-11-03")],
      "2026-11-01",
      "2026-11-30",
    );
    expect(summary.moneyIn).toBe(0.3);
    expect(Object.is(summary.net, -0)).toBe(false);
    expect(summary.net).toBe(0);
  });
});

describe("spentByCategory", () => {
  it("totals expenses per category inside the range", () => {
    const rows = [
      t("expense", 100, "2026-11-02", "Food"),
      t("expense", 50.1, "2026-11-03", "Food"),
      t("expense", 20, "2026-11-03", "Fuel"),
      t("income", 900, "2026-11-03", "Salary"),
      t("expense", 70, "2026-10-30", "Food"),
    ];
    expect(spentByCategory(rows, "2026-11-01", "2026-11-30")).toEqual({ Food: 150.1, Fuel: 20 });
  });
  it("is empty when nothing was spent", () => {
    expect(spentByCategory([], "2026-11-01", "2026-11-30")).toEqual({});
  });
});

describe("budget levels", () => {
  it("matches the colour bands: under 75% ok, 75–100% warn, above 100% over", () => {
    expect(budgetLevel(700, 1000)).toBe("ok");
    expect(budgetLevel(749.99, 1000)).toBe("ok");
    expect(budgetLevel(750, 1000)).toBe("warn");
    expect(budgetLevel(1000, 1000)).toBe("warn");
    expect(budgetLevel(1000.01, 1000)).toBe("over");
  });

  it("rounds the percent down so it never crosses a band early", () => {
    expect(budgetPercent(749.99, 1000)).toBe(74);
    expect(budgetPercent(800, 1000)).toBe(80);
    expect(budgetPercent(1100, 1000)).toBe(110);
    // 0.29 * 100 is 28.999… in floating point; it must still read 29.
    expect(budgetPercent(0.29, 1)).toBe(29);
    expect(budgetPercent(0.58, 1)).toBe(58);
  });

  it("treats a zero budget as over once anything is spent", () => {
    expect(budgetLevel(0, 0)).toBe("ok");
    expect(budgetLevel(5, 0)).toBe("over");
    expect(budgetPercent(0, 0)).toBe(0);
    expect(budgetPercent(5, 0)).toBe(100);
  });
});
