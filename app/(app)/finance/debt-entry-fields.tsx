"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/supabase/current-user";
import type { Debt, PaymentMethod } from "@/lib/types/database";
import { formatAED, todayISO } from "@/lib/format";
import {
  debtMovementRow,
  newDebtDelta,
  newDebtLabel,
  parseAmount,
  planRepayment,
  repaymentDelta,
  repaymentLabel,
  type DebtDirection,
} from "@/lib/finance/entries";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type DebtEntryMode = "new" | "repay";

const NO_WALLET = "none";

function owedLabel(debt: Pick<Debt, "creditor" | "type" | "amount">): string {
  return debt.type === "they_owe"
    ? `${debt.creditor} · owes you ${formatAED(debt.amount)}`
    : `${debt.creditor} · you owe ${formatAED(debt.amount)}`;
}

/** Two-option switch built from the shared Button, like Expense | Income. */
function Switch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="outline"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            value === option.value &&
              "border-brand-action bg-brand-action text-white hover:bg-brand-hover hover:text-white"
          )}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * The Debt tab of the Finance "Add" dialog: record money lent or borrowed, or
 * a repayment against an open debt. Choosing a wallet also moves its balance
 * (a signed adjustment — not income or spending); leaving it empty only
 * changes the debt, exactly like the Debts tab form.
 */
export function DebtEntryFields({
  openDebts,
  paymentMethods,
  onCancel,
  onSaved,
}: {
  /** Outstanding debts, already sorted by due date. */
  openDebts: readonly Debt[];
  paymentMethods: PaymentMethod[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const uid = useId();
  const [mode, setMode] = useState<DebtEntryMode>("new");

  // New debt
  const [direction, setDirection] = useState<DebtDirection>("they_owe");
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  // Repayment
  const [debtId, setDebtId] = useState("");

  // Shared
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState(NO_WALLET);
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const activeWallets = paymentMethods.filter((m) => m.is_active);
  const walletItems: Record<string, string> = {
    [NO_WALLET]: "None",
    ...Object.fromEntries(activeWallets.map((m) => [m.id, m.name])),
  };
  const wallet = activeWallets.find((m) => m.id === walletId) ?? null;

  const debt = openDebts.find((d) => d.id === debtId) ?? null;
  const debtItems: Record<string, string> = Object.fromEntries(
    openDebts.map((d) => [d.id, owedLabel(d)])
  );

  const parsedAmount = parseAmount(amount);
  const plan = debt && parsedAmount !== null ? planRepayment(debt.amount, parsedAmount) : null;

  // Which way the wallet moves, for the label: in when you borrow or are repaid.
  const lending = mode === "new" ? direction === "they_owe" : debt?.type === "i_owe";
  const walletLabel = lending ? "Paid from wallet" : "Received into wallet";

  function switchMode(next: DebtEntryMode) {
    setMode(next);
    setAmount("");
    setWalletId(NO_WALLET);
  }

  function chooseDebt(id: string) {
    setDebtId(id);
    const chosen = openDebts.find((d) => d.id === id);
    // Default to paying the whole balance; edit it for a part payment.
    setAmount(chosen ? String(chosen.amount) : "");
  }

  async function saveNewDebt(userId: string, value: number) {
    const supabase = createClient();
    const person = name.trim();
    const { data: created, error } = await supabase
      .from("debts")
      .insert({
        user_id: userId,
        creditor: person,
        type: direction,
        amount: value,
        description: note.trim() || null,
        due_date: dueDate || null,
      })
      .select("id")
      .single();
    if (error || !created) {
      console.error("[finance] debt save failed:", error?.message);
      toast.error("Could not save the debt. Please try again.");
      return false;
    }

    if (wallet) {
      const { error: moveError } = await supabase.from("transactions").insert(
        debtMovementRow({
          userId,
          walletId: wallet.id,
          walletName: wallet.name,
          delta: newDebtDelta(direction, value),
          description: newDebtLabel(direction, person),
          date,
        })
      );
      if (moveError) {
        // Never leave a debt whose money movement is missing: undo it.
        console.error("[finance] debt wallet movement failed:", moveError.message);
        const { error: undoError } = await supabase.from("debts").delete().eq("id", created.id);
        if (undoError) console.error("[finance] debt rollback failed:", undoError.message);
        toast.error("Could not update the wallet, so nothing was saved. Please try again.");
        return false;
      }
    }

    toast.success(direction === "they_owe" ? "Money lent recorded" : "Money borrowed recorded");
    return true;
  }

  async function saveRepayment(userId: string, chosen: Debt, value: number) {
    const result = planRepayment(chosen.amount, value);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    const supabase = createClient();
    const change = result.settles
      ? { paid_at: new Date().toISOString() }
      : { amount: result.remaining };
    const { error } = await supabase
      .from("debts")
      .update(change)
      .eq("id", chosen.id)
      .is("deleted_at", null);
    if (error) {
      console.error("[finance] repayment save failed:", error.message);
      toast.error("Could not record the repayment. Please try again.");
      return false;
    }

    if (wallet) {
      const { error: moveError } = await supabase.from("transactions").insert(
        debtMovementRow({
          userId,
          walletId: wallet.id,
          walletName: wallet.name,
          delta: repaymentDelta(chosen.type, value),
          description: repaymentLabel(chosen.type, chosen.creditor),
          date,
        })
      );
      if (moveError) {
        // Put the debt back exactly as it was.
        console.error("[finance] repayment wallet movement failed:", moveError.message);
        const { error: undoError } = await supabase
          .from("debts")
          .update(result.settles ? { paid_at: null } : { amount: chosen.amount })
          .eq("id", chosen.id);
        if (undoError) console.error("[finance] repayment rollback failed:", undoError.message);
        toast.error("Could not update the wallet, so nothing was saved. Please try again.");
        return false;
      }
    }

    toast.success(result.settles ? "Debt settled" : `Repayment recorded · ${formatAED(result.remaining)} still owed`);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedAmount === null) {
      toast.error("Enter an amount above zero");
      return;
    }
    if (mode === "new" && !name.trim()) {
      toast.error("Enter a name");
      return;
    }
    if (mode === "repay" && !debt) {
      toast.error("Choose which debt is being repaid");
      return;
    }

    setSaving(true);
    try {
      const userId = await currentUserId();
      if (!userId) {
        toast.error("Your session expired. Please sign in again.");
        return;
      }
      const saved =
        mode === "new"
          ? await saveNewDebt(userId, parsedAmount)
          : debt
          ? await saveRepayment(userId, debt, parsedAmount)
          : false;
      if (!saved) return;
      onCancel();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const walletField = (
    <div className="space-y-2">
      <Label>
        {walletLabel} <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <Select items={walletItems} value={walletId} onValueChange={(v) => setWalletId(v ?? NO_WALLET)}>
        <SelectTrigger className="w-full" aria-label={walletLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_WALLET}>None</SelectItem>
          {activeWallets.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-label text-muted-foreground">
        {wallet
          ? `${wallet.name} ${lending ? "goes down" : "goes up"} by this amount. It is not counted as income or spending.`
          : "Leave as None to record the debt only, without moving a wallet."}
      </p>
    </div>
  );

  const dateField = wallet && (
    <div className="space-y-2">
      <Label htmlFor={`${uid}-date`}>Date</Label>
      <Input id={`${uid}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Switch
        label="Debt entry type"
        value={mode}
        onChange={switchMode}
        options={[
          { value: "new", label: "Lend / Borrow" },
          { value: "repay", label: "Repayment" },
        ]}
      />

      {mode === "new" ? (
        <>
          <Switch
            label="Direction"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "they_owe", label: "I lent" },
              { value: "i_owe", label: "I borrowed" },
            ]}
          />
          <div className="space-y-2">
            <Label htmlFor={`${uid}-name`}>
              {direction === "they_owe" ? "Lent to" : "Borrowed from"}
            </Label>
            <Input
              id={`${uid}-name`}
              placeholder="Name or institution"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${uid}-amount`}>Amount (AED)</Label>
              <Input
                id={`${uid}-amount`}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${uid}-due`}>
                Due <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${uid}-due`}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          {walletField}
          {dateField}
          <div className="space-y-2">
            <Label htmlFor={`${uid}-note`}>Note (optional)</Label>
            <Textarea
              id={`${uid}-note`}
              placeholder="Reason or details"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </>
      ) : openDebts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium">Nothing is owed either way</p>
          <p className="mt-1 text-label text-muted-foreground">
            Record money you lent or borrowed first, then come back to log a repayment.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Debt being repaid</Label>
            <Select items={debtItems} value={debtId} onValueChange={(v) => chooseDebt(v ?? "")}>
              <SelectTrigger className="w-full" aria-label="Debt being repaid">
                <SelectValue placeholder="Choose a debt" />
              </SelectTrigger>
              <SelectContent>
                {openDebts.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {owedLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {debt && (
            <>
              <div className="space-y-2">
                <Label htmlFor={`${uid}-repay`}>
                  {debt.type === "they_owe" ? "Amount received (AED)" : "Amount paid (AED)"}
                </Label>
                <Input
                  id={`${uid}-repay`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  max={debt.amount}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  aria-describedby={`${uid}-repay-hint`}
                />
                <p
                  id={`${uid}-repay-hint`}
                  className={cn(
                    "text-xs",
                    plan && !plan.ok ? "text-[var(--color-danger)]" : "text-muted-foreground"
                  )}
                  aria-live="polite"
                >
                  {plan && !plan.ok
                    ? plan.error
                    : plan?.ok && plan.settles
                    ? "Pays the whole balance — the debt will be settled."
                    : plan?.ok
                    ? `${formatAED(plan.remaining)} will still be owed.`
                    : `Still owed: ${formatAED(debt.amount)}`}
                </p>
              </div>
              {walletField}
              {dateField}
            </>
          )}
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving || (mode === "repay" && (!debt || (plan !== null && !plan.ok)))}
        >
          {saving ? "Saving…" : mode === "new" ? "Save debt" : "Record repayment"}
        </Button>
      </DialogFooter>
    </form>
  );
}
