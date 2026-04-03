'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firestore';
import { Lead, Deal, LeadStatus, DealStatus, UAE_BANKS, UAE_EMIRATES, LEAD_SOURCES, PRODUCTS } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { cn, formatCurrency } from '@/lib/utils';
import { Plus, Briefcase, Users, Trash2, Phone, Building, Pencil, AlertTriangle, Filter } from 'lucide-react';

const LEAD_STATUSES: LeadStatus[] = ['New', 'Qualified', 'Appointment Booked'];
const DEAL_STATUSES: DealStatus[] = ['Processing', 'Call Verification', 'Completed', 'Card Activation', 'Successful', 'Unsuccessful'];
const CARD_TYPES = ['Visa', 'Mastercard', 'Amex', 'Other'];
const VISA_STATUSES = ['Employment Visa', 'Investor Visa', 'Golden Visa', 'Freelance Visa', 'Dependent Visa', 'Visit Visa', 'Other'];

const LEAD_STATUS_COLORS: Record<LeadStatus, string> = { 'New': '#4073FF', 'Qualified': '#F49C18', 'Appointment Booked': '#2D7C3E' };
const DEAL_STATUS_COLORS: Record<DealStatus, string> = {
  'Processing': '#4073FF', 'Call Verification': '#F49C18', 'Completed': '#2D7C3E',
  'Card Activation': '#7B4B9E', 'Successful': '#10B981', 'Unsuccessful': '#DC4C3E',
};

function emptyLeadForm() {
  return {
    name: '', company: '', salary: '', salaryBank: '', phone: '', email: '',
    status: 'New' as LeadStatus, source: '', emirate: '', bank: '', product: '',
    cardType: '', notes: '',
  };
}

function emptyDealForm() {
  return {
    name: '', status: 'Processing' as DealStatus, applicationNumber: '', bpmId: '',
    company: '', salary: '', salaryBank: '', dob: '', nationality: '', visaStatus: '',
    emiratesId: '', passportNumber: '', aecbScore: '', locationEmirate: '',
    submissionDate: '', completionDate: '', bank: '', product: '', cardType: '',
    leadId: '', notes: '',
  };
}

export default function ProfessionalPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: leads } = useCollection<Lead>('leads', uid);
  const { data: deals } = useCollection<Deal>('deals', uid);
  const [tab, setTab] = useState<'leads' | 'deals'>('leads');

  // Modals
  const [leadModal, setLeadModal] = useState(false);
  const [dealModal, setDealModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'lead' | 'deal'; id: string; name: string } | null>(null);

  // Editing state
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);

  // Status filters
  const [leadStatusFilter, setLeadStatusFilter] = useState<LeadStatus | 'All'>('All');
  const [dealStatusFilter, setDealStatusFilter] = useState<DealStatus | 'All'>('All');

  // Lead form
  const [leadForm, setLeadForm] = useState(emptyLeadForm);
  const setLF = (patch: Partial<ReturnType<typeof emptyLeadForm>>) => setLeadForm(prev => ({ ...prev, ...patch }));

  // Deal form
  const [dealForm, setDealForm] = useState(emptyDealForm);
  const setDF = (patch: Partial<ReturnType<typeof emptyDealForm>>) => setDealForm(prev => ({ ...prev, ...patch }));

  // Filtered data
  const filteredLeads = useMemo(() =>
    leadStatusFilter === 'All' ? leads : leads.filter(l => l.status === leadStatusFilter),
    [leads, leadStatusFilter]
  );
  const filteredDeals = useMemo(() =>
    dealStatusFilter === 'All' ? deals : deals.filter(d => d.status === dealStatusFilter),
    [deals, dealStatusFilter]
  );

  // Open lead modal for create
  const openNewLead = () => {
    setEditingLeadId(null);
    setLeadForm(emptyLeadForm());
    setLeadModal(true);
  };

  // Open lead modal for edit
  const openEditLead = (lead: Lead) => {
    setEditingLeadId(lead.id);
    setLeadForm({
      name: lead.name, company: lead.company || '', salary: lead.salary ? String(lead.salary) : '',
      salaryBank: lead.salaryBank || '', phone: lead.phone || '', email: lead.email || '',
      status: lead.status, source: lead.source || '', emirate: lead.emirate || '',
      bank: lead.bank || '', product: lead.product || '', cardType: lead.cardType || '',
      notes: lead.notes || '',
    });
    setLeadModal(true);
  };

  // Open deal modal for create
  const openNewDeal = () => {
    setEditingDealId(null);
    setDealForm(emptyDealForm());
    setDealModal(true);
  };

  // Open deal modal for edit
  const openEditDeal = (deal: Deal) => {
    setEditingDealId(deal.id);
    setDealForm({
      name: deal.name, status: deal.status, applicationNumber: deal.applicationNumber || '',
      bpmId: deal.bpmId || '', company: deal.company || '',
      salary: deal.salary ? String(deal.salary) : '', salaryBank: deal.salaryBank || '',
      dob: deal.dob || '', nationality: deal.nationality || '', visaStatus: deal.visaStatus || '',
      emiratesId: deal.emiratesId || '', passportNumber: deal.passportNumber || '',
      aecbScore: deal.aecbScore || '', locationEmirate: deal.locationEmirate || '',
      submissionDate: deal.submissionDate || '', completionDate: deal.completionDate || '',
      bank: deal.bank || '', product: deal.product || '', cardType: deal.cardType || '',
      leadId: deal.leadId || '', notes: deal.notes || '',
    });
    setDealModal(true);
  };

  // Save lead (create or update)
  const saveLead = async () => {
    if (!leadForm.name.trim() || !user) return;
    const data: Partial<Lead> = {
      name: leadForm.name, company: leadForm.company || undefined,
      salary: leadForm.salary ? Number(leadForm.salary) : undefined,
      salaryBank: leadForm.salaryBank || undefined, phone: leadForm.phone || undefined,
      email: leadForm.email || undefined, status: leadForm.status,
      source: leadForm.source || undefined, emirate: leadForm.emirate || undefined,
      bank: leadForm.bank || undefined, product: leadForm.product || undefined,
      cardType: leadForm.cardType || undefined, notes: leadForm.notes || undefined,
    };
    if (editingLeadId) {
      await updateDocument('leads', editingLeadId, data);
    } else {
      await addDocument('leads', data, user.uid);
    }
    setLeadForm(emptyLeadForm());
    setEditingLeadId(null);
    setLeadModal(false);
  };

  // Save deal (create or update)
  const saveDeal = async () => {
    if (!dealForm.name.trim() || !user) return;
    const data: Partial<Deal> = {
      name: dealForm.name, status: dealForm.status,
      applicationNumber: dealForm.applicationNumber || undefined,
      bpmId: dealForm.bpmId || undefined, company: dealForm.company || undefined,
      salary: dealForm.salary ? Number(dealForm.salary) : undefined,
      salaryBank: dealForm.salaryBank || undefined, dob: dealForm.dob || undefined,
      nationality: dealForm.nationality || undefined, visaStatus: dealForm.visaStatus || undefined,
      emiratesId: dealForm.emiratesId || undefined, passportNumber: dealForm.passportNumber || undefined,
      aecbScore: dealForm.aecbScore || undefined, locationEmirate: dealForm.locationEmirate || undefined,
      submissionDate: dealForm.submissionDate || undefined, completionDate: dealForm.completionDate || undefined,
      bank: dealForm.bank || undefined, product: dealForm.product || undefined,
      cardType: dealForm.cardType || undefined, leadId: dealForm.leadId || undefined,
      notes: dealForm.notes || undefined,
    };
    if (editingDealId) {
      await updateDocument('deals', editingDealId, data);
    } else {
      await addDocument('deals', data, user.uid);
    }
    setDealForm(emptyDealForm());
    setEditingDealId(null);
    setDealModal(false);
  };

  // Confirm delete
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteDocument(deleteConfirm.type === 'lead' ? 'leads' : 'deals', deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const closeLeadModal = () => {
    setLeadModal(false);
    setEditingLeadId(null);
    setLeadForm(emptyLeadForm());
  };

  const closeDealModal = () => {
    setDealModal(false);
    setEditingDealId(null);
    setDealForm(emptyDealForm());
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Professional</h1>
        <button onClick={() => tab === 'leads' ? openNewLead() : openNewDeal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-rise text-white rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={18} /> Add {tab === 'leads' ? 'Lead' : 'Deal'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('leads')}
          className={cn('flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border',
            tab === 'leads' ? 'bg-navy text-white border-navy' : 'bg-surface-2 text-text-2 border-border')}>
          <Users size={16} /> Leads ({leads.length})
        </button>
        <button onClick={() => setTab('deals')}
          className={cn('flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border',
            tab === 'deals' ? 'bg-navy text-white border-navy' : 'bg-surface-2 text-text-2 border-border')}>
          <Briefcase size={16} /> Deals ({deals.length})
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        <Filter size={14} className="text-text-3 shrink-0" />
        {tab === 'leads' ? (
          <>
            <button onClick={() => setLeadStatusFilter('All')}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap',
                leadStatusFilter === 'All' ? 'bg-navy text-white border-navy' : 'bg-surface-2 text-text-2 border-border')}>
              All
            </button>
            {LEAD_STATUSES.map(s => (
              <button key={s} onClick={() => setLeadStatusFilter(s)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap',
                  leadStatusFilter === s ? 'bg-navy text-white border-navy' : 'bg-surface-2 text-text-2 border-border')}>
                {s}
              </button>
            ))}
          </>
        ) : (
          <>
            <button onClick={() => setDealStatusFilter('All')}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap',
                dealStatusFilter === 'All' ? 'bg-navy text-white border-navy' : 'bg-surface-2 text-text-2 border-border')}>
              All
            </button>
            {DEAL_STATUSES.map(s => (
              <button key={s} onClick={() => setDealStatusFilter(s)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap',
                  dealStatusFilter === s ? 'bg-navy text-white border-navy' : 'bg-surface-2 text-text-2 border-border')}>
                {s}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Leads Tab */}
      {tab === 'leads' && (
        filteredLeads.length === 0 ? (
          <EmptyState icon={Users} title="No leads" description={leadStatusFilter === 'All' ? 'Add your first lead to start tracking' : `No leads with status "${leadStatusFilter}"`} />
        ) : (
          <div className="space-y-3">
            {filteredLeads.map(lead => (
              <div key={lead.id} onClick={() => openEditLead(lead)}
                className="bg-surface-2 rounded-xl p-4 border border-border group cursor-pointer hover:border-rise/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-text">{lead.name}</p>
                    {lead.company && <p className="text-xs text-text-3 flex items-center gap-1 mt-0.5"><Building size={12} />{lead.company}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={LEAD_STATUS_COLORS[lead.status]}>{lead.status}</Badge>
                    <button onClick={(e) => { e.stopPropagation(); openEditLead(lead); }}
                      className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-rise"><Pencil size={15} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'lead', id: lead.id, name: lead.name }); }}
                      className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-3">
                  {lead.phone && <span className="flex items-center gap-1"><Phone size={12} />{lead.phone}</span>}
                  {lead.source && <span>Source: {lead.source}</span>}
                  {lead.bank && <span>Bank: {lead.bank}</span>}
                  {lead.product && <span>Product: {lead.product}</span>}
                  {lead.cardType && <span>Card: {lead.cardType}</span>}
                  {lead.salary && <span>Salary: {formatCurrency(lead.salary)}</span>}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Deals Tab */}
      {tab === 'deals' && (
        filteredDeals.length === 0 ? (
          <EmptyState icon={Briefcase} title="No deals" description={dealStatusFilter === 'All' ? 'Add your first deal to track the pipeline' : `No deals with status "${dealStatusFilter}"`} />
        ) : (
          <div className="space-y-3">
            {filteredDeals.map(deal => {
              const linkedLead = deal.leadId ? leads.find(l => l.id === deal.leadId) : null;
              return (
                <div key={deal.id} onClick={() => openEditDeal(deal)}
                  className="bg-surface-2 rounded-xl p-4 border border-border group cursor-pointer hover:border-rise/40 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-text">{deal.name}</p>
                      {deal.applicationNumber && <p className="text-xs text-text-3 mt-0.5">App #: {deal.applicationNumber}</p>}
                      {linkedLead && <p className="text-xs text-blue-500 mt-0.5">Lead: {linkedLead.name}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={DEAL_STATUS_COLORS[deal.status]}>{deal.status}</Badge>
                      <button onClick={(e) => { e.stopPropagation(); openEditDeal(deal); }}
                        className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-rise"><Pencil size={15} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'deal', id: deal.id, name: deal.name }); }}
                        className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-3">
                    {deal.bank && <span>Bank: {deal.bank}</span>}
                    {deal.product && <span>Product: {deal.product}</span>}
                    {deal.cardType && <span>Card: {deal.cardType}</span>}
                    {deal.emiratesId && <span>EID: {deal.emiratesId}</span>}
                    {deal.aecbScore && <span>AECB: {deal.aecbScore}</span>}
                    {deal.salary && <span>Salary: {formatCurrency(deal.salary)}</span>}
                    {deal.locationEmirate && <span>Location: {deal.locationEmirate}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Lead Modal */}
      <Modal open={leadModal} onClose={closeLeadModal} title={editingLeadId ? 'Edit Lead' : 'New Lead'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={leadForm.name} onChange={e => setLF({ name: e.target.value })} placeholder="Lead name" autoFocus />
            <Input label="Company" value={leadForm.company} onChange={e => setLF({ company: e.target.value })} placeholder="Company" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={leadForm.phone} onChange={e => setLF({ phone: e.target.value })} placeholder="+971..." />
            <Input label="Email" value={leadForm.email} onChange={e => setLF({ email: e.target.value })} placeholder="email@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Salary (AED)" type="number" value={leadForm.salary} onChange={e => setLF({ salary: e.target.value })} />
            <Select label="Salary Bank" value={leadForm.salaryBank} onChange={e => setLF({ salaryBank: e.target.value })}
              options={[{ value: '', label: 'Select' }, ...UAE_BANKS.map(b => ({ value: b, label: b }))]} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Status" value={leadForm.status} onChange={e => setLF({ status: e.target.value as LeadStatus })}
              options={LEAD_STATUSES.map(s => ({ value: s, label: s }))} />
            <Select label="Source" value={leadForm.source} onChange={e => setLF({ source: e.target.value })}
              options={[{ value: '', label: 'Select' }, ...LEAD_SOURCES.map(s => ({ value: s, label: s }))]} />
            <Select label="Emirate" value={leadForm.emirate} onChange={e => setLF({ emirate: e.target.value })}
              options={[{ value: '', label: 'Select' }, ...UAE_EMIRATES.map(e => ({ value: e, label: e }))]} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Bank" value={leadForm.bank} onChange={e => setLF({ bank: e.target.value })}
              options={[{ value: '', label: 'Select' }, ...UAE_BANKS.map(b => ({ value: b, label: b }))]} />
            <Select label="Product" value={leadForm.product} onChange={e => setLF({ product: e.target.value })}
              options={[{ value: '', label: 'Select' }, ...PRODUCTS.map(p => ({ value: p, label: p }))]} />
            <Select label="Card Type" value={leadForm.cardType} onChange={e => setLF({ cardType: e.target.value })}
              options={[{ value: '', label: 'Select' }, ...CARD_TYPES.map(c => ({ value: c, label: c }))]} />
          </div>
          <TextArea label="Notes" value={leadForm.notes} onChange={e => setLF({ notes: e.target.value })} placeholder="Additional notes..." />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={closeLeadModal} className="flex-1">Cancel</Button>
            <Button onClick={saveLead} disabled={!leadForm.name.trim()} className="flex-1">
              {editingLeadId ? 'Update Lead' : 'Add Lead'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deal Modal */}
      <Modal open={dealModal} onClose={closeDealModal} title={editingDealId ? 'Edit Deal' : 'New Deal'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={dealForm.name} onChange={e => setDF({ name: e.target.value })} placeholder="Deal name" autoFocus />
            <Select label="Status" value={dealForm.status} onChange={e => setDF({ status: e.target.value as DealStatus })}
              options={DEAL_STATUSES.map(s => ({ value: s, label: s }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Application #" value={dealForm.applicationNumber} onChange={e => setDF({ applicationNumber: e.target.value })} />
            <Input label="BPM ID" value={dealForm.bpmId} onChange={e => setDF({ bpmId: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Company" value={dealForm.company} onChange={e => setDF({ company: e.target.value })} />
            <Input label="Salary (AED)" type="number" value={dealForm.salary} onChange={e => setDF({ salary: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Salary Bank" value={dealForm.salaryBank} onChange={e => setDF({ salaryBank: e.target.value })}
              options={[{ value: '', label: 'Select' }, ...UAE_BANKS.map(b => ({ value: b, label: b }))]} />
            <Select label="Linked Lead" value={dealForm.leadId} onChange={e => setDF({ leadId: e.target.value })}
              options={[{ value: '', label: 'None' }, ...leads.map(l => ({ value: l.id, label: l.name }))]} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Date of Birth" type="date" value={dealForm.dob} onChange={e => setDF({ dob: e.target.value })} />
            <Input label="Nationality" value={dealForm.nationality} onChange={e => setDF({ nationality: e.target.value })} placeholder="e.g. Indian" />
            <Select label="Visa Status" value={dealForm.visaStatus} onChange={e => setDF({ visaStatus: e.target.value })}
              options={[{ value: '', label: 'Select' }, ...VISA_STATUSES.map(v => ({ value: v, label: v }))]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Emirates ID" value={dealForm.emiratesId} onChange={e => setDF({ emiratesId: e.target.value })} />
            <Input label="Passport Number" value={dealForm.passportNumber} onChange={e => setDF({ passportNumber: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="AECB Score" value={dealForm.aecbScore} onChange={e => setDF({ aecbScore: e.target.value })} />
            <Select label="Location Emirate" value={dealForm.locationEmirate} onChange={e => setDF({ locationEmirate: e.target.value })}
              options={[{ value: '', label: 'Select' }, ...UAE_EMIRATES.map(e => ({ value: e, label: e }))]} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Bank" value={dealForm.bank} onChange={e => setDF({ bank: e.target.value })}
              options={[{ value: '', label: 'Select' }, ...UAE_BANKS.map(b => ({ value: b, label: b }))]} />
            <Select label="Product" value={dealForm.product} onChange={e => setDF({ product: e.target.value })}
              options={[{ value: '', label: 'Select' }, ...PRODUCTS.map(p => ({ value: p, label: p }))]} />
            <Select label="Card Type" value={dealForm.cardType} onChange={e => setDF({ cardType: e.target.value })}
              options={[{ value: '', label: 'Select' }, ...CARD_TYPES.map(c => ({ value: c, label: c }))]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Submission Date" type="date" value={dealForm.submissionDate} onChange={e => setDF({ submissionDate: e.target.value })} />
            <Input label="Completion Date" type="date" value={dealForm.completionDate} onChange={e => setDF({ completionDate: e.target.value })} />
          </div>
          <TextArea label="Notes" value={dealForm.notes} onChange={e => setDF({ notes: e.target.value })} />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={closeDealModal} className="flex-1">Cancel</Button>
            <Button onClick={saveDeal} disabled={!dealForm.name.trim()} className="flex-1">
              {editingDealId ? 'Update Deal' : 'Add Deal'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm text-text">
                Are you sure you want to delete <span className="font-semibold">{deleteConfirm?.name}</span>? This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)} className="flex-1">Cancel</Button>
            <Button onClick={handleDelete} className="flex-1 !bg-red-500 hover:!bg-red-600">Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
