'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, deleteDocument } from '@/lib/firestore';
import { Transaction, TransactionType, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { cn, formatCurrency } from '@/lib/utils';
import { Plus, Wallet, TrendingUp, TrendingDown, ArrowUpDown, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function FinancePage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: transactions, loading } = useCollection<Transaction>('transactions', uid);
  const [filter, setFilter] = useState<'all' | 'Income' | 'Expense'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState<TransactionType>('Expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');

  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthTxns = transactions.filter(t => t.date?.startsWith(currentMonth));
  const totalIncome = monthTxns.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTxns.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const filtered = transactions.filter(t => filter === 'all' || t.type === filter);
  const categories = type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleAdd = async () => {
    if (!user) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    await addDocument('transactions', {
      type, amount: parsedAmount, category: category || categories[0],
      date, description, status: 'Pending',
    } as Partial<Transaction>, user.uid);
    setAmount(''); setDescription(''); setCategory('');
    setModalOpen(false);
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Finance</h1>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-rise text-white rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={18} /> Add
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
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
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'Income', 'Expense'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-4 py-2 rounded-full text-sm font-semibold border',
              filter === f ? 'bg-rise text-white border-rise' : 'bg-surface-2 text-text-2 border-border')}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-2 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wallet} title="No transactions" description="Start tracking your income and expenses" />
      ) : (
        <div className="space-y-2">
          {filtered.map(txn => (
            <div key={txn.id} className="flex items-center gap-4 p-4 bg-surface-2 rounded-xl border border-border group">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                txn.type === 'Income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
                {txn.type === 'Income' ? <TrendingUp size={18} className="text-green-600" /> : <TrendingDown size={18} className="text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{txn.description || txn.category}</p>
                <p className="text-xs text-text-3">{txn.category} · {txn.date}</p>
              </div>
              <p className={cn('text-sm font-bold shrink-0', txn.type === 'Income' ? 'text-green-600' : 'text-red-500')}>
                {txn.type === 'Income' ? '+' : '-'}{formatCurrency(txn.amount)}
              </p>
              <button onClick={() => deleteDocument('transactions', txn.id)} className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500 p-1">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Transaction Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Transaction" size="md">
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
          <Select label="Category" value={category} onChange={e => setCategory(e.target.value)}
            options={categories.map(c => ({ value: c, label: c }))} />
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this for?" />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAdd} disabled={!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0} className="flex-1">Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
