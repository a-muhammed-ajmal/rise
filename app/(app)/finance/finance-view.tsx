"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/supabase/current-user";
import type { Transaction, Budget, Debt, PaymentMethod, Category } from "@/lib/types/database";
import { loadFinanceData, type FinanceData } from "@/lib/data/finance";
import { isFreshSnapshot, type ServerSnapshot } from "@/lib/data/snapshot";
import { useCategories } from "@/lib/hooks/use-categories";
import { formatAEDWrappable, todayISO } from "@/lib/format";
import { usePaymentMethods } from "@/lib/hooks/use-payment-methods";
import { TransactionForm } from "./transaction-form";
import { AddEntryDialog, isEntryKind, type EntryKind } from "./add-entry-dialog";
import { WalletForm } from "./wallet-form";
import { AdjustBalanceForm } from "./adjust-balance-form";
import { WalletCard } from "./wallet-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PageShell } from "@/components/layout/page-shell";
import {
  MoneyViewList,
  isMoneyView,
  type MoneyView,
  type ViewAlert,
} from "@/components/finance/finance-navigation";
import { NetWorthCard } from "@/components/finance/net-worth-card";
import { AttentionCard, MonthCard } from "@/components/finance/finance-home";
import { ActivityView } from "@/components/finance/activity-view";
import { BudgetsView } from "@/components/finance/budgets-view";
import { DebtsView } from "@/components/finance/debts-view";
import { BudgetSettingsDialog, type BudgetHint } from "@/components/finance/budget-settings-dialog";
import {
  averageMonthlySpend,
  budgetLines,
  budgetSettingRows,
  standingBudgets,
  summarizeBudgets,
  unbudgetedSpend,
  type BudgetChanges,
} from "@/lib/finance/budgets";
import { normalizeLabel } from "@/lib/finance/categories";
import { saveBudgetChanges } from "@/lib/data/budgets";
import { summarizeNetWorth } from "@/lib/finance/net-worth";
import { monthBounds, summarizeMonth } from "@/lib/finance/month";
import { needsAttention } from "@/lib/finance/attention";
import { isOpenDebt, sortByDueDate } from "@/lib/finance/debts";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChevronLeft, Loader2, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  format,
  addMonths,
  subMonths,
} from "date-fns";
import { toast } from "sonner";

const FINANCE_TABS_ID = "finance-views";

// One snapshot per source, so a partial server failure only refetches the part
// that failed. Each is a stable prop reference for the life of the view.
export type FinanceInitial = {
  finance: ServerSnapshot<FinanceData> | null;
  paymentMethods: ServerSnapshot<PaymentMethod[]> | null;
  categories: ServerSnapshot<Category[]> | null;
};

export function FinanceView({ initial }: { initial: FinanceInitial }) {
  const [moneyView, setMoneyView] = useState<MoneyView>("activity");
  const [showCategories, setShowCategories] = useState(false);

  const [allTransactions, setAllTransactions] = useState<Transaction[]>(
    initial.finance?.data.transactions ?? [],
  );
  const [budgets, setBudgets] = useState<Budget[]>(initial.finance?.data.budgets ?? []);
  const [debts, setDebts] = useState<Debt[]>(initial.finance?.data.debts ?? []);
  const [loading, setLoading] = useState(!initial.finance);

  // Monthly view state
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Add dialog — Expense | Income | Transfer | Debt
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryKind, setEntryKind] = useState<EntryKind>("expense");

  // Edit transaction dialog
  const [txnOpen, setTxnOpen] = useState(false);
  const [txnType, setTxnType] = useState<"income" | "expense">("expense");
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null);

  // Wallet dialogs
  const [walletFormOpen, setWalletFormOpen] = useState(false);
  const [editWallet, setEditWallet] = useState<PaymentMethod | null>(null);
  const [adjustWallet, setAdjustWallet] = useState<PaymentMethod | null>(null);
  const [deactivateWalletId, setDeactivateWalletId] = useState<string | null>(null);

  // Budget dialogs
  // Budget settings: open, and which category's box gets focus
  const [budgetSettings, setBudgetSettings] = useState<{ focus?: string } | null>(null);
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
  } = useCategories(initial.categories);


  // Quick-add intent: ?add=transfer (the dashboard tile) or any other entry
  // kind opens the Add dialog on that tab.
  useEffect(() => {
    const url = new URL(window.location.href);
    const add = url.searchParams.get("add");
    if (isEntryKind(add)) {
      setEntryKind(add);
      setEntryOpen(true);
      url.searchParams.delete("add");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

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
  } = usePaymentMethods(initial.paymentMethods);

  const fetchData = useCallback(async () => {
    try {
      const data = await loadFinanceData(createClient());
      setAllTransactions(data.transactions);
      setBudgets(data.budgets);
      setDebts(data.debts);
    } catch (error) {
      console.error("[finance] fetch failed:", error);
      toast.error("Could not load all finance data. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // The server snapshot covers the first paint; refetch only when it is stale
  // (a Router Cache revisit) or missing (the server load failed).
  useEffect(() => {
    if (!isFreshSnapshot(initial.finance)) fetchData();
  }, [fetchData, initial.finance]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const today = todayISO();
  const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
  const monthLabel = format(selectedMonth, "MMMM yyyy");

  // Money in / out for the month on screen (transfers and adjustments excluded).
  const month = useMemo(
    () => summarizeMonth(allTransactions, monthStart, monthEnd),
    [allTransactions, monthStart, monthEnd]
  );

  // Budgets are settings: one standing limit per category, set once and
  // repeated every month (lib/finance/budgets.ts).
  const standing = useMemo(() => standingBudgets(budgets), [budgets]);
  const lines = useMemo(() => budgetLines(standing, allTransactions, monthStart), [standing, allTransactions, monthStart]);
  const current = monthBounds(today);
  const budgetSummary = useMemo(
    () => summarizeBudgets(lines, monthEnd, today, monthStart === current.start),
    [lines, monthEnd, today, monthStart, current.start]
  );
  const unbudgeted = useMemo(
    () => unbudgetedSpend(allTransactions, standing, monthStart, monthEnd),
    [allTransactions, standing, monthStart, monthEnd]
  );

  // "Needs attention" always looks at the current period, whatever is on screen.
  const spentThisMonth = useMemo(
    () => Object.fromEntries(budgetLines(standing, allTransactions, today).map((l) => [l.category, l.spent])),
    [standing, allTransactions, today]
  );

  const openDebts = useMemo(() => sortByDueDate(debts.filter(isOpenDebt)), [debts]);
  const settledDebts = useMemo(
    () =>
      debts
        .filter((d) => !!d.paid_at)
        .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? "")),
    [debts]
  );

  const attention = useMemo(
    () => needsAttention({ debts: openDebts, budgets: standing, spent: spentThisMonth, today }),
    [openDebts, standing, spentThisMonth, today]
  );

  // A dot on the Budgets / Debts tab when something there needs a look — red
  // wins over amber.
  const viewAlerts = useMemo(() => {
    const alerts: Partial<Record<MoneyView, ViewAlert>> = {};
    for (const item of attention) {
      if (alerts[item.target] !== "danger") alerts[item.target] = item.level;
    }
    return alerts;
  }, [attention]);

  // Wallets, in the order the user arranged them.
  const sortedWallets = useMemo(
    () => [...paymentMethods].sort((a, b) => a.display_order - b.display_order),
    [paymentMethods]
  );
  const activeWallets = sortedWallets.filter((m) => m.is_active);
  const totalWalletBalance = activeWallets.reduce((s, m) => s + m.balance, 0);

  // Net worth = wallets + money owed to you − money you owe (open debts only).
  const netWorth = summarizeNetWorth(totalWalletBalance, openDebts);

  // Wallet name lookup for activity rows
  const walletNameById = useMemo(() => {
    const map: Record<string, string> = {};
    paymentMethods.forEach((m) => {
      map[m.id] = m.name;
    });
    return map;
  }, [paymentMethods]);

  /** Switch to a view and bring the tabs into sight. */
  function openView(view: MoneyView) {
    setMoneyView(view);
    setShowCategories(false);
    const tabs = document.getElementById(FINANCE_TABS_ID);
    if (!tabs) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    tabs.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function openEntry(kind: EntryKind) {
    setEntryKind(kind);
    setEntryOpen(true);
  }

  async function refreshAll() {
    await Promise.all([fetchData(), refreshWallets()]);
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleSaveBudgets(changes: BudgetChanges) {
    const userId = await currentUserId();
    if (!userId) {
      toast.error("Your session expired. Please sign in again.");
      throw new Error("No session");
    }
    try {
      // New budgets record this month (Dubai) as when they were set.
      await saveBudgetChanges(createClient(), {
        userId,
        changes,
        periodStart: current.start,
        periodEnd: current.end,
      });
      toast.success("Budgets saved");
    } catch (error) {
      console.error("[finance] budget save failed:", error instanceof Error ? error.message : error);
      toast.error("Could not save the budgets. Please try again.");
      throw error;
    } finally {
      await fetchData();
    }
  }

  async function handleDeleteTransaction() {
    if (!deleteTxnId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteTxnId)
      .is("deleted_at", null);
    if (error) {
      console.error("[finance] transaction soft delete failed:", error.message);
      toast.error("Could not delete the transaction. Please try again.");
      return;
    }
    setDeleteTxnId(null);
    toast.success("Transaction moved to the recycle bin");
    await refreshAll();
  }

  async function handleDeleteBudget() {
    if (!deleteBudgetId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("budgets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteBudgetId)
      .is("deleted_at", null);
    if (error) {
      console.error("[finance] budget soft delete failed:", error.message);
      toast.error("Could not delete the budget. Please try again.");
      return;
    }
    setDeleteBudgetId(null);
    toast.success("Budget moved to the recycle bin");
    await fetchData();
  }

  async function handleDeleteDebt() {
    if (!deleteDebtId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("debts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteDebtId)
      .is("deleted_at", null);
    if (error) {
      console.error("[finance] debt soft delete failed:", error.message);
      toast.error("Could not delete the debt. Please try again.");
      return;
    }
    setDeleteDebtId(null);
    toast.success("Debt moved to the recycle bin");
    await fetchData();
  }

  async function handleMarkPaid() {
    if (!markPaidDebtId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("debts")
      .update({ paid_at: new Date().toISOString() })
      .eq("id", markPaidDebtId);
    if (error) {
      console.error("[finance] mark paid failed:", error.message);
      toast.error("Could not mark this debt as paid. Please try again.");
      return;
    }
    setMarkPaidDebtId(null);
    toast.success("Marked as paid");
    await fetchData();
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
    const idx = sortedWallets.findIndex((m) => m.id === id);
    if (direction === "up" && idx > 0) {
      const swapped = [...sortedWallets];
      [swapped[idx - 1], swapped[idx]] = [swapped[idx], swapped[idx - 1]];
      reorderPaymentMethods(swapped.map((m) => m.id));
    } else if (direction === "down" && idx < sortedWallets.length - 1) {
      const swapped = [...sortedWallets];
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

  return (
    <PageShell>
      <h1 className="sr-only">Financial</h1>

      <div className="animate-rise-in stagger-1 min-w-0">
        <NetWorthCard
          summary={netWorth}
          wallets={activeWallets}
          onViewDebts={() => openView("debts")}
        />
      </div>

      <Tabs
        id={FINANCE_TABS_ID}
        value={moneyView}
        onValueChange={(value) => {
          if (isMoneyView(value)) {
            setMoneyView(value);
            setShowCategories(false);
          }
        }}
        className="slide-up stagger-2 scroll-mt-20 gap-4"
      >
        <MoneyViewList alerts={viewAlerts} />

        <TabsContent value="activity" className="slide-up stagger-1 space-y-4">
          <div className="grid min-w-0 items-start gap-4 md:grid-cols-2">
            <MonthCard
              monthLabel={monthLabel}
              summary={month}
              onPrevMonth={() => setSelectedMonth((m) => subMonths(m, 1))}
              onNextMonth={() => setSelectedMonth((m) => addMonths(m, 1))}
            />
            {attention.length > 0 && <AttentionCard items={attention} onOpen={openView} />}
          </div>
          <ActivityView
            transactions={allTransactions}
            walletNameById={walletNameById}
            today={today}
            onAddExpense={() => openEntry("expense")}
            onAddIncome={() => openEntry("income")}
            onTransfer={() => openEntry("transfer")}
            onEdit={(txn) => {
              setEditTxn(txn);
              setTxnType(txn.type === "income" ? "income" : "expense");
              setTxnOpen(true);
            }}
            onDelete={setDeleteTxnId}
          />
        </TabsContent>

        <TabsContent value="wallets" className="slide-up stagger-1 space-y-4">
          <section
            aria-label="Total balance"
            className="finance-card flex flex-wrap items-end justify-between gap-3 p-3 md:p-4"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="size-4 shrink-0 text-mod-finance" aria-hidden="true" />
                Total balance
              </p>
              <p className={`mt-1.5 text-lg font-semibold tabular-nums break-words ${totalWalletBalance < 0 ? "text-[var(--color-danger)]" : ""}`}>
                {formatAEDWrappable(totalWalletBalance)}
              </p>
              <p className="mt-0.5 text-label text-muted-foreground">
                {activeWallets.length === 1 ? "1 active wallet" : `${activeWallets.length} active wallets`}
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setEditWallet(null);
                setWalletFormOpen(true);
              }}
            >
              <Plus aria-hidden="true" /> Add wallet
            </Button>
          </section>

          {sortedWallets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
              <p className="text-sm font-medium">No wallets yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Add a bank account, card or cash wallet to track its balance.</p>
            </div>
          ) : (
            <ul aria-label="Wallets" className="finance-card divide-y divide-border overflow-hidden">
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
            </ul>
          )}
        </TabsContent>

        <TabsContent value="budgets" className="slide-up stagger-1">
          {showCategories ? (
            <div className="space-y-4">
              <Button variant="ghost" className="-ml-3 gap-1" onClick={() => setShowCategories(false)}>
                <ChevronLeft aria-hidden="true" /> Budgets
              </Button>
              <h2 className="text-h2 font-semibold">Categories</h2>
              <div className="space-y-4">
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
                              className="min-h-11 text-xs gap-1"
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
                                className="h-11 text-sm flex-1"
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
                                className="min-h-11 text-xs shrink-0"
                                disabled={!editCatName.trim()}
                                onClick={handleCategoryUpdate}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="min-h-11 text-xs shrink-0"
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
                                className="h-11 w-11 inline-flex shrink-0 items-center justify-center rounded-md hover:bg-accent active:bg-accent text-muted-foreground"
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
                                className="h-11 w-11 inline-flex shrink-0 items-center justify-center rounded-md hover:bg-accent active:bg-accent text-destructive"
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
                              className="h-11 text-sm flex-1"
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
                              className="min-h-11 text-xs shrink-0"
                              disabled={!addCatName.trim()}
                              onClick={() => handleCategoryAdd(catType)}
                            >
                              Add
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="min-h-11 text-xs shrink-0"
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
            </div>
          ) : (
            <BudgetsView
              monthLabel={monthLabel}
              lines={lines}
              summary={budgetSummary}
              unbudgeted={unbudgeted}
              onPrevMonth={() => setSelectedMonth((m) => subMonths(m, 1))}
              onNextMonth={() => setSelectedMonth((m) => addMonths(m, 1))}
              onSettings={(focus) => setBudgetSettings({ focus })}
              onDelete={setDeleteBudgetId}
              onCategories={() => setShowCategories(true)}
            />
          )}
        </TabsContent>

        <TabsContent value="debts" className="slide-up stagger-1">
          <DebtsView
            openDebts={openDebts}
            settledDebts={settledDebts}
            owedToYou={netWorth.owedToYou}
            youOwe={netWorth.youOwe}
            owedToYouCount={netWorth.owedToYouCount}
            youOweCount={netWorth.youOweCount}
            today={today}
            onAdd={() => {
              setEditDebt(null);
              setDebtOpen(true);
            }}
            onMarkPaid={setMarkPaidDebtId}
            onEdit={(debt) => {
              setEditDebt(debt);
              setDebtOpen(true);
            }}
            onDelete={setDeleteDebtId}
          />
        </TabsContent>
      </Tabs>

      {/* Add button — Expense | Income | Transfer | Debt, expense first */}
      <button
        type="button"
        onClick={() => openEntry("expense")}
        className="finance-fab fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95 md:bottom-6 md:right-6"
        aria-label="Add expense, income, transfer or debt"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Dialogs */}
      <AddEntryDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        kind={entryKind}
        onKindChange={setEntryKind}
        paymentMethods={paymentMethods}
        findOrCreateByName={findOrCreateByName}
        categories={categories}
        createCategory={createCategory}
        openDebts={openDebts}
        onTransactionSaved={async () => {
          await refreshAll();
          toast.success("Transaction saved");
        }}
        onSaved={refreshAll}
      />

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
          await refreshAll();
          toast.success(editTxn ? "Transaction updated" : "Transaction saved");
        }}
      />

      {budgetSettings && (
        <BudgetSettingsDialog
          open
          onOpenChange={(open) => {
            if (!open) setBudgetSettings(null);
          }}
          rows={budgetSettingRows(categories, budgets)}
          hints={budgetHints(allTransactions, current.start, current.end, today)}
          monthName={format(new Date(`${today}T12:00:00`), "MMMM")}
          focusCategory={budgetSettings.focus}
          onSave={handleSaveBudgets}
        />
      )}

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
        description="This transaction will move to the recycle bin and can be restored. Its wallet balance will be adjusted."
        onConfirm={handleDeleteTransaction}
      />
      <ConfirmDialog
        open={!!deleteBudgetId}
        onOpenChange={(v) => {
          if (!v) setDeleteBudgetId(null);
        }}
        title="Delete budget?"
        description="This budget will move to the recycle bin and can be restored."
        onConfirm={handleDeleteBudget}
      />
      <ConfirmDialog
        open={!!deleteDebtId}
        onOpenChange={(v) => {
          if (!v) setDeleteDebtId(null);
        }}
        title="Delete debt?"
        description="This debt record will move to the recycle bin and can be restored."
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
    </PageShell>
  );
}

// ─── Budget settings hints ────────────────────────────────────────────────────

/** This month's spending and the monthly average, per category (normalised name). */
function budgetHints(
  transactions: readonly Transaction[],
  monthStart: string,
  monthEnd: string,
  today: string
): Record<string, BudgetHint> {
  const averages = averageMonthlySpend(transactions, today);
  const hints: Record<string, BudgetHint> = {};
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const key = normalizeLabel(t.category);
    const hint = hints[key] ?? { thisMonth: 0, average: averages[key] ?? 0 };
    if (t.date >= monthStart && t.date <= monthEnd) hint.thisMonth = Math.round((hint.thisMonth + t.amount) * 100) / 100;
    hints[key] = hint;
  }
  return hints;
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

    let errorMessage: string | null = null;
    if (initial) {
      const { error } = await supabase
        .from("debts")
        .update({
          creditor: creditor.trim(),
          type,
          amount: parseFloat(amount),
          description: description || null,
          due_date: dueDate || null,
        })
        .eq("id", initial.id);
      errorMessage = error?.message ?? null;
    } else {
      const userId = await currentUserId();
      if (!userId) {
        setSaving(false);
        toast.error("Your session expired. Please sign in again.");
        return;
      }
      const { error } = await supabase.from("debts").insert({
        user_id: userId,
        creditor: creditor.trim(),
        type,
        amount: parseFloat(amount),
        description: description || null,
        due_date: dueDate || null,
      });
      errorMessage = error?.message ?? null;
    }
    if (errorMessage) {
      console.error("[finance] debt save failed:", errorMessage);
      toast.error("Could not save the debt. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
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
