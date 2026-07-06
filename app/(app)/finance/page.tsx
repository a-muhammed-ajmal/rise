"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, Budget, Debt, PaymentMethod, Category } from "@/lib/types/database";
import { useCategories } from "@/lib/hooks/use-categories";
import { formatAED, formatDate, todayISO } from "@/lib/format";
import { usePaymentMethods } from "@/lib/hooks/use-payment-methods";
import { TransactionForm } from "./transaction-form";
import { TransferForm } from "./transfer-form";
import { WalletForm } from "./wallet-form";
import { AdjustBalanceForm } from "./adjust-balance-form";
import { WalletCard } from "./wallet-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  ArrowLeftRight,
  DollarSign,
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  format,
  addMonths,
  subMonths,
} from "date-fns";
import { toast } from "sonner";


export default function FinancePage() {
  const [tab, setTab] = useState<
    | "overview"
    | "transactions"
    | "transfers"
    | "wallets"
    | "budgets"
    | "debts"
    | "categories"
  >("overview");

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  // Monthly view state
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Transaction dialogs
  const [txnOpen, setTxnOpen] = useState(false);
  const [txnType, setTxnType] = useState<"income" | "expense">("expense");
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null);

  // Transfer dialog
  const [transferOpen, setTransferOpen] = useState(false);

  // Wallet dialogs
  const [walletFormOpen, setWalletFormOpen] = useState(false);
  const [editWallet, setEditWallet] = useState<PaymentMethod | null>(null);
  const [adjustWallet, setAdjustWallet] = useState<PaymentMethod | null>(null);
  const [deactivateWalletId, setDeactivateWalletId] = useState<string | null>(null);

  // Budget dialogs
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [deleteBudgetId, setDeleteBudgetId] = useState<string | null>(null);

  // Debt dialogs
  const [debtOpen, setDebtOpen] = useState(false);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [deleteDebtId, setDeleteDebtId] = useState<string | null>(null);
  const [markPaidDebtId, setMarkPaidDebtId] = useState<string | null>(null);

  const {
    categories,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategories();

  // Categories tab UI state
  const [addCatType, setAddCatType] = useState<"income" | "expense" | null>(null);
  const [addCatName, setAddCatName] = useState("");
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);

  const {
    paymentMethods,
    loading: walletsLoading,
    refresh: refreshWallets,
    createPaymentMethod,
    updatePaymentMethod,
    setActiveStatus,
    reorderPaymentMethods,
    adjustBalance,
    findOrCreateByName,
  } = usePaymentMethods();

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: txns }, { data: buds }, { data: dts }] = await Promise.all([
      // Fetch all transactions — needed for overall metrics and transfers tab
      supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false }),
      supabase.from("budgets").select("*").gte("period_end", todayISO()),
      supabase
        .from("debts")
        .select("*")
        .is("paid_at", null)
        .order("created_at", { ascending: false }),
    ]);
    setAllTransactions(txns ?? []);
    setBudgets(buds ?? []);
    setDebts(dts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

  // Monthly income/expense transactions (excludes transfers & adjustments)
  const monthlyFinancialTxns = useMemo(
    () =>
      allTransactions.filter(
        (t) =>
          t.type === "income" || t.type === "expense"
            ? t.date >= monthStart && t.date <= monthEnd
            : false
      ),
    [allTransactions, monthStart, monthEnd]
  );

  const monthlyIncome = monthlyFinancialTxns
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const monthlyExpense = monthlyFinancialTxns
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const monthlyNet = monthlyIncome - monthlyExpense;

  // Spending by category — current month only
  const spendingByCategory = useMemo(
    () =>
      monthlyFinancialTxns
        .filter((t) => t.type === "expense")
        .reduce<Record<string, number>>((acc, t) => {
          acc[t.category] = (acc[t.category] ?? 0) + t.amount;
          return acc;
        }, {}),
    [monthlyFinancialTxns]
  );

  // Transfers tab — all transfer rows
  const transfers = useMemo(
    () => allTransactions.filter((t) => t.type === "transfer"),
    [allTransactions]
  );

  // Transactions tab — only income/expense for selected month
  const monthlyTxnsForList = useMemo(
    () =>
      allTransactions.filter(
        (t) =>
          (t.type === "income" || t.type === "expense") &&
          t.date >= monthStart &&
          t.date <= monthEnd
      ),
    [allTransactions, monthStart, monthEnd]
  );

  // Group transactions by date for the list view
  const groupedTxns = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    monthlyTxnsForList.forEach((t) => {
      (groups[t.date] ??= []).push(t);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [monthlyTxnsForList]);

  // Wallet totals
  const activeWallets = paymentMethods.filter((m) => m.is_active);
  const totalWalletBalance = activeWallets.reduce(
    (s, m) => s + m.balance,
    0
  );

  // Wallet name lookup for transfer display
  const walletNameById = useMemo(() => {
    const map: Record<string, string> = {};
    paymentMethods.forEach((m) => {
      map[m.id] = m.name;
    });
    return map;
  }, [paymentMethods]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleDeleteTransaction() {
    if (!deleteTxnId) return;
    const supabase = createClient();
    await supabase.from("transactions").delete().eq("id", deleteTxnId);
    setDeleteTxnId(null);
    toast.success("Transaction deleted");
    await Promise.all([fetchData(), refreshWallets()]);
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

  async function handleWalletSave(data: {
    name: string;
    balance: number;
    color: string | null;
  }) {
    if (editWallet) {
      await updatePaymentMethod(editWallet.id, {
        name: data.name,
        color: data.color,
      });
      toast.success("Wallet updated");
    } else {
      await createPaymentMethod(data);
      toast.success("Wallet added");
    }
    setEditWallet(null);
  }

  function handleWalletReorder(id: string, direction: "up" | "down") {
    const sorted = [...paymentMethods].sort(
      (a, b) => a.display_order - b.display_order
    );
    const idx = sorted.findIndex((m) => m.id === id);
    if (direction === "up" && idx > 0) {
      const swapped = [...sorted];
      [swapped[idx - 1], swapped[idx]] = [swapped[idx], swapped[idx - 1]];
      reorderPaymentMethods(swapped.map((m) => m.id));
    } else if (direction === "down" && idx < sorted.length - 1) {
      const swapped = [...sorted];
      [swapped[idx], swapped[idx + 1]] = [swapped[idx + 1], swapped[idx]];
      reorderPaymentMethods(swapped.map((m) => m.id));
    }
  }

  async function handleCategoryAdd(catType: "income" | "expense") {
    if (!addCatName.trim()) return;
    await createCategory(addCatName.trim(), catType);
    setAddCatType(null);
    setAddCatName("");
    toast.success("Category added");
  }

  async function handleCategoryUpdate() {
    if (!editCatId || !editCatName.trim()) return;
    await updateCategory(editCatId, editCatName.trim());
    setEditCatId(null);
    setEditCatName("");
    toast.success("Category renamed");
  }

  async function handleCategoryDelete() {
    if (!deleteCatId) return;
    await deleteCategory(deleteCatId);
    setDeleteCatId(null);
    toast.success("Category deleted");
  }

  if (loading || walletsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-mod-finance" />
      </div>
    );
  }

  const sortedWallets = [...paymentMethods].sort(
    (a, b) => a.display_order - b.display_order
  );

  return (
    <div
      className="p-3 md:p-5 max-w-2xl space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between slide-up stagger-1">
        <h1 className="text-h1 font-heading tracking-tight flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-mod-finance-tint flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-mod-finance" />
          </div>
          Finance
        </h1>
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => {
              setEditTxn(null);
              setTxnType("income");
              setTxnOpen(true);
            }}
            aria-label="Add income"
          >
            <TrendingUp className="w-4 h-4 text-mod-finance" />
          </Button>
          <Button
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setEditTxn(null);
              setTxnType("expense");
              setTxnOpen(true);
            }}
            aria-label="Add expense"
          >
            <TrendingDown className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Wallet balance cards — always visible */}
      {activeWallets.length > 0 && (
        <div className="slide-up stagger-2">
          <div className="flex overflow-x-auto gap-2 pb-1 -mx-1 px-1">
            {activeWallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card min-h-[44px]"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      wallet.color ?? "var(--muted-foreground)",
                  }}
                />
                <div>
                  <p className="text-xs text-muted-foreground leading-none mb-0.5">
                    {wallet.name}
                  </p>
                  <p
                    className={`text-sm font-mono font-medium leading-none ${
                      wallet.balance < 0
                        ? "text-destructive"
                        : "text-mod-finance"
                    }`}
                  >
                    {formatAED(wallet.balance)}
                  </p>
                </div>
              </div>
            ))}
            {/* Total balance tile */}
            <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border border-mod-finance/30 bg-mod-finance-tint min-h-[44px]">
              <Wallet className="w-3.5 h-3.5 text-mod-finance" />
              <div>
                <p className="text-xs text-muted-foreground leading-none mb-0.5">
                  Total
                </p>
                <p
                  className={`text-sm font-mono font-medium leading-none ${
                    totalWalletBalance < 0
                      ? "text-destructive"
                      : "text-mod-finance"
                  }`}
                >
                  {formatAED(totalWalletBalance)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly summary — centered nav + 3-column stat grid */}
      <div className="slide-up stagger-3 space-y-2.5">
        <div className="flex items-center justify-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setSelectedMonth((m) => subMonths(m, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[88px] text-center">
            {format(selectedMonth, "MMM yyyy")}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-card border border-border">
            <TrendingUp className="w-3.5 h-3.5 text-mod-finance" />
            <p className="text-[10px] text-muted-foreground leading-none">Income</p>
            <p className="text-xs font-mono font-semibold text-mod-finance leading-none">
              {formatAED(monthlyIncome)}
            </p>
          </div>

          <div
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border ${
              monthlyNet >= 0
                ? "bg-mod-finance-tint border-mod-finance/30"
                : "bg-destructive/10 border-destructive/30"
            }`}
          >
            <DollarSign
              className={`w-3.5 h-3.5 ${
                monthlyNet >= 0 ? "text-mod-finance" : "text-destructive"
              }`}
            />
            <p className="text-[10px] text-muted-foreground leading-none">
              {monthlyNet >= 0 ? "Saved" : "Deficit"}
            </p>
            <p
              className={`text-xs font-mono font-semibold leading-none ${
                monthlyNet >= 0 ? "text-mod-finance" : "text-destructive"
              }`}
            >
              {monthlyNet >= 0 ? "+" : "−"}
              {formatAED(Math.abs(monthlyNet))}
            </p>
          </div>

          <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-card border border-border">
            <TrendingDown className="w-3.5 h-3.5 text-destructive" />
            <p className="text-[10px] text-muted-foreground leading-none">Spent</p>
            <p className="text-xs font-mono font-semibold text-destructive leading-none">
              {formatAED(monthlyExpense)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="slide-up stagger-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full overflow-x-auto flex justify-start whitespace-nowrap h-auto p-1 gap-0.5">
            <TabsTrigger value="overview" className="shrink-0 text-xs px-3 py-1.5">
              Overview
            </TabsTrigger>
            <TabsTrigger value="transactions" className="shrink-0 text-xs px-3 py-1.5">
              Transactions
            </TabsTrigger>
            <TabsTrigger value="transfers" className="shrink-0 text-xs px-3 py-1.5">
              Transfers
            </TabsTrigger>
            <TabsTrigger value="wallets" className="shrink-0 text-xs px-3 py-1.5">
              Wallets
            </TabsTrigger>
            <TabsTrigger value="budgets" className="shrink-0 text-xs px-3 py-1.5">
              Budgets
            </TabsTrigger>
            <TabsTrigger value="debts" className="shrink-0 text-xs px-3 py-1.5">
              Debts
            </TabsTrigger>
            <TabsTrigger value="categories" className="shrink-0 text-xs px-3 py-1.5">
              Categories
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-3 slide-up stagger-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(spendingByCategory).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No expenses in {format(selectedMonth, "MMMM")}.
                </p>
              ) : (
                Object.entries(spendingByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amount]) => (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between items-baseline text-sm">
                        <span>{cat}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {Math.round((amount / monthlyExpense) * 100)}%
                          </span>
                          <span className="font-mono font-medium">{formatAED(amount)}</span>
                        </div>
                      </div>
                      <Progress
                        value={
                          monthlyExpense > 0
                            ? (amount / monthlyExpense) * 100
                            : 0
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

      {/* Transactions */}
      {tab === "transactions" && (
        <div className="space-y-1 slide-up stagger-4">
          {groupedTxns.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No transactions in {format(selectedMonth, "MMMM yyyy")}.
            </p>
          ) : (
            groupedTxns.map(([date, txns]) => (
              <div key={date}>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1 pt-3 pb-1.5 first:pt-0">
                  {formatDate(date)}
                </p>
                <div className="space-y-1.5">
                  {txns.map((txn) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            txn.type === "income"
                              ? "bg-mod-finance-tint"
                              : "bg-[var(--color-danger-tint)]"
                          }`}
                        >
                          {txn.type === "income" ? (
                            <ArrowUpRight className="w-4 h-4 text-mod-finance" />
                          ) : (
                            <ArrowDownLeft className="w-4 h-4 text-[var(--color-danger)]" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {txn.description ?? txn.category}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {txn.category}
                            {txn.payment_method && ` · ${txn.payment_method}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold font-mono ${
                            txn.type === "income"
                              ? "text-mod-finance"
                              : "text-destructive"
                          }`}
                        >
                          {txn.type === "income" ? "+" : "−"}
                          {formatAED(txn.amount)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditTxn(txn);
                                setTxnType(
                                  txn.type === "income" ? "income" : "expense"
                                );
                                setTxnOpen(true);
                              }}
                            >
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
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Transfers */}
      {tab === "transfers" && (
        <div className="space-y-3 slide-up stagger-4">
          <Button
            size="sm"
            onClick={() => setTransferOpen(true)}
            className="w-full gap-1.5"
          >
            <ArrowLeftRight className="w-4 h-4" /> New Transfer
          </Button>
          {transfers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No transfers yet.
            </p>
          ) : (
            transfers.map((txn) => {
              const fromName =
                (txn.from_payment_method_id &&
                  walletNameById[txn.from_payment_method_id]) ||
                "Unknown";
              const toName =
                (txn.to_payment_method_id &&
                  walletNameById[txn.to_payment_method_id]) ||
                "Unknown";
              return (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                      <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {fromName} → {toName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(txn.date)}
                        {txn.description &&
                          txn.description !== `${fromName} → ${toName}` &&
                          ` · ${txn.description}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {formatAED(txn.amount)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Wallets */}
      {tab === "wallets" && (
        <div className="space-y-3 slide-up stagger-4">
          <Button
            size="sm"
            onClick={() => {
              setEditWallet(null);
              setWalletFormOpen(true);
            }}
            className="w-full gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Wallet
          </Button>
          {sortedWallets.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No wallets yet. Add one to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {sortedWallets.map((wallet, idx) => (
                <WalletCard
                  key={wallet.id}
                  paymentMethod={wallet}
                  isFirst={idx === 0}
                  isLast={idx === sortedWallets.length - 1}
                  onEdit={() => {
                    setEditWallet(wallet);
                    setWalletFormOpen(true);
                  }}
                  onAdjust={() => setAdjustWallet(wallet)}
                  onToggleActive={() => {
                    if (wallet.is_active) {
                      setDeactivateWalletId(wallet.id);
                    } else {
                      setActiveStatus(wallet.id, true);
                      toast.success("Wallet activated");
                    }
                  }}
                  onMoveUp={() => handleWalletReorder(wallet.id, "up")}
                  onMoveDown={() => handleWalletReorder(wallet.id, "down")}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Budgets */}
      {tab === "budgets" && (
        <div className="space-y-3 slide-up stagger-4">
          <Button
            size="sm"
            onClick={() => {
              setEditBudget(null);
              setBudgetOpen(true);
            }}
            className="w-full gap-1.5"
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
                          <span className="text-sm font-medium">
                            {budget.category}
                          </span>
                          <span
                            className={`text-sm font-semibold ${
                              pct >= 90 ? "text-destructive" : ""
                            }`}
                          >
                            {formatAED(spent)} / {formatAED(budget.amount)}
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className={`h-2 mt-2 ${
                            pct >= 90 ? "[&>div]:bg-destructive" : ""
                          }`}
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
                          <DropdownMenuItem
                            onClick={() => {
                              setEditBudget(budget);
                              setBudgetOpen(true);
                            }}
                          >
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
        <div className="space-y-2 slide-up stagger-4">
          <Button
            size="sm"
            onClick={() => {
              setEditDebt(null);
              setDebtOpen(true);
            }}
            className="w-full gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Debt / Loan
          </Button>
          {debts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No outstanding debts.
            </p>
          ) : (
            debts.map((debt) => (
              <div
                key={debt.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{debt.creditor}</p>
                  {debt.description && (
                    <p className="text-xs text-muted-foreground">
                      {debt.description}
                    </p>
                  )}
                  {debt.due_date && (
                    <p className="text-xs text-muted-foreground">
                      Due: {formatDate(debt.due_date)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        debt.type === "i_owe"
                          ? "text-destructive"
                          : "text-mod-finance"
                      }`}
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
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setMarkPaidDebtId(debt.id)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as paid
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditDebt(debt);
                          setDebtOpen(true);
                        }}
                      >
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

      {/* Categories */}
      {tab === "categories" && (
        <div className="space-y-4 slide-up stagger-4">
          {(["expense", "income"] as const).map((catType) => {
            const typeCats = categories.filter((c) => c.type === catType);
            const atLimit = typeCats.length >= 10;
            return (
              <Card key={catType}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm capitalize">
                      {catType} Categories
                    </CardTitle>
                    {!atLimit && addCatType !== catType && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          setAddCatType(catType);
                          setAddCatName("");
                          setEditCatId(null);
                        }}
                      >
                        <Plus className="w-3 h-3" /> Add
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {typeCats.length === 0 && addCatType !== catType && (
                    <p className="text-sm text-muted-foreground">
                      No categories yet.
                    </p>
                  )}
                  {typeCats.map((cat) =>
                    editCatId === cat.id ? (
                      <div key={cat.id} className="flex items-center gap-2">
                        <Input
                          className="h-8 text-sm flex-1"
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCategoryUpdate();
                            }
                            if (e.key === "Escape") setEditCatId(null);
                          }}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs shrink-0"
                          disabled={!editCatName.trim()}
                          onClick={handleCategoryUpdate}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs shrink-0"
                          onClick={() => setEditCatId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div
                        key={cat.id}
                        className="flex items-center gap-2 py-0.5"
                      >
                        <span className="flex-1 text-sm">{cat.name}</span>
                        <button
                          type="button"
                          aria-label="Rename category"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
                          onClick={() => {
                            setEditCatId(cat.id);
                            setEditCatName(cat.name);
                            setAddCatType(null);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete category"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent text-destructive"
                          onClick={() => setDeleteCatId(cat.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  )}
                  {addCatType === catType && (
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        className="h-8 text-sm flex-1"
                        placeholder="Category name"
                        value={addCatName}
                        onChange={(e) => setAddCatName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCategoryAdd(catType);
                          }
                          if (e.key === "Escape") setAddCatType(null);
                        }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-8 text-xs shrink-0"
                        disabled={!addCatName.trim()}
                        onClick={() => handleCategoryAdd(catType)}
                      >
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs shrink-0"
                        onClick={() => setAddCatType(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  {atLimit && (
                    <p className="text-xs text-muted-foreground pt-1">
                      Limit of 10 reached.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => {
          setEditTxn(null);
          setTxnType("expense");
          setTxnOpen(true);
        }}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-brand text-white shadow-brand transition-all hover:bg-brand-hover active:scale-95 flex items-center justify-center z-40"
        aria-label="Add expense"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Dialogs */}
      <TransactionForm
        open={txnOpen}
        onOpenChange={(v) => {
          setTxnOpen(v);
          if (!v) setEditTxn(null);
        }}
        defaultType={txnType}
        initial={editTxn}
        paymentMethods={paymentMethods}
        findOrCreateByName={findOrCreateByName}
        categories={categories}
        createCategory={createCategory}
        onSaved={async () => {
          await Promise.all([fetchData(), refreshWallets()]);
          toast.success(editTxn ? "Transaction updated" : "Transaction saved");
        }}
      />

      <TransferForm
        open={transferOpen}
        onOpenChange={setTransferOpen}
        paymentMethods={paymentMethods}
        onSaved={async () => {
          await Promise.all([fetchData(), refreshWallets()]);
        }}
      />

      <WalletForm
        open={walletFormOpen}
        onOpenChange={(v) => {
          setWalletFormOpen(v);
          if (!v) setEditWallet(null);
        }}
        initial={editWallet}
        onSave={handleWalletSave}
      />

      <AdjustBalanceForm
        open={!!adjustWallet}
        onOpenChange={(v) => {
          if (!v) setAdjustWallet(null);
        }}
        paymentMethod={adjustWallet}
        onAdjust={async (id, current, target, reason) => {
          await adjustBalance(id, current, target, reason);
          toast.success("Balance adjusted");
          await fetchData();
        }}
      />

      <BudgetForm
        open={budgetOpen}
        onOpenChange={(v) => {
          setBudgetOpen(v);
          if (!v) setEditBudget(null);
        }}
        initial={editBudget}
        expenseCategories={categories.filter((c) => c.type === "expense")}
        createCategory={createCategory}
        onSaved={() => {
          fetchData();
          toast.success(editBudget ? "Budget updated" : "Budget created");
        }}
      />

      <DebtForm
        open={debtOpen}
        onOpenChange={(v) => {
          setDebtOpen(v);
          if (!v) setEditDebt(null);
        }}
        initial={editDebt}
        onSaved={() => {
          fetchData();
          toast.success(editDebt ? "Debt updated" : "Debt added");
        }}
      />

      <ConfirmDialog
        open={!!deleteTxnId}
        onOpenChange={(v) => {
          if (!v) setDeleteTxnId(null);
        }}
        title="Delete transaction?"
        description="This transaction will be permanently removed."
        onConfirm={handleDeleteTransaction}
      />
      <ConfirmDialog
        open={!!deleteBudgetId}
        onOpenChange={(v) => {
          if (!v) setDeleteBudgetId(null);
        }}
        title="Delete budget?"
        description="This budget will be permanently removed."
        onConfirm={handleDeleteBudget}
      />
      <ConfirmDialog
        open={!!deleteDebtId}
        onOpenChange={(v) => {
          if (!v) setDeleteDebtId(null);
        }}
        title="Delete debt?"
        description="This debt record will be permanently removed."
        onConfirm={handleDeleteDebt}
      />
      <ConfirmDialog
        open={!!markPaidDebtId}
        onOpenChange={(v) => {
          if (!v) setMarkPaidDebtId(null);
        }}
        title="Mark as paid?"
        description="This debt will be marked as settled and removed from your outstanding list."
        confirmLabel="Mark paid"
        destructive={false}
        onConfirm={handleMarkPaid}
      />
      <ConfirmDialog
        open={!!deleteCatId}
        onOpenChange={(v) => {
          if (!v) setDeleteCatId(null);
        }}
        title="Delete category?"
        description="This category will be removed. Existing transactions keep their current label."
        onConfirm={handleCategoryDelete}
      />
      <ConfirmDialog
        open={!!deactivateWalletId}
        onOpenChange={(v) => {
          if (!v) setDeactivateWalletId(null);
        }}
        title="Deactivate wallet?"
        description="This wallet will be hidden from dropdowns. Existing transactions are preserved."
        confirmLabel="Deactivate"
        onConfirm={async () => {
          if (deactivateWalletId) {
            await setActiveStatus(deactivateWalletId, false);
            setDeactivateWalletId(null);
            toast.success("Wallet deactivated");
          }
        }}
      />
    </div>
  );
}

// ─── Budget Form ──────────────────────────────────────────────────────────────

function BudgetForm({
  open,
  onOpenChange,
  initial,
  onSaved,
  expenseCategories,
  createCategory,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Budget | null;
  onSaved: () => void;
  expenseCategories: Category[];
  createCategory: (
    name: string,
    type: "income" | "expense"
  ) => Promise<Category | null>;
}) {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<Budget["period"]>("monthly");
  const [saving, setSaving] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);

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
    setShowNewCat(false);
    setNewCatName("");
  }, [initial, open]);

  async function handleBudgetCreateCategory() {
    if (!newCatName.trim() || creatingCat) return;
    setCreatingCat(true);
    try {
      const created = await createCategory(newCatName.trim(), "expense");
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
    if (!category || !amount) return;
    setSaving(true);
    const supabase = createClient();

    const today = new Date();
    const periodStart = format(startOfMonth(today), "yyyy-MM-dd");
    const periodEnd = format(endOfMonth(today), "yyyy-MM-dd");

    if (initial) {
      await supabase
        .from("budgets")
        .update({ category, amount: parseFloat(amount), period })
        .eq("id", initial.id);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
            <Select
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
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    expenseCategories.length === 0
                      ? "No categories yet"
                      : "Select category"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">+ New category…</SelectItem>
              </SelectContent>
            </Select>
            {showNewCat && (
              <div className="flex gap-2">
                <Input
                  placeholder="Category name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBudgetCreateCategory();
                    }
                  }}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={creatingCat || !newCatName.trim()}
                  onClick={handleBudgetCreateCategory}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label>Period</Label>
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as Budget["period"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
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
              {saving ? "Saving…" : initial ? "Update" : "Add Budget"}
            </Button>
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
      await supabase
        .from("debts")
        .update({
          creditor: creditor.trim(),
          type,
          amount: parseFloat(amount),
          description: description || null,
          due_date: dueDate || null,
        })
        .eq("id", initial.id);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
            <Button
              type="button"
              variant={type === "i_owe" ? "default" : "outline"}
              onClick={() => setType("i_owe")}
            >
              I owe
            </Button>
            <Button
              type="button"
              variant={type === "they_owe" ? "default" : "outline"}
              onClick={() => setType("they_owe")}
            >
              They owe
            </Button>
          </div>
          <div className="space-y-2">
            <Label>{type === "i_owe" ? "Creditor / Lender" : "Debtor name"}</Label>
            <Input
              placeholder="Name or institution"
              value={creditor}
              onChange={(e) => setCreditor(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Reason or details"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
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
              {saving ? "Saving…" : initial ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
