import { describe, it, expect } from "vitest";
import {
  AUTO_TOOLS,
  REVERSIBLE_TOOLS,
  APPROVAL_TOOLS,
  ALL_TOOLS,
  APPROVAL_TOOL_NAMES,
  MCP_TOOL_SOURCE,
} from "../tools";
import { MCP_TOOLS, isMcpAllowedTool } from "../mcp";
import { DELETE_TOOL_TARGETS } from "../deletable";

// Tools that destroy data with no way back. This is the line the MCP boundary
// is drawn on, so it is named once and reused by every assertion below.
const isIrreversible = (name: string) =>
  name.startsWith("purge_") || name.startsWith("bulk_");

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

  it("has 65 auto-execute tools", () => {
    expect(AUTO_TOOLS).toHaveLength(65);
  });

  // Reading the bin and undoing a delete are both non-destructive, so they
  // auto-execute rather than prompting.
  it("includes the non-destructive recycle-bin tools", () => {
    const names = AUTO_TOOLS.map((t) => t.name);
    expect(names).toContain("list_deleted");
    expect(names).toContain("restore_record");
  });

  it.each(AUTO_TOOLS)("$name has valid schema", (tool) => {
    expect(tool.name).toBeTruthy();
    expect(tool.description ?? "").toBeTruthy();
    expect(tool.parameters).toBeDefined();
    expect(tool.parameters?.type).toBe("OBJECT");
    expect(tool.parameters?.properties).toBeDefined();
    expect(Array.isArray(tool.parameters?.required)).toBe(true);
  });

  it("does not contain destructive tools", () => {
    const names = AUTO_TOOLS.map((t) => t.name);
    expect(names).not.toContain("delete_task");
    expect(names).not.toContain("bulk_complete_tasks");
    expect(names).not.toContain("delete_note");
    expect(names).not.toContain("purge_record");
  });

  // Generic rather than a fixed deny-list, so a future destructive tool filed
  // into the wrong tier fails here instead of shipping auto-executable.
  it("contains no destructive tool of any kind", () => {
    const destructive = AUTO_TOOLS.map((t) => t.name ?? "").filter(
      (name) =>
        name.startsWith("delete_") || name.startsWith("bulk_") ||
        name.startsWith("purge_"),
    );
    expect(destructive).toEqual([]);
  });
});

describe("REVERSIBLE_TOOLS", () => {
  it("holds exactly the soft deletes", () => {
    const names = REVERSIBLE_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(Object.keys(DELETE_TOOL_TARGETS).sort());
  });

  it("has 17 reversible deletes", () => {
    expect(REVERSIBLE_TOOLS).toHaveLength(17);
  });

  // The tier's whole justification is that everything in it can be undone.
  // Anything irreversible in here would reach MCP with no way back.
  it("contains nothing irreversible", () => {
    const bad = REVERSIBLE_TOOLS.map((t) => t.name ?? "").filter(isIrreversible);
    expect(bad).toEqual([]);
  });

  it("every soft delete has a handler target in the shared registry", () => {
    for (const tool of REVERSIBLE_TOOLS) {
      expect(DELETE_TOOL_TARGETS[tool.name ?? ""]).toBeDefined();
    }
  });
});

describe("APPROVAL_TOOLS", () => {
  it("contains the irreversible and bulk operations", () => {
    const names = APPROVAL_TOOLS.map((t) => t.name);
    expect(names).toContain("purge_record");
    expect(names).toContain("bulk_delete_records");
    expect(names).toContain("bulk_complete_tasks");
    expect(names).toContain("forget_user_fact");
  });

  it("has 9 approval-required tools", () => {
    expect(APPROVAL_TOOLS).toHaveLength(9);
  });

  // Soft deletes moved out to REVERSIBLE_TOOLS so they could reach MCP. If one
  // reappears here it has silently lost its MCP exposure.
  it("no longer holds the reversible deletes", () => {
    const names = APPROVAL_TOOLS.map((t) => t.name);
    expect(names).not.toContain("delete_task");
    expect(names).not.toContain("delete_habit_log");
  });
});

// Both tiers prompt in the app chat, so both must satisfy the ConfirmDialog
// contract.
const GATED_TOOLS = [...REVERSIBLE_TOOLS, ...APPROVAL_TOOLS];

describe("gated tools", () => {
  // ConfirmDialog renders a human-readable label, so every gated tool must
  // require something beyond the bare UUID (CLAUDE.md guardrail) — otherwise
  // the user is asked to confirm an opaque id.
  it.each(GATED_TOOLS)("$name requires a human-readable field", (tool) => {
    const required = tool.parameters?.required ?? [];
    const displayFields = required.filter(
      (p) => p !== "id" && !p.endsWith("_id") && !p.endsWith("_ids"),
    );
    expect(displayFields.length).toBeGreaterThan(0);
  });

  it.each(GATED_TOOLS)("$name description mentions approval", (tool) => {
    expect((tool.description ?? "").toUpperCase()).toContain("APPROVAL");
  });

  it.each(GATED_TOOLS)("$name has valid schema", (tool) => {
    expect(tool.parameters?.type).toBe("OBJECT");
    expect(tool.parameters?.properties).toBeDefined();
  });

  // Nothing may destroy or mass-delete without an explicit confirm flag.
  // bulk_complete_tasks is deliberately excluded — completing a task is not a
  // deletion and stays undoable by reopening it.
  it.each(
    APPROVAL_TOOLS.filter(
      (t) =>
        (t.name ?? "").startsWith("purge_") ||
        (t.name ?? "").startsWith("bulk_delete"),
    ),
  )("$name requires an explicit confirm flag", (tool) => {
    expect(tool.parameters?.required ?? []).toContain("confirm");
  });
});

describe("ALL_TOOLS", () => {
  it("combines all three tiers", () => {
    expect(ALL_TOOLS).toHaveLength(
      AUTO_TOOLS.length + REVERSIBLE_TOOLS.length + APPROVAL_TOOLS.length,
    );
  });

  it("has unique tool names", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("APPROVAL_TOOL_NAMES", () => {
  it("gates both the reversible deletes and the irreversible tools", () => {
    expect(APPROVAL_TOOL_NAMES).toBeInstanceOf(Set);
    expect(APPROVAL_TOOL_NAMES.has("delete_task")).toBe(true);
    expect(APPROVAL_TOOL_NAMES.has("delete_note")).toBe(true);
    expect(APPROVAL_TOOL_NAMES.has("purge_record")).toBe(true);
    expect(APPROVAL_TOOL_NAMES.has("bulk_complete_tasks")).toBe(true);
  });

  it("does not include auto tools", () => {
    expect(APPROVAL_TOOL_NAMES.has("create_task")).toBe(false);
    expect(APPROVAL_TOOL_NAMES.has("list_tasks")).toBe(false);
    expect(APPROVAL_TOOL_NAMES.has("restore_record")).toBe(false);
    expect(APPROVAL_TOOL_NAMES.has("list_deleted")).toBe(false);
  });

  it("covers every gated tool", () => {
    expect(APPROVAL_TOOL_NAMES.size).toBe(GATED_TOOLS.length);
  });
});

// The MCP connector has no confirmation UI, so the property it relies on is
// "nothing reachable here is permanent" rather than "the user was asked".
describe("MCP exposure", () => {
  it("never exposes an irreversible or bulk tool", () => {
    for (const tool of APPROVAL_TOOLS) {
      expect(isMcpAllowedTool(tool.name ?? "")).toBe(false);
    }
  });

  it("lists no irreversible tool", () => {
    const bad = MCP_TOOLS.map((t) => t.name).filter(isIrreversible);
    expect(bad).toEqual([]);
  });

  // The point of the whole change: Claude can delete over MCP.
  it("exposes every reversible delete", () => {
    for (const tool of REVERSIBLE_TOOLS) {
      expect(isMcpAllowedTool(tool.name ?? "")).toBe(true);
    }
  });

  it("exposes the recycle bin so a delete can be undone", () => {
    expect(isMcpAllowedTool("list_deleted")).toBe(true);
    expect(isMcpAllowedTool("restore_record")).toBe(true);
  });

  // Every delete reachable over MCP must have a matching undo, or the tier's
  // safety argument does not hold.
  it("pairs every exposed delete with an exposed restore path", () => {
    const exposed = MCP_TOOLS.map((t) => t.name);
    const deletes = exposed.filter((n) => n.startsWith("delete_"));
    expect(deletes.length).toBeGreaterThan(0);
    expect(exposed).toContain("restore_record");
  });

  it("still exposes the read and create tools", () => {
    expect(isMcpAllowedTool("list_tasks")).toBe(true);
    expect(isMcpAllowedTool("create_task")).toBe(true);
    expect(isMcpAllowedTool("get_analytics")).toBe(true);
  });

  it("matches the declared MCP source", () => {
    expect(MCP_TOOLS).toHaveLength(MCP_TOOL_SOURCE.length);
  });

  it("rejects an unknown tool name", () => {
    expect(isMcpAllowedTool("drop_database")).toBe(false);
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

  it("create_task advertises project_id and subtasks, matching the handler", () => {
    // The handler now resolves project_id ownership and writes subtasks, so
    // advertising them is correct — unlike the old dead-param case this guards.
    const props = toolByName("create_task").parameters?.properties ?? {};
    expect(props).toHaveProperty("project_id");
    expect(props).toHaveProperty("subtasks");
    expect(props).not.toHaveProperty("tags");
  });

  it("update_task advertises labels (matching the validator), not tags", () => {
    const props = toolByName("update_task").parameters?.properties ?? {};
    expect(props).toHaveProperty("labels");
    expect(props).not.toHaveProperty("tags");
  });

  it("update_task replaces is_starred (dead in the UI) with is_focus", () => {
    const props = toolByName("update_task").parameters?.properties ?? {};
    expect(props).not.toHaveProperty("is_starred");
    expect(props).toHaveProperty("is_focus");
  });
});
