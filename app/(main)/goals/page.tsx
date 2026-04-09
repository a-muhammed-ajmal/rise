'use client';

import { useState } from 'react';
import { Plus, Eye, Target } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { updateDocById, createDoc, deleteDocById } from '@/lib/firestore';
import { COLLECTIONS, VISION_CATEGORIES, GOAL_TIMELINES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Goal, VisionCategory, GoalTimeline } from '@/lib/types';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';

type FilterType = 'all' | '1yr' | '3yr' | '5yr' | VisionCategory;

function VisionModal({
  open, onClose, goal, userId,
}: {
  open: boolean; onClose: () => void; goal: Goal | null; userId: string;
}) {
  const [form, setForm] = useState({
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    why: goal?.why ?? '',
    metric: goal?.metric ?? '',
    crystal: goal?.crystal ?? '',
    category: (goal?.category ?? 'Personal') as VisionCategory,
    timeline: (goal?.timeline ?? '1yr') as GoalTimeline,
    targetDate: goal?.targetDate ?? '',
    progress: goal?.progress ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { setErrors({ title: 'Title is required' }); return; }
    setSaving(true);
    try {
      const data = {
        userId,
        title: sanitize(form.title, 200),
        description: sanitize(form.description),
        why: sanitize(form.why),
        metric: sanitize(form.metric),
        crystal: sanitize(form.crystal),
        category: form.category,
        timeline: form.timeline,
        targetDate: form.targetDate || undefined,
        progress: form.progress,
        progressHistory: goal?.progressHistory ?? [],
        isCompleted: goal?.isCompleted ?? false,
      };
      if (goal) await updateDocById(COLLECTIONS.GOALS, goal.id, data);
      else await createDoc(COLLECTIONS.GOALS, data);
      toast.success('Vision saved.');
      onClose();
    } catch { toast.error('Failed to save vision.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={goal ? 'Edit Vision' : 'New Vision'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth loading={saving} onClick={handleSave}>Save</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Title" value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} required placeholder="What do you want to achieve?" />
        <Textarea label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
        <Textarea label="Why (your motivation)" value={form.why} onChange={(e) => set('why', e.target.value)} rows={2} placeholder="Why does this matter to you?" />
        <Input label="Success Metric" value={form.metric} onChange={(e) => set('metric', e.target.value)} placeholder="How will you measure success?" />
        <Textarea label="Crystal Clear Statement" value={form.crystal} onChange={(e) => set('crystal', e.target.value)} rows={2} placeholder="Describe the end state clearly..." />
        <Select label="Category" value={form.category} onChange={(e) => set('category', (e.target as HTMLSelectElement).value)} options={VISION_CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <Select label="Timeline" value={form.timeline} onChange={(e) => set('timeline', (e.target as HTMLSelectElement).value)} options={GOAL_TIMELINES.map((t) => ({ value: t, label: t === '1yr' ? '1 Year' : t === '3yr' ? '3 Years' : '5 Years' }))} />
        <Input label="Target Date (optional)" type="date" value={form.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#F0F0F0]">Progress: {form.progress}%</label>
          <input type="range" min={0} max={100} value={form.progress} onChange={(e) => set('progress', parseInt(e.target.value))} className="w-full accent-[#FF6B35]" />
        </div>
      </div>
    </Modal>
  );
}

function VisionCard({ goal, onEdit, onDelete }: { goal: Goal; onEdit: (g: Goal) => void; onDelete: (g: Goal) => void; }) {
  const timelineColors = { '1yr': '#FF6B35', '3yr': '#1E4AFF', '5yr': '#800080' };
  return (
    <div onClick={() => onEdit(goal)} className="bg-[#141414] rounded-card border border-[#2A2A2A] p-4 flex flex-col gap-3 active:bg-[#1C1C1C] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold', goal.isCompleted && 'line-through text-[#8A8A8A]')}>{goal.title}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge label={goal.category} color="#FF6B35" />
            <Badge label={goal.timeline} color={timelineColors[goal.timeline]} />
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(goal); }} className="w-8 h-8 flex items-center justify-center text-[#505050] hover:text-[#FF4F6D] flex-shrink-0">
          ✕
        </button>
      </div>
      <ProgressBar value={goal.progress} showLabel color="#FF6B35" />
    </div>
  );
}

export default function VisionsPage() {
  const { user } = useAuth();
  const { data: goals, loading } = useCollection<Goal>({ userId: user?.uid ?? '', collectionName: COLLECTIONS.GOALS, enabled: !!user });
  const [filter, setFilter] = useState<FilterType>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);

  const filtered = goals.filter((g) => {
    if (filter === 'all') return true;
    if (['1yr','3yr','5yr'].includes(filter)) return g.timeline === filter;
    return g.category === filter;
  });

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: '1yr', label: '1 Year' },
    { id: '3yr', label: '3 Years' },
    { id: '5yr', label: '5 Years' },
  ];

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-[#F0F0F0] mb-3">Visions</h1>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4">
          {filters.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={cn('flex-shrink-0 h-8 px-4 rounded-chip text-xs font-medium transition-colors', filter === f.id ? 'bg-[#FF6B35] text-white' : 'bg-[#141414] text-[#8A8A8A] border border-[#2A2A2A]')}>{f.label}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 px-4 pb-6 flex flex-col gap-3">
        {loading ? (
          <>{[1,2,3].map((i) => <SkeletonCard key={i} />)}</>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Eye} title="No visions yet" subtitle="Define what you're building toward." actionLabel="Add Vision" onAction={() => { setEditGoal(null); setModalOpen(true); }} />
        ) : (
          filtered.map((g) => <VisionCard key={g.id} goal={g} onEdit={(goal) => { setEditGoal(goal); setModalOpen(true); }} onDelete={setDeleteTarget} />)
        )}
      </div>
      <button onClick={() => { setEditGoal(null); setModalOpen(true); }} className="fixed bottom-[80px] right-4 w-14 h-14 bg-[#FF6B35] rounded-full flex items-center justify-center shadow-fab active:scale-95 transition-transform sm:hidden z-30"><Plus size={24} className="text-white" /></button>
      <VisionModal open={modalOpen} onClose={() => setModalOpen(false)} goal={editGoal} userId={user?.uid ?? ''} />
      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => { if (deleteTarget) { await deleteDocById(COLLECTIONS.GOALS, deleteTarget.id); toast.success('Vision deleted.'); setDeleteTarget(null); } }} title="Delete Vision" message={`Delete "${deleteTarget?.title}"?`} />
    </div>
  );
}
