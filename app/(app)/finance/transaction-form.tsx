"use client";

import { useState, useEffect, useId } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/supabase/current-user";
import type { Transaction, PaymentMethod, Category } from "@/lib/types/database";
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
import { cn } from "@/lib/utils";

export type TransactionKind = "income" | "expense";

type TransactionFieldsProps = {
  /** Which kind of row is being written. Controlled by the parent. */
  type: TransactionKind;
  /** When given, an Expense | Income switch is rendered above the fields. */
  onTypeChange?: (type: TransactionKind) => void;
  initial: Transaction | null;
  /** Fields reset whenever this flips to true, like the original dialog. */
  open: boolean;
  onCancel: () => void;
  onSaved: () => void;
  paymentMethods: PaymentMethod[];
  findOrCreateByName: (name: string) => Promise<string | null>;
  categories: Category[];
  createCategory: (
    name: string,
    type: "income" | "expense"
  ) => Promise<Category | null>;
};

/**
 * The expense / income form body, without its dialog — shared by
 * TransactionForm (edit and the dashboard quick-add) and the Finance "Add"
 * dialog's Expense and Income tabs.
 */
export function TransactionFields({
  type,
  onTypeChange,
  initial,
  open,
  onCancel,
  onSaved,
  paymentMethods,
  findOrCreateByName,
  categories,
  createCategory,
}: TransactionFieldsProps) {
  const uid = useId();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [otherName, setOtherName] = useState("");
  const [saving, setSaving] = useState(false);

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);

  const activeWallets = paymentMethods.filter((m) => m.is_active);
  const typeCategories = categories.filter((c) => c.type === type);
  const isIncome = type === "income";

  // Base UI's <SelectValue> renders the raw value unless the root is given
  // the value → label map, which is how wallet UUIDs leaked into the trigger.
  const walletItems: Record<string, string> = {
    none: "—",
    ...Object.fromEntries(activeWallets.map((m) => [m.id, m.name])),
    __other__: "Other…",
  };
  const categoryItems: Record<string, string> = {
    ...Object.fromEntries(typeCategories.map((c) => [c.name, c.name])),
    __new__: "+ New category…",
  };

  useEffect(() => {
    if (initial) {
      setAmount(String(initial.amount));
      setCategory(initial.category);
      setDescription(initial.description ?? "");
      setDate(initial.date);
      setPaymentMethodId(initial.payment_method_id ?? "");
      setOtherName("");
    } else {
      setAmount("");
      setCategory("");
      setDescription("");
      setDate(todayISO());
      setPaymentMethodId("");
      setOtherName("");
    }
    setShowNewCat(false);
    setNewCatName("");
  }, [initial, open]);

  function changeType(newType: TransactionKind) {
    if (newType === type) return;
    onTypeChange?.(newType);
    setCategory("");
    setShowNewCat(false);
    setNewCatName("");
  }

  async function handleCreateCategory() {
    if (!newCatName.trim() || creatingCat) return;
    setCreatingCat(true);
    try {
      const created = await createCategory(newCatName.trim(), type);
      if (created) {
        setCategory(created.name);
        setNewCatName("");
        setShowNewCat(false);
      } else {
        toast.error("Could not create category");
      }
    } finally {
      setCreatingCat(false);
    }
  }

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
        const userId = await currentUserId();
        if (!userId) return;

        const { error } = await supabase.from("transactions").insert({
          user_id: userId,
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

      onCancel();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const showOtherInput = paymentMethodId === "__other__";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {onTypeChange && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            aria-pressed={type === "expense"}
            onClick={() => changeType("expense")}
            className={cn(
              type === "expense" &&
                "border-destructive bg-destructive text-white hover:bg-destructive/90 hover:text-white"
            )}
          >
            Expense
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-pressed={type === "income"}
            onClick={() => changeType("income")}
            className={cn(
              isIncome &&
                "border-mod-finance bg-mod-finance text-white hover:bg-mod-finance/90 hover:text-white dark:text-background dark:hover:text-background"
            )}
          >
            Income
          </Button>
        </div>
      )}

      <div className="space-y-2">
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

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-2">
          <Label>Category</Label>
          <Select
            items={categoryItems}
            value={showNewCat ? "__new__" : category || ""}
            onValueChange={(v) => {
              if (!v) return;
              if (v === "__new__") {
                setShowNewCat(true);
                setCategory("");
              } else {
                setCategory(v);
                setShowNewCat(false);
                setNewCatName("");
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  typeCategories.length === 0 ? "No categories yet" : "Select"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {typeCategories.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
              <SelectItem value="__new__">+ New category…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-2">
          <Label>Wallet</Label>
          <Select
            items={walletItems}
            value={paymentMethodId || "none"}
            onValueChange={(v) =>
              setPaymentMethodId(v == null || v === "none" ? "" : v)
            }
          >
            <SelectTrigger className="w-full">
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

      {showNewCat && (
        <div className="flex gap-2">
          <Input
            aria-label="New category name"
            placeholder="Category name"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateCategory();
              }
            }}
            className="h-11 text-sm"
            autoFocus
          />
          <Button
            type="button"
            className="min-h-11 shrink-0"
            disabled={creatingCat || !newCatName.trim()}
            onClick={handleCreateCategory}
          >
            Add
          </Button>
        </div>
      )}

      {showOtherInput && (
        <div className="space-y-2">
          <Label htmlFor={`${uid}-wallet`}>New wallet name</Label>
          <Input
            id={`${uid}-wallet`}
            placeholder="e.g. Apple Pay"
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            required={showOtherInput}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${uid}-desc`}>Description (optional)</Label>
        <Textarea
          id={`${uid}-desc`}
          placeholder="What was this for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${uid}-date`}>Date</Label>
        <Input
          id={`${uid}-date`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving || !category}
          className={
            isIncome
              ? "bg-mod-finance text-white hover:bg-mod-finance/90 dark:text-background"
              : "bg-destructive text-white hover:bg-destructive/90"
          }
        >
          {saving
            ? "Saving…"
            : initial
            ? "Update"
            : isIncome
            ? "Save income"
            : "Save expense"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TransactionForm({
  open,
  onOpenChange,
  defaultType,
  initial,
  onSaved,
  paymentMethods,
  findOrCreateByName,
  categories,
  createCategory,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType: TransactionKind;
  initial: Transaction | null;
  onSaved: () => void;
  paymentMethods: PaymentMethod[];
  findOrCreateByName: (name: string) => Promise<string | null>;
  categories: Category[];
  createCategory: (
    name: string,
    type: "income" | "expense"
  ) => Promise<Category | null>;
}) {
  const [type, setType] = useState<TransactionKind>(defaultType);
  const isIncome = type === "income";

  useEffect(() => {
    if (initial) setType(initial.type === "income" ? "income" : "expense");
    else setType(defaultType);
  }, [initial, defaultType, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto md:max-w-md">
        <DialogHeader>
          <DialogTitle
            className={isIncome ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}
          >
            {initial
              ? "Edit Transaction"
              : type === "income"
              ? "Record Income"
              : "Record Expense"}
          </DialogTitle>
        </DialogHeader>
        <TransactionFields
          type={type}
          onTypeChange={setType}
          initial={initial}
          open={open}
          onCancel={() => onOpenChange(false)}
          onSaved={onSaved}
          paymentMethods={paymentMethods}
          findOrCreateByName={findOrCreateByName}
          categories={categories}
          createCategory={createCategory}
        />
      </DialogContent>
    </Dialog>
  );
}
