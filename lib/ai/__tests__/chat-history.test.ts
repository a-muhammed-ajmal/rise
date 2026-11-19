import { describe, expect, it } from "vitest";
import {
  buildToolHistoryContext,
  MAX_TOOL_CONTEXT_CHARS,
  summarizeToolResult,
  TOOL_CONTEXT_TURNS,
  toolContextIndices,
} from "../chat-history";

describe("summarizeToolResult", () => {
  it("keeps ids and short fields of returned rows", () => {
    const summary = summarizeToolResult("list_tasks", {
      success: true,
      message: "Found 2 tasks",
      data: [
        { id: "t1", title: "Gym", priority: "P2", due_date: null },
        { id: "t2", title: "Dentist", priority: "P1", due_date: "2026-06-24" },
      ],
    });

    expect(summary.split("\n")[0]).toBe("list_tasks (ok): Found 2 tasks");
    const rows = JSON.parse(summary.split("\n")[1]);
    expect(rows).toEqual([
      { id: "t1", title: "Gym", priority: "P2", due_date: null },
      { id: "t2", title: "Dentist", priority: "P1", due_date: "2026-06-24" },
    ]);
  });

  it("drops owner, timestamp and embedding columns and nested values", () => {
    const summary = summarizeToolResult("list_contacts", {
      success: true,
      message: "Found 1 contacts",
      data: [
        {
          id: "c1",
          name: "Dr Rao",
          user_id: "u1",
          created_at: "2026-01-01",
          updated_at: "2026-01-02",
          deleted_at: null,
          embedding: [0.1, 0.2],
          tags: ["health"],
          meta: { source: "import" },
        },
      ],
    });

    const [row] = JSON.parse(summary.split("\n")[1]);
    expect(row).toEqual({ id: "c1", name: "Dr Rao" });
  });

  it("shortens long text fields", () => {
    const summary = summarizeToolResult("list_notes", {
      success: true,
      message: "Found 1 notes",
      data: [{ id: "n1", content: "x".repeat(500) }],
    });

    const [row] = JSON.parse(summary.split("\n")[1]);
    expect(row.content).toBe(`${"x".repeat(80)}…`);
  });

  it("caps the number of rows and says how many were left out", () => {
    const data = Array.from({ length: 30 }, (_, i) => ({ id: `r${i}` }));
    const summary = summarizeToolResult("list_tasks", {
      success: true,
      message: "Found 30 tasks",
      data,
    });

    const body = JSON.parse(summary.split("\n")[1]);
    expect(body.rows).toHaveLength(25);
    expect(body.omitted).toBe(5);
  });

  it("keeps one level of a composite result", () => {
    const summary = summarizeToolResult("list_whatsapp_reminders", {
      success: true,
      message: "Found 1 WhatsApp recipients",
      data: {
        recipients: [{ id: "w1", phone: "+971500000000", user_id: "u1" }],
        recent_failures: [],
        user_id: "u1",
      },
    });

    expect(JSON.parse(summary.split("\n")[1])).toEqual({
      recipients: [{ id: "w1", phone: "+971500000000" }],
      recent_failures: [],
    });
  });

  it("keeps a single returned row", () => {
    const summary = summarizeToolResult("create_task", {
      success: true,
      message: 'Created task: "Gym"',
      data: { id: "t1", title: "Gym", subtasks: [] },
    });

    expect(JSON.parse(summary.split("\n")[1])).toEqual({ id: "t1", title: "Gym" });
  });

  it("keeps only the message for a failed call or a call with no data", () => {
    expect(
      summarizeToolResult("delete_task", {
        success: false,
        message: "Task not found",
        data: { id: "t1" },
      }),
    ).toBe("delete_task (failed): Task not found");
    expect(
      summarizeToolResult("complete_task", {
        success: true,
        message: 'Completed task: "Gym"',
      }),
    ).toBe('complete_task (ok): Completed task: "Gym"');
  });

  it("caps the total size", () => {
    const data = Array.from({ length: 25 }, (_, i) => ({
      id: `id-${i}-${"a".repeat(30)}`,
      title: "t".repeat(79),
    }));
    const summary = summarizeToolResult("list_tasks", {
      success: true,
      message: "Found 25 tasks",
      data,
    });

    expect(summary.length).toBe(MAX_TOOL_CONTEXT_CHARS + "…(truncated)".length);
    expect(summary.endsWith("…(truncated)")).toBe(true);
  });
});

describe("buildToolHistoryContext", () => {
  it("returns null when there is nothing to replay", () => {
    expect(buildToolHistoryContext(undefined)).toBeNull();
    expect(buildToolHistoryContext([])).toBeNull();
    expect(buildToolHistoryContext([{}, { context: "" }])).toBeNull();
  });

  it("wraps the summaries as untrusted content", () => {
    const block = buildToolHistoryContext([
      { context: "list_tasks (ok): Found 1 tasks" },
      { context: "complete_task (ok): Completed" },
    ]);

    expect(block).toBe(
      "<untrusted-tool-results>\nlist_tasks (ok): Found 1 tasks\ncomplete_task (ok): Completed\n</untrusted-tool-results>",
    );
  });

  it("re-caps an oversized summary sent by the client", () => {
    const block = buildToolHistoryContext([{ context: "z".repeat(5_000) }]);
    expect(block).toContain("z".repeat(MAX_TOOL_CONTEXT_CHARS));
    expect(block).not.toContain("z".repeat(MAX_TOOL_CONTEXT_CHARS + 1));
  });
});

describe("toolContextIndices", () => {
  const withContext = { context: "list_tasks (ok): Found 1 tasks" };

  it("picks only assistant turns that carry tool context", () => {
    const picked = toolContextIndices([
      { role: "user", toolResults: [withContext] },
      { role: "assistant", toolResults: [withContext] },
      { role: "user" },
      { role: "model", toolResults: [{}] },
      { role: "model", toolResults: [withContext] },
    ]);

    expect([...picked].sort()).toEqual([1, 4]);
  });

  it("keeps only the most recent turns", () => {
    const messages = Array.from({ length: TOOL_CONTEXT_TURNS + 3 }, () => ({
      role: "assistant",
      toolResults: [withContext],
    }));

    const picked = toolContextIndices(messages);

    expect(picked.size).toBe(TOOL_CONTEXT_TURNS);
    expect(picked.has(0)).toBe(false);
    expect(picked.has(messages.length - 1)).toBe(true);
  });
});
