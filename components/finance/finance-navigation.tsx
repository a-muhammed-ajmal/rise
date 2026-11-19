"use client";

import { AlertCircle, HandCoins, PieChart, ReceiptText, Wallet, type LucideIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** The Finance views under the net worth card, in tab order. */
export type MoneyView = "activity" | "wallets" | "budgets" | "debts" | "alerts";

/** Each view has its own hue (see .finance-tab in globals.css). Static class
 *  strings so Tailwind and the stylesheet keep them. */
export const MONEY_VIEWS: readonly { value: MoneyView; label: string; Icon: LucideIcon; tone: string }[] = [
  { value: "activity", label: "Activity", Icon: ReceiptText, tone: "finance-tab--activity" },
  { value: "wallets", label: "Wallet", Icon: Wallet, tone: "finance-tab--wallets" },
  { value: "budgets", label: "Budget", Icon: PieChart, tone: "finance-tab--budgets" },
  { value: "debts", label: "Debt", Icon: HandCoins, tone: "finance-tab--debts" },
  { value: "alerts", label: "Alerts", Icon: AlertCircle, tone: "finance-tab--alerts" },
];

/** A view that needs a look: red for overdue / over budget, amber for soon. */
export type ViewAlert = "danger" | "warning";

export function isMoneyView(value: unknown): value is MoneyView {
  return MONEY_VIEWS.some((view) => view.value === value);
}

/**
 * Activity | Wallet | Budget | Debt. Render inside a <Tabs> whose value is a
 * MoneyView. A dot marks a view with something that needs attention.
 */
export function MoneyViewList({
  alerts = {},
}: {
  alerts?: Partial<Record<MoneyView, ViewAlert>>;
}) {
  return (
    <TabsList
      aria-label="Finance views"
      className="grid h-auto w-full grid-cols-5 gap-1 border border-border bg-card p-1 shadow-card"
    >
      {MONEY_VIEWS.map(({ value, label, Icon, tone }) => {
        const alert = alerts[value];
        return (
          <TabsTrigger
            key={value}
            value={value}
            className={cn(
              "finance-tab min-h-13 flex-col gap-0.5 px-0.5 pb-1.5 text-xs transition-colors md:min-h-11 md:flex-row md:gap-1.5 md:text-sm",
              tone,
            )}
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
