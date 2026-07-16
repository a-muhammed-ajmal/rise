import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/ai/memory", () => ({
  storeMemory: vi.fn().mockResolvedValue(undefined),
  retrieveMemories: vi.fn().mockResolvedValue([]),
  retrieveUserFacts: vi.fn().mockResolvedValue([]),
}));

import { executeTool } from "../execute-tool";
import { createClient } from "@/lib/supabase/server";
import { retrieveMemories, retrieveUserFacts } from "@/lib/ai/memory";

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

    it("accepts the aligned P1 priority and blocked status", async () => {
      const query = createMockQuery();
      query.single = vi
        .fn()
        .mockResolvedValue({ data: { id: "t1", title: "Edge task" }, error: null });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("create_task", {
        title: "Edge task",
        priority: "P1",
        status: "blocked",
      });

      expect(result.success).toBe(true);
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({ priority: "P1", status: "blocked" }),
      );
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

  // ─── TASKS ──────────────────────────────────────────────────────────────────

  describe("update_task", () => {
    const taskId = "123e4567-e89b-12d3-a456-426614174000";

    it("updates a task and returns success", async () => {
      const query = createMockQuery({ title: "Renamed task" });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("update_task", {
        id: taskId,
        title: "Renamed task",
        priority: "P1",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Renamed task");
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Renamed task", priority: "P1" }),
      );
    });

    it("returns badInput for invalid id", async () => {
      setupMockSupabase({});
      const result = await executeTool("update_task", { id: "not-a-uuid" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "update failed" });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("update_task", {
        id: taskId,
        title: "X",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── PROJECTS ───────────────────────────────────────────────────────────────

  describe("list_projects", () => {
    it("lists projects for the user", async () => {
      const query = createMockQuery([{ id: "p1", name: "Website Revamp" }]);
      setupMockSupabase({ queries: { projects: query } });

      const result = await executeTool("list_projects", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 projects");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { projects: query } });

      const result = await executeTool("list_projects", {});
      expect(result.success).toBe(false);
    });
  });

  describe("create_project", () => {
    it("creates a project with defaults", async () => {
      const query = createMockQuery({ id: "p1", name: "New Project" });
      setupMockSupabase({ queries: { projects: query } });

      const result = await executeTool("create_project", {
        name: "New Project",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("New Project");
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Project",
          color: "#6366f1",
          status: "active",
        }),
      );
    });

    it("returns badInput for missing name", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_project", {});
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { projects: query } });
      const result = await executeTool("create_project", { name: "X" });
      expect(result.success).toBe(false);
    });
  });

  describe("update_project", () => {
    const projectId = "223e4567-e89b-12d3-a456-426614174001";

    it("updates a project", async () => {
      const query = createMockQuery({ name: "Renamed Project" });
      setupMockSupabase({ queries: { projects: query } });

      const result = await executeTool("update_project", {
        id: projectId,
        name: "Renamed Project",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Renamed Project");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { projects: query } });
      const result = await executeTool("update_project", {
        id: projectId,
        name: "X",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("delete_project", () => {
    const projectId = "223e4567-e89b-12d3-a456-426614174001";

    it("deletes a project that exists", async () => {
      const query = createMockQuery({ id: projectId, name: "Old Project" });
      setupMockSupabase({ queries: { projects: query } });

      const result = await executeTool("delete_project", {
        project_id: projectId,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Old Project");
    });

    it("returns not found when project does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { projects: query } });

      const result = await executeTool("delete_project", {
        project_id: projectId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Project not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery(
        { id: projectId, name: "Old Project" },
        { message: "boom" },
      );
      setupMockSupabase({ queries: { projects: query } });

      const result = await executeTool("delete_project", {
        project_id: projectId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── GOALS ──────────────────────────────────────────────────────────────────

  describe("list_goals", () => {
    it("lists active goals by default", async () => {
      const query = createMockQuery([{ id: "g1", title: "Run a marathon" }]);
      setupMockSupabase({ queries: { goals: query } });

      const result = await executeTool("list_goals", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 goals");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { goals: query } });
      const result = await executeTool("list_goals", { status: "all" });
      expect(result.success).toBe(false);
    });
  });

  describe("update_goal", () => {
    const goalId = "323e4567-e89b-12d3-a456-426614174002";

    it("updates a goal", async () => {
      const query = createMockQuery({ title: "Renamed goal" });
      setupMockSupabase({ queries: { goals: query } });

      const result = await executeTool("update_goal", {
        id: goalId,
        progress: 50,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Renamed goal");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { goals: query } });
      const result = await executeTool("update_goal", { id: goalId });
      expect(result.success).toBe(false);
    });
  });

  describe("complete_goal", () => {
    const goalId = "323e4567-e89b-12d3-a456-426614174002";

    it("marks a goal completed", async () => {
      const query = createMockQuery({ title: "Run a marathon" });
      setupMockSupabase({ queries: { goals: query } });

      const result = await executeTool("complete_goal", { id: goalId });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Run a marathon");
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed", progress: 100 }),
      );
    });

    it("returns badInput for missing id", async () => {
      setupMockSupabase({});
      const result = await executeTool("complete_goal", {});
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { goals: query } });
      const result = await executeTool("complete_goal", { id: goalId });
      expect(result.success).toBe(false);
    });
  });

  describe("delete_goal", () => {
    const goalId = "323e4567-e89b-12d3-a456-426614174002";

    it("deletes a goal that exists", async () => {
      const query = createMockQuery({ id: goalId, title: "Old Goal" });
      setupMockSupabase({ queries: { goals: query } });

      const result = await executeTool("delete_goal", { goal_id: goalId });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Old Goal");
    });

    it("returns not found when goal does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { goals: query } });
      const result = await executeTool("delete_goal", { goal_id: goalId });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Goal not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery(
        { id: goalId, title: "Old Goal" },
        { message: "boom" },
      );
      setupMockSupabase({ queries: { goals: query } });
      const result = await executeTool("delete_goal", { goal_id: goalId });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── MILESTONES ─────────────────────────────────────────────────────────────

  describe("create_milestone", () => {
    const goalId = "323e4567-e89b-12d3-a456-426614174002";

    it("creates a milestone", async () => {
      const query = createMockQuery({ id: "m1", title: "Run 10km" });
      setupMockSupabase({ queries: { milestones: query } });

      const result = await executeTool("create_milestone", {
        goal_id: goalId,
        title: "Run 10km",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Run 10km");
    });

    it("returns badInput for missing title", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_milestone", {
        goal_id: goalId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { milestones: query } });
      const result = await executeTool("create_milestone", {
        goal_id: goalId,
        title: "X",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("list_milestones", () => {
    const goalId = "323e4567-e89b-12d3-a456-426614174002";

    it("lists milestones for a goal", async () => {
      const query = createMockQuery([{ id: "m1", title: "Run 10km" }]);
      setupMockSupabase({ queries: { milestones: query } });

      const result = await executeTool("list_milestones", { goal_id: goalId });
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 milestones");
    });

    it("returns badInput for missing goal_id", async () => {
      setupMockSupabase({});
      const result = await executeTool("list_milestones", {});
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { milestones: query } });
      const result = await executeTool("list_milestones", {
        goal_id: goalId,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("update_milestone", () => {
    const milestoneId = "423e4567-e89b-12d3-a456-426614174003";

    it("updates a milestone", async () => {
      const query = createMockQuery({ title: "Run 15km" });
      setupMockSupabase({ queries: { milestones: query } });

      const result = await executeTool("update_milestone", {
        id: milestoneId,
        title: "Run 15km",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Run 15km");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { milestones: query } });
      const result = await executeTool("update_milestone", {
        id: milestoneId,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("complete_milestone", () => {
    const milestoneId = "423e4567-e89b-12d3-a456-426614174003";

    it("marks a milestone completed", async () => {
      const query = createMockQuery({ title: "Run 10km" });
      setupMockSupabase({ queries: { milestones: query } });

      const result = await executeTool("complete_milestone", {
        id: milestoneId,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Run 10km");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { milestones: query } });
      const result = await executeTool("complete_milestone", {
        id: milestoneId,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("delete_milestone", () => {
    const milestoneId = "423e4567-e89b-12d3-a456-426614174003";

    it("deletes a milestone that exists", async () => {
      const query = createMockQuery({ id: milestoneId, title: "Old MS" });
      setupMockSupabase({ queries: { milestones: query } });

      const result = await executeTool("delete_milestone", {
        milestone_id: milestoneId,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Old MS");
    });

    it("returns not found when milestone does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { milestones: query } });
      const result = await executeTool("delete_milestone", {
        milestone_id: milestoneId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Milestone not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery(
        { id: milestoneId, title: "Old MS" },
        { message: "boom" },
      );
      setupMockSupabase({ queries: { milestones: query } });
      const result = await executeTool("delete_milestone", {
        milestone_id: milestoneId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── HABITS ─────────────────────────────────────────────────────────────────

  describe("list_habits", () => {
    it("marks habits already logged today as done", async () => {
      const habitsQuery = createMockQuery([
        { id: "h1", name: "Run", icon: "🏃", color: "#fff", frequency: "daily", active: true },
      ]);
      const logsQuery = createMockQuery([{ habit_id: "h1" }]);
      setupMockSupabase({
        queries: { habits: habitsQuery, habit_logs: logsQuery },
      });

      const result = await executeTool("list_habits", {});
      expect(result.success).toBe(true);
      const data = result.data as Array<{ done_today: boolean }>;
      expect(data[0].done_today).toBe(true);
    });

    it("returns an empty list when the user has no habits", async () => {
      const habitsQuery = createMockQuery([]);
      const logsQuery = createMockQuery([]);
      setupMockSupabase({
        queries: { habits: habitsQuery, habit_logs: logsQuery },
      });

      const result = await executeTool("list_habits", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("0 active habits");
    });
  });

  describe("delete_habit", () => {
    const habitId = "523e4567-e89b-12d3-a456-426614174004";

    it("deletes a habit that exists", async () => {
      const query = createMockQuery({ id: habitId, name: "Meditate" });
      setupMockSupabase({ queries: { habits: query } });

      const result = await executeTool("delete_habit", { habit_id: habitId });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Meditate");
    });

    it("returns not found when habit does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { habits: query } });
      const result = await executeTool("delete_habit", { habit_id: habitId });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Habit not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery(
        { id: habitId, name: "Meditate" },
        { message: "boom" },
      );
      setupMockSupabase({ queries: { habits: query } });
      const result = await executeTool("delete_habit", { habit_id: habitId });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  describe("delete_habit_log", () => {
    const habitId = "523e4567-e89b-12d3-a456-426614174004";

    it("removes a habit log for a date", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { habit_logs: query } });

      const result = await executeTool("delete_habit_log", {
        habit_id: habitId,
        logged_date: "2026-06-20",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("2026-06-20");
    });

    it("returns badInput for a malformed date", async () => {
      setupMockSupabase({});
      const result = await executeTool("delete_habit_log", {
        habit_id: habitId,
        logged_date: "20-06-2026",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { habit_logs: query } });
      const result = await executeTool("delete_habit_log", {
        habit_id: habitId,
        logged_date: "2026-06-20",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── CONTACTS ───────────────────────────────────────────────────────────────

  describe("list_contacts", () => {
    it("lists contacts for the user", async () => {
      const query = createMockQuery([{ id: "c1", name: "Jane Doe" }]);
      setupMockSupabase({ queries: { contacts: query } });

      const result = await executeTool("list_contacts", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 contacts");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { contacts: query } });
      const result = await executeTool("list_contacts", { type: "client" });
      expect(result.success).toBe(false);
    });
  });

  describe("update_contact", () => {
    const contactId = "623e4567-e89b-12d3-a456-426614174005";

    it("updates a contact", async () => {
      const query = createMockQuery({ name: "Jane Smith" });
      setupMockSupabase({ queries: { contacts: query } });

      const result = await executeTool("update_contact", {
        id: contactId,
        name: "Jane Smith",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Jane Smith");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { contacts: query } });
      const result = await executeTool("update_contact", { id: contactId });
      expect(result.success).toBe(false);
    });
  });

  describe("delete_contact", () => {
    const contactId = "623e4567-e89b-12d3-a456-426614174005";

    it("deletes a contact that exists", async () => {
      const query = createMockQuery({ id: contactId, name: "Jane Doe" });
      setupMockSupabase({ queries: { contacts: query } });

      const result = await executeTool("delete_contact", {
        contact_id: contactId,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Jane Doe");
    });

    it("returns not found when contact does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { contacts: query } });
      const result = await executeTool("delete_contact", {
        contact_id: contactId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Contact not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery(
        { id: contactId, name: "Jane Doe" },
        { message: "boom" },
      );
      setupMockSupabase({ queries: { contacts: query } });
      const result = await executeTool("delete_contact", {
        contact_id: contactId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── INTERACTIONS ───────────────────────────────────────────────────────────

  describe("create_interaction", () => {
    const contactId = "623e4567-e89b-12d3-a456-426614174005";

    it("logs an interaction", async () => {
      const query = createMockQuery({ id: "i1" });
      setupMockSupabase({ queries: { interactions: query } });

      const result = await executeTool("create_interaction", {
        contact_id: contactId,
        type: "call",
        notes: "Discussed proposal",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("call");
    });

    it("returns badInput for missing notes", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_interaction", {
        contact_id: contactId,
        type: "call",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { interactions: query } });
      const result = await executeTool("create_interaction", {
        contact_id: contactId,
        type: "call",
        notes: "X",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("list_interactions", () => {
    const contactId = "623e4567-e89b-12d3-a456-426614174005";

    it("lists interactions for a contact", async () => {
      const query = createMockQuery([{ id: "i1", type: "call" }]);
      setupMockSupabase({ queries: { interactions: query } });

      const result = await executeTool("list_interactions", {
        contact_id: contactId,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 interactions");
    });

    it("returns badInput for missing contact_id", async () => {
      setupMockSupabase({});
      const result = await executeTool("list_interactions", {});
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { interactions: query } });
      const result = await executeTool("list_interactions", {
        contact_id: contactId,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("update_interaction", () => {
    const interactionId = "723e4567-e89b-12d3-a456-426614174006";

    it("updates an interaction", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { interactions: query } });

      const result = await executeTool("update_interaction", {
        id: interactionId,
        notes: "Updated notes",
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Interaction updated.");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { interactions: query } });
      const result = await executeTool("update_interaction", {
        id: interactionId,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("delete_interaction", () => {
    const interactionId = "723e4567-e89b-12d3-a456-426614174006";

    it("deletes an interaction that exists", async () => {
      const query = createMockQuery({ id: interactionId }, null);
      setupMockSupabase({ queries: { interactions: query } });

      const result = await executeTool("delete_interaction", {
        interaction_id: interactionId,
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Interaction deleted.");
    });

    it("returns not found when interaction does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { interactions: query } });
      const result = await executeTool("delete_interaction", {
        interaction_id: interactionId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Interaction not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery({ id: interactionId }, { message: "boom" });
      setupMockSupabase({ queries: { interactions: query } });
      const result = await executeTool("delete_interaction", {
        interaction_id: interactionId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── NOTES ──────────────────────────────────────────────────────────────────

  describe("list_notes", () => {
    it("lists notes for the user", async () => {
      const query = createMockQuery([{ id: "n1", title: "Idea" }]);
      setupMockSupabase({ queries: { notes: query } });

      const result = await executeTool("list_notes", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 notes");
    });

    it("filters by tag", async () => {
      const query = createMockQuery([{ id: "n1", title: "Idea" }]);
      setupMockSupabase({ queries: { notes: query } });

      await executeTool("list_notes", { tag: "work" });
      expect(query.contains).toHaveBeenCalledWith("tags", ["work"]);
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { notes: query } });
      const result = await executeTool("list_notes", {});
      expect(result.success).toBe(false);
    });
  });

  describe("update_note", () => {
    const noteId = "823e4567-e89b-12d3-a456-426614174007";

    it("updates a note", async () => {
      const query = createMockQuery({ title: "Renamed note" });
      setupMockSupabase({ queries: { notes: query } });

      const result = await executeTool("update_note", {
        id: noteId,
        title: "Renamed note",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Renamed note");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { notes: query } });
      const result = await executeTool("update_note", { id: noteId });
      expect(result.success).toBe(false);
    });
  });

  // ─── DOCUMENTS ──────────────────────────────────────────────────────────────

  describe("list_documents", () => {
    it("lists documents for the user", async () => {
      const query = createMockQuery([{ id: "d1", name: "Passport.pdf" }]);
      setupMockSupabase({ queries: { documents: query } });

      const result = await executeTool("list_documents", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 documents");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { documents: query } });
      const result = await executeTool("list_documents", {});
      expect(result.success).toBe(false);
    });
  });

  describe("create_document", () => {
    it("saves a document", async () => {
      const query = createMockQuery({ id: "d1", name: "Passport.pdf" });
      setupMockSupabase({ queries: { documents: query } });

      const result = await executeTool("create_document", {
        name: "Passport.pdf",
        file_path: "/uploads/passport.pdf",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Passport.pdf");
    });

    it("returns badInput for missing file_path", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_document", {
        name: "X",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { documents: query } });
      const result = await executeTool("create_document", {
        name: "X",
        file_path: "/x",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("update_document", () => {
    const documentId = "923e4567-e89b-12d3-a456-426614174008";

    it("updates a document", async () => {
      const query = createMockQuery({ name: "Renamed.pdf" });
      setupMockSupabase({ queries: { documents: query } });

      const result = await executeTool("update_document", {
        id: documentId,
        name: "Renamed.pdf",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Renamed.pdf");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { documents: query } });
      const result = await executeTool("update_document", { id: documentId });
      expect(result.success).toBe(false);
    });
  });

  describe("delete_document", () => {
    const documentId = "923e4567-e89b-12d3-a456-426614174008";

    it("deletes a document that exists", async () => {
      const query = createMockQuery({ id: documentId, name: "Old.pdf" });
      setupMockSupabase({ queries: { documents: query } });

      const result = await executeTool("delete_document", {
        document_id: documentId,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Old.pdf");
    });

    it("returns not found when document does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { documents: query } });
      const result = await executeTool("delete_document", {
        document_id: documentId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Document not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery(
        { id: documentId, name: "Old.pdf" },
        { message: "boom" },
      );
      setupMockSupabase({ queries: { documents: query } });
      const result = await executeTool("delete_document", {
        document_id: documentId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── LINKS ──────────────────────────────────────────────────────────────────

  describe("list_links", () => {
    it("lists links for the user", async () => {
      const query = createMockQuery([{ id: "l1", url: "https://example.com" }]);
      setupMockSupabase({ queries: { links: query } });

      const result = await executeTool("list_links", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 links");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { links: query } });
      const result = await executeTool("list_links", {});
      expect(result.success).toBe(false);
    });
  });

  describe("create_link", () => {
    it("saves a link", async () => {
      const query = createMockQuery({ id: "l1", url: "https://example.com" });
      setupMockSupabase({ queries: { links: query } });

      const result = await executeTool("create_link", {
        url: "https://example.com",
        title: "Example",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Example");
    });

    it("returns badInput for an invalid url", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_link", { url: "not-a-url" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { links: query } });
      const result = await executeTool("create_link", {
        url: "https://example.com",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("update_link", () => {
    const linkId = "a23e4567-e89b-12d3-a456-426614174009";

    it("updates a link", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { links: query } });

      const result = await executeTool("update_link", {
        id: linkId,
        title: "New title",
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Link updated.");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { links: query } });
      const result = await executeTool("update_link", { id: linkId });
      expect(result.success).toBe(false);
    });
  });

  describe("delete_link", () => {
    const linkId = "a23e4567-e89b-12d3-a456-426614174009";

    it("deletes a link that exists", async () => {
      const query = createMockQuery({ id: linkId }, null);
      setupMockSupabase({ queries: { links: query } });

      const result = await executeTool("delete_link", { id: linkId });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Link deleted.");
    });

    it("returns not found when link does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { links: query } });
      const result = await executeTool("delete_link", { id: linkId });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Link not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery({ id: linkId }, { message: "boom" });
      setupMockSupabase({ queries: { links: query } });
      const result = await executeTool("delete_link", { id: linkId });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── JOURNAL ENTRIES ────────────────────────────────────────────────────────

  describe("list_journal_entries", () => {
    it("lists journal entries for the user", async () => {
      const query = createMockQuery([{ id: "j1", date: "2026-06-20" }]);
      setupMockSupabase({ queries: { journal_entries: query } });

      const result = await executeTool("list_journal_entries", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 journal entries");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { journal_entries: query } });
      const result = await executeTool("list_journal_entries", {});
      expect(result.success).toBe(false);
    });
  });

  describe("create_journal_entry", () => {
    it("saves a journal entry", async () => {
      const query = createMockQuery({ id: "j1" });
      setupMockSupabase({ queries: { journal_entries: query } });

      const result = await executeTool("create_journal_entry", {
        date: "2026-06-20",
        content: "Good day overall.",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("2026-06-20");
    });

    it("returns badInput for missing content", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_journal_entry", {
        date: "2026-06-20",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { journal_entries: query } });
      const result = await executeTool("create_journal_entry", {
        date: "2026-06-20",
        content: "X",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("update_journal_entry", () => {
    const entryId = "b23e4567-e89b-12d3-a456-426614174010";

    it("updates a journal entry", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { journal_entries: query } });

      const result = await executeTool("update_journal_entry", {
        id: entryId,
        mood: 4,
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Journal entry updated.");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { journal_entries: query } });
      const result = await executeTool("update_journal_entry", { id: entryId });
      expect(result.success).toBe(false);
    });
  });

  describe("delete_journal_entry", () => {
    const entryId = "b23e4567-e89b-12d3-a456-426614174010";

    it("deletes a journal entry that exists", async () => {
      const query = createMockQuery({ id: entryId, date: "2026-06-20" }, null);
      setupMockSupabase({ queries: { journal_entries: query } });

      const result = await executeTool("delete_journal_entry", {
        entry_id: entryId,
        entry_date: "2026-06-20",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("2026-06-20");
    });

    it("returns not found when entry does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { journal_entries: query } });
      const result = await executeTool("delete_journal_entry", {
        entry_id: entryId,
        entry_date: "2026-06-20",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Journal entry not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery(
        { id: entryId, date: "2026-06-20" },
        { message: "boom" },
      );
      setupMockSupabase({ queries: { journal_entries: query } });
      const result = await executeTool("delete_journal_entry", {
        entry_id: entryId,
        entry_date: "2026-06-20",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── REVIEWS ────────────────────────────────────────────────────────────────

  describe("list_reviews", () => {
    it("lists reviews for the user", async () => {
      const query = createMockQuery([{ id: "r1", type: "weekly" }]);
      setupMockSupabase({ queries: { reviews: query } });

      const result = await executeTool("list_reviews", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 reviews");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { reviews: query } });
      const result = await executeTool("list_reviews", { type: "weekly" });
      expect(result.success).toBe(false);
    });
  });

  describe("create_review", () => {
    it("creates a review", async () => {
      const query = createMockQuery({ id: "r1" });
      setupMockSupabase({ queries: { reviews: query } });

      const result = await executeTool("create_review", {
        type: "weekly",
        period_start: "2026-06-16",
        period_end: "2026-06-22",
        content: "Solid week.",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("weekly");
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({ content: { text: "Solid week." } }),
      );
    });

    it("returns badInput for missing period_end", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_review", {
        type: "weekly",
        period_start: "2026-06-16",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { reviews: query } });
      const result = await executeTool("create_review", {
        type: "weekly",
        period_start: "2026-06-16",
        period_end: "2026-06-22",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("update_review", () => {
    const reviewId = "c23e4567-e89b-12d3-a456-426614174011";

    it("updates a review's content", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { reviews: query } });

      const result = await executeTool("update_review", {
        id: reviewId,
        content: "Updated reflections.",
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Review updated.");
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { text: "Updated reflections." },
        }),
      );
    });

    it("updates a review without touching content", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { reviews: query } });

      await executeTool("update_review", { id: reviewId, mood: 3 });
      expect(query.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ content: expect.anything() }),
      );
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { reviews: query } });
      const result = await executeTool("update_review", { id: reviewId });
      expect(result.success).toBe(false);
    });
  });

  describe("delete_review", () => {
    const reviewId = "c23e4567-e89b-12d3-a456-426614174011";

    it("deletes a review that exists", async () => {
      const query = createMockQuery(
        { id: reviewId, type: "weekly", period_start: "2026-06-16" },
        null,
      );
      setupMockSupabase({ queries: { reviews: query } });

      const result = await executeTool("delete_review", {
        review_id: reviewId,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("weekly");
    });

    it("returns not found when review does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { reviews: query } });
      const result = await executeTool("delete_review", {
        review_id: reviewId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Review not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery(
        { id: reviewId, type: "weekly", period_start: "2026-06-16" },
        { message: "boom" },
      );
      setupMockSupabase({ queries: { reviews: query } });
      const result = await executeTool("delete_review", {
        review_id: reviewId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── FOCUS SESSIONS ─────────────────────────────────────────────────────────

  describe("list_focus_sessions", () => {
    it("lists focus sessions for the user", async () => {
      const query = createMockQuery([{ id: "f1", duration_minutes: 25 }]);
      setupMockSupabase({ queries: { focus_sessions: query } });

      const result = await executeTool("list_focus_sessions", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 focus sessions");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { focus_sessions: query } });
      const result = await executeTool("list_focus_sessions", {});
      expect(result.success).toBe(false);
    });
  });

  describe("create_focus_session", () => {
    it("records a focus session", async () => {
      const query = createMockQuery({ id: "f1" });
      setupMockSupabase({ queries: { focus_sessions: query } });

      const result = await executeTool("create_focus_session", {
        duration_minutes: 25,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("25-minute");
    });

    it("returns badInput for a non-positive duration", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_focus_session", {
        duration_minutes: 0,
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { focus_sessions: query } });
      const result = await executeTool("create_focus_session", {
        duration_minutes: 25,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("update_focus_session", () => {
    const sessionId = "d23e4567-e89b-12d3-a456-426614174012";

    it("updates a focus session", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { focus_sessions: query } });

      const result = await executeTool("update_focus_session", {
        id: sessionId,
        notes: "Deep work",
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Focus session updated.");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { focus_sessions: query } });
      const result = await executeTool("update_focus_session", {
        id: sessionId,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("delete_focus_session", () => {
    const sessionId = "d23e4567-e89b-12d3-a456-426614174012";

    it("deletes a focus session that exists", async () => {
      const query = createMockQuery({ id: sessionId }, null);
      setupMockSupabase({ queries: { focus_sessions: query } });

      const result = await executeTool("delete_focus_session", {
        id: sessionId,
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Focus session deleted.");
    });

    it("returns not found when session does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { focus_sessions: query } });
      const result = await executeTool("delete_focus_session", {
        id: sessionId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Focus session not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery({ id: sessionId }, { message: "boom" });
      setupMockSupabase({ queries: { focus_sessions: query } });
      const result = await executeTool("delete_focus_session", {
        id: sessionId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── PERSONAL MEMORY ────────────────────────────────────────────────────────

  describe("remember_user_fact", () => {
    it("merges a new fact into the user's profile", async () => {
      const query = createMockQuery({ facts: { favorite_color: "blue" } }, null);
      setupMockSupabase({ queries: { user_profile: query } });

      const result = await executeTool("remember_user_fact", {
        key: "favorite_food",
        value: "pizza",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("favorite_food");
      expect(query.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          facts: { favorite_color: "blue", favorite_food: "pizza" },
        }),
        { onConflict: "user_id" },
      );
    });

    it("returns badInput for missing value", async () => {
      setupMockSupabase({});
      const result = await executeTool("remember_user_fact", {
        key: "favorite_food",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { user_profile: query } });
      const result = await executeTool("remember_user_fact", {
        key: "k",
        value: "v",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  describe("recall_memories", () => {
    it("merges profile facts and semantic memories", async () => {
      setupMockSupabase({});
      vi.mocked(retrieveUserFacts).mockResolvedValueOnce([
        { content: "Likes pizza" } as never,
      ]);
      vi.mocked(retrieveMemories).mockResolvedValueOnce([
        { content: "Asked about vacation plans", similarity: 0.8 } as never,
      ]);

      const result = await executeTool("recall_memories", {
        query: "food preferences",
      });
      expect(result.success).toBe(true);
      const data = result.data as Array<{ similarity: number }>;
      expect(data).toHaveLength(2);
      expect(data[0].similarity).toBe(1);
    });

    it("reports no memories found when both sources are empty", async () => {
      setupMockSupabase({});
      vi.mocked(retrieveUserFacts).mockResolvedValueOnce([]);
      vi.mocked(retrieveMemories).mockResolvedValueOnce([]);

      const result = await executeTool("recall_memories", { query: "x" });
      expect(result.success).toBe(true);
      expect(result.message).toBe("No relevant memories found.");
      expect(result.data).toEqual([]);
    });

    it("returns badInput for missing query", async () => {
      setupMockSupabase({});
      const result = await executeTool("recall_memories", {});
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });
  });

  // ─── Remaining badInput edge cases (schema-validated update/delete tools) ──

  describe("additional invalid-input edge cases", () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["update_project", { id: "not-a-uuid" }],
      ["delete_project", { project_id: "not-a-uuid" }],
      ["update_goal", { id: "not-a-uuid" }],
      ["delete_goal", { goal_id: "not-a-uuid" }],
      ["update_milestone", { id: "not-a-uuid" }],
      ["complete_milestone", { id: "not-a-uuid" }],
      ["delete_milestone", { milestone_id: "not-a-uuid" }],
      ["delete_habit", { habit_id: "not-a-uuid" }],
      ["update_contact", { id: "not-a-uuid" }],
      ["delete_contact", { contact_id: "not-a-uuid" }],
      ["update_interaction", { id: "not-a-uuid" }],
      ["delete_interaction", { interaction_id: "not-a-uuid" }],
      ["update_note", { id: "not-a-uuid" }],
      ["update_document", { id: "not-a-uuid" }],
      ["delete_document", { document_id: "not-a-uuid" }],
      ["update_link", { id: "not-a-uuid" }],
      ["delete_link", { id: "not-a-uuid" }],
      ["update_journal_entry", { id: "not-a-uuid" }],
      ["delete_journal_entry", { entry_id: "not-a-uuid", entry_date: "2026-06-20" }],
      ["update_review", { id: "not-a-uuid" }],
      ["delete_review", { review_id: "not-a-uuid" }],
      ["update_focus_session", { id: "not-a-uuid" }],
      ["delete_focus_session", { id: "not-a-uuid" }],
    ];

    it.each(cases)("returns badInput for %s with malformed id", async (toolName, input) => {
      setupMockSupabase({});
      const result = await executeTool(toolName, input);
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });
  });

  describe("list_focus_sessions with task filter", () => {
    it("filters by task_id when provided", async () => {
      const query = createMockQuery([]);
      setupMockSupabase({ queries: { focus_sessions: query } });

      await executeTool("list_focus_sessions", {
        task_id: "d23e4567-e89b-12d3-a456-426614174012",
      });
      expect(query.eq).toHaveBeenCalledWith(
        "task_id",
        "d23e4567-e89b-12d3-a456-426614174012",
      );
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
