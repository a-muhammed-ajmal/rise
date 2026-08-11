import { describe, it, expect } from "vitest";
import {
  DELETABLE,
  DELETABLE_ENTITIES,
  DELETE_TOOL_TARGETS,
  SOFT_DELETE_TABLES,
  isDeletableEntity,
} from "../deletable";
import { REVERSIBLE_TOOLS } from "../tools";

// This registry is the single source of truth three places read from: the
// handlers in execute-tool.ts, APPROVAL_RESOURCES in the chat route, and the
// tool declarations. Drift here is silent, so it is asserted directly.

describe("DELETABLE", () => {
  it("covers 17 entities", () => {
    expect(DELETABLE_ENTITIES).toHaveLength(17);
  });

  it("maps each entity to a distinct table", () => {
    const tables = DELETABLE_ENTITIES.map((e) => DELETABLE[e].table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it.each(DELETABLE_ENTITIES)("%s has complete metadata", (entity) => {
    const meta = DELETABLE[entity];
    expect(meta.table).toBeTruthy();
    expect(meta.label).toBeTruthy();
    // The display column is echoed back so the caller can confirm the right
    // record went (brief item 11) — an empty one makes the message useless.
    expect(meta.display).toBeTruthy();
    expect(meta.plural).toBeTruthy();
    expect(Array.isArray(meta.cascades)).toBe(true);
  });

  // Only the three NOT NULL child FKs can be destroyed by a purge; everything
  // else is either detachable or has no children.
  it("declares cascades only where the FK is NOT NULL", () => {
    const withCascades = DELETABLE_ENTITIES.filter(
      (e) => DELETABLE[e].cascades.length > 0,
    );
    expect(withCascades.sort()).toEqual(["contact", "goal", "habit"]);
  });

  it("SOFT_DELETE_TABLES lists every deletable table", () => {
    expect(SOFT_DELETE_TABLES).toHaveLength(17);
    expect(SOFT_DELETE_TABLES).toContain("tasks");
    expect(SOFT_DELETE_TABLES).toContain("focus_sessions");
  });

  // payment_methods has no create/update/delete tool, and the OAuth and memory
  // tables are deliberately excluded from soft delete entirely.
  it("excludes tables with no delete tool", () => {
    expect(SOFT_DELETE_TABLES).not.toContain("payment_methods");
    expect(SOFT_DELETE_TABLES).not.toContain("ai_memory");
    expect(SOFT_DELETE_TABLES).not.toContain("push_subscriptions");
    expect(SOFT_DELETE_TABLES).not.toContain("oauth_tokens");
  });
});

describe("isDeletableEntity", () => {
  it("accepts every registered entity", () => {
    for (const entity of DELETABLE_ENTITIES) {
      expect(isDeletableEntity(entity)).toBe(true);
    }
  });

  // Guards the dynamic-entity tools, which take `entity` straight from model
  // output — this is what stops an arbitrary string reaching a table name.
  it("rejects anything else", () => {
    expect(isDeletableEntity("tasks")).toBe(false);
    expect(isDeletableEntity("drop_table")).toBe(false);
    expect(isDeletableEntity("")).toBe(false);
    expect(isDeletableEntity(null)).toBe(false);
    expect(isDeletableEntity(undefined)).toBe(false);
    expect(isDeletableEntity(42)).toBe(false);
    expect(isDeletableEntity({ entity: "task" })).toBe(false);
  });

  it("rejects inherited Object properties", () => {
    expect(isDeletableEntity("toString")).toBe(false);
    expect(isDeletableEntity("constructor")).toBe(false);
  });
});

describe("DELETE_TOOL_TARGETS", () => {
  it("has an entry for every reversible delete tool", () => {
    const names = REVERSIBLE_TOOLS.map((t) => t.name ?? "").sort();
    expect(Object.keys(DELETE_TOOL_TARGETS).sort()).toEqual(names);
  });

  it.each(Object.entries(DELETE_TOOL_TARGETS))(
    "%s points at a registered entity",
    (_tool, target) => {
      expect(DELETABLE[target.entity]).toBeDefined();
      expect(target.idArg).toBeTruthy();
      if (target.ownershipEntity) {
        expect(DELETABLE[target.ownershipEntity]).toBeDefined();
      }
    },
  );

  it("covers every entity exactly once", () => {
    const entities = Object.values(DELETE_TOOL_TARGETS).map((t) => t.entity);
    expect(new Set(entities).size).toBe(DELETABLE_ENTITIES.length);
  });

  // delete_habit_log takes a habit id plus a date rather than a habit_logs row
  // id, so its ownership preflight has to check the parent habit instead.
  it("only delete_habit_log checks a different table for ownership", () => {
    const overridden = Object.entries(DELETE_TOOL_TARGETS).filter(
      ([, t]) => t.ownershipEntity,
    );
    expect(overridden).toHaveLength(1);
    expect(overridden[0][0]).toBe("delete_habit_log");
    expect(overridden[0][1].ownershipEntity).toBe("habit");
  });
});
