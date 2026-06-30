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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Plus,
  Flame,
  Timer,
  Loader2,
  Heart,
  MoreVertical,
  Pencil,
  Trash2,
  Archive,
  Check,
  X,
  Undo2,
  Clock,
} from "lucide-react";
import { subDays, format } from "date-fns";
import { toast } from "sonner";

const DAYS_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Ordered Mon–Sun for the specific-days compact picker (matching calendar convention)
const DAY_PICKER_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_PICKER_DOW    = [1,   2,   3,   4,   5,   6,   0]; // Mon=1 … Sun=0

const COLOR_SWATCHES = [
  "#6366f1", // indigo (default)
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#64748b", // slate
];

type RepeatMode = "daily" | "weekdays" | "weekends" | "specific";

function detectRepeatMode(h: Habit): RepeatMode {
  const sorted = [...h.target_days].sort((a, b) => a - b).join(",");
  if (sorted === "0,1,2,3,4,5,6") return "daily";
  if (sorted === "1,2,3,4,5") return "weekdays";
  if (sorted === "0,6") return "weekends";
  return "specific";
}

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
      supabase.from("habits").select("*").eq("active", true).order("reminder_time", { ascending: true, nullsFirst: false }),
      supabase.from("habit_logs").select("*").gte("logged_date", last30),
    ]);
    setHabits(hs ?? []);
    setLogs(ls ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function markDone(habitId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("habit_logs").upsert(
      { user_id: user.id, habit_id: habitId, logged_date: today, completed: true },
      { onConflict: "habit_id,logged_date" },
    );
    await fetchData();
  }

  async function markNotDone(habitId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("habit_logs").upsert(
      { user_id: user.id, habit_id: habitId, logged_date: today, completed: false },
      { onConflict: "habit_id,logged_date" },
    );
    await fetchData();
  }

  async function undoMark(habitId: string) {
    const supabase = createClient();
    await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("logged_date", today);
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

  // Streak counts consecutive completed scheduled days backward from yesterday.
  // Non-scheduled days (not in target_days) are skipped — only scheduled days
  // with no log or completed=false break the streak.
  function getStreak(habitId: string, habit: Habit): number {
    const logMap = new Map(
      logs.filter((l) => l.habit_id === habitId).map((l) => [l.logged_date, l.completed]),
    );
    let streak = 0;
    let d = subDays(new Date(), 1); // today is not over; start from yesterday
    const created = new Date(habit.created_at);

    while (d >= created) {
      const dow = d.getDay();
      if (habit.target_days.includes(dow)) {
        const completed = logMap.get(format(d, "yyyy-MM-dd"));
        if (completed === true) {
          streak++;
        } else {
          break; // no log or completed:false on a scheduled day → streak ends
        }
      }
      d = subDays(d, 1);
    }
    return streak;
  }

  const todayHabits = habits.filter((h) => h.target_days.includes(todayDow));
  // Map habit_id → completed (true/false) for today's logs (includes both states)
  const todayLogMap = new Map(
    logs.filter((l) => l.logged_date === today).map((l) => [l.habit_id, l.completed]),
  );
  const completedToday = todayHabits.filter((h) => todayLogMap.get(h.id) === true).length;

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
        <h1 className="text-h1 font-heading tracking-tight flex items-center gap-2">
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
        <Card className="animate-rise-in stagger-2 border-t-4 border-mod-wellness">
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
            const logCompleted = todayLogMap.get(habit.id);
            const markState =
              logCompleted === true ? "done" : logCompleted === false ? "notDone" : "none";
            const streak = getStreak(habit.id, habit);

            const cardBorderClass =
              markState === "done"
                ? "border-green-500/25 bg-green-500/5"
                : markState === "notDone"
                  ? "border-red-500/25 bg-red-500/5"
                  : "";

            return (
              <Card key={habit.id} className={`card-interactive ${cardBorderClass}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: habit.color ?? "#6366f1" }}
                      />
                      <span className="text-sm font-medium truncate">{habit.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {habit.target_days.length === 7
                        ? "Every day"
                        : habit.target_days.map((d) => DAYS_LONG[d]).join(", ")}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {streak > 0 && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Flame className="w-3 h-3 text-orange-500" />
                        {streak}
                      </Badge>
                    )}

                    {/* Mark buttons — right side, next to ⋮ */}
                    {markState === "none" && isDueToday ? (
                      <>
                        <button
                          type="button"
                          onClick={() => markDone(habit.id)}
                          className="w-7 h-7 rounded-full border-2 border-green-500 text-green-500 flex items-center justify-center transition-colors hover:bg-green-500/10 active:scale-95"
                          aria-label="Mark done"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => markNotDone(habit.id)}
                          className="w-7 h-7 rounded-full border-2 border-red-500 text-red-500 flex items-center justify-center transition-colors hover:bg-red-500/10 active:scale-95"
                          aria-label="Mark not done"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : markState === "done" ? (
                      <>
                        <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={() => undoMark(habit.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Undo"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : markState === "notDone" ? (
                      <>
                        <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
                          <X className="w-3.5 h-3.5 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={() => undoMark(habit.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Undo"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : null}

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
  const [description, setDescription] = useState("");
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("daily");
  const [targetDays, setTargetDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [reminderTime, setReminderTime] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (habit) {
      setName(habit.name);
      setDescription(habit.description ?? "");
      const mode = detectRepeatMode(habit);
      setRepeatMode(mode);
      setTargetDays(habit.target_days);
      setReminderTime(habit.reminder_time?.slice(0, 5) ?? "");
      setColor(habit.color ?? "#6366f1");
    } else {
      setName("");
      setDescription("");
      setRepeatMode("daily");
      setTargetDays([0, 1, 2, 3, 4, 5, 6]);
      setReminderTime("");
      setColor("#6366f1");
    }
  }, [habit, open]);

  function handleRepeatModeChange(mode: RepeatMode) {
    setRepeatMode(mode);
    if (mode === "daily") setTargetDays([0, 1, 2, 3, 4, 5, 6]);
    else if (mode === "weekdays") setTargetDays([1, 2, 3, 4, 5]);
    else if (mode === "weekends") setTargetDays([0, 6]);
    // "specific": keep current targetDays so user can refine from the previous selection
  }

  function toggleDay(dow: number) {
    setTargetDays((prev) =>
      prev.includes(dow)
        ? prev.filter((x) => x !== dow)
        : [...prev, dow].sort((a, b) => a - b),
    );
  }

  const repeatModeFrequency: Record<RepeatMode, "daily" | "weekly" | "custom"> = {
    daily: "daily",
    weekdays: "custom",
    weekends: "custom",
    specific: "custom",
  };

  const repeatModeTargetDays: Record<RepeatMode, number[]> = {
    daily: [0, 1, 2, 3, 4, 5, 6],
    weekdays: [1, 2, 3, 4, 5],
    weekends: [0, 6],
    specific: targetDays,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const frequency = repeatModeFrequency[repeatMode];
    const target_days = repeatModeTargetDays[repeatMode];
    if (!name.trim() || target_days.length === 0) return;

    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      frequency,
      target_days,
      color,
      reminder_time: reminderTime || null,
    };

    if (habit) {
      await supabase.from("habits").update(payload).eq("id", habit.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }
      await supabase.from("habits").insert({ ...payload, user_id: user.id, active: true, icon: "⭐" });
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
          {/* 1. Name */}
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

          {/* 2. Description (optional) */}
          <div className="space-y-2">
            <Label>
              Description{" "}
              <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="What this habit means to you…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* 3. Repeat */}
          <div className="space-y-2">
            <Label>Repeat</Label>
            <Select value={repeatMode} onValueChange={(v) => handleRepeatModeChange(v as RepeatMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Every day</SelectItem>
                <SelectItem value="weekdays">Weekdays (Mon–Fri)</SelectItem>
                <SelectItem value="weekends">Weekends (Sat–Sun)</SelectItem>
                <SelectItem value="specific">Specific days</SelectItem>
              </SelectContent>
            </Select>

            {repeatMode === "specific" && (
              <div className="flex gap-1 pt-1">
                {DAY_PICKER_LABELS.map((label, i) => {
                  const dow = DAY_PICKER_DOW[i];
                  return (
                    <button
                      key={`${dow}-${i}`}
                      type="button"
                      onClick={() => toggleDay(dow)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        targetDays.includes(dow)
                          ? "bg-mod-wellness text-white"
                          : "bg-accent text-accent-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Reminder time (optional) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              Reminder time{" "}
              <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-36"
            />
          </div>

          {/* 5. Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform active:scale-95 ${
                    color === c ? "ring-2 ring-offset-2 ring-white/60 scale-110" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || (repeatMode === "specific" && targetDays.length === 0)}>
              {saving ? "Saving…" : habit ? "Update" : "Add Habit"}
            </Button>
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
              <span className="text-metric font-mono font-medium">{mm}:{ss}</span>
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
