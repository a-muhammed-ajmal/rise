'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, updateDocument } from '@/lib/firestore';
import {
  Task, Project, LIFE_AREAS, PRIORITY_CONFIG,
  LifeArea, Priority, Recurrence,
} from '@/lib/types';
import { Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  task?: Task;
  projects: Project[];
  initArea?: LifeArea;
  initProjectId?: string;
  onSaved?: () => void;
}

export default function TaskModal({ open, onClose, task, projects, initArea, initProjectId, onSaved }: Props) {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState<LifeArea>('Inbox');
  const [projectId, setProjectId] = useState('');
  const [connectedTo, setConnectedTo] = useState('');
  const [priority, setPriority] = useState<Priority>('P4');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [isMyDay, setIsMyDay] = useState(false);
  const [recurring, setRecurring] = useState<Recurrence>('None');

  // Projects filtered by the currently selected area (cascading)
  const areaProjects = projects.filter(p => p.area === area);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setArea(task.area);
      setProjectId(task.projectId ?? '');
      setConnectedTo(task.connectionId ?? '');
      setPriority(task.priority);
      setDueDate(task.dueDate ?? '');
      setDueTime(task.dueTime ?? '');
      setIsMyDay(task.isMyDay);
      setRecurring(task.recurring ?? 'None');
    } else {
      setTitle('');
      setDescription('');
      setArea(initArea ?? 'Inbox');
      setProjectId(initProjectId ?? '');
      setConnectedTo('');
      setPriority('P4');
      setDueDate('');
      setDueTime('');
      setIsMyDay(false);
      setRecurring('None');
    }
  }, [task, open, initArea, initProjectId]);

  // Reset projectId when area changes (cascading)
  const handleAreaChange = (newArea: LifeArea) => {
    setArea(newArea);
    setProjectId('');
  };

  const handleSave = async () => {
    if (!title.trim() || !user) return;

    const data: Partial<Task> = {
      title: title.trim(),
      description,
      area,
      projectId: projectId || undefined,
      connectionId: connectedTo || undefined,
      priority,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      isMyDay,
      recurring,
      isCompleted: task?.isCompleted ?? false,
      order: task?.order ?? Date.now(),
    };

    try {
      if (task) {
        await updateDocument('tasks', task.id, data);
        toast('Task updated', 'success');
      } else {
        await addDocument('tasks', data, user.uid);
        toast('Task created', 'success');
      }
      if (onSaved) onSaved();
      onClose();
    } catch (error) {
      console.error('Failed to save task:', error);
      toast('Failed to save task', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={task ? 'Edit Task' : 'New Task'} size="sm">
      <div className="space-y-3">
        {/* Title */}
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          autoFocus
          className="text-sm"
        />

        {/* Area & Project */}
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Area"
            value={area}
            onChange={e => handleAreaChange(e.target.value as LifeArea)}
            options={LIFE_AREAS.map(a => ({ value: a.id, label: `${a.emoji} ${a.name}` }))}
            className="text-xs"
          />
          <Select
            label="Project"
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            options={[
              { value: '', label: 'None' },
              ...areaProjects.map(p => ({ value: p.id, label: p.title })),
            ]}
            className="text-xs"
          />
        </div>

        {/* Priority - Clean list with colors */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-2">Priority</label>
          <div className="grid grid-cols-2 gap-1.5">
            {(['P1', 'P2', 'P3', 'P4'] as Priority[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  priority === p
                    ? 'border-transparent text-white'
                    : 'border-border text-text-2 hover:border-text-3'
                )}
                style={priority === p ? { backgroundColor: PRIORITY_CONFIG[p].color } : undefined}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PRIORITY_CONFIG[p].color }}
                />
                {p} — {PRIORITY_CONFIG[p].short}
              </button>
            ))}
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Date"
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="text-xs"
          />
          <Input
            label="Time"
            type="time"
            value={dueTime}
            onChange={e => setDueTime(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Connected To - Placeholder for CRM */}
        <Select
          label="Connected To"
          value={connectedTo}
          onChange={() => {}}
          options={[
            { value: '', label: 'No connections yet' },
          ]}
          className="text-xs"
          disabled
        />

        {/* Recurring */}
        <Select
          label="Recurring"
          value={recurring}
          onChange={e => setRecurring(e.target.value as Recurrence)}
          options={[
            { value: 'None', label: 'Does not repeat' },
            { value: 'Daily', label: 'Daily' },
            { value: 'Weekly', label: 'Weekly' },
            { value: 'Monthly', label: 'Monthly' },
            { value: 'Yearly', label: 'Yearly' },
          ]}
          className="text-xs"
        />

        {/* Notes */}
        <TextArea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Add notes…"
          className="text-xs"
          rows={2}
        />

        {/* Today's Focus */}
        <button
          type="button"
          onClick={() => setIsMyDay(v => !v)}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-colors',
            isMyDay ? 'border-rise text-rise bg-rise/5' : 'border-border text-text-3',
          )}
        >
          <Sun size={13} /> Today&apos;s Focus
        </button>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1 text-xs py-2">Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim()} className="flex-1 text-xs py-2">
            {task ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
