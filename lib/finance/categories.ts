// Major finance categories, and the one-time "Tidy up" that folds many small,
// ad-hoc categories (Breakfast, Lunch, Grocery, Sim Data…) into them.
//
// Pure so the suggestions, the plan and the budget arithmetic are unit-tested.
// lib/data/tidy-categories.ts writes the plan; the dialog in
// components/finance/tidy-categories-dialog.tsx lets the user review it first.

import type { Budget, Category, Transaction } from "@/lib/types/database";

export type CategoryKind = Category["type"];

/** The major categories, in the order the pickers show them. */
export const MAJOR_CATEGORIES: Readonly<Record<CategoryKind, readonly string[]>> = {
  expense: [
    "Food & Dining",
    "Groceries",
    "Rent & Housing",
    "Transport",
    "Bills & Subscriptions",
    "Personal Care",
    "Family Support",
    "Business",
    "Fees & Charges",
    "Shopping & Other",
  ],
  income: ["Salary", "Business Income", "Other Income"],
};

const KINDS: readonly CategoryKind[] = ["expense", "income"];

/** A mapping target meaning "leave this category as it is". */
export const KEEP = "__keep__";

// Small categories that clearly belong to a major one, by normalised name.
// Anything not listed (a person's name, a private code) defaults to KEEP so the
// user decides — the tidy-up never guesses what it cannot know.
const SUGGESTIONS: Readonly<Record<CategoryKind, Readonly<Record<string, string>>>> = {
  expense: {
    food: "Food & Dining",
    "food & dining": "Food & Dining",
    breakfast: "Food & Dining",
    lunch: "Food & Dining",
    dinner: "Food & Dining",
    "night food": "Food & Dining",
    snacks: "Food & Dining",
    coffee: "Food & Dining",
    tea: "Food & Dining",
    restaurant: "Food & Dining",
    "eating out": "Food & Dining",
    "water bottle": "Food & Dining",
    water: "Food & Dining",
    grocery: "Groceries",
    groceries: "Groceries",
    supermarket: "Groceries",
    rent: "Rent & Housing",
    "room rent": "Rent & Housing",
    housing: "Rent & Housing",
    "rent & housing": "Rent & Housing",
    transport: "Transport",
    transportation: "Transport",
    taxi: "Transport",
    uber: "Transport",
    careem: "Transport",
    metro: "Transport",
    bus: "Transport",
    fuel: "Transport",
    petrol: "Transport",
    parking: "Transport",
    salik: "Transport",
    telecommunications: "Bills & Subscriptions",
    telecom: "Bills & Subscriptions",
    "sim data": "Bills & Subscriptions",
    sim: "Bills & Subscriptions",
    data: "Bills & Subscriptions",
    "mobile recharge": "Bills & Subscriptions",
    recharge: "Bills & Subscriptions",
    internet: "Bills & Subscriptions",
    subscription: "Bills & Subscriptions",
    subscriptions: "Bills & Subscriptions",
    bills: "Bills & Subscriptions",
    utilities: "Bills & Subscriptions",
    electricity: "Bills & Subscriptions",
    "personal care": "Personal Care",
    haircut: "Personal Care",
    "hair cut": "Personal Care",
    salon: "Personal Care",
    health: "Personal Care",
    medicine: "Personal Care",
    pharmacy: "Personal Care",
    "family support": "Family Support",
    family: "Family Support",
    "d-business": "Business",
    business: "Business",
    "transaction fee": "Fees & Charges",
    "transfer fee": "Fees & Charges",
    "bank charges": "Fees & Charges",
    "bank changes": "Fees & Charges",
    "bank charge": "Fees & Charges",
    fee: "Fees & Charges",
    fees: "Fees & Charges",
    charges: "Fees & Charges",
    vat: "Fees & Charges",
    fine: "Fees & Charges",
    "fees & charges": "Fees & Charges",
    shopping: "Shopping & Other",
    "mobile holder": "Shopping & Other",
    vape: "Shopping & Other",
    clothes: "Shopping & Other",
    unwanted: "Shopping & Other",
    error: "Shopping & Other",
    dispute: "Shopping & Other",
    other: "Shopping & Other",
    others: "Shopping & Other",
    misc: "Shopping & Other",
    miscellaneous: "Shopping & Other",
  },
  income: {
    salary: "Salary",
    wage: "Salary",
    wages: "Salary",
    "d-business": "Business Income",
    business: "Business Income",
    sales: "Business Income",
    "business income": "Business Income",
    other: "Other Income",
    "other income": "Other Income",
    gift: "Other Income",
    refund: "Other Income",
    cashback: "Other Income",
    interest: "Other Income",
  },
};

/** Lower case, trimmed, single spaces — "  Personal  care " → "personal care". */
export function normalizeLabel(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The major category with this name (any case), or null. */
export function majorNamed(kind: CategoryKind, name: string): string | null {
  const wanted = normalizeLabel(name);
  return MAJOR_CATEGORIES[kind].find((major) => normalizeLabel(major) === wanted) ?? null;
}

/** Where a small category should go, or KEEP when that is not clear. */
export function suggestMajor(kind: CategoryKind, name: string): string {
  return majorNamed(kind, name) ?? SUGGESTIONS[kind][normalizeLabel(name)] ?? KEEP;
}

/**
 * Categories in a sensible order: expense before income, and within each the
 * majors first in their set order, then anything else alphabetically.
 */
export function sortCategories<T extends Pick<Category, "name" | "type">>(categories: readonly T[]): T[] {
  const rank = (c: T) => {
    const index = MAJOR_CATEGORIES[c.type].findIndex((major) => normalizeLabel(major) === normalizeLabel(c.name));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...categories].sort(
    (a, b) =>
      (a.type === b.type ? 0 : a.type === "expense" ? -1 : 1) ||
      rank(a) - rank(b) ||
      a.name.localeCompare(b.name),
  );
}

// ─── What there is to tidy ────────────────────────────────────────────────────

export interface LabelUsage {
  kind: CategoryKind;
  /** The name exactly as stored. */
  name: string;
  /** Live transactions carrying it. */
  count: number;
  /** Their total, in AED. */
  total: number;
  /** The categories row with this name, when there is one. */
  categoryId: string | null;
}

export type TidyTransaction = Pick<Transaction, "type" | "category" | "amount" | "date">;

function labelKey(kind: CategoryKind, name: string): string {
  return `${kind}:${name}`;
}

/**
 * Every income / expense category that is not already a major one: the user's
 * category rows plus any label found only on transactions. Expense first, then
 * most used.
 */
export function collectLabels(
  categories: readonly Pick<Category, "id" | "name" | "type">[],
  transactions: readonly TidyTransaction[],
): LabelUsage[] {
  const found = new Map<string, LabelUsage>();
  const add = (kind: CategoryKind, name: string): LabelUsage | null => {
    if (!name.trim() || majorNamed(kind, name)) return null;
    const key = labelKey(kind, name);
    let usage = found.get(key);
    if (!usage) {
      usage = { kind, name, count: 0, total: 0, categoryId: null };
      found.set(key, usage);
    }
    return usage;
  };

  for (const category of categories) {
    const usage = add(category.type, category.name);
    if (usage) usage.categoryId = category.id;
  }
  for (const txn of transactions) {
    if (txn.type !== "income" && txn.type !== "expense") continue;
    const usage = add(txn.type, txn.category);
    if (usage) {
      usage.count += 1;
      usage.total = Math.round((usage.total + txn.amount) * 100) / 100;
    }
  }

  return [...found.values()].sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === "expense" ? -1 : 1) ||
      b.count - a.count ||
      a.name.localeCompare(b.name),
  );
}

/** label key → major category name, or KEEP. */
export type TidyMapping = Readonly<Record<string, string>>;

export function mappingKey(label: Pick<LabelUsage, "kind" | "name">): string {
  return labelKey(label.kind, label.name);
}

export function defaultMapping(labels: readonly LabelUsage[]): Record<string, string> {
  return Object.fromEntries(labels.map((label) => [mappingKey(label), suggestMajor(label.kind, label.name)]));
}

/** True when the suggestions alone would change something. */
export function needsTidyUp(
  categories: readonly Pick<Category, "id" | "name" | "type">[],
  transactions: readonly TidyTransaction[],
): boolean {
  if (categories.length > 0 && !hasAllMajors(categories)) return true;
  return collectLabels(categories, transactions).some((label) => suggestMajor(label.kind, label.name) !== KEEP);
}

function hasAllMajors(categories: readonly Pick<Category, "name" | "type">[]): boolean {
  return KINDS.every((kind) =>
    MAJOR_CATEGORIES[kind].every((major) =>
      categories.some((c) => c.type === kind && normalizeLabel(c.name) === normalizeLabel(major)),
    ),
  );
}

// ─── The plan ─────────────────────────────────────────────────────────────────

export interface Relabel {
  kind: CategoryKind;
  from: string;
  to: string;
}

export interface TidyPlan {
  /** Major categories missing from the user's list. */
  createCategories: { kind: CategoryKind; name: string }[];
  /** Transaction labels to rewrite. */
  relabel: Relabel[];
  /** Category rows folded into a major one. */
  deleteCategoryIds: string[];
  /** Live transactions that get a new label. */
  transactionCount: number;
}

export function planTidyUp(
  labels: readonly LabelUsage[],
  mapping: TidyMapping,
  categories: readonly Pick<Category, "name" | "type">[],
): TidyPlan {
  const createCategories: TidyPlan["createCategories"] = [];
  for (const kind of KINDS) {
    for (const major of MAJOR_CATEGORIES[kind]) {
      const exists = categories.some((c) => c.type === kind && normalizeLabel(c.name) === normalizeLabel(major));
      if (!exists) createCategories.push({ kind, name: major });
    }
  }

  const relabel: Relabel[] = [];
  const deleteCategoryIds: string[] = [];
  let transactionCount = 0;
  for (const label of labels) {
    const target = mapping[mappingKey(label)] ?? KEEP;
    if (target === KEEP || target === label.name || !MAJOR_CATEGORIES[label.kind].includes(target)) continue;
    relabel.push({ kind: label.kind, from: label.name, to: target });
    if (label.categoryId) deleteCategoryIds.push(label.categoryId);
    transactionCount += label.count;
  }

  return { createCategories, relabel, deleteCategoryIds, transactionCount };
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

/** Months looked at for a suggestion: this one and the three before it. */
export const BUDGET_LOOKBACK_MONTHS = 4;

/** Budgets are suggested in steps of 50 so they read as round numbers. */
export function roundBudget(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.ceil(amount / 50 - 1e-9) * 50;
}

function monthOf(date: string): string {
  return date.slice(0, 7);
}

function monthsBack(today: string, count: number): string {
  const [year, month] = today.split("-").map(Number);
  const index = year * 12 + (month - 1) - count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** The major category an expense counts toward under this mapping, if any. */
export function resolveExpense(category: string, mapping: TidyMapping): string | null {
  const major = majorNamed("expense", category);
  if (major) return major;
  const target = mapping[labelKey("expense", category)];
  return target && target !== KEEP && MAJOR_CATEGORIES.expense.includes(target) ? target : null;
}

export interface BudgetSuggestion {
  category: string;
  /** Average spend per tracked month, in AED (two decimals). */
  average: number;
  /** average rounded up to the next 50. */
  suggested: number;
}

/**
 * Average monthly spend per major expense category over this month and the
 * three before it. Only months with at least one expense count, so a month
 * that was never tracked does not drag the average down.
 */
export function suggestBudgets(
  transactions: readonly TidyTransaction[],
  mapping: TidyMapping,
  today: string,
): { suggestions: BudgetSuggestion[]; months: string[] } {
  const first = monthsBack(today, BUDGET_LOOKBACK_MONTHS - 1);
  const last = monthOf(today);
  const tracked = new Set<string>();
  const totals = new Map<string, number>();

  for (const txn of transactions) {
    if (txn.type !== "expense") continue;
    const month = monthOf(txn.date);
    if (month < first || month > last) continue;
    tracked.add(month);
    const major = resolveExpense(txn.category, mapping);
    if (major) totals.set(major, (totals.get(major) ?? 0) + txn.amount);
  }

  const months = [...tracked].sort();
  const suggestions = MAJOR_CATEGORIES.expense.map((category) => {
    const average = months.length ? Math.round(((totals.get(category) ?? 0) / months.length) * 100) / 100 : 0;
    return { category, average, suggested: roundBudget(average) };
  });
  return { suggestions, months };
}

/**
 * The starting amount for each major budget: its current budget if it has
 * one, else the budgets being folded into it added up, else the suggestion.
 */
export function initialBudgetAmounts(
  suggestions: readonly BudgetSuggestion[],
  budgets: readonly Pick<Budget, "category" | "amount">[],
  mapping: TidyMapping,
): Record<string, number> {
  const amounts: Record<string, number> = {};
  for (const { category, suggested } of suggestions) {
    const own = budgets.filter((b) => normalizeLabel(b.category) === normalizeLabel(category));
    if (own.length) {
      amounts[category] = own.reduce((sum, b) => sum + b.amount, 0);
      continue;
    }
    const folded = budgets.filter((b) => !majorNamed("expense", b.category) && resolveExpense(b.category, mapping) === category);
    amounts[category] = folded.length ? folded.reduce((sum, b) => sum + b.amount, 0) : suggested;
  }
  return amounts;
}
