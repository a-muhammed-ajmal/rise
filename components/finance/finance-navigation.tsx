"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FinanceTab = "overview" | "transactions" | "wallets" | "transfers" | "budgets" | "debts" | "categories";

const PRIMARY: { value: FinanceTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "transactions", label: "Transactions" },
  { value: "wallets", label: "Wallets" },
];
const MORE: { value: FinanceTab; label: string }[] = [
  { value: "transfers", label: "Transfers" },
  { value: "budgets", label: "Budgets" },
  { value: "debts", label: "Debts" },
  { value: "categories", label: "Categories" },
];

export function FinanceNavigation({ value, onChange }: { value: FinanceTab; onChange: (value: FinanceTab) => void }) {
  const selectedMore = MORE.find((item) => item.value === value);

  return (
    <nav aria-label="Finance views" className="flex min-w-0 gap-1 border-b border-border pb-2">
      {PRIMARY.map((item) => (
        <Button
          key={item.value}
          variant="ghost"
          className={cn("min-w-0 flex-1 px-1 text-xs md:flex-none md:px-4 md:text-sm", value === item.value && "bg-brand-tint text-brand-text")}
          aria-current={value === item.value ? "page" : undefined}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </Button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`${selectedMore?.label ?? "More"} finance views`} render={<Button variant="ghost" className={cn("min-w-0 flex-1 gap-1 px-1 text-xs md:flex-none md:px-4 md:text-sm", selectedMore && "bg-brand-tint text-brand-text")} />}>
          <span className="truncate">{selectedMore?.label ?? "More"}</span>
          <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {MORE.map((item) => (
            <DropdownMenuItem key={item.value} className="min-h-11" aria-current={value === item.value ? "page" : undefined} onClick={() => onChange(item.value)}>
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
