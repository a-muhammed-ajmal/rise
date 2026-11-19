import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { ALL_TOOLS } from "../tools";
import { TOOL_HANDLERS } from "../tool-handlers";
import { executeTool } from "../execute-tool";

const declared = ALL_TOOLS.map((tool) => tool.name).filter(
  (name): name is string => typeof name === "string",
);

describe("tool handler registry", () => {
  it("has a handler for every declared tool", () => {
    const missing = declared.filter((name) => !TOOL_HANDLERS.has(name));
    expect(missing).toEqual([]);
  });

  it("has no handler without a declaration", () => {
    const orphans = [...TOOL_HANDLERS.keys()].filter(
      (name) => !declared.includes(name),
    );
    expect(orphans).toEqual([]);
  });

  it.each(["toString", "constructor", "hasOwnProperty", "__proto__"])(
    "treats the prototype member %s as an unknown tool",
    async (name) => {
      expect(TOOL_HANDLERS.has(name)).toBe(false);
      const result = await executeTool(
        name,
        {},
        { supabase: {} as never, userId: "user-1" },
      );
      expect(result).toEqual({ success: false, message: `Unknown tool: ${name}` });
    },
  );
});
