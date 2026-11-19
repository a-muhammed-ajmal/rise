// The major finance categories and the order every category picker uses.
// Pure so it is unit-tested; lib/hooks/use-categories.ts sorts with it.

import type { Category } from "@/lib/types/database";

export type CategoryKind = Category["type"];

/** The major categories, in the order the pickers show them. */
export const MAJOR_CATEGORIES: Readonly<Record<CategoryKind, readonly string[]>> = {
  expense: [
    "Food & Dining",
    "Groceries",
    "Rent & Housing",
    "Transport",
    "Bills & Subscriptions",
    "Personal Care",
    "Family Support",
    "Business",
    "Fees & Charges",
    "Shopping & Other",
  ],
  income: ["Salary", "Business Income", "Other Income"],
};

/** Lower case, trimmed, single spaces — "  Personal  care " → "personal care". */
export function normalizeLabel(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The major category with this name (any case), or null. */
export function majorNamed(kind: CategoryKind, name: string): string | null {
  const wanted = normalizeLabel(name);
  return MAJOR_CATEGORIES[kind].find((major) => normalizeLabel(major) === wanted) ?? null;
}

/**
 * Categories in a sensible order: expense before income, and within each the
 * majors first in their set order, then anything else alphabetically.
 */
export function sortCategories<T extends Pick<Category, "name" | "type">>(categories: readonly T[]): T[] {
  const rank = (c: T) => {
    const index = MAJOR_CATEGORIES[c.type].findIndex((major) => normalizeLabel(major) === normalizeLabel(c.name));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...categories].sort(
    (a, b) =>
      (a.type === b.type ? 0 : a.type === "expense" ? -1 : 1) ||
      rank(a) - rank(b) ||
      a.name.localeCompare(b.name),
  );
}
