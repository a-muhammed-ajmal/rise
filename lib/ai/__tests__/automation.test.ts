import { describe, expect, it, vi } from "vitest";
import { runDailyDigestWorkflow } from "../automation";

function createQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    gte: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    upsert: vi.fn(async () => ({ data: result.data, error: result.error })),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: result.data, error: result.error }).then(resolve),
  };

  return query;
}

describe("runDailyDigestWorkflow", () => {
  it("builds a digest and writes it to notes", async () => {
    const writtenNotes: Array<Record<string, unknown>> = [];
    const taskResponses = [
      { data: [{ title: "Ship launch plan", priority: "P1", completed_at: "2026-06-23T08:00:00" }], error: null },
      { data: [{ title: "Review budget", priority: "P2", due_date: "2026-06-24" }], error: null },
    ];

    const db = {
      from: vi.fn((table: string) => {
        if (table === "tasks") {
          const response = taskResponses.shift();
          if (!response) throw new Error("No more task responses");
          return createQuery(response);
        }

        if (table === "habit_logs") {
          return createQuery({ data: [{ habit_id: "habit-1", completed: true, logged_date: "2026-06-23" }], error: null });
        }

        if (table === "habits") {
          return createQuery({ data: [{ id: "habit-1", name: "Meditate", icon: "🧘" }], error: null });
        }

        if (table === "transactions") {
          return createQuery({ data: [{ type: "income", amount: 500, category: "Salary", description: "Salary" }], error: null });
        }

        if (table === "goals") {
          return createQuery({ data: [{ title: "Launch RISE", progress: 80, status: "active" }], error: null });
        }

        if (table === "notes") {
          return {
            upsert: vi.fn(async (payload: Record<string, unknown>) => {
              writtenNotes.push(payload);
              return { data: payload, error: null };
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const ai = {
      models: {
        generateContent: vi.fn(async () => ({
          candidates: [{ content: { parts: [{ text: "Digest ready" }] } }],
        })),
      },
    };

    const result = await runDailyDigestWorkflow({
      userId: "user-1",
      db,
      ai,
      now: new Date("2026-06-23T12:00:00Z"),
      source: "test",
    });

    expect(result.success).toBe(true);
    expect(result.digestText).toBe("Digest ready");
    expect(writtenNotes).toHaveLength(1);
    expect(writtenNotes[0]).toMatchObject({
      user_id: "user-1",
      title: "Daily Digest — 2026-06-23",
      tags: ["daily-digest"],
      linked_to_type: "daily-digest",
    });
    expect(ai.models.generateContent).toHaveBeenCalled();
  });
});
