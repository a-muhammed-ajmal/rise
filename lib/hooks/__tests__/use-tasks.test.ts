import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";

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
  is: vi.fn().mockReturnThis(),
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
    getClaims: vi
      .fn()
      .mockResolvedValue({ data: { claims: { sub: "user-123" } }, error: null }),
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

    expect(mockQueryChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );
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

describe("useTasks with a server snapshot", () => {
  const serverTask = {
    id: "t-srv",
    title: "From the server",
    status: "todo",
    is_completed: false,
    labels: [],
    subtasks: [],
    attachments: [],
  };

  function snapshot(
    filter: "today" | "all",
    loadedAt: number = Date.now(),
  ) {
    return {
      data: { filter, projectId: null, tasks: [serverTask] },
      loadedAt,
    } as never;
  }

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    setupQueryResolve([]);
  });

  it("captures the snapshot once, so an inline snapshot does not refetch every render", async () => {
    const { rerender } = renderHook(() =>
      useTasks("all", undefined, snapshot("today")),
    );
    await waitFor(() => expect(mockSupabase.from).toHaveBeenCalledTimes(1));
    rerender();
    rerender();
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it("renders a fresh snapshot for its own view without fetching", () => {
    const { result } = renderHook(() =>
      useTasks("today", undefined, snapshot("today")),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.tasks).toEqual([serverTask]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
    // Realtime still subscribes, so later changes keep arriving.
    expect(mockSupabase.channel).toHaveBeenCalled();
  });

  it("fetches when the snapshot is stale", async () => {
    renderHook(() =>
      useTasks("today", undefined, snapshot("today", Date.now() - 60_000)),
    );
    await waitFor(() => expect(mockSupabase.from).toHaveBeenCalledWith("tasks"));
  });

  it("fetches when the snapshot answers a different view", async () => {
    renderHook(() => useTasks("all", undefined, snapshot("today")));
    await waitFor(() => expect(mockSupabase.from).toHaveBeenCalledWith("tasks"));
  });

  it("refetches on returning to the snapshot's view instead of trusting it again", async () => {
    const snap = snapshot("today");
    const { rerender } = renderHook(
      ({ filter }: { filter: "today" | "all" }) => useTasks(filter, undefined, snap),
      { initialProps: { filter: "today" } },
    );
    expect(mockSupabase.from).not.toHaveBeenCalled();

    rerender({ filter: "all" });
    await waitFor(() => expect(mockSupabase.from).toHaveBeenCalledTimes(1));

    rerender({ filter: "today" });
    await waitFor(() => expect(mockSupabase.from).toHaveBeenCalledTimes(2));
    expect(mockQueryChain.or).toHaveBeenCalled();
  });
});
