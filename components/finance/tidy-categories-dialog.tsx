"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowRight, Loader2 } from "lucide-react";
import type { Budget, Category } from "@/lib/types/database";
import {
  KEEP,
  MAJOR_CATEGORIES,
  collectLabels,
  defaultMapping,
  initialBudgetAmounts,
  mappingKey,
  planTidyUp,
  suggestBudgets,
  type LabelUsage,
  type TidyTransaction,
} from "@/lib/finance/categories";
import { parseAmount } from "@/lib/finance/entries";
import type { BudgetTarget } from "@/lib/data/tidy-categories";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Step = "map" | "budgets";

const KEEP_LABEL = "Keep as its own";

function LabelRow({
  label,
  target,
  onChange,
}: {
  label: LabelUsage;
  target: string;
  onChange: (target: string) => void;
}) {
  const items: Record<string, string> = {
    ...Object.fromEntries(MAJOR_CATEGORIES[label.kind].map((major) => [major, major])),
    [KEEP]: KEEP_LABEL,
  };
  return (
    <li className="grid gap-1.5 py-2.5 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center md:gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium break-words">{label.name}</p>
        <p className="text-label text-muted-foreground">
          {label.count === 0
            ? "Not used yet"
            : `${label.count} ${label.count === 1 ? "entry" : "entries"} · ${formatAED(label.total)}`}
        </p>
      </div>
      <Select items={items} value={target} onValueChange={(v) => onChange(v ?? KEEP)}>
        <SelectTrigger className="w-full" aria-label={`Major category for ${label.name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MAJOR_CATEGORIES[label.kind].map((major) => (
            <SelectItem key={major} value={major}>
              {major}
            </SelectItem>
          ))}
          <SelectItem value={KEEP}>{KEEP_LABEL}</SelectItem>
        </SelectContent>
      </Select>
    </li>
  );
}

function monthRange(months: readonly string[]): string {
  if (!months.length) return "no spending tracked yet";
  const name = (m: string) => format(parseISO(`${m}-01`), "MMM yyyy");
  return months.length === 1 ? name(months[0]) : `${name(months[0])} – ${name(months[months.length - 1])}`;
}

/**
 * One-time tidy-up: fold small categories into the major ones and set a
 * monthly budget for each. Nothing is written until the user confirms.
 */
export function TidyCategoriesDialog({
  open,
  onOpenChange,
  categories,
  transactions,
  budgets,
  today,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: readonly Category[];
  transactions: readonly TidyTransaction[];
  /** Live budgets for the current period. */
  budgets: readonly Budget[];
  /** Today's Dubai date, "yyyy-MM-dd". */
  today: string;
  /** Writes the plan; resolves when done, rejects on failure. */
  onApply: (input: {
    plan: ReturnType<typeof planTidyUp>;
    budgets: BudgetTarget[];
  }) => Promise<void>;
}) {
  const labels = useMemo(() => collectLabels(categories, transactions), [categories, transactions]);
  const [step, setStep] = useState<Step>("map");
  const [mapping, setMapping] = useState<Record<string, string>>(() => defaultMapping(labels));
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // Each step starts at its top, not wherever the previous one was scrolled to.
  useEffect(() => {
    const scroller = headerRef.current?.closest('[data-slot="dialog-content"]');
    if (scroller) scroller.scrollTop = 0;
  }, [step]);

  const { suggestions, months } = useMemo(
    () => suggestBudgets(transactions, mapping, today),
    [transactions, mapping, today],
  );
  const plan = useMemo(() => planTidyUp(labels, mapping, categories), [labels, mapping, categories]);

  const expenseLabels = labels.filter((l) => l.kind === "expense");
  const incomeLabels = labels.filter((l) => l.kind === "income");

  const budgetTargets: BudgetTarget[] = MAJOR_CATEGORIES.expense.map((category) => ({
    category,
    amount: parseAmount(amounts[category] ?? "") ?? 0,
  }));
  const budgetTotal = budgetTargets.reduce((sum, b) => sum + b.amount, 0);
  const invalidAmount = MAJOR_CATEGORIES.expense.some((category) => {
    const raw = (amounts[category] ?? "").trim();
    return raw !== "" && parseAmount(raw, { allowZero: true }) === null;
  });

  function reset() {
    setStep("map");
    setMapping(defaultMapping(labels));
    setAmounts({});
  }

  function goToBudgets() {
    // Fill each box from the current mapping; existing budgets win.
    const start = initialBudgetAmounts(suggestions, budgets, mapping);
    setAmounts(Object.fromEntries(Object.entries(start).map(([k, v]) => [k, v > 0 ? String(v) : ""])));
    setStep("budgets");
  }

  async function apply() {
    setApplying(true);
    try {
      await onApply({ plan, budgets: budgetTargets });
      onOpenChange(false);
      reset();
    } catch {
      // The caller has already explained what happened; keep the choices.
    } finally {
      setApplying(false);
    }
  }

  const budgetsCount = budgetTargets.filter((b) => b.amount > 0).length;
  const summary = [
    plan.transactionCount > 0 &&
      `re-label ${plan.transactionCount} ${plan.transactionCount === 1 ? "transaction" : "transactions"} into major categories (the old name is kept as each one's description)`,
    plan.deleteCategoryIds.length > 0 &&
      `remove ${plan.deleteCategoryIds.length} old ${plan.deleteCategoryIds.length === 1 ? "category" : "categories"}`,
    plan.createCategories.length > 0 && `add ${plan.createCategories.length} major categories`,
    budgetsCount > 0 && `set ${budgetsCount} monthly ${budgetsCount === 1 ? "budget" : "budgets"}`,
  ].filter((part): part is string => typeof part === "string");

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (applying) return;
          onOpenChange(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto md:max-w-2xl">
          <DialogHeader ref={headerRef} className="gap-1 pr-8">
            <DialogTitle>{step === "map" ? "Tidy up categories" : "Monthly budgets"}</DialogTitle>
            <DialogDescription className="text-xs">
              {step === "map"
                ? "Step 1 of 2 · Choose a major category for each one. Anything you are unsure about can keep its own name."
                : `Step 2 of 2 · Suggested from your average spending (${monthRange(months)}). Clear a box for no budget.`}
            </DialogDescription>
          </DialogHeader>

          {step === "map" ? (
            labels.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Your categories are already tidy. Continue to set budgets.
              </p>
            ) : (
              <div className="space-y-4">
                {[
                  { title: "Expense", rows: expenseLabels },
                  { title: "Income", rows: incomeLabels },
                ]
                  .filter((group) => group.rows.length > 0)
                  .map((group) => (
                    <section key={group.title} aria-label={`${group.title} categories`}>
                      <h3 className="text-label font-medium tracking-wide text-muted-foreground uppercase">
                        {group.title} · {group.rows.length}
                      </h3>
                      <ul className="divide-y divide-border">
                        {group.rows.map((label) => (
                          <LabelRow
                            key={mappingKey(label)}
                            label={label}
                            target={mapping[mappingKey(label)] ?? KEEP}
                            onChange={(target) => setMapping((m) => ({ ...m, [mappingKey(label)]: target }))}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              <ul className="divide-y divide-border" aria-label="Budgets by category">
                {suggestions.map(({ category, average }) => (
                  <li key={category} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`budget-${category}`} className="block text-sm font-medium break-words">
                        {category}
                      </label>
                      <p className="text-label text-muted-foreground">
                        {average > 0 ? `Avg ${formatAED(average)} / month` : "No spending yet"}
                      </p>
                    </div>
                    <Input
                      id={`budget-${category}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="No budget"
                      className="w-32 shrink-0"
                      value={amounts[category] ?? ""}
                      onChange={(e) => setAmounts((a) => ({ ...a, [category]: e.target.value }))}
                    />
                  </li>
                ))}
              </ul>
              <p className="flex items-baseline justify-between gap-3 border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Total per month</span>
                <span className="font-semibold tabular-nums">{formatAED(budgetTotal)}</span>
              </p>
            </div>
          )}

          <DialogFooter>
            {step === "map" ? (
              <>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" className="gap-1.5" onClick={goToBudgets}>
                  Next: budgets <ArrowRight aria-hidden="true" />
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" disabled={applying} onClick={() => setStep("map")}>
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={applying || invalidAmount || summary.length === 0}
                  onClick={() => setConfirming(true)}
                >
                  {applying ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  {applying ? "Applying…" : "Apply"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Tidy up categories?"
        description={`This will ${summary.join(", ")}.`}
        confirmLabel="Tidy up"
        destructive={false}
        onConfirm={apply}
      />
    </>
  );
}
