"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Habit, HabitLog } from "@/lib/types/database";
import { todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Plus,
  Flame,
  Timer,
  CheckCircle,
  Circle,
  Loader2,
  Heart,
  MoreVertical,
  Pencil,
  Trash2,
  Archive,
} from "lucide-react";
import { subDays, format } from "date-fns";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ICONS = ["⭐", "💪", "📚", "🧘", "🏃", "💧", "🥗", "😴", "✍️", "🎯", "🎨", "🎵"];

export default function WellnessPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [habitDialogOpen, setHabitDialogOpen] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null);
  const today = todayISO();
  const todayDow = new Date().getDay();

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const last30 = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const [{ data: hs }, { data: ls }] = await Promise.all([
      supabase.from("habits").select("*").eq("active", true).order("created_at"),
      supabase.from("habit_logs").select("*").gte("logged_date", last30),
    ]);
    setHabits(hs ?? []);
    setLogs(ls ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleHabit(habitId: string, done: boolean) {
    const supabase = createClient();
    if (done) {
      await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("logged_date", today);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("habit_logs").upsert({
        user_id: user.id,
        habit_id: habitId,
        logged_date: today,
        completed: true,
      });
    }
    await fetchData();
  }

  async function handleArchiveHabit(id: string) {
    const supabase = createClient();
    await supabase.from("habits").update({ active: false }).eq("id", id);
    toast.success("Habit archived");
    fetchData();
  }

  async function handleDeleteHabit() {
    if (!deleteHabitId) return;
    const supabase = createClient();
    await supabase.from("habits").delete().eq("id", deleteHabitId);
    setDeleteHabitId(null);
    toast.success("Habit deleted");
    fetchData();
  }

  function getStreak(habitId: string): number {
    const doneDays = new Set(
      logs.filter((l) => l.habit_id === habitId && l.completed).map((l) => l.logged_date),
    );
    let streak = 0;
    let d = new Date();
    while (true) {
      const key = format(d, "yyyy-MM-dd");
      if (doneDays.has(key)) {
        streak++;
        d = subDays(d, 1);
      } else {
        break;
      }
    }
    return streak;
  }

  const todayHabits = habits.filter((h) => h.target_days.includes(todayDow));
  const todayLogs = new Set(
    logs.filter((l) => l.logged_date === today && l.completed).map((l) => l.habit_id),
  );
  const completedToday = todayHabits.filter((h) => todayLogs.has(h.id)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-mod-wellness" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4 page-glow [--glow-color:var(--mod-wellness)]">
      <div className="flex items-center justify-between animate-rise-in stagger-1">
        <h1 className="text-step-2 font-heading font-bold tracking-tight flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-mod-wellness-soft flex items-center justify-center">
            <Heart className="w-4 h-4 text-mod-wellness" />
          </div>
          Wellness
        </h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setFocusOpen(true)} className="gap-1.5">
            <Timer className="w-4 h-4" /> Focus
          </Button>
          <Button
            size="sm"
            onClick={() => { setEditHabit(null); setHabitDialogOpen(true); }}
            className="gap-1.5 bg-mod-wellness hover:bg-mod-wellness/90 text-white"
          >
            <Plus className="w-4 h-4" /> Habit
          </Button>
        </div>
      </div>

      {todayHabits.length > 0 && (
        <Card className="animate-rise-in stagger-2 border-mod-wellness/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Today&apos;s habits</span>
              <span className="text-muted-foreground">{completedToday}/{todayHabits.length}</span>
            </div>
            <Progress
              value={todayHabits.length > 0 ? (completedToday / todayHabits.length) * 100 : 0}
              className="h-2"
            />
          </CardContent>
        </Card>
      )}

      <div className="space-y-2 animate-rise-in stagger-3">
        {habits.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-mod-wellness-soft flex items-center justify-center mx-auto mb-3">
              <Heart className="w-8 h-8 text-mod-wellness" />
            </div>
            <p className="text-muted-foreground text-sm">No habits yet. Add one to get started.</p>
          </div>
        ) : (
          habits.map((habit) => {
            const isDueToday = habit.target_days.includes(todayDow);
            const doneTodayFlag = todayLogs.has(habit.id);
            const streak = getStreak(habit.id);

            return (
              <Card key={habit.id} className={`card-interactive ${doneTodayFlag ? "opacity-75" : ""}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  {isDueToday ? (
                    <button
                      type="button"
                      onClick={() => toggleHabit(habit.id, doneTodayFlag)}
                      className="shrink-0 transition-transform active:scale-95"
                      aria-label={doneTodayFlag ? "Undo" : "Complete"}
                    >
                      {doneTodayFlag ? (
                        <CheckCircle className="w-7 h-7 text-mod-finance" />
                      ) : (
                        <Circle className="w-7 h-7 text-muted-foreground" />
                      )}
                    </button>
                  ) : (
                    <span className="w-7 h-7 flex items-center justify-center shrink-0 text-muted-foreground/40">
                      <Circle className="w-7 h-7" />
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{habit.icon}</span>
                      <span className={`text-sm font-medium ${doneTodayFlag ? "line-through text-muted-foreground" : ""}`}>
                        {habit.name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {habit.target_days.length === 7
                        ? "Every day"
                        : habit.target_days.map((d) => DAYS[d]).join(", ")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {streak > 0 && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Flame className="w-3 h-3 text-orange-500" />
                        {streak}
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent">
                        <MoreVertical className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditHabit(habit); setHabitDialogOpen(true); }}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleArchiveHabit(habit.id)}>
                          <Archive className="w-4 h-4 mr-2" /> Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteHabitId(habit.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => { setEditHabit(null); setHabitDialogOpen(true); }}
        className="fab fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-mod-wellness text-white flex items-center justify-center z-40"
        aria-label="Add habit"
      >
        <Plus className="w-6 h-6" />
      </button>

      <HabitDialog
        open={habitDialogOpen}
        onOpenChange={(v) => { setHabitDialogOpen(v); if (!v) setEditHabit(null); }}
        habit={editHabit}
        onSaved={() => { fetchData(); toast.success(editHabit ? "Habit updated" : "Habit added"); }}
      />
      <FocusTimerDialog open={focusOpen} onOpenChange={setFocusOpen} />

      <ConfirmDialog
        open={!!deleteHabitId}
        onOpenChange={(v) => { if (!v) setDeleteHabitId(null); }}
        title="Delete habit?"
        description="This habit and all its logs will be permanently deleted."
        onConfirm={handleDeleteHabit}
      />
    </div>
  );
}

// ─── Habit Dialog (create + edit) ────────────────────────────────────────────

function HabitDialog({
  open,
  onOpenChange,
  habit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  habit: Habit | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("⭐");
  const [targetDays, setTargetDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (habit) {
      setName(habit.name);
      setIcon(habit.icon);
      setTargetDays(habit.target_days);
    } else {
      setName("");
      setIcon("⭐");
      setTargetDays([0, 1, 2, 3, 4, 5, 6]);
    }
  }, [habit, open]);

  function toggleDay(d: number) {
    setTargetDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || targetDays.length === 0) return;
    setSaving(true);
    const supabase = createClient();

    if (habit) {
      await supabase.from("habits").update({
        name: name.trim(),
        icon,
        frequency: targetDays.length === 7 ? "daily" : "custom",
        target_days: targetDays,
      }).eq("id", habit.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("habits").insert({
        user_id: user.id,
        name: name.trim(),
        description: null,
        icon,
        color: "#6366f1",
        frequency: targetDays.length === 7 ? "daily" : "custom",
        target_days: targetDays,
        active: true,
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
          <DialogTitle>{habit ? "Edit Habit" : "New Habit"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="e.g. Morning run"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`text-xl p-1.5 rounded-lg transition-colors ${ic === icon ? "bg-mod-wellness-soft ring-2 ring-mod-wellness" : "hover:bg-accent"}`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Repeat on</Label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${targetDays.includes(i) ? "bg-mod-wellness text-white" : "bg-accent text-accent-foreground"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : habit ? "Update" : "Add Habit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Focus Timer Dialog ───────────────────────────────────────────────────────

function FocusTimerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [minutes, setMinutes] = useState(25);
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [startedAt, setStartedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!running) return;
    if (secondsLeft <= 0) {
      setRunning(false);
      saveSession();
      return;
    }
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, secondsLeft]);

  async function saveSession() {
    if (!startedAt) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("focus_sessions").insert({
      user_id: user.id,
      duration_minutes: minutes,
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      notes: null,
    });
    toast.success(`${minutes}min focus session saved!`);
  }

  function start() {
    setSecondsLeft(minutes * 60);
    setStartedAt(new Date());
    setRunning(true);
  }
  function pause() { setRunning(false); }
  function reset() {
    if (running && startedAt) {
      const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 60000);
      if (elapsed >= 1) saveSession();
    }
    setRunning(false);
    setStartedAt(null);
    setSecondsLeft(minutes * 60);
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const pct = ((minutes * 60 - secondsLeft) / (minutes * 60)) * 100;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          if (running && startedAt) {
            const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 60000);
            if (elapsed >= 1) saveSession();
          }
          setRunning(false);
          setStartedAt(null);
          setSecondsLeft(minutes * 60);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-xs text-center">
        <DialogHeader>
          <DialogTitle>Focus Timer</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="relative w-40 h-40 mx-auto">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
              <circle
                cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8"
                className="text-mod-wellness"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - pct / 100)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-mono font-bold">{mm}:{ss}</span>
            </div>
          </div>
          {!running && (
            <div className="flex justify-center gap-2">
              {[15, 25, 45, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMinutes(m); setSecondsLeft(m * 60); }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${minutes === m ? "bg-mod-wellness text-white" : "bg-accent"}`}
                >
                  {m}m
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-center gap-3">
            {!running ? (
              <Button onClick={start} className="w-24">Start</Button>
            ) : (
              <>
                <Button onClick={pause} variant="outline" className="w-24">Pause</Button>
                <Button onClick={reset} variant="ghost" className="w-24">Reset</Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
