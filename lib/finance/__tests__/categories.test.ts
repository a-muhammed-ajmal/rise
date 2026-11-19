import { describe, expect, it } from "vitest";
import { MAJOR_CATEGORIES, majorNamed, normalizeLabel, sortCategories } from "../categories";

const cat = (id: string, name: string, type: "income" | "expense" = "expense") => ({ id, name, type });

describe("MAJOR_CATEGORIES", () => {
  it("keeps each list within the 10-per-type limit and free of duplicates", () => {
    for (const list of Object.values(MAJOR_CATEGORIES)) {
      expect(list.length).toBeLessThanOrEqual(10);
      expect(new Set(list.map(normalizeLabel)).size).toBe(list.length);
    }
  });
});

describe("normalizeLabel / majorNamed", () => {
  it("ignores case and extra spaces", () => {
    expect(normalizeLabel("  Personal   CARE ")).toBe("personal care");
    expect(majorNamed("expense", "groceries")).toBe("Groceries");
    expect(majorNamed("expense", "Personal care")).toBe("Personal Care");
    expect(majorNamed("expense", "Lunch")).toBeNull();
    expect(majorNamed("income", "salary")).toBe("Salary");
  });
});

describe("sortCategories", () => {
  it("lists expense then income, majors first in their set order, then the rest A–Z", () => {
    const sorted = sortCategories([
      cat("1", "Zakat"),
      cat("2", "Transport"),
      cat("3", "Baddy"),
      cat("4", "Food & Dining"),
      cat("5", "Salary", "income"),
      cat("6", "IN-IN", "income"),
    ]);
    expect(sorted.map((c) => c.name)).toEqual(["Food & Dining", "Transport", "Baddy", "Zakat", "Salary", "IN-IN"]);
  });
});
