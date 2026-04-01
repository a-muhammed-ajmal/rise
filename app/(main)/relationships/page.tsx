'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, deleteDocument } from '@/lib/firestore';
import { Connection, ConnectionType } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { cn, formatDate } from '@/lib/utils';
import { Plus, Users, Trash2, Phone, Mail, Calendar } from 'lucide-react';

const CONN_TYPES: ConnectionType[] = ['Father', 'Mother', 'Spouse', 'Sibling', 'Child', 'Extended Family', 'Close Friend', 'Colleague', 'Mentor', 'Other'];
const TYPE_EMOJIS: Record<string, string> = {
  Father: '👨', Mother: '👩', Spouse: '💑', Sibling: '👫', Child: '👶',
  'Extended Family': '👪', 'Close Friend': '🤝', Colleague: '💼', Mentor: '🎓', Other: '👤'
};

export default function RelationshipsPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: connections, loading } = useCollection<Connection>('connections', uid);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ConnectionType>('Close Friend');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [importantDate, setImportantDate] = useState('');
  const [dateType, setDateType] = useState('Birthday');
  const [notes, setNotes] = useState('');

  const handleAdd = async () => {
    if (!name.trim() || !user) return;
    await addDocument('connections', { name: name.trim(), type, mobile, email, importantDate, dateType, notes } as Partial<Connection>, user.uid);
    setName(''); setMobile(''); setEmail(''); setImportantDate(''); setNotes('');
    setModalOpen(false);
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Relationships</h1>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-rise text-white rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={18} /> Add
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-surface-2 animate-pulse" />)}</div>
      ) : connections.length === 0 ? (
        <EmptyState icon={Users} title="No connections" description="Add your family, friends, and colleagues" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {connections.map(c => (
            <div key={c.id} className="bg-surface-2 rounded-xl p-4 border border-border group">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-pink/10 flex items-center justify-center text-xl shrink-0">
                  {TYPE_EMOJIS[c.type] || '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text">{c.name}</p>
                  <p className="text-xs text-text-3">{c.type}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-3">
                    {c.mobile && <span className="flex items-center gap-1"><Phone size={12} />{c.mobile}</span>}
                    {c.email && <span className="flex items-center gap-1"><Mail size={12} />{c.email}</span>}
                    {c.importantDate && <span className="flex items-center gap-1"><Calendar size={12} />{c.dateType}: {formatDate(c.importantDate)}</span>}
                  </div>
                </div>
                <button onClick={() => deleteDocument('connections', c.id)} className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500 p-1"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Connection">
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" autoFocus />
          <Select label="Type" value={type} onChange={e => setType(e.target.value as ConnectionType)}
            options={CONN_TYPES.map(t => ({ value: t, label: `${TYPE_EMOJIS[t] || ''} ${t}` }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Mobile" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+971..." />
            <Input label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Important Date" type="date" value={importantDate} onChange={e => setImportantDate(e.target.value)} />
            <Select label="Date Type" value={dateType} onChange={e => setDateType(e.target.value)}
              options={['Birthday', 'Anniversary', 'Memorial', 'Other'].map(d => ({ value: d, label: d }))} />
          </div>
          <TextArea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes about this person..." />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAdd} disabled={!name.trim()} className="flex-1">Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
