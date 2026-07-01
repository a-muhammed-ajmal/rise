"use client";

import { useState, useEffect } from "react";
import type { PaymentMethod } from "@/lib/types/database";
import { formatAED } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdjustBalanceForm({
  open,
  onOpenChange,
  paymentMethod,
  onAdjust,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paymentMethod: PaymentMethod | null;
  onAdjust: (
    id: string,
    currentBalance: number,
    targetBalance: number,
    reason: string
  ) => Promise<void>;
}) {
  const [newBalance, setNewBalance] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && paymentMethod) {
      setNewBalance(String(paymentMethod.balance));
      setReason("");
    }
  }, [open, paymentMethod]);

  if (!paymentMethod) return null;

  const targetValue = parseFloat(newBalance);
  const delta = isNaN(targetValue) ? null : targetValue - paymentMethod.balance;
  const deltaLabel =
    delta === null
      ? null
      : delta === 0
      ? "No change"
      : delta > 0
      ? `+${formatAED(delta)}`
      : `−${formatAED(Math.abs(delta))}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || delta === null) return;
    setSaving(true);
    try {
      await onAdjust(
        paymentMethod!.id,
        paymentMethod!.balance,
        targetValue,
        reason.trim()
      );
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust Balance — {paymentMethod.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Current balance</Label>
            <p className="font-mono text-sm text-muted-foreground">
              {formatAED(paymentMethod.balance)}
            </p>
          </div>

          <div className="space-y-2">
            <Label>New balance (AED)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              required
              autoFocus
            />
            {deltaLabel && delta !== 0 && (
              <p
                className={`text-xs font-medium ${
                  delta! > 0 ? "text-mod-finance" : "text-destructive"
                }`}
              >
                Adjustment: {deltaLabel}
              </p>
            )}
            {delta === 0 && (
              <p className="text-xs text-muted-foreground">No change</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Reason (required)</Label>
            <Input
              placeholder="e.g. Bank fee, cash received"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || delta === 0 || delta === null}
            >
              {saving ? "Adjusting…" : "Adjust Balance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
