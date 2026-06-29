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

  it("has 57 auto-execute tools", () => {
    expect(AUTO_TOOLS).toHaveLength(57);
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
