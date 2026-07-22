"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Contact, Interaction } from "@/lib/types/database";
import { formatDate, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateTimePicker } from "@/components/productivity/DateTimePicker";
import {
  Plus,
  Search,
  Building2,
  Loader2,
  Users,
  MoreVertical,
  Pencil,
  Trash2,
  Phone,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

const STAGE_COLORS: Record<Contact["stage"], string> = {
  new:         "stage-new",
  qualified:   "stage-qualified",
  proposal:    "stage-proposal",
  negotiation: "stage-negotiation",
  won:         "stage-won",
  lost:        "stage-lost",
};

const STAGES: Contact["stage"][] = ["new", "qualified", "proposal", "negotiation", "won", "lost"];

export default function CRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("contacts").select("*").order("name");
    setContacts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Quick-add intent: open the add-contact form via ?add=contact.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("add") === "contact") {
      setEditContact(null);
      setContactFormOpen(true);
      url.searchParams.delete("add");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

  async function handleDeleteContact() {
    if (!deleteContactId) return;
    const supabase = createClient();
    await supabase.from("contacts").delete().eq("id", deleteContactId);
    setDeleteContactId(null);
    if (selected?.id === deleteContactId) setSelected(null);
    toast.success("Contact deleted");
    fetchContacts();
  }

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className="p-3 md:p-5 max-w-2xl space-y-3"
    >
      <div className="flex items-center justify-between slide-up stagger-1">
        <h1 className="text-h1 font-heading tracking-tight flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-mod-crm-tint flex items-center justify-center">
            <Users className="w-4 h-4 text-mod-crm" />
          </div>
          CRM
        </h1>
        <Button
          size="sm"
          onClick={() => { setEditContact(null); setContactFormOpen(true); }}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Contact
        </Button>
      </div>

      <div className="relative slide-up stagger-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 space-y-2 slide-up stagger-3">
          <div className="w-16 h-16 rounded-2xl bg-mod-crm-tint flex items-center justify-center mx-auto mb-3">
            <Users className="w-8 h-8 text-mod-crm" />
          </div>
          <p className="text-muted-foreground text-sm">
            {search ? "No contacts match your search." : "No contacts yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2 slide-up stagger-3">
          {filtered.map((contact) => (
            <Card
              key={contact.id}
              className="card-hover cursor-pointer border-l-4 border-mod-crm"
              onClick={() => setSelected(contact)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-mod-crm-tint flex items-center justify-center shrink-0">
                  <span className="text-mod-crm font-semibold">
                    {contact.name[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{contact.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {contact.company && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {contact.company}
                      </span>
                    )}
                    {contact.email && (
                      <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {contact.email}
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
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setEditContact(contact); setContactFormOpen(true); }}
                    >
                      <Pencil className="w-4 h-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteContactId(contact.id); }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => { setEditContact(null); setContactFormOpen(true); }}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-brand text-white shadow-brand transition-all hover:bg-brand-hover active:scale-95 flex items-center justify-center z-40"
        aria-label="Add contact"
      >
        <Plus className="w-6 h-6" />
      </button>

      <ContactForm
        open={contactFormOpen}
        onOpenChange={(v) => { setContactFormOpen(v); if (!v) setEditContact(null); }}
        initial={editContact}
        onSaved={() => { fetchContacts(); toast.success(editContact ? "Contact updated" : "Contact added"); }}
      />

      {selected && (
        <ContactDetail
          contact={selected}
          onClose={() => setSelected(null)}
          onSaved={(updatedContact) => {
            if (updatedContact) setSelected(updatedContact);
            fetchContacts();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteContactId}
        onOpenChange={(v) => { if (!v) setDeleteContactId(null); }}
        title="Delete contact?"
        description="This contact and all their interactions will be permanently deleted."
        onConfirm={handleDeleteContact}
      />
    </div>
  );
}

// ─── Contact Form (create + edit) ─────────────────────────────────────────────

function ContactForm({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Contact | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [type, setType] = useState<Contact["type"]>("network");
  const [stage, setStage] = useState<Contact["stage"]>("new");
  const [dealValue, setDealValue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setEmail(initial.email ?? "");
      setPhone(initial.phone ?? "");
      setCompany(initial.company ?? "");
      setRole(initial.role ?? "");
      setType(initial.type);
      setStage(initial.stage);
      setDealValue(initial.deal_value ? String(initial.deal_value) : "");
      setNotes(initial.notes ?? "");
    } else {
      setName(""); setEmail(""); setPhone(""); setCompany("");
      setRole(""); setType("network"); setStage("new"); setDealValue(""); setNotes("");
    }
  }, [initial, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();

    if (initial) {
      await supabase.from("contacts").update({
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        company: company || null,
        role: role || null,
        type,
        stage,
        deal_value: dealValue ? parseFloat(dealValue) : null,
        notes: notes || null,
      }).eq("id", initial.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("contacts").insert({
        user_id: user.id,
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        company: company || null,
        role: role || null,
        type,
        stage,
        deal_value: dealValue ? parseFloat(dealValue) : null,
        notes: notes || null,
        tags: [],
      });
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Contact" : "New Contact"}</DialogTitle>
        </DialogHeader>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as Contact["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["lead", "prospect", "client", "network", "personal"].map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as Contact["stage"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Deal value (AED, optional)</Label>
            <Input type="number" step="0.01" min="0" placeholder="0.00" value={dealValue} onChange={(e) => setDealValue(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea placeholder="Any notes about this contact…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : initial ? "Update" : "Add Contact"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contact Detail ───────────────────────────────────────────────────────────

function ContactDetail({
  contact,
  onClose,
  onSaved,
}: {
  contact: Contact;
  onClose: () => void;
  onSaved: (updated?: Contact) => void;
}) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [note, setNote] = useState("");
  const [intType, setIntType] = useState<Interaction["type"]>("call");
  const [followUp, setFollowUp] = useState("");
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [deleteIntId, setDeleteIntId] = useState<string | null>(null);
  const [stageSaving, setStageSaving] = useState(false);

  async function loadInteractions() {
    const supabase = createClient();
    const { data } = await supabase
      .from("interactions")
      .select("*")
      .eq("contact_id", contact.id)
      .order("date", { ascending: false });
    setInteractions(data ?? []);
  }

  useEffect(() => {
    loadInteractions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id]);

  async function logInteraction(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("interactions").insert({
      user_id: user.id,
      contact_id: contact.id,
      type: intType,
      notes: note,
      date: todayISO(),
      follow_up_date: followUp || null,
    });
    await supabase
      .from("contacts")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", contact.id);
    setNote("");
    setFollowUp("");
    setLogOpen(false);
    loadInteractions();
    toast.success("Interaction logged");
    onSaved();
  }

  async function handleDeleteInteraction() {
    if (!deleteIntId) return;
    const supabase = createClient();
    await supabase.from("interactions").delete().eq("id", deleteIntId);
    setDeleteIntId(null);
    toast.success("Interaction deleted");
    loadInteractions();
  }

  async function updateStage(newStage: Contact["stage"]) {
    setStageSaving(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("contacts")
      .update({ stage: newStage })
      .eq("id", contact.id)
      .select()
      .single();
    setStageSaving(false);
    if (data) {
      toast.success(`Stage updated to ${newStage}`);
      onSaved(data);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-mod-crm-tint flex items-center justify-center">
              <span className="text-mod-crm font-semibold text-sm">{contact.name[0]}</span>
            </div>
            {contact.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact info */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {contact.email && (
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <a href={`mailto:${contact.email}`} className="text-primary hover:underline flex items-center gap-1">
                  <Mail className="w-3 h-3" />{contact.email}
                </a>
              </div>
            )}
            {contact.phone && (
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <a href={`tel:${contact.phone}`} className="text-primary hover:underline flex items-center gap-1">
                  <Phone className="w-3 h-3" />{contact.phone}
                </a>
              </div>
            )}
            {contact.company && (
              <div>
                <p className="text-xs text-muted-foreground">Company</p>
                <p>{contact.company}</p>
              </div>
            )}
            {contact.role && (
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p>{contact.role}</p>
              </div>
            )}
            {contact.deal_value && (
              <div>
                <p className="text-xs text-muted-foreground">Deal value</p>
                <p className="font-medium text-mod-finance">AED {contact.deal_value.toLocaleString()}</p>
              </div>
            )}
            {contact.last_contacted_at && (
              <div>
                <p className="text-xs text-muted-foreground">Last contacted</p>
                <p>{formatDate(contact.last_contacted_at)}</p>
              </div>
            )}
          </div>

          {/* Stage selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline Stage</p>
            <div className="flex gap-1.5 flex-wrap">
              {STAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={stageSaving}
                  onClick={() => updateStage(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${contact.stage === s ? STAGE_COLORS[s] + " ring-2 ring-offset-1 ring-current" : "bg-accent text-accent-foreground hover:bg-accent/80"}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {contact.notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm">{contact.notes}</p>
            </div>
          )}

          {/* Log interaction button */}
          <Button size="sm" onClick={() => setLogOpen(!logOpen)} className="w-full gap-1.5" variant={logOpen ? "outline" : "default"}>
            <Plus className="w-4 h-4" /> {logOpen ? "Cancel" : "Log Interaction"}
          </Button>

          {/* Log form */}
          {logOpen && (
            <form onSubmit={logInteraction} className="space-y-3 p-3 rounded-lg bg-accent/50">
              <Select value={intType} onValueChange={(v) => setIntType(v as Interaction["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["call", "email", "meeting", "message", "other"].map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Notes from this interaction…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                required
              />
              <div className="space-y-2">
                <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setShowFollowUpPicker(true)}>
                  <span>{followUp ? formatDate(followUp) : "Pick follow-up date"}</span>
                  <span className="text-xs text-muted-foreground">{followUp ? "Change" : "Choose"}</span>
                </Button>
                {showFollowUpPicker && (
                  <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(26,26,46,0.35)] p-3 md:items-center">
                    <DateTimePicker
                      initialDate={followUp ? new Date(`${followUp}T12:00:00`) : new Date()}
                      mode="date"
                      onSave={(date) => {
                        const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                        setFollowUp(next)
                        setShowFollowUpPicker(false)
                      }}
                      onCancel={() => setShowFollowUpPicker(false)}
                    />
                  </div>
                )}
              </div>
              <Button size="sm" type="submit">Save</Button>
            </form>
          )}

          {/* Interaction history */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Interaction History
            </p>
            {interactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No interactions logged.</p>
            ) : (
              interactions.map((i) => (
                <div key={i.id} className="p-2.5 rounded-lg border border-border space-y-1 group relative">
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="text-xs">{i.type}</Badge>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{formatDate(i.date)}</span>
                      <button
                        type="button"
                        aria-label="Delete interaction"
                        onClick={() => setDeleteIntId(i.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm">{i.notes}</p>
                  {i.follow_up_date && (
                    <p className="text-xs text-mod-crm">Follow up: {formatDate(i.follow_up_date)}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>

      <ConfirmDialog
        open={!!deleteIntId}
        onOpenChange={(v) => { if (!v) setDeleteIntId(null); }}
        title="Delete interaction?"
        description="This interaction log will be permanently removed."
        onConfirm={handleDeleteInteraction}
      />
    </Dialog>
  );
}
