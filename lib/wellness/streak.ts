// Habit streaks for the Home habits card.
//
// A streak is the number of consecutive *scheduled* days, counting back from
// yesterday, on which the habit was logged as completed. Days the habit is not
// scheduled are skipped; a scheduled day with no log, or a log marked not done,
// ends the streak. Today never counts — a habit still pending today has not
// broken anything yet.
//
// Dates are Dubai calendar days ("yyyy-MM-dd"), so string order is date order.
// The Home page only loads the last STREAK_WINDOW_DAYS of logs; a streak that
// is still unbroken at the edge of that window is reported as `capped`, and
// shown as "30+" rather than silently undercounted.

import { addDaysISO, toDubaiISODate } from "@/lib/format";
import type { Habit, HabitLog } from "@/lib/types/database";

export const STREAK_WINDOW_DAYS = 30;

export type StreakHabit = Pick<Habit, "id" | "target_days" | "created_at">;
export type StreakLog = Pick<
  HabitLog,
  "habit_id" | "completed" | "logged_date"
>;

export interface Streak {
  days: number;
  /** True when the streak ran past the oldest loaded log. */
  capped: boolean;
}

function dayOfWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function habitStreak(
  habit: StreakHabit,
  logs: readonly StreakLog[],
  today: string,
  windowDays: number = STREAK_WINDOW_DAYS,
): Streak {
  const completed = new Set(
    logs
      .filter((l) => l.habit_id === habit.id && l.completed === true)
      .map((l) => l.logged_date),
  );
  const created = toDubaiISODate(new Date(habit.created_at));
  const oldest = addDaysISO(today, -windowDays);

  let days = 0;
  for (
    let date = addDaysISO(today, -1);
    date >= created;
    date = addDaysISO(date, -1)
  ) {
    if (date < oldest) return { days, capped: true };
    if (!habit.target_days.includes(dayOfWeek(date))) continue;
    if (!completed.has(date)) return { days, capped: false };
    days += 1;
  }
  return { days, capped: false };
}

/** "5-day streak", "30+ day streak", or null when there is no streak to show. */
export function streakLabel(streak: Streak): string | null {
  if (streak.days === 0) return null;
  return streak.capped
    ? `${streak.days}+ day streak`
    : `${streak.days}-day streak`;
}
