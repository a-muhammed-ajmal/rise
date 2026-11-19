import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Category } from "@/lib/types/database";
import type { TidyTransaction } from "@/lib/finance/categories";
import { TidyCategoriesDialog } from "./tidy-categories-dialog";

afterEach(cleanup);

const category = (id: string, name: string, type: Category["type"] = "expense"): Category => ({
  id,
  user_id: "u1",
  name,
  type,
  created_at: "2026-11-01T00:00:00Z",
});
const tx = (category: string, amount: number, date: string, type: TidyTransaction["type"] = "expense"): TidyTransaction => ({
  type,
  category,
  amount,
  date,
});

const CATEGORIES = [category("c-lunch", "Lunch"), category("c-baddy", "Baddy"), category("c-in", "IN-IN", "income")];
const TRANSACTIONS = [
  tx("Lunch", 120, "2026-11-04"),
  tx("Lunch", 80, "2026-10-04"),
  tx("Baddy", 60, "2026-11-05"),
  tx("IN-IN", 500, "2026-11-05", "income"),
];

function renderDialog(onApply = vi.fn().mockResolvedValue(undefined)) {
  const onOpenChange = vi.fn();
  render(
    <TidyCategoriesDialog
      open
      onOpenChange={onOpenChange}
      categories={CATEGORIES}
      transactions={TRANSACTIONS}
      budgets={[]}
      today="2026-11-20"
      onApply={onApply}
    />,
  );
  return { onApply, onOpenChange };
}

const shown = (selectName: string) =>
  screen.getByRole("combobox", { name: selectName }).querySelector('[data-slot="select-value"]')?.textContent;

async function choose(selectName: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: selectName }));
  const item = await screen.findByRole("option", { name: option });
  fireEvent.pointerDown(item, { pointerType: "mouse" });
  fireEvent.click(item);
}

describe("TidyCategoriesDialog", () => {
  it("lists each small category with a suggested major one, and keeps unknown names", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Tidy up categories" })).toBeDefined();
    expect(screen.getByText("2 entries · AED 200.00")).toBeDefined();
    expect(shown("Major category for Lunch")).toBe("Food & Dining");
    expect(shown("Major category for Baddy")).toBe("Keep as its own");
    expect(shown("Major category for IN-IN")).toBe("Keep as its own");
  });

  it("suggests budgets from average spending, then applies after confirmation", async () => {
    const { onApply, onOpenChange } = renderDialog();
    await choose("Major category for Baddy", "Shopping & Other");

    fireEvent.click(screen.getByRole("button", { name: /Next: budgets/ }));
    expect(screen.getByRole("heading", { name: "Monthly budgets" })).toBeDefined();
    // Food & Dining: (120 + 80) / 2 tracked months = 100.
    expect(screen.getByLabelText("Food & Dining")).toHaveProperty("value", "100");
    // Shopping & Other: 60 / 2 = 30 → 50.
    expect(screen.getByLabelText("Shopping & Other")).toHaveProperty("value", "50");
    expect(screen.getByLabelText("Transport")).toHaveProperty("value", "");

    fireEvent.change(screen.getByLabelText("Food & Dining"), { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("heading", { name: "Tidy up categories?" })).toBeDefined();
    expect(screen.getByText(/re-label 3 transactions/)).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tidy up" }));
    });
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    const [{ plan, budgets }] = onApply.mock.calls[0];
    expect(plan.relabel).toEqual([
      { kind: "expense", from: "Lunch", to: "Food & Dining" },
      { kind: "expense", from: "Baddy", to: "Shopping & Other" },
    ]);
    expect(plan.deleteCategoryIds).toEqual(["c-lunch", "c-baddy"]);
    expect(budgets).toContainEqual({ category: "Food & Dining", amount: 400 });
    expect(budgets).toContainEqual({ category: "Shopping & Other", amount: 50 });
    expect(budgets).toContainEqual({ category: "Transport", amount: 0 });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("stays open with the choices intact when applying fails", async () => {
    const { onOpenChange } = renderDialog(vi.fn().mockRejectedValue(new Error("boom")));
    fireEvent.click(screen.getByRole("button", { name: /Next: budgets/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tidy up" }));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply" }).hasAttribute("disabled")).toBe(false));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Food & Dining")).toHaveProperty("value", "100");
  });

  it("blocks Apply on an invalid amount and goes back to the categories", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Next: budgets/ }));
    fireEvent.change(screen.getByLabelText("Groceries"), { target: { value: "-5" } });
    expect(screen.getByRole("button", { name: "Apply" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Tidy up categories" })).toBeDefined();
  });

  it("says when there is nothing left to fold", () => {
    render(
      <TidyCategoriesDialog
        open
        onOpenChange={vi.fn()}
        categories={[category("c-f", "Food & Dining")]}
        transactions={[]}
        budgets={[]}
        today="2026-11-20"
        onApply={vi.fn()}
      />,
    );
    expect(screen.getByText(/already tidy/)).toBeDefined();
  });
});
