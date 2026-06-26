import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock matchMedia
const matchMediaMock = vi.fn((query: string) => ({
  matches: query.includes("dark") ? false : false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
Object.defineProperty(window, "matchMedia", { value: matchMediaMock });

import { ThemeProvider, useTheme } from "../use-theme";

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ThemeProvider, null, children);
}

describe("useTheme", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    document.documentElement.classList.remove("dark");
    matchMediaMock.mockReturnValue({
      matches: false,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it("throws when used outside ThemeProvider", () => {
    expect(() => {
      renderHook(() => useTheme());
    }).toThrow("useTheme must be inside ThemeProvider");
  });

  it("defaults to light theme when no stored preference and system is light", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("reads stored theme from localStorage", () => {
    localStorageMock.getItem.mockReturnValueOnce("dark");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("falls back to system dark preference when no stored value", () => {
    matchMediaMock.mockReturnValueOnce({
      matches: true,
      media: "(prefers-color-scheme: dark)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
  });

  it("toggle switches from light to dark", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");

    act(() => { result.current.toggle(); });

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith("rise-theme", "dark");
  });

  it("toggle switches from dark to light", () => {
    localStorageMock.getItem.mockReturnValueOnce("dark");
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => { result.current.toggle(); });

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith("rise-theme", "light");
  });

  it("toggle persists new theme to localStorage", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => { result.current.toggle(); });
    expect(localStorageMock.setItem).toHaveBeenCalledWith("rise-theme", "dark");
  });
});
