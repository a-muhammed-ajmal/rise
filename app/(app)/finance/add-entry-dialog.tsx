"use client";

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, HandCoins, type LucideIcon } from "lucide-react";
import type { Category, Debt, PaymentMethod } from "@/lib/types/database";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionFields } from "./transaction-form";
import { TransferFields } from "./transfer-form";
import { DebtEntryFields } from "./debt-entry-fields";

/** The four things the Finance Add button can record, in tab order. */
export type EntryKind = "expense" | "income" | "transfer" | "debt";

export const ENTRY_KINDS: readonly {
  value: EntryKind;
  label: string;
  title: string;
  hint: string;
  Icon: LucideIcon;
  /** Static classes so Tailwind keeps them: the active tab's colour. */
  activeClass: string;
}[] = [
  {
    value: "expense",
    label: "Expense",
    title: "Record expense",
    hint: "Money you spent.",
    Icon: ArrowUpRight,
    activeClass: "data-active:text-[var(--color-danger)]",
  },
  {
    value: "income",
    label: "Income",
    title: "Record income",
    hint: "Money you received.",
    Icon: ArrowDownLeft,
    activeClass: "data-active:text-[var(--color-success)]",
  },
  {
    value: "transfer",
    label: "Transfer",
    title: "Transfer money",
    hint: "Move money between your wallets.",
    Icon: ArrowLeftRight,
    activeClass: "data-active:text-brand-text",
  },
  {
    value: "debt",
    label: "Debt",
    title: "Debt or repayment",
    hint: "Money lent, borrowed or paid back.",
    Icon: HandCoins,
    activeClass: "data-active:text-[var(--color-warning)]",
  },
];

export function isEntryKind(value: unknown): value is EntryKind {
  return ENTRY_KINDS.some((kind) => kind.value === value);
}

/**
 * The Finance Add button's dialog: Expense | Income | Transfer | Debt.
 * Each tab is the same form used elsewhere, so saving behaves identically.
 */
export function AddEntryDialog({
  open,
  onOpenChange,
  kind,
  onKindChange,
  paymentMethods,
  findOrCreateByName,
  categories,
  createCategory,
  openDebts,
  onTransactionSaved,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: EntryKind;
  onKindChange: (kind: EntryKind) => void;
  paymentMethods: PaymentMethod[];
  findOrCreateByName: (name: string) => Promise<string | null>;
  categories: Category[];
  createCategory: (name: string, type: "income" | "expense") => Promise<Category | null>;
  /** Outstanding debts, already sorted by due date. */
  openDebts: readonly Debt[];
  /** After an expense or income is saved (the caller shows the toast). */
  onTransactionSaved: () => void;
  /** After a transfer or debt entry is saved (those forms toast themselves). */
  onSaved: () => void;
}) {
  const current = ENTRY_KINDS.find((k) => k.value === kind) ?? ENTRY_KINDS[0];
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto md:max-w-md">
        <DialogHeader className="gap-1 pr-8">
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription className="text-xs">{current.hint}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={kind}
          onValueChange={(value) => {
            if (isEntryKind(value)) onKindChange(value);
          }}
          className="gap-4"
        >
          <TabsList aria-label="Entry type" className="grid h-auto w-full grid-cols-4 border border-border">
            {ENTRY_KINDS.map(({ value, label, Icon, activeClass }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={`min-h-14 flex-col gap-0.5 px-0.5 text-xs ${activeClass}`}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="expense">
            <TransactionFields
              type="expense"
              initial={null}
              open={open}
              onCancel={close}
              onSaved={onTransactionSaved}
              paymentMethods={paymentMethods}
              findOrCreateByName={findOrCreateByName}
              categories={categories}
              createCategory={createCategory}
            />
          </TabsContent>
          <TabsContent value="income">
            <TransactionFields
              type="income"
              initial={null}
              open={open}
              onCancel={close}
              onSaved={onTransactionSaved}
              paymentMethods={paymentMethods}
              findOrCreateByName={findOrCreateByName}
              categories={categories}
              createCategory={createCategory}
            />
          </TabsContent>
          <TabsContent value="transfer">
            <TransferFields paymentMethods={paymentMethods} onCancel={close} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="debt">
            <DebtEntryFields
              openDebts={openDebts}
              paymentMethods={paymentMethods}
              onCancel={close}
              onSaved={onSaved}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
