'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, deleteDocument } from '@/lib/firestore';
import { Lead, Deal, LeadStatus, DealStatus, UAE_BANKS, UAE_EMIRATES, LEAD_SOURCES, PRODUCTS } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { cn, formatCurrency } from '@/lib/utils';
import { Plus, Briefcase, Users, Trash2, Phone, Building } from 'lucide-react';

const LEAD_STATUS_COLORS: Record<LeadStatus, string> = { 'New': '#4073FF', 'Qualified': '#F49C18', 'Appointment Booked': '#2D7C3E' };
const DEAL_STATUS_COLORS: Record<DealStatus, string> = {
  'Processing': '#4073FF', 'Call Verification': '#F49C18', 'Completed': '#2D7C3E',
  'Card Activation': '#7B4B9E', 'Successful': '#10B981', 'Unsuccessful': '#DC4C3E',
};

export default function ProfessionalPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: leads } = useCollection<Lead>('leads', uid);
  const { data: deals } = useCollection<Deal>('deals', uid);
  const [tab, setTab] = useState<'leads' | 'deals'>('leads');
  const [leadModal, setLeadModal] = useState(false);
  const [dealModal, setDealModal] = useState(false);

  // Lead form
  const [lName, setLName] = useState(''); const [lCompany, setLCompany] = useState('');
  const [lSalary, setLSalary] = useState(''); const [lSalaryBank, setLSalaryBank] = useState('');
  const [lPhone, setLPhone] = useState(''); const [lEmail, setLEmail] = useState('');
  const [lStatus, setLStatus] = useState<LeadStatus>('New');
  const [lSource, setLSource] = useState(''); const [lEmirate, setLEmirate] = useState('');
  const [lBank, setLBank] = useState(''); const [lProduct, setLProduct] = useState('');
  const [lNotes, setLNotes] = useState('');

  // Deal form
  const [dName, setDName] = useState(''); const [dStatus, setDStatus] = useState<DealStatus>('Processing');
  const [dAppNo, setDAppNo] = useState(''); const [dBpmId, setDBpmId] = useState('');
  const [dCompany, setDCompany] = useState(''); const [dSalary, setDSalary] = useState('');
  const [dBank, setDBank] = useState(''); const [dProduct, setDProduct] = useState('');
  const [dEmiratesId, setDEmiratesId] = useState(''); const [dAecb, setDAecb] = useState('');
  const [dNotes, setDNotes] = useState('');

  const addLead = async () => {
    if (!lName.trim() || !user) return;
    await addDocument('leads', {
      name: lName, company: lCompany, salary: lSalary ? Number(lSalary) : undefined,
      salaryBank: lSalaryBank, phone: lPhone, email: lEmail, status: lStatus,
      source: lSource, emirate: lEmirate, bank: lBank, product: lProduct, notes: lNotes,
    } as Partial<Lead>, user.uid);
    setLName(''); setLCompany(''); setLSalary(''); setLPhone(''); setLEmail(''); setLNotes('');
    setLeadModal(false);
  };

  const addDeal = async () => {
    if (!dName.trim() || !user) return;
    await addDocument('deals', {
      name: dName, status: dStatus, applicationNumber: dAppNo, bpmId: dBpmId,
      company: dCompany, salary: dSalary ? Number(dSalary) : undefined,
      bank: dBank, product: dProduct, emiratesId: dEmiratesId, aecbScore: dAecb, notes: dNotes,
    } as Partial<Deal>, user.uid);
    setDName(''); setDAppNo(''); setDBpmId(''); setDCompany(''); setDSalary(''); setDNotes('');
    setDealModal(false);
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Professional</h1>
        <button onClick={() => tab === 'leads' ? setLeadModal(true) : setDealModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-rise text-white rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={18} /> Add {tab === 'leads' ? 'Lead' : 'Deal'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
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

      {/* Leads Tab */}
      {tab === 'leads' && (
        leads.length === 0 ? (
          <EmptyState icon={Users} title="No leads" description="Add your first lead to start tracking" />
        ) : (
          <div className="space-y-3">
            {leads.map(lead => (
              <div key={lead.id} className="bg-surface-2 rounded-xl p-4 border border-border group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-text">{lead.name}</p>
                    {lead.company && <p className="text-xs text-text-3 flex items-center gap-1 mt-0.5"><Building size={12} />{lead.company}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={LEAD_STATUS_COLORS[lead.status]}>{lead.status}</Badge>
                    <button onClick={() => deleteDocument('leads', lead.id)} className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-3">
                  {lead.phone && <span className="flex items-center gap-1"><Phone size={12} />{lead.phone}</span>}
                  {lead.source && <span>Source: {lead.source}</span>}
                  {lead.bank && <span>Bank: {lead.bank}</span>}
                  {lead.product && <span>Product: {lead.product}</span>}
                  {lead.salary && <span>Salary: {formatCurrency(lead.salary)}</span>}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Deals Tab */}
      {tab === 'deals' && (
        deals.length === 0 ? (
          <EmptyState icon={Briefcase} title="No deals" description="Add your first deal to track the pipeline" />
        ) : (
          <div className="space-y-3">
            {deals.map(deal => (
              <div key={deal.id} className="bg-surface-2 rounded-xl p-4 border border-border group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-text">{deal.name}</p>
                    {deal.applicationNumber && <p className="text-xs text-text-3 mt-0.5">App #: {deal.applicationNumber}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={DEAL_STATUS_COLORS[deal.status]}>{deal.status}</Badge>
                    <button onClick={() => deleteDocument('deals', deal.id)} className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-500"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-3">
                  {deal.bank && <span>Bank: {deal.bank}</span>}
                  {deal.product && <span>Product: {deal.product}</span>}
                  {deal.emiratesId && <span>EID: {deal.emiratesId}</span>}
                  {deal.aecbScore && <span>AECB: {deal.aecbScore}</span>}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Lead Modal */}
      <Modal open={leadModal} onClose={() => setLeadModal(false)} title="New Lead" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={lName} onChange={e => setLName(e.target.value)} placeholder="Lead name" autoFocus />
            <Input label="Company" value={lCompany} onChange={e => setLCompany(e.target.value)} placeholder="Company" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={lPhone} onChange={e => setLPhone(e.target.value)} placeholder="+971..." />
            <Input label="Email" value={lEmail} onChange={e => setLEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Salary (AED)" type="number" value={lSalary} onChange={e => setLSalary(e.target.value)} />
            <Select label="Salary Bank" value={lSalaryBank} onChange={e => setLSalaryBank(e.target.value)}
              options={[{ value: '', label: 'Select' }, ...UAE_BANKS.map(b => ({ value: b, label: b }))]} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Status" value={lStatus} onChange={e => setLStatus(e.target.value as LeadStatus)}
              options={['New', 'Qualified', 'Appointment Booked'].map(s => ({ value: s, label: s }))} />
            <Select label="Source" value={lSource} onChange={e => setLSource(e.target.value)}
              options={[{ value: '', label: 'Select' }, ...LEAD_SOURCES.map(s => ({ value: s, label: s }))]} />
            <Select label="Emirate" value={lEmirate} onChange={e => setLEmirate(e.target.value)}
              options={[{ value: '', label: 'Select' }, ...UAE_EMIRATES.map(e => ({ value: e, label: e }))]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Bank" value={lBank} onChange={e => setLBank(e.target.value)}
              options={[{ value: '', label: 'Select' }, ...UAE_BANKS.map(b => ({ value: b, label: b }))]} />
            <Select label="Product" value={lProduct} onChange={e => setLProduct(e.target.value)}
              options={[{ value: '', label: 'Select' }, ...PRODUCTS.map(p => ({ value: p, label: p }))]} />
          </div>
          <TextArea label="Notes" value={lNotes} onChange={e => setLNotes(e.target.value)} placeholder="Additional notes..." />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setLeadModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={addLead} disabled={!lName.trim()} className="flex-1">Add Lead</Button>
          </div>
        </div>
      </Modal>

      {/* Deal Modal */}
      <Modal open={dealModal} onClose={() => setDealModal(false)} title="New Deal" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={dName} onChange={e => setDName(e.target.value)} placeholder="Deal name" autoFocus />
            <Select label="Status" value={dStatus} onChange={e => setDStatus(e.target.value as DealStatus)}
              options={['Processing', 'Call Verification', 'Completed', 'Card Activation', 'Successful', 'Unsuccessful'].map(s => ({ value: s, label: s }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Application #" value={dAppNo} onChange={e => setDAppNo(e.target.value)} />
            <Input label="BPM ID" value={dBpmId} onChange={e => setDBpmId(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Company" value={dCompany} onChange={e => setDCompany(e.target.value)} />
            <Input label="Salary (AED)" type="number" value={dSalary} onChange={e => setDSalary(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Bank" value={dBank} onChange={e => setDBank(e.target.value)}
              options={[{ value: '', label: 'Select' }, ...UAE_BANKS.map(b => ({ value: b, label: b }))]} />
            <Select label="Product" value={dProduct} onChange={e => setDProduct(e.target.value)}
              options={[{ value: '', label: 'Select' }, ...PRODUCTS.map(p => ({ value: p, label: p }))]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Emirates ID" value={dEmiratesId} onChange={e => setDEmiratesId(e.target.value)} />
            <Input label="AECB Score" value={dAecb} onChange={e => setDAecb(e.target.value)} />
          </div>
          <TextArea label="Notes" value={dNotes} onChange={e => setDNotes(e.target.value)} />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setDealModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={addDeal} disabled={!dName.trim()} className="flex-1">Add Deal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
