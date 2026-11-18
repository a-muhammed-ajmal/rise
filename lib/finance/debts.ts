// Due-date rules for the debt ledger. Dates are Dubai calendar days as
// "yyyy-MM-dd" strings (pass todayISO() as `today`), so string order is
// date order and no time zone maths is needed.

import type { Debt } from "@/lib/types/database";

export type DueDebt = Pick<Debt, "due_date" | "paid_at" | "deleted_at">;

/** Days a debt stays "due soon" before its due date. */
export const DUE_SOON_DAYS = 7;

/** Not paid and not in the recycle bin. */
export function isOpenDebt(debt: Pick<Debt, "paid_at" | "deleted_at">): boolean {
  return !debt.paid_at && !debt.deleted_at;
}

/** Whole calendar days from `today` to `date`; negative when it is past. */
export function daysUntil(date: string, today: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(date) - toUtc(today)) / 86_400_000);
}

export function isOverdue(debt: DueDebt, today: string): boolean {
  return isOpenDebt(debt) && !!debt.due_date && debt.due_date < today;
}

export function isDueSoon(debt: DueDebt, today: string, withinDays = DUE_SOON_DAYS): boolean {
  if (!isOpenDebt(debt) || !debt.due_date || debt.due_date < today) return false;
  return daysUntil(debt.due_date, today) <= withinDays;
}

/** Plain-words due label: "due today", "due tomorrow", "due in 3 days", "2 days overdue". */
export function dueLabel(dueDate: string, today: string): string {
  const days = daysUntil(dueDate, today);
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days > 1) return `due in ${days} days`;
  return days === -1 ? "1 day overdue" : `${-days} days overdue`;
}

/** Earliest due date first; debts without a due date keep their order at the end. */
export function sortByDueDate<T extends Pick<Debt, "due_date">>(debts: readonly T[]): T[] {
  return debts
    .map((debt, index) => ({ debt, index }))
    .sort((a, b) => {
      if (a.debt.due_date && b.debt.due_date) {
        return a.debt.due_date.localeCompare(b.debt.due_date) || a.index - b.index;
      }
      if (a.debt.due_date) return -1;
      if (b.debt.due_date) return 1;
      return a.index - b.index;
    })
    .map(({ debt }) => debt);
}
