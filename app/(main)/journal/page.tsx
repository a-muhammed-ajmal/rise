'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, deleteDocument, updateDocument } from '@/lib/firestore';
import { Journal } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { cn, formatDate } from '@/lib/utils';
import { Plus, BookOpen, Trash2, Zap, Pencil } from 'lucide-react';
import { format } from 'date-fns';

const ENERGY_LABELS = ['', '😴 Very Low', '😔 Low', '😐 Medium', '😊 Good', '🔥 Excellent'];

const MOOD_OPTIONS = ['Happy', 'Calm', 'Focused', 'Grateful', 'Energetic', 'Anxious', 'Tired', 'Sad', 'Frustrated', 'Neutral'];

export default function JournalPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: entries, loading } = useCollection<Journal>('journals', uid);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<Journal | null>(null);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [text, setText] = useState('');
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState('');

  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  const resetForm = () => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setText('');
    setEnergy(3);
    setMood('');
    setEditingEntry(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (entry: Journal) => {
    setEditingEntry(entry);
    setDate(entry.date);
    setText(entry.text);
    setEnergy(entry.energy);
    setMood(entry.mood || '');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!text.trim() || !user) return;
    const payload: Partial<Journal> = { date, text, energy, mood: mood || undefined };

    if (editingEntry) {
      await updateDocument('journals', editingEntry.id, payload);
    } else {
      await addDocument('journals', payload, user.uid);
    }

    handleCloseModal();
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteDocument('journals', deleteConfirmId);
    setDeleteConfirmId(null);
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Journal</h1>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2.5 bg-rise text-white rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={18} /> Write
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-24 rounded-2xl bg-surface-2 animate-pulse" />)}</div>
      ) : sortedEntries.length === 0 ? (
        <EmptyState icon={BookOpen} title="No journal entries" description="Start writing about your day" />
      ) : (
        <div className="space-y-3">
          {sortedEntries.map(entry => (
            <div key={entry.id} className="bg-surface-2 rounded-2xl p-5 border border-border group cursor-pointer" onClick={() => openEditModal(entry)}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-text">{formatDate(entry.date)}</p>
                  <span className="text-sm">{ENERGY_LABELS[entry.energy] || ''}</span>
                  {entry.mood && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rise/10 text-rise">
                      {entry.mood}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(entry); }}
                    className="text-text-3 hover:text-rise p-1"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(entry.id); }}
                    className="text-text-3 hover:text-red-500 p-1"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-text-2 whitespace-pre-wrap">{entry.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={handleCloseModal} title={editingEntry ? 'Edit Journal Entry' : 'New Journal Entry'}>
        <div className="space-y-4">
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <TextArea label="How was your day?" value={text} onChange={e => setText(e.target.value)} placeholder="Write your thoughts..." className="min-h-[150px]" />

          {/* Mood Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-2">Mood</label>
            <div className="flex flex-wrap gap-2">
              {MOOD_OPTIONS.map(option => (
                <button
                  key={option}
                  onClick={() => setMood(mood === option ? '' : option)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    mood === option
                      ? 'bg-rise text-white border-rise'
                      : 'bg-surface-3 text-text-3 border-border hover:border-text-3'
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Energy Level */}
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
            <Button variant="secondary" onClick={handleCloseModal} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={!text.trim()} className="flex-1">
              {editingEntry ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Entry" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-text-2">Are you sure you want to delete this journal entry? This action cannot be undone.</p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)} className="flex-1">Cancel</Button>
            <Button onClick={handleDelete} className="flex-1 !bg-red-500 hover:!bg-red-600">Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
