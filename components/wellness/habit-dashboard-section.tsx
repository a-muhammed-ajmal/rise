"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ChevronDown, Flame, Clock, Heart } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/supabase/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Habit, HabitLog } from "@/lib/types/database";
import { todayISO, display12h } from "@/lib/format";
import { habitStreak, streakLabel } from "@/lib/wellness/streak";
import { AffirmationDialog } from "@/components/wellness/affirmation-dialog";
import { cn } from "@/lib/utils";

const DAYS_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VISIBLE_COUNT = 3;

interface Props {
  /** Active habits scheduled for today. */
  habits: Habit[];
  /** Logs for those habits over the streak window (lib/wellness/streak.ts), today included. */
  logs: Pick<HabitLog, "habit_id" | "completed" | "logged_date">[];
}

/**
 * The Home habits card: today's count in the header, then the habits not yet
 * marked today. Marking one updates the count here at once and refreshes the
 * server page so the Habits stat tile above agrees.
 */
export function HabitDashboardSection({ habits, logs }: Props) {
  const router = useRouter();
  const [viewHabit, setViewHabit] = useState<Habit | null>(null);
  const today = todayISO();
  const [logMap, setLogMap] = useState<Map<string, boolean>>(
    () =>
      new Map(
        logs
          .filter((l) => l.logged_date === today)
          .map((l) => [l.habit_id, l.completed]),
      ),
  );
  const [expanded, setExpanded] = useState(false);

  // Streaks count back from yesterday, so marking today never changes them.
  const streaks = useMemo(
    () =>
      new Map(
        habits.map((h) => [h.id, streakLabel(habitStreak(h, logs, today))]),
      ),
    [habits, logs, today],
  );

  async function mark(habit: Habit, completed: boolean) {
    const supabase = createClient();
    const userId = await currentUserId();
    if (!userId) return;
    const { error } = await supabase.from("habit_logs").upsert(
      {
        user_id: userId,
        habit_id: habit.id,
        logged_date: today,
        completed,
        deleted_at: null,
      },
      { onConflict: "habit_id,logged_date" },
    );
    if (error) {
      console.error("[dashboard habits] mark failed:", error.message);
      toast.error(
        completed
          ? "Could not mark this habit done. Please try again."
          : "Could not update this habit. Please try again.",
      );
      return;
    }
    setLogMap((m) => new Map(m).set(habit.id, completed));
    router.refresh();
  }

  function scheduleLabel(habit: Habit): string {
    if (habit.target_days.length === 7) return "Every day";
    return habit.target_days.map((d) => DAYS_LONG[d]).join(", ");
  }

  const completedCount = habits.filter((h) => logMap.get(h.id) === true).length;
  // Only show habits not yet marked today — once marked (done or not-done) the row drops off.
  const pending = habits.filter((h) => !logMap.has(h.id));
  const visible = expanded ? pending : pending.slice(0, VISIBLE_COUNT);
  const remaining = pending.length - VISIBLE_COUNT;

  return (
    <Card className="slide-up stagger-3" aria-label="Habits">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md bg-mod-wellness-tint"
            aria-hidden="true"
          >
            <Heart
              className="h-3.5 w-3.5 text-mod-wellness"
              aria-hidden="true"
            />
          </div>
          Habits
        </CardTitle>
        {habits.length > 0 && (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {completedCount}/{habits.length} done
          </span>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {habits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No habits due today.</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All habits logged for today.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {visible.map((habit) => {
                const streak = streaks.get(habit.id);
                return (
                  <li
                    key={habit.id}
                    className="flex items-center gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <button
                      type="button"
                      disabled={!habit.description}
                      className={cn(
                        "flex-1 min-w-0 min-h-11 text-left rounded-sm",
                        habit.description &&
                          "hover:text-brand-text active:opacity-80",
                      )}
                      onClick={() => {
                        if (habit.description) setViewHabit(habit);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: habit.color ?? "var(--brand)",
                          }}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-medium break-words">
                          {habit.name}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground mt-1 ml-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{scheduleLabel(habit)}</span>
                        {habit.reminder_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {display12h(habit.reminder_time)}
                          </span>
                        )}
                        {streak && (
                          <span className="flex items-center gap-1 font-medium text-mod-wellness">
                            <Flame className="w-3 h-3" aria-hidden="true" />
                            {streak}
                          </span>
                        )}
                      </span>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => mark(habit, true)}
                        className="w-11 h-11 rounded-full border border-[var(--color-success)] text-[var(--color-success)] flex items-center justify-center transition-colors hover:bg-[var(--color-success-tint)] active:scale-95"
                        aria-label={`Mark ${habit.name} done`}
                      >
                        <Check className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => mark(habit, false)}
                        className="w-11 h-11 rounded-full border border-[var(--color-danger)] text-[var(--color-danger)] flex items-center justify-center transition-colors hover:bg-[var(--color-danger-tint)] active:scale-95"
                        aria-label={`Mark ${habit.name} not done`}
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {pending.length > VISIBLE_COUNT && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                className="min-h-11 w-full flex items-center justify-center gap-1 text-label text-brand-text hover:bg-brand-tint active:opacity-80 rounded-sm transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    expanded && "rotate-180",
                  )}
                  aria-hidden="true"
                />
                {expanded ? "Show less" : `${remaining} more`}
              </button>
            )}
          </>
        )}
      </CardContent>

      <AffirmationDialog habit={viewHabit} onClose={() => setViewHabit(null)} />
    </Card>
  );
}
