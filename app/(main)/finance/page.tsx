'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firestore';
import {
  Transaction, TransactionType, TransactionStatus,
  Budget, Debt,
  INCOME_CATEGORIES, EXPENSE_CATEGORIES,
} from '@/lib/types';
import dynamic from 'next/dynamic';
const Modal = dynamic(() => import('@/components/ui/Modal'), { ssr: false });
import Button from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { cn, formatCurrency } from '@/lib/utils';
import {
  Plus, Wallet, TrendingUp, TrendingDown, Trash2,
  Edit3, PiggyBank, CreditCard, AlertTriangle, Target,
  DollarSign, Percent,
} from 'lucide-react';
import { format } from 'date-fns';

type Tab = 'transactions' | 'budgets' | 'debts';

export default function FinancePage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: transactions, loading: loadingTxns } = useCollection<Transaction>('transactions', uid);
  const { data: budgets, loading: loadingBudgets } = useCollection<Budget>('budgets', uid);
  const { data: debts, loading: loadingDebts } = useCollection<Debt>('debts', uid);

  const [activeTab, setActiveTab] = useState<Tab>('transactions');

  // ── Transaction state ──
  const [filter, setFilter] = useState<'all' | 'Income' | 'Expense'>('all');
  const [txnModalOpen, setTxnModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [type, setType] = useState<TransactionType>('Expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TransactionStatus>('Pending');
  const [notes, setNotes] = useState('');

  // ── Budget state ──
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetCategory, setBudgetCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetMonthYear, setBudgetMonthYear] = useState(format(new Date(), 'yyyy-MM'));

  // ── Debt state ──
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtName, setDebtName] = useState('');
  const [debtTotal, setDebtTotal] = useState('');
  const [debtRemaining, setDebtRemaining] = useState('');
  const [debtMonthly, setDebtMonthly] = useState('');
  const [debtRate, setDebtRate] = useState('');
  const [debtDueDay, setDebtDueDay] = useState('');
  const [debtNotes, setDebtNotes] = useState('');

  // ── Delete confirmation ──
  const [deleteConfirm, setDeleteConfirm] = useState<{ collection: string; id: string; label: string } | null>(null);

  // ── Computed values ──
  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthTxns = transactions.filter(t => t.date?.startsWith(currentMonth));
  const totalIncome = monthTxns.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTxns.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;
  const totalDebtRemaining = debts.reduce((s, d) => s + (d.remainingBalance || 0), 0);

  const filtered = transactions
    .filter(t => filter === 'all' || t.type === filter)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const categories = type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Spending per expense category for current month
  const spendingByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxns
      .filter(t => t.type === 'Expense')
      .forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [monthTxns]);

  // ── Transaction handlers ──
  const resetTxnForm = () => {
    setType('Expense');
    setAmount('');
    setCategory('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setDescription('');
    setStatus('Pending');
    setNotes('');
    setEditingTxn(null);
  };

  const openAddTxn = () => {
    resetTxnForm();
    setTxnModalOpen(true);
  };

  const openEditTxn = (txn: Transaction) => {
    setEditingTxn(txn);
    setType(txn.type);
    setAmount(txn.amount.toString());
    setCategory(txn.category);
    setDate(txn.date);
    setDescription(txn.description || '');
    setStatus(txn.status || 'Pending');
    setNotes(txn.notes || '');
    setTxnModalOpen(true);
  };

  const handleSaveTxn = async () => {
    if (!user) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    const payload: Partial<Transaction> = {
      type,
      amount: parsedAmount,
      category: category || (categories[0] as string),
      date,
      description,
      status,
      notes,
    };
    if (editingTxn) {
      await updateDocument('transactions', editingTxn.id, payload);
    } else {
      await addDocument('transactions', payload as Partial<Transaction>, user.uid);
    }
    resetTxnForm();
    setTxnModalOpen(false);
  };

  // ── Budget handlers ──
  const resetBudgetForm = () => {
    setBudgetCategory(EXPENSE_CATEGORIES[0]);
    setBudgetLimit('');
    setBudgetMonthYear(format(new Date(), 'yyyy-MM'));
    setEditingBudget(null);
  };

  const openAddBudget = () => {
    resetBudgetForm();
    setBudgetModalOpen(true);
  };

  const openEditBudget = (b: Budget) => {
    setEditingBudget(b);
    setBudgetCategory(b.category);
    setBudgetLimit(b.monthlyLimit.toString());
    setBudgetMonthYear(b.monthYear || format(new Date(), 'yyyy-MM'));
    setBudgetModalOpen(true);
  };

  const handleSaveBudget = async () => {
    if (!user) return;
    const limit = parseFloat(budgetLimit);
    if (isNaN(limit) || limit <= 0) return;
    const payload: Partial<Budget> = {
      category: budgetCategory,
      monthlyLimit: limit,
      monthYear: budgetMonthYear,
    };
    if (editingBudget) {
      await updateDocument('budgets', editingBudget.id, payload);
    } else {
      await addDocument('budgets', payload as Partial<Budget>, user.uid);
    }
    resetBudgetForm();
    setBudgetModalOpen(false);
  };

  // ── Debt handlers ──
  const resetDebtForm = () => {
    setDebtName('');
    setDebtTotal('');
    setDebtRemaining('');
    setDebtMonthly('');
    setDebtRate('');
    setDebtDueDay('');
    setDebtNotes('');
    setEditingDebt(null);
  };

  const openAddDebt = () => {
    resetDebtForm();
    setDebtModalOpen(true);
  };

  const openEditDebt = (d: Debt) => {
    setEditingDebt(d);
    setDebtName(d.name);
    setDebtTotal(d.totalAmount.toString());
    setDebtRemaining(d.remainingBalance.toString());
    setDebtMonthly(d.monthlyPayment?.toString() || '');
    setDebtRate(d.interestRate?.toString() || '');
    setDebtDueDay(d.dueDay?.toString() || '');
    setDebtNotes(d.notes || '');
    setDebtModalOpen(true);
  };

  const handleSaveDebt = async () => {
    if (!user) return;
    const total = parseFloat(debtTotal);
    const remaining = parseFloat(debtRemaining);
    if (isNaN(total) || total <= 0 || isNaN(remaining) || remaining < 0) return;
    const payload: Partial<Debt> = {
      name: debtName,
      totalAmount: total,
      remainingBalance: remaining,
      monthlyPayment: debtMonthly ? parseFloat(debtMonthly) : undefined,
      interestRate: debtRate ? parseFloat(debtRate) : undefined,
      dueDay: debtDueDay ? parseInt(debtDueDay) : undefined,
      notes: debtNotes || undefined,
    };
    if (editingDebt) {
      await updateDocument('debts', editingDebt.id, payload);
    } else {
      await addDocument('debts', payload as Partial<Debt>, user.uid);
    }
    resetDebtForm();
    setDebtModalOpen(false);
  };

  // ── Delete with confirmation ──
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    await deleteDocument(deleteConfirm.collection, deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const statusColor = (s?: TransactionStatus) => {
    switch (s) {
      case 'Received': return '#22c55e';
      case 'Paid': return '#3b82f6';
      case 'Pending': return '#f59e0b';
      default: return '#9ca3af';
    }
  };

  // ── Which "Add" button for current tab ──
  const handleAdd = () => {
    if (activeTab === 'transactions') openAddTxn();
    else if (activeTab === 'budgets') openAddBudget();
    else openAddDebt();
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Finance</h1>
        <button onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-rise text-[#0A0A0F] rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={18} /> Add
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 border border-green-200 dark:border-green-800/30">
          <TrendingUp size={18} className="text-green-600 mb-1" />
          <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-green-600/70">Income</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-200 dark:border-red-800/30">
          <TrendingDown size={18} className="text-red-500 mb-1" />
          <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(totalExpense)}</p>
          <p className="text-xs text-red-500/70">Expense</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800/30">
          <Wallet size={18} className="text-blue-600 mb-1" />
          <p className={cn('text-lg font-bold', balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-600')}>{formatCurrency(balance)}</p>
          <p className="text-xs text-blue-600/70">Balance</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4 border border-orange-200 dark:border-orange-800/30">
          <CreditCard size={18} className="text-orange-600 mb-1" />
          <p className="text-lg font-bold text-orange-700 dark:text-orange-400">{formatCurrency(totalDebtRemaining)}</p>
          <p className="text-xs text-orange-600/70">Total Debt</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-border pb-2">
        {([
          { key: 'transactions' as Tab, label: 'Transactions', icon: DollarSign },
          { key: 'budgets' as Tab, label: 'Budgets', icon: Target },
          { key: 'debts' as Tab, label: 'Debts', icon: CreditCard },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
              activeTab === tab.key
                ? 'bg-rise text-[#0A0A0F]'
                : 'text-text-2 hover:bg-surface-2')}>
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ──────────────── TRANSACTIONS TAB ──────────────── */}
      {activeTab === 'transactions' && (
        <>
          {/* Filter */}
          <div className="flex gap-2 mb-4">
            {(['all', 'Income', 'Expense'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('px-4 py-2 rounded-full text-sm font-semibold border',
                  filter === f ? 'bg-rise text-[#0A0A0F] border-rise' : 'bg-surface-2 text-text-2 border-border')}>
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>

          {/* Transaction List */}
          {loadingTxns ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Wallet} title="No transactions" description="Start tracking your income and expenses" />
          ) : (
            <div className="space-y-2">
              {filtered.map(txn => (
                <div key={txn.id}
                  onClick={() => openEditTxn(txn)}
                  className="flex items-center gap-4 p-4 bg-surface-2 rounded-xl border border-border group cursor-pointer hover:border-rise/30 transition-colors">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    txn.type === 'Income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
                    {txn.type === 'Income' ? <TrendingUp size={18} className="text-green-600" /> : <TrendingDown size={18} className="text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{txn.description || txn.category}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-text-3">{txn.category} · {txn.date}</p>
                      <Badge color={statusColor(txn.status)}>{txn.status || 'Pending'}</Badge>
                    </div>
                  </div>
                  <p className={cn('text-sm font-bold shrink-0', txn.type === 'Income' ? 'text-green-600' : 'text-red-500')}>
                    {txn.type === 'Income' ? '+' : '-'}{formatCurrency(txn.amount)}
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ collection: 'transactions', id: txn.id, label: txn.description || txn.category }); }}
                    className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500 p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ──────────────── BUDGETS TAB ──────────────── */}
      {activeTab === 'budgets' && (
        <>
          {loadingBudgets ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : budgets.length === 0 ? (
            <EmptyState icon={Target} title="No budgets" description="Set monthly spending limits for each category" />
          ) : (
            <div className="space-y-3">
              {budgets
                .sort((a, b) => a.category.localeCompare(b.category))
                .map(b => {
                  const spent = spendingByCategory[b.category] || 0;
                  const pct = b.monthlyLimit > 0 ? Math.min((spent / b.monthlyLimit) * 100, 100) : 0;
                  const overBudget = spent > b.monthlyLimit;
                  return (
                    <div key={b.id}
                      onClick={() => openEditBudget(b)}
                      className="p-4 bg-surface-2 rounded-xl border border-border cursor-pointer hover:border-rise/30 transition-colors group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <PiggyBank size={16} className="text-text-3" />
                          <p className="text-sm font-semibold text-text">{b.category}</p>
                          {b.monthYear && <span className="text-xs text-text-3">({b.monthYear})</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={cn('text-sm font-bold', overBudget ? 'text-red-500' : 'text-text')}>
                            {formatCurrency(spent)} / {formatCurrency(b.monthlyLimit)}
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ collection: 'budgets', id: b.id, label: b.category }); }}
                            className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500 p-1">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', overBudget ? 'bg-red-500' : 'bg-green-500')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {overBudget && (
                        <div className="flex items-center gap-1 mt-2">
                          <AlertTriangle size={12} className="text-red-500" />
                          <p className="text-xs text-red-500 font-medium">Over budget by {formatCurrency(spent - b.monthlyLimit)}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* ──────────────── DEBTS TAB ──────────────── */}
      {activeTab === 'debts' && (
        <>
          {loadingDebts ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : debts.length === 0 ? (
            <EmptyState icon={CreditCard} title="No debts" description="Track your debts and repayment progress" />
          ) : (
            <div className="space-y-3">
              {debts
                .sort((a, b) => b.remainingBalance - a.remainingBalance)
                .map(d => {
                  const paidPct = d.totalAmount > 0 ? Math.min(((d.totalAmount - d.remainingBalance) / d.totalAmount) * 100, 100) : 0;
                  return (
                    <div key={d.id}
                      onClick={() => openEditDebt(d)}
                      className="p-4 bg-surface-2 rounded-xl border border-border cursor-pointer hover:border-rise/30 transition-colors group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CreditCard size={16} className="text-text-3" />
                          <p className="text-sm font-semibold text-text">{d.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-text">{formatCurrency(d.remainingBalance)}</p>
                          <span className="text-xs text-text-3">/ {formatCurrency(d.totalAmount)}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ collection: 'debts', id: d.id, label: d.name }); }}
                            className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500 p-1">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-2">
                        <div className="h-full rounded-full bg-rise transition-all" style={{ width: `${paidPct}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-text-3">
                        <span>{paidPct.toFixed(0)}% paid</span>
                        {d.monthlyPayment && <span className="flex items-center gap-1"><DollarSign size={11} />{formatCurrency(d.monthlyPayment)}/mo</span>}
                        {d.interestRate != null && d.interestRate > 0 && <span className="flex items-center gap-1"><Percent size={11} />{d.interestRate}%</span>}
                        {d.dueDay && <span>Due day: {d.dueDay}</span>}
                      </div>
                      {d.notes && <p className="text-xs text-text-3 mt-1 truncate">{d.notes}</p>}
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* ──────────────── TRANSACTION MODAL ──────────────── */}
      <Modal open={txnModalOpen} onClose={() => { setTxnModalOpen(false); resetTxnForm(); }}
        title={editingTxn ? 'Edit Transaction' : 'Add Transaction'} size="md">
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['Income', 'Expense'] as TransactionType[]).map(t => (
              <button key={t} onClick={() => { setType(t); setCategory(''); }}
                className={cn('flex-1 py-3 rounded-xl font-semibold text-sm border transition-colors',
                  type === t
                    ? t === 'Income' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500'
                    : 'bg-surface-2 text-text-2 border-border')}>
                {t}
              </button>
            ))}
          </div>
          <Input label="Amount (AED)" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          <Select label="Category" value={category || (categories[0] as string)} onChange={e => setCategory(e.target.value)}
            options={categories.map(c => ({ value: c, label: c }))} />
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this for?" />
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value as TransactionStatus)}
            options={[
              { value: 'Pending', label: 'Pending' },
              { value: 'Received', label: 'Received' },
              { value: 'Paid', label: 'Paid' },
            ]} />
          <TextArea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setTxnModalOpen(false); resetTxnForm(); }} className="flex-1">Cancel</Button>
            <Button onClick={handleSaveTxn} disabled={!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0} className="flex-1">
              {editingTxn ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ──────────────── BUDGET MODAL ──────────────── */}
      <Modal open={budgetModalOpen} onClose={() => { setBudgetModalOpen(false); resetBudgetForm(); }}
        title={editingBudget ? 'Edit Budget' : 'Add Budget'} size="md">
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

      {/* ──────────────── DEBT MODAL ──────────────── */}
      <Modal open={debtModalOpen} onClose={() => { setDebtModalOpen(false); resetDebtForm(); }}
        title={editingDebt ? 'Edit Debt' : 'Add Debt'} size="md">
        <div className="space-y-4">
          <Input label="Name" value={debtName} onChange={e => setDebtName(e.target.value)} placeholder="e.g. Car Loan" />
          <Input label="Total Amount (AED)" type="number" value={debtTotal} onChange={e => setDebtTotal(e.target.value)} placeholder="0.00" />
          <Input label="Remaining Balance (AED)" type="number" value={debtRemaining} onChange={e => setDebtRemaining(e.target.value)} placeholder="0.00" />
          <Input label="Monthly Payment (AED)" type="number" value={debtMonthly} onChange={e => setDebtMonthly(e.target.value)} placeholder="Optional" />
          <Input label="Interest Rate (%)" type="number" value={debtRate} onChange={e => setDebtRate(e.target.value)} placeholder="Optional" />
          <Input label="Due Day of Month" type="number" value={debtDueDay} onChange={e => setDebtDueDay(e.target.value)} placeholder="1-31" />
          <TextArea label="Notes" value={debtNotes} onChange={e => setDebtNotes(e.target.value)} placeholder="Additional notes..." />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setDebtModalOpen(false); resetDebtForm(); }} className="flex-1">Cancel</Button>
            <Button onClick={handleSaveDebt}
              disabled={!debtName || !debtTotal || isNaN(parseFloat(debtTotal)) || parseFloat(debtTotal) <= 0 || !debtRemaining || isNaN(parseFloat(debtRemaining))}
              className="flex-1">
              {editingDebt ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ──────────────── DELETE CONFIRMATION MODAL ──────────────── */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/30">
            <AlertTriangle size={20} className="text-red-500 shrink-0" />
            <p className="text-sm text-text">
              Are you sure you want to delete <span className="font-semibold">{deleteConfirm?.label}</span>? This action cannot be undone.
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
