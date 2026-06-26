import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockQueryChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  from: vi.fn(() => mockQueryChain),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
  },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

import { useProjects } from "../use-projects";

function setupQueryResolve(data: unknown) {
  Object.defineProperty(mockQueryChain, "then", {
    value: (resolve: (v: unknown) => void) =>
      Promise.resolve({ data, error: null }).then(resolve),
    writable: true,
    configurable: true,
  });
}

describe("useProjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryResolve([]);
  });

  it("returns initial loading state", () => {
    const { result } = renderHook(() => useProjects());
    expect(result.current.loading).toBe(true);
    expect(result.current.projects).toEqual([]);
  });

  it("fetches active projects on mount", async () => {
    const projects = [
      { id: "p-1", name: "Alpha", status: "active", color: "#ff0000" },
      { id: "p-2", name: "Beta", status: "active", color: "#00ff00" },
    ];
    setupQueryResolve(projects);

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.projects).toEqual(projects);
    expect(mockQueryChain.eq).toHaveBeenCalledWith("status", "active");
    expect(mockQueryChain.order).toHaveBeenCalledWith("name");
  });

  it("handles null data from fetch", async () => {
    Object.defineProperty(mockQueryChain, "then", {
      value: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.projects).toEqual([]);
  });

  it("createProject inserts with correct fields and refreshes", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createProject("My Project", "#abc123");
    });

    expect(mockQueryChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        name: "My Project",
        color: "#abc123",
        status: "active",
      }),
    );
  });

  it("createProject does nothing when user is null", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    setupQueryResolve([]);
    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const insertCallsBefore = mockQueryChain.insert.mock.calls.length;
    await act(async () => {
      await result.current.createProject("Ghost", "#000");
    });
    expect(mockQueryChain.insert.mock.calls.length).toBe(insertCallsBefore);
  });

  it("updateProject strips DB-managed fields", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateProject("p-1", {
        id: "p-1",
        user_id: "user-123",
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
        name: "Updated",
        color: "#fff",
        status: "active",
        description: null,
      });
    });

    expect(mockQueryChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Updated" }),
    );
    expect(mockQueryChain.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "p-1" }),
    );
    expect(mockQueryChain.eq).toHaveBeenCalledWith("id", "p-1");
  });

  it("deleteProject removes from local state immediately", async () => {
    const projects = [
      { id: "p-1", name: "Alpha", status: "active", color: "#ff0000" },
      { id: "p-2", name: "Beta", status: "active", color: "#00ff00" },
    ];
    setupQueryResolve(projects);

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.projects).toHaveLength(2));

    await act(async () => {
      await result.current.deleteProject("p-1");
    });

    expect(mockQueryChain.delete).toHaveBeenCalled();
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.projects[0].id).toBe("p-2");
  });

  it("exposes refresh function", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.refresh).toBe("function");
  });
});
