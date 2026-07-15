import { describe, it, expect } from "vitest";
import {
  AUTO_TOOLS,
  APPROVAL_TOOLS,
  ALL_TOOLS,
  APPROVAL_TOOL_NAMES,
} from "../tools";

describe("AUTO_TOOLS", () => {
  it("contains expected auto-execute tools", () => {
    const names = AUTO_TOOLS.map((t) => t.name);
    expect(names).toContain("create_task");
    expect(names).toContain("list_tasks");
    expect(names).toContain("complete_task");
    expect(names).toContain("log_expense");
    expect(names).toContain("log_income");
    expect(names).toContain("log_habit");
    expect(names).toContain("create_goal");
    expect(names).toContain("add_note");
    expect(names).toContain("add_contact");
    expect(names).toContain("get_daily_briefing");
    expect(names).toContain("search_data");
  });

  it("has 60 auto-execute tools", () => {
    expect(AUTO_TOOLS).toHaveLength(60);
  });

  it.each(AUTO_TOOLS)("$name has valid schema", (tool) => {
    expect(tool.name).toBeTruthy();
    expect(tool.description ?? "").toBeTruthy();
    expect(tool.parameters).toBeDefined();
    expect(tool.parameters?.type).toBe("OBJECT");
    expect(tool.parameters?.properties).toBeDefined();
    expect(Array.isArray(tool.parameters?.required)).toBe(true);
  });

  it("does not contain approval-required tools", () => {
    const names = AUTO_TOOLS.map((t) => t.name);
    expect(names).not.toContain("delete_task");
    expect(names).not.toContain("bulk_complete_tasks");
    expect(names).not.toContain("delete_note");
  });
});

describe("APPROVAL_TOOLS", () => {
  it("contains destructive tools requiring approval", () => {
    const names = APPROVAL_TOOLS.map((t) => t.name);
    expect(names).toContain("delete_task");
    expect(names).toContain("bulk_complete_tasks");
    expect(names).toContain("delete_note");
  });

  it("has 17 approval-required tools", () => {
    expect(APPROVAL_TOOLS).toHaveLength(17);
  });

  it.each(APPROVAL_TOOLS)("$name description mentions approval", (tool) => {
    expect((tool.description ?? "").toUpperCase()).toContain("APPROVAL");
  });

  it.each(APPROVAL_TOOLS)("$name has valid schema", (tool) => {
    expect(tool.parameters?.type).toBe("OBJECT");
    expect(tool.parameters?.properties).toBeDefined();
  });
});

describe("ALL_TOOLS", () => {
  it("combines auto and approval tools", () => {
    expect(ALL_TOOLS).toHaveLength(AUTO_TOOLS.length + APPROVAL_TOOLS.length);
  });

  it("has unique tool names", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("APPROVAL_TOOL_NAMES", () => {
  it("is a Set of approval tool names", () => {
    expect(APPROVAL_TOOL_NAMES).toBeInstanceOf(Set);
    expect(APPROVAL_TOOL_NAMES.has("delete_task")).toBe(true);
    expect(APPROVAL_TOOL_NAMES.has("bulk_complete_tasks")).toBe(true);
    expect(APPROVAL_TOOL_NAMES.has("delete_note")).toBe(true);
  });

  it("does not include auto tools", () => {
    expect(APPROVAL_TOOL_NAMES.has("create_task")).toBe(false);
    expect(APPROVAL_TOOL_NAMES.has("list_tasks")).toBe(false);
  });

  it("matches APPROVAL_TOOLS length", () => {
    expect(APPROVAL_TOOL_NAMES.size).toBe(APPROVAL_TOOLS.length);
  });
});

// Canonical task enums — mirror lib/types/database.ts (TaskPriority, TaskStatus),
// the source of truth the Zod validators in execute-tool.ts enforce. These guard
// the tool-declaration ↔ validator drift that previously let the assistant send
// values (low/medium/high/urgent, inbox) that execution then rejected.
const TASK_PRIORITIES = ["P1", "P2", "P3", "P4"];
const TASK_STATUSES = ["todo", "in_progress", "blocked", "on_hold", "done"];

function toolByName(name: string) {
  const tool = AUTO_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`AUTO_TOOLS is missing "${name}"`);
  return tool;
}

function enumOf(name: string, prop: string): string[] | undefined {
  return toolByName(name).parameters?.properties?.[prop]?.enum;
}

describe("task tools advertise validator-aligned enums", () => {
  it("create_task advertises DB-valid priority and status", () => {
    expect(enumOf("create_task", "priority")).toEqual(TASK_PRIORITIES);
    expect(enumOf("create_task", "status")).toEqual(TASK_STATUSES);
  });

  it("update_task advertises DB-valid priority and status", () => {
    expect(enumOf("update_task", "priority")).toEqual(TASK_PRIORITIES);
    expect(enumOf("update_task", "status")).toEqual(TASK_STATUSES);
  });

  it("list_tasks advertises only the real filter views", () => {
    expect(enumOf("list_tasks", "filter")).toEqual(["all", "today"]);
  });

  it("create_task does not advertise fields its handler ignores", () => {
    // The handler hardcodes labels:[] and never reads project_id, so advertising
    // them misled the assistant into passing values that were silently dropped.
    const props = toolByName("create_task").parameters?.properties ?? {};
    expect(props).not.toHaveProperty("project_id");
    expect(props).not.toHaveProperty("tags");
  });

  it("update_task advertises labels (matching the validator), not tags", () => {
    const props = toolByName("update_task").parameters?.properties ?? {};
    expect(props).toHaveProperty("labels");
    expect(props).not.toHaveProperty("tags");
  });
});
