'use client';

import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { createDoc, updateDocById, deleteDocById } from '@/lib/firestore';
import { COLLECTIONS, INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/constants';
import { formatAED, getMonthYear, cn } from '@/lib/utils';
import type { Transaction, TransactionType, Budget, Debt } from '@/lib/types';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';

type Tab = 'transactions' | 'budgets' | 'debts';

// ─── TRANSACTION MODAL ───────────────────────────────────────────────────────
function TransactionModal({
  open, onClose, tx, userId, defaultType,
}: {
  open: boolean; onClose: () => void; tx: Transaction | null; userId: string; defaultType?: TransactionType;
}) {
  const [type, setType] = useState<TransactionType>(tx?.type ?? defaultType ?? 'Expense');
  const [form, setForm] = useState({
    amount: tx ? String(tx.amount) : '',
    category: tx?.category ?? '',
    date: tx?.date ?? new Date().toISOString().split('T')[0],
    description: tx?.description ?? '',
    paymentMethod: tx?.paymentMethod ?? '',
    notes: tx?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) e.amount = 'Valid amount required';
    if (!form.category) e.category = 'Category required';
    if (!form.date) e.date = 'Date required';
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    try {
      const data = { userId, type, amount: parseFloat(form.amount), category: form.category, date: form.date, description: sanitize(form.description), paymentMethod: form.paymentMethod, notes: sanitize(form.notes) };
      if (tx) await updateDocById(COLLECTIONS.TRANSACTIONS, tx.id, data);
      else await createDoc(COLLECTIONS.TRANSACTIONS, data);
      toast.success('Transaction saved.');
      onClose();
    } catch { toast.error('Failed to save.'); }
    finally { setSaving(false); }
  };

  const cats = type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Modal open={open} onClose={onClose} title={tx ? 'Edit Transaction' : 'New Transaction'}
      footer={<div className="flex gap-3"><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth loading={saving} onClick={handleSave}>Save</Button></div>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex rounded-button overflow-hidden border border-[#2A2A2A]">
          {(['Income','Expense'] as TransactionType[]).map((t) => (
            <button key={t} onClick={() => setType(t)} className={cn('flex-1 h-10 text-sm font-semibold transition-colors', type === t ? (t === 'Income' ? 'bg-[#1ABC9C] text-white' : 'bg-[#FF4F6D] text-white') : 'bg-[#141414] text-[#8A8A8A]')}>{t}</button>
          ))}
        </div>
        <Input label="Amount (AED)" type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} error={errors.amount} required placeholder="0.00" />
        <Select label="Category" value={form.category} onChange={(e) => set('category', (e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Select category...' }, ...cats.map((c) => ({ value: c, label: c }))]} error={errors.category} required />
        <Input label="Date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
        <Input label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional description" />
        <Select label="Payment Method" value={form.paymentMethod} onChange={(e) => set('paymentMethod', (e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Select...' }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: m }))]} />
        <Textarea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
      </div>
    </Modal>
  );
}

export default function FinancePage() {
  const { user } = useAuth();
  const [monthOffset, setMonthOffset] = useState(0);
  const [tab, setTab] = useState<Tab>('transactions');
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [defaultType, setDefaultType] = useState<TransactionType>('Expense');

  const date = new Date();
  date.setMonth(date.getMonth() + monthOffset);
  const monthYear = getMonthYear(date);
  const monthLabel = date.toLocaleDateString('en-AE', { month: 'long', year: 'numeric' });

  const { data: transactions, loading: txLoading } = useCollection<Transaction>({ userId: user?.uid ?? '', collectionName: COLLECTIONS.TRANSACTIONS, enabled: !!user });
  const { data: budgets, loading: budgetsLoading } = useCollection<Budget>({ userId: user?.uid ?? '', collectionName: COLLECTIONS.BUDGETS, enabled: !!user });
  const { data: debts, loading: debtsLoading } = useCollection<Debt>({ userId: user?.uid ?? '', collectionName: COLLECTIONS.DEBTS, enabled: !!user });

  const monthTx = transactions.filter((t) => t.date.startsWith(monthYear));
  const income = monthTx.filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
  const expenses = monthTx.filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
  const surplus = income - expenses;
  const savingsRate = income > 0 ? Math.round((surplus / income) * 100) : 0;

  // Group transactions by date
  const grouped = monthTx
    .sort((a, b) => b.date.localeCompare(a.date))
    .reduce<Record<string, Transaction[]>>((acc, tx) => {
      acc[tx.date] = [...(acc[tx.date] ?? []), tx];
      return acc;
    }, {});

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="px-4 pt-4 pb-3 border-b border-[#2A2A2A]">
        <h1 className="text-xl font-bold text-[#F0F0F0] mb-3">Finance</h1>
        {/* Month selector */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setMonthOffset((m) => m - 1)} className="w-8 h-8 flex items-center justify-center text-[#8A8A8A] bg-[#1C1C1C] rounded-button">←</button>
          <span className="flex-1 text-center text-sm font-medium text-[#F0F0F0]">{monthLabel}</span>
          <button onClick={() => setMonthOffset((m) => m + 1)} className="w-8 h-8 flex items-center justify-center text-[#8A8A8A] bg-[#1C1C1C] rounded-button">→</button>
        </div>
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-[#141414] rounded-card p-3 border border-[#2A2A2A]"><p className="text-xs text-[#8A8A8A]">Income</p><p className="text-base font-bold text-[#1ABC9C]">{formatAED(income)}</p></div>
          <div className="bg-[#141414] rounded-card p-3 border border-[#2A2A2A]"><p className="text-xs text-[#8A8A8A]">Expenses</p><p className="text-base font-bold text-[#FF4F6D]">{formatAED(expenses)}</p></div>
          <div className="bg-[#141414] rounded-card p-3 border border-[#2A2A2A]"><p className="text-xs text-[#8A8A8A]">{surplus >= 0 ? 'Surplus' : 'Deficit'}</p><p className={cn('text-base font-bold', surplus >= 0 ? 'text-[#1ABC9C]' : 'text-[#FF4F6D]')}>{formatAED(Math.abs(surplus))}</p></div>
          <div className="bg-[#141414] rounded-card p-3 border border-[#2A2A2A]"><p className="text-xs text-[#8A8A8A]">Savings Rate</p><p className={cn('text-base font-bold', savingsRate >= 20 ? 'text-[#1ABC9C]' : savingsRate >= 10 ? 'text-[#FFD700]' : 'text-[#FF4F6D]')}>{savingsRate}%</p></div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1">
          {(['transactions','budgets','debts'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn('flex-1 h-8 text-xs font-medium capitalize rounded-chip transition-colors', tab === t ? 'bg-[#FF6B35] text-white' : 'bg-[#141414] text-[#8A8A8A] border border-[#2A2A2A]')}>{t}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-4 pb-6">
        {tab === 'transactions' && (
          txLoading ? (
            <>{[1,2,3,4].map((i) => <SkeletonCard key={i} />)}</>
          ) : Object.keys(grouped).length === 0 ? (
            <EmptyState icon={Wallet} title="No transactions" subtitle="Record your first income or expense." actionLabel="Add Transaction" onAction={() => { setEditTx(null); setDefaultType('Expense'); setTxModalOpen(true); }} />
          ) : (
            <div className="flex flex-col gap-4">
              {Object.entries(grouped).map(([date, txs]) => (
                <div key={date}>
                  <p className="text-xs text-[#8A8A8A] mb-2 font-medium">{date}</p>
                  <div className="bg-[#141414] rounded-card border border-[#2A2A2A] overflow-hidden">
                    {txs.map((tx, idx) => (
                      <div key={tx.id} onClick={() => { setEditTx(tx); setTxModalOpen(true); }}
                        className={cn('flex items-center gap-3 px-4 py-3 active:bg-[#1C1C1C] transition-colors', idx < txs.length - 1 && 'border-b border-[#2A2A2A]')}
                      >
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', tx.type === 'Income' ? 'bg-[#1ABC9C]/15' : 'bg-[#FF4F6D]/15')}>
                          {tx.type === 'Income' ? <TrendingUp size={14} className="text-[#1ABC9C]" /> : <TrendingDown size={14} className="text-[#FF4F6D]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#F0F0F0] truncate">{tx.description || tx.category}</p>
                          <Badge label={tx.category} />
                        </div>
                        <p className={cn('text-sm font-semibold flex-shrink-0', tx.type === 'Income' ? 'text-[#1ABC9C]' : 'text-[#FF4F6D]')}>
                          {tx.type === 'Income' ? '+' : '-'}{formatAED(tx.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {tab === 'budgets' && (
          budgetsLoading ? <SkeletonCard /> :
          budgets.length === 0 ? <EmptyState icon={Wallet} title="No budgets set" subtitle="Set spending limits to track your money." /> :
          <div className="flex flex-col gap-3">
            {budgets.map((b) => {
              const spent = monthTx.filter((t) => t.type === 'Expense' && t.category === b.category).reduce((s, t) => s + t.amount, 0);
              const pct = b.monthlyLimit > 0 ? Math.min(100, (spent / b.monthlyLimit) * 100) : 0;
              const color = pct >= 100 ? '#FF4F6D' : pct >= 90 ? '#FFD700' : '#1ABC9C';
              return (
                <div key={b.id} className="bg-[#141414] rounded-card border border-[#2A2A2A] p-4">
                  <div className="flex justify-between mb-2"><span className="text-sm font-medium text-[#F0F0F0]">{b.category}</span><span className="text-xs text-[#8A8A8A]">{formatAED(spent)} / {formatAED(b.monthlyLimit)}</span></div>
                  <ProgressBar value={pct} color={color} />
                </div>
              );
            })}
          </div>
        )}
        {tab === 'debts' && (
          budgetsLoading ? <SkeletonCard /> :
          debts.length === 0 ? <EmptyState icon={Wallet} title="No debts tracked" subtitle="Add any loans or credit card balances." /> :
          <div className="flex flex-col gap-3">
            {debts.map((d) => {
              const pct = d.totalAmount > 0 ? Math.round(((d.totalAmount - d.remainingBalance) / d.totalAmount) * 100) : 0;
              return (
                <div key={d.id} className="bg-[#141414] rounded-card border border-[#2A2A2A] p-4">
                  <div className="flex justify-between mb-1"><span className="text-sm font-semibold text-[#F0F0F0]">{d.name}</span><Badge label={d.status} color={d.status === 'Paid Off' ? '#1ABC9C' : '#FF4F6D'} /></div>
                  <p className="text-xs text-[#8A8A8A] mb-2">Remaining: {formatAED(d.remainingBalance)} of {formatAED(d.totalAmount)}</p>
                  <ProgressBar value={pct} color="#1ABC9C" showLabel />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={() => { setEditTx(null); setDefaultType('Expense'); setTxModalOpen(true); }} className="fixed bottom-[80px] right-4 w-14 h-14 bg-[#FF6B35] rounded-full flex items-center justify-center shadow-fab active:scale-95 transition-transform sm:hidden z-30"><Plus size={24} className="text-white" /></button>

      <TransactionModal open={txModalOpen} onClose={() => setTxModalOpen(false)} tx={editTx} userId={user?.uid ?? ''} defaultType={defaultType} />
      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => { if (deleteTarget) { await deleteDocById(COLLECTIONS.TRANSACTIONS, deleteTarget.id); toast.success('Transaction deleted.'); setDeleteTarget(null); } }} title="Delete Transaction" message="Delete this transaction?" />
    </div>
  );
}
