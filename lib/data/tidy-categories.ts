import type { SupabaseClient } from "@supabase/supabase-js";
import type { Budget, Database } from "@/lib/types/database";
import { normalizeLabel, type TidyPlan } from "@/lib/finance/categories";

// Writes a reviewed tidy-up plan (lib/finance/categories.ts). There is no
// multi-statement transaction from the browser, so every step is idempotent
// instead: re-running the tidy-up after a failure finishes the job and never
// double-applies anything. The order matters — labels move before the old
// category rows go, so no transaction is ever left pointing at nothing.

export interface BudgetTarget {
  category: string;
  /** AED per month; 0 means "no budget" (an existing one is left alone). */
  amount: number;
}

export interface TidyResult {
  createdCategories: number;
  relabelled: number;
  budgetsSet: number;
  removedCategories: number;
}

export class TidyUpError extends Error {
  constructor(
    readonly step: "categories" | "transactions" | "budgets" | "cleanup",
    message: string,
  ) {
    super(message);
    this.name = "TidyUpError";
  }
}

export async function applyTidyUp(
  supabase: SupabaseClient<Database>,
  {
    userId,
    plan,
    budgets,
    existingBudgets,
    periodStart,
    periodEnd,
    now = new Date(),
  }: {
    userId: string;
    plan: TidyPlan;
    budgets: readonly BudgetTarget[];
    /** Live budgets for the current period, as loaded on the page. */
    existingBudgets: readonly Pick<Budget, "id" | "category" | "amount">[];
    periodStart: string;
    periodEnd: string;
    now?: Date;
  },
): Promise<TidyResult> {
  // 1. The major categories, skipping any that already exist.
  if (plan.createCategories.length) {
    const { error } = await supabase.from("categories").upsert(
      plan.createCategories.map((c) => ({ user_id: userId, name: c.name, type: c.kind })),
      { onConflict: "user_id,name,type", ignoreDuplicates: true },
    );
    if (error) throw new TidyUpError("categories", error.message);
  }

  // 2. Re-label transactions. Rows with no description first keep their old
  //    category name as the description, so "Lunch" is not lost in "Food & Dining".
  for (const { kind, from, to } of plan.relabel) {
    const keepName = await supabase
      .from("transactions")
      .update({ category: to, description: from })
      .eq("user_id", userId)
      .eq("type", kind)
      .eq("category", from)
      .is("description", null);
    if (keepName.error) throw new TidyUpError("transactions", keepName.error.message);

    const rest = await supabase
      .from("transactions")
      .update({ category: to })
      .eq("user_id", userId)
      .eq("type", kind)
      .eq("category", from);
    if (rest.error) throw new TidyUpError("transactions", rest.error.message);
  }

  // 3. Budgets: set each major budget, then retire the budgets of categories
  //    that were folded in (their amounts were offered as the starting value).
  let budgetsSet = 0;
  for (const target of budgets) {
    if (!(target.amount > 0)) continue;
    const current = existingBudgets.find((b) => normalizeLabel(b.category) === normalizeLabel(target.category));
    const { error } = current
      ? await supabase.from("budgets").update({ amount: target.amount }).eq("id", current.id).eq("user_id", userId)
      : await supabase.from("budgets").insert({
          user_id: userId,
          category: target.category,
          amount: target.amount,
          period: "monthly",
          period_start: periodStart,
          period_end: periodEnd,
        });
    if (error) throw new TidyUpError("budgets", error.message);
    budgetsSet += 1;
  }
  const folded = new Set(plan.relabel.filter((r) => r.kind === "expense").map((r) => r.from));
  const retire = existingBudgets.filter((b) => folded.has(b.category)).map((b) => b.id);
  if (retire.length) {
    const { error } = await supabase
      .from("budgets")
      .update({ deleted_at: now.toISOString() })
      .in("id", retire)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) throw new TidyUpError("budgets", error.message);
  }

  // 4. Finally, the old category rows.
  if (plan.deleteCategoryIds.length) {
    const { error } = await supabase
      .from("categories")
      .delete()
      .in("id", plan.deleteCategoryIds)
      .eq("user_id", userId);
    if (error) throw new TidyUpError("cleanup", error.message);
  }

  return {
    createdCategories: plan.createCategories.length,
    relabelled: plan.transactionCount,
    budgetsSet,
    removedCategories: plan.deleteCategoryIds.length,
  };
}
