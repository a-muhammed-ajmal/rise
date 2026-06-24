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
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
} from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";

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

export default function FinancePage() {
  const [tab, setTab] = useState<
    "overview" | "transactions" | "budgets" | "debts"
  >("overview");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTxnOpen, setNewTxnOpen] = useState(false);
  const [txnType, setTxnType] = useState<"income" | "expense">("expense");

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

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
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
            onClick={() => {
              setTxnType("income");
              setNewTxnOpen(true);
            }}
            className="gap-1.5"
          >
            <TrendingUp className="w-4 h-4 text-mod-finance" /> Income
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setTxnType("expense");
              setNewTxnOpen(true);
            }}
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
            <p className="text-lg font-bold text-mod-finance">
              {formatAED(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="text-lg font-bold text-destructive">
              {formatAED(totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Net</p>
            <p
              className={`text-lg font-bold ${net >= 0 ? "text-mod-finance" : "text-destructive"}`}
            >
              {formatAED(Math.abs(net))}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="animate-rise-in stagger-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1 text-xs">
              Overview
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex-1 text-xs">
              Transactions
            </TabsTrigger>
            <TabsTrigger value="budgets" className="flex-1 text-xs">
              Budgets
            </TabsTrigger>
            <TabsTrigger value="debts" className="flex-1 text-xs">
              Debts
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "overview" && (
        <div className="space-y-3 animate-rise-in stagger-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(spendingByCategory).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No expenses this month.
                </p>
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
                        value={
                          totalExpense > 0 ? (amount / totalExpense) * 100 : 0
                        }
                        className="h-1.5"
                      />
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "transactions" && (
        <div className="space-y-2 animate-rise-in stagger-4">
          {transactions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No transactions this month.
            </p>
          ) : (
            transactions.map((txn) => (
              <div
                key={txn.id}
                className="card-interactive flex items-center justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${txn.type === "income" ? "bg-mod-finance-soft" : "bg-red-100 dark:bg-red-900/30"}`}
                  >
                    {txn.type === "income" ? (
                      <ArrowUpRight className="w-4 h-4 text-mod-finance" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {txn.description ?? txn.category}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {txn.category} · {formatDate(txn.date)}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold ${txn.type === "income" ? "text-mod-finance" : "text-destructive"}`}
                >
                  {txn.type === "income" ? "+" : "-"}
                  {formatAED(txn.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "budgets" && (
        <div className="space-y-3 animate-rise-in stagger-4">
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
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">
                        {budget.category}
                      </span>
                      <span
                        className={`text-sm font-semibold ${pct >= 90 ? "text-destructive" : ""}`}
                      >
                        {formatAED(spent)} / {formatAED(budget.amount)}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className={`h-2 ${pct >= 90 ? "[&>div]:bg-destructive" : ""}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      {Math.round(pct)}% used
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "debts" && (
        <div className="space-y-2 animate-rise-in stagger-4">
          {debts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No outstanding debts.
            </p>
          ) : (
            debts.map((debt) => (
              <div
                key={debt.id}
                className="card-interactive flex items-center justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div>
                  <p className="text-sm font-medium">{debt.creditor}</p>
                  <p className="text-xs text-muted-foreground">
                    {debt.description}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${debt.type === "i_owe" ? "text-destructive" : "text-mod-finance"}`}
                  >
                    {formatAED(debt.amount)}
                  </p>
                  <Badge
                    variant={
                      debt.type === "i_owe" ? "destructive" : "secondary"
                    }
                    className="text-xs"
                  >
                    {debt.type === "i_owe" ? "I owe" : "They owe"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => {
          setTxnType("expense");
          setNewTxnOpen(true);
        }}
        className="fab fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-mod-finance text-white flex items-center justify-center z-40"
        aria-label="Add expense"
      >
        <Plus className="w-6 h-6" />
      </button>

      <TransactionForm
        open={newTxnOpen}
        onOpenChange={setNewTxnOpen}
        defaultType={txnType}
        onSaved={fetchData}
      />
    </div>
  );
}

// ─── Transaction form ─────────────────────────────────────────────────────────

function TransactionForm({
  open,
  onOpenChange,
  defaultType,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType: "income" | "expense";
  onSaved: () => void;
}) {
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setType(defaultType);
  }, [defaultType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !category) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("transactions").insert({
      user_id: user.id,
      type,
      amount: parseFloat(amount),
      category,
      description: description || null,
      date,
      payment_method: null,
      tags: [],
    });
    setSaving(false);
    setAmount("");
    setCategory("");
    setDescription("");
    setDate(todayISO());
    onOpenChange(false);
    onSaved();
  }

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type === "income" ? "Record Income" : "Record Expense"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === "expense" ? "default" : "outline"}
              onClick={() => setType("expense")}
            >
              Expense
            </Button>
            <Button
              type="button"
              variant={type === "income" ? "default" : "outline"}
              onClick={() => setType("income")}
            >
              Income
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Amount (AED)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
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
                <SelectValue placeholder="Select category" />
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
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
