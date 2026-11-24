import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { needsAttention, type AttentionItem } from "@/lib/finance/attention";
import {
  budgetLines,
  periodBounds,
  standingBudgets,
  type BudgetRow,
  type SpendRow,
} from "@/lib/finance/budgets";
import {
  summarizeNetWorth,
  type NetWorthSummary,
} from "@/lib/finance/net-worth";
import { TRANSACTION_PAGE_SIZE } from "./finance";

// The money half of the Home page: the Net worth tile and the Needs attention
// card. It runs the same arithmetic as the Finance page (summarizeNetWorth,
// budgetLines, needsAttention) so the two never disagree — but loads only what
// those figures need instead of the whole transaction history.

export type HomeMoney = {
  netWorth: NetWorthSummary;
  attention: AttentionItem[];
};

/**
 * Expenses inside every standing budget's current period. Budgets are weekly
 * to yearly, so the range is the union of their periods; it is paged like the
 * Finance loader so a busy year is never silently cut off at one page.
 */
async function loadBudgetSpending(
  supabase: SupabaseClient<Database>,
  budgets: readonly BudgetRow[],
  today: string,
): Promise<SpendRow[]> {
  const periods = budgets.map((b) => periodBounds(b.period, today));
  const start = periods.reduce(
    (min, p) => (p.start < min ? p.start : min),
    periods[0].start,
  );
  const end = periods.reduce(
    (max, p) => (p.end > max ? p.end : max),
    periods[0].end,
  );

  const rows: SpendRow[] = [];
  for (let from = 0; ; from += TRANSACTION_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("type, category, amount, date")
      .is("deleted_at", null)
      .eq("type", "expense")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .range(from, from + TRANSACTION_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < TRANSACTION_PAGE_SIZE) break;
  }
  return rows;
}

export async function loadHomeMoney(
  supabase: SupabaseClient<Database>,
  today: string,
): Promise<HomeMoney> {
  const [wallets, debts, budgets] = await Promise.all([
    supabase.from("payment_methods").select("balance").eq("is_active", true),
    supabase
      .from("debts")
      .select("id, creditor, type, amount, due_date, paid_at, deleted_at")
      .is("deleted_at", null)
      .is("paid_at", null),
    supabase
      .from("budgets")
      .select("id, category, amount, period, period_start, created_at")
      .is("deleted_at", null),
  ]);
  if (wallets.error) throw new Error(wallets.error.message);
  if (debts.error) throw new Error(debts.error.message);
  if (budgets.error) throw new Error(budgets.error.message);

  const openDebts = debts.data ?? [];
  const standing = standingBudgets(budgets.data ?? []);
  const spending =
    standing.length > 0
      ? await loadBudgetSpending(supabase, standing, today)
      : [];
  const spent = Object.fromEntries(
    budgetLines(standing, spending, today).map((line) => [
      line.category,
      line.spent,
    ]),
  );

  const walletBalance = (wallets.data ?? []).reduce(
    (sum, w) => sum + Number(w.balance),
    0,
  );

  return {
    netWorth: summarizeNetWorth(walletBalance, openDebts),
    attention: needsAttention({
      debts: openDebts,
      budgets: standing,
      spent,
      today,
    }),
  };
}
