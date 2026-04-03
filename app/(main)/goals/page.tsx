'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firestore';
import { Goal, GoalTimeline, Milestone } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { cn, formatDate } from '@/lib/utils';
import { Target, Plus, Trash2, TrendingUp, Edit2, CheckCircle2, Circle, ChevronDown, ChevronUp, Flag } from 'lucide-react';
import { format } from 'date-fns';

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

const MILESTONE_TYPES = [
  { value: 'checkpoint', label: 'Checkpoint' },
  { value: 'deliverable', label: 'Deliverable' },
  { value: 'review', label: 'Review' },
];

export default function GoalsPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: goals, loading } = useCollection<Goal>('goals', uid);
  const { data: allMilestones } = useCollection<Milestone>('milestones', uid);

  const [timelineFilter, setTimelineFilter] = useState<GoalTimeline | 'all'>('all');

  // Goal modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('health');
  const [why, setWhy] = useState('');
  const [metric, setMetric] = useState('');
  const [crystal, setCrystal] = useState('');
  const [timeline, setTimeline] = useState<GoalTimeline>('1yr');
  const [targetDate, setTargetDate] = useState('');

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'goal' | 'milestone'; id: string; label: string } | null>(null);

  // Expanded milestones per goal
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  // Milestone form state per goal
  const [milestoneFormGoalId, setMilestoneFormGoalId] = useState<string | null>(null);
  const [msText, setMsText] = useState('');
  const [msDate, setMsDate] = useState('');
  const [msType, setMsType] = useState('checkpoint');

  // Group milestones by goalId
  const milestonesByGoal = useMemo(() => {
    const map: Record<string, Milestone[]> = {};
    for (const ms of allMilestones) {
      if (!map[ms.goalId]) map[ms.goalId] = [];
      map[ms.goalId].push(ms);
    }
    // Sort each group by date
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.date.localeCompare(b.date));
    }
    return map;
  }, [allMilestones]);

  const filtered = goals.filter(g => {
    if (timelineFilter !== 'all' && g.timeline !== timelineFilter) return false;
    return true;
  });

  const resetForm = () => {
    setTitle(''); setArea('health'); setWhy(''); setMetric(''); setCrystal('');
    setTimeline('1yr'); setTargetDate(''); setEditingGoal(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setArea(goal.area);
    setWhy(goal.why);
    setMetric(goal.metric);
    setCrystal(goal.crystal);
    setTimeline(goal.timeline);
    setTargetDate(goal.targetDate || '');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !user) return;
    if (editingGoal) {
      await updateDocument('goals', editingGoal.id, {
        title: title.trim(), area, why, metric, crystal, timeline, targetDate,
      });
    } else {
      await addDocument('goals', {
        title: title.trim(), area, why, metric, crystal, timeline, targetDate,
        progress: 0, progressHistory: [], isCompleted: false,
      } as Partial<Goal>, user.uid);
    }
    resetForm();
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

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'goal') {
      await deleteDocument('goals', deleteConfirm.id);
      // Also delete associated milestones
      const goalMs = milestonesByGoal[deleteConfirm.id] || [];
      for (const ms of goalMs) {
        await deleteDocument('milestones', ms.id);
      }
    } else {
      await deleteDocument('milestones', deleteConfirm.id);
    }
    setDeleteConfirm(null);
  };

  const toggleExpand = (goalId: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  };

  const handleAddMilestone = async (goalId: string) => {
    if (!msText.trim() || !msDate || !user) return;
    await addDocument('milestones', {
      goalId, text: msText.trim(), date: msDate, type: msType, done: false,
    } as Partial<Milestone>, user.uid);
    setMsText(''); setMsDate(''); setMsType('checkpoint');
    setMilestoneFormGoalId(null);
  };

  const toggleMilestoneDone = async (ms: Milestone) => {
    await updateDocument('milestones', ms.id, { done: !ms.done });
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Goals</h1>
        <button onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-rise text-[#0A0A0F] rounded-xl text-sm font-semibold shadow-sm">
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
              timelineFilter === t.key ? 'bg-rise text-[#0A0A0F] border-rise' : 'bg-surface-2 text-text-2 border-border')}>
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
            const goalMilestones = milestonesByGoal[goal.id] || [];
            const isExpanded = expandedGoals.has(goal.id);
            const recentHistory = (goal.progressHistory || []).slice(-5);

            return (
              <div key={goal.id} className="bg-surface-2 rounded-2xl p-5 border border-border">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className={cn('font-bold text-text', goal.isCompleted && 'line-through text-text-3')}>{goal.title}</h3>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {areaConfig && <Badge color={areaConfig.color}>{areaConfig.label}</Badge>}
                      <Badge color="#7B4B9E">{goal.timeline}</Badge>
                      {goal.targetDate && <span className="text-xs text-text-3">{formatDate(goal.targetDate)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button onClick={() => openEditModal(goal)} className="text-text-3 hover:text-rise p-1" title="Edit goal">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => setDeleteConfirm({ type: 'goal', id: goal.id, label: goal.title })}
                      className="text-text-3 hover:text-red-500 p-1" title="Delete goal">
                      <Trash2 size={16} />
                    </button>
                  </div>
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

                {/* Progress History (last 5 entries) */}
                {recentHistory.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendingUp size={14} className="text-text-3" />
                      <span className="text-xs font-semibold text-text-2">Recent Progress</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentHistory.map((entry, i) => (
                        <span key={i} className="text-xs bg-surface-3 text-text-2 px-2 py-1 rounded-lg">
                          {format(new Date(entry.date), 'MMM d')} — {entry.progress}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Milestones Section */}
                <div className="mt-3 pt-3 border-t border-border">
                  <button
                    onClick={() => toggleExpand(goal.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-text-2 hover:text-text transition-colors w-full"
                  >
                    <Flag size={14} />
                    <span>Milestones ({goalMilestones.length})</span>
                    <span className="ml-auto">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-2">
                      {/* Milestone list */}
                      {goalMilestones.length === 0 && (
                        <p className="text-xs text-text-3 italic">No milestones yet</p>
                      )}
                      {goalMilestones.map(ms => (
                        <div key={ms.id} className="flex items-start gap-2 group">
                          <button onClick={() => toggleMilestoneDone(ms)} className="mt-0.5 shrink-0">
                            {ms.done
                              ? <CheckCircle2 size={16} className="text-green-500" />
                              : <Circle size={16} className="text-text-3" />
                            }
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm text-text', ms.done && 'line-through text-text-3')}>{ms.text}</p>
                            <div className="flex gap-2 mt-0.5">
                              <span className="text-xs text-text-3">{formatDate(ms.date)}</span>
                              <Badge color={ms.type === 'deliverable' ? '#2D7C3E' : ms.type === 'review' ? '#7B4B9E' : '#1E3A5F'}>
                                {ms.type}
                              </Badge>
                            </div>
                          </div>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'milestone', id: ms.id, label: ms.text })}
                            className="text-text-3 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Delete milestone"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}

                      {/* Add milestone form */}
                      {milestoneFormGoalId === goal.id ? (
                        <div className="mt-3 p-3 bg-surface-3 rounded-xl space-y-3">
                          <Input label="Milestone" value={msText} onChange={e => setMsText(e.target.value)} placeholder="What needs to happen?" autoFocus />
                          <div className="grid grid-cols-2 gap-3">
                            <Input label="Date" type="date" value={msDate} onChange={e => setMsDate(e.target.value)} />
                            <Select label="Type" value={msType} onChange={e => setMsType(e.target.value)}
                              options={MILESTONE_TYPES} />
                          </div>
                          <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => { setMilestoneFormGoalId(null); setMsText(''); setMsDate(''); setMsType('checkpoint'); }} className="flex-1">
                              Cancel
                            </Button>
                            <Button onClick={() => handleAddMilestone(goal.id)} disabled={!msText.trim() || !msDate} className="flex-1">
                              Add
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setMilestoneFormGoalId(goal.id); setMsText(''); setMsDate(''); setMsType('checkpoint'); }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-rise hover:text-rise/80 mt-2"
                        >
                          <Plus size={14} /> Add Milestone
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title={editingGoal ? 'Edit Goal' : 'New Goal (NICE)'} size="md">
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
            <Button variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={!title.trim()} className="flex-1">
              {editingGoal ? 'Save Changes' : 'Create Goal'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-text-2">
            Are you sure you want to delete this {deleteConfirm?.type}?
          </p>
          <p className="text-sm font-semibold text-text break-words">
            &ldquo;{deleteConfirm?.label}&rdquo;
          </p>
          {deleteConfirm?.type === 'goal' && (
            <p className="text-xs text-text-3">This will also delete all milestones associated with this goal.</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)} className="flex-1">Cancel</Button>
            <Button onClick={confirmDelete} className="flex-1 !bg-red-500 hover:!bg-red-600">Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
