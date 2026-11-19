import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { NetWorthCard, type HeroWallet } from "./net-worth-card";
import { summarizeNetWorth } from "@/lib/finance/net-worth";
import { formatAED } from "@/lib/format";

afterEach(cleanup);

const open = { paid_at: null, deleted_at: null };

// Testing Library collapses the non-breaking space Intl puts after "AED".
const aed = (amount: number) => formatAED(amount).replace(/\s+/g, " ");

const WALLETS: HeroWallet[] = [
  { id: "w1", name: "Botim", balance: 512.5, color: "#7C3AED" },
  { id: "w2", name: "Mashreq", balance: 1000.16, color: null },
  { id: "w3", name: "Cash", balance: 200, color: "#10B981" },
];
const WALLET_TOTAL = 1712.66;

function tile(label: RegExp) {
  // The label sits in spans inside the tile, which is a <button> or <div>.
  const box = screen.getByText(label).closest<HTMLElement>("button, div");
  if (!box) throw new Error("tile missing");
  return within(box);
}

describe("NetWorthCard", () => {
  it("shows the headline, every account with its exact balance, and the total available", () => {
    const summary = summarizeNetWorth(WALLET_TOTAL, [
      { type: "they_owe", amount: 300, ...open },
      { type: "i_owe", amount: 200, ...open },
      { type: "they_owe", amount: 150, ...open },
    ]);
    render(<NetWorthCard summary={summary} wallets={WALLETS} />);

    expect(screen.getByRole("heading", { name: "Net worth" })).toBeDefined();
    expect(screen.getByTestId("net-worth-total").textContent).toBe(aed(1962.66));

    const list = within(screen.getByRole("list", { name: "Wallet balances" }));
    const rows = list.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("Botim")).toBeDefined();
    expect(within(rows[0]).getByText(aed(512.5))).toBeDefined();
    expect(within(rows[1]).getByText("Mashreq")).toBeDefined();
    expect(within(rows[1]).getByText(aed(1000.16))).toBeDefined();
    expect(within(rows[2]).getByText("Cash")).toBeDefined();
    expect(within(rows[2]).getByText(aed(200))).toBeDefined();

    expect(screen.getByText("Total available")).toBeDefined();
    expect(screen.getByTestId("wallet-total").textContent?.replace(/\s+/g, " ")).toBe(aed(WALLET_TOTAL));
  });

  it("shows money owed to you and money you owe with their counts and signs", () => {
    const summary = summarizeNetWorth(WALLET_TOTAL, [
      { type: "they_owe", amount: 300, ...open },
      { type: "i_owe", amount: 200, ...open },
      { type: "they_owe", amount: 150, ...open },
    ]);
    render(<NetWorthCard summary={summary} wallets={WALLETS} />);

    expect(tile(/Owed to you \(2\)/).getByText(`+${aed(450)}`)).toBeDefined();
    expect(tile(/You owe \(1\)/).getByText(`−${aed(200)}`)).toBeDefined();
  });

  it("no longer explains the sum in a sentence under the headline", () => {
    render(<NetWorthCard summary={summarizeNetWorth(10, [])} wallets={WALLETS} />);
    expect(screen.queryByText(/Wallets \+ money owed to you/)).toBeNull();
    expect(screen.queryByText(/you owe more than you hold/)).toBeNull();
  });

  it("labels a negative position explicitly instead of relying on colour", () => {
    const summary = summarizeNetWorth(100, [{ type: "i_owe", amount: 600, ...open }]);
    render(<NetWorthCard summary={summary} wallets={[]} />);

    const total = screen.getByTestId("net-worth-total");
    expect(total.textContent).toBe(aed(-500));
    // Smaller on phones so long totals fit; the full hero size from md.
    expect(total.className).toContain("text-metric");
    expect(total.className).toContain("md:text-hero");
    expect(screen.getByText("Below zero")).toBeDefined();
  });

  it("shows unsigned zeros and an empty-state line with no wallets or debts", () => {
    render(<NetWorthCard summary={summarizeNetWorth(0, [])} wallets={[]} />);

    expect(screen.getByText("Owed to you")).toBeDefined();
    expect(screen.getByText("You owe")).toBeDefined();
    expect(screen.getByText("No active wallets yet.")).toBeDefined();
    // Net worth, total available, owed to you, you owe.
    expect(screen.getAllByText(aed(0))).toHaveLength(4);
  });

  it("opens the debts view from either debt tile when a handler is given", () => {
    const onViewDebts = vi.fn();
    const { rerender } = render(
      <NetWorthCard summary={summarizeNetWorth(10, [])} wallets={WALLETS} />,
    );
    expect(screen.queryByRole("button")).toBeNull();

    rerender(
      <NetWorthCard summary={summarizeNetWorth(10, [])} wallets={WALLETS} onViewDebts={onViewDebts} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Owed to you/ }));
    fireEvent.click(screen.getByRole("button", { name: /You owe/ }));
    expect(onViewDebts).toHaveBeenCalledTimes(2);
  });
});
