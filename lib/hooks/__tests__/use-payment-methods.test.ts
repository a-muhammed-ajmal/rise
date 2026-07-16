import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockQueryChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
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

vi.mock("@/lib/format", () => ({
  todayISO: () => "2026-06-23",
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { usePaymentMethods } from "../use-payment-methods";
import { toast } from "sonner";

function setupQueryResolve(data: unknown, error: unknown = null) {
  Object.defineProperty(mockQueryChain, "then", {
    value: (resolve: (v: unknown) => void) =>
      Promise.resolve({ data, error }).then(resolve),
    writable: true,
    configurable: true,
  });
}

describe("usePaymentMethods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });
    mockQueryChain.single.mockResolvedValue({ data: null, error: null });
    mockQueryChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    setupQueryResolve([]);
  });

  it("returns initial loading state", () => {
    const { result } = renderHook(() => usePaymentMethods());
    expect(result.current.loading).toBe(true);
    expect(result.current.paymentMethods).toEqual([]);
  });

  it("fetches payment methods ordered by display_order", async () => {
    const methods = [
      { id: "pm-1", name: "Cash", balance: 100, display_order: 0 },
      { id: "pm-2", name: "Bank", balance: 500, display_order: 1 },
    ];
    setupQueryResolve(methods);

    const { result } = renderHook(() => usePaymentMethods());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.paymentMethods).toEqual(methods);
    expect(mockQueryChain.order).toHaveBeenCalledWith("display_order", {
      ascending: true,
    });
  });

  it("handles null data from fetch", async () => {
    setupQueryResolve(null);
    const { result } = renderHook(() => usePaymentMethods());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.paymentMethods).toEqual([]);
  });

  it("shows a toast and leaves loading true when fetch fails", async () => {
    setupQueryResolve(null, { message: "boom" });
    const { result } = renderHook(() => usePaymentMethods());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to load payment methods"),
    );
    expect(result.current.loading).toBe(true);
  });

  describe("createPaymentMethod", () => {
    it("inserts with the next display_order and refreshes", async () => {
      setupQueryResolve([
        { id: "pm-1", name: "Cash", balance: 0, display_order: 0 },
        { id: "pm-2", name: "Bank", balance: 0, display_order: 2 },
      ]);
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.createPaymentMethod({
          name: "  Savings  ",
          balance: 1000,
          color: "#fff",
        });
      });

      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          name: "Savings",
          balance: 1000,
          color: "#fff",
          is_active: true,
          display_order: 3,
        }),
      );
    });

    it("does nothing when the user is not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const before = mockQueryChain.insert.mock.calls.length;
      await act(async () => {
        await result.current.createPaymentMethod({
          name: "Ghost",
          balance: 0,
          color: null,
        });
      });
      expect(mockQueryChain.insert.mock.calls.length).toBe(before);
    });

    it("shows a duplicate-name toast on unique constraint violation", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      setupQueryResolve(null, { code: "23505" });
      await act(async () => {
        await result.current.createPaymentMethod({
          name: "Cash",
          balance: 0,
          color: null,
        });
      });
      expect(toast.error).toHaveBeenCalledWith(
        "A wallet with that name already exists",
      );
    });

    it("shows a generic toast on other Supabase errors", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      setupQueryResolve(null, { code: "500", message: "boom" });
      await act(async () => {
        await result.current.createPaymentMethod({
          name: "Cash",
          balance: 0,
          color: null,
        });
      });
      expect(toast.error).toHaveBeenCalledWith("Failed to create wallet");
    });
  });

  describe("updatePaymentMethod", () => {
    it("trims the name and updates by id", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.updatePaymentMethod("pm-1", {
          name: "  Renamed  ",
        });
      });

      expect(mockQueryChain.update).toHaveBeenCalledWith({ name: "Renamed" });
      expect(mockQueryChain.eq).toHaveBeenCalledWith("id", "pm-1");
    });

    it("updates only color when name is omitted", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.updatePaymentMethod("pm-1", { color: "#123456" });
      });

      expect(mockQueryChain.update).toHaveBeenCalledWith({ color: "#123456" });
    });

    it("shows a duplicate-name toast on unique constraint violation", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      setupQueryResolve(null, { code: "23505" });
      await act(async () => {
        await result.current.updatePaymentMethod("pm-1", { name: "Cash" });
      });
      expect(toast.error).toHaveBeenCalledWith(
        "A wallet with that name already exists",
      );
    });

    it("shows a generic toast on other Supabase errors", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      setupQueryResolve(null, { code: "500" });
      await act(async () => {
        await result.current.updatePaymentMethod("pm-1", { name: "Cash" });
      });
      expect(toast.error).toHaveBeenCalledWith("Failed to update wallet");
    });
  });

  describe("setActiveStatus", () => {
    it("updates is_active", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.setActiveStatus("pm-1", false);
      });

      expect(mockQueryChain.update).toHaveBeenCalledWith({ is_active: false });
      expect(mockQueryChain.eq).toHaveBeenCalledWith("id", "pm-1");
    });

    it("shows a toast on Supabase error", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      setupQueryResolve(null, { message: "boom" });
      await act(async () => {
        await result.current.setActiveStatus("pm-1", true);
      });
      expect(toast.error).toHaveBeenCalledWith("Failed to update wallet status");
    });
  });

  describe("reorderPaymentMethods", () => {
    it("updates display_order for each id in sequence", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.reorderPaymentMethods(["pm-2", "pm-1"]);
      });

      expect(mockQueryChain.update).toHaveBeenCalledWith({ display_order: 0 });
      expect(mockQueryChain.update).toHaveBeenCalledWith({ display_order: 1 });
    });

    it("shows a toast when the reorder throws", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      Object.defineProperty(mockQueryChain, "then", {
        value: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
          Promise.reject(new Error("boom")).then(resolve, reject),
        writable: true,
        configurable: true,
      });

      await act(async () => {
        await result.current.reorderPaymentMethods(["pm-1"]);
      });
      expect(toast.error).toHaveBeenCalledWith("Failed to reorder wallets");
    });
  });

  describe("adjustBalance", () => {
    it("does nothing when the delta is zero", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const before = mockQueryChain.insert.mock.calls.length;
      await act(async () => {
        await result.current.adjustBalance("pm-1", 100, 100, "no change");
      });
      expect(mockQueryChain.insert.mock.calls.length).toBe(before);
    });

    it("inserts an adjustment transaction for the delta", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.adjustBalance("pm-1", 100, 150, "Found cash");
      });

      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          type: "adjustment",
          amount: 50,
          category: "Balance Adjustment",
          description: "Found cash",
          date: "2026-06-23",
          payment_method_id: "pm-1",
        }),
      );
    });

    it("does nothing when the user is not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const before = mockQueryChain.insert.mock.calls.length;
      await act(async () => {
        await result.current.adjustBalance("pm-1", 100, 200, "x");
      });
      expect(mockQueryChain.insert.mock.calls.length).toBe(before);
    });

    it("shows a toast on Supabase error", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      setupQueryResolve(null, { message: "boom" });
      await act(async () => {
        await result.current.adjustBalance("pm-1", 100, 200, "x");
      });
      expect(toast.error).toHaveBeenCalledWith("Failed to adjust balance");
    });
  });

  describe("findOrCreateByName", () => {
    it("returns null for a blank name without calling Supabase", async () => {
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const fromCallsBefore = mockSupabase.from.mock.calls.length;
      let id: string | null = "unset";
      await act(async () => {
        id = await result.current.findOrCreateByName("   ");
      });
      expect(id).toBeNull();
      expect(mockSupabase.from.mock.calls.length).toBe(fromCallsBefore);
    });

    it("returns null when the user is not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let id: string | null = "unset";
      await act(async () => {
        id = await result.current.findOrCreateByName("Cash");
      });
      expect(id).toBeNull();
    });

    it("returns the existing id on a case-insensitive match", async () => {
      mockQueryChain.maybeSingle.mockResolvedValueOnce({
        data: { id: "pm-existing" },
        error: null,
      });
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let id: string | null = "unset";
      await act(async () => {
        id = await result.current.findOrCreateByName("cash");
      });
      expect(id).toBe("pm-existing");
      expect(mockQueryChain.insert).not.toHaveBeenCalled();
    });

    it("creates a new wallet when no match exists", async () => {
      mockQueryChain.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      mockQueryChain.single.mockResolvedValueOnce({
        data: { id: "pm-new" },
        error: null,
      });
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let id: string | null = "unset";
      await act(async () => {
        id = await result.current.findOrCreateByName("New Wallet");
      });
      expect(id).toBe("pm-new");
      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          name: "New Wallet",
          balance: 0,
          is_active: true,
        }),
      );
    });

    it("retries the lookup on a concurrent-insert race and returns the winner's id", async () => {
      mockQueryChain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null }) // initial lookup: nothing
        .mockResolvedValueOnce({ data: { id: "pm-won-race" }, error: null }); // retry after race
      mockQueryChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: "23505" },
      });
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let id: string | null = "unset";
      await act(async () => {
        id = await result.current.findOrCreateByName("Race Wallet");
      });
      expect(id).toBe("pm-won-race");
    });

    it("returns null when the race retry also finds nothing", async () => {
      mockQueryChain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });
      mockQueryChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: "23505" },
      });
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let id: string | null = "unset";
      await act(async () => {
        id = await result.current.findOrCreateByName("Race Wallet");
      });
      expect(id).toBeNull();
    });

    it("shows a toast and returns null on a non-race insert error", async () => {
      mockQueryChain.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      mockQueryChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: "500" },
      });
      const { result } = renderHook(() => usePaymentMethods());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let id: string | null = "unset";
      await act(async () => {
        id = await result.current.findOrCreateByName("Broken Wallet");
      });
      expect(id).toBeNull();
      expect(toast.error).toHaveBeenCalledWith("Failed to create wallet");
    });
  });
});
