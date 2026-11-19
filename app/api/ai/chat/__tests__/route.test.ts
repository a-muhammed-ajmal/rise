// @vitest-environment node
//
// Server route: reads a streamed Response body, which needs the Node/undici
// globals rather than jsdom's.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomUUID } from "crypto";

const mockSendMessageStream = vi.hoisted(() => vi.fn());
const mockChatsCreate = vi.hoisted(() => vi.fn());
const mockExecuteTool = vi.hoisted(() => vi.fn());
const mockCompactMessages = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: class {
      chats = { create: mockChatsCreate };
    },
  };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/ai/execute-tool", () => ({ executeTool: mockExecuteTool }));
vi.mock("@/lib/ai/memory", () => ({
  retrieveMemories: vi.fn().mockResolvedValue([]),
  retrieveUserFacts: vi.fn().mockResolvedValue([]),
  compactMessages: mockCompactMessages,
  formatMemoriesForPrompt: () => "",
  formatUserFactsForPrompt: () => "",
}));

import { POST } from "../route";
import { createClient } from "@/lib/supabase/server";
import { __resetRateLimits } from "@/lib/rate-limit";
import { signApprovalToken } from "@/lib/ai/approval";
import {
  MAX_TOOL_CALLS_PER_TURN,
  MAX_TOOL_ROUNDS,
} from "@/lib/ai/chat-safety";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const TASK_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER_TASK_ID = "aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff";
const CONTACT_ID = "cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee";

// ─── Supabase mock ───────────────────────────────────────────────────────────

type QueryResult = { data?: unknown; count?: number };

function createQuery(result: QueryResult) {
  const q: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "neq",
    "is",
    "not",
    "lte",
    "or",
    "order",
    "limit",
    "contains",
  ]) {
    q[method] = vi.fn(() => q);
  }
  q.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: result.data ?? null, error: null }),
  );
  q.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({
      data: result.data ?? null,
      error: null,
      count: result.count ?? 0,
    }).then(resolve, reject);
  return q;
}

function setupSupabase(
  options: {
    user?: { id: string } | null;
    tables?: Record<string, QueryResult>;
    tokenConsumed?: boolean;
  } = {},
) {
  const { user = { id: USER_ID }, tables = {}, tokenConsumed = true } = options;
  const queries: Record<string, ReturnType<typeof createQuery>> = {};
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      queries[table] ??= createQuery(tables[table] ?? {});
      return queries[table];
    }),
    rpc: vi.fn().mockResolvedValue({ data: tokenConsumed, error: null }),
    storage: { from: vi.fn() },
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { supabase, queries };
}

// ─── Gemini stream helpers ───────────────────────────────────────────────────

type Part = Record<string, unknown>;

function turn(...parts: Part[]) {
  return Promise.resolve(
    (async function* () {
      yield { candidates: [{ content: { parts } }] };
    })(),
  );
}

const text = (value: string): Part => ({ text: value });

function call(name: string, args: Record<string, unknown> = {}): Part {
  return { functionCall: { id: `${name}-${randomUUID()}`, name, args } };
}

/** The `message` parts sent to Gemini on the nth sendMessageStream call. */
function sentMessage(n: number): Part[] {
  return mockSendMessageStream.mock.calls[n][0].message;
}

function functionResponseNames(parts: Part[]): unknown[] {
  return parts.map(
    (part) =>
      (part.functionResponse as { name?: string } | undefined)?.name,
  );
}

// ─── Request helpers ─────────────────────────────────────────────────────────

function chatRequest(body: unknown): Request {
  return new Request("https://rise.test/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ask = (content: string, extra: Record<string, unknown> = {}) =>
  chatRequest({ messages: [{ role: "user", content }], ...extra });

async function readEvents(res: Response): Promise<Record<string, unknown>[]> {
  const body = await res.text();
  return body
    .split("\n\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice(6)));
}

const ok = (message: string) => ({ success: true, message });

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps queued mockReturnValueOnce values; a test that stops
    // early would otherwise leak its unused model turns into the next test.
    mockSendMessageStream.mockReset();
    mockExecuteTool.mockReset();
    __resetRateLimits();
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.APPROVAL_HMAC_SECRET = "test-approval-secret-at-least-32-chars";
    mockChatsCreate.mockReturnValue({
      sendMessageStream: mockSendMessageStream,
    });
    mockExecuteTool.mockResolvedValue(ok("Done."));
    mockCompactMessages.mockResolvedValue(undefined);
  });

  describe("request guards", () => {
    it("rejects an unauthenticated caller", async () => {
      setupSupabase({ user: null });
      const res = await POST(ask("hi"));
      expect(res.status).toBe(401);
    });

    it("rejects a malformed body", async () => {
      setupSupabase();
      const res = await POST(chatRequest({ messages: "not-an-array" }));
      expect(res.status).toBe(400);
    });
  });

  describe("tool loop", () => {
    it("streams a plain reply with no tool calls in one model turn", async () => {
      setupSupabase();
      mockSendMessageStream.mockReturnValueOnce(turn(text("Hello!")));

      const events = await readEvents(await POST(ask("hi")));

      expect(events).toEqual([{ type: "text", text: "Hello!" }]);
      expect(mockSendMessageStream).toHaveBeenCalledTimes(1);
      expect(mockExecuteTool).not.toHaveBeenCalled();
    });

    it("chains a lookup into a follow-up action, then replies", async () => {
      setupSupabase();
      mockSendMessageStream
        .mockReturnValueOnce(turn(call("list_tasks", { search: "gym" })))
        .mockReturnValueOnce(turn(call("complete_task", { task_id: TASK_ID })))
        .mockReturnValueOnce(turn(text("Marked Gym as done.")));

      const events = await readEvents(await POST(ask("mark my gym task done")));

      expect(mockExecuteTool.mock.calls.map(([name]) => name)).toEqual([
        "list_tasks",
        "complete_task",
      ]);
      expect(mockExecuteTool).toHaveBeenLastCalledWith("complete_task", {
        task_id: TASK_ID,
      });
      // Each tool round's results go back to the model as the next message.
      expect(mockSendMessageStream).toHaveBeenCalledTimes(3);
      expect(functionResponseNames(sentMessage(1))).toEqual(["list_tasks"]);
      expect(functionResponseNames(sentMessage(2))).toEqual(["complete_task"]);
      expect(events.map((event) => event.type)).toEqual([
        "tool_result",
        "tool_result",
        "text",
      ]);
      expect(events.at(-1)).toEqual({ type: "text", text: "Marked Gym as done." });
    });

    it("stops at an approval raised in a later round", async () => {
      setupSupabase({ tables: { contacts: { data: { id: CONTACT_ID } } } });
      mockSendMessageStream
        .mockReturnValueOnce(turn(call("list_contacts", { search: "dentist" })))
        .mockReturnValueOnce(
          turn(call("delete_contact", { contact_id: CONTACT_ID })),
        );

      const events = await readEvents(
        await POST(ask("delete my dentist contact")),
      );

      expect(mockExecuteTool).toHaveBeenCalledTimes(1);
      expect(mockExecuteTool).toHaveBeenCalledWith("list_contacts", {
        search: "dentist",
      });
      // No follow-up turn: the action waits for the user's decision.
      expect(mockSendMessageStream).toHaveBeenCalledTimes(2);
      const approval = events.find((e) => e.type === "approval_required");
      expect(approval).toMatchObject({
        tool: { name: "delete_contact", input: { contact_id: CONTACT_ID } },
        token: expect.any(String),
      });
    });

    it("emits one approval per gated call in the same round", async () => {
      setupSupabase({ tables: { tasks: { data: { id: TASK_ID } } } });
      mockSendMessageStream.mockReturnValueOnce(
        turn(
          call("delete_task", { task_id: TASK_ID }),
          call("delete_task", { task_id: OTHER_TASK_ID }),
        ),
      );

      const events = await readEvents(await POST(ask("delete both tasks")));

      const approvals = events.filter((e) => e.type === "approval_required");
      expect(approvals).toHaveLength(2);
      expect(new Set(approvals.map((a) => a.token)).size).toBe(2);
      expect(mockExecuteTool).not.toHaveBeenCalled();
    });

    it("tells the model a gated row is missing and lets it reply", async () => {
      setupSupabase({ tables: { contacts: { data: null } } });
      mockSendMessageStream
        .mockReturnValueOnce(
          turn(call("delete_contact", { contact_id: CONTACT_ID })),
        )
        .mockReturnValueOnce(turn(text("I couldn't find that contact.")));

      const events = await readEvents(await POST(ask("delete that contact")));

      expect(events.some((e) => e.type === "approval_required")).toBe(false);
      expect(sentMessage(1)).toEqual([
        expect.objectContaining({
          functionResponse: expect.objectContaining({
            name: "delete_contact",
            response: { result: "Resource not found" },
          }),
        }),
      ]);
      expect(events.at(-1)).toEqual({
        type: "text",
        text: "I couldn't find that contact.",
      });
    });

    it("caps the number of tool rounds per message", async () => {
      setupSupabase();
      mockSendMessageStream.mockImplementation(() =>
        turn(call("list_tasks")),
      );

      const events = await readEvents(await POST(ask("loop forever")));

      expect(mockExecuteTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
      expect(mockSendMessageStream).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
      expect(events.at(-1)).toMatchObject({
        type: "error",
        message: expect.stringContaining("smaller requests"),
      });
    });

    it("counts the tool-call budget across rounds, not per round", async () => {
      setupSupabase();
      const perRound = Math.ceil(MAX_TOOL_CALLS_PER_TURN / 2) + 1;
      const many = () =>
        turn(...Array.from({ length: perRound }, () => call("list_tasks")));
      mockSendMessageStream
        .mockReturnValueOnce(many())
        .mockReturnValueOnce(many());

      const events = await readEvents(await POST(ask("do a lot")));

      // The first round fits the budget; the second would exceed it.
      expect(mockExecuteTool).toHaveBeenCalledTimes(perRound);
      expect(events.at(-1)).toMatchObject({ type: "error" });
    });
  });

  describe("context", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-06-23T12:00:00Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("includes overdue tasks instead of the retired inbox status", async () => {
      const { queries } = setupSupabase({
        tables: {
          tasks: {
            data: [
              {
                title: "Call mum",
                priority: "P2",
                due_date: "2026-06-23",
                status: "todo",
              },
              {
                title: "Pay rent",
                priority: "P1",
                due_date: "2026-06-20",
                status: "todo",
              },
            ],
          },
        },
      });
      mockSendMessageStream.mockReturnValueOnce(turn(text("Here's today.")));

      await readEvents(await POST(ask("what's on today?")));

      expect(queries.tasks.lte).toHaveBeenCalledWith("due_date", "2026-06-23");
      expect(queries.tasks.or).not.toHaveBeenCalled();
      const prompt: string =
        mockChatsCreate.mock.calls[0][0].config.systemInstruction;
      expect(prompt).toContain('"Call mum" [P2]');
      expect(prompt).toContain('"Pay rent" [P1, overdue since 20/06/2026]');
    });
  });

  describe("tool results in history", () => {
    const listContext =
      'list_tasks (ok): Found 2 tasks\n[{"id":"t-gym","title":"Gym"},{"id":"t-dentist","title":"Dentist"}]';

    function historyParts(): Part[][] {
      return mockChatsCreate.mock.calls[0][0].history.map(
        (content: { parts: Part[] }) => content.parts,
      );
    }

    it("streams a compact summary of each result for the client to keep", async () => {
      setupSupabase();
      mockExecuteTool.mockResolvedValueOnce({
        success: true,
        message: "Found 1 tasks",
        data: [{ id: TASK_ID, title: "Gym", user_id: USER_ID }],
      });
      mockSendMessageStream
        .mockReturnValueOnce(turn(call("list_tasks")))
        .mockReturnValueOnce(turn(text("One task: Gym.")));

      const events = await readEvents(await POST(ask("list my tasks")));

      const toolEvent = events.find((e) => e.type === "tool_result");
      expect(toolEvent?.context).toBe(
        `list_tasks (ok): Found 1 tasks\n[{"id":"${TASK_ID}","title":"Gym"}]`,
      );
    });

    it("replays earlier tool results so a follow-up can refer to them", async () => {
      setupSupabase();
      mockSendMessageStream.mockReturnValueOnce(turn(text("Deleting Dentist.")));

      await readEvents(
        await POST(
          chatRequest({
            messages: [
              { role: "user", content: "list my tasks" },
              {
                role: "assistant",
                content: "1. Gym 2. Dentist",
                toolResults: [
                  { tool: "list_tasks", success: true, context: listContext },
                ],
              },
              { role: "user", content: "delete the second one" },
            ],
          }),
        ),
      );

      const [userTurn, modelTurn] = historyParts();
      expect(userTurn).toEqual([{ text: "list my tasks" }]);
      expect(modelTurn[0].text).toContain("<untrusted-tool-results>");
      expect(modelTurn[0].text).toContain('"id":"t-dentist"');
      expect(modelTurn[1]).toEqual({ text: "1. Gym 2. Dentist" });
    });

    it("replays tool results for the most recent turns only", async () => {
      setupSupabase();
      mockSendMessageStream.mockReturnValueOnce(turn(text("ok")));
      const messages = [];
      for (let i = 0; i < 7; i++) {
        messages.push({ role: "user", content: `q${i}` });
        messages.push({
          role: "assistant",
          content: `a${i}`,
          toolResults: [
            { tool: "list_tasks", success: true, context: `turn ${i} results` },
          ],
        });
      }
      messages.push({ role: "user", content: "and now?" });

      await readEvents(await POST(chatRequest({ messages })));

      const modelTurns = historyParts().filter((_, i) => i % 2 === 1);
      const replayed = modelTurns.map((parts) =>
        String(parts[0].text).includes("<untrusted-tool-results>"),
      );
      expect(replayed).toEqual([false, false, true, true, true, true, true]);
    });

    it("rejects an oversized tool summary", async () => {
      setupSupabase();
      const res = await POST(
        chatRequest({
          messages: [
            {
              role: "assistant",
              content: "x",
              toolResults: [
                { tool: "list_tasks", success: true, context: "y".repeat(10_000) },
              ],
            },
            { role: "user", content: "hi" },
          ],
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("memory compaction", () => {
    it("passes the client's history offset through", async () => {
      setupSupabase();
      mockSendMessageStream.mockReturnValueOnce(turn(text("ok")));

      await readEvents(await POST(ask("hi", { historyOffset: 12 })));

      expect(mockCompactMessages).toHaveBeenCalledWith(
        USER_ID,
        [{ role: "user", content: "hi" }],
        12,
      );
    });

    it("defaults the offset to zero for older clients", async () => {
      setupSupabase();
      mockSendMessageStream.mockReturnValueOnce(turn(text("ok")));

      await readEvents(await POST(ask("hi")));

      expect(mockCompactMessages).toHaveBeenCalledWith(
        USER_ID,
        expect.any(Array),
        0,
      );
    });
  });

  describe("approval leg", () => {
    function approvalToken(exp: number = Date.now() + 60_000): string {
      return signApprovalToken({
        userId: USER_ID,
        toolName: "delete_task",
        input: { task_id: TASK_ID },
        exp,
        jti: randomUUID(),
      });
    }

    it("runs a valid, unused approval", async () => {
      const { supabase } = setupSupabase();
      mockExecuteTool.mockResolvedValueOnce(ok("Task moved to the recycle bin."));

      const res = await POST(
        chatRequest({ messages: [], approvalToken: approvalToken() }),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        type: "tool_result",
        result: ok("Task moved to the recycle bin."),
        context: "delete_task (ok): Task moved to the recycle bin.",
      });
      expect(mockExecuteTool).toHaveBeenCalledWith("delete_task", {
        task_id: TASK_ID,
      });
      expect(supabase.rpc).toHaveBeenCalledWith(
        "consume_approval_token",
        expect.objectContaining({ p_user_id: USER_ID }),
      );
      expect(mockSendMessageStream).not.toHaveBeenCalled();
    });

    it("rejects an expired approval without running it", async () => {
      setupSupabase();

      const res = await POST(
        chatRequest({
          messages: [],
          approvalToken: approvalToken(Date.now() - 1_000),
        }),
      );

      expect(res.status).toBe(403);
      expect(mockExecuteTool).not.toHaveBeenCalled();
    });

    it("rejects an approval that was already used", async () => {
      setupSupabase({ tokenConsumed: false });

      const res = await POST(
        chatRequest({ messages: [], approvalToken: approvalToken() }),
      );

      expect(res.status).toBe(403);
      expect(mockExecuteTool).not.toHaveBeenCalled();
    });
  });
});
