import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { executeTool } from "../execute-tool";
import { createClient } from "@/lib/supabase/server";

const mockUser = { id: "user-123" };

function createMockQuery(
  returnData: unknown = null,
  returnError: unknown = null,
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.ilike = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.contains = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi
    .fn()
    .mockResolvedValue({ data: returnData, error: returnError });
  chain.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: returnData, error: returnError });
  chain.then = vi
    .fn()
    .mockImplementation((resolve) =>
      resolve({ data: returnData, error: returnError }),
    );
  // Make chain itself thenable for awaits without .single()
  Object.defineProperty(chain, "then", {
    value: (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: returnData, error: returnError }).then(resolve),
    writable: true,
    configurable: true,
  });
  return chain;
}

function setupMockSupabase(options: {
  user?: typeof mockUser | null;
  queries?: Record<string, ReturnType<typeof createMockQuery>>;
}) {
  const { user = mockUser, queries = {} } = options;
  const defaultQuery = createMockQuery();

  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn((table: string) => queries[table] ?? defaultQuery),
  };

  vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
  return mockSupabase;
}

describe("executeTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T12:00:00Z"));
  });

  it("returns error when not authenticated", async () => {
    setupMockSupabase({ user: null });
    const result = await executeTool("create_task", { title: "Test" });
    expect(result).toEqual({ success: false, message: "Not authenticated" });
  });

  it("returns error for unknown tool", async () => {
    setupMockSupabase({});
    const result = await executeTool("nonexistent_tool", {});
    expect(result).toEqual({
      success: false,
      message: "Unknown tool: nonexistent_tool",
    });
  });

  describe("create_task", () => {
    it("inserts a task and returns success", async () => {
      const taskData = { id: "task-1", title: "Buy groceries" };
      const query = createMockQuery();
      query.single = vi.fn().mockResolvedValue({ data: taskData, error: null });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("create_task", {
        title: "Buy groceries",
        priority: "P2",
        due_date: "2026-06-25",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Buy groceries");
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          title: "Buy groceries",
          priority: "P2",
          due_date: "2026-06-25",
        }),
      );
    });

    it("uses defaults for optional fields", async () => {
      const query = createMockQuery();
      query.single = vi
        .fn()
        .mockResolvedValue({ data: { id: "1" }, error: null });
      setupMockSupabase({ queries: { tasks: query } });

      await executeTool("create_task", { title: "Simple task" });

      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "P3",
          status: "todo",
        }),
      );
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery();
      query.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "insert failed" },
      });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("create_task", { title: "Fail" });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  describe("list_tasks", () => {
    it('lists tasks with default "all" filter', async () => {
      const tasks = [{ id: "1", title: "Task 1" }];
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: tasks, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("list_tasks", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 tasks");
    });

    it("applies today filter", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { tasks: query } });

      await executeTool("list_tasks", { filter: "today" });
      expect(query.or).toHaveBeenCalled();
    });
  });

  describe("complete_task", () => {
    it("marks a task as done", async () => {
      const query = createMockQuery();
      query.single = vi
        .fn()
        .mockResolvedValue({ data: { title: "Done task" }, error: null });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("complete_task", {
        task_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Done task");
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "done" }),
      );
    });
  });

  describe("log_expense", () => {
    it("inserts an expense transaction", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { transactions: query } });

      const result = await executeTool("log_expense", {
        amount: 50,
        category: "Food & Drinks",
        description: "Lunch",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("AED 50");
      expect(result.message).toContain("Food & Drinks");
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "expense",
          amount: 50,
          category: "Food & Drinks",
          date: "2026-06-23",
        }),
      );
    });
  });

  describe("log_income", () => {
    it("inserts an income transaction", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { transactions: query } });

      const result = await executeTool("log_income", {
        amount: 5000,
        category: "Salary",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("AED 5000");
      expect(result.message).toContain("Salary");
    });
  });

  describe("log_habit", () => {
    it("logs a habit when found", async () => {
      const habitsQuery = createMockQuery();
      Object.defineProperty(habitsQuery, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({
            data: [{ id: "h-1", name: "Exercise" }],
            error: null,
          }).then(resolve),
        writable: true,
        configurable: true,
      });
      const logsQuery = createMockQuery();
      Object.defineProperty(logsQuery, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });

      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) => {
        if (table === "habits") return habitsQuery;
        if (table === "habit_logs") return logsQuery;
        return createMockQuery();
      });

      const result = await executeTool("log_habit", { habit_name: "Exercise" });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Exercise");
    });

    it("returns error when habit not found", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { habits: query } });

      const result = await executeTool("log_habit", {
        habit_name: "nonexistent",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("No habit found");
    });
  });

  describe("create_habit", () => {
    it("inserts a habit with reminder_time and returns success", async () => {
      const query = createMockQuery();
      query.single = vi.fn().mockResolvedValue({
        data: { id: "h-1", name: "Morning run", reminder_time: "07:00:00" },
        error: null,
      });
      const mock = setupMockSupabase({ queries: { habits: query } });
      mock.from = vi.fn((table: string) => {
        if (table === "habits") return query;
        return createMockQuery();
      });

      const result = await executeTool("create_habit", {
        name: "Morning run",
        reminder_time: "07:00",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Morning run");
      const insertArg = query.insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.reminder_time).toBe("07:00");
    });

    it("inserts a habit without reminder_time when omitted", async () => {
      const query = createMockQuery();
      query.single = vi.fn().mockResolvedValue({
        data: { id: "h-2", name: "Read", reminder_time: null },
        error: null,
      });
      const mock = setupMockSupabase({ queries: { habits: query } });
      mock.from = vi.fn((table: string) => {
        if (table === "habits") return query;
        return createMockQuery();
      });

      const result = await executeTool("create_habit", { name: "Read" });
      expect(result.success).toBe(true);
      const insertArg = query.insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.reminder_time).toBeNull();
    });
  });

  describe("update_habit", () => {
    const validHabitId = "12345678-1234-4234-8234-123456789012"; // valid RFC 4122

    it("updates a habit reminder_time to a valid time string", async () => {
      const query = createMockQuery();
      query.single = vi.fn().mockResolvedValue({
        data: { name: "Read" },
        error: null,
      });
      setupMockSupabase({ queries: { habits: query } });

      const result = await executeTool("update_habit", {
        id: validHabitId,
        reminder_time: "20:00",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Read");
    });

    it("rejects invalid reminder_time format", async () => {
      setupMockSupabase({});
      const result = await executeTool("update_habit", {
        id: validHabitId,
        reminder_time: "7am",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("create_goal", () => {
    it("inserts a goal and returns success", async () => {
      const query = createMockQuery();
      query.single = vi.fn().mockResolvedValue({
        data: { id: "g-1", title: "Learn Rust" },
        error: null,
      });
      setupMockSupabase({ queries: { goals: query } });

      const result = await executeTool("create_goal", {
        title: "Learn Rust",
        category: "professional",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Learn Rust");
    });
  });

  describe("add_note", () => {
    it("inserts a note", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { notes: query } });

      const result = await executeTool("add_note", {
        title: "My Note",
        content: "Some content",
        tags: ["dev", "ai"],
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("My Note");
    });
  });

  describe("add_contact", () => {
    it("inserts a contact", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { contacts: query } });

      const result = await executeTool("add_contact", {
        name: "John Doe",
        email: "john@example.com",
        type: "client",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("John Doe");
    });
  });

  describe("delete_task", () => {
    it("deletes a task", async () => {
      const taskId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      // returnData non-null so maybeSingle() passes the ownership preflight
      const query = createMockQuery({ id: taskId });
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("delete_task", {
        task_id: taskId,
        task_title: "Old task",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Old task");
      expect(query.delete).toHaveBeenCalled();
    });
  });

  describe("bulk_complete_tasks", () => {
    it("completes multiple tasks", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("bulk_complete_tasks", {
        task_ids: [
          "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
          "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
        ],
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("3 tasks");
    });
  });

  describe("get_daily_briefing", () => {
    it("retrieves aggregated daily data", async () => {
      const mock = setupMockSupabase({});
      const makeResolvable = (data: unknown) => {
        const q = createMockQuery();
        Object.defineProperty(q, "then", {
          value: (resolve: (v: unknown) => void) =>
            Promise.resolve({ data, error: null }).then(resolve),
          writable: true,
          configurable: true,
        });
        return q;
      };

      const tableMap: Record<string, ReturnType<typeof createMockQuery>> = {
        tasks: makeResolvable([{ title: "Review PR", priority: "high" }]),
        habits: makeResolvable([{ name: "Exercise", icon: "🏃" }]),
        habit_logs: makeResolvable([]),
        goals: makeResolvable([{ title: "Ship RISE", progress: 60 }]),
        budgets: makeResolvable([{ category: "Food", amount: 500 }]),
        transactions: makeResolvable([{ category: "Food", amount: 450 }]),
        interactions: makeResolvable([]),
      };

      mock.from = vi.fn(
        (table: string) => tableMap[table] ?? createMockQuery(),
      );

      const result = await executeTool("get_daily_briefing", {});
      expect(result.success).toBe(true);
      expect(result.message).toBe("Daily briefing retrieved");
      expect(result.data).toBeDefined();
    });
  });

  describe("search_data", () => {
    it("searches across multiple data types", async () => {
      const mock = setupMockSupabase({});
      const makeResolvable = (data: unknown) => {
        const q = createMockQuery();
        Object.defineProperty(q, "then", {
          value: (resolve: (v: unknown) => void) =>
            Promise.resolve({ data, error: null }).then(resolve),
          writable: true,
          configurable: true,
        });
        return q;
      };

      const tableMap: Record<string, ReturnType<typeof createMockQuery>> = {
        tasks: makeResolvable([
          { id: "t-1", title: "Test task", status: "todo", priority: "P2" },
        ]),
        notes: makeResolvable([]),
        contacts: makeResolvable([
          { id: "c-1", name: "Test Person", company: null, email: null },
        ]),
        goals: makeResolvable([]),
      };

      mock.from = vi.fn(
        (table: string) => tableMap[table] ?? createMockQuery(),
      );

      const result = await executeTool("search_data", { query: "Test" });
      expect(result.success).toBe(true);
      expect(result.message).toContain("2 results");
    });

    it("filters to specific data types", async () => {
      const mock = setupMockSupabase({});
      const makeResolvable = (data: unknown) => {
        const q = createMockQuery();
        Object.defineProperty(q, "then", {
          value: (resolve: (v: unknown) => void) =>
            Promise.resolve({ data, error: null }).then(resolve),
          writable: true,
          configurable: true,
        });
        return q;
      };

      mock.from = vi.fn(() => makeResolvable([]));

      const result = await executeTool("search_data", {
        query: "test",
        types: ["tasks"],
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("0 results");
    });
  });

  describe("delete_note", () => {
    it("deletes a note", async () => {
      const noteId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      // returnData non-null so maybeSingle() passes the ownership preflight
      const query = createMockQuery({ id: noteId });
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { notes: query } });

      const result = await executeTool("delete_note", {
        note_id: noteId,
        note_title: "Draft note",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Draft note");
    });
  });

  describe("get_analytics", () => {
    it("returns monthly summary with income, expenses, task and habit counts", async () => {
      const txQuery = createMockQuery([
        { type: "income", amount: 5000, category: "salary" },
        { type: "expense", amount: 200, category: "food" },
        { type: "expense", amount: 100, category: "transport" },
      ]);
      const taskQuery = createMockQuery([
        { id: "t-1", status: "done" },
        { id: "t-2", status: "done" },
        { id: "t-3", status: "in_progress" },
      ]);
      const habitQuery = createMockQuery([
        { id: "h-1", name: "Run" },
        { id: "h-2", name: "Read" },
      ]);
      const habitLogQuery = createMockQuery([
        { habit_id: "h-1", completed: true },
        { habit_id: "h-2", completed: true },
        { habit_id: "h-1", completed: false },
      ]);
      const goalQuery = createMockQuery([
        { id: "g-1", status: "active", progress: 60 },
        { id: "g-2", status: "completed", progress: 100 },
      ]);

      setupMockSupabase({
        queries: {
          transactions: txQuery,
          tasks: taskQuery,
          habits: habitQuery,
          habit_logs: habitLogQuery,
          goals: goalQuery,
        },
      });

      const result = await executeTool("get_analytics", {
        period: "month",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("analytics");
      expect(result.data).toBeDefined();
      const data = result.data as Record<string, unknown>;
      expect(data).toHaveProperty("finance");
      expect(data).toHaveProperty("tasks");
      expect(data).toHaveProperty("habits");
      expect(data).toHaveProperty("goals");
    });

    it("returns failure when not authenticated", async () => {
      setupMockSupabase({ user: null });
      const result = await executeTool("get_analytics", { period: "month" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("authenticated");
    });

    it("accepts week period", async () => {
      setupMockSupabase({});
      const result = await executeTool("get_analytics", { period: "week" });
      expect(result.success).toBe(true);
    });

    it("defaults to month when period not provided", async () => {
      setupMockSupabase({});
      const result = await executeTool("get_analytics", {});
      expect(result.success).toBe(true);
    });
  });
});

describe("executeTool with injected ToolContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the injected client and userId without creating a cookie client", async () => {
    const tasksQuery = createMockQuery([
      { id: "t1", title: "A", priority: "P1", due_date: null, status: "todo" },
    ]);
    // No auth property — proves the ctx path never calls auth.getUser()
    const injectedSupabase = { from: vi.fn(() => tasksQuery) };
    const result = await executeTool(
      "list_tasks",
      {},
      { supabase: injectedSupabase as never, userId: "user-999" },
    );
    expect(result.success).toBe(true);
    expect(injectedSupabase.from).toHaveBeenCalledWith("tasks");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("scopes writes to the injected userId", async () => {
    const tasksQuery = createMockQuery({ title: "Done task" });
    const injectedSupabase = { from: vi.fn(() => tasksQuery) };
    const result = await executeTool(
      "complete_task",
      { task_id: "123e4567-e89b-12d3-a456-426614174000" },
      { supabase: injectedSupabase as never, userId: "user-999" },
    );
    expect(result.success).toBe(true);
    expect(tasksQuery.eq).toHaveBeenCalledWith("user_id", "user-999");
    expect(createClient).not.toHaveBeenCalled();
  });
});
