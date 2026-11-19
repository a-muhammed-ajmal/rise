"use client";

import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MonthSummary } from "@/lib/finance/month";
import type { AttentionItem, AttentionTarget } from "@/lib/finance/attention";
import { formatAED, formatAEDWrappable } from "@/lib/format";
import { cn } from "@/lib/utils";

function savingPill(rate: number | null): { label: string; tone: string } {
  if (rate === null) return { label: "No income yet", tone: "finance-pill--muted" };
  if (rate >= 20) return { label: `Saving ${rate}%`, tone: "finance-pill--ok" };
  if (rate >= 0) return { label: `Saving ${rate}%`, tone: "finance-pill--warn" };
  return { label: `Overspent ${-rate}%`, tone: "finance-pill--over" };
}

/** Month arrows around the month name; shared by the month card and Budgets. */
export function MonthSwitcher({
  monthLabel,
  onPrevMonth,
  onNextMonth,
  headingId,
}: {
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** When set, the month name is a heading with this id. */
  headingId?: string;
}) {
  const name = headingId ? (
    <h2 id={headingId} className="text-sm font-semibold whitespace-nowrap" aria-live="polite">
      {monthLabel}
    </h2>
  ) : (
    <p className="text-sm font-semibold whitespace-nowrap" aria-live="polite">
      {monthLabel}
    </p>
  );
  return (
    <div className="flex min-w-0 items-center">
      <Button size="icon" variant="ghost" className="-ml-2.5" onClick={onPrevMonth} aria-label="Previous month">
        <ChevronLeft aria-hidden="true" />
      </Button>
      {name}
      <Button size="icon" variant="ghost" onClick={onNextMonth} aria-label="Next month">
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}

/** This month: money in, money out, net and the saving rate. */
export function MonthCard({
  monthLabel,
  summary,
  onPrevMonth,
  onNextMonth,
}: {
  monthLabel: string;
  summary: MonthSummary;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const pill = savingPill(summary.savingRate);
  const saved = summary.net >= 0;

  return (
    <section aria-labelledby="month-card-title" className="finance-card min-w-0 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <MonthSwitcher
          monthLabel={monthLabel}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          headingId="month-card-title"
        />
        <span className={cn("finance-pill", pill.tone)}>{pill.label}</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <div className="finance-tile finance-tile--in min-w-0 px-3 py-2.5">
          <p className="text-label text-[var(--color-success)]">Money in</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums break-words text-[var(--color-success)]">
            {summary.moneyIn === 0 ? formatAED(0) : `+${formatAEDWrappable(summary.moneyIn)}`}
          </p>
        </div>
        <div className="finance-tile finance-tile--out min-w-0 px-3 py-2.5">
          <p className="text-label text-[var(--color-danger)]">Money out</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums break-words text-[var(--color-danger)]">
            {summary.moneyOut === 0 ? formatAED(0) : `−${formatAEDWrappable(summary.moneyOut)}`}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-2.5">
        <p className="text-label text-muted-foreground">Net · {saved ? "Saved" : "Deficit"}</p>
        <p
          className={cn(
            "text-sm font-semibold tabular-nums break-words",
            saved ? "text-[var(--color-success)]" : "text-[var(--color-danger)]",
          )}
        >
          {summary.net === 0 ? formatAED(0) : `${saved ? "+" : "−"}${formatAEDWrappable(Math.abs(summary.net))}`}
        </p>
      </div>
    </section>
  );
}

/** The short list of money items worth acting on, most urgent first. */
export function AttentionCard({
  items,
  onOpen,
}: {
  items: readonly AttentionItem[];
  onOpen: (target: AttentionTarget) => void;
}) {
  return (
    <section aria-labelledby="attention-title" className="finance-card min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1.5 md:px-4">
        <h2 id="attention-title" className="text-sm font-semibold">
          Needs attention
        </h2>
        {items.length > 0 && <span className="finance-pill finance-pill--muted">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 px-3 pb-3 text-sm text-muted-foreground md:px-4">
          <CheckCircle2 className="size-4 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
          All clear — nothing needs you right now.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onOpen(item.target)}
                className="flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring md:px-4"
              >
                <span className={cn("finance-dot", item.level === "danger" ? "finance-dot--danger" : "finance-dot--warning")} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium break-words">{item.title}</span>
                  <span className="block text-label text-muted-foreground break-words">{item.detail}</span>
                </span>
                <span className="sr-only">{item.level === "danger" ? "Urgent." : "Soon."}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
