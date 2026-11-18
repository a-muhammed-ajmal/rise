"use client";

import { House, Wallet } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

/** The two halves of Finance: the Home summary and the Money workspace. */
export type FinanceSection = "home" | "money";

/** The Money workspace views, in tab order. */
export type MoneyView = "activity" | "wallets" | "budgets" | "debts";

export const MONEY_VIEWS: readonly { value: MoneyView; label: string }[] = [
  { value: "activity", label: "Activity" },
  { value: "wallets", label: "Wallets" },
  { value: "budgets", label: "Budgets" },
  { value: "debts", label: "Debts" },
];

export function isFinanceSection(value: unknown): value is FinanceSection {
  return value === "home" || value === "money";
}

export function isMoneyView(value: unknown): value is MoneyView {
  return MONEY_VIEWS.some((view) => view.value === value);
}

/** Home | Money switch. Render inside a <Tabs> whose value is a FinanceSection. */
export function FinanceSectionList() {
  return (
    <TabsList aria-label="Finance sections" className="w-full md:w-80">
      <TabsTrigger value="home">
        <House aria-hidden="true" />
        Home
      </TabsTrigger>
      <TabsTrigger value="money">
        <Wallet aria-hidden="true" />
        Money
      </TabsTrigger>
    </TabsList>
  );
}

/** Activity | Wallets | Budgets | Debts. Render inside a <Tabs> whose value is a MoneyView. */
export function MoneyViewList() {
  return (
    <TabsList aria-label="Money views" className="w-full">
      {MONEY_VIEWS.map((view) => (
        <TabsTrigger key={view.value} value={view.value} className="px-1 text-sm">
          {view.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
