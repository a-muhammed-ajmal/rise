'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, ShoppingCart, CreditCard, PieChart, MoreVertical, Plus } from 'lucide-react';
import { format, subMonths, addMonths, parse } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { createDoc, updateDocById, deleteDocById } from '@/lib/firestore';
import { COLLECTIONS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import type { Transaction, Budget, Debt } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/lib/toast';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const INCOME_CATEGORIES = ['Salary', 'Commission', 'Bonus', 'Business Income', 'Investment Returns', 'Side Income', 'Other'] as const;
const EXPENSE_CATEGORIES = ['Housing', 'Food', 'Transport', 'Healthcare', 'Education', 'Entertainment', 'Shopping', 'Business Expenses', 'Savings & Investments', 'Other'] as const;
const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Digital Wallet'] as const;
const INCOME_STATUSES = ['Received', 'Pending', 'Paid'] as const;
const EXPENSE_TYPES = ['Mandatory', 'Optional'] as const;
const DEBT_STATUSES = ['Active', 'Paid Off'] as const;

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function FinancePage() {
  const { user } = useAuth();
  const userId = user?.uid ?? '';

  // Data fetching
  const { data: transactions } = useCollection<Transaction>({ userId, collectionName: COLLECTIONS.TRANSACTIONS, enabled: !!user });
  const { data: budgets } = useCollection<Budget>({ userId, collectionName: COLLECTIONS.BUDGETS, enabled: !!user });
  const { data: debts } = useCollection<Debt>({ userId, collectionName: COLLECTIONS.DEBTS, enabled: !!user });

  // Month selector
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Section open states
  const [incomeOpen, setIncomeOpen] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(true);
  const [debtOpen, setDebtOpen] = useState(true);
  const [paidOffOpen, setPaidOffOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(true);

  // Modals
  const [incomeModal, setIncomeModal] = useState({ open: false, edit: null as Transaction | null });
  const [expenseModal, setExpenseModal] = useState({ open: false, edit: null as Transaction | null });
  const [debtModal, setDebtModal] = useState({ open: false, edit: null as Debt | null });
  const [budgetModal, setBudgetModal] = useState({ open: false, edit: null as Budget | null });
  const [logPaymentModal, setLogPaymentModal] = useState({ open: false, debt: null as Debt | null });
  const [deleteModal, setDeleteModal] = useState({ open: false, type: '', id: '', name: '' });

  // Helper function
  const getMonthTransactions = (txs: Transaction[], month: string) => txs.filter(tx => tx.date.startsWith(month));

  // Computed values
  const monthTransactions = getMonthTransactions(transactions, selectedMonth);
  const incomeTransactions = monthTransactions.filter(tx => tx.type === 'Income');
  const expenseTransactions = monthTransactions.filter(tx => tx.type === 'Expense');

  // KPI calculations
  const totalIncome = incomeTransactions.filter(tx => tx.status === 'Received').reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpenses = expenseTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const netCashFlow = totalIncome - totalExpenses;

  // Month navigation
  const handlePrevMonth = () => {
    const newMonth = format(subMonths(parse(selectedMonth, 'yyyy-MM', new Date()), 1), 'yyyy-MM');
    setSelectedMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = format(addMonths(parse(selectedMonth, 'yyyy-MM', new Date()), 1), 'yyyy-MM');
    setSelectedMonth(newMonth);
  };

  // CRUD handlers
  const handleSaveIncome = async (data: any) => {
    if (!data.source.trim() || data.amount <= 0 || !data.date) {
      toast.error('Please fill in all required fields correctly.');
      return;
    }
    try {
      if (incomeModal.edit) {
        await updateDocById(COLLECTIONS.TRANSACTIONS, incomeModal.edit.id, data);
        toast.success('Income updated');
      } else {
        await createDoc(COLLECTIONS.TRANSACTIONS, { ...data, userId, type: 'Income', createdAt: new Date().toISOString() });
        toast.success('Income added');
      }
      setIncomeModal({ open: false, edit: null });
    } catch {
      toast.error('Failed to save income');
    }
  };

  const handleSaveExpense = async (data: any) => {
    if (!data.description.trim() || data.amount <= 0 || !data.date) {
      toast.error('Please fill in all required fields correctly.');
      return;
    }
    try {
      if (expenseModal.edit) {
        await updateDocById(COLLECTIONS.TRANSACTIONS, expenseModal.edit.id, data);
        toast.success('Expense updated');
      } else {
        await createDoc(COLLECTIONS.TRANSACTIONS, { ...data, userId, type: 'Expense', createdAt: new Date().toISOString() });
        toast.success('Expense added');
      }
      setExpenseModal({ open: false, edit: null });
    } catch {
      toast.error('Failed to save expense');
    }
  };

  const handleSaveDebt = async (data: any) => {
    if (!data.name.trim() || data.totalAmount <= 0 || data.remainingBalance < 0 || data.remainingBalance > data.totalAmount) {
      toast.error('Please fill in all required fields correctly.');
      return;
    }
    try {
      if (debtModal.edit) {
        await updateDocById(COLLECTIONS.DEBTS, debtModal.edit.id, data);
        toast.success('Debt updated');
      } else {
        await createDoc(COLLECTIONS.DEBTS, { ...data, userId, status: 'Active', createdAt: new Date().toISOString() });
        toast.success('Debt added');
      }
      setDebtModal({ open: false, edit: null });
    } catch {
      toast.error('Failed to save debt');
    }
  };

  const handleSaveBudget = async (data: any) => {
    if (!data.category || data.monthlyLimit <= 0) {
      toast.error('Please fill in all required fields correctly.');
      return;
    }
    const existing = budgets.find(b => b.category === data.category && b.monthYear === data.monthYear);
    if (existing && (!budgetModal.edit || existing.id !== budgetModal.edit.id)) {
      toast.error('A budget for this category already exists for this period');
      return;
    }
    try {
      if (budgetModal.edit) {
        await updateDocById(COLLECTIONS.BUDGETS, budgetModal.edit.id, data);
        toast.success('Budget updated');
      } else {
        await createDoc(COLLECTIONS.BUDGETS, { ...data, userId, createdAt: new Date().toISOString() });
        toast.success('Budget added');
      }
      setBudgetModal({ open: false, edit: null });
    } catch {
      toast.error('Failed to save budget');
    }
  };

  const handleLogPayment = async (amount: number) => {
    if (!logPaymentModal.debt || amount <= 0 || amount > logPaymentModal.debt.remainingBalance) {
      toast.error('Invalid payment amount');
      return;
    }
    const newBalance = logPaymentModal.debt.remainingBalance - amount;
    try {
      await updateDocById(COLLECTIONS.DEBTS, logPaymentModal.debt.id, {
        remainingBalance: newBalance,
        status: newBalance <= 0 ? 'Paid Off' : 'Active'
      });
      toast.success(newBalance <= 0 ? 'Debt fully paid off!' : `Payment logged. Remaining: ${formatCurrency(newBalance)}`);
      setLogPaymentModal({ open: false, debt: null });
    } catch {
      toast.error('Failed to log payment');
    }
  };

  const handleDelete = async () => {
    try {
      if (deleteModal.type === 'transaction') {
        await deleteDocById(COLLECTIONS.TRANSACTIONS, deleteModal.id);
      } else if (deleteModal.type === 'debt') {
        await deleteDocById(COLLECTIONS.DEBTS, deleteModal.id);
      } else if (deleteModal.type === 'budget') {
        await deleteDocById(COLLECTIONS.BUDGETS, deleteModal.id);
      }
      toast.success(`${deleteModal.type} deleted`);
      setDeleteModal({ open: false, type: '', id: '', name: '' });
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#E5E5EA]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-[#1C1C1E]">Finance</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-medium text-[#1C1C1E] min-w-[100px] text-center">
              {format(parse(selectedMonth, 'yyyy-MM', new Date()), 'MMMM yyyy')}
            </span>
            <Button variant="ghost" size="sm" onClick={handleNextMonth}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="glass-card p-2 text-center overflow-hidden">
            <p className="section-label">Income</p>
            <p className="text-sm font-bold text-[#1ABC9C] truncate">{formatCurrency(totalIncome)}</p>
            <TrendingUp size={14} className="mx-auto mt-1 text-[#1ABC9C]" />
          </div>
          <div className="glass-card p-2 text-center overflow-hidden">
            <p className="section-label">Expenses</p>
            <p className="text-sm font-bold text-[#FF4F6D] truncate">{formatCurrency(totalExpenses)}</p>
            <TrendingDown size={14} className="mx-auto mt-1 text-[#FF4F6D]" />
          </div>
          <div className="glass-card p-2 text-center overflow-hidden">
            <p className={`section-label ${netCashFlow >= 0 ? 'text-[#1ABC9C]' : 'text-[#FF4F6D]'}`}>
              {netCashFlow >= 0 ? 'Surplus' : 'Deficit'}
            </p>
            <p className={`text-sm font-bold truncate ${netCashFlow >= 0 ? 'text-[#1ABC9C]' : 'text-[#FF4F6D]'}`}>
              {formatCurrency(Math.abs(netCashFlow))}
            </p>
            {netCashFlow >= 0 ? <TrendingUp size={14} className="mx-auto mt-1 text-[#1ABC9C]" /> : <TrendingDown size={14} className="mx-auto mt-1 text-[#FF4F6D]" />}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Income Tracker */}
        <div className="glass-card">
          <button
            className="w-full flex items-center justify-between p-4 text-left"
            onClick={() => setIncomeOpen(!incomeOpen)}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[#1C1C1E]">Income Tracker</h2>
              <Badge label={incomeTransactions.length.toString()} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIncomeModal({ open: true, edit: null })}>
              <Plus size={16} />
            </Button>
          </button>
          {incomeOpen && (
            <div className="px-4 pb-4">
              {incomeTransactions.length === 0 ? (
                <EmptyState icon={DollarSign} title="No income recorded" subtitle="Add your first income entry for this month" />
              ) : (
                <div className="space-y-2">
                  {incomeTransactions.sort((a, b) => b.date.localeCompare(a.date)).map(tx => (
                    <div key={tx.id} className="glass-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1C1C1E] truncate">{tx.source}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Badge label={tx.category} />
                            <Badge label={tx.status || 'Received'} color={tx.status === 'Received' ? 'green' : tx.status === 'Pending' ? 'amber' : 'blue'} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-[#1ABC9C]">{formatCurrency(tx.amount)}</p>
                          <p className="text-xs text-[#6C6C70]">{format(parse(tx.date, 'yyyy-MM-dd', new Date()), 'MMM d')}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 pt-2 border-t border-[#F0F0F0]">
                        <Button variant="ghost" size="sm" onClick={() => setIncomeModal({ open: true, edit: tx })}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, type: 'transaction', id: tx.id, name: tx.source || tx.category })}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expense Tracker */}
        <div className="glass-card">
          <button
            className="w-full flex items-center justify-between p-4 text-left"
            onClick={() => setExpenseOpen(!expenseOpen)}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[#1C1C1E]">Expense Tracker</h2>
              <Badge label={expenseTransactions.length.toString()} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setExpenseModal({ open: true, edit: null })}>
              <Plus size={16} />
            </Button>
          </button>
          {expenseOpen && (
            <div className="px-4 pb-4">
              {/* Category Summary */}
              <div className="mb-4 p-3 bg-[#F5F5F5] rounded-card">
                <h3 className="text-sm font-medium text-[#1C1C1E] mb-2">By Category</h3>
                <div className="space-y-1">
                  {Object.entries(
                    expenseTransactions.reduce((acc, tx) => {
                      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
                      return acc;
                    }, {} as Record<string, number>)
                  ).sort(([,a], [,b]) => b - a).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between text-sm">
                      <span className="text-[#6C6C70]">{cat}</span>
                      <span className="text-[#1C1C1E]">{formatCurrency(amt)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {expenseTransactions.length === 0 ? (
                <EmptyState icon={ShoppingCart} title="No expenses recorded" subtitle="Add your first expense for this month" />
              ) : (
                <div className="space-y-2">
                  {expenseTransactions.sort((a, b) => b.date.localeCompare(a.date)).map(tx => (
                    <div key={tx.id} className="glass-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1C1C1E] truncate">{tx.description}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Badge label={tx.category} />
                            <Badge label={tx.expenseType || 'Optional'} color={tx.expenseType === 'Mandatory' ? 'blue' : 'gray'} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-[#FF4F6D]">{formatCurrency(tx.amount)}</p>
                          <p className="text-xs text-[#6C6C70]">{format(parse(tx.date, 'yyyy-MM-dd', new Date()), 'MMM d')}</p>
                          {tx.paymentMethod && <p className="text-xs text-[#AEAEB2]">{tx.paymentMethod}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 pt-2 border-t border-[#F0F0F0]">
                        <Button variant="ghost" size="sm" onClick={() => setExpenseModal({ open: true, edit: tx })}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, type: 'transaction', id: tx.id, name: tx.description || tx.category })}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Debt / Credit Tracker */}
        <div className="glass-card">
          <button
            className="w-full flex items-center justify-between p-4 text-left"
            onClick={() => setDebtOpen(!debtOpen)}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[#1C1C1E]">Debt / Credit Tracker</h2>
              <Badge label={debts.filter(d => d.status === 'Active').length.toString()} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDebtModal({ open: true, edit: null })}>
              <Plus size={16} />
            </Button>
          </button>
          {debtOpen && (
            <div className="px-4 pb-4">
              {debts.filter(d => d.status === 'Active').length === 0 ? (
                <EmptyState icon={CreditCard} title="No active debts" subtitle="Add a debt or credit account to start tracking" />
              ) : (
                <div className="space-y-3">
                  {debts.filter(d => d.status === 'Active').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(debt => {
                    const progress = debt.totalAmount > 0 ? ((debt.totalAmount - debt.remainingBalance) / debt.totalAmount) * 100 : 0;
                    return (
                      <div key={debt.id} className="glass-card p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-[#1C1C1E]">{debt.name}</h3>
                          <Badge label="Active" color="amber" />
                        </div>
                        <div className="flex justify-between items-center mb-2 gap-2">
                          <p className="text-sm font-bold text-[#FF4F6D] truncate">{formatCurrency(debt.remainingBalance)}</p>
                          <p className="text-xs text-[#6C6C70] flex-shrink-0">of {formatCurrency(debt.totalAmount)}</p>
                        </div>
                        <div className="progress-track mb-2">
                          <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: 'green' }}></div>
                        </div>
                        <div className="text-xs text-[#6C6C70] space-y-1 mb-3">
                          {debt.monthlyPayment && <p>Monthly: {formatCurrency(debt.monthlyPayment)}</p>}
                          {debt.interestRate && <p>Interest: {debt.interestRate}%</p>}
                          {debt.dueDay && <p>Due day: {debt.dueDay}</p>}
                          {debt.targetPayoffDate && <p>Target: {debt.targetPayoffDate}</p>}
                          {debt.notes && <p>{debt.notes}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="primary" size="sm" onClick={() => setLogPaymentModal({ open: true, debt })}>Log Payment</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDebtModal({ open: true, edit: debt })}>Edit</Button>
                          <Button variant="primary" size="sm" onClick={() => {
                            updateDocById(COLLECTIONS.DEBTS, debt.id, { status: 'Paid Off', remainingBalance: 0 });
                            toast.success('Debt marked as paid off');
                          }}>Mark Paid Off</Button>
                          <Button variant="danger" size="sm" onClick={() => setDeleteModal({ open: true, type: 'debt', id: debt.id, name: debt.name })}>Delete</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Paid Off Debts */}
              {debts.filter(d => d.status === 'Paid Off').length > 0 && (
                <div className="mt-4">
                  <button
                    className="w-full flex items-center justify-between text-left text-sm font-medium text-[#6C6C70] mb-2"
                    onClick={() => setPaidOffOpen(!paidOffOpen)}
                  >
                    Paid Off ({debts.filter(d => d.status === 'Paid Off').length})
                    <ChevronRight size={14} className={`transform transition-transform ${paidOffOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {paidOffOpen && (
                    <div className="space-y-2">
                      {debts.filter(d => d.status === 'Paid Off').map(debt => (
                        <div key={debt.id} className="glass-card p-3 flex justify-between items-center opacity-60">
                          <div>
                            <p className="font-semibold text-[#1C1C1E] line-through">{debt.name}</p>
                            <p className="text-sm text-[#6C6C70]">{formatCurrency(debt.totalAmount)}</p>
                          </div>
                          <div className="flex gap-2">
                            <Badge label="Paid Off" color="green" />
                            <Button variant="ghost" size="sm" onClick={() => {
                              updateDocById(COLLECTIONS.DEBTS, debt.id, { status: 'Active', remainingBalance: debt.totalAmount });
                              toast.success('Debt reopened');
                            }}>Reopen</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Budget Planner */}
        <div className="glass-card">
          <button
            className="w-full flex items-center justify-between p-4 text-left"
            onClick={() => setBudgetOpen(!budgetOpen)}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[#1C1C1E]">Budget Planner</h2>
              <Badge label={budgets.filter(b => !b.monthYear || b.monthYear === selectedMonth).length.toString()} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setBudgetModal({ open: true, edit: null })}>
              <Plus size={16} />
            </Button>
          </button>
          {budgetOpen && (
            <div className="px-4 pb-4">
              {budgets.length === 0 ? (
                <EmptyState icon={PieChart} title="No budgets set" subtitle="Set monthly spending limits to stay on track" />
              ) : (
                <div className="space-y-3">
                  {budgets.filter(b => !b.monthYear || b.monthYear === selectedMonth).map(budget => {
                    const spent = expenseTransactions.filter(tx => tx.category === budget.category).reduce((sum, tx) => sum + tx.amount, 0);
                    const percentage = budget.monthlyLimit > 0 ? (spent / budget.monthlyLimit) * 100 : 0;
                    const isOver = percentage > 100;
                    const color = percentage > 100 ? 'red' : percentage > 75 ? 'orange' : 'green';
                    return (
                      <div key={budget.id} className="glass-card p-4">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-semibold text-[#1C1C1E]">{budget.category}</h3>
                          <span className="text-sm text-[#6C6C70]">{formatCurrency(budget.monthlyLimit)}</span>
                        </div>
                        <p className={`text-sm font-bold truncate mb-2 ${isOver ? 'text-[#FF4F6D]' : 'text-[#1ABC9C]'}`}>
                          {formatCurrency(spent)} spent
                        </p>
                        <div className="progress-track mb-2">
                          <div className="progress-fill" style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color }}></div>
                        </div>
                        {isOver ? (
                          <p className="text-sm text-[#FF4F6D]">Over by {formatCurrency(spent - budget.monthlyLimit)}</p>
                        ) : (
                          <p className="text-sm text-[#1ABC9C]">{formatCurrency(budget.monthlyLimit - spent)} remaining</p>
                        )}
                        <div className="flex justify-end mt-2 gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setBudgetModal({ open: true, edit: budget })}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, type: 'budget', id: budget.id, name: budget.category })}>Delete</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {/* Income Modal */}
      <Modal open={incomeModal.open} onClose={() => setIncomeModal({ open: false, edit: null })} title={incomeModal.edit ? 'Edit Income' : 'Add Income'}>
        <IncomeForm
          initial={incomeModal.edit}
          onSave={handleSaveIncome}
          onCancel={() => setIncomeModal({ open: false, edit: null })}
        />
      </Modal>

      {/* Expense Modal */}
      <Modal open={expenseModal.open} onClose={() => setExpenseModal({ open: false, edit: null })} title={expenseModal.edit ? 'Edit Expense' : 'Add Expense'}>
        <ExpenseForm
          initial={expenseModal.edit}
          onSave={handleSaveExpense}
          onCancel={() => setExpenseModal({ open: false, edit: null })}
        />
      </Modal>

      {/* Debt Modal */}
      <Modal open={debtModal.open} onClose={() => setDebtModal({ open: false, edit: null })} title={debtModal.edit ? 'Edit Debt' : 'Add Debt'}>
        <DebtForm
          initial={debtModal.edit}
          onSave={handleSaveDebt}
          onCancel={() => setDebtModal({ open: false, edit: null })}
        />
      </Modal>

      {/* Budget Modal */}
      <Modal open={budgetModal.open} onClose={() => setBudgetModal({ open: false, edit: null })} title={budgetModal.edit ? 'Edit Budget' : 'Add Budget'}>
        <BudgetForm
          initial={budgetModal.edit}
          onSave={handleSaveBudget}
          onCancel={() => setBudgetModal({ open: false, edit: null })}
        />
      </Modal>

      {/* Log Payment Modal */}
      <Modal open={logPaymentModal.open} onClose={() => setLogPaymentModal({ open: false, debt: null })} title={`Log Payment — ${logPaymentModal.debt?.name}`}>
        <LogPaymentForm
          debt={logPaymentModal.debt}
          onSave={handleLogPayment}
          onCancel={() => setLogPaymentModal({ open: false, debt: null })}
        />
      </Modal>

      {/* Delete Modal */}
      <Modal open={deleteModal.open} onClose={() => setDeleteModal({ open: false, type: '', id: '', name: '' })} title={`Delete ${deleteModal.type}`}>
        <div className="p-4">
          <p className="text-[#1C1C1E] mb-4">Delete &quot;{deleteModal.name}&quot;? This cannot be undone.</p>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDeleteModal({ open: false, type: '', id: '', name: '' })}>Cancel</Button>
            <Button variant="danger" fullWidth onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── FORM COMPONENTS ─────────────────────────────────────────────────────────
function IncomeForm({ initial, onSave, onCancel }: { initial: Transaction | null; onSave: (data: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    source: initial?.source || '',
    amount: initial?.amount?.toString() || '',
    date: initial?.date || new Date().toISOString().split('T')[0],
    category: initial?.category || 'Salary',
    status: initial?.status || 'Received',
    notes: initial?.notes || '',
  });

  const handleSave = () => {
    onSave({
      source: form.source.trim(),
      amount: parseFloat(form.amount),
      date: form.date,
      category: form.category,
      status: form.status,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <Input label="Source" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} required />
      <Input label="Amount (AED)" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
      <Input label="Date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
      <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: (e.target as HTMLSelectElement).value }))} options={INCOME_CATEGORIES.map(c => ({ value: c, label: c }))} />
      <div>
        <p className="text-sm font-medium text-[#1C1C1E] mb-2">Status</p>
        <div className="flex gap-2">
          {INCOME_STATUSES.map(s => (
            <Button
              key={s}
              variant={form.status === s ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setForm(f => ({ ...f, status: s }))}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>
      <Textarea label="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
        <Button fullWidth onClick={handleSave}>{initial ? 'Update Income' : 'Save Income'}</Button>
      </div>
    </div>
  );
}

function ExpenseForm({ initial, onSave, onCancel }: { initial: Transaction | null; onSave: (data: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    description: initial?.description || '',
    amount: initial?.amount?.toString() || '',
    date: initial?.date || new Date().toISOString().split('T')[0],
    category: initial?.category || 'Other',
    expenseType: initial?.expenseType || 'Optional',
    paymentMethod: initial?.paymentMethod || 'Cash',
    notes: initial?.notes || '',
  });

  const handleSave = () => {
    onSave({
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      date: form.date,
      category: form.category,
      expenseType: form.expenseType,
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <Input label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
      <Input label="Amount (AED)" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
      <Input label="Date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
      <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: (e.target as HTMLSelectElement).value }))} options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))} />
      <div>
        <p className="text-sm font-medium text-[#1C1C1E] mb-2">Type</p>
        <div className="flex gap-2">
          {EXPENSE_TYPES.map(t => (
            <Button
              key={t}
              variant={form.expenseType === t ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setForm(f => ({ ...f, expenseType: t }))}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>
      <Select label="Payment Method" value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: (e.target as HTMLSelectElement).value }))} options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))} />
      <Textarea label="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
        <Button fullWidth onClick={handleSave}>{initial ? 'Update Expense' : 'Save Expense'}</Button>
      </div>
    </div>
  );
}

function DebtForm({ initial, onSave, onCancel }: { initial: Debt | null; onSave: (data: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    totalAmount: initial?.totalAmount?.toString() || '',
    remainingBalance: initial?.remainingBalance?.toString() || '',
    monthlyPayment: initial?.monthlyPayment?.toString() || '',
    interestRate: initial?.interestRate?.toString() || '',
    dueDay: initial?.dueDay?.toString() || '',
    targetPayoffDate: initial?.targetPayoffDate || '',
    notes: initial?.notes || '',
  });

  const handleTotalChange = (val: string) => {
    setForm(f => ({ ...f, totalAmount: val, remainingBalance: f.remainingBalance || val }));
  };

  const handleSave = () => {
    onSave({
      name: form.name.trim(),
      totalAmount: parseFloat(form.totalAmount),
      remainingBalance: parseFloat(form.remainingBalance),
      monthlyPayment: form.monthlyPayment ? parseFloat(form.monthlyPayment) : undefined,
      interestRate: form.interestRate ? parseFloat(form.interestRate) : undefined,
      dueDay: form.dueDay ? parseInt(form.dueDay) : undefined,
      targetPayoffDate: form.targetPayoffDate || undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <Input label="Debt / Credit Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
      <Input label="Total Amount (AED)" type="number" value={form.totalAmount} onChange={e => handleTotalChange(e.target.value)} required />
      <Input label="Remaining Balance (AED)" type="number" value={form.remainingBalance} onChange={e => setForm(f => ({ ...f, remainingBalance: e.target.value }))} required />
      <Input label="Monthly Payment (AED, optional)" type="number" value={form.monthlyPayment} onChange={e => setForm(f => ({ ...f, monthlyPayment: e.target.value }))} />
      <Input label="Interest Rate % (optional)" type="number" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} />
      <Input label="Payment Due Day (optional)" type="number" value={form.dueDay} onChange={e => setForm(f => ({ ...f, dueDay: e.target.value }))} min="1" max="31" />
      <Input label="Target Payoff Date (optional)" type="date" value={form.targetPayoffDate} onChange={e => setForm(f => ({ ...f, targetPayoffDate: e.target.value }))} />
      <Textarea label="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
        <Button fullWidth onClick={handleSave}>{initial ? 'Update Debt' : 'Save Debt'}</Button>
      </div>
    </div>
  );
}

function BudgetForm({ initial, onSave, onCancel }: { initial: Budget | null; onSave: (data: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    category: initial?.category || 'Other',
    monthlyLimit: initial?.monthlyLimit?.toString() || '',
    monthYear: initial?.monthYear || '',
  });

  const handleSave = () => {
    onSave({
      category: form.category,
      monthlyLimit: parseFloat(form.monthlyLimit),
      monthYear: form.monthYear || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: (e.target as HTMLSelectElement).value }))} options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))} />
      <Input label="Monthly Limit (AED)" type="number" value={form.monthlyLimit} onChange={e => setForm(f => ({ ...f, monthlyLimit: e.target.value }))} required />
      <Input label="Month (leave blank for recurring every month)" type="month" value={form.monthYear} onChange={e => setForm(f => ({ ...f, monthYear: e.target.value }))} />
      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
        <Button fullWidth onClick={handleSave}>{initial ? 'Update Budget' : 'Save Budget'}</Button>
      </div>
    </div>
  );
}

function LogPaymentForm({ debt, onSave, onCancel }: { debt: Debt | null; onSave: (amount: number) => void; onCancel: () => void }) {
  const [amount, setAmount] = useState('');

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (amt <= 0 || amt > (debt?.remainingBalance || 0)) return;
    onSave(amt);
  };

  return (
    <div className="space-y-4">
      <Input label="Payment Amount (AED)" type="number" value={amount} onChange={e => setAmount(e.target.value)} required />
      <p className="text-sm text-[#6C6C70]">Current remaining balance: {formatCurrency(debt?.remainingBalance || 0)}</p>
      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
        <Button fullWidth onClick={handleSave}>Log Payment</Button>
      </div>
    </div>
  );
}
