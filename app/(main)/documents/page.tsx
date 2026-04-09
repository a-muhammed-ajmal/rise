'use client';

import { useState } from 'react';
import { Plus, FileText, ExternalLink, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { createDoc, updateDocById, deleteDocById } from '@/lib/firestore';
import { COLLECTIONS, DOCUMENT_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { RiseDocument, DocumentCategory } from '@/lib/types';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/lib/toast';
import { sanitize, isValidUrl } from '@/lib/sanitizer';

function DocumentModal({ open, onClose, doc, userId }: { open: boolean; onClose: () => void; doc: RiseDocument | null; userId: string; }) {
  const [form, setForm] = useState({ title: doc?.title ?? '', url: doc?.url ?? '', category: (doc?.category ?? 'Personal') as DocumentCategory, notes: doc?.notes ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (form.url && !isValidUrl(form.url)) e.url = 'URL must start with https:// or http://';
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    try {
      const data = { userId, title: sanitize(form.title, 200), url: form.url || undefined, category: form.category, notes: sanitize(form.notes) };
      if (doc) await updateDocById(COLLECTIONS.DOCUMENTS, doc.id, data);
      else await createDoc(COLLECTIONS.DOCUMENTS, data);
      toast.success('Document saved.');
      onClose();
    } catch { toast.error('Failed to save document.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={doc ? 'Edit Document' : 'New Document'} footer={<div className="flex gap-3"><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth loading={saving} onClick={handleSave}>Save</Button></div>}>
      <div className="flex flex-col gap-4">
        <Input label="Title" value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} required placeholder="Document name" />
        <Input label="URL (optional)" value={form.url} onChange={(e) => set('url', e.target.value)} error={errors.url} placeholder="https://..." />
        <Select label="Category" value={form.category} onChange={(e) => set('category', (e.target as HTMLSelectElement).value as DocumentCategory)} options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c }))} required />
        <Textarea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Additional notes..." />
      </div>
    </Modal>
  );
}

const CAT_COLORS: Record<string, string> = {
  Legal: '#FF4F6D', Financial: '#1ABC9C', Medical: '#FF6B35', Travel: '#1E4AFF',
  Educational: '#FFD700', Personal: '#800080', Work: '#8E95A9', Other: '#505050',
};

export default function DocumentsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<RiseDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RiseDocument | null>(null);

  const { data: documents, loading } = useCollection<RiseDocument>({ userId: user?.uid ?? '', collectionName: COLLECTIONS.DOCUMENTS, enabled: !!user });

  const filtered = documents.filter((d) => {
    const matchCat = filter === 'All' || d.category === filter;
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="px-4 pt-4 pb-3 border-b border-[#2A2A2A]">
        <h1 className="text-xl font-bold text-[#F0F0F0] mb-3">Documents</h1>
        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#505050]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." className="w-full bg-[#1C1C1C] border border-[#2A2A2A] rounded-input pl-9 pr-3 py-2 text-sm text-[#F0F0F0] placeholder-[#505050] outline-none focus:border-[#FF6B35]" />
        </div>
        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4">
          {['All', ...DOCUMENT_CATEGORIES].map((cat) => (
            <button key={cat} onClick={() => setFilter(cat)} className={cn('flex-shrink-0 h-7 px-3 rounded-chip text-xs font-medium transition-colors', filter === cat ? 'bg-[#8E95A9]/20 text-[#8E95A9] border border-[#8E95A9]' : 'bg-[#141414] text-[#8A8A8A] border border-[#2A2A2A]')}>{cat}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 px-4 py-4 pb-6 flex flex-col gap-3">
        {loading ? <>{[1,2,3].map((i) => <SkeletonCard key={i} />)}</> :
         filtered.length === 0 ? <EmptyState icon={FileText} title="No documents saved" subtitle="Add links to your important documents." actionLabel="Add Document" onAction={() => { setEditDoc(null); setModalOpen(true); }} /> :
         filtered.map((doc) => (
          <div key={doc.id} onClick={() => { setEditDoc(doc); setModalOpen(true); }} className="bg-[#141414] rounded-card border border-[#2A2A2A] p-4 active:bg-[#1C1C1C] transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#F0F0F0] truncate">{doc.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge label={doc.category} color={CAT_COLORS[doc.category]} />
                  {doc.notes && <span className="text-xs text-[#8A8A8A] truncate">{doc.notes}</span>}
                </div>
              </div>
              {doc.url && (
                <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-8 h-8 flex items-center justify-center text-[#1E4AFF] flex-shrink-0">
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
          </div>
         ))
        }
      </div>
      <button onClick={() => { setEditDoc(null); setModalOpen(true); }} className="fixed bottom-[80px] right-4 w-14 h-14 bg-[#8E95A9] rounded-full flex items-center justify-center shadow-fab active:scale-95 transition-transform sm:hidden z-30"><Plus size={24} className="text-white" /></button>
      <DocumentModal open={modalOpen} onClose={() => setModalOpen(false)} doc={editDoc} userId={user?.uid ?? ''} />
      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => { if (deleteTarget) { await deleteDocById(COLLECTIONS.DOCUMENTS, deleteTarget.id); toast.success('Document deleted.'); setDeleteTarget(null); } }} title="Delete Document" message={`Delete "${deleteTarget?.title}"?`} />
    </div>
  );
}
