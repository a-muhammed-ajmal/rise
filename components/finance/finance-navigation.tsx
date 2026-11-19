"use client";

import { HandCoins, PieChart, ReceiptText, Wallet, type LucideIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** The Finance views under the net worth card, in tab order. */
export type MoneyView = "activity" | "wallets" | "budgets" | "debts";

export const MONEY_VIEWS: readonly { value: MoneyView; label: string; Icon: LucideIcon }[] = [
  { value: "activity", label: "Activity", Icon: ReceiptText },
  { value: "wallets", label: "Wallets", Icon: Wallet },
  { value: "budgets", label: "Budgets", Icon: PieChart },
  { value: "debts", label: "Debts", Icon: HandCoins },
];

/** A view that needs a look: red for overdue / over budget, amber for soon. */
export type ViewAlert = "danger" | "warning";

export function isMoneyView(value: unknown): value is MoneyView {
  return MONEY_VIEWS.some((view) => view.value === value);
}

/**
 * Activity | Wallets | Budgets | Debts. Render inside a <Tabs> whose value is
 * a MoneyView. A dot marks a view with something that needs attention.
 */
export function MoneyViewList({
  alerts = {},
}: {
  alerts?: Partial<Record<MoneyView, ViewAlert>>;
}) {
  return (
    <TabsList aria-label="Finance views" className="grid h-auto w-full grid-cols-4 border border-border shadow-card">
      {MONEY_VIEWS.map(({ value, label, Icon }) => {
        const alert = alerts[value];
        return (
          <TabsTrigger
            key={value}
            value={value}
            className="min-h-13 flex-col gap-0.5 px-0.5 text-xs md:min-h-11 md:flex-row md:gap-1.5 md:text-sm"
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
            {alert && (
              <>
                <span
                  className={cn(
                    "finance-dot absolute top-1.5 right-1.5",
                    alert === "danger" ? "finance-dot--danger" : "finance-dot--warning",
                  )}
                  aria-hidden="true"
                />
                <span className="sr-only">(needs attention)</span>
              </>
            )}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
