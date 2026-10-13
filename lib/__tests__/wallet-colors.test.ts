import { describe, it, expect } from "vitest";
import { WALLET_COLORS, walletColor, walletPickerColor, walletShare } from "../wallet-colors";

describe("WALLET_COLORS", () => {
  it("contains no green or red swatch", () => {
    const lower = WALLET_COLORS.map((c) => c.toLowerCase());
    expect(lower).not.toContain("#10b981");
    expect(lower).not.toContain("#ef4444");
  });
});

describe("walletColor", () => {
  it("remaps legacy green and red, case-insensitively", () => {
    expect(walletColor("#10b981")).toBe("#0891B2");
    expect(walletColor("#EF4444")).toBe("#DB2777");
  });

  it("lifts brand navy to the theme-aware action token", () => {
    expect(walletColor("#0C2443")).toBe("var(--brand-action)");
  });

  it("passes other colors through unchanged", () => {
    expect(walletColor("#7C3AED")).toBe("#7C3AED");
  });

  it("falls back to a non-navy palette hue by index", () => {
    expect(walletColor(null, 0)).toBe(WALLET_COLORS[1]);
    expect(walletColor(undefined, 1)).toBe(WALLET_COLORS[2]);
    expect(walletColor("", 7)).toBe(WALLET_COLORS[1]);
    expect(walletColor(null, -2)).toBe(WALLET_COLORS[3]);
    expect(walletColor(null)).toBe(WALLET_COLORS[1]);
  });
});

describe("walletPickerColor", () => {
  it("maps legacy values and keeps null/others", () => {
    expect(walletPickerColor("#10b981")).toBe("#0891B2");
    expect(walletPickerColor("#2563EB")).toBe("#2563EB");
    expect(walletPickerColor(null)).toBeNull();
  });
});

describe("walletShare", () => {
  it("returns the rounded percentage of the total", () => {
    expect(walletShare(4047.14, 4070.13)).toBe(99);
    expect(walletShare(2.99, 4070.13)).toBe(0);
    expect(walletShare(50, 200)).toBe(25);
  });

  it("is 0 for non-positive balances or totals and capped at 100", () => {
    expect(walletShare(-10, 100)).toBe(0);
    expect(walletShare(10, 0)).toBe(0);
    expect(walletShare(10, -5)).toBe(0);
    expect(walletShare(150, 100)).toBe(100);
  });
});
