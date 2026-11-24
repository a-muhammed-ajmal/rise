import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MotivationalQuote, quoteForDay } from "./motivational-quote";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("quoteForDay", () => {
  it("returns the same quote for the same day", () => {
    expect(quoteForDay("2026-11-24")).toBe(quoteForDay("2026-11-24"));
  });

  it("steps to a different quote the next day", () => {
    expect(quoteForDay("2026-11-25")).not.toBe(quoteForDay("2026-11-24"));
  });

  it("works for dates before 1970 too", () => {
    expect(quoteForDay("1969-12-31").length).toBeGreaterThan(0);
  });

  it("carries no emoji — the icon beside it replaces them", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (let i = 0; i < 120; i++) {
      const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      expect(quoteForDay(day)).not.toMatch(emoji);
    }
  });
});

describe("MotivationalQuote", () => {
  it("shows the given day's quote in a labelled region", () => {
    render(<MotivationalQuote date="2026-11-24" />);
    expect(
      screen.getByRole("region", { name: "Daily motivation" }).textContent,
    ).toBe(quoteForDay("2026-11-24"));
  });

  it("defaults to today's Dubai date", () => {
    vi.useFakeTimers();
    // 21:00 UTC on the 23rd is already the 24th in Dubai.
    vi.setSystemTime(new Date("2026-11-23T21:00:00Z"));
    render(<MotivationalQuote />);
    expect(
      screen.getByRole("region", { name: "Daily motivation" }).textContent,
    ).toBe(quoteForDay("2026-11-24"));
  });
});
