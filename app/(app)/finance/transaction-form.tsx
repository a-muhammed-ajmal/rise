"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, PaymentMethod } from "@/lib/types/database";
import { todayISO } from "@/lib/format";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const EXPENSE_CATEGORIES = [
  "Food & Drinks",
  "Transport",
  "Shopping",
  "Housing",
  "Health",
  "Entertainment",
  "Education",
  "Travel",
  "Utilities",
  "Insurance",
  "Personal Care",
  "Other",
];
const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Investment",
  "Gift",
  "Other",
];

export function TransactionForm({
  open,
  onOpenChange,
  defaultType,
  initial,
  onSaved,
  paymentMethods,
  findOrCreateByName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType: "income" | "expense";
  initial: Transaction | null;
  onSaved: () => void;
  paymentMethods: PaymentMethod[];
  findOrCreateByName: (name: string) => Promise<string | null>;
}) {
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [otherName, setOtherName] = useState("");
  const [saving, setSaving] = useState(false);

  const activeWallets = paymentMethods.filter((m) => m.is_active);

  useEffect(() => {
    if (initial) {
      setType(initial.type === "income" ? "income" : "expense");
      setAmount(String(initial.amount));
      setCategory(initial.category);
      setDescription(initial.description ?? "");
      setDate(initial.date);
      setPaymentMethodId(initial.payment_method_id ?? "");
      setOtherName("");
    } else {
      setType(defaultType);
      setAmount("");
      setCategory("");
      setDescription("");
      setDate(todayISO());
      setPaymentMethodId("");
      setOtherName("");
    }
  }, [initial, defaultType, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !category) return;
    setSaving(true);

    try {
      const supabase = createClient();

      let resolvedMethodId: string | null = null;
      let resolvedMethodName: string | null = null;

      if (paymentMethodId === "__other__") {
        if (!otherName.trim()) {
          toast.error("Enter a name for the new wallet");
          setSaving(false);
          return;
        }
        resolvedMethodId = await findOrCreateByName(otherName.trim());
        resolvedMethodName = otherName.trim();
      } else if (paymentMethodId) {
        resolvedMethodId = paymentMethodId;
        resolvedMethodName =
          activeWallets.find((m) => m.id === paymentMethodId)?.name ?? null;
      }

      if (initial) {
        const { error } = await supabase
          .from("transactions")
          .update({
            type,
            amount: parseFloat(amount),
            category,
            description: description || null,
            date,
            payment_method: resolvedMethodName,
            payment_method_id: resolvedMethodId,
          })
          .eq("id", initial.id);
        if (error) {
          toast.error("Failed to update transaction");
          return;
        }
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from("transactions").insert({
          user_id: user.id,
          type,
          amount: parseFloat(amount),
          category,
          description: description || null,
          date,
          payment_method: resolvedMethodName,
          payment_method_id: resolvedMethodId,
          tags: [],
        });
        if (error) {
          toast.error("Failed to save transaction");
          return;
        }
      }

      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const showOtherInput = paymentMethodId === "__other__";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial
              ? "Edit Transaction"
              : type === "income"
              ? "Record Income"
              : "Record Expense"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => setType("expense")}
              className={
                type === "expense"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
              }
            >
              Expense
            </Button>
            <Button
              type="button"
              onClick={() => setType("income")}
              className={
                type === "income"
                  ? "bg-mod-finance text-white hover:bg-mod-finance/90"
                  : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
              }
            >
              Income
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Amount (AED)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  if (v) setCategory(v);
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Wallet</Label>
              <Select
                value={paymentMethodId || "none"}
                onValueChange={(v) =>
                  setPaymentMethodId(v == null || v === "none" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {activeWallets.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__other__">Other…</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showOtherInput && (
            <div className="space-y-2">
              <Label>New wallet name</Label>
              <Input
                placeholder="e.g. Apple Pay"
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                required={showOtherInput}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="What was this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : initial ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
