"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  hasChanges,
  planBudgetChanges,
  type BudgetChanges,
  type BudgetSettingRow,
} from "@/lib/finance/budgets";
import { normalizeLabel } from "@/lib/finance/categories";
import { formatAED } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PER: Record<NonNullable<BudgetSettingRow["budget"]>["period"], string> = {
  monthly: "",
  quarterly: " · quarterly limit",
  yearly: " · yearly limit",
};

export type BudgetHint = { thisMonth: number; average: number };

/**
 * Budget settings: one box per expense category. A value is a standing limit
 * that repeats every month; an empty box means no budget. Removing a budget
 * asks first, and it can be restored from the recycle bin.
 */
export function BudgetSettingsDialog({
  open,
  onOpenChange,
  rows,
  hints,
  monthName,
  focusCategory,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: readonly BudgetSettingRow[];
  /** Spending per category (normalised name): this month and the monthly average. */
  hints: Readonly<Record<string, BudgetHint>>;
  /** "November" — labels this month's spending. */
  monthName: string;
  /** Category whose box gets focus when the dialog opens. */
  focusCategory?: string;
  /** Writes the changes; resolves when done, rejects on failure. */
  onSave: (changes: BudgetChanges) => Promise<void>;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.category, r.budget ? String(r.budget.amount) : ""])),
  );
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const plan = planBudgetChanges(rows, inputs);
  const invalid = plan.ok ? null : plan.category;
  const total = rows.reduce((sum, r) => {
    const value = Number((inputs[r.category] ?? "").trim() || 0);
    return r.budget?.period && r.budget.period !== "monthly" ? sum : sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);

  async function save(changes: BudgetChanges) {
    setSaving(true);
    try {
      await onSave(changes);
      onOpenChange(false);
    } catch {
      // The caller has explained what happened; keep the values for a retry.
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (!plan.ok) return;
    if (!hasChanges(plan.changes)) {
      onOpenChange(false);
      return;
    }
    if (plan.changes.remove.length) setConfirming(true);
    else void save(plan.changes);
  }

  const removing = plan.ok ? plan.changes.remove : [];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!saving) onOpenChange(next);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto md:max-w-lg">
          <DialogHeader className="gap-1 pr-8">
            <DialogTitle>Budget settings</DialogTitle>
            <DialogDescription className="text-xs">
              Monthly limits that repeat every month until you change them. Leave a box empty for no budget.
            </DialogDescription>
          </DialogHeader>

          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Add an expense category first (Budget → Categories), then set its limit here.
            </p>
          ) : (
            <ul className="divide-y divide-border" aria-label="Budget per category">
              {rows.map(({ category, budget }) => {
                const id = `budget-setting-${normalizeLabel(category).replace(/[^a-z0-9]+/g, "-")}`;
                const hint = hints[normalizeLabel(category)];
                const bad = invalid === category;
                return (
                  <li key={category} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={id} className="block text-sm font-medium break-words">
                        {category}
                      </label>
                      <p className={cn("text-xs", bad ? "text-[var(--color-danger)]" : "text-muted-foreground")}>
                        {bad
                          ? "Enter an amount of zero or more"
                          : `${monthName}: ${formatAED(hint?.thisMonth ?? 0)}${
                              hint && hint.average > 0 ? ` · avg ${formatAED(hint.average)}/mo` : ""
                            }${budget ? PER[budget.period] : ""}`}
                      </p>
                    </div>
                    <Input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="No budget"
                      aria-invalid={bad || undefined}
                      className="w-32 shrink-0"
                      autoFocus={category === focusCategory}
                      value={inputs[category] ?? ""}
                      onChange={(e) => setInputs((current) => ({ ...current, [category]: e.target.value }))}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {rows.length > 0 && (
            <p className="flex items-baseline justify-between gap-3 border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Total per month</span>
              <span className="font-semibold tabular-nums">{formatAED(total)}</span>
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || !!invalid || rows.length === 0} onClick={handleSave}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {saving ? "Saving…" : "Save budgets"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={removing.length === 1 ? "Remove this budget?" : `Remove ${removing.length} budgets?`}
        description={`${removing.map((r) => r.category).join(", ")} will have no budget. ${
          removing.length === 1 ? "It moves" : "They move"
        } to the recycle bin and can be restored.`}
        confirmLabel="Remove and save"
        onConfirm={() => {
          if (plan.ok) void save(plan.changes);
        }}
      />
    </>
  );
}
