'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, deleteDocument } from '@/lib/firestore';
import { Journal } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { cn, formatDate } from '@/lib/utils';
import { Plus, BookOpen, Trash2, Zap } from 'lucide-react';
import { format } from 'date-fns';

const ENERGY_LABELS = ['', '😴 Very Low', '😔 Low', '😐 Medium', '😊 Good', '🔥 Excellent'];

export default function JournalPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: entries, loading } = useCollection<Journal>('journals', uid);
  const [modalOpen, setModalOpen] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [text, setText] = useState('');
  const [energy, setEnergy] = useState(3);

  const handleAdd = async () => {
    if (!text.trim() || !user) return;
    await addDocument('journals', { date, text, energy } as Partial<Journal>, user.uid);
    setText(''); setEnergy(3);
    setModalOpen(false);
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Journal</h1>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-rise text-white rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={18} /> Write
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-24 rounded-2xl bg-surface-2 animate-pulse" />)}</div>
      ) : entries.length === 0 ? (
        <EmptyState icon={BookOpen} title="No journal entries" description="Start writing about your day" />
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.id} className="bg-surface-2 rounded-2xl p-5 border border-border group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-text">{formatDate(entry.date)}</p>
                  <span className="text-sm">{ENERGY_LABELS[entry.energy] || ''}</span>
                </div>
                <button onClick={() => deleteDocument('journals', entry.id)} className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500"><Trash2 size={15} /></button>
              </div>
              <p className="text-sm text-text-2 whitespace-pre-wrap">{entry.text}</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Journal Entry">
        <div className="space-y-4">
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <TextArea label="How was your day?" value={text} onChange={e => setText(e.target.value)} placeholder="Write your thoughts..." className="min-h-[150px]" />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-2">Energy Level</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(i => (
                <button key={i} onClick={() => setEnergy(i)}
                  className={cn('flex-1 py-3 rounded-xl text-sm font-medium border transition-all text-center',
                    energy === i ? 'bg-rise text-white border-rise scale-105' : 'bg-surface-3 text-text-3 border-border')}>
                  {ENERGY_LABELS[i]?.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAdd} disabled={!text.trim()} className="flex-1">Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
