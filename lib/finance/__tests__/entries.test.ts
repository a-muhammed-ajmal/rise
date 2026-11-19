import { describe, expect, it } from "vitest";
import {
  DEBT_CATEGORY,
  TRANSFER_FEE_CATEGORY,
  buildTransferRows,
  debtMovementRow,
  newDebtDelta,
  newDebtLabel,
  parseAmount,
  planRepayment,
  repaymentDelta,
  repaymentLabel,
  transferTotal,
} from "../entries";

const BASE = {
  userId: "u1",
  fromId: "w-botim",
  toId: "w-mashreq",
  fromName: "Botim",
  toName: "Mashreq",
  note: "",
  date: "2026-11-20",
};

describe("parseAmount", () => {
  it("reads positive amounts and rounds to fils", () => {
    expect(parseAmount("500")).toBe(500);
    expect(parseAmount(" 12.345 ")).toBe(12.35);
    expect(parseAmount("0.1")).toBe(0.1);
  });

  it("rejects blank, non-numeric, negative and zero amounts", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("Infinity")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("0.001")).toBeNull();
  });

  it("accepts zero only when asked to", () => {
    expect(parseAmount("0", { allowZero: true })).toBe(0);
    expect(parseAmount("-0", { allowZero: true })).toBe(0);
    expect(parseAmount("-1", { allowZero: true })).toBeNull();
  });
});

describe("transferTotal", () => {
  it("adds the fee to what leaves the source wallet", () => {
    expect(transferTotal(500, 5)).toBe(505);
    expect(transferTotal(0.1, 0.2)).toBe(0.3);
  });

  it("never lets a negative fee reduce the total", () => {
    expect(transferTotal(500, -5)).toBe(500);
  });
});

describe("buildTransferRows", () => {
  it("writes only the transfer when there is no fee", () => {
    const rows = buildTransferRows({ ...BASE, amount: 500, fee: 0 });
    expect(rows).toEqual([
      {
        user_id: "u1",
        type: "transfer",
        amount: 500,
        category: "Transfer",
        description: "Botim → Mashreq",
        date: "2026-11-20",
        from_payment_method_id: "w-botim",
        to_payment_method_id: "w-mashreq",
        payment_method_id: null,
        tags: [],
      },
    ]);
  });

  it("adds the fee as an expense on the source wallet", () => {
    const rows = buildTransferRows({ ...BASE, amount: 500, fee: 5.25, note: "  Rent top-up " });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "transfer", amount: 500, description: "Rent top-up" });
    expect(rows[1]).toEqual({
      user_id: "u1",
      type: "expense",
      amount: 5.25,
      category: TRANSFER_FEE_CATEGORY,
      description: "Fee · Botim → Mashreq",
      date: "2026-11-20",
      payment_method: "Botim",
      payment_method_id: "w-botim",
      tags: [],
    });
  });

  it("ignores a fee that rounds to nothing", () => {
    expect(buildTransferRows({ ...BASE, amount: 10, fee: 0.001 })).toHaveLength(1);
  });
});

describe("debt wallet movements", () => {
  it("takes money out when lending and puts it in when borrowing", () => {
    expect(newDebtDelta("they_owe", 450)).toBe(-450);
    expect(newDebtDelta("i_owe", 200)).toBe(200);
  });

  it("puts money in when repaid and takes it out when paying back", () => {
    expect(repaymentDelta("they_owe", 100)).toBe(100);
    expect(repaymentDelta("i_owe", 100)).toBe(-100);
  });

  it("names each movement in words", () => {
    expect(newDebtLabel("they_owe", "Ahmed")).toBe("Lent to Ahmed");
    expect(newDebtLabel("i_owe", "Bank")).toBe("Borrowed from Bank");
    expect(repaymentLabel("they_owe", "Ahmed")).toBe("Repayment from Ahmed");
    expect(repaymentLabel("i_owe", "Bank")).toBe("Repaid to Bank");
  });

  it("builds a signed adjustment in the Debt category", () => {
    expect(
      debtMovementRow({
        userId: "u1",
        walletId: "w-cash",
        walletName: "Cash",
        delta: -450,
        description: "Lent to Ahmed",
        date: "2026-11-20",
      }),
    ).toEqual({
      user_id: "u1",
      type: "adjustment",
      amount: -450,
      category: DEBT_CATEGORY,
      description: "Lent to Ahmed",
      date: "2026-11-20",
      payment_method: "Cash",
      payment_method_id: "w-cash",
      tags: [],
    });
  });
});

describe("planRepayment", () => {
  it("settles the debt when the whole balance is paid", () => {
    expect(planRepayment(450, 450)).toEqual({ ok: true, settles: true, remaining: 0 });
    // Float noise never leaves a phantom 0.00000001 outstanding.
    expect(planRepayment(0.3, 0.1 + 0.2)).toEqual({ ok: true, settles: true, remaining: 0 });
  });

  it("leaves the rest outstanding for a part payment", () => {
    expect(planRepayment(450, 100)).toEqual({ ok: true, settles: false, remaining: 350 });
    expect(planRepayment(100, 33.33)).toEqual({ ok: true, settles: false, remaining: 66.67 });
  });

  it("refuses more than is owed", () => {
    expect(planRepayment(450, 450.01)).toEqual({ ok: false, error: "That is more than is still owed." });
  });

  it("refuses zero, negative and non-numeric amounts", () => {
    const refused = { ok: false, error: "Enter an amount above zero." };
    expect(planRepayment(450, 0)).toEqual(refused);
    expect(planRepayment(450, -10)).toEqual(refused);
    expect(planRepayment(450, Number.NaN)).toEqual(refused);
  });
});
