'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { useAuth } from '@/components/providers/AuthProvider';
import { addDocument, updateDocument } from '@/lib/firestore';
import { Project, LIFE_AREAS, LifeArea } from '@/lib/types';
import { toast } from '@/lib/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  project?: Project;
  defaultArea?: LifeArea;
  onSaved?: () => void;
}

export default function ProjectModal({ open, onClose, project, defaultArea, onSaved }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<LifeArea>(defaultArea ?? 'Inbox');

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setArea(project.area ?? project.realm ?? 'Personal');
    } else {
      setTitle('');
      setArea(defaultArea ?? 'Inbox');
    }
  }, [project, open, defaultArea]);

  const handleSave = async () => {
    if (!title.trim() || !user) return;

    const areaConfig = LIFE_AREAS.find(a => a.id === area);
    const data = {
      title: title.trim(),
      area,
      color: areaConfig?.color ?? '#6B7280',
      icon: areaConfig?.emoji ?? '📋',
      isFavorite: false,
      order: project?.order ?? Date.now(),
    };

    try {
      if (project) {
        await updateDocument('projects', project.id, data);
        toast('Target updated', 'success');
      } else {
        await addDocument('projects', data, user.uid);
        toast('Target created', 'success');
      }
      if (onSaved) onSaved();
      onClose();
    } catch (error) {
      console.error('Failed to save project:', error);
      toast('Failed to save target', 'error');
    }
  };

  const areaConfig = LIFE_AREAS.find(a => a.id === area);

  return (
    <Modal open={open} onClose={onClose} title={project ? 'Edit Target' : 'New Target'} size="sm">
      <div className="space-y-4">
        {/* Area preview pill */}
        {areaConfig && (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: areaConfig.color }}
            >
              {areaConfig.emoji} {areaConfig.name}
            </span>
          </div>
        )}

        <Input
          label="Target Name"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. New Website, Q2 Budget…"
          autoFocus
        />

        <Select
          label="Realm"
          value={area}
          onChange={e => setArea(e.target.value as LifeArea)}
          options={LIFE_AREAS.map(a => ({ value: a.id, label: `${a.emoji} ${a.name}` }))}
        />

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1 text-xs py-2">Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim()} className="flex-1 text-xs py-2">
            {project ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
