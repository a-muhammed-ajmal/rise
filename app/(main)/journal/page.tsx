'use client';

import { useState } from 'react';
import { Plus, BookOpen, Mic, MicOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { createDoc, updateDocById, deleteDocById } from '@/lib/firestore';
import { COLLECTIONS, MOODS, MOOD_EMOJIS } from '@/lib/constants';
import { todayISO, cn } from '@/lib/utils';
import type { Journal, Mood } from '@/lib/types';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

function JournalModal({ open, onClose, entry, userId }: { open: boolean; onClose: () => void; entry: Journal | null; userId: string; }) {
  const [form, setForm] = useState({ date: entry?.date ?? todayISO(), text: entry?.text ?? '', energy: entry?.energy ?? 3, mood: (entry?.mood ?? '') as Mood | '' });
  const [saving, setSaving] = useState(false);

  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceRecorder({
    onTranscript: (text) => setForm((f) => ({ ...f, text: f.text + (f.text ? ' ' : '') + text })),
  });

  const handleSave = async () => {
    if (!form.text.trim()) { toast.error('Journal text is required.'); return; }
    setSaving(true);
    try {
      const data = { userId, date: form.date, text: sanitize(form.text), energy: form.energy, mood: form.mood || undefined };
      if (entry) await updateDocById(COLLECTIONS.JOURNAL_ENTRIES, entry.id, data);
      else await createDoc(COLLECTIONS.JOURNAL_ENTRIES, data);
      toast.success('Journal entry saved.');
      onClose();
    } catch { toast.error('Failed to save entry.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={entry ? 'Edit Entry' : 'New Entry'} footer={<div className="flex gap-3"><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth loading={saving} onClick={handleSave}>Save</Button></div>}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#F0F0F0]">Energy: {form.energy}/5</label>
          <div className="flex gap-2">
            {[1,2,3,4,5].map((n) => (
              <button key={n} onClick={() => setForm((f) => ({ ...f, energy: n }))} className={cn('flex-1 h-10 rounded-button text-sm font-semibold transition-colors border', form.energy === n ? 'bg-[#FF6B35] border-[#FF6B35] text-white' : 'bg-[#141414] border-[#2A2A2A] text-[#8A8A8A]')}>{n}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#F0F0F0]">Mood</label>
          <div className="grid grid-cols-4 gap-2">
            {MOODS.map((m) => (
              <button key={m} onClick={() => setForm((f) => ({ ...f, mood: f.mood === m ? '' : m as Mood }))} className={cn('flex flex-col items-center gap-1 p-2 rounded-card border text-xs transition-colors', form.mood === m ? 'bg-[#FF6B35]/15 border-[#FF6B35] text-[#FF6B35]' : 'bg-[#141414] border-[#2A2A2A] text-[#8A8A8A]')}>
                <span>{MOOD_EMOJIS[m]}</span><span>{m}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[#F0F0F0]">Entry *</label>
            <button
              onMouseDown={startRecording} onMouseUp={stopRecording}
              onTouchStart={startRecording} onTouchEnd={stopRecording}
              className={cn('w-8 h-8 rounded-full flex items-center justify-center', isRecording ? 'bg-[#FF4F6D] text-white' : 'bg-[#1C1C1C] text-[#8A8A8A]')}
            >
              {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          </div>
          <Textarea value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} rows={8} placeholder="Write your thoughts..." />
          {isTranscribing && <p className="text-xs text-[#8A8A8A]">Transcribing...</p>}
        </div>
      </div>
    </Modal>
  );
}

export default function JournalPage() {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Journal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Journal | null>(null);

  const { data: entries, loading } = useCollection<Journal>({ userId: user?.uid ?? '', collectionName: COLLECTIONS.JOURNAL_ENTRIES, enabled: !!user });
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  // 7-day calendar strip
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const entryDates = new Set(entries.map((e) => e.date));

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="px-4 pt-4 pb-3 border-b border-[#2A2A2A]">
        <h1 className="text-xl font-bold text-[#F0F0F0] mb-3">Journal</h1>
        <div className="flex gap-3">
          {days.map((date) => {
            const d = new Date(date + 'T00:00:00');
            const isToday = date === todayISO();
            const hasEntry = entryDates.has(date);
            return (
              <div key={date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-[#8A8A8A]">{'SMTWTFS'[d.getDay()]}</span>
                <span className={cn('text-sm font-semibold', isToday ? 'text-[#FF6B35]' : 'text-[#F0F0F0]')}>{d.getDate()}</span>
                <span className={cn('w-1.5 h-1.5 rounded-full', hasEntry ? 'bg-[#800080]' : 'bg-transparent')} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex-1 px-4 py-4 pb-6 flex flex-col gap-3">
        {loading ? <>{[1,2,3].map((i) => <SkeletonCard key={i} />)}</> :
         sorted.length === 0 ? <EmptyState icon={BookOpen} title="No journal entries yet" subtitle="Write your first entry today." actionLabel="Write Entry" onAction={() => { setEditEntry(null); setModalOpen(true); }} /> :
         sorted.map((entry) => (
          <div key={entry.id} onClick={() => { setEditEntry(entry); setModalOpen(true); }} className="bg-[#141414] rounded-card border border-[#2A2A2A] p-4 active:bg-[#1C1C1C] transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{entry.mood ? MOOD_EMOJIS[entry.mood] : '📝'}</span>
              <span className="text-xs text-[#8A8A8A]">{entry.date}</span>
              <div className="flex ml-auto">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={cn('text-xs', i < entry.energy ? 'text-[#FF6B35]' : 'text-[#2A2A2A]')}>●</span>
                ))}
              </div>
            </div>
            <p className="text-sm text-[#F0F0F0] line-clamp-3">{entry.text}</p>
          </div>
         ))
        }
      </div>
      <button onClick={() => { setEditEntry(null); setModalOpen(true); }} className="fixed bottom-[80px] right-4 w-14 h-14 bg-[#800080] rounded-full flex items-center justify-center shadow-fab active:scale-95 transition-transform sm:hidden z-30"><Plus size={24} className="text-white" /></button>
      <JournalModal open={modalOpen} onClose={() => setModalOpen(false)} entry={editEntry} userId={user?.uid ?? ''} />
      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => { if (deleteTarget) { await deleteDocById(COLLECTIONS.JOURNAL_ENTRIES, deleteTarget.id); toast.success('Entry deleted.'); setDeleteTarget(null); } }} title="Delete Entry" message="Delete this journal entry?" />
    </div>
  );
}
