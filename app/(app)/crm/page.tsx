'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Contact, Interaction } from '@/lib/types/database'
import { formatDate, todayISO } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, Building2, Loader2 } from 'lucide-react'

const STAGE_COLORS: Record<Contact['stage'], string> = {
  new:         'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  qualified:   'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  proposal:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  negotiation: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  won:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  lost:        'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

export default function CRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [selected, setSelected] = useState<Contact | null>(null)

  const fetchContacts = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('contacts').select('*').order('name')
    setContacts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">CRM</h1>
        <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Contact
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search contacts…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <div className="text-4xl">👥</div>
          <p className="text-muted-foreground text-sm">{search ? 'No contacts match your search.' : 'No contacts yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => (
            <Card key={contact.id} className="cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => setSelected(contact)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold">{contact.name[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{contact.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {contact.company && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" />{contact.company}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <Badge variant="secondary" className={`text-xs ${STAGE_COLORS[contact.stage]}`}>
                    {contact.stage}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{contact.type}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <button
        onClick={() => setNewOpen(true)}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-40"
        aria-label="Add contact"
      >
        <Plus className="w-6 h-6" />
      </button>

      <ContactForm open={newOpen} onOpenChange={setNewOpen} onSaved={fetchContacts} />
      {selected && (
        <ContactDetail contact={selected} onClose={() => setSelected(null)} onSaved={fetchContacts} />
      )}
    </div>
  )
}

// ─── Contact Form ─────────────────────────────────────────────────────────────

function ContactForm({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [type, setType] = useState<Contact['type']>('network')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('contacts').insert({
      user_id: user.id,
      name: name.trim(),
      email: email || null,
      phone: phone || null,
      company: company || null,
      role: role || null,
      type,
      stage: 'new',
      tags: [],
    })
    setSaving(false)
    setName(''); setEmail(''); setPhone(''); setCompany(''); setRole('')
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Contact</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="+971 50 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Company</Label>
              <Input placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input placeholder="Job title" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as Contact['type'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['lead','prospect','client','network','personal'].map((t) => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Contact'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Contact Detail ───────────────────────────────────────────────────────────

function ContactDetail({ contact, onClose, onSaved }: { contact: Contact; onClose: () => void; onSaved: () => void }) {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const [note, setNote] = useState('')
  const [intType, setIntType] = useState<Interaction['type']>('call')
  const [followUp, setFollowUp] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('interactions').select('*')
        .eq('contact_id', contact.id).order('date', { ascending: false })
      setInteractions(data ?? [])
    }
    load()
  }, [contact.id])

  async function logInteraction(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('interactions').insert({
      user_id: user.id,
      contact_id: contact.id,
      type: intType,
      notes: note,
      date: todayISO(),
      follow_up_date: followUp || null,
    })
    await supabase.from('contacts').update({ last_contacted_at: new Date().toISOString() }).eq('id', contact.id)
    setNote(''); setFollowUp(''); setLogOpen(false)
    const { data } = await supabase.from('interactions').select('*').eq('contact_id', contact.id).order('date', { ascending: false })
    setInteractions(data ?? [])
    onSaved()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-semibold text-sm">{contact.name[0]}</span>
            </div>
            {contact.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {contact.email && <div><p className="text-xs text-muted-foreground">Email</p><p>{contact.email}</p></div>}
            {contact.phone && <div><p className="text-xs text-muted-foreground">Phone</p><p>{contact.phone}</p></div>}
            {contact.company && <div><p className="text-xs text-muted-foreground">Company</p><p>{contact.company}</p></div>}
            {contact.role && <div><p className="text-xs text-muted-foreground">Role</p><p>{contact.role}</p></div>}
          </div>

          <Button size="sm" onClick={() => setLogOpen(true)} className="w-full gap-1.5">
            <Plus className="w-4 h-4" /> Log Interaction
          </Button>

          {logOpen && (
            <form onSubmit={logInteraction} className="space-y-3 p-3 rounded-lg bg-accent/50">
              <Select value={intType} onValueChange={(v) => setIntType(v as Interaction['type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['call','email','meeting','message','other'].map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea placeholder="Notes from this interaction…" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              <Input type="date" placeholder="Follow-up date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" type="submit">Save</Button>
                <Button size="sm" type="button" variant="ghost" onClick={() => setLogOpen(false)}>Cancel</Button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Interaction History</p>
            {interactions.length === 0
              ? <p className="text-sm text-muted-foreground">No interactions logged.</p>
              : interactions.map((i) => (
                <div key={i.id} className="p-3 rounded-lg border border-border space-y-1">
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="text-xs">{i.type}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(i.date)}</span>
                  </div>
                  <p className="text-sm">{i.notes}</p>
                  {i.follow_up_date && (
                    <p className="text-xs text-primary">Follow up: {formatDate(i.follow_up_date)}</p>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
