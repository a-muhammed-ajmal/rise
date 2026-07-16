import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockQueryChain = {
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
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

import { useCategories } from "../use-categories";

function setupQueryResolve(data: unknown, error: unknown = null) {
  Object.defineProperty(mockQueryChain, "then", {
    value: (resolve: (v: unknown) => void) =>
      Promise.resolve({ data, error }).then(resolve),
    writable: true,
    configurable: true,
  });
}

describe("useCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryResolve([]);
  });

  it("returns initial loading state", () => {
    const { result } = renderHook(() => useCategories());
    expect(result.current.loading).toBe(true);
    expect(result.current.categories).toEqual([]);
  });

  it("fetches categories ordered by name on mount", async () => {
    const categories = [
      { id: "c-1", name: "Groceries", type: "expense" },
      { id: "c-2", name: "Salary", type: "income" },
    ];
    setupQueryResolve(categories);

    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.categories).toEqual(categories);
    expect(mockQueryChain.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });
  });

  it("handles null data from fetch", async () => {
    setupQueryResolve(null);

    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toEqual([]);
  });

  it("createCategory inserts a trimmed name with the user id and refreshes", async () => {
    setupQueryResolve({ id: "c-3", name: "Transport", type: "expense" });
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: unknown;
    await act(async () => {
      created = await result.current.createCategory("  Transport  ", "expense");
    });

    expect(mockQueryChain.insert).toHaveBeenCalledWith({
      user_id: "user-123",
      name: "Transport",
      type: "expense",
    });
    expect(created).toEqual({ id: "c-3", name: "Transport", type: "expense" });
  });

  it("createCategory returns null when the user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    setupQueryResolve([]);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const insertCallsBefore = mockQueryChain.insert.mock.calls.length;
    let created: unknown = "unset";
    await act(async () => {
      created = await result.current.createCategory("Ghost", "expense");
    });

    expect(created).toBeNull();
    expect(mockQueryChain.insert.mock.calls.length).toBe(insertCallsBefore);
  });

  it("createCategory returns null on Supabase error", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    setupQueryResolve(null, { message: "insert failed" });
    let created: unknown = "unset";
    await act(async () => {
      created = await result.current.createCategory("Broken", "expense");
    });
    expect(created).toBeNull();
  });

  it("updateCategory trims the name, updates by id, and refreshes", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateCategory("c-1", "  Renamed  ");
    });

    expect(mockQueryChain.update).toHaveBeenCalledWith({ name: "Renamed" });
    expect(mockQueryChain.eq).toHaveBeenCalledWith("id", "c-1");
  });

  it("deleteCategory removes by id and refreshes", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteCategory("c-1");
    });

    expect(mockQueryChain.delete).toHaveBeenCalled();
    expect(mockQueryChain.eq).toHaveBeenCalledWith("id", "c-1");
  });

  it("exposes fetchCategories function", async () => {
    setupQueryResolve([]);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.fetchCategories).toBe("function");
  });
});
