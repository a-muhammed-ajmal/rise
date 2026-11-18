// Month figures for the Finance home and the Budgets view.
//
// Pure and UI-agnostic so the arithmetic is unit-tested on its own. Only
// income and expense rows count: a transfer moves money between your own
// wallets and an adjustment corrects a balance, so neither is money in or out.

import type { Transaction } from "@/lib/types/database";

export type MonthTransaction = Pick<Transaction, "type" | "amount" | "category" | "date">;

export interface MonthSummary {
  /** Income dated inside the range. */
  moneyIn: number;
  /** Expenses dated inside the range. */
  moneyOut: number;
  /** moneyIn − moneyOut */
  net: number;
  /** Share of income kept, as a whole percent; null when there was no income. */
  savingRate: number | null;
}

export type BudgetLevel = "ok" | "warn" | "over";

// Round to whole fils so float noise never reaches the screen, and fold -0
// into 0 so an exactly balanced month is not shown as "-AED 0.00".
function toFils(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

/** First and last day ("yyyy-MM-dd") of the month that contains `isoDate`. */
export function monthBounds(isoDate: string): { start: string; end: string } {
  const [year, month] = isoDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/** Whole-percent share of income kept; null when there was no income to keep. */
export function savingRate(moneyIn: number, moneyOut: number): number | null {
  if (moneyIn <= 0) return null;
  return Math.round(((moneyIn - moneyOut) / moneyIn) * 100);
}

export function summarizeMonth(
  transactions: readonly MonthTransaction[],
  start: string,
  end: string,
): MonthSummary {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const t of transactions) {
    if (!inRange(t.date, start, end)) continue;
    if (t.type === "income") moneyIn += t.amount;
    else if (t.type === "expense") moneyOut += t.amount;
  }
  moneyIn = toFils(moneyIn);
  moneyOut = toFils(moneyOut);
  return { moneyIn, moneyOut, net: toFils(moneyIn - moneyOut), savingRate: savingRate(moneyIn, moneyOut) };
}

/** Expense total per category for the range. */
export function spentByCategory(
  transactions: readonly MonthTransaction[],
  start: string,
  end: string,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type !== "expense" || !inRange(t.date, start, end)) continue;
    totals[t.category] = (totals[t.category] ?? 0) + t.amount;
  }
  for (const key of Object.keys(totals)) totals[key] = toFils(totals[key]);
  return totals;
}

/**
 * Whole percent of the budget used, rounded down so the number never crosses
 * a colour boundary before budgetLevel() does (74.9% shows 74, still green).
 * A zero budget with any spending is 100.
 */
export function budgetPercent(spent: number, amount: number): number {
  if (amount <= 0) return spent > 0 ? 100 : 0;
  return Math.floor((spent / amount) * 100 + 1e-9);
}

/** Under 75% is fine, 75–100% is a warning, anything above the budget is over. */
export function budgetLevel(spent: number, amount: number): BudgetLevel {
  if (amount <= 0) return spent > 0 ? "over" : "ok";
  const ratio = spent / amount;
  if (ratio > 1) return "over";
  if (ratio >= 0.75) return "warn";
  return "ok";
}
