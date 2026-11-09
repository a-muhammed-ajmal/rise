import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { NetWorthCard } from "./net-worth-card";
import { summarizeNetWorth } from "@/lib/finance/net-worth";
import { formatAED } from "@/lib/format";

afterEach(cleanup);

const open = { paid_at: null, deleted_at: null };

// Testing Library collapses the non-breaking space Intl puts after "AED".
const aed = (amount: number) => formatAED(amount).replace(/\s+/g, " ");

function row(label: RegExp) {
  const term = screen.getByText(label);
  const wrapper = term.parentElement;
  if (!wrapper) throw new Error("row wrapper missing");
  return within(wrapper);
}

describe("NetWorthCard", () => {
  it("shows the headline net worth and each part of the sum", () => {
    const summary = summarizeNetWorth(2312.96, [
      { type: "they_owe", amount: 900, ...open },
      { type: "i_owe", amount: 1400, ...open },
      { type: "they_owe", amount: 200, ...open },
    ]);
    render(<NetWorthCard summary={summary} />);

    expect(screen.getByRole("heading", { name: "Net worth" })).toBeDefined();
    expect(screen.getByTestId("net-worth-total").textContent).toBe(aed(2012.96));
    expect(row(/Wallet balance/).getByText(aed(2312.96))).toBeDefined();
    expect(
      row(/Owed to you \(2\)/).getByText(`+${aed(1100)}`),
    ).toBeDefined();
    expect(row(/You owe \(1\)/).getByText(`−${aed(1400)}`)).toBeDefined();
    expect(screen.queryByText(/you owe more than you hold/)).toBeNull();
  });

  it("labels a negative position explicitly instead of relying on colour", () => {
    const summary = summarizeNetWorth(100, [
      { type: "i_owe", amount: 600, ...open },
    ]);
    render(<NetWorthCard summary={summary} />);

    const total = screen.getByTestId("net-worth-total");
    expect(total.textContent).toBe(aed(-500));
    // Regression: the danger colour must not knock out the metric size class.
    expect(total.className).toContain("text-metric");
    expect(total.className).toContain("text-[var(--color-danger)]");
    expect(
      screen.getByText("Negative — you owe more than you hold"),
    ).toBeDefined();
  });

  it("shows unsigned zeros and no counts when there are no debts", () => {
    render(<NetWorthCard summary={summarizeNetWorth(0, [])} />);

    expect(screen.getByText("Owed to you")).toBeDefined();
    expect(screen.getByText("You owe")).toBeDefined();
    expect(screen.getAllByText(aed(0))).toHaveLength(4);
  });

  it("opens the debts view from the card when a handler is given", () => {
    const onViewDebts = vi.fn();
    const { rerender } = render(
      <NetWorthCard summary={summarizeNetWorth(10, [])} />,
    );
    expect(screen.queryByRole("button", { name: /Manage debts/ })).toBeNull();

    rerender(
      <NetWorthCard
        summary={summarizeNetWorth(10, [])}
        onViewDebts={onViewDebts}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Manage debts/ }));
    expect(onViewDebts).toHaveBeenCalledTimes(1);
  });
});
