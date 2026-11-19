import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { BudgetSaveError, saveBudgetChanges } from "../budgets";

type Call = { table: string; op: string; payload?: unknown; filters: [string, ...unknown[]][] };

/** Records every request; fails the first `failOn` operation, if given. */
function fakeClient(failOn?: string) {
  const calls: Call[] = [];
  let failed = false;
  const client = {
    from(table: string) {
      const call: Call = { table, op: "", filters: [] };
      const result = () => {
        const fail = !failed && failOn === call.op;
        if (fail) failed = true;
        return { data: null, error: fail ? { message: `${call.op} failed` } : null };
      };
      const q = {
        insert(payload: unknown) {
          Object.assign(call, { op: "insert", payload });
          calls.push(call);
          return q;
        },
        update(payload: unknown) {
          Object.assign(call, { op: "update", payload });
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

// Narrows the fake to the client type without a type assertion.
function asClient(fake: ReturnType<typeof fakeClient>["client"]): SupabaseClient<Database> {
  const accept = (value: unknown): value is SupabaseClient<Database> => typeof value === "object" && value !== null;
  if (!accept(fake)) throw new Error("not a client");
  return fake;
}

const BASE = {
  userId: "u1",
  periodStart: "2026-11-01",
  periodEnd: "2026-11-30",
  now: new Date("2026-11-20T08:00:00Z"),
};

describe("saveBudgetChanges", () => {
  it("creates monthly budgets, updates amounts and soft-deletes removed ones", async () => {
    const { calls, client } = fakeClient();
    await saveBudgetChanges(asClient(client), {
      ...BASE,
      changes: {
        create: [{ category: "Baddy", amount: 150 }],
        update: [{ id: "f", amount: 650 }],
        remove: [{ id: "x", category: "Old one" }],
      },
    });

    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(["budgets.insert", "budgets.update", "budgets.update"]);
    expect(calls[0].payload).toEqual([
      {
        user_id: "u1",
        category: "Baddy",
        amount: 150,
        period: "monthly",
        period_start: "2026-11-01",
        period_end: "2026-11-30",
      },
    ]);
    expect(calls[1].payload).toEqual({ amount: 650 });
    expect(calls[1].filters).toEqual([
      ["eq", "id", "f"],
      ["eq", "user_id", "u1"],
      ["is", "deleted_at", null],
    ]);
    expect(calls[2].payload).toEqual({ deleted_at: "2026-11-20T08:00:00.000Z" });
    expect(calls[2].filters).toEqual([
      ["in", "id", ["x"]],
      ["eq", "user_id", "u1"],
      ["is", "deleted_at", null],
    ]);
  });

  it("sends nothing when nothing changed", async () => {
    const { calls, client } = fakeClient();
    await saveBudgetChanges(asClient(client), { ...BASE, changes: { create: [], update: [], remove: [] } });
    expect(calls).toEqual([]);
  });

  it.each(["insert", "update"])("stops on a failed %s", async (op) => {
    const { calls, client } = fakeClient(op);
    await expect(
      saveBudgetChanges(asClient(client), {
        ...BASE,
        changes: { create: [{ category: "A", amount: 1 }], update: [{ id: "b", amount: 2 }], remove: [{ id: "c", category: "C" }] },
      }),
    ).rejects.toBeInstanceOf(BudgetSaveError);
    expect(calls[calls.length - 1].op).toBe(op);
  });

  it("stops when removing fails", async () => {
    const { client } = fakeClient("update");
    await expect(
      saveBudgetChanges(asClient(client), { ...BASE, changes: { create: [], update: [], remove: [{ id: "c", category: "C" }] } }),
    ).rejects.toThrow("update failed");
  });
});
