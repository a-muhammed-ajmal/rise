"use client";

import { MoreVertical, Pencil, SlidersHorizontal, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { budgetLevel, budgetPercent, type BudgetLevel } from "@/lib/finance/month";
import type { BudgetLine, BudgetSummary } from "@/lib/finance/budgets";
import { formatAED, formatAEDWrappable } from "@/lib/format";
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
const PER: Record<BudgetLine["period"], string> = {
  monthly: "",
  quarterly: "per quarter",
  yearly: "per year",
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

function Legend({ summary }: { summary: BudgetSummary }) {
  const parts = [
    { count: summary.onTrack, label: "on track", dot: "finance-dot--ok" },
    { count: summary.close, label: "close to the limit", dot: "finance-dot--warning" },
    { count: summary.over, label: "over", dot: "finance-dot--danger" },
  ].filter((p) => p.count > 0);
  if (!parts.length) return null;
  return (
    <p className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-label text-muted-foreground">
      {parts.map((p) => (
        <span key={p.label} className="inline-flex items-center gap-1.5">
          <span className={cn("finance-dot", p.dot)} aria-hidden="true" />
          {p.count} {p.label}
        </span>
      ))}
    </p>
  );
}

/**
 * Budgets are settings: a standing limit per category that repeats every
 * month until edited. This shows each one against the month on screen.
 */
export function BudgetsView({
  monthLabel,
  lines,
  summary,
  unbudgeted,
  onPrevMonth,
  onNextMonth,
  onSettings,
  onDelete,
  onCategories,
}: {
  monthLabel: string;
  /** Standing budgets against the month on screen (lib/finance/budgets.ts). */
  lines: readonly BudgetLine[];
  summary: BudgetSummary;
  /** Spending this month on categories with no budget, largest first. */
  unbudgeted: readonly [string, number][];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** Opens Budget settings, optionally focused on one category. */
  onSettings: (category?: string) => void;
  onDelete: (id: string) => void;
  onCategories: () => void;
}) {
  const overall = budgetLevel(summary.spent, summary.budgeted);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MonthSwitcher monthLabel={monthLabel} onPrevMonth={onPrevMonth} onNextMonth={onNextMonth} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onCategories}>
            <Tags aria-hidden="true" /> Categories
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => onSettings()}>
            <SlidersHorizontal aria-hidden="true" /> Edit budgets
          </Button>
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
          <p className="text-sm font-medium">No budgets yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Set a monthly limit per category once — it repeats every month until you change it.
          </p>
          <Button className="mt-4 gap-1.5" onClick={() => onSettings()}>
            <SlidersHorizontal aria-hidden="true" /> Set budgets
          </Button>
        </div>
      ) : (
        <>
          {summary.budgeted > 0 && (
            <section aria-labelledby="budget-summary-title" className="finance-card finance-budget p-3 md:p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="budget-summary-title" className="text-label font-medium text-muted-foreground">
                  Monthly budget · {monthLabel}
                </h3>
                <span className={cn("finance-pill", PILL[overall])}>
                  {overall === "over" ? "Over budget" : `${budgetPercent(summary.spent, summary.budgeted)}% used`}
                </span>
              </div>
              <p className="mt-1 text-lg font-semibold tabular-nums break-words">{formatAEDWrappable(summary.budgeted)}</p>
              <div className="mt-2">
                <BudgetBar spent={summary.spent} amount={summary.budgeted} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="finance-tile min-w-0 bg-card px-3 py-2">
                  <dt className="text-label text-muted-foreground">Spent</dt>
                  <dd className="text-sm font-semibold tabular-nums break-words">{formatAEDWrappable(summary.spent)}</dd>
                </div>
                <div className={cn("finance-tile min-w-0 px-3 py-2", summary.left < 0 ? "finance-tile--out" : "finance-tile--in")}>
                  <dt className={cn("text-xs", summary.left < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]")}>
                    {summary.left < 0 ? "Over by" : "Left"}
                  </dt>
                  <dd
                    className={cn(
                      "text-sm font-semibold tabular-nums break-words",
                      summary.left < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]",
                    )}
                  >
                    {formatAEDWrappable(Math.abs(summary.left))}
                  </dd>
                </div>
              </dl>
              <Legend summary={summary} />
              {summary.perDay !== null && summary.daysLeft !== null && (
                <p className="mt-1.5 text-label text-muted-foreground">
                  {summary.left > 0
                    ? `About ${formatAED(summary.perDay)} a day for the ${summary.daysLeft} ${summary.daysLeft === 1 ? "day" : "days"} left this month.`
                    : `Nothing left for the ${summary.daysLeft} ${summary.daysLeft === 1 ? "day" : "days"} left this month.`}
                </p>
              )}
            </section>
          )}

          <ul aria-label="Budgets" className="finance-card divide-y divide-border overflow-hidden">
            {lines.map((line) => {
              const over = line.level === "over";
              return (
                <li key={line.id} className="flex items-start gap-2 py-2.5 pl-3 md:pl-4">
                  <div className="min-w-0 flex-1 space-y-1.5 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="min-w-0 text-sm font-medium break-words">
                        {line.category}
                        {PER[line.period] && (
                          <span className="ml-1.5 text-label font-normal text-muted-foreground">· {PER[line.period]}</span>
                        )}
                      </p>
                      <span className={cn("finance-pill", PILL[line.level])}>{over ? "Over" : `${line.percent}%`}</span>
                    </div>
                    <BudgetBar spent={line.spent} amount={line.amount} />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-label tabular-nums">
                      <span className="text-muted-foreground">
                        {formatAED(line.spent)} of {formatAED(line.amount)}
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          over ? "text-[var(--color-danger)]" : line.level === "warn" ? "text-[var(--color-warning)]" : "text-[var(--color-success)]",
                        )}
                      >
                        {over ? `${formatAED(-line.left)} over` : `${formatAED(line.left)} left`}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${line.category} budget`}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:bg-accent"
                    >
                      <MoreVertical className="size-4" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSettings(line.category)}>
                        <Pencil className="mr-2 size-4" aria-hidden="true" /> Edit amount
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(line.id)}>
                        <Trash2 className="mr-2 size-4" aria-hidden="true" /> Remove budget
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
          <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1 md:px-4">
            <h3 id="unbudgeted-title" className="text-sm font-semibold">
              Spent without a budget
            </h3>
            <Button variant="ghost" size="sm" onClick={() => onSettings()}>
              Set budgets
            </Button>
          </div>
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
