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
  // Soft delete (022): every read filters `.is("deleted_at", null)`, and the
  // recycle-bin tools invert it with `.not("deleted_at", "is", null)`.
  chain.is = vi.fn().mockReturnValue(chain);
  chain.contains = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockReturnValue(chain);
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

    it("persists due_time, estimated_time, recurrence, reminder and area", async () => {
      const query = createMockQuery();
      query.single = vi
        .fn()
        .mockResolvedValue({ data: { id: "t2", title: "Full task" }, error: null });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("create_task", {
        title: "Full task",
        due_date: "2026-06-25",
        due_time: "15:00",
        estimated_time: 45,
        recurrence: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
        reminder: "2026-06-25T08:00:00Z",
        area: "professional",
      });

      expect(result.success).toBe(true);
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          due_time: "15:00",
          estimated_time: 45,
          recurrence: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
          reminder: "2026-06-25T08:00:00Z",
          area: "professional",
        }),
      );
    });

    it("normalizes subtasks and backfills missing ids", async () => {
      const query = createMockQuery();
      query.single = vi
        .fn()
        .mockResolvedValue({ data: { id: "t3", title: "With checklist" }, error: null });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("create_task", {
        title: "With checklist",
        subtasks: [{ title: "Step 1" }, { title: "Step 2", done: true }],
      });

      expect(result.success).toBe(true);
      const insertArg = query.insert.mock.calls[0][0] as {
        subtasks: { id: string; title: string; done: boolean }[];
      };
      expect(insertArg.subtasks).toHaveLength(2);
      expect(insertArg.subtasks[0].id).toBeTruthy();
      expect(insertArg.subtasks[0].done).toBe(false);
      expect(insertArg.subtasks[1].done).toBe(true);
    });

    it("rejects an unparseable recurrence rule", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_task", {
        title: "Bad rule",
        recurrence: "NOT_A_RULE",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("rejects a project_id not owned by the caller", async () => {
      const tasksQuery = createMockQuery();
      const projectsQuery = createMockQuery(null); // lookup finds nothing
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "projects" ? projectsQuery : tasksQuery,
      );

      const result = await executeTool("create_task", {
        title: "Orphan task",
        project_id: "223e4567-e89b-12d3-a456-426614174099",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Project not found");
      expect(tasksQuery.insert).not.toHaveBeenCalled();
    });

    it("accepts a project_id owned by the caller", async () => {
      const tasksQuery = createMockQuery();
      tasksQuery.single = vi
        .fn()
        .mockResolvedValue({ data: { id: "t4", title: "Linked task" }, error: null });
      const projectsQuery = createMockQuery({ id: "323e4567-e89b-12d3-a456-426614174100" });
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "projects" ? projectsQuery : tasksQuery,
      );

      const result = await executeTool("create_task", {
        title: "Linked task",
        project_id: "323e4567-e89b-12d3-a456-426614174100",
      });
      expect(result.success).toBe(true);
      expect(tasksQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: "323e4567-e89b-12d3-a456-426614174100" }),
      );
    });
  });

  describe("duplicate_task", () => {
    const taskId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const existingTask = {
      id: taskId,
      title: "Original",
      description: "desc",
      status: "done",
      priority: "P2",
      due_date: "2026-06-25",
      due_time: "09:00",
      project_id: "323e4567-e89b-12d3-a456-426614174100",
      area: "personal",
      labels: ["work"],
      estimated_time: 30,
    };

    it("copies the task, resetting status, recurrence and focus", async () => {
      const query = createMockQuery(existingTask);
      query.maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: existingTask, error: null });
      query.single = vi.fn().mockResolvedValue({
        data: { id: "copy-1", title: "Original (copy)" },
        error: null,
      });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("duplicate_task", { task_id: taskId });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Original (copy)");
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Original (copy)",
          status: "todo",
          is_focus: false,
          recurrence: null,
          subtasks: [],
        }),
      );
    });

    it("returns not found when the task does not exist", async () => {
      const query = createMockQuery(null);
      query.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("duplicate_task", { task_id: taskId });
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("returns error on Supabase insert failure", async () => {
      const query = createMockQuery(existingTask);
      query.maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: existingTask, error: null });
      query.single = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "boom" } });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("duplicate_task", { task_id: taskId });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  describe("bulk_update_task_priority", () => {
    it("updates priority for multiple tasks", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: [{ id: "1" }, { id: "2" }], error: null }).then(
            resolve,
          ),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("bulk_update_task_priority", {
        task_ids: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
        priority: "P1",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("P1");
      expect(query.update).toHaveBeenCalledWith({ priority: "P1" });
    });

    it("returns badInput for an invalid priority", async () => {
      setupMockSupabase({});
      const result = await executeTool("bulk_update_task_priority", {
        task_ids: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
        priority: "P9",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns badInput for an empty task_ids array", async () => {
      setupMockSupabase({});
      const result = await executeTool("bulk_update_task_priority", {
        task_ids: [],
        priority: "P1",
      });
      expect(result.success).toBe(false);
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

    it("returns badInput for a non-positive amount", async () => {
      setupMockSupabase({});
      const result = await executeTool("log_expense", {
        amount: 0,
        category: "Food",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { transactions: query } });
      const result = await executeTool("log_expense", {
        amount: 50,
        category: "Food",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });

    it("persists tags on the transaction", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { transactions: query } });

      await executeTool("log_expense", {
        amount: 20,
        category: "Food",
        tags: ["work-lunch"],
      });
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ["work-lunch"] }),
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

    it("returns badInput for a missing category", async () => {
      setupMockSupabase({});
      const result = await executeTool("log_income", { amount: 100 });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { transactions: query } });
      const result = await executeTool("log_income", {
        amount: 100,
        category: "Salary",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });

    it("persists tags on the transaction", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { transactions: query } });

      await executeTool("log_income", {
        amount: 100,
        category: "Salary",
        tags: ["bonus"],
      });
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ["bonus"] }),
      );
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

    it("logs a habit with a backdated date, note, and explicit miss", async () => {
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

      const result = await executeTool("log_habit", {
        habit_name: "Exercise",
        logged_date: "2026-06-20",
        completed: false,
        note: "Skipped, was sick",
      });
      expect(result.success).toBe(true);
      expect(logsQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          logged_date: "2026-06-20",
          completed: false,
          note: "Skipped, was sick",
        }),
        expect.anything(),
      );
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

    it("uses the star default icon when omitted, and a custom one when given", async () => {
      const query = createMockQuery();
      query.single = vi.fn().mockResolvedValue({
        data: { id: "h-3", name: "Meditate" },
        error: null,
      });
      setupMockSupabase({ queries: { habits: query } });

      await executeTool("create_habit", { name: "Meditate" });
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({ icon: "⭐" }),
      );

      await executeTool("create_habit", { name: "Meditate", icon: "🧘" });
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({ icon: "🧘" }),
      );
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

    it("updates the habit icon", async () => {
      const query = createMockQuery();
      query.single = vi.fn().mockResolvedValue({
        data: { name: "Read" },
        error: null,
      });
      setupMockSupabase({ queries: { habits: query } });

      const result = await executeTool("update_habit", {
        id: validHabitId,
        icon: "📚",
      });
      expect(result.success).toBe(true);
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ icon: "📚" }),
      );
    });
  });

  describe("update_habit_log", () => {
    const logId = "34567890-1234-4234-8234-123456789012";

    it("updates note, date and completed status", async () => {
      const query = createMockQuery({ id: logId });
      query.maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: { id: logId }, error: null });
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { habit_logs: query } });

      const result = await executeTool("update_habit_log", {
        id: logId,
        note: "Felt great",
        completed: true,
      });
      expect(result.success).toBe(true);
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ note: "Felt great", completed: true }),
      );
    });

    it("returns not found when the log does not exist", async () => {
      const query = createMockQuery(null);
      query.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      setupMockSupabase({ queries: { habit_logs: query } });

      const result = await executeTool("update_habit_log", {
        id: logId,
        note: "x",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("returns a friendly message on a date conflict", async () => {
      const query = createMockQuery({ id: logId });
      query.maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: { id: logId }, error: null });
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({
            data: null,
            error: { code: "23505", message: "duplicate key" },
          }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { habit_logs: query } });

      const result = await executeTool("update_habit_log", {
        id: logId,
        logged_date: "2026-06-20",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("already exists");
    });

    it("returns a generic error on other Supabase failures", async () => {
      const query = createMockQuery({ id: logId });
      query.maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: { id: logId }, error: null });
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({
            data: null,
            error: { message: "boom" },
          }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { habit_logs: query } });

      const result = await executeTool("update_habit_log", {
        id: logId,
        note: "x",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  describe("list_habit_logs", () => {
    it("lists logs with default pagination", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({
            data: [{ id: "l1", logged_date: "2026-06-20" }],
            error: null,
          }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { habit_logs: query } });

      const result = await executeTool("list_habit_logs", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 habit logs");
    });

    it("filters by habit_id and date range", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { habit_logs: query } });

      await executeTool("list_habit_logs", {
        habit_id: "12345678-1234-4234-8234-123456789012",
        start_date: "2026-06-01",
        end_date: "2026-06-30",
      });
      expect(query.eq).toHaveBeenCalledWith(
        "habit_id",
        "12345678-1234-4234-8234-123456789012",
      );
      expect(query.gte).toHaveBeenCalledWith("logged_date", "2026-06-01");
      expect(query.lte).toHaveBeenCalledWith("logged_date", "2026-06-30");
    });

    it("returns badInput for an invalid habit_id", async () => {
      setupMockSupabase({});
      const result = await executeTool("list_habit_logs", {
        habit_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
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

    it("links to an owned task", async () => {
      const notesQuery = createMockQuery();
      Object.defineProperty(notesQuery, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      const linkedTaskId = "423e4567-e89b-12d3-a456-426614174101";
      const tasksQuery = createMockQuery({ id: linkedTaskId });
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "tasks" ? tasksQuery : notesQuery,
      );

      const result = await executeTool("add_note", {
        title: "Linked",
        content: "content",
        linked_to_type: "task",
        linked_to_id: linkedTaskId,
      });
      expect(result.success).toBe(true);
      expect(notesQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({ linked_to_type: "task", linked_to_id: linkedTaskId }),
      );
    });

    it("rejects linking to a record not owned by the caller", async () => {
      const notesQuery = createMockQuery();
      const goalsQuery = createMockQuery(null);
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "goals" ? goalsQuery : notesQuery,
      );

      const result = await executeTool("add_note", {
        title: "Linked",
        content: "content",
        linked_to_type: "goal",
        linked_to_id: "223e4567-e89b-12d3-a456-426614174099",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Goal not found");
      expect(notesQuery.insert).not.toHaveBeenCalled();
    });

    it("rejects linked_to_type without linked_to_id", async () => {
      setupMockSupabase({});
      const result = await executeTool("add_note", {
        title: "Linked",
        content: "content",
        linked_to_type: "task",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
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

    it("persists role, stage, deal_value, notes and tags at creation", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { contacts: query } });

      await executeTool("add_contact", {
        name: "Jane Roe",
        role: "CTO",
        stage: "qualified",
        deal_value: 5000,
        notes: "Met at conference",
        tags: ["vip"],
      });
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "CTO",
          stage: "qualified",
          deal_value: 5000,
          notes: "Met at conference",
          tags: ["vip"],
        }),
      );
    });

    it("defaults stage to new when omitted", async () => {
      const query = createMockQuery();
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { contacts: query } });

      await executeTool("add_contact", { name: "No Stage" });
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({ stage: "new" }),
      );
    });
  });

  describe("delete_task", () => {
    const taskId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    // Soft delete (022): the row stays in the table with deleted_at stamped, so
    // restore_record can bring it back. A real .delete() here would be the bug.
    it("stamps deleted_at instead of removing the row", async () => {
      const query = createMockQuery({ id: taskId, title: "Old task" });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("delete_task", {
        task_id: taskId,
        task_title: "Old task",
      });

      expect(result.success).toBe(true);
      expect(query.delete).not.toHaveBeenCalled();
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) }),
      );
    });

    // Brief item 11: the caller must be able to confirm the right thing went,
    // and know it can be undone.
    it("echoes the stored title and id, and points at the undo", async () => {
      const query = createMockQuery({ id: taskId, title: "Stored title" });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("delete_task", {
        task_id: taskId,
        // Deliberately wrong: the message must come from the database row, not
        // from what the model claimed the task was called.
        task_title: "What the model guessed",
      });

      expect(result.message).toContain("Stored title");
      expect(result.message).toContain(taskId);
      expect(result.message).not.toContain("What the model guessed");
      expect(result.message).toContain("restore_record");
    });

    it("refuses when the task is already deleted", async () => {
      // maybeSingle() returns null: the preflight filters deleted_at IS NULL.
      const query = createMockQuery(null);
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("delete_task", {
        task_id: taskId,
        task_title: "Gone",
      });

      expect(result).toEqual({ success: false, message: "Task not found" });
      expect(query.update).not.toHaveBeenCalled();
    });

    // FK is ON DELETE SET NULL, but a soft delete is an UPDATE so the
    // constraint never fires — the handler has to unlink the children itself.
    it("unlinks focus sessions without deleting them", async () => {
      const tasks = createMockQuery({ id: taskId, title: "Old task" });
      const sessions = createMockQuery(null);
      setupMockSupabase({ queries: { tasks, focus_sessions: sessions } });

      await executeTool("delete_task", { task_id: taskId, task_title: "x" });

      expect(sessions.update).toHaveBeenCalledWith(
        { task_id: null },
        { count: "exact" },
      );
      expect(sessions.delete).not.toHaveBeenCalled();
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

    // habit_logs rows carry habit_id; the done flag previously compared that
    // id set against habit *names*, so every habit reported done: false.
    it("marks a habit done by matching the logged habit_id", async () => {
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
        tasks: makeResolvable([]),
        habits: makeResolvable([
          { id: "h-1", name: "Exercise", icon: "🏃" },
          { id: "h-2", name: "Read", icon: "📖" },
        ]),
        habit_logs: makeResolvable([{ habit_id: "h-1" }]),
        goals: makeResolvable([]),
        budgets: makeResolvable([]),
        transactions: makeResolvable([]),
        interactions: makeResolvable([]),
      };
      mock.from = vi.fn((table: string) => tableMap[table] ?? createMockQuery());

      const result = await executeTool("get_daily_briefing", {});
      const data = result.data as {
        habits: Array<{ id: string; name: string; done: boolean }>;
      };

      expect(data.habits).toEqual([
        { id: "h-1", name: "Exercise", icon: "🏃", done: true },
        { id: "h-2", name: "Read", icon: "📖", done: false },
      ]);
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
    const noteId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("soft-deletes a note and echoes its stored title", async () => {
      // returnData non-null so maybeSingle() passes the ownership preflight
      const query = createMockQuery({ id: noteId, title: "Draft note" });
      setupMockSupabase({ queries: { notes: query } });

      const result = await executeTool("delete_note", {
        note_id: noteId,
        note_title: "Draft note",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Draft note");
      expect(query.delete).not.toHaveBeenCalled();
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) }),
      );
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

    describe("date filtering", () => {
      function setupAnalytics() {
        const txQuery = createMockQuery([]);
        const taskQuery = createMockQuery([]);
        const habitQuery = createMockQuery([]);
        const habitLogQuery = createMockQuery([]);
        const goalQuery = createMockQuery([]);
        setupMockSupabase({
          queries: {
            transactions: txQuery,
            tasks: taskQuery,
            habits: habitQuery,
            habit_logs: habitLogQuery,
            goals: goalQuery,
          },
        });
        return { txQuery, taskQuery, habitLogQuery };
      }

      // The schema column is habit_logs.logged_date — filtering on `date`
      // errored out and produced empty habit analytics.
      it("filters habit logs on logged_date, never on date", async () => {
        const { habitLogQuery } = setupAnalytics();
        await executeTool("get_analytics", { period: "month" });

        const columns = habitLogQuery.gte.mock.calls.map((c) => c[0]);
        expect(columns).toContain("logged_date");
        expect(columns).not.toContain("date");
      });

      it("uses the Dubai month start for the monthly window", async () => {
        const { txQuery, habitLogQuery } = setupAnalytics();
        await executeTool("get_analytics", { period: "month" });

        expect(txQuery.gte).toHaveBeenCalledWith("date", "2026-06-01");
        expect(habitLogQuery.gte).toHaveBeenCalledWith(
          "logged_date",
          "2026-06-01",
        );
      });

      it("uses a trailing 7-day window for the weekly period", async () => {
        const { txQuery, habitLogQuery } = setupAnalytics();
        await executeTool("get_analytics", { period: "week" });

        // Frozen clock is 2026-06-23 → inclusive 7-day window starts 06-17.
        expect(txQuery.gte).toHaveBeenCalledWith("date", "2026-06-17");
        expect(habitLogQuery.gte).toHaveBeenCalledWith(
          "logged_date",
          "2026-06-17",
        );
      });

      it("anchors the timestamptz task filter to the Dubai day boundary", async () => {
        const { taskQuery } = setupAnalytics();
        await executeTool("get_analytics", { period: "month" });

        expect(taskQuery.gte).toHaveBeenCalledWith(
          "created_at",
          "2026-06-01T00:00:00+04:00",
        );
      });
    });

    describe("counts", () => {
      it("aggregates finance, task, habit and goal figures", async () => {
        setupMockSupabase({
          queries: {
            transactions: createMockQuery([
              { type: "income", amount: 5000, category: "salary" },
              { type: "expense", amount: 200, category: "food" },
              { type: "expense", amount: 100, category: "transport" },
            ]),
            tasks: createMockQuery([
              { id: "t-1", status: "done" },
              { id: "t-2", status: "done" },
              { id: "t-3", status: "in_progress" },
            ]),
            habits: createMockQuery([
              { id: "h-1", name: "Run" },
              { id: "h-2", name: "Read" },
            ]),
            habit_logs: createMockQuery([
              { habit_id: "h-1", completed: true },
              { habit_id: "h-2", completed: true },
              { habit_id: "h-1", completed: false },
            ]),
            goals: createMockQuery([
              { id: "g-1", status: "active", progress: 60 },
              { id: "g-2", status: "completed", progress: 100 },
            ]),
          },
        });

        const result = await executeTool("get_analytics", { period: "month" });
        expect(result.data).toEqual({
          period: "month",
          finance: { income: 5000, expenses: 300, net: 4700 },
          tasks: { total: 3, completed: 2 },
          habits: { tracked: 2, logsCompleted: 2 },
          goals: { active: 1, completed: 1, avgProgress: 80 },
        });
      });
    });

    describe("query failures", () => {
      // Returning zeros for a failed query is indistinguishable from a
      // genuinely empty period — the caller must be told it failed.
      it.each([
        "transactions",
        "tasks",
        "habits",
        "habit_logs",
        "goals",
      ])("reports failure when the %s query errors", async (failingTable) => {
        const queries: Record<string, ReturnType<typeof createMockQuery>> = {
          transactions: createMockQuery([]),
          tasks: createMockQuery([]),
          habits: createMockQuery([]),
          habit_logs: createMockQuery([]),
          goals: createMockQuery([]),
        };
        queries[failingTable] = createMockQuery(null, {
          message: "column does not exist",
        });
        setupMockSupabase({ queries });

        const result = await executeTool("get_analytics", { period: "month" });
        expect(result.success).toBe(false);
        expect(result.message).toBe("Something went wrong. Please try again.");
      });
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

    it("persists due_time, estimated_time, recurrence, reminder and area", async () => {
      const query = createMockQuery({ title: "Full task" });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("update_task", {
        id: taskId,
        due_time: "14:30",
        estimated_time: 60,
        recurrence: "FREQ=DAILY",
        reminder: "2026-06-24T08:00:00Z",
        area: "financial",
      });
      expect(result.success).toBe(true);
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({
          due_time: "14:30",
          estimated_time: 60,
          recurrence: "FREQ=DAILY",
          reminder: "2026-06-24T08:00:00Z",
          area: "financial",
        }),
      );
    });

    it("rejects an unparseable recurrence rule", async () => {
      setupMockSupabase({});
      const result = await executeTool("update_task", {
        id: taskId,
        recurrence: "GARBAGE",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("normalizes subtasks and backfills missing ids", async () => {
      const query = createMockQuery({ title: "Checklist task" });
      setupMockSupabase({ queries: { tasks: query } });

      await executeTool("update_task", {
        id: taskId,
        subtasks: [{ id: "523e4567-e89b-12d3-a456-426614174102", title: "Keep", done: true }, { title: "New" }],
      });
      const updateArg = query.update.mock.calls[0][0] as {
        subtasks: { id: string; title: string; done: boolean }[];
      };
      expect(updateArg.subtasks[0]).toEqual({
        id: "523e4567-e89b-12d3-a456-426614174102",
        title: "Keep",
        done: true,
      });
      expect(updateArg.subtasks[1].id).toBeTruthy();
      expect(updateArg.subtasks[1].done).toBe(false);
    });

    it("silently ignores a legacy is_starred param", async () => {
      const query = createMockQuery({ title: "Star task" });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("update_task", {
        id: taskId,
        is_starred: true,
      });
      expect(result.success).toBe(true);
      const updateArg = query.update.mock.calls[0][0] as Record<string, unknown>;
      expect(updateArg).not.toHaveProperty("is_starred");
    });

    it("turns on today's focus for a task due today", async () => {
      const query = createMockQuery({ due_date: "2026-06-23", title: "Focus task" });
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ count: 1, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("update_task", {
        id: taskId,
        is_focus: true,
      });
      expect(result.success).toBe(true);
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_focus: true, focus_date: "2026-06-23" }),
      );
    });

    it("turns on today's focus for a task with no due date", async () => {
      const query = createMockQuery({ due_date: null, title: "Focus task" });
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ count: 0, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("update_task", {
        id: taskId,
        is_focus: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects focusing a task due in the future", async () => {
      const query = createMockQuery({ due_date: "2026-07-01", title: "Future task" });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("update_task", {
        id: taskId,
        is_focus: true,
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("due today");
      expect(query.update).not.toHaveBeenCalled();
    });

    it("rejects focusing a 4th task when 3 are already focused today", async () => {
      const query = createMockQuery({ due_date: "2026-06-23", title: "Task 4" });
      Object.defineProperty(query, "then", {
        value: (resolve: (v: unknown) => void) =>
          Promise.resolve({ count: 3, error: null }).then(resolve),
        writable: true,
        configurable: true,
      });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("update_task", {
        id: taskId,
        is_focus: true,
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("3 tasks a day");
      expect(query.update).not.toHaveBeenCalled();
    });

    it("returns not found when focusing a task that doesn't exist", async () => {
      const query = createMockQuery(null);
      query.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("update_task", {
        id: taskId,
        is_focus: true,
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("turns off focus unconditionally", async () => {
      const query = createMockQuery({ title: "Unfocused task" });
      setupMockSupabase({ queries: { tasks: query } });

      const result = await executeTool("update_task", {
        id: taskId,
        is_focus: false,
      });
      expect(result.success).toBe(true);
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_focus: false, focus_date: null }),
      );
    });

    it("rejects a project_id not owned by the caller", async () => {
      const tasksQuery = createMockQuery();
      const projectsQuery = createMockQuery(null);
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "projects" ? projectsQuery : tasksQuery,
      );

      const result = await executeTool("update_task", {
        id: taskId,
        project_id: "223e4567-e89b-12d3-a456-426614174099",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Project not found");
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

    it("persists category and an owned goal_id", async () => {
      const projectsQuery = createMockQuery({ id: "p2", name: "Linked" });
      const goalsQuery = createMockQuery({ id: "623e4567-e89b-12d3-a456-426614174103" });
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "goals" ? goalsQuery : projectsQuery,
      );

      const result = await executeTool("create_project", {
        name: "Linked",
        category: "wellness",
        goal_id: "623e4567-e89b-12d3-a456-426614174103",
      });
      expect(result.success).toBe(true);
      expect(projectsQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({ category: "wellness", goal_id: "623e4567-e89b-12d3-a456-426614174103" }),
      );
    });

    it("rejects a goal_id not owned by the caller", async () => {
      const projectsQuery = createMockQuery();
      const goalsQuery = createMockQuery(null);
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "goals" ? goalsQuery : projectsQuery,
      );

      const result = await executeTool("create_project", {
        name: "Orphan",
        goal_id: "223e4567-e89b-12d3-a456-426614174099",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Goal not found");
      expect(projectsQuery.insert).not.toHaveBeenCalled();
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

    it("updates category and an owned goal_id", async () => {
      const projectsQuery = createMockQuery({ name: "Recategorized" });
      const goalsQuery = createMockQuery({ id: "623e4567-e89b-12d3-a456-426614174103" });
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "goals" ? goalsQuery : projectsQuery,
      );

      const result = await executeTool("update_project", {
        id: projectId,
        category: "financial",
        goal_id: "623e4567-e89b-12d3-a456-426614174103",
      });
      expect(result.success).toBe(true);
      expect(projectsQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ category: "financial", goal_id: "623e4567-e89b-12d3-a456-426614174103" }),
      );
    });

    it("rejects reassigning to a goal_id not owned by the caller", async () => {
      const projectsQuery = createMockQuery();
      const goalsQuery = createMockQuery(null);
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "goals" ? goalsQuery : projectsQuery,
      );

      const result = await executeTool("update_project", {
        id: projectId,
        goal_id: "223e4567-e89b-12d3-a456-426614174099",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Goal not found");
      expect(projectsQuery.update).not.toHaveBeenCalled();
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
      setupMockSupabase({
        queries: {
          milestones: query,
          // Parent goal must resolve to the calling user.
          goals: createMockQuery({ id: goalId }),
        },
      });

      const result = await executeTool("create_milestone", {
        goal_id: goalId,
        title: "Run 10km",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Run 10km");
    });

    it("refuses a goal that does not belong to the user", async () => {
      const query = createMockQuery({ id: "m1", title: "Run 10km" });
      setupMockSupabase({
        queries: { milestones: query, goals: createMockQuery(null) },
      });

      const result = await executeTool("create_milestone", {
        goal_id: goalId,
        title: "Run 10km",
      });
      expect(result).toEqual({ success: false, message: "Goal not found" });
      expect(query.insert).not.toHaveBeenCalled();
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

    it("reassigns to an owned goal", async () => {
      const milestonesQuery = createMockQuery({ title: "Moved" });
      const goalsQuery = createMockQuery({ id: "623e4567-e89b-12d3-a456-426614174103" });
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "goals" ? goalsQuery : milestonesQuery,
      );

      const result = await executeTool("update_milestone", {
        id: milestoneId,
        goal_id: "623e4567-e89b-12d3-a456-426614174103",
      });
      expect(result.success).toBe(true);
      expect(milestonesQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ goal_id: "623e4567-e89b-12d3-a456-426614174103" }),
      );
    });

    it("rejects reassigning to a goal not owned by the caller", async () => {
      const milestonesQuery = createMockQuery();
      const goalsQuery = createMockQuery(null);
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "goals" ? goalsQuery : milestonesQuery,
      );

      const result = await executeTool("update_milestone", {
        id: milestoneId,
        goal_id: "223e4567-e89b-12d3-a456-426614174099",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Goal not found");
      expect(milestonesQuery.update).not.toHaveBeenCalled();
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

  describe("reopen_milestone", () => {
    const milestoneId = "423e4567-e89b-12d3-a456-426614174003";

    it("clears the completion date", async () => {
      const query = createMockQuery({ title: "Run 10km" });
      setupMockSupabase({ queries: { milestones: query } });

      const result = await executeTool("reopen_milestone", {
        id: milestoneId,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Run 10km");
      expect(query.update).toHaveBeenCalledWith({ completed_at: null });
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { milestones: query } });
      const result = await executeTool("reopen_milestone", {
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

    // Addressed by (habit_id, logged_date), so the handler resolves the row id
    // first and then takes the shared soft-delete path.
    it("removes a habit log for a date", async () => {
      const query = createMockQuery({
        id: "log-1",
        logged_date: "2026-06-20",
      });
      setupMockSupabase({ queries: { habit_logs: query } });

      const result = await executeTool("delete_habit_log", {
        habit_id: habitId,
        logged_date: "2026-06-20",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("2026-06-20");
      expect(query.delete).not.toHaveBeenCalled();
    });

    it("reports when no log exists for that date", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { habit_logs: query } });

      const result = await executeTool("delete_habit_log", {
        habit_id: habitId,
        logged_date: "2026-06-20",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("No habit log found");
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
      const query = createMockQuery({ id: "log-1" }, { message: "boom" });
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
      setupMockSupabase({
        queries: {
          interactions: query,
          // Parent contact must resolve to the calling user.
          contacts: createMockQuery({ id: contactId }),
        },
      });

      const result = await executeTool("create_interaction", {
        contact_id: contactId,
        type: "call",
        notes: "Discussed proposal",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("call");
    });

    it("refuses a contact that does not belong to the user", async () => {
      const query = createMockQuery({ id: "i1" });
      setupMockSupabase({
        queries: { interactions: query, contacts: createMockQuery(null) },
      });

      const result = await executeTool("create_interaction", {
        contact_id: contactId,
        type: "call",
        notes: "Discussed proposal",
      });
      expect(result).toEqual({ success: false, message: "Contact not found" });
      expect(query.insert).not.toHaveBeenCalled();
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

    it("lists interactions across all contacts when contact_id is omitted", async () => {
      const query = createMockQuery([
        { id: "i1", type: "call" },
        { id: "i2", type: "email" },
      ]);
      setupMockSupabase({ queries: { interactions: query } });

      const result = await executeTool("list_interactions", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("2 interactions");
      expect(query.eq).not.toHaveBeenCalledWith("contact_id", expect.anything());
    });

    it("returns badInput for an invalid contact_id", async () => {
      setupMockSupabase({});
      const result = await executeTool("list_interactions", {
        contact_id: "not-a-uuid",
      });
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

    it("reassigns to an owned contact", async () => {
      const interactionsQuery = createMockQuery(null, null);
      const contactsQuery = createMockQuery({ id: "723e4567-e89b-12d3-a456-426614174104" });
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "contacts" ? contactsQuery : interactionsQuery,
      );

      const result = await executeTool("update_interaction", {
        id: interactionId,
        contact_id: "723e4567-e89b-12d3-a456-426614174104",
      });
      expect(result.success).toBe(true);
      expect(interactionsQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ contact_id: "723e4567-e89b-12d3-a456-426614174104" }),
      );
    });

    it("rejects reassigning to a contact not owned by the caller", async () => {
      const interactionsQuery = createMockQuery();
      const contactsQuery = createMockQuery(null);
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "contacts" ? contactsQuery : interactionsQuery,
      );

      const result = await executeTool("update_interaction", {
        id: interactionId,
        contact_id: "223e4567-e89b-12d3-a456-426614174099",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Contact not found");
      expect(interactionsQuery.update).not.toHaveBeenCalled();
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
      expect(result.message).toContain("Deleted interaction");
      expect(result.message).toContain("restore_record");
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

    it("links to an owned contact", async () => {
      const notesQuery = createMockQuery({ title: "Linked note" });
      const contactsQuery = createMockQuery({ id: "723e4567-e89b-12d3-a456-426614174104" });
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "contacts" ? contactsQuery : notesQuery,
      );

      const result = await executeTool("update_note", {
        id: noteId,
        linked_to_type: "contact",
        linked_to_id: "723e4567-e89b-12d3-a456-426614174104",
      });
      expect(result.success).toBe(true);
      expect(notesQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          linked_to_type: "contact",
          linked_to_id: "723e4567-e89b-12d3-a456-426614174104",
        }),
      );
    });

    it("rejects linking to a record not owned by the caller", async () => {
      const notesQuery = createMockQuery();
      const tasksQuery = createMockQuery(null);
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "tasks" ? tasksQuery : notesQuery,
      );

      const result = await executeTool("update_note", {
        id: noteId,
        linked_to_type: "task",
        linked_to_id: "223e4567-e89b-12d3-a456-426614174099",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Task not found");
      expect(notesQuery.update).not.toHaveBeenCalled();
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

    it("persists file_path and file_size", async () => {
      const query = createMockQuery({ name: "Moved.pdf" });
      setupMockSupabase({ queries: { documents: query } });

      await executeTool("update_document", {
        id: documentId,
        file_path: "/uploads/moved.pdf",
        file_size: 2048,
      });
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({
          file_path: "/uploads/moved.pdf",
          file_size: 2048,
        }),
      );
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
      expect(result.message).toContain("Deleted link");
      expect(result.message).toContain("restore_record");
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

    it("persists type, period_start and period_end", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { reviews: query } });

      await executeTool("update_review", {
        id: reviewId,
        type: "monthly",
        period_start: "2026-06-01",
        period_end: "2026-06-30",
      });
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "monthly",
          period_start: "2026-06-01",
          period_end: "2026-06-30",
        }),
      );
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

    it("persists started_at", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { focus_sessions: query } });

      await executeTool("update_focus_session", {
        id: sessionId,
        started_at: "2026-06-23T09:00:00Z",
      });
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ started_at: "2026-06-23T09:00:00Z" }),
      );
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
      expect(result.message).toContain("Deleted focus session");
      expect(result.message).toContain("restore_record");
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

  // ─── PAYMENT METHODS ────────────────────────────────────────────────────────

  describe("list_payment_methods", () => {
    it("lists active payment methods for the user", async () => {
      const query = createMockQuery([
        { id: "pm-1", name: "Cash", balance: 100 },
      ]);
      setupMockSupabase({ queries: { payment_methods: query } });

      const result = await executeTool("list_payment_methods", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 payment methods");
      expect(query.eq).toHaveBeenCalledWith("is_active", true);
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { payment_methods: query } });
      const result = await executeTool("list_payment_methods", {});
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── TRANSACTIONS ───────────────────────────────────────────────────────────

  describe("list_transactions", () => {
    it("lists transactions for the user", async () => {
      const query = createMockQuery([{ id: "t1", type: "expense", amount: 20 }]);
      setupMockSupabase({ queries: { transactions: query } });

      const result = await executeTool("list_transactions", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 transactions");
    });

    it("filters by type and start_date", async () => {
      const query = createMockQuery([]);
      setupMockSupabase({ queries: { transactions: query } });

      await executeTool("list_transactions", {
        type: "expense",
        start_date: "2026-06-01",
      });
      expect(query.eq).toHaveBeenCalledWith("type", "expense");
      expect(query.gte).toHaveBeenCalledWith("date", "2026-06-01");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { transactions: query } });
      const result = await executeTool("list_transactions", {});
      expect(result.success).toBe(false);
    });
  });

  describe("update_transaction", () => {
    const transactionId = "e23e4567-e89b-12d3-a456-426614174013";

    it("updates a transaction that exists", async () => {
      const query = createMockQuery({ id: transactionId }, null);
      setupMockSupabase({ queries: { transactions: query } });

      const result = await executeTool("update_transaction", {
        transaction_id: transactionId,
        summary: "Lunch",
        amount: 75,
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Transaction updated.");
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 75 }),
      );
      expect(query.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ summary: expect.anything() }),
      );
    });

    it("returns badInput for missing summary", async () => {
      setupMockSupabase({});
      const result = await executeTool("update_transaction", {
        transaction_id: transactionId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns not found when transaction does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { transactions: query } });
      const result = await executeTool("update_transaction", {
        transaction_id: transactionId,
        summary: "Lunch",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Transaction not found");
    });

    it("returns error on Supabase update failure", async () => {
      const query = createMockQuery({ id: transactionId }, { message: "boom" });
      setupMockSupabase({ queries: { transactions: query } });
      const result = await executeTool("update_transaction", {
        transaction_id: transactionId,
        summary: "Lunch",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });

    it("persists tags", async () => {
      const query = createMockQuery({ id: transactionId }, null);
      setupMockSupabase({ queries: { transactions: query } });

      await executeTool("update_transaction", {
        transaction_id: transactionId,
        summary: "Retag",
        tags: ["reimbursable"],
      });
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ["reimbursable"] }),
      );
    });
  });

  describe("delete_transaction", () => {
    const transactionId = "e23e4567-e89b-12d3-a456-426614174013";

    it("deletes a transaction that exists", async () => {
      const query = createMockQuery(
        { id: transactionId, category: "Food", amount: 20 },
        null,
      );
      setupMockSupabase({ queries: { transactions: query } });

      const result = await executeTool("delete_transaction", {
        transaction_id: transactionId,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Deleted transaction");
      expect(result.message).toContain("restore_record");
    });

    it("returns not found when transaction does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { transactions: query } });
      const result = await executeTool("delete_transaction", {
        transaction_id: transactionId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Transaction not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery(
        { id: transactionId, category: "Food", amount: 20 },
        { message: "boom" },
      );
      setupMockSupabase({ queries: { transactions: query } });
      const result = await executeTool("delete_transaction", {
        transaction_id: transactionId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  describe("create_transfer", () => {
    const fromId = "f23e4567-e89b-12d3-a456-426614174014";
    const toId = "f33e4567-e89b-12d3-a456-426614174015";

    it("moves money between two owned wallets", async () => {
      const txQuery = createMockQuery({ id: "tx-1" });
      const pmQuery = createMockQuery({ id: "pm" }); // owns both wallets
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "payment_methods" ? pmQuery : txQuery,
      );

      const result = await executeTool("create_transfer", {
        from_payment_method_id: fromId,
        to_payment_method_id: toId,
        amount: 500,
        summary: "Transfer AED 500",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("500");
      expect(txQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "transfer",
          amount: 500,
          category: "Transfer",
          from_payment_method_id: fromId,
          to_payment_method_id: toId,
          payment_method_id: null,
        }),
      );
    });

    it("rejects a self-transfer", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_transfer", {
        from_payment_method_id: fromId,
        to_payment_method_id: fromId,
        amount: 100,
        summary: "Bad transfer",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("rejects when the source wallet is not owned by the caller", async () => {
      const txQuery = createMockQuery();
      const pmQuery = createMockQuery(null);
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "payment_methods" ? pmQuery : txQuery,
      );

      const result = await executeTool("create_transfer", {
        from_payment_method_id: fromId,
        to_payment_method_id: toId,
        amount: 100,
        summary: "Transfer",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Source payment method not found");
      expect(txQuery.insert).not.toHaveBeenCalled();
    });

    it("rejects a non-positive amount", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_transfer", {
        from_payment_method_id: fromId,
        to_payment_method_id: toId,
        amount: 0,
        summary: "Transfer",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const txQuery = createMockQuery(null, { message: "boom" });
      const pmQuery = createMockQuery({ id: "pm" });
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "payment_methods" ? pmQuery : txQuery,
      );

      const result = await executeTool("create_transfer", {
        from_payment_method_id: fromId,
        to_payment_method_id: toId,
        amount: 100,
        summary: "Transfer",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  describe("create_adjustment", () => {
    const pmId = "f43e4567-e89b-12d3-a456-426614174016";

    it("applies a positive balance correction", async () => {
      const txQuery = createMockQuery({ id: "tx-1" });
      const pmQuery = createMockQuery({ id: pmId });
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "payment_methods" ? pmQuery : txQuery,
      );

      const result = await executeTool("create_adjustment", {
        payment_method_id: pmId,
        amount: 25,
        reason: "Found extra cash",
        summary: "Adjust +25",
      });
      expect(result.success).toBe(true);
      expect(txQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "adjustment",
          amount: 25,
          category: "Balance Adjustment",
          description: "Found extra cash",
          payment_method_id: pmId,
        }),
      );
    });

    it("applies a negative balance correction", async () => {
      const txQuery = createMockQuery({ id: "tx-1" });
      const pmQuery = createMockQuery({ id: pmId });
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "payment_methods" ? pmQuery : txQuery,
      );

      const result = await executeTool("create_adjustment", {
        payment_method_id: pmId,
        amount: -25,
        reason: "Bank fee",
        summary: "Adjust -25",
      });
      expect(result.success).toBe(true);
      expect(txQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({ amount: -25 }),
      );
    });

    it("rejects a wallet not owned by the caller", async () => {
      const txQuery = createMockQuery();
      const pmQuery = createMockQuery(null);
      const mock = setupMockSupabase({});
      mock.from = vi.fn((table: string) =>
        table === "payment_methods" ? pmQuery : txQuery,
      );

      const result = await executeTool("create_adjustment", {
        payment_method_id: pmId,
        amount: 10,
        reason: "x",
        summary: "Adjust",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Payment method not found");
      expect(txQuery.insert).not.toHaveBeenCalled();
    });

    it("returns badInput for a missing reason", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_adjustment", {
        payment_method_id: pmId,
        amount: 10,
        summary: "Adjust",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns badInput for a zero amount", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_adjustment", {
        payment_method_id: pmId,
        amount: 0,
        reason: "x",
        summary: "Adjust",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });
  });

  // ─── BUDGETS ────────────────────────────────────────────────────────────────

  describe("list_budgets", () => {
    it("lists budgets for the user", async () => {
      const query = createMockQuery([{ id: "b1", category: "Food" }]);
      setupMockSupabase({ queries: { budgets: query } });

      const result = await executeTool("list_budgets", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 budgets");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { budgets: query } });
      const result = await executeTool("list_budgets", {});
      expect(result.success).toBe(false);
    });
  });

  describe("create_budget", () => {
    it("creates a budget", async () => {
      const query = createMockQuery({ id: "b1", category: "Food" });
      setupMockSupabase({ queries: { budgets: query } });

      const result = await executeTool("create_budget", {
        category: "Food",
        amount: 2000,
        period_start: "2026-06-01",
        period_end: "2026-06-30",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Food");
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({ period: "monthly" }),
      );
    });

    it("returns badInput for missing period_end", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_budget", {
        category: "Food",
        amount: 2000,
        period_start: "2026-06-01",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { budgets: query } });
      const result = await executeTool("create_budget", {
        category: "Food",
        amount: 2000,
        period_start: "2026-06-01",
        period_end: "2026-06-30",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("update_budget", () => {
    const budgetId = "f23e4567-e89b-12d3-a456-426614174014";

    it("updates a budget", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { budgets: query } });

      const result = await executeTool("update_budget", {
        id: budgetId,
        amount: 2500,
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Budget updated.");
    });

    it("returns badInput for invalid id", async () => {
      setupMockSupabase({});
      const result = await executeTool("update_budget", { id: "not-a-uuid" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { budgets: query } });
      const result = await executeTool("update_budget", { id: budgetId });
      expect(result.success).toBe(false);
    });
  });

  describe("delete_budget", () => {
    const budgetId = "f23e4567-e89b-12d3-a456-426614174014";

    it("deletes a budget that exists", async () => {
      const query = createMockQuery({ id: budgetId, category: "Food" }, null);
      setupMockSupabase({ queries: { budgets: query } });

      const result = await executeTool("delete_budget", {
        budget_id: budgetId,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Food");
    });

    it("returns not found when budget does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { budgets: query } });
      const result = await executeTool("delete_budget", {
        budget_id: budgetId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Budget not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery(
        { id: budgetId, category: "Food" },
        { message: "boom" },
      );
      setupMockSupabase({ queries: { budgets: query } });
      const result = await executeTool("delete_budget", {
        budget_id: budgetId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  // ─── DEBTS ──────────────────────────────────────────────────────────────────

  describe("list_debts", () => {
    it("lists debt records for the user", async () => {
      const query = createMockQuery([{ id: "d1", creditor: "Bank" }]);
      setupMockSupabase({ queries: { debts: query } });

      const result = await executeTool("list_debts", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 debt records");
    });

    it("filters by i_owe", async () => {
      const query = createMockQuery([]);
      setupMockSupabase({ queries: { debts: query } });
      await executeTool("list_debts", { filter: "i_owe" });
      expect(query.eq).toHaveBeenCalledWith("type", "i_owe");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { debts: query } });
      const result = await executeTool("list_debts", {});
      expect(result.success).toBe(false);
    });
  });

  describe("create_debt", () => {
    it("records a debt someone owes them", async () => {
      const query = createMockQuery({ id: "d1" });
      setupMockSupabase({ queries: { debts: query } });

      const result = await executeTool("create_debt", {
        creditor: "John",
        type: "they_owe",
        amount: 300,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("owed by John");
    });

    it("records a debt they owe someone", async () => {
      const query = createMockQuery({ id: "d2" });
      setupMockSupabase({ queries: { debts: query } });

      const result = await executeTool("create_debt", {
        creditor: "Bank",
        type: "i_owe",
        amount: 500,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("owed to Bank");
    });

    it("returns badInput for missing creditor", async () => {
      setupMockSupabase({});
      const result = await executeTool("create_debt", {
        type: "i_owe",
        amount: 100,
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns error on Supabase failure", async () => {
      const query = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { debts: query } });
      const result = await executeTool("create_debt", {
        creditor: "John",
        type: "i_owe",
        amount: 100,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("update_debt", () => {
    const debtId = "023e4567-e89b-12d3-a456-426614174015";

    it("updates a debt without marking it paid", async () => {
      const query = createMockQuery({ id: debtId, creditor: "Bank" }, null);
      setupMockSupabase({ queries: { debts: query } });

      const result = await executeTool("update_debt", {
        debt_id: debtId,
        summary: "Loan",
        amount: 400,
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Debt updated.");
      expect(query.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ paid_at: expect.anything() }),
      );
    });

    it("marks a debt as paid", async () => {
      const query = createMockQuery({ id: debtId, creditor: "Bank" }, null);
      setupMockSupabase({ queries: { debts: query } });

      const result = await executeTool("update_debt", {
        debt_id: debtId,
        summary: "Loan",
        mark_paid: true,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Marked debt to Bank as paid");
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ paid_at: expect.any(String) }),
      );
    });

    it("returns badInput for missing summary", async () => {
      setupMockSupabase({});
      const result = await executeTool("update_debt", { debt_id: debtId });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("returns not found when debt does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { debts: query } });
      const result = await executeTool("update_debt", {
        debt_id: debtId,
        summary: "Loan",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Debt not found");
    });

    it("returns error on Supabase update failure", async () => {
      const query = createMockQuery(
        { id: debtId, creditor: "Bank" },
        { message: "boom" },
      );
      setupMockSupabase({ queries: { debts: query } });
      const result = await executeTool("update_debt", {
        debt_id: debtId,
        summary: "Loan",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });

    it("flips the debt direction", async () => {
      const query = createMockQuery({ id: debtId, creditor: "Bank" }, null);
      setupMockSupabase({ queries: { debts: query } });

      await executeTool("update_debt", {
        debt_id: debtId,
        summary: "Loan",
        type: "they_owe",
      });
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ type: "they_owe" }),
      );
    });
  });

  describe("delete_debt", () => {
    const debtId = "023e4567-e89b-12d3-a456-426614174015";

    it("deletes a debt that exists", async () => {
      const query = createMockQuery({ id: debtId, creditor: "Bank" }, null);
      setupMockSupabase({ queries: { debts: query } });

      const result = await executeTool("delete_debt", { debt_id: debtId });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Bank");
    });

    it("returns not found when debt does not belong to user", async () => {
      const query = createMockQuery(null, null);
      setupMockSupabase({ queries: { debts: query } });
      const result = await executeTool("delete_debt", { debt_id: debtId });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Debt not found");
    });

    it("returns error on Supabase delete failure", async () => {
      const query = createMockQuery(
        { id: debtId, creditor: "Bank" },
        { message: "boom" },
      );
      setupMockSupabase({ queries: { debts: query } });
      const result = await executeTool("delete_debt", { debt_id: debtId });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
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

  // A capped page previously looked identical to a complete result, so the
  // assistant would confidently report a truncated list as everything.
  describe("pagination", () => {
    it("requests one row beyond the page so truncation is detectable", async () => {
      const notesQuery = createMockQuery([]);
      const sb = { from: vi.fn(() => notesQuery) };

      await executeTool(
        "list_notes",
        { limit: 5 },
        { supabase: sb as never, userId: "user-999" },
      );
      // range() is inclusive, so [0, 5] fetches 6 rows for a page of 5.
      expect(notesQuery.range).toHaveBeenCalledWith(0, 5);
    });

    it("reports the next offset when more rows exist", async () => {
      const rows = Array.from({ length: 6 }, (_, i) => ({ id: `n-${i}` }));
      const notesQuery = createMockQuery(rows);
      const sb = { from: vi.fn(() => notesQuery) };

      const result = await executeTool(
        "list_notes",
        { limit: 5 },
        { supabase: sb as never, userId: "user-999" },
      );

      expect(result.message).toBe(
        "Found 5 notes (more available — call again with offset 5)",
      );
      // The probe row is trimmed from the returned page.
      expect(result.data).toHaveLength(5);
    });

    it("does not claim more results when the page is not full", async () => {
      const rows = Array.from({ length: 3 }, (_, i) => ({ id: `n-${i}` }));
      const notesQuery = createMockQuery(rows);
      const sb = { from: vi.fn(() => notesQuery) };

      const result = await executeTool(
        "list_notes",
        { limit: 5 },
        { supabase: sb as never, userId: "user-999" },
      );

      expect(result.message).toBe("Found 3 notes");
      expect(result.data).toHaveLength(3);
    });

    it("advances the range window for a later offset", async () => {
      const contactsQuery = createMockQuery([]);
      const sb = { from: vi.fn(() => contactsQuery) };

      await executeTool(
        "list_contacts",
        { limit: 10, offset: 20 },
        { supabase: sb as never, userId: "user-999" },
      );
      expect(contactsQuery.range).toHaveBeenCalledWith(20, 30);
    });

    it("reports the cumulative offset when paging deeper", async () => {
      const rows = Array.from({ length: 11 }, (_, i) => ({ id: `t-${i}` }));
      const txQuery = createMockQuery(rows);
      const sb = { from: vi.fn(() => txQuery) };

      const result = await executeTool(
        "list_transactions",
        { limit: 10, offset: 20 },
        { supabase: sb as never, userId: "user-999" },
      );

      expect(result.message).toContain("offset 30");
    });
  });

  // The MCP path injects a service-role client, which bypasses RLS entirely.
  // Every read and write must therefore carry the userId predicate itself —
  // without it a query returns (or mutates) every user's rows.
  describe("service-role isolation", () => {
    function injected(queries: Record<string, ReturnType<typeof createMockQuery>>) {
      const fallback = createMockQuery();
      return {
        from: vi.fn((table: string) => queries[table] ?? fallback),
      };
    }

    it("scopes list_tasks by user_id", async () => {
      const tasksQuery = createMockQuery([]);
      const sb = injected({ tasks: tasksQuery });
      await executeTool("list_tasks", {}, { supabase: sb as never, userId: "user-999" });
      expect(tasksQuery.eq).toHaveBeenCalledWith("user_id", "user-999");
    });

    it("scopes every search_data query by user_id", async () => {
      const tasksQuery = createMockQuery([]);
      const notesQuery = createMockQuery([]);
      const contactsQuery = createMockQuery([]);
      const goalsQuery = createMockQuery([]);
      const sb = injected({
        tasks: tasksQuery,
        notes: notesQuery,
        contacts: contactsQuery,
        goals: goalsQuery,
      });

      await executeTool(
        "search_data",
        { query: "budget" },
        { supabase: sb as never, userId: "user-999" },
      );

      for (const q of [tasksQuery, notesQuery, contactsQuery, goalsQuery]) {
        expect(q.eq).toHaveBeenCalledWith("user_id", "user-999");
      }
    });

    it("scopes the log_habit lookup by user_id", async () => {
      const habitsQuery = createMockQuery([{ id: "h-1", name: "Run" }]);
      const logsQuery = createMockQuery(null);
      const sb = injected({ habits: habitsQuery, habit_logs: logsQuery });

      await executeTool(
        "log_habit",
        { habit_name: "Run" },
        { supabase: sb as never, userId: "user-999" },
      );
      expect(habitsQuery.eq).toHaveBeenCalledWith("user_id", "user-999");
    });

    it("scopes the delete_task soft delete by user_id, not just the preflight", async () => {
      const tasksQuery = createMockQuery({ id: "task-1" });
      const sb = injected({ tasks: tasksQuery });

      await executeTool(
        "delete_task",
        { task_id: "123e4567-e89b-12d3-a456-426614174000" },
        { supabase: sb as never, userId: "user-999" },
      );

      expect(tasksQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) }),
      );
      expect(tasksQuery.eq).toHaveBeenCalledWith("user_id", "user-999");
    });

    it("scopes the delete_note soft delete by user_id", async () => {
      const notesQuery = createMockQuery({ id: "note-1" });
      const sb = injected({ notes: notesQuery });

      await executeTool(
        "delete_note",
        { note_id: "123e4567-e89b-12d3-a456-426614174000" },
        { supabase: sb as never, userId: "user-999" },
      );

      expect(notesQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) }),
      );
      expect(notesQuery.eq).toHaveBeenCalledWith("user_id", "user-999");
    });

    it("does not delete another user's task", async () => {
      // Preflight finds nothing because the row belongs to someone else.
      const tasksQuery = createMockQuery(null);
      const sb = injected({ tasks: tasksQuery });

      const result = await executeTool(
        "delete_task",
        { task_id: "123e4567-e89b-12d3-a456-426614174000" },
        { supabase: sb as never, userId: "user-999" },
      );

      expect(result).toEqual({ success: false, message: "Task not found" });
      expect(tasksQuery.delete).not.toHaveBeenCalled();
    });
  });

  // Foreign keys arrive from tool input, so under service role they must be
  // proven to belong to the caller before they are written.
  describe("parent-child ownership", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";

    it("rejects a payment_method_id owned by another user", async () => {
      const txQuery = createMockQuery(null);
      const pmQuery = createMockQuery(null); // lookup finds nothing for this user
      const sb = {
        from: vi.fn((table: string) =>
          table === "payment_methods" ? pmQuery : txQuery,
        ),
      };

      const result = await executeTool(
        "log_expense",
        { amount: 50, category: "Food", payment_method_id: uuid },
        { supabase: sb as never, userId: "user-999" },
      );

      expect(result).toEqual({
        success: false,
        message: "Payment method not found",
      });
      expect(txQuery.insert).not.toHaveBeenCalled();
    });

    it("accepts a payment_method_id the caller owns", async () => {
      const txQuery = createMockQuery(null);
      const pmQuery = createMockQuery({ id: uuid });
      const sb = {
        from: vi.fn((table: string) =>
          table === "payment_methods" ? pmQuery : txQuery,
        ),
      };

      const result = await executeTool(
        "log_income",
        { amount: 50, category: "Salary", payment_method_id: uuid },
        { supabase: sb as never, userId: "user-999" },
      );

      expect(result.success).toBe(true);
      expect(txQuery.insert).toHaveBeenCalled();
    });

    it("rejects a focus session attached to another user's task", async () => {
      const sessionQuery = createMockQuery(null);
      const tasksQuery = createMockQuery(null);
      const sb = {
        from: vi.fn((table: string) =>
          table === "tasks" ? tasksQuery : sessionQuery,
        ),
      };

      const result = await executeTool(
        "create_focus_session",
        { duration_minutes: 25, task_id: uuid },
        { supabase: sb as never, userId: "user-999" },
      );

      expect(result).toEqual({ success: false, message: "Task not found" });
      expect(sessionQuery.insert).not.toHaveBeenCalled();
    });

    it("rejects moving a task into another user's project", async () => {
      const tasksQuery = createMockQuery({ title: "T" });
      const projectsQuery = createMockQuery(null);
      const sb = {
        from: vi.fn((table: string) =>
          table === "projects" ? projectsQuery : tasksQuery,
        ),
      };

      const result = await executeTool(
        "update_task",
        { id: uuid, project_id: uuid },
        { supabase: sb as never, userId: "user-999" },
      );

      expect(result).toEqual({ success: false, message: "Project not found" });
      expect(tasksQuery.update).not.toHaveBeenCalled();
    });
  });
});

// ─── Soft delete / recycle bin (migration 022) ────────────────────────────────
//
// The MCP connector is allowed to delete precisely because deleting is
// reversible. These cover the two halves of that claim: nothing is destroyed,
// and everything that reads has to hide what was deleted.

describe("soft delete", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T12:00:00Z"));
  });

  describe("read filters", () => {
    // Regression guard for the whole feature: a read that forgets this filter
    // makes deleted records reappear, which is what soft delete must not do.
    it("list_tasks excludes deleted rows", async () => {
      const tasks = createMockQuery([]);
      setupMockSupabase({ queries: { tasks } });
      await executeTool("list_tasks", {});
      expect(tasks.is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("get_daily_briefing excludes deleted rows from every source", async () => {
      const queries = {
        tasks: createMockQuery([]),
        habits: createMockQuery([]),
        habit_logs: createMockQuery([]),
        goals: createMockQuery([]),
        budgets: createMockQuery([]),
        transactions: createMockQuery([]),
        interactions: createMockQuery([]),
      };
      setupMockSupabase({ queries });
      await executeTool("get_daily_briefing", {});
      for (const [table, query] of Object.entries(queries)) {
        expect(
          query.is,
          `${table} query is missing the deleted_at filter`,
        ).toHaveBeenCalledWith("deleted_at", null);
      }
    });

    it("get_analytics excludes deleted rows from every source", async () => {
      const queries = {
        transactions: createMockQuery([]),
        tasks: createMockQuery([]),
        habits: createMockQuery([]),
        habit_logs: createMockQuery([]),
        goals: createMockQuery([]),
      };
      setupMockSupabase({ queries });
      await executeTool("get_analytics", { period: "month" });
      for (const [table, query] of Object.entries(queries)) {
        expect(
          query.is,
          `${table} query is missing the deleted_at filter`,
        ).toHaveBeenCalledWith("deleted_at", null);
      }
    });

    it("search_data excludes deleted rows", async () => {
      const tasks = createMockQuery([]);
      setupMockSupabase({ queries: { tasks } });
      await executeTool("search_data", { query: "x", types: ["tasks"] });
      expect(tasks.is).toHaveBeenCalledWith("deleted_at", null);
    });

    // Fuzzy name match — without the filter it silently logs against a habit
    // the user deleted.
    it("log_habit will not match a deleted habit", async () => {
      const habits = createMockQuery([]);
      setupMockSupabase({ queries: { habits } });
      const result = await executeTool("log_habit", { habit_name: "Run" });
      expect(habits.is).toHaveBeenCalledWith("deleted_at", null);
      expect(result.success).toBe(false);
    });

    // A soft-deleted row still occupies its slot in the unique index, so the
    // upsert has to revive it rather than write into a hidden record.
    it("log_habit revives a soft-deleted log for the same day", async () => {
      const habits = createMockQuery([{ id: "h-1", name: "Run" }]);
      const habit_logs = createMockQuery(null);
      setupMockSupabase({ queries: { habits, habit_logs } });
      await executeTool("log_habit", { habit_name: "Run" });
      expect(habit_logs.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: null }),
        expect.anything(),
      );
    });

    it("create_journal_entry revives a soft-deleted entry for the same date", async () => {
      const journal_entries = createMockQuery({ id: "j-1" });
      setupMockSupabase({ queries: { journal_entries } });
      await executeTool("create_journal_entry", {
        date: "2026-06-23",
        content: "hello",
      });
      expect(journal_entries.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: null }),
        expect.anything(),
      );
    });
  });

  // Brief items 8-10: deleting a parent never destroys child history.
  describe("parent deletes keep child history", () => {
    it("delete_project unassigns its tasks and says so", async () => {
      const projects = createMockQuery({ id: uuid, name: "Website" });
      const tasks = createMockQuery(null);
      const detachChain = {
        eq: vi.fn(() => detachChain),
        is: vi.fn(() => Promise.resolve({ count: 4, error: null })),
      };
      tasks.update = vi.fn(() => detachChain);
      setupMockSupabase({ queries: { projects, tasks } });

      const result = await executeTool("delete_project", {
        project_id: uuid,
        project_name: "Website",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("4 task(s) unassigned, not deleted");
      expect(tasks.delete).not.toHaveBeenCalled();
    });

    // milestones.goal_id is NOT NULL so it cannot be unlinked; the milestones
    // simply stay put rather than being deleted alongside the goal.
    it("delete_goal leaves milestones untouched", async () => {
      const goals = createMockQuery({ id: uuid, title: "Ship v2" });
      const milestones = createMockQuery(null);
      setupMockSupabase({ queries: { goals, milestones } });

      await executeTool("delete_goal", { goal_id: uuid, goal_title: "Ship v2" });

      expect(milestones.delete).not.toHaveBeenCalled();
      expect(milestones.update).not.toHaveBeenCalled();
    });

    it("delete_contact leaves interactions untouched", async () => {
      const contacts = createMockQuery({ id: uuid, name: "Jane" });
      const interactions = createMockQuery(null);
      setupMockSupabase({ queries: { contacts, interactions } });

      await executeTool("delete_contact", {
        contact_id: uuid,
        contact_name: "Jane",
      });

      expect(interactions.delete).not.toHaveBeenCalled();
      expect(interactions.update).not.toHaveBeenCalled();
    });
  });

  describe("restore_record", () => {
    it("clears deleted_at and returns the row", async () => {
      const tasks = createMockQuery({ id: uuid, title: "Back again" });
      setupMockSupabase({ queries: { tasks } });

      const result = await executeTool("restore_record", {
        entity: "task",
        id: uuid,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Back again");
      expect(tasks.update).toHaveBeenCalledWith({ deleted_at: null });
      // Only something already in the bin can be restored.
      expect(tasks.not).toHaveBeenCalledWith("deleted_at", "is", null);
    });

    it("reports when nothing deleted matches that id", async () => {
      const tasks = createMockQuery(null);
      setupMockSupabase({ queries: { tasks } });

      const result = await executeTool("restore_record", {
        entity: "task",
        id: uuid,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("No deleted task found");
    });

    it("rejects an unknown entity", async () => {
      setupMockSupabase({});
      const result = await executeTool("restore_record", {
        entity: "not_a_thing",
        id: uuid,
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });

    it("scopes the restore by user_id", async () => {
      const tasks = createMockQuery({ id: uuid, title: "T" });
      const sb = { from: vi.fn(() => tasks) };
      await executeTool(
        "restore_record",
        { entity: "task", id: uuid },
        { supabase: sb as never, userId: "user-999" },
      );
      expect(tasks.eq).toHaveBeenCalledWith("user_id", "user-999");
    });
  });

  describe("purge_record", () => {
    // confirm is z.literal(true), so an unconfirmed call never reaches the DB.
    it("refuses without confirm: true and touches nothing", async () => {
      const tasks = createMockQuery({ id: uuid });
      setupMockSupabase({ queries: { tasks } });

      const result = await executeTool("purge_record", {
        entity: "task",
        id: uuid,
        record_label: "T",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("confirm: true");
      expect(tasks.delete).not.toHaveBeenCalled();
      expect(tasks.select).not.toHaveBeenCalled();
    });

    it("refuses confirm: false", async () => {
      const tasks = createMockQuery({ id: uuid });
      setupMockSupabase({ queries: { tasks } });
      const result = await executeTool("purge_record", {
        entity: "task",
        id: uuid,
        record_label: "T",
        confirm: false,
      });
      expect(result.success).toBe(false);
      expect(tasks.delete).not.toHaveBeenCalled();
    });

    // Purging only ever applies to something already in the bin, so a single
    // mistaken call can never destroy live data.
    it("refuses to purge a row that is not already deleted", async () => {
      const tasks = createMockQuery(null);
      setupMockSupabase({ queries: { tasks } });

      const result = await executeTool("purge_record", {
        entity: "task",
        id: uuid,
        record_label: "T",
        confirm: true,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("purge only removes what is already");
      expect(tasks.delete).not.toHaveBeenCalled();
    });

    it("hard-deletes a deleted row and warns it cannot be undone", async () => {
      const tasks = createMockQuery({ id: uuid, title: "Gone for good" });
      setupMockSupabase({ queries: { tasks } });

      const result = await executeTool("purge_record", {
        entity: "task",
        id: uuid,
        record_label: "Gone for good",
        confirm: true,
      });

      expect(result.success).toBe(true);
      expect(tasks.delete).toHaveBeenCalled();
      expect(result.message).toContain("Gone for good");
      expect(result.message).toContain("cannot be undone");
    });

    // Purge is the one path where FK cascades really do destroy children, so
    // the response has to name them.
    it("names the child rows a cascade destroys", async () => {
      const habits = createMockQuery({ id: uuid, name: "Run" });
      setupMockSupabase({ queries: { habits } });

      const result = await executeTool("purge_record", {
        entity: "habit",
        id: uuid,
        record_label: "Run",
        confirm: true,
      });

      expect(result.message).toContain("habit logs");
    });
  });

  describe("bulk_delete_records", () => {
    const ids = [
      "123e4567-e89b-12d3-a456-426614174001",
      "123e4567-e89b-12d3-a456-426614174002",
    ];

    it("refuses without confirm: true", async () => {
      const tasks = createMockQuery([]);
      setupMockSupabase({ queries: { tasks } });

      const result = await executeTool("bulk_delete_records", {
        entity: "task",
        ids,
        summary: "two tasks",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("confirm: true");
      expect(tasks.update).not.toHaveBeenCalled();
    });

    // Brief item 7: report the count actually affected.
    it("returns the number of rows deleted", async () => {
      const tasks = createMockQuery(ids.map((id) => ({ id })));
      setupMockSupabase({ queries: { tasks } });

      const result = await executeTool("bulk_delete_records", {
        entity: "task",
        ids,
        summary: "two tasks",
        confirm: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Deleted 2 tasks");
      expect(result.data).toEqual({ deleted_count: 2, ids });
    });

    // The requested count and the affected count differ whenever an id was
    // already deleted or belongs to someone else — say so rather than implying
    // everything was deleted.
    it("reports ids that were skipped", async () => {
      const tasks = createMockQuery([{ id: ids[0] }]);
      setupMockSupabase({ queries: { tasks } });

      const result = await executeTool("bulk_delete_records", {
        entity: "task",
        ids,
        summary: "two tasks",
        confirm: true,
      });

      expect(result.message).toContain("Deleted 1 tasks");
      expect(result.message).toContain("1 id(s) were skipped");
    });

    it("reports when nothing matched", async () => {
      const tasks = createMockQuery([]);
      setupMockSupabase({ queries: { tasks } });

      const result = await executeTool("bulk_delete_records", {
        entity: "task",
        ids,
        summary: "two tasks",
        confirm: true,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("No live tasks found");
    });
  });

  describe("list_deleted", () => {
    it("pages a single entity from the bin", async () => {
      const tasks = createMockQuery([{ id: "t-1", title: "Deleted task" }]);
      setupMockSupabase({ queries: { tasks } });

      const result = await executeTool("list_deleted", {
        entity: "task",
        limit: 5,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("deleted tasks");
      expect(tasks.not).toHaveBeenCalledWith("deleted_at", "is", null);
      // range() is inclusive, so [0, 5] fetches 6 rows for a page of 5.
      expect(tasks.range).toHaveBeenCalledWith(0, 5);
    });

    it("reports an empty bin when no entity is given", async () => {
      setupMockSupabase({ queries: {} });
      const result = await executeTool("list_deleted", {});
      expect(result.success).toBe(true);
      expect(result.message).toContain("recycle bin is empty");
    });

    it("groups results by entity when no entity is given", async () => {
      const tasks = createMockQuery([{ id: "t-1" }]);
      setupMockSupabase({ queries: { tasks } });
      const result = await executeTool("list_deleted", {});
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("task");
    });

    it("rejects an unknown entity", async () => {
      setupMockSupabase({});
      const result = await executeTool("list_deleted", { entity: "nope" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid input");
    });
  });

  describe("forget_user_fact", () => {
    it("removes the key and purges the matching memory row", async () => {
      const user_profile = createMockQuery({
        facts: { pet: "cat", city: "Dubai" },
      });
      const ai_memory = createMockQuery(null);
      setupMockSupabase({ queries: { user_profile, ai_memory } });

      const result = await executeTool("forget_user_fact", { key: "pet" });

      expect(result.success).toBe(true);
      expect(user_profile.update).toHaveBeenCalledWith({
        facts: { city: "Dubai" },
      });
      // Facts live in the vector store too, or recall_memories keeps surfacing it.
      expect(ai_memory.delete).toHaveBeenCalled();
    });

    it("reports when the key is not stored", async () => {
      const user_profile = createMockQuery({ facts: { pet: "cat" } });
      setupMockSupabase({ queries: { user_profile } });

      const result = await executeTool("forget_user_fact", { key: "car" });

      expect(result.success).toBe(false);
      expect(result.message).toContain("No stored fact");
      expect(user_profile.update).not.toHaveBeenCalled();
    });

    it("reports when there are no facts at all", async () => {
      const user_profile = createMockQuery(null);
      setupMockSupabase({ queries: { user_profile } });
      const result = await executeTool("forget_user_fact", { key: "pet" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("No stored facts");
    });
  });
});

// ─── WHATSAPP REMINDERS (023) ─────────────────────────────────────────────────

describe("whatsapp reminder tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2026-06-23T12:00:00Z"));
  });

  describe("set_whatsapp_reminders", () => {
    it("upserts a recipient with all reminder types by default", async () => {
      const whatsapp_recipients = createMockQuery({
        id: "wr-1",
        phone_e164: "+971500000000",
        reminder_types: ["habit_nudge", "crm_followup", "task_due"],
        active: true,
      });
      setupMockSupabase({ queries: { whatsapp_recipients } });

      const result = await executeTool("set_whatsapp_reminders", {
        phone: "+971500000000",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("+971500000000");
      expect(whatsapp_recipients.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          phone_e164: "+971500000000",
          reminder_types: ["habit_nudge", "crm_followup", "task_due"],
          active: true,
        }),
        { onConflict: "user_id,phone_e164" },
      );
    });

    it("honours an explicit reminder_types subset and active=false", async () => {
      const whatsapp_recipients = createMockQuery({
        id: "wr-1",
        phone_e164: "+971500000000",
        reminder_types: ["task_due"],
        active: false,
      });
      setupMockSupabase({ queries: { whatsapp_recipients } });

      const result = await executeTool("set_whatsapp_reminders", {
        phone: "+971500000000",
        reminder_types: ["task_due"],
        active: false,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("disabled");
      expect(whatsapp_recipients.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ reminder_types: ["task_due"], active: false }),
        { onConflict: "user_id,phone_e164" },
      );
    });

    it("rejects a phone number that is not E.164", async () => {
      const whatsapp_recipients = createMockQuery(null);
      setupMockSupabase({ queries: { whatsapp_recipients } });

      const result = await executeTool("set_whatsapp_reminders", {
        phone: "0500000000",
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid input for this action.");
      // Must never reach the database — the column CHECK would reject it, but
      // the tool should fail before spending a round trip.
      expect(whatsapp_recipients.upsert).not.toHaveBeenCalled();
    });

    it("rejects an empty reminder_types array", async () => {
      const whatsapp_recipients = createMockQuery(null);
      setupMockSupabase({ queries: { whatsapp_recipients } });

      const result = await executeTool("set_whatsapp_reminders", {
        phone: "+971500000000",
        reminder_types: [],
      });

      expect(result.success).toBe(false);
      expect(whatsapp_recipients.upsert).not.toHaveBeenCalled();
    });

    it("returns not-authenticated when there is no user", async () => {
      setupMockSupabase({ user: null });
      const result = await executeTool("set_whatsapp_reminders", {
        phone: "+971500000000",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Not authenticated");
    });

    it("returns error on Supabase failure", async () => {
      const whatsapp_recipients = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { whatsapp_recipients } });

      const result = await executeTool("set_whatsapp_reminders", {
        phone: "+971500000000",
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });

  describe("list_whatsapp_reminders", () => {
    it("lists recipients scoped to the user", async () => {
      const whatsapp_recipients = createMockQuery([
        { id: "wr-1", phone_e164: "+971500000000", active: true },
      ]);
      const whatsapp_log = createMockQuery([]);
      setupMockSupabase({ queries: { whatsapp_recipients, whatsapp_log } });

      const result = await executeTool("list_whatsapp_reminders", {});

      expect(result.success).toBe(true);
      expect(result.message).toContain("1 WhatsApp recipients");
      expect(whatsapp_recipients.eq).toHaveBeenCalledWith("user_id", "user-123");
    });

    it("surfaces recent failed sends, since Meta drops them silently", async () => {
      const whatsapp_recipients = createMockQuery([
        { id: "wr-1", phone_e164: "+971500000000", active: true },
      ]);
      const whatsapp_log = createMockQuery([
        { id: "log-1", reminder_type: "task_due", error: "template not found" },
        { id: "log-2", reminder_type: "habit_nudge", error: "template not found" },
      ]);
      setupMockSupabase({ queries: { whatsapp_recipients, whatsapp_log } });

      const result = await executeTool("list_whatsapp_reminders", {});

      expect(result.success).toBe(true);
      expect(result.message).toContain("2 failed sends");
      expect(whatsapp_log.eq).toHaveBeenCalledWith("status", "failed");
      // 7-day window measured from the Dubai date, not the UTC one.
      expect(whatsapp_log.gte).toHaveBeenCalledWith("created_at", "2026-06-16");
    });

    it("omits the failure clause when there are none", async () => {
      const whatsapp_recipients = createMockQuery([]);
      const whatsapp_log = createMockQuery([]);
      setupMockSupabase({ queries: { whatsapp_recipients, whatsapp_log } });

      const result = await executeTool("list_whatsapp_reminders", {});

      expect(result.success).toBe(true);
      expect(result.message).not.toContain("failed sends");
    });

    it("returns not-authenticated when there is no user", async () => {
      setupMockSupabase({ user: null });
      const result = await executeTool("list_whatsapp_reminders", {});
      expect(result.success).toBe(false);
      expect(result.message).toBe("Not authenticated");
    });

    it("returns error on Supabase failure", async () => {
      const whatsapp_recipients = createMockQuery(null, { message: "boom" });
      setupMockSupabase({ queries: { whatsapp_recipients } });
      const result = await executeTool("list_whatsapp_reminders", {});
      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong. Please try again.");
    });
  });
});
