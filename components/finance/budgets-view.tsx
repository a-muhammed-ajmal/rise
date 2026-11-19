"use client";

import { MoreVertical, Pencil, Plus, Sparkles, Tags, Trash2 } from "lucide-react";
import type { Budget } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { budgetLevel, budgetPercent, type BudgetLevel } from "@/lib/finance/month";
import { formatAED } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MonthSwitcher } from "./finance-home";

const PILL: Record<BudgetLevel, string> = {
  ok: "finance-pill--ok",
  warn: "finance-pill--warn",
  over: "finance-pill--over",
};
const BAR: Record<BudgetLevel, string> = {
  ok: "",
  warn: "finance-bar--warn",
  over: "finance-bar--over",
};

export function BudgetBar({ spent, amount }: { spent: number; amount: number }) {
  const level = budgetLevel(spent, amount);
  const pct = budgetPercent(spent, amount);
  return (
    <div
      className={cn("finance-bar", BAR[level])}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(pct, 100)}
      aria-valuetext={`${pct}% used`}
    >
      <span style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

/** Budgets for the selected month: one bar per budget, plus spending with no budget. */
export function BudgetsView({
  monthLabel,
  budgets,
  spent,
  onAdd,
  onEdit,
  onDelete,
  onCategories,
  onPrevMonth,
  onNextMonth,
  onTidyUp,
  tidyUpCount = 0,
}: {
  monthLabel: string;
  budgets: readonly Budget[];
  /** Expense total per category for the selected month. */
  spent: Readonly<Record<string, number>>;
  onAdd: () => void;
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
  onCategories: () => void;
  /** With both month handlers, the month name gets arrows to change it. */
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  /** When given, a card offers the category tidy-up (see TidyCategoriesDialog). */
  onTidyUp?: () => void;
  /** Small categories the tidy-up would fold into major ones. */
  tidyUpCount?: number;
}) {
  const budgeted = new Set(budgets.map((b) => b.category));
  const unbudgeted = Object.entries(spent)
    .filter(([category, amount]) => !budgeted.has(category) && amount > 0)
    .sort(([, a], [, b]) => b - a);
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + (spent[b.category] ?? 0), 0);

  return (
    <div className="space-y-4">
      {onTidyUp && (
        <section
          aria-labelledby="tidy-up-title"
          className="finance-card finance-tidy flex flex-wrap items-center justify-between gap-3 p-3 md:p-4"
        >
          <div className="min-w-0 flex-1">
            <h3 id="tidy-up-title" className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 shrink-0 text-[var(--mod-goals)]" aria-hidden="true" />
              Organise your categories
            </h3>
            <p className="mt-0.5 text-label text-muted-foreground">
              {tidyUpCount > 0
                ? `Fold ${tidyUpCount} small ${tidyUpCount === 1 ? "category" : "categories"} into 10 major ones and set monthly budgets from your spending.`
                : "Add the 10 major categories and set monthly budgets from your spending."}
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={onTidyUp}>
            <Sparkles aria-hidden="true" /> Tidy up
          </Button>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {onPrevMonth && onNextMonth ? (
          <MonthSwitcher monthLabel={monthLabel} onPrevMonth={onPrevMonth} onNextMonth={onNextMonth} />
        ) : (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{monthLabel}</span> · in AED
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onCategories}>
            <Tags aria-hidden="true" /> Categories
          </Button>
          <Button size="sm" className="gap-1.5" onClick={onAdd}>
            <Plus aria-hidden="true" /> Add budget
          </Button>
        </div>
      </div>

      {budgets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
          <p className="text-sm font-medium">No budgets yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Set a monthly limit for a category to see how much is left.</p>
        </div>
      ) : (
        <>
          <section aria-label="Budget total" className="finance-card p-3 md:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm text-muted-foreground">Spent of all budgets</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatAED(totalSpent)} <span className="font-normal text-muted-foreground">of {formatAED(totalBudget)}</span>
              </p>
            </div>
            <div className="mt-2">
              <BudgetBar spent={totalSpent} amount={totalBudget} />
            </div>
          </section>

          <ul className="finance-card divide-y divide-border overflow-hidden">
            {budgets.map((budget) => {
              const used = spent[budget.category] ?? 0;
              const level = budgetLevel(used, budget.amount);
              const gap = Math.abs(budget.amount - used);
              return (
                <li key={budget.id} className="flex items-start gap-2 py-2.5 pl-3 md:pl-4">
                  <div className="min-w-0 flex-1 space-y-2 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="min-w-0 text-sm font-medium break-words">
                        {budget.category}
                        {budget.period !== "monthly" && (
                          <span className="ml-1.5 text-label font-normal text-muted-foreground capitalize">· {budget.period}</span>
                        )}
                      </p>
                      <span className={cn("finance-pill", PILL[level])}>{budgetPercent(used, budget.amount)}%</span>
                    </div>
                    <BudgetBar spent={used} amount={budget.amount} />
                    <p className="text-label text-muted-foreground tabular-nums">
                      {formatAED(used)} of {formatAED(budget.amount)} ·{" "}
                      {level === "over" ? (
                        <span className="font-medium text-[var(--color-danger)]">over by {formatAED(gap)}</span>
                      ) : (
                        `${formatAED(gap)} left`
                      )}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${budget.category} budget`}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:bg-accent"
                    >
                      <MoreVertical className="size-4" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(budget)}>
                        <Pencil className="mr-2 size-4" aria-hidden="true" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(budget.id)}>
                        <Trash2 className="mr-2 size-4" aria-hidden="true" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {unbudgeted.length > 0 && (
        <section aria-labelledby="unbudgeted-title" className="finance-card overflow-hidden">
          <h3 id="unbudgeted-title" className="px-3 pt-3 pb-1 text-sm font-semibold md:px-4">
            Spent without a budget
          </h3>
          <ul className="divide-y divide-border">
            {unbudgeted.map(([category, amount]) => (
              <li key={category} className="flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm md:px-4">
                <span className="min-w-0 break-words">{category}</span>
                <span className="shrink-0 font-medium tabular-nums">{formatAED(amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
