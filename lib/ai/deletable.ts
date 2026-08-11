import type { Database } from "@/lib/types/database";

/**
 * Single source of truth for soft delete.
 *
 * Every entity listed here has a `deleted_at` column (migration 022), a
 * `delete_<entity>` tool, and is addressable by the generic recycle-bin tools
 * (`list_deleted`, `restore_record`, `purge_record`, `bulk_delete_records`).
 *
 * Three places read this instead of maintaining their own lookup: the handlers
 * in `execute-tool.ts`, `APPROVAL_RESOURCES` in the chat route, and the tests.
 */

/**
 * The 17 tables carrying a `deleted_at` column (migration 022).
 *
 * Narrower than `keyof Tables` on purpose: it is what lets
 * `.update({ deleted_at })` typecheck against a dynamically chosen table
 * without a type assertion.
 */
export type DeletableTable =
  | "tasks"
  | "projects"
  | "goals"
  | "milestones"
  | "habits"
  | "habit_logs"
  | "transactions"
  | "budgets"
  | "debts"
  | "contacts"
  | "interactions"
  | "notes"
  | "documents"
  | "links"
  | "journal_entries"
  | "reviews"
  | "focus_sessions";

// Compile-time proof that every DeletableTable is a real table.
type AssertTablesExist =
  DeletableTable extends keyof Database["public"]["Tables"] ? true : never;
const _tablesExist: AssertTablesExist = true;
void _tablesExist;

export type DeletableEntity =
  | "task"
  | "project"
  | "goal"
  | "milestone"
  | "habit"
  | "habit_log"
  | "transaction"
  | "budget"
  | "debt"
  | "contact"
  | "interaction"
  | "note"
  | "document"
  | "link"
  | "journal_entry"
  | "review"
  | "focus_session";

export type DeletableMeta = {
  /** Physical table. */
  table: DeletableTable;
  /** Human label used in tool responses, e.g. "Task not found". */
  label: string;
  /** Column echoed back so the caller can confirm the right row went. */
  display: string;
  /** Plural noun for counts, e.g. "3 tasks". */
  plural: string;
  /**
   * Child rows a hard purge destroys via ON DELETE CASCADE. Named in the
   * purge response so the caller knows what else went with it. A soft delete
   * never touches these — see `detachChildren` in execute-tool.ts for the
   * pointers that ARE cleared.
   */
  cascades: readonly string[];
};

export const DELETABLE: Record<DeletableEntity, DeletableMeta> = {
  task: {
    table: "tasks",
    label: "Task",
    display: "title",
    plural: "tasks",
    cascades: [],
  },
  project: {
    table: "projects",
    label: "Project",
    display: "name",
    plural: "projects",
    cascades: [],
  },
  goal: {
    table: "goals",
    label: "Goal",
    display: "title",
    plural: "goals",
    // milestones.goal_id is NOT NULL, so it cannot be unlinked — a soft delete
    // simply leaves the milestones in place; only a purge destroys them.
    cascades: ["milestones"],
  },
  milestone: {
    table: "milestones",
    label: "Milestone",
    display: "title",
    plural: "milestones",
    cascades: [],
  },
  habit: {
    table: "habits",
    label: "Habit",
    display: "name",
    plural: "habits",
    // habit_logs.habit_id is NOT NULL. History stays on soft delete.
    cascades: ["habit logs"],
  },
  habit_log: {
    table: "habit_logs",
    label: "Habit log",
    display: "logged_date",
    plural: "habit logs",
    cascades: [],
  },
  transaction: {
    table: "transactions",
    label: "Transaction",
    display: "description",
    plural: "transactions",
    cascades: [],
  },
  budget: {
    table: "budgets",
    label: "Budget",
    display: "category",
    plural: "budgets",
    cascades: [],
  },
  debt: {
    table: "debts",
    label: "Debt",
    display: "creditor",
    plural: "debts",
    cascades: [],
  },
  contact: {
    table: "contacts",
    label: "Contact",
    display: "name",
    plural: "contacts",
    // interactions.contact_id is NOT NULL. History stays on soft delete.
    cascades: ["interactions"],
  },
  interaction: {
    table: "interactions",
    label: "Interaction",
    display: "type",
    plural: "interactions",
    cascades: [],
  },
  note: {
    table: "notes",
    label: "Note",
    display: "title",
    plural: "notes",
    cascades: [],
  },
  document: {
    table: "documents",
    label: "Document",
    display: "name",
    plural: "documents",
    cascades: [],
  },
  link: {
    table: "links",
    label: "Link",
    display: "title",
    plural: "links",
    cascades: [],
  },
  journal_entry: {
    table: "journal_entries",
    label: "Journal entry",
    display: "date",
    plural: "journal entries",
    cascades: [],
  },
  review: {
    table: "reviews",
    label: "Review",
    display: "type",
    plural: "reviews",
    cascades: [],
  },
  focus_session: {
    table: "focus_sessions",
    label: "Focus session",
    display: "started_at",
    plural: "focus sessions",
    cascades: [],
  },
};

export const DELETABLE_ENTITIES = Object.keys(DELETABLE) as DeletableEntity[];

/** Tables carrying a `deleted_at` column — the set every read path must filter. */
export const SOFT_DELETE_TABLES: readonly DeletableTable[] =
  DELETABLE_ENTITIES.map((e) => DELETABLE[e].table);

export function isDeletableEntity(value: unknown): value is DeletableEntity {
  // Object.hasOwn, not `in`: `in` walks the prototype chain, so "toString" and
  // "constructor" would pass and then resolve to a meta object with an
  // undefined table. This guard runs on `entity` taken straight from model
  // output in the chat route's approval preflight.
  return typeof value === "string" && Object.hasOwn(DELETABLE, value);
}

/**
 * Which entity each existing `delete_*` tool acts on, and the argument carrying
 * the id. Drives both the handlers and the chat route's ownership preflight.
 *
 * `ownershipEntity` differs only for `delete_habit_log`, whose tool takes a
 * habit id plus a date rather than a habit_logs row id — so the preflight
 * checks the parent habit.
 */
export type DeleteToolTarget = {
  entity: DeletableEntity;
  idArg: string;
  ownershipEntity?: DeletableEntity;
};

export const DELETE_TOOL_TARGETS: Record<string, DeleteToolTarget> = {
  delete_task: { entity: "task", idArg: "task_id" },
  delete_project: { entity: "project", idArg: "project_id" },
  delete_goal: { entity: "goal", idArg: "goal_id" },
  delete_milestone: { entity: "milestone", idArg: "milestone_id" },
  delete_habit: { entity: "habit", idArg: "habit_id" },
  delete_habit_log: {
    entity: "habit_log",
    idArg: "habit_id",
    ownershipEntity: "habit",
  },
  delete_transaction: { entity: "transaction", idArg: "transaction_id" },
  delete_budget: { entity: "budget", idArg: "budget_id" },
  delete_debt: { entity: "debt", idArg: "debt_id" },
  delete_contact: { entity: "contact", idArg: "contact_id" },
  delete_interaction: { entity: "interaction", idArg: "interaction_id" },
  delete_note: { entity: "note", idArg: "note_id" },
  delete_document: { entity: "document", idArg: "document_id" },
  delete_link: { entity: "link", idArg: "id" },
  delete_journal_entry: { entity: "journal_entry", idArg: "entry_id" },
  delete_review: { entity: "review", idArg: "review_id" },
  delete_focus_session: { entity: "focus_session", idArg: "id" },
};
