import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatAED,
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeDate,
  todayISO,
  todayDOW,
  currentHourDubai,
  parseDate,
  display12h,
} from "../format";

describe("formatAED", () => {
  it("formats whole numbers with two decimals", () => {
    const result = formatAED(100);
    expect(result).toContain("100.00");
    expect(result).toContain("AED");
  });

  it("formats decimal amounts", () => {
    const result = formatAED(49.5);
    expect(result).toContain("49.50");
  });

  it("formats zero", () => {
    const result = formatAED(0);
    expect(result).toContain("0.00");
  });

  it("formats large amounts with grouping", () => {
    const result = formatAED(1234567.89);
    expect(result).toContain("1,234,567.89");
  });

  it("formats negative amounts", () => {
    const result = formatAED(-250.75);
    expect(result).toContain("250.75");
  });
});

describe("formatDate", () => {
  it("formats ISO date string to DD/MM/YYYY", () => {
    expect(formatDate("2026-06-23")).toBe("23/06/2026");
  });

  it("formats date with time component", () => {
    expect(formatDate("2026-01-15T10:30:00Z")).toBe("15/01/2026");
  });

  it("handles end of year", () => {
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
  });
});

describe("formatTime", () => {
  it("formats to 12-hour time with AM", () => {
    expect(formatTime("2026-06-23T09:05:00")).toBe("09:05 AM");
  });

  it("formats to 12-hour time with PM", () => {
    expect(formatTime("2026-06-23T14:30:00")).toBe("02:30 PM");
  });

  it("formats midnight", () => {
    expect(formatTime("2026-06-23T00:00:00")).toBe("12:00 AM");
  });

  it("formats noon", () => {
    expect(formatTime("2026-06-23T12:00:00")).toBe("12:00 PM");
  });
});

describe("formatDateTime", () => {
  it("combines date and time formatting", () => {
    expect(formatDateTime("2026-06-23T14:30:00")).toBe("23/06/2026 02:30 PM");
  });

  it("handles morning time", () => {
    expect(formatDateTime("2026-01-01T08:15:00")).toBe("01/01/2026 08:15 AM");
  });
});

describe("formatRelativeDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Today" for today\'s date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T12:00:00"));
    expect(formatRelativeDate("2026-06-23")).toBe("Today");
  });

  it('returns "Yesterday" for yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T12:00:00"));
    expect(formatRelativeDate("2026-06-22")).toBe("Yesterday");
  });

  it('returns "Tomorrow" for tomorrow', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T12:00:00"));
    expect(formatRelativeDate("2026-06-24")).toBe("Tomorrow");
  });

  it("returns DD/MM/YYYY for other dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T12:00:00"));
    expect(formatRelativeDate("2026-07-01")).toBe("01/07/2026");
  });
});

describe("todayISO", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns YYYY-MM-DD for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T15:30:00"));
    expect(todayISO()).toBe("2026-06-23");
  });

  it("matches ISO date format", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("parseDate", () => {
  it("parses ISO date string to Date object", () => {
    const date = parseDate("2026-06-23");
    expect(date).toBeInstanceOf(Date);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(5); // 0-indexed
    expect(date.getDate()).toBe(23);
  });

  it("parses ISO datetime string", () => {
    const date = parseDate("2026-06-23T14:30:00Z");
    expect(date).toBeInstanceOf(Date);
  });
});

describe("todayDOW", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the day of week for today in Asia/Dubai", () => {
    // 2026-06-23 is a Tuesday
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T15:30:00Z"));
    expect(todayDOW()).toBe(2);
  });

  it("rolls over correctly near the Dubai midnight boundary", () => {
    // 2026-06-23T21:00:00Z is 2026-06-24T01:00 in Dubai (UTC+4) — Wednesday
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T21:00:00Z"));
    expect(todayDOW()).toBe(3);
  });
});

describe("currentHourDubai", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current hour in Asia/Dubai (UTC+4)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T10:00:00Z"));
    expect(currentHourDubai()).toBe(14);
  });

  it("wraps past midnight correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T21:00:00Z"));
    expect(currentHourDubai()).toBe(1);
  });
});

describe("display12h", () => {
  it("formats a morning time", () => {
    expect(display12h("09:05")).toBe("9:05 AM");
  });

  it("formats an afternoon time", () => {
    expect(display12h("14:30")).toBe("2:30 PM");
  });

  it("formats midnight as 12 AM", () => {
    expect(display12h("00:00")).toBe("12:00 AM");
  });

  it("formats noon as 12 PM", () => {
    expect(display12h("12:00")).toBe("12:00 PM");
  });

  it("ignores a trailing seconds component", () => {
    expect(display12h("14:30:00")).toBe("2:30 PM");
  });
});
