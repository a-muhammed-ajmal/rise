import { afterEach, describe, expect, it, vi } from "vitest";

// GEMINI_MODEL is read once at module load, so each case re-imports it.
async function loadModels() {
  vi.resetModules();
  return import("../models");
}

describe("GEMINI_MODEL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to gemini-2.5-flash when no override is set", async () => {
    vi.stubEnv("GEMINI_MODEL", "");
    const { GEMINI_MODEL, DEFAULT_GEMINI_MODEL } = await loadModels();
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-2.5-flash");
    expect(GEMINI_MODEL).toBe(DEFAULT_GEMINI_MODEL);
  });

  it("uses the GEMINI_MODEL override, trimmed", async () => {
    vi.stubEnv("GEMINI_MODEL", "  gemini-next-flash  ");
    const { GEMINI_MODEL } = await loadModels();
    expect(GEMINI_MODEL).toBe("gemini-next-flash");
  });

  it("ignores a whitespace-only override", async () => {
    vi.stubEnv("GEMINI_MODEL", "   ");
    const { GEMINI_MODEL, DEFAULT_GEMINI_MODEL } = await loadModels();
    expect(GEMINI_MODEL).toBe(DEFAULT_GEMINI_MODEL);
  });
});
