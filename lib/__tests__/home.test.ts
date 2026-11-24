import { describe, expect, it } from "vitest";
import {
  goalTargetLabel,
  isOverdueTask,
  lastContactLabel,
  splitTodayTasks,
} from "../home";

const TODAY = "2026-11-24";

describe("isOverdueTask", () => {
  it("is overdue only when due before today", () => {
    expect(isOverdueTask({ due_date: "2026-11-23" }, TODAY)).toBe(true);
    expect(isOverdueTask({ due_date: TODAY }, TODAY)).toBe(false);
    expect(isOverdueTask({ due_date: "2026-11-25" }, TODAY)).toBe(false);
    expect(isOverdueTask({ due_date: null }, TODAY)).toBe(false);
  });
});

describe("splitTodayTasks", () => {
  it("splits overdue from due-today and keeps each group's order", () => {
    const tasks = [
      { id: "a", due_date: TODAY },
      { id: "b", due_date: "2026-11-20" },
      { id: "c", due_date: TODAY },
      { id: "d", due_date: "2026-11-23" },
    ];
    const { overdue, dueToday } = splitTodayTasks(tasks, TODAY);
    expect(overdue.map((t) => t.id)).toEqual(["b", "d"]);
    expect(dueToday.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("returns two empty groups for an empty list", () => {
    expect(splitTodayTasks([], TODAY)).toEqual({ overdue: [], dueToday: [] });
  });
});

describe("lastContactLabel", () => {
  it("says never for a contact with no date or an unreadable one", () => {
    expect(lastContactLabel(null, TODAY)).toBe("Never contacted");
    expect(lastContactLabel("not a date", TODAY)).toBe("Never contacted");
  });

  it("counts whole Dubai days since the last contact", () => {
    expect(lastContactLabel("2026-11-24T05:00:00Z", TODAY)).toBe(
      "Contacted today",
    );
    expect(lastContactLabel("2026-11-23T05:00:00Z", TODAY)).toBe(
      "Last contact 1 day ago",
    );
    expect(lastContactLabel("2026-10-23T05:00:00Z", TODAY)).toBe(
      "Last contact 32 days ago",
    );
  });

  it("reads the timestamp in Dubai time, not UTC", () => {
    // 21:00 UTC on the 23rd is 01:00 on the 24th in Dubai.
    expect(lastContactLabel("2026-11-23T21:00:00Z", TODAY)).toBe(
      "Contacted today",
    );
  });

  it("treats a timestamp after today as today", () => {
    expect(lastContactLabel("2026-11-26T05:00:00Z", TODAY)).toBe(
      "Contacted today",
    );
  });
});

describe("goalTargetLabel", () => {
  it("is null for a goal without a target date", () => {
    expect(goalTargetLabel(null, TODAY)).toBeNull();
  });

  it("gives the date and the days left", () => {
    expect(goalTargetLabel("2026-12-31", TODAY)).toBe(
      "Target 31/12/2026 · 37 days left",
    );
    expect(goalTargetLabel("2026-11-25", TODAY)).toBe(
      "Target 25/11/2026 · 1 day left",
    );
    expect(goalTargetLabel(TODAY, TODAY)).toBe("Target 24/11/2026 · due today");
  });

  it("says how far past a missed target is", () => {
    expect(goalTargetLabel("2026-11-23", TODAY)).toBe(
      "Target 23/11/2026 · 1 day past",
    );
    expect(goalTargetLabel("2026-11-20", TODAY)).toBe(
      "Target 20/11/2026 · 4 days past",
    );
  });
});
