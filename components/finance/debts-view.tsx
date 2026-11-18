"use client";

import { useState } from "react";
import { CheckCircle2, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import type { Debt } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { daysUntil, isDueSoon, isOverdue } from "@/lib/finance/debts";
import { formatAED, formatAEDWrappable, formatDate, toDubaiISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

function soonLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function DueLine({ debt, today }: { debt: Debt; today: string }) {
  if (!debt.due_date) return null;
  const overdue = isOverdue(debt, today);
  const soon = isDueSoon(debt, today);
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-label text-muted-foreground">
      Due {formatDate(debt.due_date)}
      {(overdue || soon) && (
        <span className={cn("finance-pill", overdue ? "finance-pill--over" : "finance-pill--warn")}>
          {overdue ? "Overdue" : soonLabel(daysUntil(debt.due_date, today))}
        </span>
      )}
    </p>
  );
}

function Total({ label, amount, count, tone }: { label: string; amount: number; count: number; tone: "in" | "out" }) {
  const colour = tone === "in" ? "text-[var(--color-success)]" : "text-[var(--color-danger)]";
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-border p-4 shadow-card",
        tone === "in" ? "bg-[var(--color-success-tint)]" : "bg-[var(--color-danger-tint)]",
      )}
    >
      <p className={cn("text-label font-medium", colour)}>{label}</p>
      <p className={cn("mt-1 text-base font-semibold tabular-nums break-words", colour)}>{formatAEDWrappable(amount)}</p>
      <p className="mt-0.5 text-label text-muted-foreground">
        {count} open
      </p>
    </div>
  );
}

/** Money owed both ways: totals, the open list by due date, and paid history. */
export function DebtsView({
  openDebts,
  settledDebts,
  owedToYou,
  youOwe,
  owedToYouCount,
  youOweCount,
  today,
  onAdd,
  onMarkPaid,
  onEdit,
  onDelete,
}: {
  /** Open debts, already sorted by due date. */
  openDebts: readonly Debt[];
  settledDebts: readonly Debt[];
  owedToYou: number;
  youOwe: number;
  owedToYouCount: number;
  youOweCount: number;
  /** Today's Dubai date, "yyyy-MM-dd". */
  today: string;
  onAdd: () => void;
  onMarkPaid: (id: string) => void;
  onEdit: (debt: Debt) => void;
  onDelete: (id: string) => void;
}) {
  const [showSettled, setShowSettled] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Total label="Owed to me" amount={owedToYou} count={owedToYouCount} tone="in" />
        <Total label="I owe" amount={youOwe} count={youOweCount} tone="out" />
      </div>

      <Button className="w-full gap-1.5" onClick={onAdd}>
        <Plus aria-hidden="true" /> Add a debt
      </Button>

      {openDebts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-medium">Nothing owed either way</p>
          <p className="mt-1 text-sm text-muted-foreground">Add money you lent or borrowed to keep track of it.</p>
        </div>
      ) : (
        <ul aria-label="Open debts" className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-card">
          {openDebts.map((debt) => {
            const mine = debt.type === "i_owe";
            return (
              <li key={debt.id} className="flex items-center gap-3 py-3 pl-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">{debt.creditor}</p>
                  {debt.description && <p className="text-label text-muted-foreground break-words">{debt.description}</p>}
                  <DueLine debt={debt} today={today} />
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums whitespace-nowrap",
                      mine ? "text-[var(--color-danger)]" : "text-[var(--color-success)]",
                    )}
                  >
                    {formatAED(debt.amount)}
                  </p>
                  <p className="text-label text-muted-foreground">{mine ? "You owe" : "Owes you"}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${debt.creditor}`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:bg-accent"
                  >
                    <MoreVertical className="size-4" aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onMarkPaid(debt.id)}>
                      <CheckCircle2 className="mr-2 size-4" aria-hidden="true" /> Mark as paid
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(debt)}>
                      <Pencil className="mr-2 size-4" aria-hidden="true" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(debt.id)}>
                      <Trash2 className="mr-2 size-4" aria-hidden="true" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      {settledDebts.length > 0 && (
        <div className="space-y-2">
          <Button variant="ghost" className="w-full" aria-expanded={showSettled} onClick={() => setShowSettled((v) => !v)}>
            {showSettled ? "Hide settled" : `Show settled (${settledDebts.length})`}
          </Button>
          {showSettled && (
            <ul aria-label="Settled debts" className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {settledDebts.map((debt) => (
                <li key={debt.id} className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="break-words text-muted-foreground">{debt.creditor}</p>
                    {debt.paid_at && (
                      <p className="text-label text-muted-foreground">Paid {formatDate(toDubaiISODate(new Date(debt.paid_at)))}</p>
                    )}
                  </div>
                  <p className="shrink-0 tabular-nums text-muted-foreground line-through decoration-1">{formatAED(debt.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
