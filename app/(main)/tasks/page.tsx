'use client';

import {
  useState, useRef, useEffect, useCallback, useMemo, KeyboardEvent,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Plus, Sun, Copy, Trash2, Briefcase, Star,
  CheckSquare, Menu, Crosshair, ChevronDown, Edit2, Check, X,
  Paperclip, Calendar, Repeat, Bell, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useCollection } from '@/hooks/useFirestore';
import { updateDocById, deleteDocById, createDoc } from '@/lib/firestore';
import { COLLECTIONS, REALM_CONFIG, REALMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Task, Project, Priority, Recurrence, TaskStep, TaskReminder } from '@/lib/types';
import { TaskCard } from '@/components/tasks/TaskCard';
import { SkeletonListItem } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MobileSidebar } from '@/components/layout/MobileSidebar';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';
import {
  ActionDetailPopup,
  DateTimePickerSheet,
  RecurringPickerSheet,
  ReminderPickerSheet,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  CUSTOM_DAYS_LABELS,
  getDueDateDisplay,
} from '@/components/tasks/ActionDetailPopup';

// ─── PREMIUM UI COMPONENTS ──────────────────────────────────────────────────

function ArrowCheck({ 
  completed, 
  color, 
  onClick, 
  size = 18 
}: { 
  completed: boolean; 
  color: string; 
  onClick?: (e: React.MouseEvent) => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 flex items-center justify-center transition-all active:scale-90"
      style={{ width: size, height: size }}
    >
      <div 
        className={cn(
          "w-full h-full rounded-full border-2 flex items-center justify-center transition-colors",
          completed ? "border-transparent" : "border-[#AEAEB2]"
        )}
        style={{ backgroundColor: completed ? color : 'transparent' }}
      >
        {completed && (
          <Check size={size * 0.6} strokeWidth={3} className="text-white" />
        )}
      </div>
    </button>
  );
}



// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

function parseDueDate(s: string): Date | null {
  if (!s) return null;
  if (s.includes('/')) {
    const [d, m, y] = s.split('/').map(Number);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
  }
  if (s.includes('-') && s.length === 10) return new Date(s + 'T00:00:00');
  return null;
}

function toDDMMYYYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function todayMidnight(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function getNextDueDateFromStr(current: string, recurring: Recurrence, customDays?: number[]): string {
  const parsed = parseDueDate(current);
  if (!parsed) return current;
  const d = new Date(parsed);
  if (recurring === 'Daily') {
    d.setDate(d.getDate() + 1);
  } else if (recurring === 'Weekdays') {
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  } else if (recurring === 'Weekly') {
    d.setDate(d.getDate() + 7);
  } else if (recurring === 'Monthly') {
    d.setMonth(d.getMonth() + 1);
  } else if (recurring === 'Yearly') {
    d.setFullYear(d.getFullYear() + 1);
  } else if (recurring === 'Custom' && customDays && customDays.length > 0) {
    d.setDate(d.getDate() + 1);
    for (let i = 0; i < 7; i++) {
      const jsDay = d.getDay(); // 0=Sun
      const specDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..6=Sun
      if (customDays.includes(specDay)) break;
      d.setDate(d.getDate() + 1);
    }
  }
  return toDDMMYYYY(d);
}

function isTaskOverdue(task: Task): boolean {
  if (task.isCompleted || !task.dueDate) return false;
  const parsed = parseDueDate(task.dueDate);
  if (!parsed) return false;
  return parsed.getTime() < todayMidnight().getTime();
}

// ─── STEPS EDITOR ─────────────────────────────────────────────────────────────

function StepsEditor({
  steps,
  onChange,
}: {
  steps: TaskStep[];
  onChange: (steps: TaskStep[]) => void;
}) {
  const [newStepText, setNewStepText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addStep = () => {
    const text = newStepText.trim();
    if (!text) return;
    onChange([...steps, { id: Date.now().toString(), text, done: false }]);
    setNewStepText('');
    inputRef.current?.focus();
  };

  const toggleDone = (id: string) => {
    onChange(steps.map(s => s.id === id ? { ...s, done: !s.done } : s));
  };

  const deleteStep = (id: string) => {
    onChange(steps.filter(s => s.id !== id));
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-[#1C1C1E]">Add steps</label>
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-2 py-1">
          <button
            type="button"
            onClick={() => toggleDone(step.id)}
            className={cn(
              'flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
              step.done ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-[#AEAEB2]'
            )}
          >
            {step.done && <Check size={12} className="text-white" />}
          </button>
          <span className={cn('flex-1 text-sm', step.done && 'line-through text-[#AEAEB2]')}>{step.text}</span>
          <button
            type="button"
            onClick={() => deleteStep(step.id)}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-[#AEAEB2] hover:text-[#EF4444]"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-1">
        <input
          ref={inputRef}
          type="text"
          value={newStepText}
          onChange={(e) => setNewStepText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }}
          placeholder="Add a step"
          className="flex-1 bg-[#F5F5F5] border border-[#E5E5EA] rounded-input px-3 py-2.5 text-sm text-[#1C1C1E] placeholder-[#AEAEB2] outline-none"
        />
        <button
          type="button"
          onClick={addStep}
          className="w-10 h-10 rounded-full bg-[#FF6B35] flex items-center justify-center text-white hover:bg-[#E55A25] flex-shrink-0"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}

// ─── TASK FORM STATE ──────────────────────────────────────────────────────────

interface TaskForm {
  title: string;
  description: string;
  steps: TaskStep[];
  realm: string;
  targetId: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  recurring: Recurrence;
  customDays: number[];
  reminder: TaskReminder;
  isMyDay: boolean;
}

function formatChipDate(dueDate: string, dueTime?: string): string {
  const parsed = parseDueDate(dueDate);
  if (!parsed) return dueDate;
  const day = parsed.getDate();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mon = monthNames[parsed.getMonth()];
  let out = `${day} ${mon}`;
  if (dueTime) {
    const match = dueTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      out += ` ${match[1]}:${match[2]}${match[3] ? ' ' + match[3].toUpperCase() : ''}`;
    }
  }
  return out;
}

function todayDDMMYYYY(): string {
  const n = new Date();
  const d = String(n.getDate()).padStart(2, '0');
  const m = String(n.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${n.getFullYear()}`;
}

const DEFAULT_FORM: TaskForm = {
  title: '',
  description: '',
  steps: [],
  realm: 'Inbox',
  targetId: '',
  priority: 'P4',
  dueDate: todayDDMMYYYY(),
  dueTime: '',
  recurring: 'None',
  customDays: [],
  reminder: { enabled: false, option: 'None' },
  isMyDay: false,
};

// ─── TASK MODAL (CREATE & EDIT) ───────────────────────────────────────────────

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
  const [saving, setSaving] = useState(false);
  const [dtPickerOpen, setDtPickerOpen] = useState(false);
  const [recurringPickerOpen, setRecurringPickerOpen] = useState(false);
  const [reminderPickerOpen, setReminderPickerOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (task) {
        setForm({
          title: task.title,
          description: task.description ?? '',
          steps: task.steps ?? [],
          realm: task.realm || 'Personal',
          targetId: task.targetId ?? task.projectId ?? '',
          priority: task.priority,
          dueDate: task.dueDate ?? '',
          dueTime: task.dueTime ?? '',
          recurring: task.recurring ?? 'None',
          customDays: task.customDays ?? [],
          reminder: task.reminder ?? { enabled: false, option: 'None' },
          isMyDay: task.isMyDay,
        });
        setSelectedFileName('');
      } else {
        setForm({ ...DEFAULT_FORM });
        setSelectedFileName('');
      }
      setIsDirty(false);
    }
  }, [open, task]);

  const set = <K extends keyof TaskForm>(k: K, v: TaskForm[K]) => {
    setIsDirty(true);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const realmProjects = projects.filter((p) => p.realm === form.realm);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Action title is required'); return; }
    setSaving(true);
    try {
      const data = {
        userId,
        title: sanitize(form.title.trim(), 200),
        description: form.description.trim() || undefined,
        steps: form.steps.length > 0 ? form.steps : undefined,
        realm: form.realm,
        targetId: form.targetId || undefined,
        projectId: form.targetId || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        dueTime: form.dueTime || undefined,
        recurring: form.recurring,
        customDays: form.customDays.length > 0 ? form.customDays : undefined,
        reminder: form.reminder,
        isMyDay: form.isMyDay,
        isStarred: task?.isStarred ?? false,
        isCompleted: task?.isCompleted ?? false,
        completedAt: task?.completedAt,
        order: task?.order ?? Date.now(),
        createdAt: task?.createdAt ?? new Date().toISOString(),
      };
      if (task) {
        await updateDocById(COLLECTIONS.TASKS, task.id, data);
        toast.success('Action updated');
      } else {
        await createDoc(COLLECTIONS.TASKS, data);
        toast.success('Action added');
      }
      onClose();
    } catch {
      toast.error('Failed to save action');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!form.title.trim()) { toast.error('Action title is required'); return; }
    setSaving(true);
    try {
      await createDoc(COLLECTIONS.TASKS, {
        userId,
        title: sanitize(`${form.title.trim()} (Copy)`, 200),
        description: form.description.trim() || undefined,
        steps: form.steps.length > 0 ? form.steps : undefined,
        realm: form.realm,
        targetId: form.targetId || undefined,
        projectId: form.targetId || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        dueTime: form.dueTime || undefined,
        recurring: form.recurring,
        customDays: form.customDays.length > 0 ? form.customDays : undefined,
        reminder: form.reminder,
        isMyDay: form.isMyDay,
        isStarred: task?.isStarred ?? false,
        isCompleted: task?.isCompleted ?? false,
        completedAt: task?.completedAt,
        order: Date.now(),
        createdAt: new Date().toISOString(),
      });
      toast.success('Action duplicated');
    } catch {
      toast.error('Failed to duplicate action');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (task) {
      await deleteDocById(COLLECTIONS.TASKS, task.id);
      toast.success('Action deleted');
      onClose();
      return;
    }
    setForm({ ...DEFAULT_FORM });
    setSelectedFileName('');
    setIsDirty(false);
    toast.success('Draft cleared');
  };

  const dueDateInfo = getDueDateDisplay(form.dueDate, form.dueTime);
  const recurringLabel = form.recurring === 'None' ? 'Does not repeat'
    : form.recurring === 'Custom' ? `Custom (${form.customDays.map(i => CUSTOM_DAYS_LABELS[i]).join(', ')})`
      : form.recurring;
  const reminderLabel = !form.reminder.enabled
    ? 'No reminder'
    : form.reminder.option === 'Custom' && form.reminder.customDateTime
      ? `Custom (${form.reminder.customDateTime})`
      : form.reminder.option;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={task ? 'Edit Action' : 'Add Action'}
        footer={
          task ? (
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant="secondary" fullWidth onClick={handleDuplicate}>Duplicate</Button>
              <Button size="sm" variant="danger" fullWidth onClick={handleDelete}>Delete</Button>
              <Button size="sm" fullWidth loading={saving} onClick={handleSave} disabled={!isDirty}>Save</Button>
            </div>
          ) : (
            <Button fullWidth loading={saving} onClick={handleSave}>Add Action</Button>
          )
        }
      >
        <div className="flex flex-col gap-4">
          {/* Title with priority circle */}
          <div className="flex items-center gap-2 border-b border-[#E5E5EA] pb-2">
            <div
              className="flex-shrink-0 w-[16px] h-[16px] rounded-full border-2"
              style={{ borderColor: TASK_PRIORITY_COLORS[form.priority] ?? '#6B7280' }}
            />
            <input
              type="text"
              placeholder="Action title"
              maxLength={200}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus={!task}
              className="flex-1 text-base text-[#1C1C1E] placeholder-[#AEAEB2] outline-none bg-transparent"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#6C6C70] uppercase tracking-wider">Details</label>
              <button
                type="button"
                onClick={() => { fileInputRef.current?.click(); }}
                className="w-7 h-7 flex items-center justify-center text-[#AEAEB2] hover:text-[#6C6C70] rounded-full"
              >
                <Paperclip size={13} />
              </button>
            </div>
            <textarea
              placeholder="Add notes or description"
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="w-full bg-[#F5F5F5] border border-[#E5E5EA] rounded-input px-3 py-2 text-sm text-[#1C1C1E] placeholder-[#AEAEB2] outline-none resize-none"
            />
            {selectedFileName && (
              <p className="text-xs text-[#6C6C70]">📎 {selectedFileName}</p>
            )}
          </div>

          {/* Steps */}
          <StepsEditor steps={form.steps} onChange={(s) => set('steps', s)} />

          {/* Realm / Target / Focus Day */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            <div className="flex items-center gap-1.5 rounded-chip border border-[#E5E5EA] bg-[#F5F5F5] px-2.5 py-1.5 flex-shrink-0">
              <span className="text-sm">{REALM_CONFIG[form.realm]?.emoji}</span>
              <select
                value={form.realm}
                onChange={(e) => { set('realm', e.target.value); set('targetId', ''); }}
                className="bg-transparent text-xs font-medium text-[#1C1C1E] outline-none appearance-none max-w-[80px]"
              >
                {REALMS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5 rounded-chip border border-[#E5E5EA] bg-[#F5F5F5] px-2.5 py-1.5 flex-shrink-0">
              <span className="text-xs text-[#6C6C70]">⊙</span>
              <select
                value={form.targetId}
                onChange={(e) => set('targetId', e.target.value)}
                className="bg-transparent text-xs font-medium text-[#1C1C1E] outline-none appearance-none max-w-[90px]"
              >
                <option value="">Target</option>
                {realmProjects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={() => set('isMyDay', !form.isMyDay)}
              className={cn(
                'flex items-center gap-1.5 rounded-chip border px-2.5 py-1.5 text-xs font-medium transition-colors flex-shrink-0',
                form.isMyDay ? 'border-[#FF6B35] bg-[#FF6B35]/10 text-[#FF6B35]' : 'border-[#E5E5EA] bg-[#F5F5F5] text-[#6C6C70]'
              )}
            >
              <Sun size={12} />
              {form.isMyDay ? 'Focus' : 'Focus'}
            </button>
          </div>

          {/* Priority / Due Date / Repeat / Reminders — horizontal scroll chips */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {/* Priority chip */}
            <div className="flex items-center gap-1.5 rounded-chip border border-[#E5E5EA] bg-[#F5F5F5] px-2.5 py-1.5 flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TASK_PRIORITY_COLORS[form.priority] ?? '#6B7280' }} />
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value as Priority)}
                className="bg-transparent text-xs font-semibold outline-none appearance-none"
                style={{ color: TASK_PRIORITY_COLORS[form.priority] ?? '#6B7280' }}
              >
                {(['P1', 'P2', 'P3', 'P4'] as Priority[]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            {/* Due Date chip */}
            <button
              type="button"
              onClick={() => setDtPickerOpen(true)}
              className={cn(
                'flex items-center gap-1.5 rounded-chip border px-2.5 py-1.5 text-xs font-medium flex-shrink-0 transition-colors',
                form.dueDate ? 'border-[#3B82F6]/40 bg-[#3B82F6]/8 text-[#3B82F6]' : 'border-[#E5E5EA] bg-[#F5F5F5] text-[#6C6C70]'
              )}
            >
              <Calendar size={11} />
              <span>{form.dueDate ? formatChipDate(form.dueDate, form.dueTime) : 'Date'}</span>
              {form.dueDate && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); set('dueDate', ''); set('dueTime', ''); }}
                  className="ml-0.5 text-[#3B82F6]/60 hover:text-[#EF4444] leading-none"
                >×</span>
              )}
            </button>
            {/* Repeat chip */}
            <button
              type="button"
              onClick={() => setRecurringPickerOpen(true)}
              className={cn(
                'flex items-center gap-1.5 rounded-chip border px-2.5 py-1.5 text-xs font-medium flex-shrink-0 transition-colors',
                form.recurring !== 'None' ? 'border-[#3B82F6]/40 bg-[#3B82F6]/8 text-[#3B82F6]' : 'border-[#E5E5EA] bg-[#F5F5F5] text-[#6C6C70]'
              )}
            >
              <Repeat size={11} />
              <span>{form.recurring !== 'None' ? form.recurring : 'Repeat'}</span>
            </button>
            {/* Reminder chip */}
            <button
              type="button"
              onClick={() => setReminderPickerOpen(true)}
              className={cn(
                'flex items-center gap-1.5 rounded-chip border px-2.5 py-1.5 text-xs font-medium flex-shrink-0 transition-colors',
                form.reminder.enabled ? 'border-[#3B82F6]/40 bg-[#3B82F6]/8 text-[#3B82F6]' : 'border-[#E5E5EA] bg-[#F5F5F5] text-[#6C6C70]'
              )}
            >
              <Bell size={11} />
              <span>
                {form.reminder.enabled
                  ? (form.reminder.option === 'Custom' ? 'Custom' : form.reminder.option)
                  : 'Remind'}
              </span>
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedFileName(file.name);
                toast.info('File upload coming soon');
              }
            }}
          />
        </div>
      </Modal>

      <DateTimePickerSheet
        open={dtPickerOpen}
        dueDate={form.dueDate}
        dueTime={form.dueTime}
        onSave={(d, t) => { set('dueDate', d); set('dueTime', t); }}
        onClose={() => setDtPickerOpen(false)}
      />

      <RecurringPickerSheet
        open={recurringPickerOpen}
        recurring={form.recurring}
        customDays={form.customDays}
        onSave={(r, d) => { set('recurring', r); set('customDays', d); }}
        onClose={() => setRecurringPickerOpen(false)}
      />

      <ReminderPickerSheet
        open={reminderPickerOpen}
        reminder={form.reminder}
        onSave={(r) => set('reminder', r)}
        onClose={() => setReminderPickerOpen(false)}
      />
    </>
  );
}


// ─── TARGET POPUP (NEW) ───────────────────────────────────────────────────────

interface TargetForm {
  title: string;
  realm: string;
  dueDate: string;
  isCompleted: boolean;
}

function TargetPopup({
  open, onClose, project, tasks, userId,
}: {
  open: boolean;
  onClose: () => void;
  project: Project | null;
  tasks: Task[];
  userId: string;
}) {
  const [form, setForm] = useState<TargetForm>({ 
    title: '', 
    realm: 'Personal', 
    dueDate: '',
    isCompleted: false 
  });
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [realmDropdownOpen, setRealmDropdownOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (project) {
        setForm({
          title: project.title,
          realm: project.realm,
          dueDate: project.dueDate ?? '',
          isCompleted: project.isCompleted ?? false,
        });
      } else {
        setForm({ 
          title: '', 
          realm: 'Personal', 
          dueDate: '',
          isCompleted: false 
        });
      }
      setIsDirty(false);
    }
  }, [open, project]);

  const set = <K extends keyof TargetForm>(k: K, v: TargetForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Target title is required'); return; }
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
        isCompleted: form.isCompleted,
        completedAt: form.isCompleted ? (project?.completedAt ?? new Date().toISOString()) : undefined,
        order: project?.order ?? Date.now(),
        dueDate: form.dueDate || undefined,
      };
      if (project) {
        await updateDocById(COLLECTIONS.PROJECTS, project.id, data);
        toast.success('Target updated');
      } else {
        await createDoc(COLLECTIONS.PROJECTS, data);
        toast.success('Target created');
      }
      onClose();
    } catch {
      toast.error('Failed to save target');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    try {
      await deleteDocById(COLLECTIONS.PROJECTS, project.id);
      toast.success('Target deleted');
      onClose();
    } catch {
      toast.error('Failed to delete target');
    }
  };

  if (!open) return null;

  return (
    <>
      <Modal open={open} onClose={onClose} forceModal className="max-w-[400px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-[0.2em] text-[#6C6C70]">{project ? 'Edit Target' : 'Add Target'}</span>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-[#6C6C70]" />
          </button>
        </div>

        {/* Target title input */}
        <div className="mb-4">
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Target title"
            autoFocus={false}
            className="w-full bg-transparent outline-none py-2 text-base font-semibold text-[#1C1C1E] placeholder-[#AEAEB2] border-b border-[#E5E5EA] focus:border-[#FF6B35] transition-colors"
          />
        </div>

        {/* Area of Life Dropdown */}
        <div className="mb-4">
          <label className="text-xs font-medium text-[#6C6C70] mb-1 block">Area of Life</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setRealmDropdownOpen(!realmDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-input bg-[#F5F5F5] border border-[#E5E5EA] active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{REALM_CONFIG[form.realm]?.emoji}</span>
                <span className="text-sm text-[#1C1C1E]">{form.realm}</span>
              </div>
              <ChevronDown size={14} className={cn("text-[#AEAEB2] transition-transform", realmDropdownOpen && "rotate-180")} />
            </button>

            {realmDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-[#E5E5EA] rounded-card shadow-sheet p-[2px]">
                {REALMS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { set('realm', r); setRealmDropdownOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[#F5F5F5] transition-colors",
                      form.realm === r && 'bg-[#F5F5F5]'
                    )}
                  >
                    <span className="text-base">{REALM_CONFIG[r].emoji}</span>
                    <span className="text-sm text-[#1C1C1E]">{r}</span>
                    {form.realm === r && <Check size={14} className="ml-auto text-[#3B82F6]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-[1px] bg-[#E5E5EA] my-4" />

        {/* Footer buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setIsDirty(true); }}
            disabled={!project}
            className="flex-1 h-10 rounded bg-[#F5F5F5] border border-[#E5E5EA] text-[12px] font-[500] text-[#1C1C1E] disabled:opacity-40"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!project}
            className="flex-1 h-10 rounded bg-[#F5F5F5] border border-[#E5E5EA] text-[12px] font-[500] text-[#FF4F6D] disabled:opacity-40"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={!project ? handleSave : (isDirty ? handleSave : onClose)}
            className="flex-1 h-10 rounded bg-[#FF6B35] text-white text-[12px] font-[500]"
          >
            {!project ? 'Add' : (isDirty ? 'Update' : 'Cancel')}
          </button>
        </div>
      </Modal>
    </>
  );
}






// ─── TARGET CARD (NEW) ────────────────────────────────────────────────────────
interface TargetCardProps {
  project: Project;
  tasks: Task[];
  onEdit: (p: Project) => void;
  onToggleComplete: (p: Project) => void;
}

function TargetCard({ project, tasks, onEdit, onToggleComplete }: TargetCardProps) {
  const projectTasks = tasks.filter(t => (t.targetId ?? t.projectId) === project.id);
  const completedCount = projectTasks.filter(t => t.isCompleted).length;
  const totalCount = projectTasks.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  // Time remaining % calculation
  const getTimeRemainingPercent = () => {
    if (!project.dueDate || !project.createdAt) return 0;
    const start = new Date(project.createdAt).getTime();
    const end = new Date(project.dueDate).getTime();
    const now = Date.now();
    if (now >= end) return 100;
    const total = end - start;
    if (total <= 0) return 0;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };
  const timePercent = getTimeRemainingPercent();
  const realmColor = REALM_CONFIG[project.realm]?.color || '#FF6B35';

  return (
    <div 
      onClick={() => onEdit(project)}
      className="bg-white rounded-card border border-[#E5E5EA] p-4 flex flex-col gap-3 active:scale-[0.98] transition-all cursor-pointer shadow-sm hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <ArrowCheck 
          completed={project.isCompleted || false} 
          color={realmColor} 
          onClick={(e) => { e.stopPropagation(); onToggleComplete(project); }} 
        />
        <h3 className={cn(
          "text-[15px] font-semibold text-[#1C1C1E] flex-1 truncate",
          project.isCompleted && "line-through text-[#AEAEB2]"
        )}>
          {project.title}
        </h3>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#6C6C70]">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} />
          <span>{project.dueDate ? (() => { const d = new Date(project.dueDate + 'T00:00:00'); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })() : 'No date'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: realmColor }} />
          <span>{project.realm}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[10px] font-medium uppercase tracking-wider">
            <span>Time Used</span>
            <span>{timePercent}%</span>
          </div>
          <ProgressBar value={timePercent} color={timePercent > 90 ? "#FF4F6D" : "#FF9933"} height={4} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[10px] font-medium uppercase tracking-wider">
            <span>Actions Done</span>
            <span>{completedCount}/{totalCount} ({progressPercent}%)</span>
          </div>
          <ProgressBar value={progressPercent} color="#34C759" height={4} />
        </div>
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
  const [targetPopupOpen, setTargetPopupOpen] = useState(false);
  const [detailPopupOpen, setDetailPopupOpen] = useState(false);
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedRealm, setSelectedRealm] = useState<string>('All');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [inBulkMode, setInBulkMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [targetsSubTab, setTargetsSubTab] = useState<string>('All');
  const { permission, pendingCount, requestPermission } = useNotifications(user?.uid ?? '');

  const handleBellClick = async () => {
    if (permission === 'denied') {
      toast.error('Notifications are blocked. Enable them in your browser settings.');
      return;
    }
    if (permission !== 'granted') {
      const result = await requestPermission();
      if (result === 'granted') {
        toast.success('Notifications enabled! You\'ll be reminded about your actions and rhythms.');
      } else {
        toast.error('Notification permission denied.');
      }
      return;
    }
    if (pendingCount > 0) {
      toast.info(`You have ${pendingCount} pending action${pendingCount !== 1 ? 's' : ''} today.`);
    } else {
      toast.success('You\'re all caught up!');
    }
  };

  // Open create modal if ?create=true in URL
  useEffect(() => {
    if (searchParams?.get('create') === 'true') {
      setSelectedTask(null);
      setTaskModalOpen(true);
      router.replace('/tasks');
      return;
    }

    if (searchParams?.get('createTarget') === 'true') {
      setSelectedProject(null);
      setTargetPopupOpen(true);
      router.replace('/tasks');
      return;
    }

    const editId = searchParams?.get('edit');
    if (editId && tasks.length > 0) {
      const taskToEdit = tasks.find((t) => t.id === editId);
      if (taskToEdit) {
        setSelectedTask(taskToEdit);
        setTaskModalOpen(true);
        router.replace('/tasks');
      }
    }

  }, [searchParams, router, tasks]);

  useEffect(() => {
    if (inBulkMode && selectedTasks.size === 0) setInBulkMode(false);
  }, [selectedTasks, inBulkMode]);

  // ── Tab content ──────────────────────────────────────────────────────────
  const today = todayMidnight();
  const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7);

  const todayTasks = useMemo(() => {
    // Dated tasks due today or overdue (exclude completed)
    const dated = tasks.filter((t) => {
      if (t.isCompleted || !t.dueDate) return false;
      const due = parseDueDate(t.dueDate);
      return due ? due.getTime() <= today.getTime() : false;
    }).sort((a, b) => {
      const aOver = isTaskOverdue(a) ? 0 : 1;
      const bOver = isTaskOverdue(b) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      return parseInt(a.priority[1]) - parseInt(b.priority[1]);
    });
    // No-date actions sorted to bottom by createdAt
    const undated = tasks.filter((t) => !t.isCompleted && !t.dueDate)
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
    return [...dated, ...undated];
  }, [tasks, today]);

  const inboxTasks = useMemo(() => {
    // Inbox = realm is 'Inbox' (or legacy: no realm set), not completed
    return tasks
      .filter((t) => !t.isCompleted && (t.realm === 'Inbox' || !t.realm))
      .sort((a, b) => parseInt(a.priority[1]) - parseInt(b.priority[1]));
  }, [tasks]);

  const upcomingTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.isCompleted || !t.dueDate) return false;
      const due = parseDueDate(t.dueDate);
      return due ? due.getTime() > today.getTime() : false;
    }).sort((a, b) => {
      const da = parseDueDate(a.dueDate!)?.getTime() ?? 0;
      const db = parseDueDate(b.dueDate!)?.getTime() ?? 0;
      return da - db;
    });
  }, [tasks, today]);

  const completedTasks = useMemo(() => tasks.filter(
    (t) => t.isCompleted && t.completedAt && new Date(t.completedAt) >= sevenDaysAgo
  ).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')), [tasks, sevenDaysAgo]);

  const filteredTargets = useMemo(() => {
    let p = projects;
    if (selectedRealm !== 'All') {
      p = p.filter(proj => proj.realm === selectedRealm);
    }
    
    const uncompleted = p.filter(proj => !proj.isCompleted).sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
    
    const completed = p.filter(proj => proj.isCompleted).sort((a, b) => 
      (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
    );
    
    return [...uncompleted, ...completed];
  }, [projects, selectedRealm]);

  const currentTabTasks: Task[] = {
    today: todayTasks, inbox: inboxTasks, upcoming: upcomingTasks,
    completed: completedTasks, targets: [],
  }[activeTab];

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleComplete = useCallback(async (task: Task) => {
    const now = new Date().toISOString();
    const willComplete = !task.isCompleted;
    await updateDocById(COLLECTIONS.TASKS, task.id, {
      isCompleted: willComplete,
      completedAt: willComplete ? now : undefined,
    });
    if (willComplete) {
      toast.success('Action completed!');
      if (task.recurring && task.recurring !== 'None' && task.dueDate) {
        const nextDue = getNextDueDateFromStr(task.dueDate, task.recurring, task.customDays);
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

  const handleBulkComplete = async () => {
    const now = new Date().toISOString();
    await Promise.all(
      Array.from(selectedTasks).map((id) =>
        updateDocById(COLLECTIONS.TASKS, id, { isCompleted: true, completedAt: now })
      )
    );
    toast.success(`${selectedTasks.size} action(s) completed.`);
    setSelectedTasks(new Set()); setInBulkMode(false);
  };

  const handleBulkDelete = async () => {
    await Promise.all(Array.from(selectedTasks).map((id) => deleteDocById(COLLECTIONS.TASKS, id)));
    toast.success(`${selectedTasks.size} action(s) deleted.`);
    setSelectedTasks(new Set()); setInBulkMode(false); setBulkDeleteConfirm(false);
  };

  const toggleSelect = useCallback((task: Task) => {
    setInBulkMode(true);
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
      return next;
    });
  }, []);

  const handleDeleteProject = useCallback(async () => {
    if (!selectedProject) return;
    const linked = tasks.filter((t) => (t.targetId ?? t.projectId) === selectedProject.id);
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      linked.map((t) => updateDocById(COLLECTIONS.TASKS, t.id, { targetId: null, projectId: null } as any))
    );
    await deleteDocById(COLLECTIONS.PROJECTS, selectedProject.id);
    toast.success('Target deleted.');
    setSelectedProject(null);
  }, [selectedProject, tasks]);

  const handleToggleFavorite = useCallback(async (project: Project) => {
    await updateDocById(COLLECTIONS.PROJECTS, project.id, { isFavorite: !project.isFavorite });
  }, []);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'inbox', label: 'Inbox' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'completed', label: 'Complete' },
    { id: 'targets', label: 'Targets' },
  ];

  const emptyMessages: Record<TabId, { title: string; subtitle: string }> = {
    today: { title: 'All clear today', subtitle: 'No actions due today. Enjoy your day!' },
    inbox: { title: 'Inbox is empty', subtitle: 'Actions without a Target appear here.' },
    upcoming: { title: 'Nothing upcoming', subtitle: 'Schedule actions with a future due date.' },
    completed: { title: 'Nothing completed recently', subtitle: 'Complete actions to see them here.' },
    targets: { title: 'No Targets yet', subtitle: 'Create your first Target to organise your Actions.' },
  };

  const loading = tasksLoading || projectsLoading;

  const targetTabs = ['All', ...REALMS];
  const filteredProjects = useMemo(() => {
    if (targetsSubTab === 'All') return projects;
    return projects.filter((p) => p.realm === targetsSubTab);
  }, [projects, targetsSubTab]);

  const overdueCount = todayTasks.filter((t) => isTaskOverdue(t)).length;

  return (
    <div className="flex flex-col min-h-dvh bg-[#F2F2F7]">
      {/* Redesigned Header: ☰ logo RISE – Actions [+ Add] 🔔 */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E5EA] px-3 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-[#6C6C70] rounded-full hover:bg-[#F2F2F7]"
          >
            <Menu size={22} />
          </button>
          
          <div className="flex items-center gap-1.5">
            <Image
              src="/icons/icon-maskable-912.png"
              alt="RISE"
              width={22}
              height={22}
              priority
            />
            <span className="text-[15px] font-bold text-[#FF9933] tracking-widest">RISE</span>
            <span className="text-[#AEAEB2] mx-0.5">—</span>
            <span className="text-[15px] font-semibold text-[#1C1C1E]">Actions</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'targets') {
                setSelectedProject(null);
                setTargetPopupOpen(true);
              } else {
                setSelectedTask(null);
                setTaskModalOpen(true);
              }
            }}
            className="h-10 px-2 flex items-center gap-1 text-[13px] font-medium text-[#FF6B35] active:scale-95 transition-all"
          >
            <Plus size={14} />
            {activeTab === 'targets' ? 'Target' : 'Action'}
          </button>
          
          <button
            type="button"
            onClick={handleBellClick}
            className="w-10 h-10 flex items-center justify-center text-[#6C6C70] rounded-full hover:bg-[#F2F2F7]"
          >
            <Bell size={20} />
          </button>
        </div>
      </header>

      {/* Main Tabs */}
      <div className="bg-white border-b border-[#E5E5EA] overflow-x-auto no-scrollbar">
        <div className="flex px-4 h-11">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setInBulkMode(false); setSelectedTasks(new Set()); }}
              className={cn(
                'flex-shrink-0 px-4 h-full text-[13px] font-medium transition-all relative',
                activeTab === tab.id ? 'text-[#FF6B35]' : 'text-[#6C6C70]'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#FF6B35] rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Bulk toolbar */}
      {inBulkMode && selectedTasks.size > 0 && (
        <div className="sticky top-14 z-30 flex items-center gap-3 px-4 py-2 bg-[#F5F5F5] border-b border-[#E5E5EA] animate-fade-in">
          <span className="text-[12px] font-medium text-[#1C1C1E] flex-1">{selectedTasks.size} selected</span>
          <button onClick={() => { setInBulkMode(false); setSelectedTasks(new Set()); }} className="text-[12px] text-[#6C6C70] font-medium">Cancel</button>
          <button onClick={handleBulkComplete} className="text-[12px] text-[#FF6B35] font-semibold">Complete</button>
          <button onClick={() => setBulkDeleteConfirm(true)} className="text-[12px] text-[#FF4F6D] font-semibold">Delete</button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 pb-24">
        {activeTab === 'targets' ? (
          <div className="flex flex-col">
            {/* Realm Tabs */}
            <div className="flex gap-2 overflow-x-auto p-4 no-scrollbar">
              {['All', ...REALMS].map((realmName) => (
                <button
                  key={realmName}
                  type="button"
                  onClick={() => setSelectedRealm(realmName)}
                  className={cn(
                    'flex-shrink-0 h-9 px-4 rounded-full text-[12px] font-medium transition-colors',
                    selectedRealm === realmName
                      ? 'bg-[#FF6B35] text-white'
                      : 'bg-white text-[#6C6C70] border border-[#E5E5EA]'
                  )}
                >
                  {realmName}
                </button>
              ))}
            </div>

            <div className="px-4 flex flex-col gap-2">
              {loading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-white rounded-card border border-[#E5E5EA] animate-pulse" />)}
                </div>
              ) : filteredTargets.length === 0 ? (
                <EmptyState
                  icon={Crosshair}
                  title="No Targets match your filter"
                  subtitle="Try selecting a different realm or create a new target."
                />
              ) : (
                filteredTargets.map((p) => (
                  <TargetCard
                    key={p.id}
                    project={p}
                    tasks={tasks}
                    onEdit={(proj) => { setSelectedProject(proj); setTargetPopupOpen(true); }}
                    onToggleComplete={async (proj) => {
                      const completed = !proj.isCompleted;
                      await updateDocById(COLLECTIONS.PROJECTS, proj.id, { 
                        isCompleted: completed,
                        completedAt: completed ? new Date().toISOString() : undefined
                      });
                      toast.success(completed ? 'Target achieved!' : 'Target reopened');
                    }}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          /* Task List Tabs content */
          <div className="px-4 py-4 flex flex-col gap-2">
            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-white rounded-md border border-[#F2F2F7] animate-pulse" />)}
              </div>
            ) : currentTabTasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title={emptyMessages[activeTab].title}
                subtitle={emptyMessages[activeTab].subtitle}
                actionLabel={`+ New Action`}
                onAction={() => { setSelectedTask(null); setTaskModalOpen(true); }}
              />
            ) : (
              currentTabTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  projects={projects}
                  onComplete={handleComplete}
                  onEdit={(task) => { setSelectedTask(task); setDetailPopupOpen(true); }}
                  selected={selectedTasks.has(t.id)}
                  onSelect={toggleSelect}
                  inBulkMode={inBulkMode}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <TaskModal
        open={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        projects={projects}
        userId={user?.uid ?? ''}
      />

      <ActionDetailPopup
        open={detailPopupOpen && !!selectedTask}
        onClose={() => {
          setDetailPopupOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        projects={projects}
        userId={user?.uid ?? ''}
        onComplete={handleComplete}
      />

      <TargetPopup
        open={targetPopupOpen}
        onClose={() => {
          setTargetPopupOpen(false);
          setSelectedProject(null);
        }}
        project={selectedProject}
        tasks={tasks}
        userId={user?.uid ?? ''}
      />

      <ConfirmModal
        open={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Delete Actions"
        message={`Delete ${selectedTasks.size} selected action(s)? This cannot be undone.`}
        confirmLabel="Delete All"
      />
    </div>
  );
}
