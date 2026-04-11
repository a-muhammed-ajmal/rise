'use client';

import {
  useState, useRef, useEffect, useCallback,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Plus, Sun, MoreVertical, Trash2, Copy, Pencil,
  CheckSquare, ChevronDown, Briefcase, Star,
  CheckCircle2, Circle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { updateDocById, deleteDocById, createDoc } from '@/lib/firestore';
import {
  COLLECTIONS, PRIORITY_COLORS, PRIORITY_LABELS, REALM_CONFIG, REALMS,
} from '@/lib/constants';
import { todayISO, cn } from '@/lib/utils';
import type { Task, Project, Priority, Recurrence } from '@/lib/types';
import { SkeletonListItem } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const RECURRENCE_LETTER: Record<Recurrence, string> = {
  None: '', Daily: 'D', Weekly: 'W', Monthly: 'M', Yearly: 'Y',
};

function getNextDueDate(current: string, recurring: Recurrence): string {
  const d = new Date(current + 'T00:00:00');
  if (recurring === 'Daily')   d.setDate(d.getDate() + 1);
  if (recurring === 'Weekly')  d.setDate(d.getDate() + 7);
  if (recurring === 'Monthly') d.setMonth(d.getMonth() + 1);
  if (recurring === 'Yearly')  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

function formatTime12(time24: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

// ─── TASK MODAL ───────────────────────────────────────────────────────────────

interface TaskForm {
  title: string;
  realm: string;
  targetId: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  recurring: Recurrence;
  notes: string;
  isMyDay: boolean;
}

const DEFAULT_FORM: TaskForm = {
  title: '',
  realm: REALMS[0],
  targetId: '',
  priority: 'P4',
  dueDate: '',
  dueTime: '',
  recurring: 'None',
  notes: '',
  isMyDay: false,
};

function TaskModal({
  open, onClose, task, projects, userId,
}: {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  projects: Project[];
  userId: string;
}) {
  const [form, setForm] = useState<TaskForm>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setErrors({});
      setForm(task ? {
        title: task.title,
        realm: task.realm || REALMS[0],
        targetId: task.targetId ?? task.projectId ?? '',
        priority: task.priority,
        dueDate: task.dueDate ?? '',
        dueTime: task.dueTime ?? '',
        recurring: task.recurring ?? 'None',
        notes: task.description ?? '',
        isMyDay: task.isMyDay,
      } : { ...DEFAULT_FORM });
    }
  }, [open, task]);

  const set = <K extends keyof TaskForm>(k: K, v: TaskForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const realmProjects = projects.filter((p) => p.realm === form.realm);

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const data = {
        userId,
        title: sanitize(form.title, 200),
        description: sanitize(form.notes),
        realm: form.realm,
        targetId: form.targetId || undefined,
        projectId: form.targetId || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        dueTime: form.dueTime || undefined,
        recurring: form.recurring,
        isMyDay: form.isMyDay,
        isStarred: task?.isStarred ?? false,
        isCompleted: task?.isCompleted ?? false,
        completedAt: task?.completedAt,
        order: task?.order ?? Date.now(),
      };
      if (task) {
        await updateDocById(COLLECTIONS.TASKS, task.id, data);
        toast.success('Action updated.');
      } else {
        await createDoc(COLLECTIONS.TASKS, data);
        toast.success('Action created.');
      }
      onClose();
    } catch {
      toast.error('Failed to save action.');
    } finally {
      setSaving(false);
    }
  };

  const priorityButtons: { value: Priority; label: string }[] = [
    { value: 'P1', label: 'Do Now' },
    { value: 'P2', label: 'Important' },
    { value: 'P3', label: 'Get Done' },
    { value: 'P4', label: 'Default' },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Edit Action' : 'New Action'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth loading={saving} onClick={handleSave}>
            {task ? 'Save Changes' : 'Create Action'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Title */}
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          error={errors.title}
          required
          placeholder="What needs to be done?"
          autoFocus
        />

        {/* Realm + Target (2-column) */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Realm"
            value={form.realm}
            onChange={(e) => {
              set('realm', (e.target as HTMLSelectElement).value);
              set('targetId', '');
            }}
            options={REALMS.map((r) => ({
              value: r,
              label: `${REALM_CONFIG[r].emoji} ${r}`,
            }))}
          />
          <Select
            label="Target (optional)"
            value={form.targetId}
            onChange={(e) => set('targetId', (e.target as HTMLSelectElement).value)}
            options={[
              { value: '', label: 'No Target' },
              ...realmProjects.map((p) => ({ value: p.id, label: p.title })),
            ]}
          />
        </div>

        {/* Priority (4 buttons) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#F0F0F0]">Priority</label>
          <div className="grid grid-cols-4 gap-2">
            {priorityButtons.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => set('priority', value)}
                className={cn(
                  'h-9 px-2 rounded-button text-xs font-semibold transition-all border',
                  form.priority === value
                    ? 'text-white border-transparent'
                    : 'bg-[#1C1C1C] text-[#8A8A8A] border-[#2A2A2A]'
                )}
                style={form.priority === value ? { backgroundColor: PRIORITY_COLORS[value] } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Due Date + Time (same row) */}
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

        {/* Recurring */}
        <Select
          label="Recurring"
          value={form.recurring}
          onChange={(e) => set('recurring', (e.target as HTMLSelectElement).value as Recurrence)}
          options={[
            { value: 'None', label: 'None' },
            { value: 'Daily', label: 'Daily' },
            { value: 'Weekly', label: 'Weekly' },
            { value: 'Monthly', label: 'Monthly' },
            { value: 'Yearly', label: 'Yearly' },
          ]}
        />

        {/* Notes */}
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          placeholder="Add details..."
        />

        {/* Today's Focus toggle */}
        <button
          onClick={() => set('isMyDay', !form.isMyDay)}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-card border transition-colors',
            form.isMyDay
              ? 'bg-[#FF6B35]/10 border-[#FF6B35] text-[#FF6B35]'
              : 'bg-[#1C1C1C] border-[#2A2A2A] text-[#8A8A8A]'
          )}
        >
          <Sun size={18} />
          <div className="text-left">
            <p className="text-sm font-semibold">Today&apos;s Focus</p>
            <p className="text-xs opacity-70">Add to your day&apos;s spotlight</p>
          </div>
          <div
            className={cn(
              'ml-auto w-10 h-6 rounded-full transition-colors flex items-center px-1',
              form.isMyDay ? 'bg-[#FF6B35]' : 'bg-[#2A2A2A]'
            )}
          >
            <div
              className={cn(
                'w-4 h-4 rounded-full bg-white transition-transform',
                form.isMyDay ? 'translate-x-4' : 'translate-x-0'
              )}
            />
          </div>
        </button>
      </div>
    </Modal>
  );
}

// ─── PROJECT MODAL ────────────────────────────────────────────────────────────

interface ProjectForm {
  title: string;
  realm: string;
  dueDate: string;
}

function ProjectModal({
  open, onClose, project, userId,
}: {
  open: boolean;
  onClose: () => void;
  project: Project | null;
  userId: string;
}) {
  const [form, setForm] = useState<ProjectForm>({ title: '', realm: REALMS[0], dueDate: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setErrors({});
      setForm(project
        ? { title: project.title, realm: project.realm, dueDate: project.dueDate ?? '' }
        : { title: '', realm: REALMS[0], dueDate: '' }
      );
    }
  }, [open, project]);

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Target name is required';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const cfg = REALM_CONFIG[form.realm] ?? { emoji: '🎯', color: '#FF6B35' };
    try {
      const data = {
        userId,
        title: sanitize(form.title, 100),
        realm: form.realm,
        color: cfg.color,
        icon: cfg.emoji,
        isFavorite: project?.isFavorite ?? false,
        order: project?.order ?? Date.now(),
        dueDate: form.dueDate || undefined,
      };
      if (project) {
        await updateDocById(COLLECTIONS.PROJECTS, project.id, data);
        toast.success('Target updated.');
      } else {
        await createDoc(COLLECTIONS.PROJECTS, data);
        toast.success('Target created.');
      }
      onClose();
    } catch {
      toast.error('Failed to save target.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? 'Edit Target' : 'New Target'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth loading={saving} onClick={handleSave}>
            {project ? 'Save Changes' : 'Create Target'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Target Name"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          error={errors.title}
          required
          placeholder="What do you want to achieve?"
          autoFocus
        />
        <Select
          label="Realm"
          value={form.realm}
          onChange={(e) =>
            setForm((f) => ({ ...f, realm: (e.target as HTMLSelectElement).value }))
          }
          options={REALMS.map((r) => ({
            value: r,
            label: `${REALM_CONFIG[r].emoji} ${r}`,
          }))}
        />
        <Input
          label="Due Date (optional)"
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
        />
        {/* Realm preview */}
        {form.realm && (
          <div className="flex items-center gap-3 px-3 py-2 bg-[#1C1C1C] rounded-card border border-[#2A2A2A]">
            <span className="text-2xl">{REALM_CONFIG[form.realm]?.emoji}</span>
            <div>
              <p className="text-sm font-medium text-[#F0F0F0]">{form.realm}</p>
              <p className="text-xs text-[#8A8A8A]">{REALM_CONFIG[form.realm]?.description}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  projects,
  onComplete,
  onEdit,
  onDelete,
  onDuplicate,
  selected,
  onSelect,
  inBulkMode,
}: {
  task: Task;
  projects: Project[];
  onComplete: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onDuplicate: (t: Task) => void;
  selected: boolean;
  onSelect: (t: Task) => void;
  inBulkMode: boolean;
}) {
  const today = todayISO();
  const isOverdue = !task.isCompleted && task.dueDate && task.dueDate < today;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);

  const targetProject = projects.find((p) => p.id === (task.targetId ?? task.projectId));
  const recurringLetter = task.recurring ? RECURRENCE_LETTER[task.recurring] : '';
  const priorityColor = PRIORITY_COLORS[task.priority] ?? '#8A8A8A';
  const priorityLabel = PRIORITY_LABELS[task.priority] ?? task.priority;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handlePointerDown = () => {
    touchMoved.current = false;
    longPressRef.current = setTimeout(() => {
      if (!touchMoved.current) onSelect(task);
    }, 600);
  };
  const handlePointerMove = () => { touchMoved.current = true; };
  const handlePointerUp = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  const handleCardClick = () => {
    if (inBulkMode) { onSelect(task); return; }
    onEdit(task);
  };

  return (
    <div
      className={cn(
        'relative flex items-start gap-0 border-b border-[#2A2A2A] last:border-0',
        'active:bg-[#1A1A1A] transition-colors select-none',
        selected && 'bg-[#FF6B35]/8'
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleCardClick}
    >
      {/* Priority left border */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-sm"
        style={{ backgroundColor: priorityColor }}
      />

      {/* Bulk selection indicator or completion toggle */}
      <div className="pl-3 pt-3.5 flex-shrink-0">
        {inBulkMode ? (
          <div
            className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
              selected ? 'bg-[#FF6B35] border-[#FF6B35]' : 'border-[#505050]'
            )}
          >
            {selected && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onComplete(task); }}
            className="w-6 h-6 flex items-center justify-center"
          >
            {task.isCompleted
              ? <CheckCircle2 size={22} className="text-[#1ABC9C]" />
              : <Circle size={22} style={{ color: priorityColor }} />
            }
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-3 pl-2 pr-2">
        <p className={cn(
          'text-sm text-[#F0F0F0] leading-snug',
          task.isCompleted && 'line-through text-[#505050]'
        )}>
          {task.title}
        </p>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <Badge
            label={`${task.priority} · ${priorityLabel}`}
            color={priorityColor}
          />
          {recurringLetter && (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: priorityColor }}
              title={`Recurring: ${task.recurring}`}
            >
              {recurringLetter}
            </span>
          )}
          {task.isMyDay && (
            <Sun size={12} className="text-[#FF6B35]" />
          )}
        </div>

        {/* Due date + time / overdue */}
        {task.dueDate && (
          <p className={cn(
            'text-xs mt-1',
            isOverdue ? 'text-[#FF4F6D]' : 'text-[#8A8A8A]'
          )}>
            {isOverdue ? '⚠ Overdue · ' : ''}{task.dueDate === today ? 'Today' : task.dueDate}
            {task.dueTime && ` · ${formatTime12(task.dueTime)}`}
          </p>
        )}
      </div>

      {/* Right side: target/realm + menu */}
      <div className="flex flex-col items-end justify-between py-3 pr-2 gap-2 flex-shrink-0">
        <div ref={menuRef} className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="w-7 h-7 flex items-center justify-center text-[#505050] hover:text-[#F0F0F0] rounded-full hover:bg-[#1C1C1C]"
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-50 bg-[#1C1C1C] border border-[#2A2A2A] rounded-card shadow-card min-w-[160px]">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(task); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#F0F0F0] hover:bg-[#2A2A2A]"
              >
                <Pencil size={14} /> Edit Action
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDuplicate(task); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#F0F0F0] hover:bg-[#2A2A2A]"
              >
                <Copy size={14} /> Duplicate
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(task); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#FF4F6D] hover:bg-[#2A2A2A]"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-0.5">
          {targetProject && (
            <span className="text-[10px] text-[#8A8A8A] max-w-[80px] text-right truncate leading-tight">
              {targetProject.title}
            </span>
          )}
          <span
            className="text-[10px] max-w-[80px] text-right truncate leading-tight font-medium"
            style={{ color: REALM_CONFIG[task.realm]?.color ?? '#8A8A8A' }}
          >
            {task.realm}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── TARGET CARD ──────────────────────────────────────────────────────────────

function TargetCard({
  project,
  tasks,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  project: Project;
  tasks: Task[];
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
  onToggleFavorite: (p: Project) => void;
}) {
  const linked = tasks.filter((t) => (t.targetId ?? t.projectId) === project.id);
  const done = linked.filter((t) => t.isCompleted).length;
  const total = linked.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const cfg = REALM_CONFIG[project.realm] ?? { emoji: '🎯', color: '#FF6B35' };

  return (
    <div className="bg-[#141414] rounded-card border border-[#2A2A2A] p-3 flex items-start gap-3">
      <span className="text-2xl flex-shrink-0">{project.icon || cfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#F0F0F0] truncate">{project.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge label={project.realm} color={cfg.color} />
          {project.dueDate && (
            <span className="text-xs text-[#8A8A8A]">{project.dueDate}</span>
          )}
        </div>
        <div className="mt-2">
          <ProgressBar value={done} max={total || 1} color={cfg.color} height={4} />
          <p className="text-xs text-[#8A8A8A] mt-1">{done}/{total} actions done</p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onToggleFavorite(project)}
          className="w-7 h-7 flex items-center justify-center"
          title="Toggle favorite"
        >
          <Star
            size={15}
            className={project.isFavorite ? 'text-[#FFD700]' : 'text-[#505050]'}
            fill={project.isFavorite ? '#FFD700' : 'none'}
          />
        </button>
        <button
          onClick={() => onEdit(project)}
          className="w-7 h-7 flex items-center justify-center text-[#505050] hover:text-[#F0F0F0]"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onDelete(project)}
          className="w-7 h-7 flex items-center justify-center text-[#505050] hover:text-[#FF4F6D]"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── ACTIONS PAGE ─────────────────────────────────────────────────────────────

type TabId = 'today' | 'inbox' | 'upcoming' | 'completed' | 'targets';

export default function ActionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: tasks, loading: tasksLoading } = useCollection<Task>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.TASKS,
    enabled: !!user,
  });
  const { data: projects, loading: projectsLoading } = useCollection<Project>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.PROJECTS,
    enabled: !!user,
  });

  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [inBulkMode, setInBulkMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const today = todayISO();

  // Open create modal if ?create=true in URL
  useEffect(() => {
    if (searchParams?.get('create') === 'true') {
      setEditTask(null);
      setTaskModalOpen(true);
      router.replace('/tasks');
    }
  }, [searchParams, router]);

  // Exit bulk mode when no items selected
  useEffect(() => {
    if (inBulkMode && selectedTasks.size === 0) setInBulkMode(false);
  }, [selectedTasks, inBulkMode]);

  // ── Tab content ──────────────────────────────────────────────────────────
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoISO = sevenDaysAgo.toISOString().split('T')[0];

  const todayTasks = tasks.filter(
    (t) => !t.isCompleted && t.dueDate && t.dueDate <= today
  ).sort((a, b) => {
    // Overdue first, then by priority
    const aOver = a.dueDate! < today ? 0 : 1;
    const bOver = b.dueDate! < today ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return parseInt(a.priority[1]) - parseInt(b.priority[1]);
  });

  const inboxTasks = tasks.filter(
    (t) => !t.isCompleted && !t.targetId && !t.projectId
  ).sort((a, b) => parseInt(a.priority[1]) - parseInt(b.priority[1]));

  const upcomingTasks = tasks.filter(
    (t) => !t.isCompleted && t.dueDate && t.dueDate > today
  ).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  const completedTasks = tasks.filter(
    (t) => t.isCompleted && t.completedAt && t.completedAt >= sevenDaysAgoISO
  ).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  const currentTabTasks: Task[] = {
    today: todayTasks,
    inbox: inboxTasks,
    upcoming: upcomingTasks,
    completed: completedTasks,
    targets: [],
  }[activeTab];

  // ── Actions ──────────────────────────────────────────────────────────────
  const openCreateTask = () => {
    setEditTask(null);
    setTaskModalOpen(true);
  };

  const handleComplete = useCallback(async (task: Task) => {
    const now = new Date().toISOString();
    const willComplete = !task.isCompleted;

    await updateDocById(COLLECTIONS.TASKS, task.id, {
      isCompleted: willComplete,
      completedAt: willComplete ? now : undefined,
    });

    if (willComplete) {
      toast.success('Action completed! 🎉');
      // Auto-create next recurring instance
      if (task.recurring && task.recurring !== 'None' && task.dueDate) {
        const nextDue = getNextDueDate(task.dueDate, task.recurring);
        const { id: _id, completedAt: _ca, ...rest } = task;
        void _id; void _ca;
        await createDoc(COLLECTIONS.TASKS, {
          ...rest,
          dueDate: nextDue,
          isCompleted: false,
          completedAt: undefined,
          order: Date.now(),
          createdAt: now,
        });
      }
    }
  }, []);

  const handleDuplicate = useCallback(async (task: Task) => {
    const { id: _id, ...rest } = task;
    void _id;
    await createDoc(COLLECTIONS.TASKS, {
      ...rest,
      title: `${task.title} (Copy)`,
      isCompleted: false,
      completedAt: undefined,
      order: Date.now(),
      createdAt: new Date().toISOString(),
    });
    toast.success('Action duplicated.');
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTask) return;
    await deleteDocById(COLLECTIONS.TASKS, deleteTask.id);
    toast.success('Action deleted.', {
      label: 'Undo',
      onClick: async () => {
        const { id: _id, ...rest } = deleteTask;
        void _id;
        await createDoc(COLLECTIONS.TASKS, rest);
      },
    });
    setDeleteTask(null);
  }, [deleteTask]);

  const handleBulkComplete = async () => {
    const now = new Date().toISOString();
    await Promise.all(
      Array.from(selectedTasks).map((id) =>
        updateDocById(COLLECTIONS.TASKS, id, { isCompleted: true, completedAt: now })
      )
    );
    toast.success(`${selectedTasks.size} action(s) completed.`);
    setSelectedTasks(new Set());
    setInBulkMode(false);
  };

  const handleBulkDelete = async () => {
    await Promise.all(
      Array.from(selectedTasks).map((id) => deleteDocById(COLLECTIONS.TASKS, id))
    );
    toast.success(`${selectedTasks.size} action(s) deleted.`);
    setSelectedTasks(new Set());
    setInBulkMode(false);
  };

  const toggleSelect = useCallback((task: Task) => {
    setInBulkMode(true);
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });
  }, []);

  // ── Project actions ───────────────────────────────────────────────────────
  const handleDeleteProject = useCallback(async () => {
    if (!deleteProject) return;
    // Orphan actions: set targetId/projectId to null so they are no longer linked
    const linked = tasks.filter((t) => (t.targetId ?? t.projectId) === deleteProject.id);
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      linked.map((t) =>
        updateDocById(COLLECTIONS.TASKS, t.id, { targetId: null, projectId: null } as any)
      )
    );
    await deleteDocById(COLLECTIONS.PROJECTS, deleteProject.id);
    toast.success('Target deleted.');
    setDeleteProject(null);
  }, [deleteProject, tasks]);

  const handleToggleFavorite = useCallback(async (project: Project) => {
    await updateDocById(COLLECTIONS.PROJECTS, project.id, { isFavorite: !project.isFavorite });
  }, []);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'inbox', label: 'Inbox' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'completed', label: 'Completed' },
    { id: 'targets', label: 'Targets' },
  ];

  const emptyMessages: Record<TabId, { title: string; subtitle: string }> = {
    today:     { title: 'All clear today', subtitle: 'No actions due today. Enjoy your day!' },
    inbox:     { title: 'Inbox is empty', subtitle: 'Actions without a Target appear here.' },
    upcoming:  { title: 'Nothing upcoming', subtitle: 'Schedule actions with a future due date.' },
    completed: { title: 'Nothing completed recently', subtitle: 'Complete actions to see them here.' },
    targets:   { title: 'No Targets yet', subtitle: 'Create your first Target to organise your Actions.' },
  };

  const loading = tasksLoading || projectsLoading;

  // Targets grouped by realm
  const realmGroups = REALMS.map((realm) => ({
    realm,
    projects: projects.filter((p) => p.realm === realm),
  })).filter((g) => g.projects.length > 0);

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-[#2A2A2A]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[#F0F0F0]">Actions</h1>
          <Button size="sm" onClick={openCreateTask}>
            <Plus size={15} /> New Action
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setInBulkMode(false); setSelectedTasks(new Set()); }}
              className={cn(
                'flex-shrink-0 h-8 px-4 rounded-chip text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-[#FF6B35] text-white'
                  : 'bg-[#141414] text-[#8A8A8A] border border-[#2A2A2A]'
              )}
            >
              {tab.label}
              {tab.id === 'today' && todayTasks.length > 0 && (
                <span className="ml-1.5 bg-white/20 text-white rounded-full px-1.5 text-[10px]">
                  {todayTasks.length}
                </span>
              )}
              {tab.id === 'inbox' && inboxTasks.length > 0 && (
                <span className="ml-1.5 bg-white/20 text-white rounded-full px-1.5 text-[10px]">
                  {inboxTasks.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk mode toolbar */}
      {inBulkMode && selectedTasks.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[#1C1C1C] border-b border-[#2A2A2A]">
          <span className="text-xs text-[#F0F0F0] flex-1">
            {selectedTasks.size} selected
          </span>
          <Button size="sm" variant="secondary" onClick={() => { setInBulkMode(false); setSelectedTasks(new Set()); }}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleBulkComplete}>
            Complete
          </Button>
          <Button size="sm" variant="danger" onClick={handleBulkDelete}>
            Delete
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 py-4 pb-24">
        {/* ── Targets tab ── */}
        {activeTab === 'targets' && (
          <div className="flex flex-col gap-5">
            <Button onClick={() => { setEditProject(null); setProjectModalOpen(true); }}>
              <Plus size={15} /> New Target
            </Button>

            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-[#141414] rounded-card border border-[#2A2A2A] animate-pulse" />
                ))}
              </div>
            ) : realmGroups.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title={emptyMessages.targets.title}
                subtitle={emptyMessages.targets.subtitle}
                actionLabel="Create Target"
                onAction={() => { setEditProject(null); setProjectModalOpen(true); }}
              />
            ) : (
              realmGroups.map(({ realm, projects: rProjects }) => {
                const cfg = REALM_CONFIG[realm] ?? { emoji: '🎯', color: '#FF6B35' };
                return (
                  <div key={realm}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{cfg.emoji}</span>
                      <h2 className="text-sm font-semibold text-[#F0F0F0]">{realm}</h2>
                      <div className="flex-1 h-px bg-[#2A2A2A]" />
                    </div>
                    <div className="flex flex-col gap-2">
                      {rProjects.map((p) => (
                        <TargetCard
                          key={p.id}
                          project={p}
                          tasks={tasks}
                          onEdit={(proj) => { setEditProject(proj); setProjectModalOpen(true); }}
                          onDelete={setDeleteProject}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Task list tabs ── */}
        {activeTab !== 'targets' && (
          <>
            {loading ? (
              <div className="bg-[#141414] rounded-card border border-[#2A2A2A] overflow-hidden">
                {[1, 2, 3, 4].map((i) => <SkeletonListItem key={i} />)}
              </div>
            ) : currentTabTasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title={emptyMessages[activeTab].title}
                subtitle={emptyMessages[activeTab].subtitle}
                actionLabel={activeTab === 'today' || activeTab === 'inbox' ? 'New Action' : undefined}
                onAction={activeTab === 'today' || activeTab === 'inbox' ? openCreateTask : undefined}
              />
            ) : (
              <div className="bg-[#141414] rounded-card border border-[#2A2A2A] overflow-hidden">
                {/* Overdue section header for Today tab */}
                {activeTab === 'today' && todayTasks.some((t) => t.dueDate && t.dueDate < today) && (
                  <div className="px-4 py-1.5 bg-[#FF4F6D]/10 border-b border-[#2A2A2A]">
                    <p className="text-xs font-semibold text-[#FF4F6D]">
                      ⚠ Overdue — {todayTasks.filter((t) => t.dueDate && t.dueDate < today).length} action(s)
                    </p>
                  </div>
                )}
                {currentTabTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    projects={projects}
                    onComplete={handleComplete}
                    onEdit={(t) => { setEditTask(t); setTaskModalOpen(true); }}
                    onDelete={setDeleteTask}
                    onDuplicate={handleDuplicate}
                    selected={selectedTasks.has(task.id)}
                    onSelect={toggleSelect}
                    inBulkMode={inBulkMode}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB (mobile) */}
      <button
        onClick={openCreateTask}
        className="fixed bottom-[80px] right-4 w-14 h-14 bg-[#FF6B35] rounded-full flex items-center justify-center shadow-fab active:scale-95 transition-transform sm:hidden z-30"
        aria-label="Create action"
      >
        <Plus size={24} className="text-white" />
      </button>

      {/* Modals */}
      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        task={editTask}
        projects={projects}
        userId={user?.uid ?? ''}
      />
      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        project={editProject}
        userId={user?.uid ?? ''}
      />
      <ConfirmModal
        open={!!deleteTask}
        onClose={() => setDeleteTask(null)}
        onConfirm={handleDelete}
        title="Delete Action"
        message={`Delete "${deleteTask?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
      />
      <ConfirmModal
        open={!!deleteProject}
        onClose={() => setDeleteProject(null)}
        onConfirm={handleDeleteProject}
        title="Delete Target"
        message={`Delete "${deleteProject?.title}"? Actions linked to this Target will be kept but unlinked.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
