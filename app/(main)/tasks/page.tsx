'use client';

import { useState, useRef } from 'react';
import {
  Plus, Star, Circle, CheckCircle2, Trash2, MoreVertical,
  CheckSquare, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { updateDocById, deleteDocById, createDoc } from '@/lib/firestore';
import { COLLECTIONS, PRIORITY_COLORS } from '@/lib/constants';
import { todayISO, cn } from '@/lib/utils';
import type { Task, Priority, Recurrence } from '@/lib/types';
import { SkeletonListItem } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge, PriorityDot } from '@/components/ui/Badge';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';

type FilterTab = 'all' | 'myday' | 'starred' | 'overdue' | 'completed';
type SortBy = 'priority' | 'dueDate' | 'created';

// ─── ACTION MODAL ─────────────────────────────────────────────────────────────
interface ActionForm {
  title: string;
  description: string;
  realm: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  isMyDay: boolean;
  isStarred: boolean;
  recurring: Recurrence;
}

const DEFAULT_FORM: ActionForm = {
  title: '',
  description: '',
  realm: '',
  priority: 'P3',
  dueDate: '',
  dueTime: '',
  isMyDay: false,
  isStarred: false,
  recurring: 'None',
};

function ActionModal({
  open,
  onClose,
  task,
  realms,
  userId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  realms: string[];
  userId: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ActionForm>(
    task
      ? {
          title: task.title,
          description: task.description ?? '',
          realm: task.realm,
          priority: task.priority,
          dueDate: task.dueDate ?? '',
          dueTime: task.dueTime ?? '',
          isMyDay: task.isMyDay,
          isStarred: task.isStarred,
          recurring: task.recurring ?? 'None',
        }
      : { ...DEFAULT_FORM, realm: realms[0] ?? '' }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (field: keyof ActionForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.realm.trim()) e.realm = 'Realm is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = {
        userId,
        title: sanitize(form.title, 200),
        description: sanitize(form.description),
        realm: sanitize(form.realm, 50),
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        dueTime: form.dueTime || undefined,
        isMyDay: form.isMyDay,
        isStarred: form.isStarred,
        recurring: form.recurring,
        isCompleted: task?.isCompleted ?? false,
        order: task?.order ?? Date.now(),
      };
      if (task) {
        await updateDocById(COLLECTIONS.TASKS, task.id, data);
      } else {
        await createDoc(COLLECTIONS.TASKS, data);
      }
      toast.success('Action saved.');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to save action.');
    } finally {
      setSaving(false);
    }
  };

  const realmOptions = realms.map((r) => ({ value: r, label: r }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Edit Action' : 'New Action'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth loading={saving} onClick={handleSave}>Save</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          error={errors.title}
          required
          placeholder="What needs to be done?"
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
          placeholder="Add details..."
        />
        {realmOptions.length > 0 ? (
          <Select
            label="Realm"
            value={form.realm}
            onChange={(e) => set('realm', (e.target as HTMLSelectElement).value)}
            options={realmOptions}
            error={errors.realm}
            required
          />
        ) : (
          <Input
            label="Realm"
            value={form.realm}
            onChange={(e) => set('realm', e.target.value)}
            error={errors.realm}
            required
            placeholder="e.g. Health, Career..."
          />
        )}
        <Select
          label="Priority"
          value={form.priority}
          onChange={(e) => set('priority', (e.target as HTMLSelectElement).value)}
          options={[
            { value: 'P1', label: 'P1 · Critical' },
            { value: 'P2', label: 'P2 · High' },
            { value: 'P3', label: 'P3 · Medium' },
            { value: 'P4', label: 'P4 · Low' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Due Date"
            type="date"
            value={form.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
          />
          <Input
            label="Due Time"
            type="time"
            value={form.dueTime}
            onChange={(e) => set('dueTime', e.target.value)}
          />
        </div>
        <Select
          label="Recurring"
          value={form.recurring}
          onChange={(e) => set('recurring', (e.target as HTMLSelectElement).value)}
          options={[
            { value: 'None', label: 'None' },
            { value: 'Daily', label: 'Daily' },
            { value: 'Weekly', label: 'Weekly' },
            { value: 'Monthly', label: 'Monthly' },
            { value: 'Yearly', label: 'Yearly' },
          ]}
        />
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-[#F0F0F0] cursor-pointer">
            <input
              type="checkbox"
              checked={form.isMyDay}
              onChange={(e) => set('isMyDay', e.target.checked)}
            />
            My Day
          </label>
          <label className="flex items-center gap-2 text-sm text-[#F0F0F0] cursor-pointer">
            <input
              type="checkbox"
              checked={form.isStarred}
              onChange={(e) => set('isStarred', e.target.checked)}
            />
            Starred
          </label>
        </div>
      </div>
    </Modal>
  );
}

// ─── ACTION CARD ─────────────────────────────────────────────────────────────
function ActionCard({
  task,
  onComplete,
  onEdit,
  onDelete,
}: {
  task: Task;
  onComplete: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const today = todayISO();
  const isOverdue = task.dueDate && task.dueDate < today && !task.isCompleted;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-[#2A2A2A] last:border-0 active:bg-[#1C1C1C] transition-colors"
      onClick={() => onEdit(task)}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onComplete(task); }}
        className="w-7 h-7 flex items-center justify-center flex-shrink-0"
      >
        {task.isCompleted
          ? <CheckCircle2 size={22} className="text-[#1ABC9C]" />
          : <Circle size={22} className="text-[#2A2A2A]" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', task.isCompleted && 'line-through text-[#8A8A8A]')}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Badge label={task.realm} />
          {task.dueDate && (
            <span className={cn('text-xs', isOverdue ? 'text-[#FF4F6D]' : 'text-[#8A8A8A]')}>
              {task.dueDate === today ? 'Today' : task.dueDate}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <PriorityDot priority={task.priority} />
        {task.isStarred && <Star size={14} className="text-[#FFD700]" fill="#FFD700" />}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task); }}
          className="w-8 h-8 flex items-center justify-center text-[#505050] hover:text-[#FF4F6D]"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

// ─── ACTIONS PAGE ─────────────────────────────────────────────────────────────
export default function ActionsPage() {
  const { user } = useAuth();
  const { data: tasks, loading } = useCollection<Task>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.TASKS,
    enabled: !!user,
  });

  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<SortBy>('priority');
  const [realmFilter, setRealmFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [undoTask, setUndoTask] = useState<Task | null>(null);

  const today = todayISO();

  // Deduplicate realms from tasks
  const realms = Array.from(new Set(tasks.map((t) => t.realm).filter(Boolean)));

  const filterTasks = (list: Task[]) => {
    let result = list;
    if (realmFilter !== 'all') result = result.filter((t) => t.realm === realmFilter);
    switch (filter) {
      case 'myday': return result.filter((t) => t.isMyDay && !t.isCompleted);
      case 'starred': return result.filter((t) => t.isStarred && !t.isCompleted);
      case 'overdue': return result.filter((t) => t.dueDate && t.dueDate < today && !t.isCompleted);
      case 'completed': return result.filter((t) => t.isCompleted);
      default: return result.filter((t) => !t.isCompleted);
    }
  };

  const sortTasks = (list: Task[]) => {
    return [...list].sort((a, b) => {
      if (sortBy === 'priority') return parseInt(a.priority[1]) - parseInt(b.priority[1]);
      if (sortBy === 'dueDate') return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
      return a.createdAt.localeCompare(b.createdAt);
    });
  };

  const displayed = sortTasks(filterTasks(tasks));

  const completeTask = async (task: Task) => {
    const now = new Date().toISOString();
    await updateDocById(COLLECTIONS.TASKS, task.id, {
      isCompleted: !task.isCompleted,
      completedAt: !task.isCompleted ? now : undefined,
    });
    if (!task.isCompleted) toast.success('Action completed! 🎉');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDocById(COLLECTIONS.TASKS, deleteTarget.id);
    toast.success('Action deleted.', {
      label: 'Undo',
      onClick: async () => {
        if (deleteTarget) {
          const { id, ...rest } = deleteTarget;
          await createDoc(COLLECTIONS.TASKS, rest);
        }
      },
    });
    setDeleteTarget(null);
  };

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'myday', label: 'My Day' },
    { id: 'starred', label: 'Starred' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'completed', label: 'Done' },
  ];

  const emptyMessages: Record<FilterTab, { title: string; subtitle: string }> = {
    all: { title: 'No actions yet', subtitle: 'Tap + to create your first action.' },
    myday: { title: 'Nothing in My Day', subtitle: 'Add your top actions for today.' },
    starred: { title: 'No starred actions', subtitle: 'Star important actions to highlight them.' },
    overdue: { title: 'No overdue actions', subtitle: 'Great work staying on top of things.' },
    completed: { title: 'No completed actions', subtitle: 'Complete an action to see it here.' },
  };

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[#F0F0F0]">Actions</h1>
          <Select
            options={[
              { value: 'priority', label: 'Priority' },
              { value: 'dueDate', label: 'Due Date' },
              { value: 'created', label: 'Created' },
            ]}
            value={sortBy}
            onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as SortBy)}
            className="w-32 text-xs py-1.5"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                'flex-shrink-0 h-8 px-4 rounded-chip text-xs font-medium transition-colors',
                filter === tab.id
                  ? 'bg-[#FF6B35] text-white'
                  : 'bg-[#141414] text-[#8A8A8A] border border-[#2A2A2A]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Realm filter chips */}
        {realms.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 mt-2">
            <button
              onClick={() => setRealmFilter('all')}
              className={cn(
                'flex-shrink-0 h-7 px-3 rounded-chip text-xs transition-colors',
                realmFilter === 'all' ? 'bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]' : 'bg-[#141414] text-[#8A8A8A] border border-[#2A2A2A]'
              )}
            >
              All
            </button>
            {realms.map((r) => (
              <button
                key={r}
                onClick={() => setRealmFilter(r)}
                className={cn(
                  'flex-shrink-0 h-7 px-3 rounded-chip text-xs transition-colors',
                  realmFilter === r ? 'bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]' : 'bg-[#141414] text-[#8A8A8A] border border-[#2A2A2A]'
                )}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 px-4 pb-6">
        {loading ? (
          <div className="bg-[#141414] rounded-card border border-[#2A2A2A] overflow-hidden">
            {[1,2,3,4,5].map((i) => <SkeletonListItem key={i} />)}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title={emptyMessages[filter].title}
            subtitle={emptyMessages[filter].subtitle}
            actionLabel={filter === 'all' ? 'Create Action' : undefined}
            onAction={filter === 'all' ? () => { setEditTask(null); setModalOpen(true); } : undefined}
          />
        ) : (
          <div className="bg-[#141414] rounded-card border border-[#2A2A2A] overflow-hidden">
            {displayed.map((task) => (
              <ActionCard
                key={task.id}
                task={task}
                onComplete={completeTask}
                onEdit={(t) => { setEditTask(t); setModalOpen(true); }}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => { setEditTask(null); setModalOpen(true); }}
        className="fixed bottom-[80px] right-4 w-14 h-14 bg-[#FF6B35] rounded-full flex items-center justify-center shadow-fab active:scale-95 transition-transform sm:hidden z-30"
        aria-label="Create action"
      >
        <Plus size={24} className="text-white" />
      </button>

      {/* Modals */}
      <ActionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editTask}
        realms={realms}
        userId={user?.uid ?? ''}
        onSaved={() => {}}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Action"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
