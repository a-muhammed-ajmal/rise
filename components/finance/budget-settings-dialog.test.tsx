import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { budgetSettingRows, type BudgetChanges, type BudgetRow } from "@/lib/finance/budgets";
import { BudgetSettingsDialog } from "./budget-settings-dialog";

afterEach(cleanup);

const budget = (id: string, category: string, amount: number, period: BudgetRow["period"] = "monthly"): BudgetRow => ({
  id,
  category,
  amount,
  period,
  period_start: "2026-11-01",
  created_at: "2026-11-01T00:00:00Z",
});

const ROWS = budgetSettingRows(
  [
    { name: "Food & Dining", type: "expense" },
    { name: "Personal care", type: "expense" },
    { name: "Baddy", type: "expense" },
  ],
  [budget("f", "Food & Dining", 500), budget("p", "Personal Care", 200), budget("t", "Transport", 300, "quarterly")],
);

function renderSettings({
  onSave = vi.fn<(changes: BudgetChanges) => Promise<void>>().mockResolvedValue(undefined),
  focusCategory,
}: { onSave?: Mock<(changes: BudgetChanges) => Promise<void>>; focusCategory?: string } = {}) {
  const onOpenChange = vi.fn();
  render(
    <BudgetSettingsDialog
      open
      onOpenChange={onOpenChange}
      rows={ROWS}
      hints={{ "food & dining": { thisMonth: 125, average: 140.5 }, baddy: { thisMonth: 74.89, average: 0 } }}
      monthName="November"
      focusCategory={focusCategory}
      onSave={onSave}
    />,
  );
  return { onSave, onOpenChange };
}

describe("BudgetSettingsDialog", () => {
  it("shows one box per category with its current limit and spending hints", () => {
    renderSettings();
    expect(screen.getByRole("heading", { name: "Budget settings" })).toBeDefined();
    expect(screen.getByText(/repeat every month until you change them/)).toBeDefined();
    expect(screen.getByLabelText("Food & Dining")).toHaveProperty("value", "500");
    expect(screen.getByLabelText("Personal care")).toHaveProperty("value", "200");
    expect(screen.getByLabelText("Baddy")).toHaveProperty("value", "");
    expect(screen.getByLabelText("Transport")).toHaveProperty("value", "300");
    expect(screen.getByText("November: AED 125.00 · avg AED 140.50/mo")).toBeDefined();
    expect(screen.getByText("November: AED 74.89")).toBeDefined();
    expect(screen.getByText(/quarterly limit/)).toBeDefined();
    // Monthly limits only: 500 + 200.
    expect(screen.getByText("AED 700.00")).toBeDefined();
  });

  it("focuses the category it was opened for", () => {
    renderSettings({ focusCategory: "Baddy" });
    expect(document.activeElement).toBe(screen.getByLabelText("Baddy"));
  });

  it("saves new and changed limits straight away", async () => {
    const { onSave, onOpenChange } = renderSettings();
    fireEvent.change(screen.getByLabelText("Food & Dining"), { target: { value: "650" } });
    fireEvent.change(screen.getByLabelText("Baddy"), { target: { value: "150" } });
    expect(screen.getByText("AED 1,000.00")).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save budgets" }));
    });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      create: [{ category: "Baddy", amount: 150 }],
      update: [{ id: "f", amount: 650 }],
      remove: [],
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("asks before removing a budget", async () => {
    const { onSave } = renderSettings();
    fireEvent.change(screen.getByLabelText("Personal care"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save budgets" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Remove this budget?" })).toBeDefined();
    expect(screen.getByText(/Personal care will have no budget\. It moves to the recycle bin/)).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove and save" }));
    });
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ create: [], update: [], remove: [{ id: "p", category: "Personal care" }] }),
    );
  });

  it("closes without saving when nothing changed", () => {
    const { onSave, onOpenChange } = renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Save budgets" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks saving an invalid amount and says which", () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText("Baddy"), { target: { value: "-5" } });
    expect(screen.getByText("Enter an amount of zero or more")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save budgets" }).hasAttribute("disabled")).toBe(true);
  });

  it("stays open with the values when saving fails", async () => {
    const { onOpenChange } = renderSettings({ onSave: vi.fn<(changes: BudgetChanges) => Promise<void>>().mockRejectedValue(new Error("boom")) });
    fireEvent.change(screen.getByLabelText("Baddy"), { target: { value: "90" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save budgets" }));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save budgets" }).hasAttribute("disabled")).toBe(false));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Baddy")).toHaveProperty("value", "90");
  });

  it("explains what to do with no expense categories", () => {
    render(
      <BudgetSettingsDialog open onOpenChange={vi.fn()} rows={[]} hints={{}} monthName="November" onSave={vi.fn()} />,
    );
    expect(screen.getByText(/Add an expense category first/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Save budgets" }).hasAttribute("disabled")).toBe(true);
  });
});
