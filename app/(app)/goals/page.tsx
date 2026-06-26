"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Goal, JournalEntry, Milestone } from "@/lib/types/database";
import { todayISO, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Plus,
  BookOpen,
  Loader2,
  ChevronRight,
  Target,
  MoreVertical,
  Pencil,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";

const MOODS = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😐", label: "Okay" },
  { value: 3, emoji: "🙂", label: "Good" },
  { value: 4, emoji: "😊", label: "Great" },
  { value: 5, emoji: "🤩", label: "Amazing" },
];

export default function GoalsPage() {
  const [tab, setTab] = useState<"goals" | "journal">("goals");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [todayEntry, setTodayEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalOpen, setGoalOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [editJournal, setEditJournal] = useState<JournalEntry | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [deleteJournalId, setDeleteJournalId] = useState<string | null>(null);
  const [milestonesGoal, setMilestonesGoal] = useState<Goal | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const today = todayISO();
    const [{ data: gs }, { data: es }, { data: te }] = await Promise.all([
      supabase.from("goals").select("*").order("created_at", { ascending: false }),
      supabase.from("journal_entries").select("*").order("date", { ascending: false }).limit(30),
      supabase.from("journal_entries").select("*").eq("date", today).maybeSingle(),
    ]);
    setGoals(gs ?? []);
    setEntries(es ?? []);
    setTodayEntry(te ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDeleteGoal() {
    if (!deleteGoalId) return;
    const supabase = createClient();
    await supabase.from("goals").delete().eq("id", deleteGoalId);
    setDeleteGoalId(null);
    toast.success("Goal deleted");
    fetchData();
  }

  async function handleDeleteJournal() {
    if (!deleteJournalId) return;
    const supabase = createClient();
    await supabase.from("journal_entries").delete().eq("id", deleteJournalId);
    setDeleteJournalId(null);
    toast.success("Entry deleted");
    fetchData();
  }

  const active = goals.filter((g) => g.status === "active");
  const completed = goals.filter((g) => g.status === "completed");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-mod-goals" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4 page-glow [--glow-color:var(--mod-goals)]">
      <div className="flex items-center justify-between animate-rise-in stagger-1">
        <h1 className="text-step-2 font-heading font-bold tracking-tight flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-mod-goals-soft flex items-center justify-center">
            <Target className="w-4 h-4 text-mod-goals" />
          </div>
          Goals
        </h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setEditJournal(null); setJournalOpen(true); }} className="gap-1.5">
            <BookOpen className="w-4 h-4" /> Journal
          </Button>
          <Button
            size="sm"
            onClick={() => { setEditGoal(null); setGoalOpen(true); }}
            className="gap-1.5 bg-mod-goals hover:bg-mod-goals/90 text-white"
          >
            <Plus className="w-4 h-4" /> Goal
          </Button>
        </div>
      </div>

      <div className="animate-rise-in stagger-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="goals" className="flex-1">Goals ({active.length})</TabsTrigger>
            <TabsTrigger value="journal" className="flex-1">Journal</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "goals" && (
        <div className="space-y-3 animate-rise-in stagger-3">
          {active.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-mod-goals-soft flex items-center justify-center mx-auto mb-3">
                <Target className="w-8 h-8 text-mod-goals" />
              </div>
              <p className="text-muted-foreground text-sm">No active goals. Set one to get started.</p>
            </div>
          ) : (
            active.map((goal) => (
              <Card key={goal.id} className="card-interactive">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => { setEditGoal(goal); setGoalOpen(true); }}
                    >
                      <p className="font-medium text-sm">{goal.title}</p>
                      {goal.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{goal.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="secondary" className="text-xs">{goal.category}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent">
                          <MoreVertical className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditGoal(goal); setGoalOpen(true); }}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setMilestonesGoal(goal)}>
                            <CheckSquare className="w-4 h-4 mr-2" /> Milestones
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteGoalId(goal.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                  </div>
                  {goal.target_date && (
                    <p className="text-xs text-muted-foreground">Target: {formatDate(goal.target_date)}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}

          {completed.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed</p>
              {completed.map((goal) => (
                <Card key={goal.id} className="opacity-60">
                  <CardContent className="p-3 flex items-center justify-between">
                    <p className="text-sm line-through">{goal.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge className="text-xs">✓ Done</Badge>
                      <button
                        type="button"
                        aria-label="Delete goal"
                        onClick={() => setDeleteGoalId(goal.id)}
                        className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "journal" && (
        <div className="space-y-3 animate-rise-in stagger-3">
          {!todayEntry ? (
            <Card
              className="border-dashed card-interactive cursor-pointer"
              onClick={() => { setEditJournal(null); setJournalOpen(true); }}
            >
              <CardContent className="p-6 text-center space-y-2">
                <div className="text-3xl">✍️</div>
                <p className="text-sm text-muted-foreground">No journal entry for today. Write one?</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-sm">Today</CardTitle>
                <div className="flex items-center gap-2">
                  {todayEntry.mood && (
                    <span className="text-xl">{MOODS.find((m) => m.value === todayEntry.mood)?.emoji}</span>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setEditJournal(todayEntry); setJournalOpen(true); }}>
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap line-clamp-5">{todayEntry.content}</p>
              </CardContent>
            </Card>
          )}

          {entries.filter((e) => e.date !== todayISO()).map((entry) => (
            <Card key={entry.id} className="group relative">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium text-muted-foreground">{formatDate(entry.date)}</p>
                  <div className="flex items-center gap-1">
                    {entry.mood && (
                      <span className="text-lg">{MOODS.find((m) => m.value === entry.mood)?.emoji}</span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-6 w-6 inline-flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditJournal(entry); setJournalOpen(true); }}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteJournalId(entry.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap line-clamp-3">{entry.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => { setEditGoal(null); setGoalOpen(true); }}
        className="fab fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-mod-goals text-white flex items-center justify-center z-40"
        aria-label="Add goal"
      >
        <Plus className="w-6 h-6" />
      </button>

      <GoalDialog
        open={goalOpen}
        onOpenChange={(v) => { setGoalOpen(v); if (!v) setEditGoal(null); }}
        goal={editGoal}
        onSaved={() => { fetchData(); toast.success(editGoal ? "Goal updated" : "Goal created"); }}
      />
      <JournalDialog
        open={journalOpen}
        onOpenChange={(v) => { setJournalOpen(v); if (!v) setEditJournal(null); }}
        existing={editJournal ?? todayEntry}
        onSaved={() => { fetchData(); toast.success("Journal saved"); }}
      />
      {milestonesGoal && (
        <MilestonesDialog
          goal={milestonesGoal}
          onClose={() => setMilestonesGoal(null)}
          onSaved={fetchData}
        />
      )}

      <ConfirmDialog
        open={!!deleteGoalId}
        onOpenChange={(v) => { if (!v) setDeleteGoalId(null); }}
        title="Delete goal?"
        description="This goal and its milestones will be permanently deleted."
        onConfirm={handleDeleteGoal}
      />
      <ConfirmDialog
        open={!!deleteJournalId}
        onOpenChange={(v) => { if (!v) setDeleteJournalId(null); }}
        title="Delete journal entry?"
        description="This entry will be permanently deleted."
        onConfirm={handleDeleteJournal}
      />
    </div>
  );
}

// ─── Goal Dialog ──────────────────────────────────────────────────────────────

function GoalDialog({
  open,
  onOpenChange,
  goal,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal: Goal | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Goal["category"]>("personal");
  const [targetDate, setTargetDate] = useState("");
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setDescription(goal.description ?? "");
      setCategory(goal.category);
      setTargetDate(goal.target_date ?? "");
      setProgress(goal.progress);
    } else {
      setTitle(""); setDescription(""); setCategory("personal"); setTargetDate(""); setProgress(0);
    }
  }, [goal, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const supabase = createClient();
    if (goal) {
      await supabase.from("goals").update({
        title,
        description: description || null,
        category,
        target_date: targetDate || null,
        progress,
        status: progress === 100 ? "completed" : "active",
      }).eq("id", goal.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("goals").insert({
        user_id: user.id,
        title,
        description: description || null,
        category,
        target_date: targetDate || null,
        progress,
        status: "active" as const,
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
          <DialogTitle>{goal ? "Edit Goal" : "New Goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-title">Title</Label>
            <Input id="goal-title" placeholder="What do you want to achieve?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-description">Description</Label>
            <Textarea id="goal-description" placeholder="Why does this matter?" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Goal["category"])}>
                <SelectTrigger id="goal-category" title="Category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["personal", "professional", "health", "financial", "other"].map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-target-date">Target Date</Label>
              <Input id="goal-target-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
          {goal && (
            <div className="space-y-2">
              <Label htmlFor="progress">Progress: {progress}%</Label>
              <input
                id="progress"
                type="range" min={0} max={100} value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : goal ? "Update" : "Create Goal"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Milestones Dialog ────────────────────────────────────────────────────────

function MilestonesDialog({
  goal,
  onClose,
  onSaved,
}: {
  goal: Goal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteMilestoneId, setDeleteMilestoneId] = useState<string | null>(null);

  async function loadMilestones() {
    const supabase = createClient();
    const { data } = await supabase
      .from("milestones")
      .select("*")
      .eq("goal_id", goal.id)
      .order("due_date", { ascending: true });
    setMilestones(data ?? []);
  }

  useEffect(() => {
    loadMilestones();
  }, [goal.id]);

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("milestones").insert({
      user_id: user.id,
      goal_id: goal.id,
      title: newTitle.trim(),
      due_date: newDate || null,
    });
    setNewTitle("");
    setNewDate("");
    setAdding(false);
    loadMilestones();
    toast.success("Milestone added");
    onSaved();
  }

  async function toggleMilestone(m: Milestone) {
    const supabase = createClient();
    await supabase.from("milestones").update({
      completed_at: m.completed_at ? null : new Date().toISOString(),
    }).eq("id", m.id);
    loadMilestones();
  }

  async function handleDeleteMilestone() {
    if (!deleteMilestoneId) return;
    const supabase = createClient();
    await supabase.from("milestones").delete().eq("id", deleteMilestoneId);
    setDeleteMilestoneId(null);
    toast.success("Milestone deleted");
    loadMilestones();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold line-clamp-1">
            Milestones — {goal.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <form onSubmit={addMilestone} className="flex gap-2">
            <Input
              placeholder="Add a milestone…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-36"
            />
            <Button type="submit" size="sm" disabled={adding || !newTitle.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </form>

          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No milestones yet.</p>
          ) : (
            <div className="space-y-1.5">
              {milestones.map((m) => (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 group">
                  <button
                    type="button"
                    aria-label={m.completed_at ? "Undo milestone" : "Complete milestone"}
                    onClick={() => toggleMilestone(m)}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {m.completed_at
                      ? <CheckSquare className="w-4 h-4 text-primary" />
                      : <Square className="w-4 h-4" />}
                  </button>
                  <p className={`text-sm flex-1 ${m.completed_at ? "line-through text-muted-foreground" : ""}`}>
                    {m.title}
                  </p>
                  {m.due_date && (
                    <span className="text-xs text-muted-foreground shrink-0">{formatDate(m.due_date)}</span>
                  )}
                  <button
                    type="button"
                    aria-label="Delete milestone"
                    onClick={() => setDeleteMilestoneId(m.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={!!deleteMilestoneId}
        onOpenChange={(v) => { if (!v) setDeleteMilestoneId(null); }}
        title="Delete milestone?"
        onConfirm={handleDeleteMilestone}
      />
    </Dialog>
  );
}

// ─── Journal Dialog ───────────────────────────────────────────────────────────

function JournalDialog({
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: JournalEntry | null;
  onSaved: () => void;
}) {
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setContent(existing.content);
      setMood(existing.mood);
      setEnergy(existing.energy);
    } else {
      setContent(""); setMood(null); setEnergy(null);
    }
  }, [existing, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (existing) {
      await supabase.from("journal_entries").update({ content, mood, energy }).eq("id", existing.id);
    } else {
      await supabase.from("journal_entries").upsert({
        user_id: user.id,
        date: todayISO(),
        content,
        mood,
        energy,
        tags: [],
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
          <DialogTitle>{existing ? "Edit Entry" : "Today's Journal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>How are you feeling?</Label>
            <div className="flex gap-2 flex-wrap">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(mood === m.value ? null : m.value)}
                  className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-center transition-colors ${mood === m.value ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-accent"}`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Write your thoughts</Label>
            <Textarea
              placeholder="What happened today? What are you grateful for?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Entry"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
