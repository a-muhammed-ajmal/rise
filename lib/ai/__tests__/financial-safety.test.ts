import { describe, expect, it } from "vitest";
import {
  MATERIAL_AMOUNT_AED,
  evaluateFinancialGate,
  isMoneyTool,
} from "../financial-safety";

describe("isMoneyTool", () => {
  it("recognises the money-writing tools", () => {
    expect(isMoneyTool("log_expense")).toBe(true);
    expect(isMoneyTool("log_income")).toBe(true);
  });

  it("ignores everything else", () => {
    expect(isMoneyTool("create_task")).toBe(false);
    expect(isMoneyTool("update_transaction")).toBe(false);
  });
});

describe("evaluateFinancialGate", () => {
  const wellFormed = { amount: 12, category: "Coffee", payment_method_id: "pm-1" };

  it("passes a non-money tool straight through", () => {
    expect(evaluateFinancialGate("create_task", { title: "x" }, 3)).toEqual({
      requiresApproval: false,
    });
  });

  it("auto-executes a small, fully-specified expense", () => {
    expect(evaluateFinancialGate("log_expense", wellFormed, 2)).toEqual({
      requiresApproval: false,
    });
  });

  it("auto-executes when the user has a single wallet and none was named", () => {
    expect(
      evaluateFinancialGate("log_expense", { amount: 12, category: "Coffee" }, 1),
    ).toEqual({ requiresApproval: false });
  });

  describe("material amounts", () => {
    it("requires approval above the threshold", () => {
      const decision = evaluateFinancialGate(
        "log_expense",
        { ...wellFormed, amount: MATERIAL_AMOUNT_AED + 1 },
        1,
      );
      expect(decision).toMatchObject({
        requiresApproval: true,
        reason: "material_amount",
      });
    });

    it("does not require approval exactly at the threshold", () => {
      expect(
        evaluateFinancialGate(
          "log_expense",
          { ...wellFormed, amount: MATERIAL_AMOUNT_AED },
          1,
        ),
      ).toEqual({ requiresApproval: false });
    });

    it("applies to income as well as expenses", () => {
      const decision = evaluateFinancialGate(
        "log_income",
        { ...wellFormed, amount: 9000 },
        1,
      );
      expect(decision).toMatchObject({
        requiresApproval: true,
        reason: "material_amount",
      });
      if (decision.requiresApproval) {
        expect(decision.summary).toContain("income");
        expect(decision.summary).toContain("9000");
      }
    });
  });

  describe("invalid amounts", () => {
    it.each([
      ["zero", 0],
      ["negative", -50],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
    ])("requires approval for %s", (_label, amount) => {
      expect(
        evaluateFinancialGate("log_expense", { ...wellFormed, amount }, 1),
      ).toMatchObject({ requiresApproval: true, reason: "invalid_amount" });
    });

    it("requires approval when amount is not a number at all", () => {
      expect(
        evaluateFinancialGate("log_expense", { ...wellFormed, amount: "40" }, 1),
      ).toMatchObject({ requiresApproval: true, reason: "invalid_amount" });
    });
  });

  describe("ambiguous payloads", () => {
    it("requires approval when the category is missing", () => {
      expect(
        evaluateFinancialGate(
          "log_expense",
          { amount: 20, payment_method_id: "pm-1" },
          1,
        ),
      ).toMatchObject({ requiresApproval: true, reason: "missing_category" });
    });

    it("requires approval when the category is blank", () => {
      expect(
        evaluateFinancialGate("log_expense", { ...wellFormed, category: "   " }, 1),
      ).toMatchObject({ requiresApproval: true, reason: "missing_category" });
    });

    it("requires approval when several wallets exist and none was chosen", () => {
      const decision = evaluateFinancialGate(
        "log_expense",
        { amount: 20, category: "Coffee" },
        3,
      );
      expect(decision).toMatchObject({
        requiresApproval: true,
        reason: "ambiguous_payment_method",
      });
    });
  });
});
