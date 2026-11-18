import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AttentionCard, MonthCard } from "./finance-home";
import { formatAED } from "@/lib/format";

afterEach(cleanup);

const aed = (amount: number) => formatAED(amount).replace(/\s+/g, " ");

describe("MonthCard", () => {
  it("shows money in, money out, net and the saving rate", () => {
    render(
      <MonthCard
        monthLabel="November 2026"
        summary={{ moneyIn: 10000, moneyOut: 8000, net: 2000, savingRate: 20 }}
        onPrevMonth={() => {}}
        onNextMonth={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeDefined();
    expect(screen.getByText("Saving 20%")).toBeDefined();
    expect(screen.getByText(`+${aed(10000)}`)).toBeDefined();
    expect(screen.getByText(`−${aed(8000)}`)).toBeDefined();
    expect(screen.getByText(`+${aed(2000)}`)).toBeDefined();
    expect(screen.getByText("Net · Saved")).toBeDefined();
  });

  it("labels a deficit in words and with no income shows no rate", () => {
    render(
      <MonthCard
        monthLabel="October 2026"
        summary={{ moneyIn: 0, moneyOut: 300, net: -300, savingRate: null }}
        onPrevMonth={() => {}}
        onNextMonth={() => {}}
      />,
    );
    expect(screen.getByText("No income yet")).toBeDefined();
    expect(screen.getByText("Net · Deficit")).toBeDefined();
    // Money out and the net are both −300; zero money in carries no sign.
    expect(screen.getAllByText(`−${aed(300)}`)).toHaveLength(2);
    expect(screen.getByText(aed(0))).toBeDefined();
  });

  it("marks a negative saving rate as overspent and moves between months", () => {
    const prev = vi.fn();
    const next = vi.fn();
    render(
      <MonthCard
        monthLabel="September 2026"
        summary={{ moneyIn: 1000, moneyOut: 1500, net: -500, savingRate: -50 }}
        onPrevMonth={prev}
        onNextMonth={next}
      />,
    );
    expect(screen.getByText("Overspent 50%")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(prev).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("AttentionCard", () => {
  it("says all clear when the list is empty", () => {
    render(<AttentionCard items={[]} onOpen={() => {}} />);
    expect(screen.getByText(/All clear/)).toBeDefined();
  });

  it("opens the right Money view from each item", () => {
    const onOpen = vi.fn();
    render(
      <AttentionCard
        items={[
          { key: "debt-1", level: "danger", title: "Bank — 2 days overdue", detail: "You owe AED 10", target: "debts" },
          { key: "budget-1", level: "warning", title: "Food budget at 80%", detail: "AED 80 of AED 100", target: "budgets" },
        ]}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByText("2")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Food budget at 80%/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bank — 2 days overdue/ }));
    expect(onOpen.mock.calls).toEqual([["budgets"], ["debts"]]);
    expect(screen.getByRole("button", { name: /Bank — 2 days overdue/ }).textContent).toContain("Urgent.");
  });
});
