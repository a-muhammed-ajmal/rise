// "Needs attention" for the Finance home: the few money items worth acting on
// today, most urgent first —
//   1. overdue debts                (danger)
//   2. budgets over their amount    (danger)
//   3. debts due within 7 days      (warning)
//   4. budgets at 75–100%           (warning)
// Pure so the ordering and wording are unit-tested.

import type { Budget, Debt } from "@/lib/types/database";
import { formatAED } from "@/lib/format";
import { budgetLevel, budgetPercent } from "./month";
import { dueLabel, isDueSoon, isOverdue, sortByDueDate } from "./debts";

export type AttentionLevel = "danger" | "warning";
export type AttentionTarget = "debts" | "budgets";

export interface AttentionItem {
  key: string;
  level: AttentionLevel;
  title: string;
  detail: string;
  target: AttentionTarget;
}

export type AttentionDebt = Pick<
  Debt,
  "id" | "creditor" | "type" | "amount" | "due_date" | "paid_at" | "deleted_at"
>;
export type AttentionBudget = Pick<Budget, "id" | "category" | "amount">;

function debtDetail(debt: AttentionDebt): string {
  return debt.type === "i_owe"
    ? `You owe ${formatAED(debt.amount)}`
    : `Owes you ${formatAED(debt.amount)}`;
}

function debtItem(debt: AttentionDebt, today: string, level: AttentionLevel): AttentionItem {
  return {
    key: `debt-${debt.id}`,
    level,
    // due_date is set: only dated debts can be overdue or due soon.
    title: `${debt.creditor} — ${dueLabel(debt.due_date ?? today, today)}`,
    detail: debtDetail(debt),
    target: "debts",
  };
}

function budgetItem(budget: AttentionBudget, spent: number): AttentionItem {
  const over = budgetLevel(spent, budget.amount) === "over";
  const gap = Math.abs(budget.amount - spent);
  return {
    key: `budget-${budget.id}`,
    level: over ? "danger" : "warning",
    title: over
      ? `${budget.category} budget is over`
      : `${budget.category} budget at ${budgetPercent(spent, budget.amount)}%`,
    detail: `${formatAED(spent)} of ${formatAED(budget.amount)} · ${
      over ? `over by ${formatAED(gap)}` : `${formatAED(gap)} left`
    }`,
    target: "budgets",
  };
}

export function needsAttention({
  debts,
  budgets,
  spent,
  today,
}: {
  debts: readonly AttentionDebt[];
  budgets: readonly AttentionBudget[];
  /** Expense total per category for the current month. */
  spent: Readonly<Record<string, number>>;
  /** Today's Dubai date, "yyyy-MM-dd". */
  today: string;
}): AttentionItem[] {
  const dated = sortByDueDate(debts);
  const overdue = dated.filter((d) => isOverdue(d, today)).map((d) => debtItem(d, today, "danger"));
  const dueSoon = dated.filter((d) => isDueSoon(d, today)).map((d) => debtItem(d, today, "warning"));

  const withSpend = budgets.map((b) => ({ budget: b, spent: spent[b.category] ?? 0 }));
  const byUse = (a: { budget: AttentionBudget; spent: number }, b: { budget: AttentionBudget; spent: number }) =>
    budgetPercent(b.spent, b.budget.amount) - budgetPercent(a.spent, a.budget.amount);
  const over = withSpend
    .filter((x) => budgetLevel(x.spent, x.budget.amount) === "over")
    .sort(byUse)
    .map((x) => budgetItem(x.budget, x.spent));
  const nearly = withSpend
    .filter((x) => budgetLevel(x.spent, x.budget.amount) === "warn")
    .sort(byUse)
    .map((x) => budgetItem(x.budget, x.spent));

  return [...overdue, ...over, ...dueSoon, ...nearly];
}
