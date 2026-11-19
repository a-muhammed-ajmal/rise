// Helpers shared by every tool handler: result shapes, ownership checks,
// pagination, and the soft-delete / restore primitives.
import { DELETABLE, type DeletableEntity } from "@/lib/ai/deletable";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export type ToolResult = { success: boolean; message: string; data?: unknown };

export function dbErr(toolName: string, err: unknown): ToolResult {
  console.error(`[execute-tool] ${toolName}:`, err);
  return { success: false, message: "Something went wrong. Please try again." };
}

export function badInput(): ToolResult {
  return { success: false, message: "Invalid input for this action." };
}

// Tables whose rows can be referenced as a parent by another tool's input.
export type OwnableTable =
  "goals" | "contacts" | "tasks" | "projects" | "payment_methods";

/**
 * Confirms a foreign key taken from tool input belongs to the calling user.
 *
 * Under a cookie-backed client RLS already enforces this, but the MCP path
 * injects a service-role client that bypasses RLS entirely — without this check
 * a caller could attach a milestone to someone else's goal or move another
 * user's wallet balance.
 */
export async function isOwnedBy(
  supabase: SupabaseClient<Database>,
  table: OwnableTable,
  id: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export function notOwned(entity: string): ToolResult {
  return { success: false, message: `${entity} not found` };
}

// Which table + display entity a note's linked_to_type points at.
export const LINK_TABLE = {
  task: { table: "tasks", entity: "Task" },
  goal: { table: "goals", entity: "Goal" },
  contact: { table: "contacts", entity: "Contact" },
} as const satisfies Record<string, { table: OwnableTable; entity: string }>;

// ─── Pagination ───────────────────────────────────────────────────────────────

// Callers request `limit` rows; the query asks for one extra so we can tell the
// difference between "that is everything" and "the list was truncated". Without
// this the assistant silently reports a capped page as the complete set.
export const DEFAULT_PAGE_SIZE = 20;

export type Page<T> = { rows: T[]; hasMore: boolean; nextOffset: number };

export function pageOf<T>(rows: T[] | null, limit: number, offset: number): Page<T> {
  const fetched = rows ?? [];
  const hasMore = fetched.length > limit;
  const page = hasMore ? fetched.slice(0, limit) : fetched;
  return { rows: page, hasMore, nextOffset: offset + page.length };
}

export function pagedResult<T>(noun: string, page: Page<T>): ToolResult {
  return {
    success: true,
    message: page.hasMore
      ? `Found ${page.rows.length} ${noun} (more available — call again with offset ${page.nextOffset})`
      : `Found ${page.rows.length} ${noun}`,
    data: page.rows,
  };
}

// Inclusive bounds covering limit + 1 rows, per PostgREST range semantics.
export function rangeFor(limit: number, offset: number): [number, number] {
  return [offset, offset + limit];
}

// ─── Soft delete ──────────────────────────────────────────────────────────────

/**
 * Reads one column off a row whose exact type is not known statically.
 *
 * The recycle-bin tools pick their table at runtime, so the row is a union of
 * 17 Row types and `row[column]` will not typecheck. Object.entries keeps this
 * honest without a type assertion (banned — see CLAUDE.md).
 */
export function displayValue(row: unknown, column: string): string | null {
  if (!row || typeof row !== "object") return null;
  for (const [key, value] of Object.entries(row)) {
    if (key !== column) continue;
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : String(value);
  }
  return null;
}

/** "Task: \"Ship it\" (id 4f3a…)" — brief item 11: name plus id, every time. */
export function describeRecord(entity: DeletableEntity, row: unknown): string {
  const meta = DELETABLE[entity];
  const label = displayValue(row, meta.display);
  const id = displayValue(row, "id");
  const named = label ? `"${label}"` : meta.label.toLowerCase();
  return id ? `${named} (id ${id})` : named;
}

/**
 * Clears child pointers to a row about to be soft-deleted, and reports what it
 * unlinked.
 *
 * The FKs are declared ON DELETE SET NULL, but a soft delete is an UPDATE, so
 * the constraint never fires and the handler has to do it. Deliberately written
 * out per relationship rather than driven off a table: a dynamic
 * `.update({ [column]: null })` cannot be typed without an assertion, and there
 * are only three of them.
 *
 * Children whose FK is NOT NULL (milestones→goals, habit_logs→habits,
 * interactions→contacts) are left completely alone — history survives its
 * parent, per the no-cascade rule.
 */
export async function detachChildren(
  supabase: SupabaseClient<Database>,
  entity: DeletableEntity,
  id: string,
  userId: string,
): Promise<string[]> {
  switch (entity) {
    case "project": {
      const { count } = await supabase
        .from("tasks")
        .update({ project_id: null }, { count: "exact" })
        .eq("project_id", id)
        .eq("user_id", userId)
        .is("deleted_at", null);
      return count ? [`${count} task(s) unassigned, not deleted`] : [];
    }
    case "goal": {
      const { count } = await supabase
        .from("projects")
        .update({ goal_id: null }, { count: "exact" })
        .eq("goal_id", id)
        .eq("user_id", userId)
        .is("deleted_at", null);
      return count ? [`${count} project(s) unlinked, not deleted`] : [];
    }
    case "task": {
      const { count } = await supabase
        .from("focus_sessions")
        .update({ task_id: null }, { count: "exact" })
        .eq("task_id", id)
        .eq("user_id", userId)
        .is("deleted_at", null);
      return count ? [`${count} focus session(s) unlinked, not deleted`] : [];
    }
    default:
      return [];
  }
}

/**
 * The one place a delete_* tool actually deletes.
 *
 * Sets deleted_at instead of removing the row, unlinks any children, and echoes
 * back the stored display column plus the id — read from the database rather
 * than from the caller's arguments, so the message always names the row that
 * really went.
 */
export async function softDeleteRecord(
  supabase: SupabaseClient<Database>,
  entity: DeletableEntity,
  id: string,
  userId: string,
  toolName: string,
): Promise<ToolResult> {
  const meta = DELETABLE[entity];
  const { data: existing } = await supabase
    .from(meta.table)
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) return { success: false, message: `${meta.label} not found` };

  const detached = await detachChildren(supabase, entity, id, userId);

  const { error } = await supabase
    .from(meta.table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (error) return dbErr(toolName, error);

  const suffix = detached.length ? ` — ${detached.join(", ")}` : "";
  return {
    success: true,
    message: `Deleted ${meta.label.toLowerCase()}: ${describeRecord(entity, existing)}${suffix}. Undo with restore_record.`,
    data: existing,
  };
}

/** Clears deleted_at, bringing a row back exactly as it was. */
export async function restoreRecord(
  supabase: SupabaseClient<Database>,
  entity: DeletableEntity,
  id: string,
  userId: string,
): Promise<ToolResult> {
  const meta = DELETABLE[entity];
  const { data: existing } = await supabase
    .from(meta.table)
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (!existing)
    return {
      success: false,
      message: `No deleted ${meta.label.toLowerCase()} found with that id`,
    };

  const { data, error } = await supabase
    .from(meta.table)
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) return dbErr("restore_record", error);

  return {
    success: true,
    message: `Restored ${meta.label.toLowerCase()}: ${describeRecord(entity, existing)}`,
    data,
  };
}

// ─── Handler contract ─────────────────────────────────────────────────────────

// Cookieless callers (e.g. the MCP endpoint) inject their own client + user
export type ToolContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

/** Everything a handler may use. `today` is the Dubai date of the call. */
export type ToolEnv = {
  input: Record<string, unknown>;
  supabase: SupabaseClient<Database>;
  userId: string;
  today: string;
};

export type ToolHandler = (env: ToolEnv) => Promise<ToolResult>;

export type ToolHandlers = Record<string, ToolHandler>;
