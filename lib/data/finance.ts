import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Budget,
  Category,
  Database,
  Debt,
  PaymentMethod,
  Transaction,
} from "@/lib/types/database";

// Shared by the Finance server page (initial data) and the client view and
// hooks (refetch after a change), so both always run the same queries.

export type FinanceData = {
  transactions: Transaction[];
  budgets: Budget[];
  debts: Debt[];
};

export const TRANSACTION_PAGE_SIZE = 500;

/**
 * Every live transaction, current and future budgets, and all debts.
 *
 * Metrics and the Activity view need the complete history, so transactions are
 * paged through PostgREST rather than capped — accounts with more than one page
 * would otherwise be silently under-reported.
 */
export async function loadFinanceData(
  supabase: SupabaseClient<Database>,
  today: string,
): Promise<FinanceData> {
  const transactions: Transaction[] = [];
  for (let from = 0; ; from += TRANSACTION_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .range(from, from + TRANSACTION_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    transactions.push(...(data ?? []));
    if (!data || data.length < TRANSACTION_PAGE_SIZE) break;
  }

  const [budgets, debts] = await Promise.all([
    supabase
      .from("budgets")
      .select("*")
      .is("deleted_at", null)
      .gte("period_end", today),
    supabase
      .from("debts")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (budgets.error) throw new Error(budgets.error.message);
  if (debts.error) throw new Error(debts.error.message);

  return {
    transactions,
    budgets: budgets.data ?? [],
    debts: debts.data ?? [],
  };
}

export async function loadPaymentMethods(
  supabase: SupabaseClient<Database>,
): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadCategories(
  supabase: SupabaseClient<Database>,
): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
