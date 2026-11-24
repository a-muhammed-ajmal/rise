import { describe, expect, it, vi } from "vitest";
import { loadHomeMoney } from "../home";
import { TRANSACTION_PAGE_SIZE } from "../finance";

// ─── Supabase mock ───────────────────────────────────────────────────────────
// Each from() call is one query: its chained calls are recorded, and its result
// is the next one queued for that table.

type Result = { data?: unknown; error?: { message: string } | null };
type Call = [string, unknown[]];

function mockClient(results: Record<string, Result | Result[]>) {
  const queries: { table: string; calls: Call[] }[] = [];
  const used: Record<string, number> = {};
  const next = (table: string): Result => {
    const queued = results[table];
    if (!Array.isArray(queued)) return queued ?? {};
    const i = used[table] ?? 0;
    used[table] = i + 1;
    return queued[Math.min(i, queued.length - 1)];
  };
  const from = vi.fn((table: string) => {
    const entry = { table, calls: [] as Call[] };
    queries.push(entry);
    const result = next(table);
    const settle = () =>
      Promise.resolve({
        data: result.data ?? null,
        error: result.error ?? null,
      });
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "gte", "lte", "order", "range"]) {
      q[m] = (...args: unknown[]) => {
        entry.calls.push([m, args]);
        return q;
      };
    }
    q.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown,
    ) => settle().then(resolve, reject);
    return q;
  });
  const callsOf = (table: string, n = 0) =>
    queries.filter((q) => q.table === table)[n]?.calls ?? [];
  const count = (table: string) =>
    queries.filter((q) => q.table === table).length;
  return { client: { from } as never, callsOf, count };
}

const TODAY = "2026-11-24";
const fail = { error: { message: "db down" } };

const budget = (category: string, amount: number, period = "monthly") => ({
  id: `b-${category}`,
  category,
  amount,
  period,
  period_start: "2026-01-01",
  created_at: "2026-01-01T00:00:00Z",
});

const expense = (category: string, amount: number, date = "2026-11-10") => ({
  type: "expense",
  category,
  amount,
  date,
});

describe("loadHomeMoney", () => {
  it("adds active wallets and open debts into net worth", async () => {
    const { client, callsOf } = mockClient({
      payment_methods: { data: [{ balance: 1000 }, { balance: 250.5 }] },
      debts: {
        data: [
          {
            id: "d1",
            creditor: "Ahmed",
            type: "they_owe",
            amount: 300,
            due_date: null,
            paid_at: null,
            deleted_at: null,
          },
          {
            id: "d2",
            creditor: "Bank",
            type: "i_owe",
            amount: 100,
            due_date: null,
            paid_at: null,
            deleted_at: null,
          },
        ],
      },
      budgets: { data: [] },
    });

    const money = await loadHomeMoney(client, TODAY);

    expect(money.netWorth).toMatchObject({
      walletBalance: 1250.5,
      owedToYou: 300,
      youOwe: 100,
      netWorth: 1450.5,
      owedToYouCount: 1,
      youOweCount: 1,
    });
    expect(money.attention).toEqual([]);
    expect(callsOf("payment_methods")).toContainEqual([
      "eq",
      ["is_active", true],
    ]);
    expect(callsOf("debts")).toContainEqual(["is", ["deleted_at", null]]);
    expect(callsOf("debts")).toContainEqual(["is", ["paid_at", null]]);
    expect(callsOf("budgets")).toContainEqual(["is", ["deleted_at", null]]);
  });

  it("skips the transactions query when there are no budgets", async () => {
    const { client, count } = mockClient({
      payment_methods: { data: [] },
      debts: { data: [] },
      budgets: { data: [] },
    });
    await loadHomeMoney(client, TODAY);
    expect(count("transactions")).toBe(0);
  });

  it("lists overdue debts and budgets over or near their limit, most urgent first", async () => {
    const { client, callsOf } = mockClient({
      payment_methods: { data: [{ balance: 500 }] },
      debts: {
        data: [
          {
            id: "d1",
            creditor: "Ahmed",
            type: "they_owe",
            amount: 1200,
            due_date: "2026-11-20",
            paid_at: null,
            deleted_at: null,
          },
        ],
      },
      budgets: {
        data: [
          budget("Dining", 1000),
          budget("Groceries", 1500),
          budget("Transport", 800),
        ],
      },
      transactions: {
        data: [
          expense("Dining", 1150),
          expense("Groceries", 1230),
          expense("Transport", 100),
        ],
      },
    });

    const money = await loadHomeMoney(client, TODAY);

    expect(money.attention.map((a) => [a.level, a.target, a.title])).toEqual([
      ["danger", "debts", "Ahmed — 4 days overdue"],
      ["danger", "budgets", "Dining budget is over"],
      ["warning", "budgets", "Groceries budget at 82%"],
    ]);
    const tx = callsOf("transactions");
    expect(tx).toContainEqual(["select", ["type, category, amount, date"]]);
    expect(tx).toContainEqual(["is", ["deleted_at", null]]);
    expect(tx).toContainEqual(["eq", ["type", "expense"]]);
    expect(tx).toContainEqual(["gte", ["date", "2026-11-01"]]);
    expect(tx).toContainEqual(["lte", ["date", "2026-11-30"]]);
  });

  it("loads spending across the widest budget period", async () => {
    const { client, callsOf } = mockClient({
      payment_methods: { data: [] },
      debts: { data: [] },
      budgets: {
        data: [budget("Dining", 1000), budget("Travel", 9000, "yearly")],
      },
      transactions: { data: [] },
    });
    await loadHomeMoney(client, TODAY);
    const tx = callsOf("transactions");
    expect(tx).toContainEqual(["gte", ["date", "2026-01-01"]]);
    expect(tx).toContainEqual(["lte", ["date", "2026-12-31"]]);
  });

  it("pages through spending until a short page", async () => {
    const fullPage = Array.from({ length: TRANSACTION_PAGE_SIZE }, () =>
      expense("Dining", 1),
    );
    const { client, callsOf, count } = mockClient({
      payment_methods: { data: [] },
      debts: { data: [] },
      budgets: { data: [budget("Dining", 2000)] },
      transactions: [{ data: fullPage }, { data: [expense("Dining", 1)] }],
    });

    const money = await loadHomeMoney(client, TODAY);

    expect(count("transactions")).toBe(2);
    expect(callsOf("transactions", 1)).toContainEqual([
      "range",
      [TRANSACTION_PAGE_SIZE, TRANSACTION_PAGE_SIZE * 2 - 1],
    ]);
    // 501 of 2000 is 25% — not worth flagging.
    expect(money.attention).toEqual([]);
  });

  it.each(["payment_methods", "debts", "budgets"])(
    "throws when %s fails",
    async (table) => {
      const { client } = mockClient({
        payment_methods: { data: [] },
        debts: { data: [] },
        budgets: { data: [] },
        [table]: fail,
      });
      await expect(loadHomeMoney(client, TODAY)).rejects.toThrow("db down");
    },
  );

  it("throws when the spending query fails", async () => {
    const { client } = mockClient({
      payment_methods: { data: [] },
      debts: { data: [] },
      budgets: { data: [budget("Dining", 1000)] },
      transactions: fail,
    });
    await expect(loadHomeMoney(client, TODAY)).rejects.toThrow("db down");
  });

  it("treats missing rows as empty", async () => {
    const { client } = mockClient({});
    const money = await loadHomeMoney(client, TODAY);
    expect(money.netWorth.netWorth).toBe(0);
    expect(money.attention).toEqual([]);
  });
});
