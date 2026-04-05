'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firestore';
import { Connection, ConnectionType, ImportantDateType } from '@/lib/types';
import dynamic from 'next/dynamic';
const Modal = dynamic(() => import('@/components/ui/Modal'), { ssr: false });
import Button from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { cn, formatDate } from '@/lib/utils';
import { Plus, Users, Trash2, Phone, Mail, Calendar, Edit2, Gift } from 'lucide-react';

const CONN_TYPES: ConnectionType[] = ['Spouse', 'Child', 'Parent', 'Sibling', 'Friend', 'Colleague', 'Other'];
const TYPE_EMOJIS: Record<string, string> = {
  Spouse: '💑', Child: '👶', Parent: '👪', Sibling: '👫',
  Friend: '🤝', Colleague: '💼', Other: '👤'
};

export default function RelationshipsPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: connections, loading } = useCollection<Connection>('connections', uid);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState<ConnectionType>('Friend');
  const [relationship, setRelationship] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [importantDate, setImportantDate] = useState('');
  const [dateType, setDateType] = useState<ImportantDateType>('Birthday');
  const [notes, setNotes] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null);

  // Filter state
  const [filterType, setFilterType] = useState<string>('All');

  const resetForm = () => {
    setName(''); setType('Friend'); setRelationship(''); setMobile('');
    setEmail(''); setImportantDate(''); setDateType('Birthday'); setNotes('');
    setEditingConnection(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (c: Connection) => {
    setEditingConnection(c);
    setName(c.name);
    setType(c.type);
    setRelationship(c.relationship || '');
    setMobile(c.mobile || '');
    setEmail(c.email || '');
    setImportantDate(c.importantDate || '');
    setDateType((c.dateType as ImportantDateType) || 'Birthday');
    setNotes(c.notes || '');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !user) return;
    const data: Partial<Connection> = {
      name: name.trim(), type, relationship: relationship.trim() || undefined,
      mobile: mobile.trim() || undefined, email: email.trim() || undefined,
      importantDate: importantDate || undefined, dateType, notes: notes.trim() || undefined,
    };
    if (editingConnection) {
      await updateDocument('connections', editingConnection.id, data);
    } else {
      await addDocument('connections', data, user.uid);
    }
    resetForm();
    setModalOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDocument('connections', deleteTarget.id);
    setDeleteTarget(null);
  };

  // Upcoming important dates (next 30 days)
  const upcomingDates = useMemo(() => {
    if (!connections.length) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    return connections
      .filter(c => c.importantDate)
      .map(c => {
        const parts = c.importantDate!.split('-');
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        // Build the upcoming occurrence this year
        const thisYear = today.getFullYear();
        let upcoming = new Date(thisYear, month - 1, day);
        // If the date already passed this year, use next year
        if (upcoming < today) {
          upcoming = new Date(thisYear + 1, month - 1, day);
        }
        return { connection: c, upcoming };
      })
      .filter(({ upcoming }) => upcoming >= today && upcoming <= thirtyDaysLater)
      .sort((a, b) => a.upcoming.getTime() - b.upcoming.getTime());
  }, [connections]);

  // Filtered connections
  const filteredConnections = useMemo(() => {
    if (filterType === 'All') return connections;
    return connections.filter(c => c.type === filterType);
  }, [connections, filterType]);

  const formatUpcomingDate = (date: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff <= 7) return `In ${diff} days`;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[date.getMonth()]} ${date.getDate()}`;
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Relationships</h1>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2.5 bg-rise text-[#0A0A0F] rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={18} /> Add
        </button>
      </div>

      {/* Upcoming Important Dates */}
      {upcomingDates.length > 0 && (
        <div className="mb-6 bg-surface-2 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={18} className="text-rise" />
            <h2 className="font-bold text-text text-sm">Upcoming Important Dates</h2>
          </div>
          <div className="space-y-2">
            {upcomingDates.map(({ connection: c, upcoming }) => (
              <div key={c.id} className="flex items-center gap-3 text-sm">
                <span className="text-lg">{TYPE_EMOJIS[c.type] || '👤'}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-text">{c.name}</span>
                  <span className="text-text-3 ml-2">{c.dateType || 'Birthday'}</span>
                </div>
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  Math.round((upcoming.getTime() - new Date().setHours(0,0,0,0)) / (1000*60*60*24)) <= 3
                    ? 'bg-red-500/10 text-red-500'
                    : 'bg-rise/10 text-rise'
                )}>
                  {formatUpcomingDate(upcoming)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter by type */}
      {connections.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
          {['All', ...CONN_TYPES].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
                filterType === t
                  ? 'bg-rise text-[#0A0A0F]'
                  : 'bg-surface-2 text-text-3 hover:text-text'
              )}
            >
              {t !== 'All' && TYPE_EMOJIS[t] ? `${TYPE_EMOJIS[t]} ` : ''}{t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-surface-2 animate-pulse" />)}</div>
      ) : connections.length === 0 ? (
        <EmptyState icon={Users} title="No connections" description="Add your family, friends, and colleagues" />
      ) : filteredConnections.length === 0 ? (
        <EmptyState icon={Users} title="No matches" description={`No connections of type "${filterType}"`} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredConnections.map(c => (
            <div
              key={c.id}
              onClick={() => openEditModal(c)}
              className="bg-surface-2 rounded-xl p-4 border border-border group cursor-pointer hover:border-rise/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-pink/10 flex items-center justify-center text-xl shrink-0">
                  {TYPE_EMOJIS[c.type] || '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text">{c.name}</p>
                  <p className="text-xs text-text-3">{c.type}{c.relationship ? ` — ${c.relationship}` : ''}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-3">
                    {c.mobile && <span className="flex items-center gap-1"><Phone size={12} />{c.mobile}</span>}
                    {c.email && <span className="flex items-center gap-1"><Mail size={12} />{c.email}</span>}
                    {c.importantDate && <span className="flex items-center gap-1"><Calendar size={12} />{c.dateType}: {formatDate(c.importantDate)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(c); }}
                    className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-rise p-1 transition-opacity"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                    className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500 p-1 transition-opacity"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title={editingConnection ? 'Edit Connection' : 'New Connection'}>
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" autoFocus />
          <Select label="Type" value={type} onChange={e => setType(e.target.value as ConnectionType)}
            options={CONN_TYPES.map(t => ({ value: t, label: `${TYPE_EMOJIS[t] || ''} ${t}` }))} />
          <Input label="Relationship" value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="e.g. Best friend from college, Team lead" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Mobile" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+971..." />
            <Input label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Important Date" type="date" value={importantDate} onChange={e => setImportantDate(e.target.value)} />
            <Select label="Date Type" value={dateType} onChange={e => setDateType(e.target.value as ImportantDateType)}
              options={['Birthday', 'Anniversary', 'Special Day', 'Custom'].map(d => ({ value: d, label: d }))} />
          </div>
          <TextArea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes about this person..." />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim()} className="flex-1">
              {editingConnection ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Connection" size="sm">
        <div className="space-y-4">
          <p className="text-text-3 text-sm">
            Are you sure you want to delete <span className="font-semibold text-text">{deleteTarget?.name}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button onClick={handleDelete} className="flex-1 !bg-red-500 hover:!bg-red-600">Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
