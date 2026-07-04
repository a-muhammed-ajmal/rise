"use client";

import { useState, useEffect } from "react";
import type { PaymentMethod } from "@/lib/types/database";
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
import { X } from "lucide-react";

const COLOR_SWATCHES = [
  "#FF6535",
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

export function WalletForm({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: PaymentMethod | null;
  onSave: (data: { name: string; balance: number; color: string | null }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("0");
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = !!initial;

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setBalance(String(initial.balance));
      setColor(initial.color);
    } else {
      setName("");
      setBalance("0");
      setColor(null);
    }
  }, [initial, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        balance: parseFloat(balance) || 0,
        color: color,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Wallet" : "Add Wallet"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Wallet name</Label>
            <Input
              placeholder="e.g. Mashreq Neo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label>Starting balance (AED)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter your current balance in this wallet.
              </p>
            </div>
          )}

          {isEdit && (
            <p className="text-xs text-muted-foreground">
              Balance is managed via transactions. Use &quot;Adjust Balance&quot; to correct it.
            </p>
          )}

          <div className="space-y-2">
            <Label>Color (optional)</Label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(color === c ? null : c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                    boxShadow: color === c ? `0 0 0 2px ${c}` : "none",
                  }}
                  aria-label={`Select color ${c}`}
                />
              ))}
              {color && (
                <button
                  type="button"
                  onClick={() => setColor(null)}
                  className="w-7 h-7 rounded-full border border-border text-muted-foreground text-xs flex items-center justify-center hover:bg-accent"
                  aria-label="Clear color"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Update" : "Add Wallet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
