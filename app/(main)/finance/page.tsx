'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firestore';
import {
  Transaction, TransactionType, TransactionStatus,
  Budget, Debt, DebtStatus, ExpenseType, PaymentMethod,
  INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS,
} from '@/lib/types';
import dynamic from 'next/dynamic';
const Modal = dynamic(() => import('@/components/ui/Modal'), { ssr: false });
import Button from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { cn, formatCurrency } from '@/lib/utils';
import {
  Plus, TrendingUp, TrendingDown, Trash2,
  Edit3, PiggyBank, CreditCard, AlertTriangle,
  DollarSign, Percent, ChevronLeft, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';

export default function FinancePage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: transactions } = useCollection<Transaction>('transactions', uid);
  const { data: budgets } = useCollection<Budget>('budgets', uid);
  const { data: debts } = useCollection<Debt>('debts', uid);

  // Month selector
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const monthKey = format(selectedMonth, 'yyyy-MM');
  const monthLabel = format(selectedMonth, 'MMMM yyyy');

  // ── Modal states ──
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // ── Editing states ──
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);

  // ── Income form ──
  const [incSource, setIncSource] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incDate, setIncDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [incCategory, setIncCategory] = useState<string>(INCOME_CATEGORIES[0]);
  const [incStatus, setIncStatus] = useState<TransactionStatus>('Pending');
  const [incNotes, setIncNotes] = useState('');

  // ── Expense form ──
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expCategory, setExpCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [expType, setExpType] = useState<ExpenseType>('Mandatory');
  const [expPayment, setExpPayment] = useState<PaymentMethod | ''>('');
  const [expNotes, setExpNotes] = useState('');

  // ── Debt form ──
  const [debtName, setDebtName] = useState('');
  const [debtTotal, setDebtTotal] = useState('');
  const [debtRemaining, setDebtRemaining] = useState('');
  const [debtMonthly, setDebtMonthly] = useState('');
  const [debtRate, setDebtRate] = useState('');
  const [debtDueDay, setDebtDueDay] = useState('');
  const [debtPayoffDate, setDebtPayoffDate] = useState('');
  const [debtNotes, setDebtNotes] = useState('');

  // ── Budget form ──
  const [budgetCategory, setBudgetCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetMonthYear, setBudgetMonthYear] = useState(format(new Date(), 'yyyy-MM'));

  // ── Payment form ──
  const [paymentAmount, setPaymentAmount] = useState('');

  // ── Delete confirmation ──
  const [deleteConfirm, setDeleteConfirm] = useState<{ collection: string; id: string; label: string } | null>(null);

  // ── Computed values ──
  const monthTxns = transactions.filter(t => t.date?.startsWith(monthKey));
  const incomes = monthTxns.filter(t => t.type === 'Income').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const expenses = monthTxns.filter(t => t.type === 'Expense').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const totalIncome = incomes.filter(t => t.status === 'Received').reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const netCashFlow = totalIncome - totalExpense;

  const activeDebts = debts.filter(d => d.status !== 'Paid Off');
  const paidOffDebts = debts.filter(d => d.status === 'Paid Off');

  const spendingByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [expenses]);

  // ── Income handlers ──
  const resetIncomeForm = () => {
    setIncSource(''); setIncAmount(''); setIncDate(format(new Date(), 'yyyy-MM-dd'));
    setIncCategory(INCOME_CATEGORIES[0]); setIncStatus('Pending'); setIncNotes(''); setEditingTxn(null);
  };
  const openAddIncome = () => { resetIncomeForm(); setIncomeModalOpen(true); };
  const openEditIncome = (t: Transaction) => {
    setEditingTxn(t); setIncSource(t.source || t.description || ''); setIncAmount(t.amount.toString());
    setIncDate(t.date); setIncCategory(t.category); setIncStatus(t.status || 'Pending');
    setIncNotes(t.notes || ''); setIncomeModalOpen(true);
  };
  const handleSaveIncome = async () => {
    if (!user) return;
    const amt = parseFloat(incAmount);
    if (isNaN(amt) || amt <= 0) return;
    const payload: Partial<Transaction> = {
      type: 'Income', amount: amt, source: incSource, description: incSource,
      category: incCategory, date: incDate, status: incStatus, notes: incNotes,
    };
    if (editingTxn) await updateDocument('transactions', editingTxn.id, payload);
    else await addDocument('transactions', payload, user.uid);
    resetIncomeForm(); setIncomeModalOpen(false);
  };

  // ── Expense handlers ──
  const resetExpenseForm = () => {
    setExpDesc(''); setExpAmount(''); setExpDate(format(new Date(), 'yyyy-MM-dd'));
    setExpCategory(EXPENSE_CATEGORIES[0]); setExpType('Mandatory'); setExpPayment('');
    setExpNotes(''); setEditingTxn(null);
  };
  const openAddExpense = () => { resetExpenseForm(); setExpenseModalOpen(true); };
  const openEditExpense = (t: Transaction) => {
    setEditingTxn(t); setExpDesc(t.description || ''); setExpAmount(t.amount.toString());
    setExpDate(t.date); setExpCategory(t.category); setExpType((t.expenseType as ExpenseType) || 'Mandatory');
    setExpPayment((t.paymentMethod as PaymentMethod) || ''); setExpNotes(t.notes || '');
    setExpenseModalOpen(true);
  };
  const handleSaveExpense = async () => {
    if (!user) return;
    const amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) return;
    const payload: Partial<Transaction> = {
      type: 'Expense', amount: amt, description: expDesc, category: expCategory,
      date: expDate, expenseType: expType, paymentMethod: expPayment || undefined, notes: expNotes,
    };
    if (editingTxn) await updateDocument('transactions', editingTxn.id, payload);
    else await addDocument('transactions', payload, user.uid);
    resetExpenseForm(); setExpenseModalOpen(false);
  };

  // ── Debt handlers ──
  const resetDebtForm = () => {
    setDebtName(''); setDebtTotal(''); setDebtRemaining(''); setDebtMonthly('');
    setDebtRate(''); setDebtDueDay(''); setDebtPayoffDate(''); setDebtNotes(''); setEditingDebt(null);
  };
  const openAddDebt = () => { resetDebtForm(); setDebtModalOpen(true); };
  const openEditDebt = (d: Debt) => {
    setEditingDebt(d); setDebtName(d.name); setDebtTotal(d.totalAmount.toString());
    setDebtRemaining(d.remainingBalance.toString()); setDebtMonthly(d.monthlyPayment?.toString() || '');
    setDebtRate(d.interestRate?.toString() || ''); setDebtDueDay(d.dueDay?.toString() || '');
    setDebtPayoffDate(d.targetPayoffDate || ''); setDebtNotes(d.notes || ''); setDebtModalOpen(true);
  };
  const handleSaveDebt = async () => {
    if (!user) return;
    const total = parseFloat(debtTotal), remaining = parseFloat(debtRemaining);
    if (isNaN(total) || total <= 0 || isNaN(remaining) || remaining < 0) return;
    const payload: Partial<Debt> = {
      name: debtName, totalAmount: total, remainingBalance: remaining, status: 'Active' as DebtStatus,
      monthlyPayment: debtMonthly ? parseFloat(debtMonthly) : undefined,
      interestRate: debtRate ? parseFloat(debtRate) : undefined,
      dueDay: debtDueDay ? parseInt(debtDueDay) : undefined,
      targetPayoffDate: debtPayoffDate || undefined, notes: debtNotes || undefined,
    };
    if (editingDebt) await updateDocument('debts', editingDebt.id, payload);
    else await addDocument('debts', payload, user.uid);
    resetDebtForm(); setDebtModalOpen(false);
  };

  // ── Log Payment ──
  const openPaymentModal = (d: Debt) => { setPaymentDebt(d); setPaymentAmount(d.monthlyPayment?.toString() || ''); setPaymentModalOpen(true); };
  const handleLogPayment = async () => {
    if (!paymentDebt) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;
    const newBalance = Math.max(0, paymentDebt.remainingBalance - amt);
    await updateDocument('debts', paymentDebt.id, {
      remainingBalance: newBalance,
      status: newBalance === 0 ? 'Paid Off' : 'Active',
    });
    setPaymentModalOpen(false); setPaymentDebt(null);
  };

  const markDebtPaidOff = async (d: Debt) => {
    await updateDocument('debts', d.id, { remainingBalance: 0, status: 'Paid Off' as DebtStatus });
  };

  // ── Budget handlers ──
  const resetBudgetForm = () => {
    setBudgetCategory(EXPENSE_CATEGORIES[0]); setBudgetLimit('');
    setBudgetMonthYear(format(new Date(), 'yyyy-MM')); setEditingBudget(null);
  };
  const openAddBudget = () => { resetBudgetForm(); setBudgetModalOpen(true); };
  const openEditBudget = (b: Budget) => {
    setEditingBudget(b); setBudgetCategory(b.category); setBudgetLimit(b.monthlyLimit.toString());
    setBudgetMonthYear(b.monthYear || format(new Date(), 'yyyy-MM')); setBudgetModalOpen(true);
  };
  const handleSaveBudget = async () => {
    if (!user) return;
    const limit = parseFloat(budgetLimit);
    if (isNaN(limit) || limit <= 0) return;
    const payload: Partial<Budget> = { category: budgetCategory, monthlyLimit: limit, monthYear: budgetMonthYear };
    if (editingBudget) await updateDocument('budgets', editingBudget.id, payload);
    else await addDocument('budgets', payload, user.uid);
    resetBudgetForm(); setBudgetModalOpen(false);
  };

  // ── Delete ──
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    await deleteDocument(deleteConfirm.collection, deleteConfirm.id);
    setDeleteConfirm(null);
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <h1 className="text-lg font-semibold text-text">Finance</h1>

      {/* ────── FINANCIAL SUMMARY (KPI Cards) ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface-2 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10B98120' }}>
              <TrendingUp size={16} style={{ color: '#10B981' }} />
            </div>
            <span className="text-xs text-text-3">Total Income</span>
          </div>
          <p className="text-lg font-semibold" style={{ color: '#10B981' }}>{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-surface-2 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EF444420' }}>
              <TrendingDown size={16} style={{ color: '#EF4444' }} />
            </div>
            <span className="text-xs text-text-3">Total Expenses</span>
          </div>
          <p className="text-lg font-semibold" style={{ color: '#EF4444' }}>{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-surface-2 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3B82F620' }}>
              <DollarSign size={16} style={{ color: '#3B82F6' }} />
            </div>
            <span className="text-xs text-text-3">Net Cash Flow</span>
          </div>
          <p className={cn('text-lg font-semibold', netCashFlow >= 0 ? 'text-[#3B82F6]' : 'text-red-500')}>
            {netCashFlow < 0 && '-'}{formatCurrency(Math.abs(netCashFlow))}
          </p>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => setSelectedMonth(m => subMonths(m, 1))} className="p-2 rounded-lg hover:bg-surface-2 text-text-3">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-text min-w-[140px] text-center">{monthLabel}</span>
        <button onClick={() => setSelectedMonth(m => addMonths(m, 1))} className="p-2 rounded-lg hover:bg-surface-2 text-text-3">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ────── INCOME TRACKER ────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text">Income ({monthLabel})</h2>
          <button onClick={openAddIncome} className="flex items-center gap-1.5 px-3 py-1.5 bg-rise text-[#0A0A0F] rounded-lg text-xs font-semibold">
            <Plus size={14} /> Add
          </button>
        </div>
        {incomes.length === 0 ? (
          <p className="text-sm text-text-3 text-center py-4">No income recorded this month</p>
        ) : (
          <div className="space-y-2">
            {incomes.map(t => (
              <div key={t.id} onClick={() => openEditIncome(t)}
                className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border cursor-pointer hover:border-[#10B98140] group">
                <div className="w-9 h-9 rounded-lg bg-green-900/30 flex items-center justify-center shrink-0">
                  <TrendingUp size={16} className="text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{t.source || t.description || t.category}</p>
                  <p className="text-xs text-text-3">{t.category} · {t.date}</p>
                </div>
                <Badge color={t.status === 'Received' ? '#22c55e' : '#f59e0b'}>{t.status || 'Pending'}</Badge>
                <p className="text-sm font-semibold text-green-500 shrink-0">+{formatCurrency(t.amount)}</p>
                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ collection: 'transactions', id: t.id, label: t.source || t.category }); }}
                  className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ────── EXPENSE TRACKER ────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text">Expenses ({monthLabel})</h2>
          <button onClick={openAddExpense} className="flex items-center gap-1.5 px-3 py-1.5 bg-rise text-[#0A0A0F] rounded-lg text-xs font-semibold">
            <Plus size={14} /> Add
          </button>
        </div>
        {expenses.length === 0 ? (
          <p className="text-sm text-text-3 text-center py-4">No expenses recorded this month</p>
        ) : (
          <div className="space-y-2">
            {expenses.map(t => (
              <div key={t.id} onClick={() => openEditExpense(t)}
                className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border cursor-pointer hover:border-[#EF444440] group">
                <div className="w-9 h-9 rounded-lg bg-red-900/30 flex items-center justify-center shrink-0">
                  <TrendingDown size={16} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{t.description || t.category}</p>
                  <p className="text-xs text-text-3">{t.category} · {t.date}</p>
                </div>
                <p className="text-sm font-semibold text-red-500 shrink-0">-{formatCurrency(t.amount)}</p>
                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ collection: 'transactions', id: t.id, label: t.description || t.category }); }}
                  className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ────── DEBT / CREDIT TRACKER ────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text">Debts & Credits</h2>
          <button onClick={openAddDebt} className="flex items-center gap-1.5 px-3 py-1.5 bg-rise text-[#0A0A0F] rounded-lg text-xs font-semibold">
            <Plus size={14} /> Add
          </button>
        </div>
        {activeDebts.length === 0 && paidOffDebts.length === 0 ? (
          <EmptyState icon={CreditCard} title="No debts" description="Track your debts and repayment progress" />
        ) : (
          <div className="space-y-3">
            {activeDebts.sort((a, b) => b.remainingBalance - a.remainingBalance).map(d => {
              const paidPct = d.totalAmount > 0 ? Math.min(((d.totalAmount - d.remainingBalance) / d.totalAmount) * 100, 100) : 0;
              return (
                <div key={d.id} className="p-4 bg-surface-2 rounded-xl border border-border group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-text-3" />
                      <p className="text-sm font-semibold text-text">{d.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text">{formatCurrency(d.remainingBalance)}</p>
                      <span className="text-xs text-text-3">/ {formatCurrency(d.totalAmount)}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full bg-rise transition-all" style={{ width: `${paidPct}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-text-3 mb-3">
                    <span>{paidPct.toFixed(0)}% paid</span>
                    {d.monthlyPayment && <span className="flex items-center gap-1"><DollarSign size={11} />{formatCurrency(d.monthlyPayment)}/mo</span>}
                    {d.interestRate != null && d.interestRate > 0 && <span className="flex items-center gap-1"><Percent size={11} />{d.interestRate}%</span>}
                    {d.dueDay && <span>Due day: {d.dueDay}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openPaymentModal(d)} className="flex-1 px-3 py-2 text-xs font-semibold bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20">
                      Log Payment
                    </button>
                    <button onClick={() => openEditDebt(d)} className="px-3 py-2 text-xs font-semibold bg-surface-3 text-text-2 rounded-lg hover:bg-surface-3/80">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => markDebtPaidOff(d)} className="px-3 py-2 text-xs font-semibold bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20">
                      <CheckCircle2 size={14} />
                    </button>
                    <button onClick={() => setDeleteConfirm({ collection: 'debts', id: d.id, label: d.name })}
                      className="px-3 py-2 text-xs text-text-3 hover:text-red-500 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {paidOffDebts.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-text-3 font-semibold mb-2 uppercase tracking-wide">Paid Off</p>
                {paidOffDebts.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border mb-2 opacity-60">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-green-500" />
                      <span className="text-sm text-text line-through">{d.name}</span>
                    </div>
                    <span className="text-sm text-text-3">{formatCurrency(d.totalAmount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ────── BUDGET PLANNER ────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text">Budget ({monthLabel})</h2>
          <button onClick={openAddBudget} className="flex items-center gap-1.5 px-3 py-1.5 bg-rise text-[#0A0A0F] rounded-lg text-xs font-semibold">
            <Plus size={14} /> Add Category
          </button>
        </div>
        {budgets.length === 0 ? (
          <EmptyState icon={PiggyBank} title="No budgets" description="Set monthly spending limits for each category" />
        ) : (
          <div className="space-y-3">
            {budgets.sort((a, b) => a.category.localeCompare(b.category)).map(b => {
              const spent = spendingByCategory[b.category] || 0;
              const remaining = b.monthlyLimit - spent;
              const pct = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
              const status = pct > 100 ? 'over' : pct >= 75 ? 'warning' : 'good';
              const barColor = status === 'over' ? '#EF4444' : status === 'warning' ? '#F59E0B' : '#10B981';
              return (
                <div key={b.id} onClick={() => openEditBudget(b)}
                  className="p-4 bg-surface-2 rounded-xl border border-border cursor-pointer hover:border-rise/30 group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PiggyBank size={16} className="text-text-3" />
                      <p className="text-sm font-semibold text-text">{b.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text">{formatCurrency(spent)} / {formatCurrency(b.monthlyLimit)}</p>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ collection: 'budgets', id: b.id, label: b.category }); }}
                        className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                  </div>
                  <div className="flex justify-between text-xs text-text-3">
                    <span>Remaining: {formatCurrency(Math.max(remaining, 0))}</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  {status === 'over' && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle size={12} className="text-red-500" />
                      <p className="text-xs text-red-500 font-medium">Over budget by {formatCurrency(spent - b.monthlyLimit)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ────── INCOME MODAL ────── */}
      <Modal open={incomeModalOpen} onClose={() => { setIncomeModalOpen(false); resetIncomeForm(); }}
        title={editingTxn ? 'Edit Income' : 'Add Income'} size="md">
        <div className="space-y-4">
          <Input label="Source" value={incSource} onChange={e => setIncSource(e.target.value)} placeholder="e.g. Monthly Salary" autoFocus />
          <Input label="Amount (AED)" type="number" value={incAmount} onChange={e => setIncAmount(e.target.value)} placeholder="0.00" />
          <Input label="Date" type="date" value={incDate} onChange={e => setIncDate(e.target.value)} />
          <Select label="Category" value={incCategory} onChange={e => setIncCategory(e.target.value)}
            options={INCOME_CATEGORIES.map(c => ({ value: c, label: c }))} />
          <Select label="Status" value={incStatus} onChange={e => setIncStatus(e.target.value as TransactionStatus)}
            options={[{ value: 'Received', label: 'Received' }, { value: 'Pending', label: 'Pending' }]} />
          <TextArea label="Notes" value={incNotes} onChange={e => setIncNotes(e.target.value)} placeholder="Optional notes..." />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setIncomeModalOpen(false); resetIncomeForm(); }} className="flex-1">Cancel</Button>
            <Button onClick={handleSaveIncome} disabled={!incAmount || isNaN(parseFloat(incAmount)) || parseFloat(incAmount) <= 0} className="flex-1">
              {editingTxn ? 'Save' : 'Add Income'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ────── EXPENSE MODAL ────── */}
      <Modal open={expenseModalOpen} onClose={() => { setExpenseModalOpen(false); resetExpenseForm(); }}
        title={editingTxn ? 'Edit Expense' : 'Add Expense'} size="md">
        <div className="space-y-4">
          <Input label="Description" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="What is this expense for?" autoFocus />
          <Input label="Amount (AED)" type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0.00" />
          <Input label="Date" type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
          <Select label="Category" value={expCategory} onChange={e => setExpCategory(e.target.value)}
            options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={expType} onChange={e => setExpType(e.target.value as ExpenseType)}
              options={[{ value: 'Mandatory', label: 'Mandatory' }, { value: 'Optional', label: 'Optional' }]} />
            <Select label="Payment Method" value={expPayment} onChange={e => setExpPayment(e.target.value as PaymentMethod)}
              options={[{ value: '', label: 'Select...' }, ...PAYMENT_METHODS.map(p => ({ value: p, label: p }))]} />
          </div>
          <TextArea label="Notes" value={expNotes} onChange={e => setExpNotes(e.target.value)} placeholder="Optional notes..." />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setExpenseModalOpen(false); resetExpenseForm(); }} className="flex-1">Cancel</Button>
            <Button onClick={handleSaveExpense} disabled={!expAmount || isNaN(parseFloat(expAmount)) || parseFloat(expAmount) <= 0} className="flex-1">
              {editingTxn ? 'Save' : 'Add Expense'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ────── DEBT MODAL ────── */}
      <Modal open={debtModalOpen} onClose={() => { setDebtModalOpen(false); resetDebtForm(); }}
        title={editingDebt ? 'Edit Debt' : 'Add Debt'} size="md">
        <div className="space-y-4">
          <Input label="Debt Name" value={debtName} onChange={e => setDebtName(e.target.value)} placeholder="e.g. Car Loan" autoFocus />
          <Input label="Total Amount (AED)" type="number" value={debtTotal} onChange={e => setDebtTotal(e.target.value)} placeholder="0.00" />
          <Input label="Remaining Balance (AED)" type="number" value={debtRemaining} onChange={e => setDebtRemaining(e.target.value)} placeholder="0.00" />
          <Input label="Monthly Payment (AED)" type="number" value={debtMonthly} onChange={e => setDebtMonthly(e.target.value)} placeholder="Optional" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Interest Rate (%)" type="number" value={debtRate} onChange={e => setDebtRate(e.target.value)} placeholder="Optional" />
            <Input label="Due Day of Month" type="number" value={debtDueDay} onChange={e => setDebtDueDay(e.target.value)} placeholder="1-31" />
          </div>
          <Input label="Target Payoff Date" type="date" value={debtPayoffDate} onChange={e => setDebtPayoffDate(e.target.value)} />
          <TextArea label="Notes" value={debtNotes} onChange={e => setDebtNotes(e.target.value)} placeholder="Additional notes..." />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setDebtModalOpen(false); resetDebtForm(); }} className="flex-1">Cancel</Button>
            <Button onClick={handleSaveDebt}
              disabled={!debtName || !debtTotal || isNaN(parseFloat(debtTotal)) || parseFloat(debtTotal) <= 0 || !debtRemaining || isNaN(parseFloat(debtRemaining))}
              className="flex-1">{editingDebt ? 'Save' : 'Add Debt'}</Button>
          </div>
        </div>
      </Modal>

      {/* ────── PAYMENT MODAL ────── */}
      <Modal open={paymentModalOpen} onClose={() => { setPaymentModalOpen(false); setPaymentDebt(null); }}
        title={`Log Payment — ${paymentDebt?.name || ''}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-text-3">Remaining: {formatCurrency(paymentDebt?.remainingBalance || 0)}</p>
          <Input label="Payment Amount (AED)" type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" autoFocus />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setPaymentModalOpen(false); setPaymentDebt(null); }} className="flex-1">Cancel</Button>
            <Button onClick={handleLogPayment} disabled={!paymentAmount || isNaN(parseFloat(paymentAmount)) || parseFloat(paymentAmount) <= 0} className="flex-1">
              Log Payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* ────── BUDGET MODAL ────── */}
      <Modal open={budgetModalOpen} onClose={() => { setBudgetModalOpen(false); resetBudgetForm(); }}
        title={editingBudget ? 'Edit Budget' : 'Add Budget Category'} size="md">
        <div className="space-y-4">
          <Select label="Category" value={budgetCategory} onChange={e => setBudgetCategory(e.target.value)}
            options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))} />
          <Input label="Monthly Limit (AED)" type="number" value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)} placeholder="0.00" />
          <Input label="Month" type="month" value={budgetMonthYear} onChange={e => setBudgetMonthYear(e.target.value)} />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setBudgetModalOpen(false); resetBudgetForm(); }} className="flex-1">Cancel</Button>
            <Button onClick={handleSaveBudget} disabled={!budgetLimit || isNaN(parseFloat(budgetLimit)) || parseFloat(budgetLimit) <= 0} className="flex-1">
              {editingBudget ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ────── DELETE CONFIRMATION ────── */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-900/20 rounded-xl border border-red-800/30">
            <AlertTriangle size={20} className="text-red-500 shrink-0" />
            <p className="text-sm text-text">
              Delete <span className="font-semibold">{deleteConfirm?.label}</span>? This cannot be undone.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)} className="flex-1">Cancel</Button>
            <Button onClick={confirmDelete} className="flex-1 !bg-red-500 hover:!bg-red-600">Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
