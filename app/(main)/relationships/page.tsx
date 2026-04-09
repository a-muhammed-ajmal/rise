'use client';

import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { createDoc, updateDocById, deleteDocById } from '@/lib/firestore';
import { COLLECTIONS, CONNECTION_TYPES } from '@/lib/constants';
import { getDaysUntil, cn } from '@/lib/utils';
import type { Connection, ConnectionType } from '@/lib/types';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';

type FilterType = 'All' | ConnectionType;

const TYPE_GROUPS: Record<string, FilterType[]> = {
  Family: ['Spouse', 'Child', 'Parent', 'Sibling'],
  Friends: ['Friend'],
  Colleagues: ['Colleague', 'Mentor'],
  Clients: ['Client'],
  Other: ['Other'],
};

function ConnectionModal({ open, onClose, connection, userId }: { open: boolean; onClose: () => void; connection: Connection | null; userId: string; }) {
  const [form, setForm] = useState({ name: connection?.name ?? '', type: (connection?.type ?? 'Friend') as ConnectionType, relationship: connection?.relationship ?? '', mobile: connection?.mobile ?? '', email: connection?.email ?? '', birthday: connection?.birthday ?? '', importantDate: connection?.importantDate ?? '', notes: connection?.notes ?? '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    setSaving(true);
    try {
      const data = { userId, name: sanitize(form.name, 100), type: form.type, relationship: sanitize(form.relationship), mobile: form.mobile, email: form.email, birthday: form.birthday || undefined, importantDate: form.importantDate || undefined, notes: sanitize(form.notes) };
      if (connection) await updateDocById(COLLECTIONS.CONNECTIONS, connection.id, data);
      else await createDoc(COLLECTIONS.CONNECTIONS, data);
      toast.success('Connection saved.');
      onClose();
    } catch { toast.error('Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={connection ? 'Edit Connection' : 'New Connection'} footer={<div className="flex gap-3"><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth loading={saving} onClick={handleSave}>Save</Button></div>}>
      <div className="flex flex-col gap-4">
        <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        <Select label="Type" value={form.type} onChange={(e) => set('type', (e.target as HTMLSelectElement).value)} options={CONNECTION_TYPES.map((t) => ({ value: t, label: t }))} />
        <Input label="Relationship" value={form.relationship} onChange={(e) => set('relationship', e.target.value)} placeholder="e.g. Best friend since college" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Mobile" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <Input label="Birthday" type="date" value={form.birthday} onChange={(e) => set('birthday', e.target.value)} />
        <Input label="Important Date" type="date" value={form.importantDate} onChange={(e) => set('importantDate', e.target.value)} />
        <Textarea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
      </div>
    </Modal>
  );
}

export default function RelationshipsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editConn, setEditConn] = useState<Connection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null);

  const { data: connections, loading } = useCollection<Connection>({ userId: user?.uid ?? '', collectionName: COLLECTIONS.CONNECTIONS, enabled: !!user });

  const filtered = filter === 'All' ? connections : connections.filter((c) => c.type === filter);

  // Upcoming birthdays within 7 days
  const upcoming = connections.filter((c) => c.birthday && getDaysUntil(c.birthday) >= 0 && getDaysUntil(c.birthday) <= 7);

  const filterTabs: { id: FilterType; label: string }[] = [
    { id: 'All', label: 'All' },
    { id: 'Spouse', label: 'Family' },
    { id: 'Friend', label: 'Friends' },
    { id: 'Colleague', label: 'Colleagues' },
    { id: 'Client', label: 'Clients' },
    { id: 'Other', label: 'Other' },
  ];

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="px-4 pt-4 pb-3 border-b border-[#2A2A2A]">
        <h1 className="text-xl font-bold text-[#F0F0F0] mb-3">Relationships</h1>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4">
          {filterTabs.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={cn('flex-shrink-0 h-8 px-4 rounded-chip text-xs font-medium transition-colors', filter === f.id ? 'bg-[#FF4F6D] text-white' : 'bg-[#141414] text-[#8A8A8A] border border-[#2A2A2A]')}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-4 pb-6 flex flex-col gap-3">
        {/* Upcoming banner */}
        {upcoming.length > 0 && (
          <div className="bg-[#FF6B35]/10 border border-[#FF6B35]/30 rounded-card p-3">
            {upcoming.map((c) => (
              <p key={c.id} className="text-sm text-[#FF6B35]">🎂 {c.name}&apos;s birthday in {getDaysUntil(c.birthday!)} day{getDaysUntil(c.birthday!) !== 1 ? 's' : ''}</p>
            ))}
          </div>
        )}

        {loading ? <>{[1,2,3].map((i) => <SkeletonCard key={i} />)}</> :
         filtered.length === 0 ? <EmptyState icon={Users} title="No connections yet" subtitle="Add people who matter to you." actionLabel="Add Connection" onAction={() => { setEditConn(null); setModalOpen(true); }} /> :
         filtered.map((conn) => (
          <div key={conn.id} onClick={() => { setEditConn(conn); setModalOpen(true); }} className="bg-[#141414] rounded-card border border-[#2A2A2A] p-4 flex items-center gap-3 active:bg-[#1C1C1C] transition-colors">
            <Avatar name={conn.name} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#F0F0F0]">{conn.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge label={conn.type} color="#FF4F6D" />
                {conn.birthday && getDaysUntil(conn.birthday) >= 0 && getDaysUntil(conn.birthday) <= 30 && (
                  <span className="text-xs text-[#FF6B35]">🎂 {getDaysUntil(conn.birthday)}d</span>
                )}
              </div>
            </div>
            {conn.mobile && (
              <a href={`tel:${conn.mobile}`} onClick={(e) => e.stopPropagation()} className="text-xs text-[#1E4AFF]">{conn.mobile}</a>
            )}
          </div>
         ))
        }
      </div>

      <button onClick={() => { setEditConn(null); setModalOpen(true); }} className="fixed bottom-[80px] right-4 w-14 h-14 bg-[#FF4F6D] rounded-full flex items-center justify-center shadow-fab active:scale-95 transition-transform sm:hidden z-30"><Plus size={24} className="text-white" /></button>
      <ConnectionModal open={modalOpen} onClose={() => setModalOpen(false)} connection={editConn} userId={user?.uid ?? ''} />
      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => { if (deleteTarget) { await deleteDocById(COLLECTIONS.CONNECTIONS, deleteTarget.id); toast.success('Connection deleted.'); setDeleteTarget(null); } }} title="Delete Connection" message={`Delete "${deleteTarget?.name}"?`} />
    </div>
  );
}
