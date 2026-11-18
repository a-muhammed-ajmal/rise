import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  FinanceSectionList,
  MONEY_VIEWS,
  MoneyViewList,
  isFinanceSection,
  isMoneyView,
  type FinanceSection,
  type MoneyView,
} from "./finance-navigation";

afterEach(cleanup);

function NavigationHarness() {
  const [section, setSection] = useState<FinanceSection>("home");
  const [view, setView] = useState<MoneyView>("activity");
  return (
    <Tabs value={section} onValueChange={(v) => isFinanceSection(v) && setSection(v)}>
      <FinanceSectionList />
      <TabsContent value="home">Home panel</TabsContent>
      <TabsContent value="money">
        <Tabs value={view} onValueChange={(v) => isMoneyView(v) && setView(v)}>
          <MoneyViewList />
          {MONEY_VIEWS.map((v) => (
            <TabsContent key={v.value} value={v.value}>
              {v.label} panel
            </TabsContent>
          ))}
        </Tabs>
      </TabsContent>
    </Tabs>
  );
}

describe("Finance navigation", () => {
  it("opens on Home and switches to Money", () => {
    render(<NavigationHarness />);
    expect(screen.getByRole("tab", { name: "Home" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Home panel")).toBeDefined();

    fireEvent.click(screen.getByRole("tab", { name: "Money" }));
    expect(screen.getByRole("tab", { name: "Money" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Activity panel")).toBeDefined();
    expect(screen.queryByText("Home panel")).toBeNull();
  });

  it.each(["Activity", "Wallets", "Budgets", "Debts"])("opens the %s view inside Money", (label) => {
    render(<NavigationHarness />);
    fireEvent.click(screen.getByRole("tab", { name: "Money" }));
    fireEvent.click(screen.getByRole("tab", { name: label }));
    expect(screen.getByRole("tab", { name: label }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(`${label} panel`)).toBeDefined();
  });

  it("names both tab lists for screen readers", () => {
    render(<NavigationHarness />);
    expect(screen.getByRole("tablist", { name: "Finance sections" })).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: "Money" }));
    expect(screen.getByRole("tablist", { name: "Money views" })).toBeDefined();
  });

  it("accepts only known section and view names", () => {
    expect(isFinanceSection("home")).toBe(true);
    expect(isFinanceSection("money")).toBe(true);
    expect(isFinanceSection("overview")).toBe(false);
    expect(isMoneyView("debts")).toBe(true);
    expect(isMoneyView("categories")).toBe(false);
    expect(isMoneyView(null)).toBe(false);
  });
});
