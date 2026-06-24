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
        priority: "high",
        due_date: "2026-06-25",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Buy groceries");
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          title: "Buy groceries",
          priority: "high",
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
          priority: "medium",
          status: "inbox",
          is_recurring: false,
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
      expect(result.message).toBe("insert failed");
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

    it("applies inbox filter", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { tasks: query } });

      await executeTool("list_tasks", { filter: "inbox" });
      expect(query.eq).toHaveBeenCalledWith("status", "inbox");
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

      const result = await executeTool("complete_task", { task_id: "task-1" });
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
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("delete_task", {
        task_id: "task-1",
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
        task_ids: ["t-1", "t-2", "t-3"],
        summary: "Finishing sprint tasks",
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
          { id: "t-1", title: "Test task", status: "todo", priority: "high" },
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
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { notes: query } });

      const result = await executeTool("delete_note", {
        note_id: "n-1",
        note_title: "Draft note",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Draft note");
    });
  });
});
