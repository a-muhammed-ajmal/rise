// Pure helpers behind the Home page. Dates are Dubai calendar days
// ("yyyy-MM-dd" — pass todayISO() as `today`), so string order is date order.

import { daysUntil } from "@/lib/finance/debts";
import { formatDate, toDubaiISODate } from "@/lib/format";
import type { Task } from "@/lib/types/database";

/** Due before today and still open (the today list never holds done tasks). */
export function isOverdueTask(
  task: Pick<Task, "due_date">,
  today: string,
): boolean {
  return !!task.due_date && task.due_date < today;
}

/**
 * The today list ("due today or overdue") split into its two groups, keeping
 * the list's own order inside each.
 */
export function splitTodayTasks<T extends Pick<Task, "due_date">>(
  tasks: readonly T[],
  today: string,
): { overdue: T[]; dueToday: T[] } {
  const overdue: T[] = [];
  const dueToday: T[] = [];
  for (const task of tasks) {
    (isOverdueTask(task, today) ? overdue : dueToday).push(task);
  }
  return { overdue, dueToday };
}

/** "Never contacted", "Contacted today", "Last contact 1 day ago", "Last contact 32 days ago". */
export function lastContactLabel(
  lastContactedAt: string | null,
  today: string,
): string {
  if (!lastContactedAt) return "Never contacted";
  const contacted = new Date(lastContactedAt);
  if (Number.isNaN(contacted.getTime())) return "Never contacted";
  const daysAgo = daysUntil(today, toDubaiISODate(contacted));
  if (daysAgo <= 0) return "Contacted today";
  return daysAgo === 1
    ? "Last contact 1 day ago"
    : `Last contact ${daysAgo} days ago`;
}

/** "Target 31/12/2026 · 37 days left", "… · due today", "… · 3 days past"; null without a date. */
export function goalTargetLabel(
  targetDate: string | null,
  today: string,
): string | null {
  if (!targetDate) return null;
  const days = daysUntil(targetDate, today);
  const when =
    days === 0
      ? "due today"
      : days === 1
        ? "1 day left"
        : days > 1
          ? `${days} days left`
          : days === -1
            ? "1 day past"
            : `${-days} days past`;
  return `Target ${formatDate(targetDate)} · ${when}`;
}
