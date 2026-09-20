import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { FinanceNavigation, type FinanceTab } from "./finance-navigation";

afterEach(cleanup);

function NavigationHarness() {
  const [value, setValue] = useState<FinanceTab>("overview");
  return <FinanceNavigation value={value} onChange={setValue} />;
}

describe("FinanceNavigation", () => {
  it.each(["Overview", "Transactions", "Wallets"])("opens the %s view", (label) => {
    render(<NavigationHarness />);
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByRole("button", { name: label }).getAttribute("aria-current")).toBe("page");
  });

  it.each(["Transfers", "Budgets", "Debts", "Categories"])("keeps %s reachable and shows the selected view", async (label) => {
    render(<NavigationHarness />);
    fireEvent.click(screen.getByRole("button", { name: "More finance views" }));
    const item = await screen.findByRole("menuitem", { name: label });
    fireEvent.click(item);
    await waitFor(() => expect(screen.getByRole("button", { name: `${label} finance views` })).toBeDefined());
    expect(screen.getByRole("button", { name: "Overview" }).hasAttribute("aria-current")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Transactions" }));
    expect(screen.getByRole("button", { name: "More finance views" })).toBeDefined();
  });

  it("does not change views when the menu is dismissed", async () => {
    const onChange = vi.fn();
    render(<FinanceNavigation value="overview" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "More finance views" });
    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });
});
