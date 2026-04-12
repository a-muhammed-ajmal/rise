'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Eye, Trophy, Pencil, Flag,
  Trash2, Plus, Check, Sparkles, X, Send,
} from 'lucide-react';
import { getIdToken } from '@/lib/verify-auth';
import { format, parseISO } from 'date-fns';
import { deleteField } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { updateDocById, createDoc, deleteDocById } from '@/lib/firestore';
import { COLLECTIONS, VISION_CATEGORIES } from '@/lib/constants';
import type {
  Goal, Milestone, GoalAction, VisionCategory, GoalTimeline,
  MilestoneType, GoalActionPriority,
} from '@/lib/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';
import { cn } from '@/lib/utils';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Personal: '#800080',
  Professional: '#1E4AFF',
  Financial: '#00A86B',
  Relationships: '#FF4F6D',
  Health: '#1ABC9C',
  Learning: '#FFD700',
};

const TIMELINE_LABELS: Record<string, string> = {
  '1yr': '1 Year',
  '3yr': '3 Years',
  '5yr': '5 Years',
};

const STEP_PRIORITY_COLORS: Record<string, string> = {
  High: '#FF4F6D',
  Medium: '#FF9933',
  Low: '#1ABC9C',
};

// ─── NICE INFO BOX ────────────────────────────────────────────────────────────

function NiceInfoBox() {
  const [isNiceExpanded, setIsNiceExpanded] = useState(false);

  const items = [
    { letter: 'N', title: 'Near-term', description: 'Focused on what you can act on now, not 10 years away' },
    { letter: 'I', title: 'Input-based', description: 'Measured by actions you control, not outcomes you cannot' },
    { letter: 'C', title: 'Controllable', description: 'Within your direct influence and ability to execute' },
    { letter: 'E', title: 'Energizing', description: 'Exciting enough to pull you forward when motivation fades' },
  ];

  return (
    <div className="glass-card p-4">
      <button
        onClick={() => setIsNiceExpanded(!isNiceExpanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="text-left">
          <p className="text-sm font-semibold text-[#1C1C1E]">NICE Framework</p>
          <p className="text-xs text-[#6C6C70] mt-0.5">A proven system for setting goals that stick</p>
        </div>
        {isNiceExpanded
          ? <ChevronUp size={16} className="text-[#6C6C70] flex-shrink-0 ml-2" />
          : <ChevronDown size={16} className="text-[#6C6C70] flex-shrink-0 ml-2" />}
      </button>

      {isNiceExpanded && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map(item => (
            <div key={item.letter} className="flex flex-col gap-1.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#FF6B3533', border: '1px solid #FF6B35' }}
              >
                <span className="text-sm font-bold text-[#FF6B35]">{item.letter}</span>
              </div>
              <p className="text-xs font-semibold text-[#1C1C1E]">{item.title}</p>
              <p className="text-xs text-[#6C6C70] leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── VISION MODAL (create / edit) ────────────────────────────────────────────

function VisionModal({
  open, onClose, goal, userId,
}: {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
  userId: string;
}) {
  const [form, setForm] = useState({
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    category: (goal?.category ?? 'Personal') as VisionCategory,
    timeline: (goal?.timeline ?? '1yr') as GoalTimeline,
    targetDate: goal?.targetDate ?? '',
    why: goal?.why ?? '',
    metric: goal?.metric ?? '',
    crystal: goal?.crystal ?? '',
  });
  const [titleError, setTitleError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Vision title is required');
      setTitleError('Title is required');
      return;
    }
    setSaving(true);
    try {
      const data = {
        userId,
        title: sanitize(form.title, 200),
        description: form.description.trim() ? sanitize(form.description) : undefined,
        category: form.category,
        timeline: form.timeline,
        targetDate: form.targetDate || undefined,
        why: sanitize(form.why),
        metric: sanitize(form.metric),
        crystal: sanitize(form.crystal),
        ...(!goal && {
          progress: 0,
          progressHistory: [] as Array<{ date: string; progress: number }>,
          isCompleted: false,
        }),
      };

      if (goal) {
        await updateDocById(COLLECTIONS.GOALS, goal.id, data);
        toast.success('Vision updated');
      } else {
        await createDoc(COLLECTIONS.GOALS, data);
        toast.success('Vision added');
      }
      onClose();
    } catch {
      toast.error(goal ? 'Failed to update vision' : 'Failed to save vision');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? 'Edit Vision' : 'Add Vision'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth loading={saving} onClick={handleSave}>
            {goal ? 'Update Vision' : 'Save Vision'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Vision Title"
          value={form.title}
          onChange={e => { set('title', e.target.value); if (titleError) setTitleError(''); }}
          error={titleError}
          required
          autoFocus
          maxLength={200}
          placeholder="What do you want to achieve?"
        />
        <Textarea
          label="Description (optional)"
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={2}
          placeholder="Describe this vision in more detail"
        />
        <Select
          label="Category"
          value={form.category}
          onChange={e => set('category', (e.target as HTMLSelectElement).value)}
          options={VISION_CATEGORIES.map(c => ({ value: c, label: c }))}
        />

        {/* Timeline pills */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1C1C1E]">Timeline</label>
          <div className="flex gap-2">
            {(['1yr', '3yr', '5yr'] as GoalTimeline[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set('timeline', t)}
                className={cn(
                  'flex-1 h-9 rounded-button text-sm font-medium transition-colors',
                  form.timeline === t
                    ? 'bg-[#FF6B35] text-white'
                    : 'border border-[#E5E5EA] text-[#6C6C70] hover:bg-[#F5F5F5]'
                )}
              >
                {TIMELINE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Target Date (optional)"
          type="date"
          value={form.targetDate}
          onChange={e => set('targetDate', e.target.value)}
        />
        <Textarea
          label="Why — What is your motivation?"
          value={form.why}
          onChange={e => set('why', e.target.value)}
          rows={2}
          placeholder="Why does this vision matter to you?"
        />
        <Input
          label="Success Metric — How will you measure it?"
          value={form.metric}
          onChange={e => set('metric', e.target.value)}
          placeholder="e.g. Run 5km without stopping"
        />
        <Textarea
          label="Crystal Clear — Describe success exactly"
          value={form.crystal}
          onChange={e => set('crystal', e.target.value)}
          rows={2}
          placeholder="Paint the clearest possible picture of what achieving this looks like"
        />
      </div>
    </Modal>
  );
}

// ─── MILESTONES MODAL ────────────────────────────────────────────────────────

function MilestonesModal({
  open, onClose, goal, milestones, goalActions, userId, goals,
}: {
  open: boolean;
  onClose: () => void;
  goal: Goal;
  milestones: Milestone[];
  goalActions: GoalAction[];
  userId: string;
  goals: Goal[];
}) {
  const [activeTab, setActiveTab] = useState<'milestones' | 'steps'>('milestones');
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({
    text: '', date: '', type: 'Checkpoint' as MilestoneType,
  });
  const [stepForm, setStepForm] = useState({
    text: '', priority: 'Medium' as GoalActionPriority, dueDate: '',
  });
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [savingStep, setSavingStep] = useState(false);

  const goalMilestones = milestones
    .filter(m => m.goalId === goal.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcomingMilestones = goalMilestones.filter(m => !m.done);
  const completedMilestones = goalMilestones.filter(m => m.done);

  const goalSteps = goalActions
    .filter(a => a.goalId === goal.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const handleMilestoneToggle = async (milestone: Milestone) => {
    const newDone = !milestone.done;
    try {
      await updateDocById(COLLECTIONS.MILESTONES, milestone.id, { done: newDone });

      // Recalculate goal progress based on milestone completion
      const allForGoal = milestones.filter(m => m.goalId === goal.id);
      const total = allForGoal.length;
      if (total > 0) {
        const doneCount = allForGoal.filter(m =>
          m.id === milestone.id ? newDone : m.done
        ).length;
        const pct = Math.round((doneCount / total) * 100);
        const today = format(new Date(), 'yyyy-MM-dd');
        const currentGoal = goals.find(g => g.id === goal.id) ?? goal;
        await updateDocById(COLLECTIONS.GOALS, goal.id, {
          progress: pct,
          progressHistory: [...(currentGoal.progressHistory || []), { date: today, progress: pct }],
        });
      }
    } catch {
      toast.error('Failed to update milestone');
    }
  };

  const handleAddMilestone = async () => {
    if (!milestoneForm.text.trim()) { toast.error('Milestone text is required'); return; }
    setSavingMilestone(true);
    try {
      await createDoc(COLLECTIONS.MILESTONES, {
        userId,
        goalId: goal.id,
        text: sanitize(milestoneForm.text),
        date: milestoneForm.date,
        type: milestoneForm.type,
        done: false,
      });
      toast.success('Milestone added');
      setMilestoneForm({ text: '', date: '', type: 'Checkpoint' });
      setShowAddMilestone(false);
    } catch {
      toast.error('Failed to add milestone');
    } finally {
      setSavingMilestone(false);
    }
  };

  const handleAddStep = async () => {
    if (!stepForm.text.trim()) { toast.error('Step text is required'); return; }
    setSavingStep(true);
    try {
      await createDoc(COLLECTIONS.GOAL_ACTIONS, {
        userId,
        goalId: goal.id,
        text: sanitize(stepForm.text),
        done: false,
        priority: stepForm.priority,
        dueDate: stepForm.dueDate || undefined,
      });
      toast.success('Step added');
      setStepForm({ text: '', priority: 'Medium', dueDate: '' });
      setShowAddStep(false);
    } catch {
      toast.error('Failed to add step');
    } finally {
      setSavingStep(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Milestones — ${goal.title}`}>
      {/* Tab row */}
      <div className="flex border-b border-[#E5E5EA] mb-4 -mx-4 px-4">
        <button
          onClick={() => setActiveTab('milestones')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'milestones'
              ? 'border-[#FF6B35] text-[#FF6B35]'
              : 'border-transparent text-[#6C6C70] hover:text-[#1C1C1E]'
          )}
        >
          Milestones
        </button>
        <button
          onClick={() => setActiveTab('steps')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'steps'
              ? 'border-[#FF6B35] text-[#FF6B35]'
              : 'border-transparent text-[#6C6C70] hover:text-[#1C1C1E]'
          )}
        >
          Steps
        </button>
      </div>

      {/* MILESTONES TAB */}
      {activeTab === 'milestones' && (
        <div className="flex flex-col gap-4">
          {!showAddMilestone && (
            <Button variant="secondary" size="sm" onClick={() => setShowAddMilestone(true)}>
              <Plus size={14} />
              Add Milestone
            </Button>
          )}

          {showAddMilestone && (
            <div className="flex flex-col gap-3 p-3 rounded-card border border-[#E5E5EA] bg-[#F5F5F5]">
              <Input
                label="Milestone"
                value={milestoneForm.text}
                onChange={e => setMilestoneForm(f => ({ ...f, text: e.target.value }))}
                placeholder="What needs to happen?"
              />
              <Input
                label="Date"
                type="date"
                value={milestoneForm.date}
                onChange={e => setMilestoneForm(f => ({ ...f, date: e.target.value }))}
              />
              <Select
                label="Type"
                value={milestoneForm.type}
                onChange={e => setMilestoneForm(f => ({ ...f, type: (e.target as HTMLSelectElement).value as MilestoneType }))}
                options={[
                  { value: 'Checkpoint', label: 'Checkpoint' },
                  { value: 'Deliverable', label: 'Deliverable' },
                  { value: 'Review', label: 'Review' },
                ]}
              />
              <div className="flex gap-2">
                <Button fullWidth loading={savingMilestone} onClick={handleAddMilestone}>Save</Button>
                <Button variant="secondary" fullWidth onClick={() => setShowAddMilestone(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Upcoming milestones */}
          {upcomingMilestones.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#6C6C70] uppercase tracking-wide mb-2">Upcoming</p>
              <div className="flex flex-col gap-2">
                {upcomingMilestones.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-card border border-[#E5E5EA]">
                    <input
                      type="checkbox"
                      checked={m.done}
                      onChange={() => handleMilestoneToggle(m)}
                      aria-label={`Mark milestone as done: ${m.text}`}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1C1C1E]">{m.text}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.date && (
                          <span className="text-xs text-[#6C6C70]">
                            {format(parseISO(m.date), 'MMM d, yyyy')}
                          </span>
                        )}
                        <span className="text-xs border border-[#E5E5EA] text-[#6C6C70] rounded-chip px-1.5 py-0.5">{m.type}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete milestone"
                      onClick={() => deleteDocById(COLLECTIONS.MILESTONES, m.id)}
                      className="text-[#AEAEB2] hover:text-[#FF4F6D] transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed milestones */}
          {completedMilestones.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#6C6C70] uppercase tracking-wide mb-2">Completed</p>
              <div className="flex flex-col gap-2">
                {completedMilestones.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-card border border-[#E5E5EA] opacity-60">
                    <input
                      type="checkbox"
                      checked={m.done}
                      onChange={() => handleMilestoneToggle(m)}
                      aria-label={`Mark milestone as not done: ${m.text}`}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#6C6C70] line-through">{m.text}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.date && (
                          <span className="text-xs text-[#6C6C70]">
                            {format(parseISO(m.date), 'MMM d, yyyy')}
                          </span>
                        )}
                        <span className="text-xs border border-[#E5E5EA] text-[#6C6C70] rounded-chip px-1.5 py-0.5">{m.type}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete milestone"
                      onClick={() => deleteDocById(COLLECTIONS.MILESTONES, m.id)}
                      className="text-[#AEAEB2] hover:text-[#FF4F6D] transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {goalMilestones.length === 0 && !showAddMilestone && (
            <p className="text-sm text-[#6C6C70] text-center py-4">No milestones yet. Add one above.</p>
          )}
        </div>
      )}

      {/* STEPS TAB */}
      {activeTab === 'steps' && (
        <div className="flex flex-col gap-4">
          {!showAddStep && (
            <Button variant="secondary" size="sm" onClick={() => setShowAddStep(true)}>
              <Plus size={14} />
              Add Step
            </Button>
          )}

          {showAddStep && (
            <div className="flex flex-col gap-3 p-3 rounded-card border border-[#E5E5EA] bg-[#F5F5F5]">
              <Input
                label="Step"
                value={stepForm.text}
                onChange={e => setStepForm(f => ({ ...f, text: e.target.value }))}
                placeholder="What action will move this forward?"
              />
              <Select
                label="Priority"
                value={stepForm.priority}
                onChange={e => setStepForm(f => ({ ...f, priority: (e.target as HTMLSelectElement).value as GoalActionPriority }))}
                options={[
                  { value: 'High', label: 'High' },
                  { value: 'Medium', label: 'Medium' },
                  { value: 'Low', label: 'Low' },
                ]}
              />
              <Input
                label="Due Date (optional)"
                type="date"
                value={stepForm.dueDate}
                onChange={e => setStepForm(f => ({ ...f, dueDate: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button fullWidth loading={savingStep} onClick={handleAddStep}>Save</Button>
                <Button variant="secondary" fullWidth onClick={() => setShowAddStep(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {goalSteps.length > 0 && (
            <div className="flex flex-col gap-2">
              {goalSteps.map(step => (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-center gap-3 p-2.5 rounded-card border border-[#E5E5EA]',
                    step.done && 'opacity-60'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={step.done}
                    onChange={() => updateDocById(COLLECTIONS.GOAL_ACTIONS, step.id, { done: !step.done })}
                    aria-label={`Toggle step: ${step.text}`}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', step.done ? 'text-[#6C6C70] line-through' : 'text-[#1C1C1E]')}>
                      {step.text}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-xs rounded-chip px-1.5 py-0.5"
                        style={{
                          color: STEP_PRIORITY_COLORS[step.priority],
                          backgroundColor: STEP_PRIORITY_COLORS[step.priority] + '22',
                          border: `1px solid ${STEP_PRIORITY_COLORS[step.priority]}33`,
                        }}
                      >
                        {step.priority}
                      </span>
                      {step.dueDate && (
                        <span className="text-xs text-[#6C6C70]">
                          {format(parseISO(step.dueDate), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete step"
                    onClick={() => deleteDocById(COLLECTIONS.GOAL_ACTIONS, step.id)}
                    className="text-[#AEAEB2] hover:text-[#FF4F6D] transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {goalSteps.length === 0 && !showAddStep && (
            <p className="text-sm text-[#6C6C70] text-center py-4">No steps yet. Add one above.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── VISION AI COACH ─────────────────────────────────────────────────────────

function parseInline(text: string) {
  const parts = text.split(/(\*{1,3}[^*\n]+\*{1,3})/g);
  return parts.map((part, i) => {
    if (/^\*{3}[^*]+\*{3}$/.test(part)) return <strong key={i}>{part.slice(3, -3)}</strong>;
    if (/^\*{2}[^*]+\*{2}$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' = 'ul';

  const flushList = (key: number) => {
    if (!listItems.length) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    nodes.push(
      <Tag key={`list-${key}`} className={`${listType === 'ol' ? 'list-decimal' : 'list-disc'} pl-5 space-y-1 my-1`}>
        {listItems.map((item, j) => <li key={j}>{parseInline(item)}</li>)}
      </Tag>
    );
    listItems = [];
  };

  lines.forEach((line, i) => {
    const ul = line.match(/^[-*•]\s+(.*)/);
    const ol = line.match(/^\d+\.\s+(.*)/);
    if (ul) {
      if (listType !== 'ul' && listItems.length) flushList(i);
      listType = 'ul'; listItems.push(ul[1]);
    } else if (ol) {
      if (listType !== 'ol' && listItems.length) flushList(i);
      listType = 'ol'; listItems.push(ol[1]);
    } else {
      flushList(i);
      const t = line.trim();
      if (t) nodes.push(<p key={`p-${i}`} className="mb-1 last:mb-0 leading-relaxed">{parseInline(t)}</p>);
    }
  });
  flushList(lines.length);
  return <>{nodes}</>;
}

// Pre-seeded opening message — displayed immediately, NOT sent to Gemini history
const INITIAL_GREETING = `Welcome! I'm your **Vision AI Coach** — here to guide you step-by-step in setting powerful, life-changing visions using the **NICE framework** (Near-term, Input-based, Controllable, Energizing).

Let's start by choosing one area of your life to focus on. Here are the 6 areas with real examples:

- **Personal** — Build a morning routine, develop self-discipline, grow your mindset
- **Professional** — Get promoted, launch a business, become a team leader
- **Financial** — Save AED 30,000 this year, pay off debt, start investing
- **Relationships** — Weekly quality time with family, deepen friendships, improve communication
- **Health** — Run 5km, lose weight sustainably, sleep consistently, boost daily energy
- **Learning** — Complete a certification, master a new skill, read 24 books this year

**Which area calls to you most right now?** Tap one below or type what is on your mind.`;

// Shown while only the opening greeting is visible (area selection step)
const VISION_AREA_CHIPS = ['Personal', 'Professional', 'Financial', 'Relationships', 'Health', 'Learning'];

// Shown after the conversation is underway (3+ messages)
const VISION_FOLLOW_UP_CHIPS = [
  'Check this against the NICE framework',
  'Suggest milestones for this vision',
  'Help me write the Why and Metric fields',
];

function VisionAIPanel({ goals, onClose }: { goals: Goal[]; onClose: () => void }) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: INITIAL_GREETING },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [input]);

  const buildContext = () => {
    const active = goals.filter(g => !g.isCompleted);
    if (!active.length) return 'The user has no active visions yet.';
    return (
      'User\'s current active visions:\n' +
      active.map(g =>
        `- "${g.title}" | Category: ${g.category} | Timeline: ${g.timeline} | Progress: ${g.progress}%` +
        (g.why ? `\n  Why: ${g.why}` : '') +
        (g.metric ? `\n  Metric: ${g.metric}` : '') +
        (g.crystal ? `\n  Crystal clear: ${g.crystal}` : '')
      ).join('\n')
    );
  };

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      // Skip index 0 (the pre-seeded INITIAL_GREETING) — it's not a real Gemini exchange
      const history = messages.slice(1).map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, history, context: buildContext(), visionMode: true }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'I am here to help with your visions.' }]);
    } catch {
      toast.error('Vision AI Coach is temporarily unavailable. Try again shortly.');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F2F2F7] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5EA] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#FFD700]/15 flex items-center justify-center flex-shrink-0">
            <Sparkles size={15} className="text-[#FFD700]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1C1C1E]">Vision AI Coach</p>
            <p className="text-[10px] text-[#6C6C70]">Powered by Gemini</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center text-[#6C6C70] hover:text-[#1C1C1E] transition-colors"
          aria-label="Close Vision AI Coach"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* No empty-state needed — messages always has the initial greeting */}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex flex-col gap-1 max-w-[85%]', msg.role === 'user' ? 'self-end items-end' : 'self-start items-start')}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 bg-[#FFD700]/15 rounded-full flex items-center justify-center mb-1">
                <Sparkles size={12} className="text-[#FFD700]" />
              </div>
            )}
            <div className={cn(
              'rounded-card px-4 py-3 text-sm',
              msg.role === 'user'
                ? 'bg-[#FF6B35] text-white leading-relaxed'
                : 'bg-[#FFFFFF] text-[#1C1C1E] border border-[#E5E5EA]'
            )}>
              {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="self-start flex flex-col gap-1">
            <div className="w-6 h-6 bg-[#FFD700]/15 rounded-full flex items-center justify-center mb-1">
              <Sparkles size={12} className="text-[#FFD700]" />
            </div>
            <div className="bg-[#FFFFFF] border border-[#E5E5EA] rounded-card px-4 py-3 flex gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 bg-[#6C6C70] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Area-selection chips — shown only on the opening step (just the greeting visible) */}
        {messages.length === 1 && !sending && (
          <div className="flex flex-wrap gap-2 pt-1">
            {VISION_AREA_CHIPS.map(area => (
              <button
                key={area}
                type="button"
                onClick={() => send(area)}
                className="px-3 py-1.5 bg-[#F5F5F5] border border-[#FFD700]/30 rounded-chip text-xs font-medium text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors active:scale-[0.97]"
              >
                {area}
              </button>
            ))}
          </div>
        )}

        {/* Follow-up chips — shown after conversation is underway */}
        {messages.length > 2 && !sending && (
          <div className="flex flex-wrap gap-2 pt-1">
            {VISION_FOLLOW_UP_CHIPS.map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => send(chip)}
                className="px-3 py-1.5 bg-[#FFFFFF] border border-[#E5E5EA] rounded-chip text-xs text-[#6C6C70] hover:text-[#1C1C1E] hover:bg-[#F5F5F5] transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-[#E5E5EA] bg-[#F2F2F7] flex-shrink-0 pb-safe">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            placeholder="Reply to your coach..."
            disabled={sending}
            rows={1}
            className="flex-1 bg-[#F5F5F5] border border-[#E5E5EA] rounded-input px-3 py-2.5 text-sm text-[#1C1C1E] placeholder-[#AEAEB2] outline-none focus:border-[#FFD700] resize-none transition-colors disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            className="w-11 h-11 flex-shrink-0 bg-[#FFD700] rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95"
            aria-label="Send"
          >
            <Send size={17} className="text-black" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VISION CARD ─────────────────────────────────────────────────────────────

function VisionCard({
  goal, milestones, onEdit, onDelete, onMilestones, onMarkComplete,
}: {
  goal: Goal;
  milestones: Milestone[];
  onEdit: () => void;
  onDelete: () => void;
  onMilestones: () => void;
  onMarkComplete: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(goal.progress);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setDisplayProgress(goal.progress);
  }, [goal.progress]);

  const milestoneCount = milestones.filter(m => m.goalId === goal.id).length;
  const categoryColor = CATEGORY_COLORS[goal.category] ?? '#6C6C70';
  const sortedHistory = [...(goal.progressHistory || [])].sort((a, b) => b.date.localeCompare(a.date));

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setDisplayProgress(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const today = format(new Date(), 'yyyy-MM-dd');
      updateDocById(COLLECTIONS.GOALS, goal.id, {
        progress: val,
        progressHistory: [...(goal.progressHistory || []), { date: today, progress: val }],
      }).catch(() => toast.error('Failed to update progress'));
    }, 500);
  };

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      {/* TOP ROW */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-[#1C1C1E] truncate flex-1">{goal.title}</p>
        <span
          className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium"
          style={{
            backgroundColor: categoryColor + '33',
            color: categoryColor,
            border: `1px solid ${categoryColor}`,
          }}
        >
          {goal.category}
        </span>
      </div>

      {/* SECOND ROW */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium border border-[#E5E5EA] text-[#6C6C70]">
          {TIMELINE_LABELS[goal.timeline]}
        </span>
        {goal.targetDate && (
          <span className="text-xs text-[#6C6C70]">
            Due: {format(parseISO(goal.targetDate), 'MMM d, yyyy')}
          </span>
        )}
      </div>

      {/* PROGRESS ROW */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-[#6C6C70]">Progress</span>
          <span className="text-xs font-medium text-[#1C1C1E]">{displayProgress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: displayProgress + '%' }} />
        </div>
      </div>

      {/* SLIDER */}
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={displayProgress}
        onChange={handleSlider}
        aria-label="Progress"
        className="w-full accent-[#FF6B35]"
      />

      {/* DETAILS TOGGLE */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between text-xs text-[#6C6C70] hover:text-[#1C1C1E] transition-colors pt-1 border-t border-[#E5E5EA]"
      >
        <span>Details</span>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* EXPANDABLE DETAILS */}
      {isExpanded && (
        <div className="flex flex-col gap-3">
          {goal.why && (
            <div>
              <p className="text-xs font-medium text-[#6C6C70] mb-0.5">Why</p>
              <p className="text-sm text-[#1C1C1E]">{goal.why}</p>
            </div>
          )}
          {goal.metric && (
            <div>
              <p className="text-xs font-medium text-[#6C6C70] mb-0.5">Success Metric</p>
              <p className="text-sm text-[#1C1C1E]">{goal.metric}</p>
            </div>
          )}
          {goal.crystal && (
            <div>
              <p className="text-xs font-medium text-[#6C6C70] mb-0.5">Crystal Clear</p>
              <p className="text-sm text-[#1C1C1E]">{goal.crystal}</p>
            </div>
          )}

          {/* PROGRESS HISTORY */}
          {sortedHistory.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#6C6C70] mb-1.5">Progress History</p>
              <div className="flex flex-col gap-1">
                {sortedHistory.map((entry, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-[#6C6C70]">{format(parseISO(entry.date), 'MMM d, yyyy')}</span>
                    <span className="text-[#1C1C1E]">{entry.progress}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CARD ACTIONS ROW */}
      <div className="flex items-center gap-1 border-t border-[#E5E5EA] pt-2">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil size={14} />
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={onMilestones} className="flex items-center gap-1">
          <Flag size={14} />
          <span>Milestones</span>
          {milestoneCount > 0 && (
            <span className="ml-0.5 px-1.5 bg-[#FF6B35] rounded-full text-[10px] text-white font-bold leading-5">
              {milestoneCount}
            </span>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="ml-auto text-[#FF4F6D] hover:text-[#FF4F6D]"
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {/* MARK AS ACHIEVED */}
      <Button variant="secondary" size="sm" fullWidth onClick={onMarkComplete}>
        <Trophy size={14} />
        Mark as Achieved
      </Button>
    </div>
  );
}

// ─── COMPLETED VISION CARD ───────────────────────────────────────────────────

function CompletedVisionCard({ goal, onReopen }: { goal: Goal; onReopen: (g: Goal) => void }) {
  const categoryColor = CATEGORY_COLORS[goal.category] ?? '#6C6C70';
  return (
    <div className="glass-card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Check size={14} className="text-[#1ABC9C] flex-shrink-0" />
          <p className="text-sm font-semibold text-[#6C6C70] line-through truncate">{goal.title}</p>
        </div>
        <span
          className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium"
          style={{
            backgroundColor: categoryColor + '33',
            color: categoryColor,
            border: `1px solid ${categoryColor}`,
          }}
        >
          {goal.category}
        </span>
      </div>
      {goal.completedAt && (
        <p className="text-xs text-[#6C6C70]">
          Achieved: {format(parseISO(goal.completedAt), 'MMM d, yyyy')}
        </p>
      )}
      <Button variant="secondary" size="sm" onClick={() => onReopen(goal)}>
        Reopen
      </Button>
    </div>
  );
}

// ─── VISIONS PAGE ────────────────────────────────────────────────────────────

export default function VisionsPage() {
  const { user } = useAuth();

  // SECTION 1 — All three collections fetched at top level
  const { data: goals, loading } = useCollection<Goal>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.GOALS,
    enabled: !!user,
  });
  const { data: milestones } = useCollection<Milestone>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.MILESTONES,
    enabled: !!user,
  });
  const { data: goalActions } = useCollection<GoalAction>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.GOAL_ACTIONS,
    enabled: !!user,
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Goal | null>(null);
  const [milestonesGoal, setMilestonesGoal] = useState<Goal | null>(null);
  const [selectedTimeline, setSelectedTimeline] = useState('All');
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);

  // SECTION 4 — Filter and sort active goals
  const activeGoals = goals.filter(g => !g.isCompleted);
  const completedGoals = goals.filter(g => g.isCompleted);

  const filteredGoals = activeGoals.filter(g => {
    if (selectedTimeline === 'All') return true;
    return g.timeline === selectedTimeline;
  });

  // SECTION 11 — Sort: progress desc, then createdAt desc
  const sortedGoals = [...filteredGoals].sort((a, b) => {
    if (b.progress !== a.progress) return b.progress - a.progress;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocById(COLLECTIONS.GOALS, deleteTarget.id);
      toast.success('Vision deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete vision');
    }
  };

  const handleMarkComplete = async () => {
    if (!completeTarget) return;
    try {
      await updateDocById(COLLECTIONS.GOALS, completeTarget.id, {
        isCompleted: true,
        completedAt: new Date().toISOString(),
      });
      toast.success('Vision marked as achieved');
      setCompleteTarget(null);
    } catch {
      toast.error('Failed to update vision');
    }
  };

  const handleReopen = async (goal: Goal) => {
    try {
      await updateDocById(COLLECTIONS.GOALS, goal.id, {
        isCompleted: false,
        completedAt: deleteField() as any,
      });
      toast.success('Vision reopened');
    } catch {
      toast.error('Failed to reopen vision');
    }
  };

  return (
    <div className="flex flex-col min-h-dvh">
      {/* SECTION 2 — Page header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1C1C1E]">My Visions</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAIPanel(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#FFD700]/15 text-[#FFD700] hover:bg-[#FFD700]/25 transition-colors"
            aria-label="Open Vision AI Coach"
            title="Vision AI Coach"
          >
            <Sparkles size={16} />
          </button>
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            Add Vision
          </Button>
        </div>
      </div>

      {/* SECTION 3 — NICE Framework info box */}
      <div className="px-4 pb-3">
        <NiceInfoBox />
      </div>

      {/* SECTION 4 — Timeline filter pills */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4">
          {['All', '1yr', '3yr', '5yr'].map(t => (
            <button
              key={t}
              onClick={() => setSelectedTimeline(t)}
              className={cn(
                'flex-shrink-0 h-8 px-4 rounded-chip text-xs font-medium transition-colors',
                selectedTimeline === t
                  ? 'bg-[#FF6B35] text-white'
                  : 'border border-[#E5E5EA] text-[#6C6C70]'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 5 — Active vision cards */}
      <div className="flex-1 px-4 pb-6 flex flex-col gap-3">
        {loading ? (
          <>{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</>
        ) : sortedGoals.length === 0 ? (
          <EmptyState
            icon={Eye}
            title="No visions yet"
            subtitle="Add your first vision to start building your future"
            actionLabel="Add Vision"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          sortedGoals.map(g => (
            <VisionCard
              key={g.id}
              goal={g}
              milestones={milestones}
              onEdit={() => setEditGoal(g)}
              onDelete={() => setDeleteTarget(g)}
              onMilestones={() => setMilestonesGoal(g)}
              onMarkComplete={() => setCompleteTarget(g)}
            />
          ))
        )}

        {/* SECTION 6 — Completed / achieved visions */}
        {completedGoals.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
              className="flex items-center justify-between w-full py-2"
            >
              <span className="text-sm font-semibold text-[#6C6C70]">
                Achieved Visions ({completedGoals.length})
              </span>
              {isCompletedExpanded
                ? <ChevronUp size={16} className="text-[#6C6C70]" />
                : <ChevronDown size={16} className="text-[#6C6C70]" />}
            </button>
            {isCompletedExpanded && (
              <div className="flex flex-col gap-3 mt-2">
                {completedGoals.map(g => (
                  <CompletedVisionCard key={g.id} goal={g} onReopen={handleReopen} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 7 — Create / edit modal */}
      {(showCreateModal || !!editGoal) && (
        <VisionModal
          key={editGoal?.id ?? 'new'}
          open={true}
          onClose={() => { setShowCreateModal(false); setEditGoal(null); }}
          goal={editGoal}
          userId={user?.uid ?? ''}
        />
      )}

      {/* SECTION 8 + 9 — Milestones + Steps modal */}
      {!!milestonesGoal && (
        <MilestonesModal
          key={milestonesGoal.id}
          open={true}
          onClose={() => setMilestonesGoal(null)}
          goal={milestonesGoal}
          milestones={milestones}
          goalActions={goalActions}
          userId={user?.uid ?? ''}
          goals={goals}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Vision"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
      />

      {/* Mark as achieved confirmation */}
      <ConfirmModal
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        onConfirm={handleMarkComplete}
        title="Mark as Achieved"
        message={`Mark "${completeTarget?.title}" as achieved? You can reopen it later.`}
        confirmLabel="Mark Achieved"
        confirmVariant="primary"
      />

      {/* Vision AI Coach panel */}
      {showAIPanel && (
        <VisionAIPanel goals={goals} onClose={() => setShowAIPanel(false)} />
      )}
    </div>
  );
}
