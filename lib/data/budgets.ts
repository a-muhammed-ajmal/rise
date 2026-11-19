import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { BudgetChanges } from "@/lib/finance/budgets";

// Writes the Budget settings form (lib/finance/budgets.ts planBudgetChanges).
// New budgets are monthly; period_start / period_end record the month they were
// set in and never expire them. Cleared budgets are soft-deleted, so they can
// be restored from the recycle bin. Each step is safe to repeat.

export class BudgetSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetSaveError";
  }
}

export async function saveBudgetChanges(
  supabase: SupabaseClient<Database>,
  {
    userId,
    changes,
    periodStart,
    periodEnd,
    now = new Date(),
  }: {
    userId: string;
    changes: BudgetChanges;
    periodStart: string;
    periodEnd: string;
    now?: Date;
  },
): Promise<void> {
  if (changes.create.length) {
    const { error } = await supabase.from("budgets").insert(
      changes.create.map((c) => ({
        user_id: userId,
        category: c.category,
        amount: c.amount,
        period: "monthly" as const,
        period_start: periodStart,
        period_end: periodEnd,
      })),
    );
    if (error) throw new BudgetSaveError(error.message);
  }

  for (const { id, amount } of changes.update) {
    const { error } = await supabase
      .from("budgets")
      .update({ amount })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) throw new BudgetSaveError(error.message);
  }

  if (changes.remove.length) {
    const { error } = await supabase
      .from("budgets")
      .update({ deleted_at: now.toISOString() })
      .in(
        "id",
        changes.remove.map((r) => r.id),
      )
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) throw new BudgetSaveError(error.message);
  }
}
