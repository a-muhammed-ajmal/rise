"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/supabase/current-user";
import type { PaymentMethod } from "@/lib/types/database";
import { formatAED, todayISO } from "@/lib/format";
import { buildTransferRows, parseAmount, transferTotal } from "@/lib/finance/entries";
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

/**
 * Wallet-to-wallet transfer, with an optional fee taken from the source
 * wallet. The fee is saved as an expense in the same request as the transfer
 * (see lib/finance/entries.ts), so the two rows can never be split.
 */
export function TransferFields({
  paymentMethods,
  onCancel,
  onSaved,
}: {
  paymentMethods: PaymentMethod[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const uid = useId();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const activeWallets = paymentMethods.filter((m) => m.is_active);
  const walletItems: Record<string, string> = Object.fromEntries(
    activeWallets.map((m) => [m.id, m.name])
  );
  const fromName = activeWallets.find((m) => m.id === fromId)?.name ?? "";
  const toName = activeWallets.find((m) => m.id === toId)?.name ?? "";

  const parsedAmount = parseAmount(amount);
  const feeBlank = fee.trim() === "";
  const parsedFee = feeBlank ? 0 : parseAmount(fee, { allowZero: true });
  const feeInvalid = !feeBlank && parsedFee === null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromId || !toId) {
      toast.error("Choose both wallets");
      return;
    }
    if (fromId === toId) {
      toast.error("Source and destination wallet must be different");
      return;
    }
    if (parsedAmount === null) {
      toast.error("Enter an amount above zero");
      return;
    }
    if (parsedFee === null) {
      toast.error("The fee must be zero or more");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const userId = await currentUserId();
      if (!userId) {
        toast.error("Your session expired. Please sign in again.");
        return;
      }

      const rows = buildTransferRows({
        userId,
        fromId,
        toId,
        fromName,
        toName,
        amount: parsedAmount,
        fee: parsedFee,
        note,
        date,
      });
      const { error } = await supabase.from("transactions").insert(rows);

      if (error) {
        console.error("[finance] transfer save failed:", error.message);
        toast.error("Failed to save transfer");
        return;
      }

      onCancel();
      onSaved();
      toast.success(
        parsedFee > 0
          ? `Transfer recorded with a ${formatAED(parsedFee)} fee`
          : "Transfer recorded"
      );
    } finally {
      setSaving(false);
    }
  }

  const ready = !!fromId && !!toId && fromId !== toId && parsedAmount !== null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-2">
          <Label>From</Label>
          <Select items={walletItems} value={fromId} onValueChange={(v) => setFromId(v ?? "")} required>
            <SelectTrigger className="w-full" aria-label="From wallet">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {activeWallets.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-2">
          <Label>To</Label>
          <Select items={walletItems} value={toId} onValueChange={(v) => setToId(v ?? "")} required>
            <SelectTrigger className="w-full" aria-label="To wallet">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {activeWallets
                .filter((m) => m.id !== fromId)
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
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
            autoFocus
          />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${uid}-fee`}>
            Fee <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={`${uid}-fee`}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            aria-invalid={feeInvalid || undefined}
            aria-describedby={`${uid}-fee-hint`}
          />
        </div>
      </div>
      <p id={`${uid}-fee-hint`} className="-mt-2 text-label text-muted-foreground">
        A fee is taken from the source wallet and saved as a “Fees & Charges” expense.
      </p>

      {ready && (
        <div
          className="space-y-1 rounded-lg border border-border bg-muted/50 p-3 text-label"
          aria-live="polite"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 break-words text-muted-foreground">{fromName} pays</span>
            <span className="shrink-0 font-semibold tabular-nums whitespace-nowrap text-[var(--color-danger)]">
              −{formatAED(transferTotal(parsedAmount, parsedFee ?? 0))}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 break-words text-muted-foreground">{toName} receives</span>
            <span className="shrink-0 font-semibold tabular-nums whitespace-nowrap text-[var(--color-success)]">
              +{formatAED(parsedAmount)}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${uid}-date`}>Date</Label>
        <Input
          id={`${uid}-date`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${uid}-note`}>Note (optional)</Label>
        <Textarea
          id={`${uid}-note`}
          placeholder="Reason for transfer"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || feeInvalid}>
          {saving ? "Transferring…" : "Transfer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
