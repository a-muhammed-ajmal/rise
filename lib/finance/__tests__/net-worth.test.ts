import { describe, expect, it } from "vitest";
import { summarizeNetWorth, type NetWorthDebt } from "../net-worth";

const debt = (
  type: NetWorthDebt["type"],
  amount: number,
  extra: Partial<NetWorthDebt> = {},
): NetWorthDebt => ({
  type,
  amount,
  paid_at: null,
  deleted_at: null,
  ...extra,
});

describe("summarizeNetWorth", () => {
  it("adds money owed to you and subtracts money you owe", () => {
    // The live account at the time of writing: 3 wallets totalling 2,312.96,
    // Navaz owes 900, Rijil owes 200, and 1,400 is owed to Afridi.
    const summary = summarizeNetWorth(2312.96, [
      debt("they_owe", 900),
      debt("i_owe", 1400),
      debt("they_owe", 200),
    ]);
    expect(summary).toEqual({
      walletBalance: 2312.96,
      owedToYou: 1100,
      youOwe: 1400,
      netWorth: 2012.96,
      owedToYouCount: 2,
      youOweCount: 1,
    });
  });

  it("equals the wallet balance when there are no debts", () => {
    expect(summarizeNetWorth(500, [])).toMatchObject({
      walletBalance: 500,
      owedToYou: 0,
      youOwe: 0,
      netWorth: 500,
      owedToYouCount: 0,
      youOweCount: 0,
    });
  });

  it("goes negative when you owe more than you hold", () => {
    const summary = summarizeNetWorth(100, [debt("i_owe", 350.5)]);
    expect(summary.netWorth).toBe(-250.5);
    expect(summary.youOwe).toBe(350.5);
  });

  it("handles a negative wallet balance (overdrawn)", () => {
    expect(summarizeNetWorth(-50, [debt("they_owe", 20)]).netWorth).toBe(-30);
  });

  it("ignores debts that are paid or in the recycle bin", () => {
    const summary = summarizeNetWorth(1000, [
      debt("they_owe", 300, { paid_at: "2026-11-01T10:00:00Z" }),
      debt("i_owe", 400, { deleted_at: "2026-11-02T10:00:00Z" }),
      debt("i_owe", 100),
    ]);
    expect(summary).toMatchObject({
      owedToYou: 0,
      youOwe: 100,
      netWorth: 900,
      owedToYouCount: 0,
      youOweCount: 1,
    });
  });

  it("rounds away floating-point noise to whole fils", () => {
    const summary = summarizeNetWorth(0.1, [debt("they_owe", 0.2)]);
    expect(summary.netWorth).toBe(0.3);
    expect(summary.owedToYou).toBe(0.2);
  });

  it("never reports negative zero for an exactly balanced position", () => {
    const summary = summarizeNetWorth(250, [debt("i_owe", 250)]);
    expect(Object.is(summary.netWorth, 0)).toBe(true);
    expect(Object.is(summarizeNetWorth(-0, []).walletBalance, 0)).toBe(true);
  });

  it("skips amounts that are not finite numbers", () => {
    const summary = summarizeNetWorth(Number.NaN, [
      debt("they_owe", Number.NaN),
      debt("i_owe", Number.POSITIVE_INFINITY),
      debt("they_owe", 40),
    ]);
    expect(summary).toMatchObject({
      walletBalance: 0,
      owedToYou: 40,
      youOwe: 0,
      netWorth: 40,
      owedToYouCount: 1,
      youOweCount: 0,
    });
  });
});
