import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  MONEY_VIEWS,
  MoneyViewList,
  isMoneyView,
  type MoneyView,
  type ViewAlert,
} from "./finance-navigation";

afterEach(cleanup);

function NavigationHarness({ alerts }: { alerts?: Partial<Record<MoneyView, ViewAlert>> }) {
  const [view, setView] = useState<MoneyView>("activity");
  return (
    <Tabs value={view} onValueChange={(v) => isMoneyView(v) && setView(v)}>
      <MoneyViewList alerts={alerts} />
      {MONEY_VIEWS.map((v) => (
        <TabsContent key={v.value} value={v.value}>
          {v.label} panel
        </TabsContent>
      ))}
    </Tabs>
  );
}

describe("Finance navigation", () => {
  it("opens on Activity, with no Home | Money switch", () => {
    render(<NavigationHarness />);
    expect(screen.getByRole("tab", { name: "Activity" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Activity panel")).toBeDefined();
    expect(screen.queryByRole("tab", { name: "Home" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Money" })).toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it.each(["Activity", "Wallet", "Budget", "Debt"])("opens the %s view", (label) => {
    render(<NavigationHarness />);
    fireEvent.click(screen.getByRole("tab", { name: label }));
    expect(screen.getByRole("tab", { name: label }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(`${label} panel`)).toBeDefined();
  });

  it("names the tab list for screen readers", () => {
    render(<NavigationHarness />);
    expect(screen.getByRole("tablist", { name: "Finance views" })).toBeDefined();
  });

  it("marks a view that needs attention in words as well as colour", () => {
    render(<NavigationHarness alerts={{ debts: "danger", budgets: "warning" }} />);
    expect(screen.getByRole("tab", { name: /Debt.*needs attention/ })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Budget.*needs attention/ })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Activity" })).toBeDefined();
    expect(document.querySelector(".finance-dot--danger")).not.toBeNull();
    expect(document.querySelector(".finance-dot--warning")).not.toBeNull();
  });

  it("accepts only known view names", () => {
    expect(isMoneyView("debts")).toBe(true);
    expect(isMoneyView("wallets")).toBe(true);
    expect(isMoneyView("home")).toBe(false);
    expect(isMoneyView("categories")).toBe(false);
    expect(isMoneyView(null)).toBe(false);
  });

  it("gives each view its own colour class", () => {
    render(<NavigationHarness />);
    expect(screen.getByRole("tab", { name: "Activity" }).className).toContain("finance-tab--activity");
    expect(screen.getByRole("tab", { name: "Wallet" }).className).toContain("finance-tab--wallets");
    expect(screen.getByRole("tab", { name: "Budget" }).className).toContain("finance-tab--budgets");
    expect(screen.getByRole("tab", { name: "Debt" }).className).toContain("finance-tab--debts");
  });
});
