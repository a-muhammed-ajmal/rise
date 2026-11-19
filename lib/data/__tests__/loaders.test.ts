import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isFreshSnapshot,
  SNAPSHOT_MAX_AGE_MS,
  takeSnapshot,
} from "../snapshot";
import {
  loadCategories,
  loadFinanceData,
  loadPaymentMethods,
  TRANSACTION_PAGE_SIZE,
} from "../finance";
import {
  loadContacts,
  loadGoalsData,
  loadKnowledgeData,
  loadLatestConversation,
  loadProfile,
  loadWellnessData,
} from "../modules";
import { countCompletedFocus, hydrateTask, loadProjects, loadTasks } from "../tasks";

// ─── Supabase mock ───────────────────────────────────────────────────────────
// Each from() call is one query: its chained calls are recorded, and its result
// is the next one queued for that table.

type Result = { data?: unknown; error?: { message: string } | null; count?: number | null };
type Call = [string, unknown[]];

function mockClient(
  results: Record<string, Result | Result[]>,
  auth?: { user?: unknown; error?: { message: string } | null },
) {
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
        count: result.count ?? null,
      });
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "is", "not", "lte", "gte", "or", "order", "limit", "range"]) {
      q[m] = (...args: unknown[]) => {
        entry.calls.push([m, args]);
        return q;
      };
    }
    q.maybeSingle = () => settle();
    q.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      settle().then(resolve, reject);
    return q;
  });
  const client = {
    from,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: auth?.user ?? null },
        error: auth?.error ?? null,
      }),
    },
  };
  const callsOf = (table: string, n = 0) =>
    queries.filter((q) => q.table === table)[n]?.calls ?? [];
  return { client: client as never, queries, callsOf };
}

const fail = { error: { message: "db down" } };

// ─── Snapshot ────────────────────────────────────────────────────────────────

describe("takeSnapshot", () => {
  afterEach(() => vi.restoreAllMocks());

  it("wraps loaded data with the time it was loaded", async () => {
    const before = Date.now();
    const snap = await takeSnapshot("test", async () => [1, 2]);
    expect(snap?.data).toEqual([1, 2]);
    expect(snap?.loadedAt).toBeGreaterThanOrEqual(before);
  });

  it("returns null and logs when the loader fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const snap = await takeSnapshot("test", async () => {
      throw new Error("boom");
    });
    expect(snap).toBeNull();
    expect(log).toHaveBeenCalledWith("[test] server load failed:", expect.any(Error));
  });
});

describe("isFreshSnapshot", () => {
  const now = 1_000_000;

  it("is fresh within the max age and stale after it", () => {
    expect(isFreshSnapshot({ data: 1, loadedAt: now }, now)).toBe(true);
    expect(isFreshSnapshot({ data: 1, loadedAt: now - SNAPSHOT_MAX_AGE_MS }, now)).toBe(true);
    expect(isFreshSnapshot({ data: 1, loadedAt: now - SNAPSHOT_MAX_AGE_MS - 1 }, now)).toBe(false);
  });

  it("treats a missing snapshot or one from the future as not fresh", () => {
    expect(isFreshSnapshot(null, now)).toBe(false);
    expect(isFreshSnapshot(undefined, now)).toBe(false);
    expect(isFreshSnapshot({ data: 1, loadedAt: now + 5_000 }, now)).toBe(false);
  });
});

// ─── Finance ─────────────────────────────────────────────────────────────────

describe("loadFinanceData", () => {
  it("loads transactions, current budgets and debts", async () => {
    const { client, callsOf } = mockClient({
      transactions: { data: [{ id: "t1" }] },
      budgets: { data: [{ id: "b1" }] },
      debts: { data: [{ id: "d1" }] },
    });

    const data = await loadFinanceData(client, "2026-06-23");

    expect(data).toEqual({
      transactions: [{ id: "t1" }],
      budgets: [{ id: "b1" }],
      debts: [{ id: "d1" }],
    });
    expect(callsOf("transactions")).toContainEqual(["is", ["deleted_at", null]]);
    expect(callsOf("budgets")).toContainEqual(["gte", ["period_end", "2026-06-23"]]);
    expect(callsOf("debts")).toContainEqual(["order", ["created_at", { ascending: false }]]);
  });

  it("pages through transactions until a short page", async () => {
    const fullPage = Array.from({ length: TRANSACTION_PAGE_SIZE }, (_, i) => ({ id: `t${i}` }));
    const { client, callsOf } = mockClient({
      transactions: [{ data: fullPage }, { data: [{ id: "last" }] }],
      budgets: { data: [] },
      debts: { data: [] },
    });

    const data = await loadFinanceData(client, "2026-06-23");

    expect(data.transactions).toHaveLength(TRANSACTION_PAGE_SIZE + 1);
    expect(callsOf("transactions", 0)).toContainEqual(["range", [0, TRANSACTION_PAGE_SIZE - 1]]);
    expect(callsOf("transactions", 1)).toContainEqual([
      "range",
      [TRANSACTION_PAGE_SIZE, 2 * TRANSACTION_PAGE_SIZE - 1],
    ]);
  });

  it.each(["transactions", "budgets", "debts"])("throws when %s fails", async (table) => {
    const { client } = mockClient({
      transactions: { data: [] },
      budgets: { data: [] },
      debts: { data: [] },
      [table]: fail,
    });
    await expect(loadFinanceData(client, "2026-06-23")).rejects.toThrow("db down");
  });

  it("treats null rows as empty lists", async () => {
    const { client } = mockClient({});
    expect(await loadFinanceData(client, "2026-06-23")).toEqual({
      transactions: [],
      budgets: [],
      debts: [],
    });
  });
});

describe("loadPaymentMethods / loadCategories", () => {
  it("loads wallets in display order", async () => {
    const { client, callsOf } = mockClient({ payment_methods: { data: [{ id: "w1" }] } });
    expect(await loadPaymentMethods(client)).toEqual([{ id: "w1" }]);
    expect(callsOf("payment_methods")).toContainEqual(["order", ["display_order", { ascending: true }]]);
  });

  it("loads categories by name", async () => {
    const { client, callsOf } = mockClient({ categories: { data: [{ id: "c1" }] } });
    expect(await loadCategories(client)).toEqual([{ id: "c1" }]);
    expect(callsOf("categories")).toContainEqual(["order", ["name", { ascending: true }]]);
  });

  it("throws on a query error and returns [] for null rows", async () => {
    await expect(loadPaymentMethods(mockClient({ payment_methods: fail }).client)).rejects.toThrow("db down");
    await expect(loadCategories(mockClient({ categories: fail }).client)).rejects.toThrow("db down");
    expect(await loadPaymentMethods(mockClient({}).client)).toEqual([]);
    expect(await loadCategories(mockClient({}).client)).toEqual([]);
  });
});

// ─── CRM / Goals / Knowledge / Wellness ──────────────────────────────────────

describe("loadContacts", () => {
  it("loads live contacts by name", async () => {
    const { client, callsOf } = mockClient({ contacts: { data: [{ id: "c1" }] } });
    expect(await loadContacts(client)).toEqual([{ id: "c1" }]);
    expect(callsOf("contacts")).toEqual([
      ["select", ["*"]],
      ["is", ["deleted_at", null]],
      ["order", ["name"]],
    ]);
  });

  it("throws on error and returns [] for null rows", async () => {
    await expect(loadContacts(mockClient({ contacts: fail }).client)).rejects.toThrow("db down");
    expect(await loadContacts(mockClient({}).client)).toEqual([]);
  });
});

describe("loadGoalsData", () => {
  it("loads goals, recent entries and today's entry", async () => {
    const { client, callsOf } = mockClient({
      goals: { data: [{ id: "g1" }] },
      journal_entries: [{ data: [{ id: "e1" }] }, { data: { id: "today" } }],
    });

    expect(await loadGoalsData(client, "2026-06-23")).toEqual({
      goals: [{ id: "g1" }],
      entries: [{ id: "e1" }],
      todayEntry: { id: "today" },
    });
    expect(callsOf("journal_entries", 0)).toContainEqual(["limit", [30]]);
    expect(callsOf("journal_entries", 1)).toContainEqual(["eq", ["date", "2026-06-23"]]);
  });

  it("returns empty lists and no entry for null rows", async () => {
    expect(await loadGoalsData(mockClient({}).client, "2026-06-23")).toEqual({
      goals: [],
      entries: [],
      todayEntry: null,
    });
  });

  it.each([
    [{ goals: fail }],
    [{ journal_entries: [fail, {}] }],
    [{ journal_entries: [{}, fail] }],
  ])("throws when any of the three queries fails", async (results) => {
    await expect(loadGoalsData(mockClient(results).client, "2026-06-23")).rejects.toThrow("db down");
  });
});

describe("loadKnowledgeData", () => {
  it("loads notes by last edit and links by creation", async () => {
    const { client, callsOf } = mockClient({
      notes: { data: [{ id: "n1" }] },
      links: { data: [{ id: "l1" }] },
    });
    expect(await loadKnowledgeData(client)).toEqual({ notes: [{ id: "n1" }], links: [{ id: "l1" }] });
    expect(callsOf("notes")).toContainEqual(["order", ["updated_at", { ascending: false }]]);
    expect(callsOf("links")).toContainEqual(["order", ["created_at", { ascending: false }]]);
  });

  it("throws on error and returns [] for null rows", async () => {
    await expect(loadKnowledgeData(mockClient({ notes: fail }).client)).rejects.toThrow("db down");
    await expect(loadKnowledgeData(mockClient({ links: fail }).client)).rejects.toThrow("db down");
    expect(await loadKnowledgeData(mockClient({}).client)).toEqual({ notes: [], links: [] });
  });
});

describe("loadWellnessData", () => {
  it("loads active habits and the last 30 days of logs", async () => {
    const { client, callsOf } = mockClient({
      habits: { data: [{ id: "h1" }] },
      habit_logs: { data: [{ id: "l1" }] },
    });
    expect(await loadWellnessData(client, "2026-06-23")).toEqual({
      habits: [{ id: "h1" }],
      logs: [{ id: "l1" }],
    });
    expect(callsOf("habits")).toContainEqual(["eq", ["active", true]]);
    expect(callsOf("habit_logs")).toContainEqual(["gte", ["logged_date", "2026-05-24"]]);
  });

  it("throws on error and returns [] for null rows", async () => {
    await expect(loadWellnessData(mockClient({ habits: fail }).client, "2026-06-23")).rejects.toThrow("db down");
    await expect(loadWellnessData(mockClient({ habit_logs: fail }).client, "2026-06-23")).rejects.toThrow("db down");
    expect(await loadWellnessData(mockClient({}).client, "2026-06-23")).toEqual({ habits: [], logs: [] });
  });
});

// ─── Settings / Assistant ────────────────────────────────────────────────────

describe("loadProfile", () => {
  afterEach(() => vi.restoreAllMocks());

  const user = {
    id: "u1",
    email: "me@example.com",
    user_metadata: { full_name: "Account Name", avatar_url: "https://img/a.png" },
  };

  it("prefers the profile's display name and reads the avatar from metadata", async () => {
    const { client } = mockClient({ user_profile: { data: { display_name: "Chosen Name" } } }, { user });
    expect(await loadProfile(client)).toEqual({
      email: "me@example.com",
      displayName: "Chosen Name",
      avatarUrl: "https://img/a.png",
    });
  });

  it("falls back to the account name, and to blanks", async () => {
    expect(await loadProfile(mockClient({}, { user }).client)).toMatchObject({ displayName: "Account Name" });
    expect(
      await loadProfile(mockClient({}, { user: { id: "u1", user_metadata: { full_name: 7 } } }).client),
    ).toEqual({ email: null, displayName: "", avatarUrl: null });
  });

  it("logs a failed profile read but still returns the account details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const profile = await loadProfile(mockClient({ user_profile: fail }, { user }).client);
    expect(profile.displayName).toBe("Account Name");
    expect(log).toHaveBeenCalled();
  });

  it("throws when the user cannot be read", async () => {
    await expect(loadProfile(mockClient({}, { error: { message: "jwt expired" } }).client)).rejects.toThrow("jwt expired");
    await expect(loadProfile(mockClient({}).client)).rejects.toThrow("Not signed in");
  });
});

describe("loadLatestConversation", () => {
  it("loads the most recent conversation for the user", async () => {
    const { client, callsOf } = mockClient({ ai_conversations: { data: { id: "c1", messages: [] } } });
    expect(await loadLatestConversation(client, "u1")).toEqual({ id: "c1", messages: [] });
    expect(callsOf("ai_conversations")).toContainEqual(["eq", ["user_id", "u1"]]);
    expect(callsOf("ai_conversations")).toContainEqual(["order", ["updated_at", { ascending: false }]]);
  });

  it("returns null when there is none and throws on error", async () => {
    expect(await loadLatestConversation(mockClient({}).client, "u1")).toBeNull();
    await expect(loadLatestConversation(mockClient({ ai_conversations: fail }).client, "u1")).rejects.toThrow("db down");
  });
});

// ─── Tasks / Projects ────────────────────────────────────────────────────────

describe("hydrateTask", () => {
  it("derives is_completed and normalises JSON array columns", () => {
    const row = {
      id: "t1",
      completed_at: "2026-06-23T10:00:00Z",
      labels: null,
      subtasks: "bad",
      attachments: [{ name: "a" }],
    } as never;
    expect(hydrateTask(row)).toMatchObject({
      is_completed: true,
      labels: [],
      subtasks: [],
      attachments: [{ name: "a" }],
    });
    expect(hydrateTask({ id: "t2", completed_at: null } as never).is_completed).toBe(false);
  });
});

describe("loadTasks", () => {
  const today = "2026-06-23";

  it("today: open tasks due today or overdue", async () => {
    const { client, callsOf } = mockClient({ tasks: { data: [{ id: "t1", completed_at: null }] } });
    const tasks = await loadTasks(client, "today", today);
    expect(tasks[0]).toMatchObject({ id: "t1", is_completed: false });
    expect(callsOf("tasks")).toContainEqual(["neq", ["status", "done"]]);
    expect(callsOf("tasks")).toContainEqual(["or", [`due_date.eq.${today},due_date.lt.${today}`]]);
  });

  it("completed: done tasks only", async () => {
    const { client, callsOf } = mockClient({ tasks: { data: [] } });
    await loadTasks(client, "completed", today);
    expect(callsOf("tasks")).toContainEqual(["eq", ["status", "done"]]);
    expect(callsOf("tasks").some(([m]) => m === "neq")).toBe(false);
  });

  it("project: filters by project id when one is given", async () => {
    const withId = mockClient({ tasks: { data: [] } });
    await loadTasks(withId.client, "project", today, "p1");
    expect(withId.callsOf("tasks")).toContainEqual(["eq", ["project_id", "p1"]]);

    const withoutId = mockClient({ tasks: { data: [] } });
    await loadTasks(withoutId.client, "project", today);
    expect(withoutId.callsOf("tasks").some(([m, args]) => m === "eq" && args[0] === "project_id")).toBe(false);
  });

  it("all: every open task, no date filter", async () => {
    const { client, callsOf } = mockClient({ tasks: {} });
    expect(await loadTasks(client, "all", today)).toEqual([]);
    expect(callsOf("tasks").some(([m]) => m === "or")).toBe(false);
  });

  it("throws on error", async () => {
    await expect(loadTasks(mockClient({ tasks: fail }).client, "all", today)).rejects.toThrow("db down");
  });
});

describe("loadProjects / countCompletedFocus", () => {
  it("loads active projects by name", async () => {
    const { client, callsOf } = mockClient({ projects: { data: [{ id: "p1" }] } });
    expect(await loadProjects(client)).toEqual([{ id: "p1" }]);
    expect(callsOf("projects")).toContainEqual(["eq", ["status", "active"]]);
    expect(await loadProjects(mockClient({}).client)).toEqual([]);
    await expect(loadProjects(mockClient({ projects: fail }).client)).rejects.toThrow("db down");
  });

  it("counts today's completed focus tasks", async () => {
    const { client, callsOf } = mockClient({ tasks: { count: 2 } });
    expect(await countCompletedFocus(client, "2026-06-23")).toBe(2);
    expect(callsOf("tasks")).toContainEqual(["eq", ["focus_date", "2026-06-23"]]);
    expect(callsOf("tasks")).toContainEqual(["gte", ["completed_at", "2026-06-23T00:00:00"]]);
    expect(await countCompletedFocus(mockClient({}).client, "2026-06-23")).toBe(0);
    await expect(countCompletedFocus(mockClient({ tasks: fail }).client, "2026-06-23")).rejects.toThrow("db down");
  });
});
