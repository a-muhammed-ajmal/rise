import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";

// useProjects, usePaymentMethods and useCategories accept a server snapshot:
// fresh → render it and skip the mount fetch; stale or missing → fetch.

const mockQuery: Record<string, unknown> = {};
for (const method of ["select", "eq", "is", "order"]) {
  mockQuery[method] = vi.fn(() => mockQuery);
}
mockQuery.then = (resolve: (value: unknown) => unknown) =>
  Promise.resolve({ data: [{ id: "fetched" }], error: null }).then(resolve);

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  from: vi.fn(() => mockQuery),
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({ createClient: () => mockSupabase }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { useProjects } from "../use-projects";
import { usePaymentMethods } from "../use-payment-methods";
import { useCategories } from "../use-categories";

const fresh = () => ({ data: [{ id: "server" }], loadedAt: Date.now() }) as never;
const stale = () =>
  ({ data: [{ id: "server" }], loadedAt: Date.now() - 60_000 }) as never;

describe.each([
  ["useProjects", "projects", (s: never) => useProjects(s).projects, (s: never) => useProjects(s).loading],
  ["usePaymentMethods", "payment_methods", (s: never) => usePaymentMethods(s).paymentMethods, (s: never) => usePaymentMethods(s).loading],
  ["useCategories", "categories", (s: never) => useCategories(s).categories, (s: never) => useCategories(s).loading],
] as const)("%s with a server snapshot", (_name, table, rows, loading) => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a fresh snapshot without fetching", () => {
    const snap = fresh();
    const { result } = renderHook(() => ({ rows: rows(snap), loading: loading(snap) }));
    expect(result.current.rows).toEqual([{ id: "server" }]);
    expect(result.current.loading).toBe(false);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("fetches when the snapshot is stale", async () => {
    const snap = stale();
    const { result } = renderHook(() => rows(snap));
    await waitFor(() => expect(result.current).toEqual([{ id: "fetched" }]));
    expect(mockSupabase.from).toHaveBeenCalledWith(table);
  });

  it("fetches when there is no snapshot", async () => {
    const { result } = renderHook(() => rows(null as never));
    await waitFor(() => expect(result.current).toEqual([{ id: "fetched" }]));
  });
});
