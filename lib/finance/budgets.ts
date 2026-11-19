// Budgets as settings: one standing limit per category that repeats every
// period (month, quarter or year) until it is changed or removed. The row's
// period_start / period_end only record when it was set — they never expire it.
//
// Pure so the arithmetic is unit-tested; lib/data/budgets.ts writes changes.

import type { Budget, Category, Transaction } from "@/lib/types/database";
import { MAJOR_CATEGORIES, normalizeLabel } from "./categories";
import { budgetLevel, budgetPercent, monthBounds, type BudgetLevel } from "./month";

export type BudgetRow = Pick<Budget, "id" | "category" | "amount" | "period" | "period_start" | "created_at">;
export type SpendRow = Pick<Transaction, "type" | "category" | "amount" | "date">;

// Round to whole fils and fold -0 into 0.
function toFils(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

/** Majors first in their set order, then the rest A–Z. */
function categoryRank(name: string): number {
  const index = MAJOR_CATEGORIES.expense.findIndex((major) => normalizeLabel(major) === normalizeLabel(name));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function byCategoryOrder(a: string, b: string): number {
  return categoryRank(a) - categoryRank(b) || a.localeCompare(b);
}

/**
 * One budget per category (any case): the one set most recently wins — the
 * latest period_start, then the latest created_at. Majors first.
 */
export function standingBudgets<T extends Pick<Budget, "category" | "period_start" | "created_at">>(
  budgets: readonly T[],
): T[] {
  const latest = new Map<string, T>();
  for (const budget of budgets) {
    const key = normalizeLabel(budget.category);
    const current = latest.get(key);
    const newer =
      !current ||
      budget.period_start > current.period_start ||
      (budget.period_start === current.period_start && budget.created_at > current.created_at);
    if (newer) latest.set(key, budget);
  }
  return [...latest.values()].sort((a, b) => byCategoryOrder(a.category, b.category));
}

/** First and last day of the month, quarter or year that contains `isoDate`. */
export function periodBounds(period: Budget["period"], isoDate: string): { start: string; end: string } {
  const [year, month] = isoDate.split("-").map(Number);
  if (period === "yearly") return { start: `${year}-01-01`, end: `${year}-12-31` };
  if (period === "quarterly") {
    const first = Math.floor((month - 1) / 3) * 3 + 1;
    const start = monthBounds(`${year}-${String(first).padStart(2, "0")}-01`).start;
    const end = monthBounds(`${year}-${String(first + 2).padStart(2, "0")}-01`).end;
    return { start, end };
  }
  return monthBounds(isoDate);
}

/** Expenses in a category (any case) dated inside the range. */
export function spentInRange(transactions: readonly SpendRow[], category: string, start: string, end: string): number {
  const key = normalizeLabel(category);
  let total = 0;
  for (const t of transactions) {
    if (t.type === "expense" && t.date >= start && t.date <= end && normalizeLabel(t.category) === key) total += t.amount;
  }
  return toFils(total);
}

export interface BudgetLine {
  id: string;
  category: string;
  amount: number;
  period: Budget["period"];
  spent: number;
  /** amount − spent; negative when over. */
  left: number;
  /** Whole percent used (see budgetPercent). */
  percent: number;
  level: BudgetLevel;
}

/** Each standing budget against its spending in the period containing `isoDate`. */
export function budgetLines(budgets: readonly BudgetRow[], transactions: readonly SpendRow[], isoDate: string): BudgetLine[] {
  return standingBudgets(budgets).map((budget) => {
    const { start, end } = periodBounds(budget.period, isoDate);
    const spent = spentInRange(transactions, budget.category, start, end);
    return {
      id: budget.id,
      category: budget.category,
      amount: budget.amount,
      period: budget.period,
      spent,
      left: toFils(budget.amount - spent),
      percent: budgetPercent(spent, budget.amount),
      level: budgetLevel(spent, budget.amount),
    };
  });
}

export interface BudgetSummary {
  /** Sum of the monthly budgets. */
  budgeted: number;
  /** Spent against them this month. */
  spent: number;
  /** budgeted − spent; negative when over. */
  left: number;
  onTrack: number;
  close: number;
  over: number;
  /** Days left in the month including today, when the month on screen is the current one. */
  daysLeft: number | null;
  /** What can still be spent per day to stay inside the monthly budgets. */
  perDay: number | null;
}

export function summarizeBudgets(lines: readonly BudgetLine[], monthEnd: string, today: string, isCurrentMonth: boolean): BudgetSummary {
  const monthly = lines.filter((l) => l.period === "monthly");
  const budgeted = toFils(monthly.reduce((sum, l) => sum + l.amount, 0));
  const spent = toFils(monthly.reduce((sum, l) => sum + l.spent, 0));
  const left = toFils(budgeted - spent);
  const daysLeft = isCurrentMonth ? Number(monthEnd.slice(8, 10)) - Number(today.slice(8, 10)) + 1 : null;
  return {
    budgeted,
    spent,
    left,
    onTrack: lines.filter((l) => l.level === "ok").length,
    close: lines.filter((l) => l.level === "warn").length,
    over: lines.filter((l) => l.level === "over").length,
    daysLeft,
    perDay: daysLeft && daysLeft > 0 && budgeted > 0 ? toFils(Math.max(left, 0) / daysLeft) : null,
  };
}

/** Spending in the range on categories with no budget, largest first. */
export function unbudgetedSpend(
  transactions: readonly SpendRow[],
  budgets: readonly Pick<Budget, "category">[],
  start: string,
  end: string,
): [string, number][] {
  const budgeted = new Set(budgets.map((b) => normalizeLabel(b.category)));
  const totals = new Map<string, { name: string; amount: number }>();
  for (const t of transactions) {
    if (t.type !== "expense" || t.date < start || t.date > end) continue;
    const key = normalizeLabel(t.category);
    if (!key || budgeted.has(key)) continue;
    const entry = totals.get(key) ?? { name: t.category, amount: 0 };
    entry.amount += t.amount;
    totals.set(key, entry);
  }
  return [...totals.values()]
    .map((e): [string, number] => [e.name, toFils(e.amount)])
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a);
}

/** Months looked at for "avg / month": this one and the three before it. */
export const AVERAGE_MONTHS = 4;

function monthsBack(today: string, count: number): string {
  const [year, month] = today.split("-").map(Number);
  const index = year * 12 + (month - 1) - count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * Average monthly spend per category (keyed by normalised name) over the last
 * AVERAGE_MONTHS months, counting only months with any expense — a month that
 * was never tracked does not drag the average down.
 */
export function averageMonthlySpend(transactions: readonly SpendRow[], today: string): Record<string, number> {
  const first = monthsBack(today, AVERAGE_MONTHS - 1);
  const last = today.slice(0, 7);
  const months = new Set<string>();
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const month = t.date.slice(0, 7);
    if (month < first || month > last) continue;
    months.add(month);
    const key = normalizeLabel(t.category);
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  }
  const averages: Record<string, number> = {};
  for (const [key, total] of totals) averages[key] = toFils(total / months.size);
  return averages;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface BudgetSettingRow {
  category: string;
  /** Its standing budget, if it has one. */
  budget: BudgetRow | null;
}

/** Every expense category (and any budgeted name not in the list), majors first. */
export function budgetSettingRows(
  categories: readonly Pick<Category, "name" | "type">[],
  budgets: readonly BudgetRow[],
): BudgetSettingRow[] {
  const standing = standingBudgets(budgets);
  const rows = new Map<string, BudgetSettingRow>();
  for (const c of categories) {
    if (c.type !== "expense") continue;
    const key = normalizeLabel(c.name);
    if (!key || rows.has(key)) continue;
    rows.set(key, { category: c.name, budget: standing.find((b) => normalizeLabel(b.category) === key) ?? null });
  }
  for (const budget of standing) {
    const key = normalizeLabel(budget.category);
    if (!rows.has(key)) rows.set(key, { category: budget.category, budget });
  }
  return [...rows.values()].sort((a, b) => byCategoryOrder(a.category, b.category));
}

export interface BudgetChanges {
  create: { category: string; amount: number }[];
  update: { id: string; amount: number }[];
  /** Budgets cleared — they go to the recycle bin. */
  remove: { id: string; category: string }[];
}

export type BudgetPlan = { ok: true; changes: BudgetChanges } | { ok: false; category: string };

/**
 * What saving the settings form changes. A box left empty (or 0) means "no
 * budget"; anything that is not a number of zero or more is refused.
 */
export function planBudgetChanges(rows: readonly BudgetSettingRow[], inputs: Readonly<Record<string, string>>): BudgetPlan {
  const changes: BudgetChanges = { create: [], update: [], remove: [] };
  for (const { category, budget } of rows) {
    const raw = (inputs[category] ?? (budget ? String(budget.amount) : "")).trim();
    const amount = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(amount) || amount < 0) return { ok: false, category };
    const value = toFils(amount);
    if (budget) {
      if (value === 0) changes.remove.push({ id: budget.id, category });
      else if (value !== budget.amount) changes.update.push({ id: budget.id, amount: value });
    } else if (value > 0) {
      changes.create.push({ category, amount: value });
    }
  }
  return { ok: true, changes };
}

export function hasChanges(changes: BudgetChanges): boolean {
  return changes.create.length + changes.update.length + changes.remove.length > 0;
}
