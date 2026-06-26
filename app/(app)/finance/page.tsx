"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, Budget, Debt } from "@/lib/types/database";
import { formatAED, formatDate, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
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
const PAYMENT_METHODS = ["Cash", "Credit Card", "Debit Card", "Bank Transfer", "Other"];

export default function FinancePage() {
  const [tab, setTab] = useState<"overview" | "transactions" | "budgets" | "debts">("overview");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  // Transaction dialogs
  const [txnOpen, setTxnOpen] = useState(false);
  const [txnType, setTxnType] = useState<"income" | "expense">("expense");
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null);

  // Budget dialogs
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [deleteBudgetId, setDeleteBudgetId] = useState<string | null>(null);

  // Debt dialogs
  const [debtOpen, setDebtOpen] = useState(false);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [deleteDebtId, setDeleteDebtId] = useState<string | null>(null);
  const [markPaidDebtId, setMarkPaidDebtId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

    const [{ data: txns }, { data: buds }, { data: dts }] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false }),
      supabase.from("budgets").select("*").gte("period_end", todayISO()),
      supabase
        .from("debts")
        .select("*")
        .is("paid_at", null)
        .order("created_at", { ascending: false }),
    ]);
    setTransactions(txns ?? []);
    setBudgets(buds ?? []);
    setDebts(dts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDeleteTransaction() {
    if (!deleteTxnId) return;
    const supabase = createClient();
    await supabase.from("transactions").delete().eq("id", deleteTxnId);
    setDeleteTxnId(null);
    toast.success("Transaction deleted");
    fetchData();
  }

  async function handleDeleteBudget() {
    if (!deleteBudgetId) return;
    const supabase = createClient();
    await supabase.from("budgets").delete().eq("id", deleteBudgetId);
    setDeleteBudgetId(null);
    toast.success("Budget deleted");
    fetchData();
  }

  async function handleDeleteDebt() {
    if (!deleteDebtId) return;
    const supabase = createClient();
    await supabase.from("debts").delete().eq("id", deleteDebtId);
    setDeleteDebtId(null);
    toast.success("Debt deleted");
    fetchData();
  }

  async function handleMarkPaid() {
    if (!markPaidDebtId) return;
    const supabase = createClient();
    await supabase
      .from("debts")
      .update({ paid_at: new Date().toISOString() })
      .eq("id", markPaidDebtId);
    setMarkPaidDebtId(null);
    toast.success("Marked as paid");
    fetchData();
  }

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalExpense;

  const spendingByCategory = transactions
    .filter((t) => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
      return acc;
    }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-mod-finance" />
      </div>
    );
  }

  return (
    <div
      className="p-4 md:p-6 max-w-2xl space-y-4 page-glow"
      style={{ "--glow-color": "var(--mod-finance)" } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex items-center justify-between animate-rise-in stagger-1">
        <h1 className="text-step-2 font-heading font-bold tracking-tight flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-mod-finance-soft flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-mod-finance" />
          </div>
          Finance
        </h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditTxn(null); setTxnType("income"); setTxnOpen(true); }}
            className="gap-1.5"
          >
            <TrendingUp className="w-4 h-4 text-mod-finance" /> Income
          </Button>
          <Button
            size="sm"
            onClick={() => { setEditTxn(null); setTxnType("expense"); setTxnOpen(true); }}
            className="gap-1.5 bg-mod-finance hover:bg-mod-finance/90 text-white"
          >
            <TrendingDown className="w-4 h-4" /> Expense
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 animate-rise-in stagger-2">
        <Card className="border-mod-finance/20">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="text-lg font-bold text-mod-finance">{formatAED(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="text-lg font-bold text-destructive">{formatAED(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Net</p>
            <p className={`text-lg font-bold ${net >= 0 ? "text-mod-finance" : "text-destructive"}`}>
              {formatAED(Math.abs(net))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="animate-rise-in stagger-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1 text-xs">Overview</TabsTrigger>
            <TabsTrigger value="transactions" className="flex-1 text-xs">Transactions</TabsTrigger>
            <TabsTrigger value="budgets" className="flex-1 text-xs">Budgets</TabsTrigger>
            <TabsTrigger value="debts" className="flex-1 text-xs">Debts</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-3 animate-rise-in stagger-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(spendingByCategory).length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses this month.</p>
              ) : (
                Object.entries(spendingByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amount]) => (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{cat}</span>
                        <span className="font-medium">{formatAED(amount)}</span>
                      </div>
                      <Progress
                        value={totalExpense > 0 ? (amount / totalExpense) * 100 : 0}
                        className="h-1.5"
                      />
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions */}
      {tab === "transactions" && (
        <div className="space-y-2 animate-rise-in stagger-4">
          {transactions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No transactions this month.</p>
          ) : (
            transactions.map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${txn.type === "income" ? "bg-mod-finance-soft" : "bg-red-100 dark:bg-red-900/30"}`}>
                    {txn.type === "income" ? (
                      <ArrowUpRight className="w-4 h-4 text-mod-finance" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{txn.description ?? txn.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {txn.category} · {formatDate(txn.date)}
                      {txn.payment_method && ` · ${txn.payment_method}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${txn.type === "income" ? "text-mod-finance" : "text-destructive"}`}>
                    {txn.type === "income" ? "+" : "-"}{formatAED(txn.amount)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditTxn(txn); setTxnType(txn.type); setTxnOpen(true); }}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTxnId(txn.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Budgets */}
      {tab === "budgets" && (
        <div className="space-y-3 animate-rise-in stagger-4">
          <Button
            size="sm"
            onClick={() => { setEditBudget(null); setBudgetOpen(true); }}
            className="w-full gap-1.5 bg-mod-finance hover:bg-mod-finance/90 text-white"
          >
            <Plus className="w-4 h-4" /> Add Budget
          </Button>
          {budgets.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No budgets set. Add one to track spending.
            </p>
          ) : (
            budgets.map((budget) => {
              const spent = spendingByCategory[budget.category] ?? 0;
              const pct = Math.min((spent / budget.amount) * 100, 100);
              return (
                <Card key={budget.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">{budget.category}</span>
                          <span className={`text-sm font-semibold ${pct >= 90 ? "text-destructive" : ""}`}>
                            {formatAED(spent)} / {formatAED(budget.amount)}
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className={`h-2 mt-2 ${pct >= 90 ? "[&>div]:bg-destructive" : ""}`}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {Math.round(pct)}% used · {budget.period}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="ml-3 h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent shrink-0">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditBudget(budget); setBudgetOpen(true); }}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteBudgetId(budget.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Debts */}
      {tab === "debts" && (
        <div className="space-y-2 animate-rise-in stagger-4">
          <Button
            size="sm"
            onClick={() => { setEditDebt(null); setDebtOpen(true); }}
            className="w-full gap-1.5 bg-mod-finance hover:bg-mod-finance/90 text-white"
          >
            <Plus className="w-4 h-4" /> Add Debt / Loan
          </Button>
          {debts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No outstanding debts.</p>
          ) : (
            debts.map((debt) => (
              <div
                key={debt.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{debt.creditor}</p>
                  {debt.description && (
                    <p className="text-xs text-muted-foreground">{debt.description}</p>
                  )}
                  {debt.due_date && (
                    <p className="text-xs text-muted-foreground">Due: {formatDate(debt.due_date)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${debt.type === "i_owe" ? "text-destructive" : "text-mod-finance"}`}>
                      {formatAED(debt.amount)}
                    </p>
                    <Badge
                      variant={debt.type === "i_owe" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {debt.type === "i_owe" ? "I owe" : "They owe"}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setMarkPaidDebtId(debt.id)}>
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as paid
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditDebt(debt); setDebtOpen(true); }}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteDebtId(debt.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => { setEditTxn(null); setTxnType("expense"); setTxnOpen(true); }}
        className="fab fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-mod-finance text-white flex items-center justify-center z-40"
        aria-label="Add expense"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Dialogs */}
      <TransactionForm
        open={txnOpen}
        onOpenChange={(v) => { setTxnOpen(v); if (!v) setEditTxn(null); }}
        defaultType={txnType}
        initial={editTxn}
        onSaved={() => { fetchData(); toast.success(editTxn ? "Transaction updated" : "Transaction saved"); }}
      />
      <BudgetForm
        open={budgetOpen}
        onOpenChange={(v) => { setBudgetOpen(v); if (!v) setEditBudget(null); }}
        initial={editBudget}
        onSaved={() => { fetchData(); toast.success(editBudget ? "Budget updated" : "Budget created"); }}
      />
      <DebtForm
        open={debtOpen}
        onOpenChange={(v) => { setDebtOpen(v); if (!v) setEditDebt(null); }}
        initial={editDebt}
        onSaved={() => { fetchData(); toast.success(editDebt ? "Debt updated" : "Debt added"); }}
      />

      <ConfirmDialog
        open={!!deleteTxnId}
        onOpenChange={(v) => { if (!v) setDeleteTxnId(null); }}
        title="Delete transaction?"
        description="This transaction will be permanently removed."
        onConfirm={handleDeleteTransaction}
      />
      <ConfirmDialog
        open={!!deleteBudgetId}
        onOpenChange={(v) => { if (!v) setDeleteBudgetId(null); }}
        title="Delete budget?"
        description="This budget will be permanently removed."
        onConfirm={handleDeleteBudget}
      />
      <ConfirmDialog
        open={!!deleteDebtId}
        onOpenChange={(v) => { if (!v) setDeleteDebtId(null); }}
        title="Delete debt?"
        description="This debt record will be permanently removed."
        onConfirm={handleDeleteDebt}
      />
      <ConfirmDialog
        open={!!markPaidDebtId}
        onOpenChange={(v) => { if (!v) setMarkPaidDebtId(null); }}
        title="Mark as paid?"
        description="This debt will be marked as settled and removed from your outstanding list."
        confirmLabel="Mark paid"
        destructive={false}
        onConfirm={handleMarkPaid}
      />
    </div>
  );
}

// ─── Transaction Form ─────────────────────────────────────────────────────────

function TransactionForm({
  open,
  onOpenChange,
  defaultType,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType: "income" | "expense";
  initial: Transaction | null;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setType(initial.type);
      setAmount(String(initial.amount));
      setCategory(initial.category);
      setDescription(initial.description ?? "");
      setDate(initial.date);
      setPaymentMethod(initial.payment_method ?? "");
    } else {
      setType(defaultType);
      setAmount("");
      setCategory("");
      setDescription("");
      setDate(todayISO());
      setPaymentMethod("");
    }
  }, [initial, defaultType, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !category) return;
    setSaving(true);
    const supabase = createClient();

    if (initial) {
      await supabase.from("transactions").update({
        type,
        amount: parseFloat(amount),
        category,
        description: description || null,
        date,
        payment_method: paymentMethod || null,
      }).eq("id", initial.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("transactions").insert({
        user_id: user.id,
        type,
        amount: parseFloat(amount),
        category,
        description: description || null,
        date,
        payment_method: paymentMethod || null,
        tags: [],
      });
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Transaction" : type === "income" ? "Record Income" : "Record Expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={type === "expense" ? "default" : "outline"} onClick={() => setType("expense")}>Expense</Button>
            <Button type="button" variant={type === "income" ? "default" : "outline"} onClick={() => setType("income")}>Income</Button>
          </div>
          <div className="space-y-2">
            <Label>Amount (AED)</Label>
            <Input type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => { if (v) setCategory(v); }} required>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={paymentMethod || "none"} onValueChange={(v) => setPaymentMethod(v == null || v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea placeholder="What was this for?" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : initial ? "Update" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Budget Form ──────────────────────────────────────────────────────────────

function BudgetForm({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Budget | null;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<Budget["period"]>("monthly");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setCategory(initial.category);
      setAmount(String(initial.amount));
      setPeriod(initial.period);
    } else {
      setCategory("");
      setAmount("");
      setPeriod("monthly");
    }
  }, [initial, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !amount) return;
    setSaving(true);
    const supabase = createClient();

    const today = new Date();
    const periodStart = format(startOfMonth(today), "yyyy-MM-dd");
    const periodEnd = format(endOfMonth(today), "yyyy-MM-dd");

    if (initial) {
      await supabase.from("budgets").update({ category, amount: parseFloat(amount), period }).eq("id", initial.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("budgets").insert({
        user_id: user.id,
        category,
        amount: parseFloat(amount),
        period,
        period_start: periodStart,
        period_end: periodEnd,
      });
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Budget" : "New Budget"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => { if (v) setCategory(v); }} required>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount (AED)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Budget["period"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : initial ? "Update" : "Add Budget"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Debt Form ────────────────────────────────────────────────────────────────

function DebtForm({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Debt | null;
  onSaved: () => void;
}) {
  const [creditor, setCreditor] = useState("");
  const [type, setType] = useState<Debt["type"]>("i_owe");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setCreditor(initial.creditor);
      setType(initial.type);
      setAmount(String(initial.amount));
      setDescription(initial.description ?? "");
      setDueDate(initial.due_date ?? "");
    } else {
      setCreditor("");
      setType("i_owe");
      setAmount("");
      setDescription("");
      setDueDate("");
    }
  }, [initial, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!creditor.trim() || !amount) return;
    setSaving(true);
    const supabase = createClient();

    if (initial) {
      await supabase.from("debts").update({
        creditor: creditor.trim(),
        type,
        amount: parseFloat(amount),
        description: description || null,
        due_date: dueDate || null,
      }).eq("id", initial.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("debts").insert({
        user_id: user.id,
        creditor: creditor.trim(),
        type,
        amount: parseFloat(amount),
        description: description || null,
        due_date: dueDate || null,
      });
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Debt" : "Add Debt / Loan"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={type === "i_owe" ? "default" : "outline"} onClick={() => setType("i_owe")}>I owe</Button>
            <Button type="button" variant={type === "they_owe" ? "default" : "outline"} onClick={() => setType("they_owe")}>They owe</Button>
          </div>
          <div className="space-y-2">
            <Label>{type === "i_owe" ? "Creditor / Lender" : "Debtor name"}</Label>
            <Input placeholder="Name or institution" value={creditor} onChange={(e) => setCreditor(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount (AED)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea placeholder="Reason or details" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : initial ? "Update" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
