import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  embedText,
  storeMemory,
  retrieveMemories,
  retrieveUserFacts,
  compactMessages,
  formatMemoriesForPrompt,
  formatUserFactsForPrompt,
} from "../memory";
import { createClient } from "@/lib/supabase/server";

function createMockQuery(
  returnData: unknown = null,
  returnError: unknown = null,
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.ilike = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  Object.defineProperty(chain, "then", {
    value: (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: returnData, error: returnError }).then(resolve),
    writable: true,
    configurable: true,
  });
  return chain;
}

function setupMockSupabase(options: {
  queries?: Record<string, ReturnType<typeof createMockQuery>>;
  rpcData?: unknown;
}) {
  const { queries = {}, rpcData = null } = options;
  const defaultQuery = createMockQuery();

  const mockSupabase = {
    from: vi.fn((table: string) => queries[table] ?? defaultQuery),
    rpc: vi.fn().mockResolvedValue({ data: rpcData }),
  };

  vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
  return mockSupabase;
}

describe("embedText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VOYAGE_API_KEY;
  });

  it("returns null when VOYAGE_API_KEY is not set", async () => {
    const result = await embedText("test text");
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls Voyage API and returns embedding", async () => {
    process.env.VOYAGE_API_KEY = "test-key";
    const mockEmbedding = [0.1, 0.2, 0.3];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ embedding: mockEmbedding }] }),
    });

    const result = await embedText("test text");
    expect(result).toEqual(mockEmbedding);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.voyageai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("returns null on API failure", async () => {
    process.env.VOYAGE_API_KEY = "test-key";
    mockFetch.mockResolvedValue({ ok: false });

    const result = await embedText("test text");
    expect(result).toBeNull();
  });

  it("returns null when response has no embeddings", async () => {
    process.env.VOYAGE_API_KEY = "test-key";
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const result = await embedText("test text");
    expect(result).toBeNull();
  });
});

describe("storeMemory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VOYAGE_API_KEY;
  });

  it("inserts memory without embedding when API key is missing", async () => {
    const query = createMockQuery();
    const mock = setupMockSupabase({ queries: { ai_memory: query } });

    await storeMemory("user-1", "Remember this", { role: "user" });

    expect(mock.from).toHaveBeenCalledWith("ai_memory");
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        content: "Remember this",
      }),
    );
  });

  it("inserts memory with embedding when API key is set", async () => {
    process.env.VOYAGE_API_KEY = "test-key";
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ embedding: [0.1, 0.2] }] }),
    });

    const query = createMockQuery();
    setupMockSupabase({ queries: { ai_memory: query } });

    await storeMemory("user-1", "Remember this", { role: "user" });

    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding: [0.1, 0.2],
      }),
    );
  });
});

describe("retrieveMemories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VOYAGE_API_KEY;
  });

  it("uses semantic search when embeddings available", async () => {
    process.env.VOYAGE_API_KEY = "test-key";
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ embedding: [0.1] }] }),
    });

    const rpcResults = [{ content: "memory 1", metadata: {}, similarity: 0.9 }];
    const mock = setupMockSupabase({ rpcData: rpcResults });

    const result = await retrieveMemories("user-1", "query text");

    expect(mock.rpc).toHaveBeenCalledWith(
      "match_memories",
      expect.objectContaining({
        query_embedding: [0.1],
        match_user_id: "user-1",
      }),
    );
    expect(result).toEqual(rpcResults);
  });

  it("falls back to keyword search when no API key", async () => {
    const keywordData = [
      { content: "keyword result", metadata: { role: "user" } },
    ];
    const query = createMockQuery(keywordData);
    setupMockSupabase({ queries: { ai_memory: query } });

    const result = await retrieveMemories("user-1", "search term");

    expect(result).toEqual([
      { content: "keyword result", metadata: { role: "user" }, similarity: 0 },
    ]);
    expect(query.ilike).toHaveBeenCalled();
  });

  it("falls back to keyword search when semantic returns empty", async () => {
    process.env.VOYAGE_API_KEY = "test-key";
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ embedding: [0.1] }] }),
    });

    const keywordData = [{ content: "fallback result", metadata: {} }];
    const query = createMockQuery(keywordData);
    const mock = setupMockSupabase({
      rpcData: [],
      queries: { ai_memory: query },
    });

    const result = await retrieveMemories("user-1", "query");

    expect(mock.rpc).toHaveBeenCalled();
    expect(result[0].content).toBe("fallback result");
  });

  it("returns empty array when no results found", async () => {
    const query = createMockQuery(null);
    setupMockSupabase({ queries: { ai_memory: query } });

    const result = await retrieveMemories("user-1", "nothing");
    expect(result).toEqual([]);
  });
});

describe("compactMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VOYAGE_API_KEY;
  });

  it("does nothing when messages below threshold", async () => {
    const query = createMockQuery();
    setupMockSupabase({ queries: { ai_memory: query } });

    await compactMessages("user-1", [{ role: "user", content: "hi" }]);
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("stores summary when messages exceed threshold", async () => {
    const query = createMockQuery();
    setupMockSupabase({ queries: { ai_memory: query } });

    const messages = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));

    await compactMessages("user-1", messages);
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Conversation summary"),
      }),
    );
  });
});

describe("formatMemoriesForPrompt", () => {
  it("returns empty string for no memories", () => {
    expect(formatMemoriesForPrompt([])).toBe("");
  });

  it("formats memories as bullet points", () => {
    const memories = [
      { content: "User prefers dark mode", similarity: 0.9 },
      { content: "User works in Dubai", similarity: 0.8 },
    ];
    const result = formatMemoriesForPrompt(memories);
    expect(result).toContain("Relevant memories");
    expect(result).toContain("- User prefers dark mode");
    expect(result).toContain("- User works in Dubai");
  });

  it("truncates long content to 300 chars", () => {
    const longContent = "A".repeat(500);
    const result = formatMemoriesForPrompt([
      { content: longContent, similarity: 0.9 },
    ]);
    expect(result).not.toContain("A".repeat(500));
    expect(result).toContain("A".repeat(300));
  });
});

describe("retrieveUserFacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user facts ordered by most recent", async () => {
    const facts = [{ content: "Likes pizza", metadata: { role: "user" } }];
    const query = createMockQuery(facts);
    setupMockSupabase({ queries: { ai_memory: query } });

    const result = await retrieveUserFacts("user-1");

    expect(result).toEqual(facts);
    expect(query.eq).toHaveBeenCalledWith("memory_type", "user_fact");
    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("returns an empty array when there is no data", async () => {
    const query = createMockQuery(null);
    setupMockSupabase({ queries: { ai_memory: query } });

    const result = await retrieveUserFacts("user-1");
    expect(result).toEqual([]);
  });

  it("uses an injected client instead of creating a cookie client", async () => {
    const facts = [{ content: "Works in Dubai", metadata: {} }];
    const query = createMockQuery(facts);
    const injectedClient = { from: vi.fn(() => query) };

    const result = await retrieveUserFacts(
      "user-1",
      injectedClient as never,
    );

    expect(result).toEqual(facts);
    expect(injectedClient.from).toHaveBeenCalledWith("ai_memory");
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("formatUserFactsForPrompt", () => {
  it("returns empty string for no facts", () => {
    expect(formatUserFactsForPrompt([])).toBe("");
  });

  it("formats facts as bullet points", () => {
    const result = formatUserFactsForPrompt([
      { content: "Likes pizza" },
      { content: "Works in Dubai" },
    ]);
    expect(result).toContain("Things you know about this user");
    expect(result).toContain("- Likes pizza");
    expect(result).toContain("- Works in Dubai");
  });

  it("truncates long content to 200 chars", () => {
    const longContent = "B".repeat(400);
    const result = formatUserFactsForPrompt([{ content: longContent }]);
    expect(result).not.toContain("B".repeat(400));
    expect(result).toContain("B".repeat(200));
  });
});
