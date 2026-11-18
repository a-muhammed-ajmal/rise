import { describe, expect, it } from "vitest";
import { dayLabel, flowOf, groupByDay, signedAmount } from "../activity";
import { formatAED } from "@/lib/format";

const TODAY = "2026-11-18";

describe("dayLabel", () => {
  it("names today and yesterday, otherwise weekday and DD/MM/YYYY", () => {
    expect(dayLabel("2026-11-18", TODAY)).toBe("Today");
    expect(dayLabel("2026-11-17", TODAY)).toBe("Yesterday");
    expect(dayLabel("2026-11-16", TODAY)).toBe("Mon, 16/11/2026");
    expect(dayLabel("2026-11-19", TODAY)).toBe("Thu, 19/11/2026");
  });
});

describe("groupByDay", () => {
  it("puts the newest day first and the latest entry first inside a day", () => {
    const rows = [
      { id: "a", date: "2026-11-16", created_at: "2026-11-16T09:00:00Z" },
      { id: "b", date: "2026-11-18", created_at: "2026-11-18T08:00:00Z" },
      { id: "c", date: "2026-11-18", created_at: "2026-11-18T12:00:00Z" },
      { id: "d", date: "2026-11-16", created_at: "2026-11-16T10:00:00Z" },
    ];
    const groups = groupByDay(rows);
    expect(groups.map(([day]) => day)).toEqual(["2026-11-18", "2026-11-16"]);
    expect(groups[0][1].map((r) => r.id)).toEqual(["c", "b"]);
    expect(groups[1][1].map((r) => r.id)).toEqual(["d", "a"]);
  });

  it("does not reorder the caller's array", () => {
    const rows = [
      { date: "2026-11-01", created_at: "a" },
      { date: "2026-11-02", created_at: "b" },
    ];
    groupByDay(rows);
    expect(rows[0].date).toBe("2026-11-01");
  });

  it("is empty for no rows", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("flow and sign", () => {
  it("shows income as in, expenses as out, and moves between wallets as neutral", () => {
    expect(flowOf({ type: "income", amount: 5 })).toBe("in");
    expect(flowOf({ type: "expense", amount: 5 })).toBe("out");
    expect(flowOf({ type: "transfer", amount: 5 })).toBe("neutral");
    expect(flowOf({ type: "adjustment", amount: -5 })).toBe("neutral");
  });

  it("signs each amount by its direction", () => {
    expect(signedAmount({ type: "income", amount: 12.5 })).toBe(`+${formatAED(12.5)}`);
    expect(signedAmount({ type: "expense", amount: 12.5 })).toBe(`−${formatAED(12.5)}`);
    expect(signedAmount({ type: "transfer", amount: 300 })).toBe(formatAED(300));
    expect(signedAmount({ type: "adjustment", amount: 40 })).toBe(`+${formatAED(40)}`);
    expect(signedAmount({ type: "adjustment", amount: -40 })).toBe(`−${formatAED(40)}`);
    expect(signedAmount({ type: "adjustment", amount: 0 })).toBe(formatAED(0));
  });
});
