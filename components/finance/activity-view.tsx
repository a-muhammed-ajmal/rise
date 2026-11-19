"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  HandCoins,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import type { Transaction } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dayLabel, flowOf, groupByDay, signedAmount } from "@/lib/finance/activity";
import { DEBT_CATEGORY } from "@/lib/finance/entries";
import { cn } from "@/lib/utils";

/** Rows shown before "Show more". */
export const ACTIVITY_PAGE = 60;

const FLOW_TEXT = {
  in: "text-[var(--color-success)]",
  out: "text-[var(--color-danger)]",
  neutral: "text-muted-foreground",
} as const;

function RowIcon({ txn }: { txn: Transaction }) {
  if (txn.type === "transfer" || txn.type === "adjustment") {
    const Icon =
      txn.type === "transfer" ? ArrowLeftRight : txn.category === DEBT_CATEGORY ? HandCoins : SlidersHorizontal;
    return (
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
        <Icon className="size-4" />
      </span>
    );
  }
  const income = txn.type === "income";
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
        income ? "bg-[var(--color-success-tint)] text-[var(--color-success)]" : "bg-[var(--color-danger-tint)] text-[var(--color-danger)]",
      )}
      aria-hidden="true"
    >
      {income ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
    </span>
  );
}

function describeRow(txn: Transaction, walletName: (id: string | null) => string | null): { title: string; subtitle: string } {
  if (txn.type === "transfer") {
    const route = `${walletName(txn.from_payment_method_id) ?? "Unknown"} → ${walletName(txn.to_payment_method_id) ?? "Unknown"}`;
    const note = txn.description && txn.description !== route ? txn.description : null;
    return { title: note ?? "Transfer", subtitle: note ? `Transfer · ${route}` : route };
  }
  if (txn.type === "adjustment" && txn.category === DEBT_CATEGORY) {
    // Money lent, borrowed or repaid — see lib/finance/entries.ts.
    const wallet = walletName(txn.payment_method_id) ?? txn.payment_method;
    return { title: txn.description ?? "Debt", subtitle: ["Debt", wallet].filter(Boolean).join(" · ") };
  }
  if (txn.type === "adjustment") {
    const wallet = walletName(txn.payment_method_id);
    return {
      title: "Balance adjusted",
      subtitle: [wallet, txn.description].filter(Boolean).join(" · ") || "Manual correction",
    };
  }
  const wallet = walletName(txn.payment_method_id) ?? txn.payment_method;
  return {
    title: txn.description ?? txn.category,
    subtitle: [txn.category, wallet].filter(Boolean).join(" · "),
  };
}

/** Every money row, newest first, grouped by day — like a bank statement. */
export function ActivityView({
  transactions,
  walletNameById,
  today,
  onAddExpense,
  onAddIncome,
  onTransfer,
  onEdit,
  onDelete,
}: {
  transactions: readonly Transaction[];
  walletNameById: Readonly<Record<string, string>>;
  /** Today's Dubai date, "yyyy-MM-dd". */
  today: string;
  onAddExpense: () => void;
  onAddIncome: () => void;
  onTransfer: () => void;
  onEdit: (txn: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  const [shown, setShown] = useState(ACTIVITY_PAGE);
  const walletName = (id: string | null) => (id ? walletNameById[id] ?? null : null);
  const groups = groupByDay(transactions.slice(0, shown));
  const hidden = transactions.length - shown;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className="gap-1.5 px-2" onClick={onAddExpense} aria-label="Add expense">
          <Minus aria-hidden="true" className="text-[var(--color-danger)]" />
          Expense
        </Button>
        <Button variant="outline" className="gap-1.5 px-2" onClick={onAddIncome} aria-label="Add income">
          <Plus aria-hidden="true" className="text-[var(--color-success)]" />
          Income
        </Button>
        <Button variant="outline" className="gap-1.5 px-2" onClick={onTransfer} aria-label="New transfer">
          <ArrowLeftRight aria-hidden="true" />
          Transfer
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
          <p className="text-sm font-medium">No activity yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add your first expense or income to see it here.</p>
        </div>
      ) : (
        groups.map(([date, rows]) => (
          <section key={date} aria-label={dayLabel(date, today)} className="space-y-1.5">
            <h3 className="px-1 text-label font-medium tracking-wide text-muted-foreground uppercase">{dayLabel(date, today)}</h3>
            <ul className="finance-card divide-y divide-border overflow-hidden">
              {rows.map((txn) => {
                const { title, subtitle } = describeRow(txn, walletName);
                const editable = txn.type === "income" || txn.type === "expense";
                return (
                  <li key={txn.id} className="flex min-h-14 items-center gap-2.5 py-1.5 pl-3">
                    <RowIcon txn={txn} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium break-words">{title}</p>
                      {subtitle && <p className="text-label text-muted-foreground break-words">{subtitle}</p>}
                    </div>
                    <span className={cn("shrink-0 text-sm font-semibold tabular-nums whitespace-nowrap", FLOW_TEXT[flowOf(txn)])}>
                      {signedAmount(txn)}
                    </span>
                    {!editable && <span className="size-11 shrink-0" aria-hidden="true" />}
                    {editable && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${title}`}
                          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:bg-accent"
                        >
                          <MoreVertical className="size-4" aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(txn)}>
                            <Pencil className="mr-2 size-4" aria-hidden="true" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(txn.id)}>
                            <Trash2 className="mr-2 size-4" aria-hidden="true" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {hidden > 0 && (
        <Button variant="outline" className="w-full" onClick={() => setShown((n) => n + ACTIVITY_PAGE)}>
          Show {Math.min(hidden, ACTIVITY_PAGE)} more
        </Button>
      )}
    </div>
  );
}
