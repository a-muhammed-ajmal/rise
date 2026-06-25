"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Note, Link } from "@/lib/types/database";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Plus,
  Search,
  StickyNote,
  LinkIcon,
  Loader2,
  BookOpen,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export default function KnowledgePage() {
  const [tab, setTab] = useState<"notes" | "links">("notes");
  const [notes, setNotes] = useState<Note[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Note state
  const [noteOpen, setNoteOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  // Link state
  const [linkOpen, setLinkOpen] = useState(false);
  const [editLink, setEditLink] = useState<Link | null>(null);
  const [deleteLinkId, setDeleteLinkId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: ns }, { data: ls }] = await Promise.all([
      supabase.from("notes").select("*").order("updated_at", { ascending: false }),
      supabase.from("links").select("*").order("created_at", { ascending: false }),
    ]);
    setNotes(ns ?? []);
    setLinks(ls ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDeleteNote() {
    if (!deleteNoteId) return;
    const supabase = createClient();
    await supabase.from("notes").delete().eq("id", deleteNoteId);
    setDeleteNoteId(null);
    toast.success("Note deleted");
    fetchData();
  }

  async function handleDeleteLink() {
    if (!deleteLinkId) return;
    const supabase = createClient();
    await supabase.from("links").delete().eq("id", deleteLinkId);
    setDeleteLinkId(null);
    toast.success("Link deleted");
    fetchData();
  }

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );
  const filteredLinks = links.filter(
    (l) =>
      (l.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
      l.url.toLowerCase().includes(search.toLowerCase()) ||
      l.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-mod-knowledge" />
      </div>
    );
  }

  return (
    <div
      className="p-4 md:p-6 max-w-2xl space-y-4 page-glow"
      style={{ "--glow-color": "var(--mod-knowledge)" } as React.CSSProperties}
    >
      <div className="flex items-center justify-between animate-rise-in stagger-1">
        <h1 className="text-step-2 font-heading font-bold tracking-tight flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-mod-knowledge-soft flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-mod-knowledge" />
          </div>
          Knowledge
        </h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditLink(null); setLinkOpen(true); }}
            className="gap-1.5"
          >
            <LinkIcon className="w-4 h-4" /> Link
          </Button>
          <Button
            size="sm"
            onClick={() => { setEditNote(null); setNoteOpen(true); }}
            className="gap-1.5 bg-mod-knowledge hover:bg-mod-knowledge/90 text-white"
          >
            <Plus className="w-4 h-4" /> Note
          </Button>
        </div>
      </div>

      <div className="relative animate-rise-in stagger-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search notes, links…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full">
          <TabsTrigger value="notes" className="flex-1 gap-1.5">
            <StickyNote className="w-3.5 h-3.5" /> Notes ({filteredNotes.length})
          </TabsTrigger>
          <TabsTrigger value="links" className="flex-1 gap-1.5">
            <LinkIcon className="w-3.5 h-3.5" /> Links ({filteredLinks.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "notes" && (
        <div className="space-y-3 animate-rise-in stagger-3">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-mod-knowledge-soft flex items-center justify-center mx-auto mb-3">
                <StickyNote className="w-8 h-8 text-mod-knowledge" />
              </div>
              <p className="text-muted-foreground text-sm">
                {search ? "No notes match your search." : "No notes yet."}
              </p>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <Card key={note.id} className="card-interactive group">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <p
                      className="font-medium text-sm cursor-pointer flex-1"
                      onClick={() => { setEditNote(note); setNoteOpen(true); }}
                    >
                      {note.title}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <p className="text-xs text-muted-foreground">{formatDate(note.updated_at)}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditNote(note); setNoteOpen(true); }}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteNoteId(note.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{note.content}</p>
                  {note.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {note.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "links" && (
        <div className="space-y-2 animate-rise-in stagger-3">
          {filteredLinks.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-mod-knowledge-soft flex items-center justify-center mx-auto mb-3">
                <LinkIcon className="w-8 h-8 text-mod-knowledge" />
              </div>
              <p className="text-muted-foreground text-sm">
                {search ? "No links match your search." : "No links saved yet."}
              </p>
            </div>
          ) : (
            filteredLinks.map((link) => (
              <Card key={link.id} className="card-interactive group">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-mod-knowledge-soft flex items-center justify-center shrink-0 mt-0.5">
                    <LinkIcon className="w-4 h-4 text-mod-knowledge" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sm text-primary hover:underline block truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {link.title ?? link.url}
                        <ExternalLink className="w-3 h-3 inline ml-1 opacity-60" />
                      </a>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-6 w-6 shrink-0 inline-flex items-center justify-center rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditLink(link); setLinkOpen(true); }}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteLinkId(link.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {link.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{link.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{link.url}</p>
                    {link.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {link.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => { setEditNote(null); setNoteOpen(true); }}
        className="fab fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-mod-knowledge text-white flex items-center justify-center z-40"
        aria-label="Add note"
      >
        <Plus className="w-6 h-6" />
      </button>

      <NoteDialog
        open={noteOpen}
        onOpenChange={(v) => { setNoteOpen(v); if (!v) setEditNote(null); }}
        note={editNote}
        onSaved={() => { fetchData(); toast.success(editNote ? "Note updated" : "Note saved"); }}
      />
      <LinkDialog
        open={linkOpen}
        onOpenChange={(v) => { setLinkOpen(v); if (!v) setEditLink(null); }}
        link={editLink}
        onSaved={() => { fetchData(); toast.success(editLink ? "Link updated" : "Link saved"); }}
      />

      <ConfirmDialog
        open={!!deleteNoteId}
        onOpenChange={(v) => { if (!v) setDeleteNoteId(null); }}
        title="Delete note?"
        description="This note will be permanently deleted."
        onConfirm={handleDeleteNote}
      />
      <ConfirmDialog
        open={!!deleteLinkId}
        onOpenChange={(v) => { if (!v) setDeleteLinkId(null); }}
        title="Delete link?"
        description="This saved link will be permanently deleted."
        onConfirm={handleDeleteLink}
      />
    </div>
  );
}

// ─── Note Dialog ──────────────────────────────────────────────────────────────

function NoteDialog({
  open,
  onOpenChange,
  note,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  note: Note | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setTagsInput(note.tags.join(", "));
    } else {
      setTitle(""); setContent(""); setTagsInput("");
    }
  }, [note, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    if (note) {
      await supabase.from("notes").update({ title, content, tags }).eq("id", note.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("notes").insert({
        user_id: user.id,
        title,
        content,
        tags,
        linked_to_type: null,
        linked_to_id: null,
      });
    }
    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{note ? "Edit Note" : "New Note"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="Note title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea placeholder="Write your note…" value={content} onChange={(e) => setContent(e.target.value)} rows={8} />
          </div>
          <div className="space-y-2">
            <Label>Tags (comma-separated)</Label>
            <Input placeholder="e.g. work, idea, meeting" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : note ? "Update" : "Save Note"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Link Dialog (create + edit) ──────────────────────────────────────────────

function LinkDialog({
  open,
  onOpenChange,
  link,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  link: Link | null;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (link) {
      setUrl(link.url);
      setTitle(link.title ?? "");
      setDescription(link.description ?? "");
      setTagsInput(link.tags.join(", "));
    } else {
      setUrl(""); setTitle(""); setDescription(""); setTagsInput("");
    }
  }, [link, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

    if (link) {
      await supabase.from("links").update({
        url,
        title: title || null,
        description: description || null,
        tags,
      }).eq("id", link.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("links").insert({
        user_id: user.id,
        url,
        title: title || null,
        description: description || null,
        tags,
      });
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{link ? "Edit Link" : "Save Link"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>URL</Label>
            <Input type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-2">
            <Label>Title (optional)</Label>
            <Input placeholder="Descriptive title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea placeholder="Why are you saving this?" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <Input placeholder="e.g. research, tool, reference" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : link ? "Update" : "Save Link"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
