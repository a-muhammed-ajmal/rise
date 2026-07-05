import { describe, it, expect } from "vitest";
import { sumExpenses } from "../finance";

describe("sumExpenses", () => {
  it("returns 0 for an empty array", () => {
    expect(sumExpenses([])).toBe(0);
  });

  it("sums a single expense", () => {
    expect(sumExpenses([{ type: "expense", amount: 45.5 }])).toBe(45.5);
  });

  it("sums multiple expenses", () => {
    expect(
      sumExpenses([
        { type: "expense", amount: 100 },
        { type: "expense", amount: 24.25 },
        { type: "expense", amount: 0.75 },
      ]),
    ).toBe(125);
  });

  it("ignores income, transfer, and adjustment transactions", () => {
    expect(
      sumExpenses([
        { type: "income", amount: 5000 },
        { type: "expense", amount: 80 },
        { type: "transfer", amount: 300 },
        { type: "adjustment", amount: 12 },
      ]),
    ).toBe(80);
  });

  it("returns 0 when no expenses are present", () => {
    expect(
      sumExpenses([
        { type: "income", amount: 1000 },
        { type: "transfer", amount: 50 },
      ]),
    ).toBe(0);
  });

  it("sums decimal amounts without floating-point surprises", () => {
    expect(
      sumExpenses([
        { type: "expense", amount: 0.1 },
        { type: "expense", amount: 0.2 },
      ]),
    ).toBeCloseTo(0.3);
  });
});
