import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDailyDigestWorkflow } from "../automation";

type Result = { data: unknown; error: unknown };

// Chainable stub matching the loose QueryBuilder shape automation.ts consumes.
// Typed as a bag of mocks so individual terminals can be swapped per test.
type MockQuery = {
  select: (...args: string[]) => MockQuery;
  eq: (column: string, value: unknown) => MockQuery;
  neq: (column: string, value: unknown) => MockQuery;
  gte: (column: string, value: string) => MockQuery;
  order: (column: string, options?: { ascending?: boolean }) => MockQuery;
  limit: (value: number) => MockQuery;
  update: (payload: Record<string, unknown>) => MockQuery;
  maybeSingle: () => Promise<Result>;
  insert: (payload: Record<string, unknown>) => Promise<Result>;
  then: (resolve: (value: Result) => unknown) => Promise<unknown>;
};

function createQuery(result: Result): MockQuery {
  const query: MockQuery = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    gte: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    update: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    insert: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: Result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return query;
}

type DbOptions = {
  completedTasks?: Result;
  pendingTasks?: Result;
  habitLogs?: Result;
  habits?: Result;
  transactions?: Result;
  goals?: Result;
  existingNote?: Result;
  noteWriteError?: unknown;
};

function createDb(options: DbOptions = {}) {
  const inserted: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];
  const taskResponses = [
    options.completedTasks ?? { data: [], error: null },
    options.pendingTasks ?? { data: [], error: null },
  ];

  // Reuse the full chainable shape so the mock satisfies the same QueryBuilder
  // contract automation.ts declares, then override the terminals it uses.
  const writeError = options.noteWriteError ?? null;
  const notesUpdateChain = createQuery({ data: null, error: writeError });

  const notesQuery = createQuery({ data: null, error: null });
  notesQuery.select = vi.fn(() => notesQuery);
  notesQuery.eq = vi.fn(() => notesQuery);
  notesQuery.maybeSingle = vi.fn(
    async () => options.existingNote ?? { data: null, error: null },
  );
  notesQuery.insert = vi.fn(async (payload: Record<string, unknown>) => {
    inserted.push(payload);
    return { data: payload, error: writeError };
  });
  notesQuery.update = vi.fn((payload: Record<string, unknown>) => {
    updated.push(payload);
    return notesUpdateChain;
  });

  const db = {
    from: vi.fn((table: string) => {
      if (table === "tasks") {
        const response = taskResponses.shift();
        if (!response) throw new Error("No more task responses");
        return createQuery(response);
      }
      if (table === "habit_logs")
        return createQuery(options.habitLogs ?? { data: [], error: null });
      if (table === "habits")
        return createQuery(options.habits ?? { data: [], error: null });
      if (table === "transactions")
        return createQuery(options.transactions ?? { data: [], error: null });
      if (table === "goals")
        return createQuery(options.goals ?? { data: [], error: null });
      if (table === "notes") return notesQuery;
      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { db, inserted, updated, notesQuery };
}

function createAi(text = "Digest ready") {
  const capturedPrompts: string[] = [];
  return {
    capturedPrompts,
    ai: {
      models: {
        generateContent: vi.fn(async (input: unknown) => {
          const req = input as {
            contents: Array<{ parts: Array<{ text: string }> }>;
          };
          capturedPrompts.push(req.contents[0].parts[0].text);
          return { candidates: [{ content: { parts: [{ text }] } }] };
        }),
      },
    },
  };
}

describe("runDailyDigestWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a digest and inserts it as a note", async () => {
    const { db, inserted } = createDb({
      completedTasks: {
        data: [
          { title: "Ship launch plan", priority: "P1", completed_at: "2026-06-23T08:00:00" },
        ],
        error: null,
      },
      pendingTasks: {
        data: [{ title: "Review budget", priority: "P2", due_date: "2026-06-24" }],
        error: null,
      },
      habitLogs: {
        data: [{ habit_id: "habit-1", completed: true, logged_date: "2026-06-23" }],
        error: null,
      },
      habits: { data: [{ id: "habit-1", name: "Meditate", icon: "🧘" }], error: null },
      transactions: {
        data: [{ type: "income", amount: 500, category: "Salary", description: "Salary" }],
        error: null,
      },
      goals: {
        data: [{ title: "Launch RISE", progress: 80, status: "active" }],
        error: null,
      },
    });
    const { ai } = createAi();

    const result = await runDailyDigestWorkflow({
      userId: "user-1",
      db,
      ai,
      now: new Date("2026-06-23T12:00:00Z"),
      source: "test",
    });

    expect(result.success).toBe(true);
    expect(result.digestText).toBe("Digest ready");
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      user_id: "user-1",
      title: "Daily Digest — 2026-06-23",
      tags: ["daily-digest"],
      // `notes.linked_to_type` only permits task | goal | contact.
      linked_to_type: null,
    });
    // `source` is not a column on notes — it must not reach the insert payload.
    expect(inserted[0]).not.toHaveProperty("source");
    expect(ai.models.generateContent).toHaveBeenCalled();
  });

  it("updates the existing note instead of inserting a duplicate", async () => {
    const { db, inserted, updated } = createDb({
      existingNote: { data: { id: "note-1" }, error: null },
    });
    const { ai } = createAi("Refreshed digest");

    const result = await runDailyDigestWorkflow({
      userId: "user-1",
      db,
      ai,
      now: new Date("2026-06-23T12:00:00Z"),
    });

    expect(result.success).toBe(true);
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ content: "Refreshed digest" });
  });

  describe("habit mapping", () => {
    it("resolves completed habit ids to their names", async () => {
      const { db } = createDb({
        habitLogs: { data: [{ habit_id: "habit-1", completed: true }], error: null },
        habits: { data: [{ id: "habit-1", name: "Meditate" }], error: null },
      });
      const { ai, capturedPrompts } = createAi();

      await runDailyDigestWorkflow({
        userId: "user-1",
        db,
        ai,
        now: new Date("2026-06-23T12:00:00Z"),
      });

      expect(capturedPrompts[0]).toContain("- Done: Meditate");
      expect(capturedPrompts[0]).toContain("- Missed: None");
    });

    it("lists uncompleted logs as missed", async () => {
      const { db } = createDb({
        habitLogs: {
          data: [
            { habit_id: "habit-1", completed: true },
            { habit_id: "habit-2", completed: false },
          ],
          error: null,
        },
        habits: {
          data: [
            { id: "habit-1", name: "Meditate" },
            { id: "habit-2", name: "Run" },
          ],
          error: null,
        },
      });
      const { ai, capturedPrompts } = createAi();

      await runDailyDigestWorkflow({
        userId: "user-1",
        db,
        ai,
        now: new Date("2026-06-23T12:00:00Z"),
      });

      expect(capturedPrompts[0]).toContain("- Done: Meditate");
      expect(capturedPrompts[0]).toContain("- Missed: Run");
    });

    it("renders a placeholder for a habit id with no matching habit", async () => {
      const { db } = createDb({
        habitLogs: { data: [{ habit_id: "orphan", completed: true }], error: null },
        habits: { data: [{ id: "habit-1", name: "Meditate" }], error: null },
      });
      const { ai, capturedPrompts } = createAi();

      const result = await runDailyDigestWorkflow({
        userId: "user-1",
        db,
        ai,
        now: new Date("2026-06-23T12:00:00Z"),
      });

      expect(result.success).toBe(true);
      expect(capturedPrompts[0]).toContain("- Done: —");
    });
  });

  describe("Dubai date handling", () => {
    it("uses the Dubai calendar date, not the UTC date", async () => {
      const { db, inserted } = createDb();
      const { ai } = createAi();

      // 21:30 UTC on the 23rd is already 01:30 on the 24th in Dubai (UTC+4).
      const result = await runDailyDigestWorkflow({
        userId: "user-1",
        db,
        ai,
        now: new Date("2026-06-23T21:30:00Z"),
      });

      expect(result.date).toBe("2026-06-24");
      expect(inserted[0]).toMatchObject({ title: "Daily Digest — 2026-06-24" });
    });

    it("keeps the same date earlier in the UTC day", async () => {
      const { db } = createDb();
      const { ai } = createAi();

      const result = await runDailyDigestWorkflow({
        userId: "user-1",
        db,
        ai,
        now: new Date("2026-06-23T12:00:00Z"),
      });

      expect(result.date).toBe("2026-06-23");
    });
  });

  describe("due-soon selection", () => {
    it("prioritises the nearest due date and highest priority", async () => {
      const { db } = createDb({
        pendingTasks: {
          data: [
            { title: "Old low task", priority: "P4", due_date: "2026-06-01" },
            { title: "Today high", priority: "P1", due_date: "2026-06-23" },
            { title: "Later", priority: "P1", due_date: "2026-07-30" },
            { title: "Today low", priority: "P3", due_date: "2026-06-23" },
          ],
          error: null,
        },
      });
      const { ai, capturedPrompts } = createAi();

      await runDailyDigestWorkflow({
        userId: "user-1",
        db,
        ai,
        now: new Date("2026-06-23T12:00:00Z"),
      });

      const prompt = capturedPrompts[0];
      const dueSection = prompt.slice(prompt.indexOf("TASKS DUE SOON:"));
      // Overdue first, then today's P1 ahead of today's P3.
      expect(dueSection.indexOf("Old low task")).toBeLessThan(
        dueSection.indexOf("Today high"),
      );
      expect(dueSection.indexOf("Today high")).toBeLessThan(
        dueSection.indexOf("Today low"),
      );
      // Beyond tomorrow is excluded entirely.
      expect(dueSection).not.toContain("Later");
    });
  });

  describe("failure handling", () => {
    it("fails when a source query errors instead of reporting an empty day", async () => {
      const { db } = createDb({
        habitLogs: { data: null, error: { message: "boom" } },
      });
      const { ai } = createAi();

      const result = await runDailyDigestWorkflow({
        userId: "user-1",
        db,
        ai,
        now: new Date("2026-06-23T12:00:00Z"),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to read digest data");
      // Gemini is never called for a digest we already know is wrong.
      expect(ai.models.generateContent).not.toHaveBeenCalled();
    });

    it("fails when the note write errors", async () => {
      const { db } = createDb({ noteWriteError: { message: "no such column" } });
      const { ai } = createAi();

      const result = await runDailyDigestWorkflow({
        userId: "user-1",
        db,
        ai,
        now: new Date("2026-06-23T12:00:00Z"),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to save the digest note");
    });
  });
});
