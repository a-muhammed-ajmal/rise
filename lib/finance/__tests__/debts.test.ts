import { describe, expect, it } from "vitest";
import {
  DUE_SOON_DAYS,
  daysUntil,
  dueLabel,
  isDueSoon,
  isOpenDebt,
  isOverdue,
  sortByDueDate,
} from "../debts";

const TODAY = "2026-11-18";
const debt = (due_date: string | null, extra: { paid_at?: string | null; deleted_at?: string | null } = {}) => ({
  due_date,
  paid_at: extra.paid_at ?? null,
  deleted_at: extra.deleted_at ?? null,
});

describe("daysUntil", () => {
  it("counts whole calendar days, negative in the past", () => {
    expect(daysUntil("2026-11-18", TODAY)).toBe(0);
    expect(daysUntil("2026-11-25", TODAY)).toBe(7);
    expect(daysUntil("2026-11-17", TODAY)).toBe(-1);
    expect(daysUntil("2027-01-01", "2026-12-31")).toBe(1);
  });
});

describe("open, overdue and due soon", () => {
  it("only an unpaid, undeleted debt is open", () => {
    expect(isOpenDebt(debt(null))).toBe(true);
    expect(isOpenDebt(debt(null, { paid_at: "2026-11-01T10:00:00Z" }))).toBe(false);
    expect(isOpenDebt(debt(null, { deleted_at: "2026-11-01T10:00:00Z" }))).toBe(false);
  });

  it("is overdue from the day after the due date", () => {
    expect(isOverdue(debt("2026-11-17"), TODAY)).toBe(true);
    expect(isOverdue(debt("2026-11-18"), TODAY)).toBe(false);
    expect(isOverdue(debt(null), TODAY)).toBe(false);
    expect(isOverdue(debt("2026-11-01", { paid_at: "2026-11-02T00:00:00Z" }), TODAY)).toBe(false);
  });

  it("is due soon from today up to seven days ahead", () => {
    expect(DUE_SOON_DAYS).toBe(7);
    expect(isDueSoon(debt("2026-11-18"), TODAY)).toBe(true);
    expect(isDueSoon(debt("2026-11-25"), TODAY)).toBe(true);
    expect(isDueSoon(debt("2026-11-26"), TODAY)).toBe(false);
    expect(isDueSoon(debt("2026-11-17"), TODAY)).toBe(false);
    expect(isDueSoon(debt(null), TODAY)).toBe(false);
    expect(isDueSoon(debt("2026-11-20", { deleted_at: "2026-11-10T00:00:00Z" }), TODAY)).toBe(false);
    expect(isDueSoon(debt("2026-11-21"), TODAY, 2)).toBe(false);
  });
});

describe("dueLabel", () => {
  it("says it in plain words", () => {
    expect(dueLabel("2026-11-18", TODAY)).toBe("due today");
    expect(dueLabel("2026-11-19", TODAY)).toBe("due tomorrow");
    expect(dueLabel("2026-11-21", TODAY)).toBe("due in 3 days");
    expect(dueLabel("2026-11-17", TODAY)).toBe("1 day overdue");
    expect(dueLabel("2026-11-08", TODAY)).toBe("10 days overdue");
  });
});

describe("sortByDueDate", () => {
  it("puts the earliest due date first and undated debts last, in their original order", () => {
    const a = { id: "a", due_date: null };
    const b = { id: "b", due_date: "2026-12-01" };
    const c = { id: "c", due_date: "2026-11-20" };
    const d = { id: "d", due_date: null };
    const e = { id: "e", due_date: "2026-11-20" };
    expect(sortByDueDate([a, b, c, d, e]).map((x) => x.id)).toEqual(["c", "e", "b", "a", "d"]);
  });
});
