'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firestore';
import { Goal, GoalTimeline } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { cn, formatDate } from '@/lib/utils';
import { Target, Plus, Trash2, TrendingUp } from 'lucide-react';

const GOAL_AREAS = [
  { value: 'health', label: '💪 Health', color: '#4A9B8E' },
  { value: 'work', label: '💼 Work', color: '#1E3A5F' },
  { value: 'personal', label: '🧑 Personal', color: '#FF8C42' },
  { value: 'financial', label: '💰 Financial', color: '#2D7C3E' },
  { value: 'relationship', label: '💖 Relationship', color: '#E8849B' },
];

const TIMELINES: { key: GoalTimeline | 'all'; label: string }[] = [
  { key: 'all', label: 'All Goals' },
  { key: '1yr', label: '1 Year' },
  { key: '3yr', label: '3 Year' },
  { key: '5yr', label: '5 Year' },
];

export default function GoalsPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: goals, loading } = useCollection<Goal>('goals', uid);
  const [timelineFilter, setTimelineFilter] = useState<GoalTimeline | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('health');
  const [why, setWhy] = useState('');
  const [metric, setMetric] = useState('');
  const [crystal, setCrystal] = useState('');
  const [timeline, setTimeline] = useState<GoalTimeline>('1yr');
  const [targetDate, setTargetDate] = useState('');

  const filtered = goals.filter(g => {
    if (timelineFilter !== 'all' && g.timeline !== timelineFilter) return false;
    return true;
  });

  const handleAdd = async () => {
    if (!title.trim() || !user) return;
    await addDocument('goals', {
      title: title.trim(), area, why, metric, crystal, timeline, targetDate,
      progress: 0, progressHistory: [], isCompleted: false,
    } as Partial<Goal>, user.uid);
    setTitle(''); setWhy(''); setMetric(''); setCrystal(''); setTargetDate('');
    setModalOpen(false);
  };

  const updateProgress = async (goal: Goal, progress: number) => {
    const entry = { date: new Date().toISOString().split('T')[0], progress };
    await updateDocument('goals', goal.id, {
      progress,
      progressHistory: [...(goal.progressHistory || []), entry],
      isCompleted: progress >= 100,
    });
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Goals</h1>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-rise text-white rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={18} /> New Goal
        </button>
      </div>

      {/* NICE Framework Info */}
      <div className="bg-rise/5 border border-rise/20 rounded-2xl p-4 mb-5">
        <p className="text-xs font-bold text-rise mb-2">NICE FRAMEWORK</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs text-text-2">
          <span><b className="text-text">N</b>ear-term (90 days)</span>
          <span><b className="text-text">I</b>nput-based actions</span>
          <span><b className="text-text">C</b>ontrollable by you</span>
          <span><b className="text-text">E</b>nergizing & motivating</span>
        </div>
      </div>

      {/* Timeline Filter */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
        {TIMELINES.map(t => (
          <button key={t.key} onClick={() => setTimelineFilter(t.key)}
            className={cn('px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border',
              timelineFilter === t.key ? 'bg-rise text-white border-rise' : 'bg-surface-2 text-text-2 border-border')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Goal Cards */}
      {loading ? (
        <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-32 rounded-2xl bg-surface-2 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" description="Set your first goal using the NICE framework" />
      ) : (
        <div className="space-y-4">
          {filtered.map(goal => {
            const areaConfig = GOAL_AREAS.find(a => a.value === goal.area);
            return (
              <div key={goal.id} className="bg-surface-2 rounded-2xl p-5 border border-border">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className={cn('font-bold text-text', goal.isCompleted && 'line-through text-text-3')}>{goal.title}</h3>
                    <div className="flex gap-2 mt-1.5">
                      {areaConfig && <Badge color={areaConfig.color}>{areaConfig.label}</Badge>}
                      <Badge color="#7B4B9E">{goal.timeline}</Badge>
                      {goal.targetDate && <span className="text-xs text-text-3">{formatDate(goal.targetDate)}</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteDocument('goals', goal.id)} className="text-text-3 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                </div>
                {goal.why && <p className="text-xs text-text-3 mb-3">Why: {goal.why}</p>}
                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-2 font-medium">Progress</span>
                    <span className="font-bold" style={{ color: areaConfig?.color }}>{goal.progress}%</span>
                  </div>
                  <div className="h-3 bg-surface-3 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${goal.progress}%`, backgroundColor: areaConfig?.color || '#FF9933' }} />
                  </div>
                  <input type="range" min="0" max="100" value={goal.progress}
                    onChange={(e) => updateProgress(goal, Number(e.target.value))}
                    className="w-full accent-rise" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Goal Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Goal (NICE)" size="md">
        <div className="space-y-4">
          <Input label="Goal Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="What do you want to achieve?" autoFocus />
          <Select label="Area" value={area} onChange={e => setArea(e.target.value)}
            options={GOAL_AREAS.map(a => ({ value: a.value, label: a.label }))} />
          <TextArea label="Why this goal?" value={why} onChange={e => setWhy(e.target.value)} placeholder="Your motivation..." />
          <Input label="Success Metric" value={metric} onChange={e => setMetric(e.target.value)} placeholder="How will you measure it?" />
          <Input label="Crystal Clear Vision" value={crystal} onChange={e => setCrystal(e.target.value)} placeholder="Describe what success looks like" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Timeline" value={timeline} onChange={e => setTimeline(e.target.value as GoalTimeline)}
              options={[{ value: '1yr', label: '1 Year' }, { value: '3yr', label: '3 Years' }, { value: '5yr', label: '5 Years' }]} />
            <Input label="Target Date" type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAdd} disabled={!title.trim()} className="flex-1">Create Goal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
