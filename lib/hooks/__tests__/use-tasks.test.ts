import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

const mockQueryChain = {
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  then: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => mockQueryChain),
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
  },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

vi.mock("@/lib/format", () => ({
  todayISO: () => "2026-06-23",
}));

import { useTasks } from "../use-tasks";

function setupQueryResolve(data: unknown) {
  mockQueryChain.then = vi
    .fn()
    .mockImplementation((resolve) => resolve({ data, error: null }));
  Object.defineProperty(mockQueryChain, "then", {
    value: (resolve: (v: unknown) => void) =>
      Promise.resolve({ data, error: null }).then(resolve),
    writable: true,
    configurable: true,
  });
}

describe("useTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryResolve([]);
  });

  it("returns initial loading state", () => {
    const { result } = renderHook(() => useTasks("all"));
    expect(result.current.loading).toBe(true);
    expect(result.current.tasks).toEqual([]);
  });

  it("fetches tasks and sets loading to false", async () => {
    const tasks = [
      { id: "t-1", title: "Task 1", status: "todo", priority: "P2" },
      { id: "t-2", title: "Task 2", status: "todo", priority: "P3" },
    ];
    setupQueryResolve(tasks);

    const { result } = renderHook(() => useTasks("all"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toEqual(
      tasks.map((t) => expect.objectContaining(t)),
    );
  });

  it("applies today filter with or clause", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useTasks("today"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockQueryChain.or).toHaveBeenCalled();
  });

  it("applies project filter", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useTasks("project", "proj-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockQueryChain.eq).toHaveBeenCalledWith("project_id", "proj-1");
  });

  it("subscribes to realtime changes", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useTasks("all"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockSupabase.channel).toHaveBeenCalledWith(expect.stringContaining("tasks"));
    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "*", table: "tasks" }),
      expect.any(Function),
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it("cleans up channel on unmount", async () => {
    setupQueryResolve([]);
    const { result, unmount } = renderHook(() => useTasks("all"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    unmount();
    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it("createTask inserts and refreshes", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useTasks("all"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createTask({ title: "New task", priority: "P2" });
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("tasks");
    expect(mockQueryChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New task", priority: "P2" }),
    );
  });

  it("completeTask updates status to done and removes from list", async () => {
    const tasks = [
      { id: "t-1", title: "Task 1", status: "todo", priority: "P2" },
    ];
    setupQueryResolve(tasks);
    const { result } = renderHook(() => useTasks("all"));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    await act(async () => {
      await result.current.completeTask("t-1");
    });

    expect(mockQueryChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done" }),
    );
    expect(result.current.tasks).toHaveLength(0);
  });

  it("deleteTask removes from list", async () => {
    const tasks = [
      { id: "t-1", title: "Task 1", status: "todo", priority: "P2" },
    ];
    setupQueryResolve(tasks);
    const { result } = renderHook(() => useTasks("all"));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    await act(async () => {
      await result.current.deleteTask("t-1");
    });

    expect(mockQueryChain.delete).toHaveBeenCalled();
    expect(result.current.tasks).toHaveLength(0);
  });

  it("updateTask strips DB-managed fields", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useTasks("all"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateTask("t-1", {
        id: "t-1",
        title: "Updated",
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
      } as never);
    });

    expect(mockQueryChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Updated" }),
    );
    expect(mockQueryChain.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "t-1" }),
    );
  });

  it("handles null data from fetch", async () => {
    Object.defineProperty(mockQueryChain, "then", {
      value: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useTasks("all"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toEqual([]);
  });

  it("exposes refresh function", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useTasks("all"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.refresh).toBe("function");
  });
});
