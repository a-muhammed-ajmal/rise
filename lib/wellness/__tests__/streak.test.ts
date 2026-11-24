import { describe, expect, it } from "vitest";
import {
  habitStreak,
  streakLabel,
  STREAK_WINDOW_DAYS,
  type StreakLog,
} from "../streak";

// 24/11/2026 is a Tuesday (day 2).
const TODAY = "2026-11-24";
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const LONG_AGO = "2025-01-01T08:00:00Z";

const habit = (
  overrides: Partial<{
    id: string;
    target_days: number[];
    created_at: string;
  }> = {},
) => ({
  id: "h1",
  target_days: EVERY_DAY,
  created_at: LONG_AGO,
  ...overrides,
});

const done = (...dates: string[]): StreakLog[] =>
  dates.map((logged_date) => ({
    habit_id: "h1",
    completed: true,
    logged_date,
  }));

describe("habitStreak", () => {
  it("counts consecutive completed days back from yesterday", () => {
    const logs = done("2026-11-23", "2026-11-22", "2026-11-21", "2026-11-19");
    expect(habitStreak(habit(), logs, TODAY)).toEqual({
      days: 3,
      capped: false,
    });
  });

  it("does not count today, so a pending habit keeps yesterday's streak", () => {
    expect(
      habitStreak(habit(), done("2026-11-24", "2026-11-23"), TODAY),
    ).toEqual({ days: 1, capped: false });
    expect(habitStreak(habit(), done("2026-11-24"), TODAY)).toEqual({
      days: 0,
      capped: false,
    });
  });

  it("skips days the habit is not scheduled", () => {
    // Mon / Wed / Fri: 23 (Mon), 20 (Fri), 18 (Wed) done; 16 (Mon) missed.
    const logs = done("2026-11-23", "2026-11-20", "2026-11-18");
    expect(habitStreak(habit({ target_days: [1, 3, 5] }), logs, TODAY)).toEqual(
      { days: 3, capped: false },
    );
  });

  it("ends the streak on a day logged as not done", () => {
    const logs: StreakLog[] = [
      { habit_id: "h1", completed: false, logged_date: "2026-11-23" },
      ...done("2026-11-22", "2026-11-21"),
    ];
    expect(habitStreak(habit(), logs, TODAY)).toEqual({
      days: 0,
      capped: false,
    });
  });

  it("ignores other habits' logs", () => {
    const logs: StreakLog[] = [
      { habit_id: "other", completed: true, logged_date: "2026-11-23" },
    ];
    expect(habitStreak(habit(), logs, TODAY).days).toBe(0);
  });

  it("stops at the day the habit was created, in Dubai time", () => {
    const logs = done("2026-11-23", "2026-11-22", "2026-11-21", "2026-11-20");
    expect(
      habitStreak(habit({ created_at: "2026-11-21T10:00:00Z" }), logs, TODAY),
    ).toEqual({
      days: 3,
      capped: false,
    });
    // 21:00 UTC on the 22nd is already the 23rd in Dubai.
    expect(
      habitStreak(habit({ created_at: "2026-11-22T21:00:00Z" }), logs, TODAY),
    ).toEqual({
      days: 1,
      capped: false,
    });
  });

  it("reports a streak that outlasts the loaded window as capped", () => {
    const logs = done(
      "2026-11-23",
      "2026-11-22",
      "2026-11-21",
      "2026-11-20",
      "2026-11-19",
      "2026-11-18",
      "2026-11-17",
    );
    expect(habitStreak(habit(), logs, TODAY, 5)).toEqual({
      days: 5,
      capped: true,
    });
  });

  it("defaults to a 30-day window", () => {
    expect(STREAK_WINDOW_DAYS).toBe(30);
    const every = Array.from({ length: 40 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 10, 23 - i));
      return d.toISOString().slice(0, 10);
    });
    expect(habitStreak(habit(), done(...every), TODAY)).toEqual({
      days: 30,
      capped: true,
    });
  });
});

describe("streakLabel", () => {
  it("hides a zero streak", () => {
    expect(streakLabel({ days: 0, capped: false })).toBeNull();
  });

  it("names the streak in days", () => {
    expect(streakLabel({ days: 1, capped: false })).toBe("1-day streak");
    expect(streakLabel({ days: 12, capped: false })).toBe("12-day streak");
  });

  it("marks a capped streak as a lower bound", () => {
    expect(streakLabel({ days: 30, capped: true })).toBe("30+ day streak");
  });
});
