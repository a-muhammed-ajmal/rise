'use client';

import { useState } from 'react';
import { Plus, UserPlus, Briefcase } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { createDoc, updateDocById, deleteDocById } from '@/lib/firestore';
import { COLLECTIONS, LEAD_STATUSES, DEAL_STATUSES, LEAD_SOURCES, PRODUCTS, UAE_BANKS, UAE_EMIRATES, LEAD_STATUS_COLORS, DEAL_STATUS_COLORS } from '@/lib/constants';
import { formatAED, cn } from '@/lib/utils';
import type { Lead, Deal, LeadStatus, DealStatus } from '@/lib/types';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';

type Tab = 'leads' | 'deals';

function LeadModal({ open, onClose, lead, userId }: { open: boolean; onClose: () => void; lead: Lead | null; userId: string; }) {
  const [form, setForm] = useState({ name: lead?.name ?? '', company: lead?.company ?? '', salary: lead ? String(lead.salary ?? '') : '', salaryBank: lead?.salaryBank ?? '', phone: lead?.phone ?? '', email: lead?.email ?? '', status: (lead?.status ?? 'New') as LeadStatus, source: lead?.source ?? '', emirate: lead?.emirate ?? '', bank: lead?.bank ?? '', product: lead?.product ?? '', cardType: lead?.cardType ?? '', notes: lead?.notes ?? '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    setSaving(true);
    try {
      const data = { userId, name: sanitize(form.name, 100), company: sanitize(form.company), salary: form.salary ? parseFloat(form.salary) : undefined, salaryBank: form.salaryBank, phone: form.phone, email: form.email, status: form.status, source: form.source, emirate: form.emirate, bank: form.bank, product: form.product, cardType: form.cardType, notes: sanitize(form.notes) };
      if (lead) await updateDocById(COLLECTIONS.LEADS, lead.id, data);
      else await createDoc(COLLECTIONS.LEADS, data);
      toast.success('Lead saved.');
      onClose();
    } catch { toast.error('Failed to save lead.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={lead ? 'Edit Lead' : 'New Lead'} footer={<div className="flex gap-3"><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth loading={saving} onClick={handleSave}>Save</Button></div>}>
      <div className="flex flex-col gap-4">
        <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        <Input label="Company" value={form.company} onChange={(e) => set('company', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Salary (AED)" type="number" value={form.salary} onChange={(e) => set('salary', e.target.value)} />
          <Select label="Salary Bank" value={form.salaryBank} onChange={(e) => set('salaryBank', (e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Select...' }, ...UAE_BANKS.map((b) => ({ value: b, label: b }))]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <Select label="Status" value={form.status} onChange={(e) => set('status', (e.target as HTMLSelectElement).value)} options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))} />
        <Select label="Source" value={form.source} onChange={(e) => set('source', (e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Select...' }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s }))]} />
        <Select label="Emirate" value={form.emirate} onChange={(e) => set('emirate', (e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Select...' }, ...UAE_EMIRATES.map((e) => ({ value: e, label: e }))]} />
        <Select label="Bank" value={form.bank} onChange={(e) => set('bank', (e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Select...' }, ...UAE_BANKS.map((b) => ({ value: b, label: b }))]} />
        <Select label="Product" value={form.product} onChange={(e) => set('product', (e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Select...' }, ...PRODUCTS.map((p) => ({ value: p, label: p }))]} />
        <Input label="Card Type" value={form.cardType} onChange={(e) => set('cardType', e.target.value)} />
        <Textarea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
      </div>
    </Modal>
  );
}

function DealModal({ open, onClose, deal, userId }: { open: boolean; onClose: () => void; deal: Deal | null; userId: string; }) {
  const [form, setForm] = useState({ name: deal?.name ?? '', status: (deal?.status ?? 'Processing') as DealStatus, applicationNumber: deal?.applicationNumber ?? '', bpmId: deal?.bpmId ?? '', company: deal?.company ?? '', salary: deal ? String(deal.salary ?? '') : '', salaryBank: deal?.salaryBank ?? '', nationality: deal?.nationality ?? '', visaStatus: deal?.visaStatus ?? '', aecbScore: deal?.aecbScore ?? '', locationEmirate: deal?.locationEmirate ?? '', submissionDate: deal?.submissionDate ?? '', bank: deal?.bank ?? '', product: deal?.product ?? '', notes: deal?.notes ?? '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    setSaving(true);
    try {
      const data = { userId, name: sanitize(form.name, 100), status: form.status, applicationNumber: form.applicationNumber, bpmId: form.bpmId, company: sanitize(form.company), salary: form.salary ? parseFloat(form.salary) : undefined, salaryBank: form.salaryBank, nationality: form.nationality, visaStatus: form.visaStatus, aecbScore: form.aecbScore, locationEmirate: form.locationEmirate, submissionDate: form.submissionDate, bank: form.bank, product: form.product, notes: sanitize(form.notes) };
      if (deal) await updateDocById(COLLECTIONS.DEALS, deal.id, data);
      else await createDoc(COLLECTIONS.DEALS, data);
      toast.success('Deal saved.');
      onClose();
    } catch { toast.error('Failed to save deal.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={deal ? 'Edit Deal' : 'New Deal'} footer={<div className="flex gap-3"><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth loading={saving} onClick={handleSave}>Save</Button></div>}>
      <div className="flex flex-col gap-4">
        <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        <Select label="Status" value={form.status} onChange={(e) => set('status', (e.target as HTMLSelectElement).value)} options={DEAL_STATUSES.map((s) => ({ value: s, label: s }))} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Application #" value={form.applicationNumber} onChange={(e) => set('applicationNumber', e.target.value)} />
          <Input label="BPM ID" value={form.bpmId} onChange={(e) => set('bpmId', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Salary (AED)" type="number" value={form.salary} onChange={(e) => set('salary', e.target.value)} />
          <Select label="Salary Bank" value={form.salaryBank} onChange={(e) => set('salaryBank', (e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Select...' }, ...UAE_BANKS.map((b) => ({ value: b, label: b }))]} />
        </div>
        <Input label="Nationality" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
        <Input label="Visa Status" value={form.visaStatus} onChange={(e) => set('visaStatus', e.target.value)} />
        <Input label="AECB Score" value={form.aecbScore} onChange={(e) => set('aecbScore', e.target.value)} />
        <Select label="Emirate" value={form.locationEmirate} onChange={(e) => set('locationEmirate', (e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Select...' }, ...UAE_EMIRATES.map((e) => ({ value: e, label: e }))]} />
        <Input label="Submission Date" type="date" value={form.submissionDate} onChange={(e) => set('submissionDate', e.target.value)} />
        <Select label="Bank" value={form.bank} onChange={(e) => set('bank', (e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Select...' }, ...UAE_BANKS.map((b) => ({ value: b, label: b }))]} />
        <Select label="Product" value={form.product} onChange={(e) => set('product', (e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Select...' }, ...PRODUCTS.map((p) => ({ value: p, label: p }))]} />
        <Textarea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
      </div>
    </Modal>
  );
}

export default function ProfessionalPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('leads');
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [deleteLeadTarget, setDeleteLeadTarget] = useState<Lead | null>(null);
  const [deleteDealTarget, setDeleteDealTarget] = useState<Deal | null>(null);

  const { data: leads, loading: leadsLoading } = useCollection<Lead>({ userId: user?.uid ?? '', collectionName: COLLECTIONS.LEADS, enabled: !!user });
  const { data: deals, loading: dealsLoading } = useCollection<Deal>({ userId: user?.uid ?? '', collectionName: COLLECTIONS.DEALS, enabled: !!user });

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="px-4 pt-4 pb-3 border-b border-[#E5E5EA]">
        <h1 className="text-xl font-bold text-[#1C1C1E] mb-3">Professional</h1>
        <div className="flex gap-1">
          {(['leads','deals'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn('flex-1 h-10 text-xs font-medium capitalize rounded-chip transition-colors', tab === t ? 'bg-[#1E4AFF] text-white' : 'bg-[#FFFFFF] text-[#6C6C70] border border-[#E5E5EA]')}>{t}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-4 pb-6 flex flex-col gap-3">
        {tab === 'leads' && (
          leadsLoading ? <>{[1,2,3].map((i) => <SkeletonCard key={i} />)}</> :
          leads.length === 0 ? <EmptyState icon={UserPlus} title="No leads yet" subtitle="Add your first lead." actionLabel="Add Lead" onAction={() => { setEditLead(null); setLeadModalOpen(true); }} /> :
          leads.map((lead) => (
            <div key={lead.id} onClick={() => { setEditLead(lead); setLeadModalOpen(true); }} className="bg-[#FFFFFF] rounded-card border border-[#E5E5EA] p-4 active:bg-[#F5F5F5] transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#1C1C1E]">{lead.name}</p>
                  {lead.company && <p className="text-xs text-[#6C6C70]">{lead.company}</p>}
                  {lead.salary && <p className="text-xs text-[#1ABC9C]">{formatAED(lead.salary)} · {lead.salaryBank}</p>}
                </div>
                <StatusBadge status={lead.status} colorMap={LEAD_STATUS_COLORS} />
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {lead.product && <span className="text-xs text-[#6C6C70]">{lead.product}</span>}
                {lead.bank && <span className="text-xs text-[#6C6C70]">· {lead.bank}</span>}
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-[#1E4AFF] ml-auto">{lead.phone}</a>
                )}
              </div>
            </div>
          ))
        )}

        {tab === 'deals' && (
          dealsLoading ? <>{[1,2,3].map((i) => <SkeletonCard key={i} />)}</> :
          deals.length === 0 ? <EmptyState icon={Briefcase} title="No deals yet" subtitle="Convert a lead or add a deal directly." actionLabel="Add Deal" onAction={() => { setEditDeal(null); setDealModalOpen(true); }} /> :
          deals.map((deal) => (
            <div key={deal.id} onClick={() => { setEditDeal(deal); setDealModalOpen(true); }} className="bg-[#FFFFFF] rounded-card border border-[#E5E5EA] p-4 active:bg-[#F5F5F5] transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#1C1C1E]">{deal.name}</p>
                  {deal.bank && <p className="text-xs text-[#6C6C70]">{deal.bank} · {deal.product}</p>}
                  {deal.applicationNumber && <p className="text-xs text-[#AEAEB2]">App: {deal.applicationNumber}</p>}
                </div>
                <StatusBadge status={deal.status} colorMap={DEAL_STATUS_COLORS} />
              </div>
            </div>
          ))
        )}
      </div>

      <button onClick={() => { if (tab === 'leads') { setEditLead(null); setLeadModalOpen(true); } else { setEditDeal(null); setDealModalOpen(true); } }} className="fixed bottom-[80px] right-4 w-14 h-14 bg-[#1E4AFF] rounded-full flex items-center justify-center shadow-fab active:scale-95 transition-transform sm:hidden z-30"><Plus size={24} className="text-white" /></button>

      <LeadModal open={leadModalOpen} onClose={() => setLeadModalOpen(false)} lead={editLead} userId={user?.uid ?? ''} />
      <DealModal open={dealModalOpen} onClose={() => setDealModalOpen(false)} deal={editDeal} userId={user?.uid ?? ''} />
    </div>
  );
}
