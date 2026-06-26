import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Must be defined before vi.mock calls that reference them
const mockGetSubscription = vi.fn();
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
const mockReady = Promise.resolve({
  pushManager: {
    getSubscription: mockGetSubscription,
    subscribe: mockSubscribe,
  },
});

describe("usePushSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSubscription.mockResolvedValue(null);

    // Reset Notification mock
    Object.defineProperty(window, "Notification", {
      value: {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("granted"),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: mockReady },
      writable: true,
      configurable: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ publicKey: "dGVzdA==" }),
    });
  });

  it("starts with default permission and not subscribed", async () => {
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());
    expect(result.current.permission).toBe("default");
    expect(result.current.subscribed).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("sets permission from Notification.permission on mount", async () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "granted", requestPermission: vi.fn() },
      writable: true,
      configurable: true,
    });
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.permission).toBe("granted"));
  });

  it("sets subscribed=true if existing subscription found", async () => {
    mockGetSubscription.mockResolvedValue({ endpoint: "https://push.example.com" });
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.subscribed).toBe(true));
  });

  it("sets unsupported when Notification API missing", async () => {
    const originalNotification = window.Notification;
    // @ts-expect-error — testing missing API
    delete window.Notification;
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());
    expect(result.current.permission).toBe("unsupported");
    // Restore
    Object.defineProperty(window, "Notification", {
      value: originalNotification,
      writable: true,
      configurable: true,
    });
  });

  it("subscribe: requests permission, fetches VAPID key, and posts subscription", async () => {
    const mockSub = {
      toJSON: () => ({ endpoint: "https://push.example.com", keys: { p256dh: "a", auth: "b" } }),
    };
    mockSubscribe.mockResolvedValue(mockSub);

    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.subscribed).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith("/api/push/vapid-public-key");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/push/subscribe",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("subscribe: does nothing when permission is unsupported", async () => {
    const originalNotification = window.Notification;
    // @ts-expect-error — testing missing API
    delete window.Notification;
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());

    await act(async () => {
      await result.current.subscribe();
    });

    expect(global.fetch).not.toHaveBeenCalled();
    Object.defineProperty(window, "Notification", {
      value: originalNotification,
      writable: true,
      configurable: true,
    });
  });

  it("subscribe: stops if permission not granted", async () => {
    Object.defineProperty(window, "Notification", {
      value: {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("denied"),
      },
      writable: true,
      configurable: true,
    });
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.subscribed).toBe(false);
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("unsubscribe: calls API and unsubscribes from push manager", async () => {
    const mockSubObj = {
      endpoint: "https://push.example.com",
      unsubscribe: mockUnsubscribe.mockResolvedValue(true),
    };
    mockGetSubscription.mockResolvedValue(mockSubObj);

    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/push/unsubscribe",
      expect.objectContaining({ method: "POST" })
    );
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(result.current.subscribed).toBe(false);
  });
});
