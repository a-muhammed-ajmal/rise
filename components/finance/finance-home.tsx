"use client";

import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NetWorthCard } from "./net-worth-card";
import type { NetWorthSummary } from "@/lib/finance/net-worth";
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
    <section aria-labelledby="month-card-title" className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center">
          <Button size="icon" variant="ghost" className="-ml-3" onClick={onPrevMonth} aria-label="Previous month">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <h2 id="month-card-title" className="text-h2 font-semibold" aria-live="polite">
            {monthLabel}
          </h2>
          <Button size="icon" variant="ghost" onClick={onNextMonth} aria-label="Next month">
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <span className={cn("finance-pill", pill.tone)}>{pill.label}</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <div className="min-w-0 rounded-md bg-[var(--color-success-tint)] p-3">
          <p className="text-label text-[var(--color-success)]">Money in</p>
          <p className="mt-1 text-base font-semibold tabular-nums break-words text-[var(--color-success)]">
            {summary.moneyIn === 0 ? formatAED(0) : `+${formatAEDWrappable(summary.moneyIn)}`}
          </p>
        </div>
        <div className="min-w-0 rounded-md bg-[var(--color-danger-tint)] p-3">
          <p className="text-label text-[var(--color-danger)]">Money out</p>
          <p className="mt-1 text-base font-semibold tabular-nums break-words text-[var(--color-danger)]">
            {summary.moneyOut === 0 ? formatAED(0) : `−${formatAEDWrappable(summary.moneyOut)}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground">Net · {saved ? "Saved" : "Deficit"}</p>
        <p
          className={cn(
            "text-base font-semibold tabular-nums break-words",
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
    <section aria-labelledby="attention-title" className="min-w-0 rounded-lg border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h2 id="attention-title" className="text-h2 font-semibold">
          Needs attention
        </h2>
        {items.length > 0 && <span className="finance-pill finance-pill--muted">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 px-4 pb-4 text-sm text-muted-foreground">
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
                className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
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

/** Finance home: net worth hero, this month, and what needs attention. */
export function FinanceHome({
  netWorth,
  monthLabel,
  month,
  onPrevMonth,
  onNextMonth,
  attention,
  onOpen,
}: {
  netWorth: NetWorthSummary;
  monthLabel: string;
  month: MonthSummary;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  attention: readonly AttentionItem[];
  onOpen: (target: AttentionTarget) => void;
}) {
  return (
    <div className="grid min-w-0 items-start gap-4 md:grid-cols-2">
      <div className="slide-up stagger-1 min-w-0 md:col-span-2">
        <NetWorthCard summary={netWorth} onViewDebts={() => onOpen("debts")} />
      </div>
      <div className="slide-up stagger-2 min-w-0">
        <MonthCard monthLabel={monthLabel} summary={month} onPrevMonth={onPrevMonth} onNextMonth={onNextMonth} />
      </div>
      <div className="slide-up stagger-3 min-w-0">
        <AttentionCard items={attention} onOpen={onOpen} />
      </div>
    </div>
  );
}
