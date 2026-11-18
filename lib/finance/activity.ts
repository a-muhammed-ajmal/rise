// The Activity list: every live money row (income, expense, transfer and
// balance adjustment) newest first, grouped by Dubai calendar day.

import { format, parseISO } from "date-fns";
import type { Transaction } from "@/lib/types/database";
import { formatAED } from "@/lib/format";
import { daysUntil } from "./debts";

export type ActivityRow = Pick<Transaction, "id" | "type" | "amount" | "date" | "created_at">;

/** in = money arrives, out = money leaves, neutral = moved between your own wallets. */
export type Flow = "in" | "out" | "neutral";

/** "Today", "Yesterday", otherwise "Mon, 16/11/2026". */
export function dayLabel(date: string, today: string): string {
  const days = daysUntil(date, today);
  if (days === 0) return "Today";
  if (days === -1) return "Yesterday";
  return format(parseISO(date), "EEE, dd/MM/yyyy");
}

/** Newest day first; inside a day the most recently entered row first. */
export function groupByDay<T extends Pick<ActivityRow, "date" | "created_at">>(
  rows: readonly T[],
): [string, T[]][] {
  const sorted = [...rows].sort(
    (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
  );
  const groups = new Map<string, T[]>();
  for (const row of sorted) {
    const day = groups.get(row.date);
    if (day) day.push(row);
    else groups.set(row.date, [row]);
  }
  return [...groups.entries()];
}

export function flowOf(row: Pick<ActivityRow, "type" | "amount">): Flow {
  if (row.type === "income") return "in";
  if (row.type === "expense") return "out";
  return "neutral";
}

/**
 * Amount with its direction: "+AED 10.00" in, "−AED 10.00" out, a transfer
 * unsigned, and an adjustment with the sign of the correction it made.
 */
export function signedAmount(row: Pick<ActivityRow, "type" | "amount">): string {
  if (row.type === "income") return `+${formatAED(row.amount)}`;
  if (row.type === "expense") return `−${formatAED(row.amount)}`;
  if (row.type === "adjustment" && row.amount !== 0) {
    return `${row.amount > 0 ? "+" : "−"}${formatAED(Math.abs(row.amount))}`;
  }
  return formatAED(Math.abs(row.amount));
}
