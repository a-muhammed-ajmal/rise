"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, Undo2, ChevronDown } from "lucide-react";
import type { Habit } from "@/lib/types/database";

const DAYS_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VISIBLE_COUNT = 5;

interface Props {
  habits: Habit[];
  logs: { habit_id: string; completed: boolean }[];
}

export function HabitDashboardSection({ habits, logs }: Props) {
  const [logMap, setLogMap] = useState<Map<string, boolean>>(
    () => new Map(logs.map((l) => [l.habit_id, l.completed])),
  );
  const [expanded, setExpanded] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  async function markDone(habitId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("habit_logs").upsert(
      { user_id: user.id, habit_id: habitId, logged_date: today, completed: true },
      { onConflict: "habit_id,logged_date" },
    );
    setLogMap((m) => new Map(m).set(habitId, true));
  }

  async function markNotDone(habitId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("habit_logs").upsert(
      { user_id: user.id, habit_id: habitId, logged_date: today, completed: false },
      { onConflict: "habit_id,logged_date" },
    );
    setLogMap((m) => new Map(m).set(habitId, false));
  }

  async function undoMark(habitId: string) {
    const supabase = createClient();
    await supabase
      .from("habit_logs")
      .delete()
      .eq("habit_id", habitId)
      .eq("logged_date", today);
    setLogMap((m) => {
      const next = new Map(m);
      next.delete(habitId);
      return next;
    });
  }

  function scheduleLabel(habit: Habit): string {
    if (habit.target_days.length === 7) return "Every day";
    return habit.target_days.map((d) => DAYS_LONG[d]).join(", ");
  }

  const visible = expanded ? habits : habits.slice(0, VISIBLE_COUNT);
  const remaining = habits.length - VISIBLE_COUNT;

  if (!habits.length) {
    return <p className="text-sm text-muted-foreground">No habits due today.</p>;
  }

  return (
    <div className="space-y-2">
      {visible.map((habit) => {
        const logVal = logMap.get(habit.id);
        const markState =
          logVal === true ? "done" : logVal === false ? "notDone" : "none";
        const cardBorderClass =
          markState === "done"
            ? "border-green-500/25 bg-green-500/5"
            : markState === "notDone"
              ? "border-red-500/25 bg-red-500/5"
              : "";

        return (
          <Card key={habit.id} className={`card-interactive ${cardBorderClass}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: habit.color ?? "#6366f1" }}
                  />
                  <span className="text-sm font-medium truncate">{habit.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 ml-4">
                  {scheduleLabel(habit)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {markState === "none" ? (
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
                ) : (
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
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {habits.length > VISIBLE_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {expanded ? "Show less" : `${remaining} more`}
        </button>
      )}
    </div>
  );
}
