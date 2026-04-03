'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firestore';
import { RiseDocument, DOCUMENT_CATEGORIES } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { Plus, FileText, Trash2, ExternalLink, Edit2, Search } from 'lucide-react';

const CAT_COLORS: Record<string, string> = {
  Legal: '#1E3A5F', Financial: '#2D7C3E', Medical: '#4A9B8E', Travel: '#FF9933',
  Educational: '#7B4B9E', Insurance: '#E8849B', Personal: '#FF8C42', Other: '#6B7280',
};

export default function DocumentsPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: docs, loading } = useCollection<RiseDocument>('documents', uid);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<RiseDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RiseDocument | null>(null);
  const [catFilter, setCatFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('Personal');
  const [notes, setNotes] = useState('');
  const [urlError, setUrlError] = useState('');

  const filtered = useMemo(() => {
    let result = docs;
    if (catFilter !== 'all') {
      result = result.filter(d => d.category === catFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(d => d.title.toLowerCase().includes(q));
    }
    return result;
  }, [docs, catFilter, searchQuery]);

  const isValidUrl = (value: string): boolean => {
    if (!value) return true; // URL is optional
    try {
      const { protocol } = new URL(value);
      return protocol === 'https:' || protocol === 'http:';
    } catch {
      return false;
    }
  };

  const resetForm = () => {
    setTitle('');
    setUrl('');
    setCategory('Personal');
    setNotes('');
    setUrlError('');
    setEditingDoc(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (doc: RiseDocument) => {
    setEditingDoc(doc);
    setTitle(doc.title);
    setUrl(doc.url || '');
    setCategory(doc.category);
    setNotes(doc.notes || '');
    setUrlError('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!title.trim() || !user) return;
    if (!isValidUrl(url)) {
      setUrlError('URL must start with https:// or http://');
      return;
    }

    if (editingDoc) {
      await updateDocument('documents', editingDoc.id, {
        title: title.trim(),
        url,
        category,
        notes,
      });
    } else {
      await addDocument('documents', { title: title.trim(), url, category, notes } as Partial<RiseDocument>, user.uid);
    }

    handleCloseModal();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteDocument('documents', deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Documents</h1>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2.5 bg-rise text-[#0A0A0F] rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={18} /> Add
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search documents..."
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-rise/50"
        />
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
        <button onClick={() => setCatFilter('all')}
          className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap', catFilter === 'all' ? 'bg-text text-surface border-text' : 'bg-surface-2 text-text-3 border-border')}>
          All
        </button>
        {DOCUMENT_CATEGORIES.map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap',
              catFilter === c ? 'text-white border-transparent' : 'bg-surface-2 text-text-3 border-border')}
            style={catFilter === c ? { backgroundColor: CAT_COLORS[c] || '#6B7280' } : undefined}>
            {c}
          </button>
        ))}
      </div>

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-surface-2 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No documents" description="Store links to your important documents" />
      ) : (
        <div className="space-y-3">
          {filtered.map(doc => (
            <div key={doc.id} className="bg-surface-2 rounded-xl p-4 border border-border group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEditModal(doc)}>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-text">{doc.title}</p>
                    <Badge color={CAT_COLORS[doc.category] || '#6B7280'}>{doc.category}</Badge>
                  </div>
                  {doc.notes && <p className="text-xs text-text-3 mt-1">{doc.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {doc.url && (doc.url.startsWith('https://') || doc.url.startsWith('http://')) && (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-rise hover:text-rise-dark p-1"><ExternalLink size={16} /></a>
                  )}
                  <button onClick={() => openEditModal(doc)} className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-rise p-1"><Edit2 size={15} /></button>
                  <button onClick={() => setDeleteTarget(doc)} className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500 p-1"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={handleCloseModal} title={editingDoc ? 'Edit Document' : 'New Document'}>
        <div className="space-y-4">
          <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Document name" autoFocus />
          <Input label="URL" value={url} onChange={e => { setUrl(e.target.value); setUrlError(''); }} placeholder="https://..." />
          {urlError && <p className="text-xs text-red-500 -mt-2">{urlError}</p>}
          <Select label="Category" value={category} onChange={e => setCategory(e.target.value)}
            options={DOCUMENT_CATEGORIES.map(c => ({ value: c, label: c }))} />
          <TextArea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional details..." />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={handleCloseModal} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={!title.trim()} className="flex-1">{editingDoc ? 'Save' : 'Add'}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Document">
        <div className="space-y-4">
          <p className="text-sm text-text-2">
            Are you sure you want to delete <span className="font-semibold text-text">{deleteTarget?.title}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button onClick={handleConfirmDelete} className="flex-1 !bg-red-500 hover:!bg-red-600">Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
