import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { applyTidyUp, TidyUpError } from "../tidy-categories";
import type { TidyPlan } from "@/lib/finance/categories";

type Call = { table: string; op: string; payload?: unknown; options?: unknown; filters: [string, ...unknown[]][] };

/**
 * A chainable stand-in for the Supabase client that records every request and
 * fails the first request to `failOn` (table + op), if given.
 */
function fakeClient(failOn?: { table: string; op: string }) {
  const calls: Call[] = [];
  let failed = false;
  const client = {
    from(table: string) {
      const call: Call = { table, op: "", filters: [] };
      const result = () => {
        const fail = !failed && failOn?.table === table && failOn.op === call.op;
        if (fail) failed = true;
        return { data: null, error: fail ? { message: `${table} ${call.op} failed` } : null };
      };
      const q = {
        insert(payload: unknown) {
          Object.assign(call, { op: "insert", payload });
          calls.push(call);
          return q;
        },
        upsert(payload: unknown, options: unknown) {
          Object.assign(call, { op: "upsert", payload, options });
          calls.push(call);
          return q;
        },
        update(payload: unknown) {
          Object.assign(call, { op: "update", payload });
          calls.push(call);
          return q;
        },
        delete() {
          call.op = "delete";
          calls.push(call);
          return q;
        },
        eq(column: string, value: unknown) {
          call.filters.push(["eq", column, value]);
          return q;
        },
        is(column: string, value: unknown) {
          call.filters.push(["is", column, value]);
          return q;
        },
        in(column: string, values: unknown) {
          call.filters.push(["in", column, values]);
          return q;
        },
        then(resolve: (value: ReturnType<typeof result>) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(result()).then(resolve, reject);
        },
      };
      return q;
    },
  };
  return { calls, client };
}

// The fake only implements what applyTidyUp touches; this helper narrows it to
// the client type without a type assertion.
function asClient(fake: ReturnType<typeof fakeClient>["client"]): SupabaseClient<Database> {
  const accept = (value: unknown): value is SupabaseClient<Database> => typeof value === "object" && value !== null;
  if (!accept(fake)) throw new Error("not a client");
  return fake;
}

const PLAN: TidyPlan = {
  createCategories: [
    { kind: "expense", name: "Food & Dining" },
    { kind: "income", name: "Salary" },
  ],
  relabel: [
    { kind: "expense", from: "Lunch", to: "Food & Dining" },
    { kind: "income", from: "D-Business", to: "Business Income" },
  ],
  deleteCategoryIds: ["c-lunch"],
  transactionCount: 7,
};

const BASE = {
  userId: "u1",
  plan: PLAN,
  periodStart: "2026-11-01",
  periodEnd: "2026-11-30",
  now: new Date("2026-11-20T08:00:00Z"),
};

describe("applyTidyUp", () => {
  it("adds majors, re-labels (keeping the old name), sets budgets, retires folded budgets, then removes old rows", async () => {
    const { calls, client } = fakeClient();
    const result = await applyTidyUp(asClient(client), {
      ...BASE,
      budgets: [
        { category: "Food & Dining", amount: 600 },
        { category: "Groceries", amount: 200 },
        { category: "Transport", amount: 0 },
      ],
      existingBudgets: [
        { id: "b-groc", category: "groceries", amount: 150 },
        { id: "b-lunch", category: "Lunch", amount: 100 },
      ],
    });

    expect(result).toEqual({ createdCategories: 2, relabelled: 7, budgetsSet: 2, removedCategories: 1 });
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual([
      "categories.upsert",
      "transactions.update",
      "transactions.update",
      "transactions.update",
      "transactions.update",
      "budgets.insert",
      "budgets.update",
      "budgets.update",
      "categories.delete",
    ]);

    expect(calls[0].payload).toEqual([
      { user_id: "u1", name: "Food & Dining", type: "expense" },
      { user_id: "u1", name: "Salary", type: "income" },
    ]);
    expect(calls[0].options).toEqual({ onConflict: "user_id,name,type", ignoreDuplicates: true });

    // Rows without a description keep the old name there, then the rest move.
    expect(calls[1].payload).toEqual({ category: "Food & Dining", description: "Lunch" });
    expect(calls[1].filters).toEqual([
      ["eq", "user_id", "u1"],
      ["eq", "type", "expense"],
      ["eq", "category", "Lunch"],
      ["is", "description", null],
    ]);
    expect(calls[2].payload).toEqual({ category: "Food & Dining" });
    expect(calls[2].filters).toEqual([
      ["eq", "user_id", "u1"],
      ["eq", "type", "expense"],
      ["eq", "category", "Lunch"],
    ]);
    expect(calls[3].filters).toContainEqual(["eq", "type", "income"]);

    // A new budget for Food & Dining; the existing Groceries one (any case) is updated.
    expect(calls[5].payload).toEqual({
      user_id: "u1",
      category: "Food & Dining",
      amount: 600,
      period: "monthly",
      period_start: "2026-11-01",
      period_end: "2026-11-30",
    });
    expect(calls[6].payload).toEqual({ amount: 200 });
    expect(calls[6].filters).toEqual([
      ["eq", "id", "b-groc"],
      ["eq", "user_id", "u1"],
    ]);

    // The Lunch budget was folded into Food & Dining, so it goes to the recycle bin.
    expect(calls[7].payload).toEqual({ deleted_at: "2026-11-20T08:00:00.000Z" });
    expect(calls[7].filters).toEqual([
      ["in", "id", ["b-lunch"]],
      ["eq", "user_id", "u1"],
      ["is", "deleted_at", null],
    ]);

    expect(calls[8].filters).toEqual([
      ["in", "id", ["c-lunch"]],
      ["eq", "user_id", "u1"],
    ]);
  });

  it("does nothing for an empty plan with no budgets", async () => {
    const { calls, client } = fakeClient();
    const result = await applyTidyUp(asClient(client), {
      ...BASE,
      plan: { createCategories: [], relabel: [], deleteCategoryIds: [], transactionCount: 0 },
      budgets: [{ category: "Groceries", amount: 0 }],
      existingBudgets: [{ id: "b1", category: "Groceries", amount: 100 }],
    });
    expect(calls).toEqual([]);
    expect(result).toEqual({ createdCategories: 0, relabelled: 0, budgetsSet: 0, removedCategories: 0 });
  });

  it.each([
    [{ table: "categories", op: "upsert" }, "categories"],
    [{ table: "transactions", op: "update" }, "transactions"],
    [{ table: "budgets", op: "insert" }, "budgets"],
    [{ table: "categories", op: "delete" }, "cleanup"],
  ])("stops with the step that failed (%o)", async (failOn, step) => {
    const { calls, client } = fakeClient(failOn);
    const run = applyTidyUp(asClient(client), {
      ...BASE,
      budgets: [{ category: "Food & Dining", amount: 600 }],
      existingBudgets: [],
    });
    await expect(run).rejects.toBeInstanceOf(TidyUpError);
    await expect(run).rejects.toMatchObject({ step });
    // Nothing after the failed step runs.
    const last = calls[calls.length - 1];
    expect(`${last.table}.${last.op}`).toBe(`${failOn.table}.${failOn.op}`);
  });

  it("stops when retiring folded budgets fails", async () => {
    const { calls, client } = fakeClient({ table: "budgets", op: "update" });
    await expect(
      applyTidyUp(asClient(client), {
        ...BASE,
        budgets: [],
        existingBudgets: [{ id: "b-lunch", category: "Lunch", amount: 100 }],
      }),
    ).rejects.toMatchObject({ step: "budgets" });
    expect(calls.some((c) => c.table === "categories" && c.op === "delete")).toBe(false);
  });

  it("stops when the second half of a re-label fails", async () => {
    const { client } = fakeClient();
    let updates = 0;
    const flaky = {
      from(table: string) {
        const q = client.from(table);
        if (table !== "transactions") return q;
        return {
          ...q,
          update(payload: unknown) {
            updates += 1;
            const inner = q.update(payload);
            if (updates < 2) return inner;
            return {
              ...inner,
              eq() {
                return this;
              },
              then(resolve: (v: { data: null; error: { message: string } }) => unknown) {
                return Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve);
              },
            };
          },
        };
      },
    };
    await expect(
      applyTidyUp(asClient(flaky), { ...BASE, budgets: [], existingBudgets: [] }),
    ).rejects.toMatchObject({ step: "transactions" });
  });
});
