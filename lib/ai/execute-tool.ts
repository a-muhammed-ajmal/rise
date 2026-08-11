import { createClient } from "@/lib/supabase/server";
import { format, parseISO, startOfMonth } from "date-fns";
import { todayISO, todayDOW, addDaysISO } from "@/lib/format";
import { z } from "zod";
import {
  storeMemory,
  retrieveMemories,
  retrieveUserFacts,
} from "@/lib/ai/memory";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database";
import {
  DELETABLE,
  DELETABLE_ENTITIES,
  type DeletableEntity,
} from "@/lib/ai/deletable";

// ─── Input schemas ────────────────────────────────────────────────────────────

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const CreateTaskInput = z.object({
  title: z.string().min(1).max(500),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  due_date: dateStr.optional().nullable(),
  status: z
    .enum(["todo", "in_progress", "blocked", "on_hold", "done"])
    .optional(),
  description: z.string().max(5000).optional().nullable(),
});

const CompleteTaskInput = z.object({
  task_id: z.string().uuid(),
});

const LogMoneyInput = z.object({
  amount: z.number().positive().max(10_000_000),
  category: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  date: dateStr.optional(),
  payment_method_id: z.string().uuid().optional().nullable(),
});

const LogHabitInput = z.object({
  habit_name: z.string().min(1).max(200),
});

const CreateGoalInput = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  category: z
    .enum(["personal", "professional", "health", "financial", "other"])
    .optional(),
  target_date: dateStr.optional().nullable(),
});

const AddNoteInput = z.object({
  title: z.string().min(1).max(300),
  content: z.string().max(50_000),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

const AddContactInput = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  type: z
    .enum(["personal", "lead", "prospect", "client", "network"])
    .optional(),
});

const SearchDataInput = z.object({
  query: z.string().min(1).max(200),
  types: z.array(z.enum(["tasks", "notes", "contacts", "goals"])).optional(),
  limit: z.number().int().positive().max(50).optional(),
});

const GetAnalyticsInput = z.object({
  period: z.enum(["week", "month"]).optional(),
});

const ListTasksInput = z.object({
  filter: z.enum(["all", "today"]).optional(),
});

const DeleteTaskInput = z.object({
  task_id: z.string().uuid(),
  task_title: z.string().max(500).optional(),
});

const BulkCompleteInput = z.object({
  task_ids: z.array(z.string().uuid()).min(1).max(100),
});

const DeleteNoteInput = z.object({
  note_id: z.string().uuid(),
  note_title: z.string().max(300).optional(),
});

// ─── New input schemas ────────────────────────────────────────────────────────

const uuid = z.string().uuid();
const rating1to5 = z.number().int().min(1).max(5);
const isoDatetime = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.Z+\-]+)?$/);

// Tasks
const UpdateTaskInput = z.object({
  id: uuid,
  title: z.string().min(1).max(500).optional(),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  status: z
    .enum(["todo", "in_progress", "blocked", "on_hold", "done"])
    .optional(),
  due_date: dateStr.optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  project_id: uuid.optional().nullable(),
  is_starred: z.boolean().optional(),
  labels: z.array(z.string().max(100)).optional(),
});

// Projects
const CreateProjectInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().max(20).optional(),
});

const UpdateProjectInput = z.object({
  id: uuid,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().max(20).optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
});

const DeleteProjectInput = z.object({
  project_id: uuid,
  project_name: z.string().optional(),
});

// Goals
const ListGoalsInput = z.object({
  status: z.enum(["active", "completed", "abandoned", "all"]).optional(),
});

const UpdateGoalInput = z.object({
  id: uuid,
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z
    .enum(["personal", "professional", "health", "financial", "other"])
    .optional(),
  target_date: dateStr.optional().nullable(),
  progress: z.number().int().min(0).max(100).optional(),
  status: z.enum(["active", "completed", "abandoned"]).optional(),
});

const ByIdInput = z.object({ id: uuid });

const DeleteGoalInput = z.object({
  goal_id: uuid,
  goal_title: z.string().optional(),
});

// Milestones
const CreateMilestoneInput = z.object({
  goal_id: uuid,
  title: z.string().min(1).max(300),
  due_date: dateStr.optional().nullable(),
});

const ListMilestonesInput = z.object({ goal_id: uuid });

const UpdateMilestoneInput = z.object({
  id: uuid,
  title: z.string().min(1).max(300).optional(),
  due_date: dateStr.optional().nullable(),
});

const DeleteMilestoneInput = z.object({
  milestone_id: uuid,
  milestone_title: z.string().optional(),
});

// Habits
const CreateHabitInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  frequency: z.enum(["daily", "weekly", "custom"]).optional(),
  target_days: z.array(z.number().int().min(0).max(6)).optional(),
  color: z.string().max(20).optional(),
  reminder_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
});

const UpdateHabitInput = z.object({
  id: uuid,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  frequency: z.enum(["daily", "weekly", "custom"]).optional(),
  target_days: z.array(z.number().int().min(0).max(6)).optional(),
  color: z.string().max(20).optional(),
  reminder_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  active: z.boolean().optional(),
});

const DeleteHabitInput = z.object({
  habit_id: uuid,
  habit_name: z.string().optional(),
});

const DeleteHabitLogInput = z.object({
  habit_id: uuid,
  logged_date: dateStr,
});

// Transactions
const offsetInput = z.number().int().nonnegative().max(10_000).optional();

const ListTransactionsInput = z.object({
  type: z
    .enum(["income", "expense", "transfer", "adjustment", "all"])
    .optional(),
  start_date: dateStr.optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: offsetInput,
});

const UpdateTransactionInput = z.object({
  transaction_id: uuid,
  summary: z.string().max(500),
  amount: z.number().positive().max(10_000_000).optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  date: dateStr.optional(),
});

const DeleteTransactionInput = z.object({
  transaction_id: uuid,
  transaction_summary: z.string().optional(),
});

// Budgets
const CreateBudgetInput = z.object({
  category: z.string().min(1).max(100),
  amount: z.number().positive().max(10_000_000),
  period: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  period_start: dateStr,
  period_end: dateStr,
});

const UpdateBudgetInput = z.object({
  id: uuid,
  category: z.string().max(100).optional(),
  amount: z.number().positive().max(10_000_000).optional(),
  period: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  period_start: dateStr.optional(),
  period_end: dateStr.optional(),
});

const DeleteBudgetInput = z.object({
  budget_id: uuid,
  budget_summary: z.string().optional(),
});

// Debts
const ListDebtsInput = z.object({
  filter: z.enum(["i_owe", "they_owe", "unpaid", "all"]).optional(),
});

const CreateDebtInput = z.object({
  creditor: z.string().min(1).max(200),
  type: z.enum(["i_owe", "they_owe"]),
  amount: z.number().positive().max(10_000_000),
  description: z.string().max(500).optional().nullable(),
  due_date: dateStr.optional().nullable(),
});

const UpdateDebtInput = z.object({
  debt_id: uuid,
  summary: z.string().max(500),
  creditor: z.string().max(200).optional(),
  amount: z.number().positive().max(10_000_000).optional(),
  description: z.string().max(500).optional().nullable(),
  due_date: dateStr.optional().nullable(),
  mark_paid: z.boolean().optional(),
});

const DeleteDebtInput = z.object({
  debt_id: uuid,
  debt_summary: z.string().optional(),
});

// Contacts
const ListContactsInput = z.object({
  type: z
    .enum(["lead", "prospect", "client", "network", "personal", "all"])
    .optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: offsetInput,
});

const UpdateContactInput = z.object({
  id: uuid,
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  role: z.string().max(200).optional().nullable(),
  type: z
    .enum(["lead", "prospect", "client", "network", "personal"])
    .optional(),
  stage: z
    .enum(["new", "qualified", "proposal", "negotiation", "won", "lost"])
    .optional(),
  deal_value: z.number().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const DeleteContactInput = z.object({
  contact_id: uuid,
  contact_name: z.string().optional(),
});

// Interactions
const CreateInteractionInput = z.object({
  contact_id: uuid,
  type: z.enum(["call", "email", "meeting", "message", "other"]),
  notes: z.string().min(1).max(5000),
  date: dateStr.optional(),
  follow_up_date: dateStr.optional().nullable(),
});

const ListInteractionsInput = z.object({ contact_id: uuid });

const UpdateInteractionInput = z.object({
  id: uuid,
  type: z.enum(["call", "email", "meeting", "message", "other"]).optional(),
  notes: z.string().min(1).max(5000).optional(),
  date: dateStr.optional(),
  follow_up_date: dateStr.optional().nullable(),
});

const DeleteInteractionInput = z.object({
  interaction_id: uuid,
  interaction_summary: z.string().optional(),
});

// Notes
const ListNotesInput = z.object({
  tag: z.string().max(50).optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: offsetInput,
});

const UpdateNoteInput = z.object({
  id: uuid,
  title: z.string().min(1).max(300).optional(),
  content: z.string().max(50_000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// Documents
const CreateDocumentInput = z.object({
  name: z.string().min(1).max(300),
  file_path: z.string().min(1).max(2000),
  file_type: z.string().max(100).optional().nullable(),
  file_size: z.number().int().positive().optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const UpdateDocumentInput = z.object({
  id: uuid,
  name: z.string().min(1).max(300).optional(),
  file_type: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const DeleteDocumentInput = z.object({
  document_id: uuid,
  document_name: z.string().optional(),
});

// Links
const CreateLinkInput = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(300).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const UpdateLinkInput = z.object({
  id: uuid,
  url: z.string().url().max(2000).optional(),
  title: z.string().max(300).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const DeleteLinkInput = z.object({ id: uuid });

// Journal entries
const CreateJournalEntryInput = z.object({
  date: dateStr,
  content: z.string().min(1).max(50_000),
  mood: rating1to5.optional().nullable(),
  energy: rating1to5.optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const UpdateJournalEntryInput = z.object({
  id: uuid,
  content: z.string().min(1).max(50_000).optional(),
  mood: rating1to5.optional().nullable(),
  energy: rating1to5.optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const DeleteJournalEntryInput = z.object({
  entry_id: uuid,
  entry_date: dateStr,
});

// Reviews
const CreateReviewInput = z.object({
  type: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  period_start: dateStr,
  period_end: dateStr,
  content: z.string().max(50_000).optional().nullable(),
  mood: rating1to5.optional().nullable(),
  energy: rating1to5.optional().nullable(),
});

const UpdateReviewInput = z.object({
  id: uuid,
  content: z.string().max(50_000).optional().nullable(),
  mood: rating1to5.optional().nullable(),
  energy: rating1to5.optional().nullable(),
});

const ListReviewsInput = z.object({
  type: z
    .enum(["daily", "weekly", "monthly", "quarterly", "yearly", "all"])
    .optional(),
  limit: z.number().int().positive().max(50).optional(),
});

const DeleteReviewInput = z.object({
  review_id: uuid,
  review_summary: z.string().optional(),
});

// Focus sessions
const CreateFocusSessionInput = z.object({
  duration_minutes: z.number().int().positive().max(1440),
  started_at: isoDatetime.optional(),
  ended_at: isoDatetime.optional().nullable(),
  task_id: uuid.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const UpdateFocusSessionInput = z.object({
  id: uuid,
  duration_minutes: z.number().int().positive().max(1440).optional(),
  ended_at: isoDatetime.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  task_id: uuid.optional().nullable(),
});

const ListFocusSessionsInput = z.object({
  task_id: uuid.optional(),
  limit: z.number().int().positive().max(50).optional(),
});

// ─── Recycle bin ──────────────────────────────────────────────────────────────

// z.enum needs a non-empty tuple; DELETABLE_ENTITIES is a plain array, so it is
// widened here once rather than duplicating the 17 names.
const deletableEntity = z.enum(
  DELETABLE_ENTITIES as [DeletableEntity, ...DeletableEntity[]],
);

const ListDeletedInput = z.object({
  entity: deletableEntity.optional(),
  limit: z.number().int().positive().max(50).optional(),
  offset: offsetInput,
});

const RestoreRecordInput = z.object({
  entity: deletableEntity,
  id: uuid,
  record_label: z.string().optional(),
});

// `confirm` is z.literal(true), so an omitted or false flag fails validation and
// the handler never reaches the database. Brief item 7.
const PurgeRecordInput = z.object({
  entity: deletableEntity,
  id: uuid,
  record_label: z.string().optional(),
  confirm: z.literal(true),
});

const BulkDeleteRecordsInput = z.object({
  entity: deletableEntity,
  ids: z.array(uuid).min(1).max(100),
  summary: z.string().optional(),
  confirm: z.literal(true),
});

const ForgetUserFactInput = z.object({
  key: z.string().min(1).max(100),
  fact_summary: z.string().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ToolResult = { success: boolean; message: string; data?: unknown };

function dbErr(toolName: string, err: unknown): ToolResult {
  console.error(`[execute-tool] ${toolName}:`, err);
  return { success: false, message: "Something went wrong. Please try again." };
}

function badInput(): ToolResult {
  return { success: false, message: "Invalid input for this action." };
}

// Tables whose rows can be referenced as a parent by another tool's input.
type OwnableTable =
  "goals" | "contacts" | "tasks" | "projects" | "payment_methods";

/**
 * Confirms a foreign key taken from tool input belongs to the calling user.
 *
 * Under a cookie-backed client RLS already enforces this, but the MCP path
 * injects a service-role client that bypasses RLS entirely — without this check
 * a caller could attach a milestone to someone else's goal or move another
 * user's wallet balance.
 */
async function isOwnedBy(
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

function notOwned(entity: string): ToolResult {
  return { success: false, message: `${entity} not found` };
}

// ─── Pagination ───────────────────────────────────────────────────────────────

// Callers request `limit` rows; the query asks for one extra so we can tell the
// difference between "that is everything" and "the list was truncated". Without
// this the assistant silently reports a capped page as the complete set.
const DEFAULT_PAGE_SIZE = 20;

type Page<T> = { rows: T[]; hasMore: boolean; nextOffset: number };

function pageOf<T>(rows: T[] | null, limit: number, offset: number): Page<T> {
  const fetched = rows ?? [];
  const hasMore = fetched.length > limit;
  const page = hasMore ? fetched.slice(0, limit) : fetched;
  return { rows: page, hasMore, nextOffset: offset + page.length };
}

function pagedResult<T>(noun: string, page: Page<T>): ToolResult {
  return {
    success: true,
    message: page.hasMore
      ? `Found ${page.rows.length} ${noun} (more available — call again with offset ${page.nextOffset})`
      : `Found ${page.rows.length} ${noun}`,
    data: page.rows,
  };
}

// Inclusive bounds covering limit + 1 rows, per PostgREST range semantics.
function rangeFor(limit: number, offset: number): [number, number] {
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
function displayValue(row: unknown, column: string): string | null {
  if (!row || typeof row !== "object") return null;
  for (const [key, value] of Object.entries(row)) {
    if (key !== column) continue;
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : String(value);
  }
  return null;
}

/** "Task: \"Ship it\" (id 4f3a…)" — brief item 11: name plus id, every time. */
function describeRecord(entity: DeletableEntity, row: unknown): string {
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
async function detachChildren(
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
async function softDeleteRecord(
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
async function restoreRecord(
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

// ─── Executor ─────────────────────────────────────────────────────────────────

// Cookieless callers (e.g. the MCP endpoint) inject their own client + user
export type ToolContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx?: ToolContext,
): Promise<ToolResult> {
  let supabase: SupabaseClient<Database>;
  let userId: string;
  if (ctx) {
    supabase = ctx.supabase;
    userId = ctx.userId;
  } else {
    const cookieClient = await createClient();
    const {
      data: { user },
    } = await cookieClient.auth.getUser();
    if (!user) return { success: false, message: "Not authenticated" };
    supabase = cookieClient;
    userId = user.id;
  }

  const today = todayISO();

  switch (toolName) {
    case "create_task": {
      const p = CreateTaskInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title: p.data.title,
          priority: p.data.priority ?? "P3",
          due_date: p.data.due_date ?? null,
          status: p.data.status ?? "todo",
          description: p.data.description ?? null,
          is_starred: false,
          is_focus: false,
          labels: [],
          subtasks: [],
          attachments: [],
          area: "default" as const,
        })
        .select()
        .single();
      if (error) return dbErr("create_task", error);
      return {
        success: true,
        message: `Created task: "${p.data.title}"`,
        data,
      };
    }

    case "list_tasks": {
      const p = ListTasksInput.safeParse(input);
      const filter = p.success ? (p.data.filter ?? "all") : "all";
      let query = supabase
        .from("tasks")
        .select("id, title, priority, due_date, status")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .neq("status", "done");
      if (filter === "today")
        query = query.or(`due_date.eq.${today},due_date.lt.${today}`);
      // 'P1'…'P4' sort ascending to put the highest priority first.
      const { data, error } = await query
        .order("priority", { ascending: true })
        .limit(20);
      if (error) return dbErr("list_tasks", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} tasks`,
        data,
      };
    }

    case "complete_task": {
      const p = CompleteTaskInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", p.data.task_id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select("title")
        .single();
      if (error) return dbErr("complete_task", error);
      return { success: true, message: `Completed task: "${data?.title}"` };
    }

    case "list_payment_methods": {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("id, name, balance, color, is_active, display_order")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("display_order");
      if (error) return dbErr("list_payment_methods", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} payment methods`,
        data,
      };
    }

    case "log_expense": {
      const p = LogMoneyInput.safeParse(input);
      if (!p.success) return badInput();
      // A foreign payment_method_id would move another user's wallet balance
      // via the balance trigger.
      if (
        p.data.payment_method_id &&
        !(await isOwnedBy(
          supabase,
          "payment_methods",
          p.data.payment_method_id,
          userId,
        ))
      )
        return notOwned("Payment method");
      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        type: "expense",
        amount: p.data.amount,
        category: p.data.category,
        description: p.data.description ?? null,
        date: p.data.date ?? today,
        payment_method_id: p.data.payment_method_id ?? null,
        tags: [],
      });
      if (error) return dbErr("log_expense", error);
      return {
        success: true,
        message: `Logged expense: AED ${p.data.amount} for ${p.data.category}`,
      };
    }

    case "log_income": {
      const p = LogMoneyInput.safeParse(input);
      if (!p.success) return badInput();
      if (
        p.data.payment_method_id &&
        !(await isOwnedBy(
          supabase,
          "payment_methods",
          p.data.payment_method_id,
          userId,
        ))
      )
        return notOwned("Payment method");
      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        type: "income",
        amount: p.data.amount,
        category: p.data.category,
        description: p.data.description ?? null,
        date: p.data.date ?? today,
        payment_method_id: p.data.payment_method_id ?? null,
        tags: [],
      });
      if (error) return dbErr("log_income", error);
      return {
        success: true,
        message: `Logged income: AED ${p.data.amount} from ${p.data.category}`,
      };
    }

    case "log_habit": {
      const p = LogHabitInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: habits } = await supabase
        .from("habits")
        .select("id, name")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("active", true)
        .ilike("name", `%${p.data.habit_name}%`)
        .limit(1);
      if (!habits?.length)
        return {
          success: false,
          message: `No habit found matching "${p.data.habit_name}"`,
        };
      const habit = habits[0];
      // habit_logs has UNIQUE (habit_id, logged_date) — without onConflict the
      // second log of the day raises a conflict instead of updating.
      //
      // deleted_at: null is part of the payload because a soft-deleted log
      // still occupies its slot in that unique index. Logging the habit again
      // for the same day revives the row with the new value rather than
      // silently writing into a record the user cannot see.
      const { error: logError } = await supabase.from("habit_logs").upsert(
        {
          user_id: userId,
          habit_id: habit.id,
          logged_date: today,
          completed: true,
          deleted_at: null,
        },
        { onConflict: "habit_id,logged_date" },
      );
      if (logError) return dbErr("log_habit", logError);
      return { success: true, message: `Logged habit: "${habit.name}"` };
    }

    case "create_goal": {
      const p = CreateGoalInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("goals")
        .insert({
          user_id: userId,
          title: p.data.title,
          description: p.data.description ?? null,
          category: p.data.category ?? "personal",
          target_date: p.data.target_date ?? null,
          progress: 0,
          status: "active",
        })
        .select()
        .single();
      if (error) return dbErr("create_goal", error);
      return {
        success: true,
        message: `Created goal: "${p.data.title}"`,
        data,
      };
    }

    case "add_note": {
      const p = AddNoteInput.safeParse(input);
      if (!p.success) return badInput();
      const { error } = await supabase.from("notes").insert({
        user_id: userId,
        title: p.data.title,
        content: p.data.content,
        tags: p.data.tags ?? [],
        linked_to_type: null,
        linked_to_id: null,
      });
      if (error) return dbErr("add_note", error);
      return { success: true, message: `Saved note: "${p.data.title}"` };
    }

    case "add_contact": {
      const p = AddContactInput.safeParse(input);
      if (!p.success) return badInput();
      const { error } = await supabase.from("contacts").insert({
        user_id: userId,
        name: p.data.name,
        email: p.data.email ?? null,
        phone: p.data.phone ?? null,
        company: p.data.company ?? null,
        type: p.data.type ?? "network",
        stage: "new",
        tags: [],
      });
      if (error) return dbErr("add_contact", error);
      return { success: true, message: `Saved contact: "${p.data.name}"` };
    }

    case "get_daily_briefing": {
      const monthStart = format(startOfMonth(parseISO(today)), "yyyy-MM-dd");
      const [
        { data: todayTasks },
        { data: overdue },
        { data: habits },
        { data: todayLogs },
        { data: goals },
        { data: budgets },
        { data: monthExpenses },
        { data: followUps },
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("title, priority")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .neq("status", "done")
          .eq("due_date", today)
          .limit(10),
        supabase
          .from("tasks")
          .select("title, due_date")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .neq("status", "done")
          .lt("due_date", today)
          .limit(5),
        supabase
          .from("habits")
          .select("id, name, icon")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .eq("active", true)
          .contains("target_days", [todayDOW()]),
        supabase
          .from("habit_logs")
          .select("habit_id")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .eq("logged_date", today)
          .eq("completed", true),
        supabase
          .from("goals")
          .select("title, progress")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .eq("status", "active")
          .limit(5),
        supabase
          .from("budgets")
          .select("category, amount")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .gte("period_end", today),
        supabase
          .from("transactions")
          .select("category, amount")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .eq("type", "expense")
          .gte("date", monthStart),
        // !inner turns the embedded contact into a join filter, so a follow-up
        // whose contact has been deleted drops out of the briefing entirely
        // rather than surfacing with the deleted contact's name attached.
        supabase
          .from("interactions")
          .select("contacts!inner(name), follow_up_date")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .is("contacts.deleted_at", null)
          .lte("follow_up_date", today)
          .not("follow_up_date", "is", null)
          .limit(5),
      ]);

      const loggedIds = new Set(
        (todayLogs ?? []).map((l: { habit_id: string }) => l.habit_id),
      );
      const spendByCategory: Record<string, number> = {};
      for (const t of monthExpenses ?? [])
        spendByCategory[t.category] =
          (spendByCategory[t.category] ?? 0) + t.amount;
      const budgetWarnings = (budgets ?? []).filter(
        (b) => (spendByCategory[b.category] ?? 0) / b.amount >= 0.9,
      );

      return {
        success: true,
        message: "Daily briefing retrieved",
        data: {
          todayTasks,
          overdueTasks: overdue,
          // loggedIds holds habit_id — match on id, not name.
          habits: (habits ?? []).map(
            (h: { id: string; name: string; icon: string }) => ({
              ...h,
              done: loggedIds.has(h.id),
            }),
          ),
          goals,
          budgetWarnings,
          followUps,
        },
      };
    }

    case "search_data": {
      const p = SearchDataInput.safeParse(input);
      if (!p.success) return badInput();
      const {
        query,
        types = ["tasks", "notes", "contacts", "goals"],
        limit: searchLimit = 5,
      } = p.data;
      const results: Record<string, unknown[]> = {};

      await Promise.all([
        types.includes("tasks") &&
          supabase
            .from("tasks")
            .select("id, title, status, priority")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .ilike("title", `%${query}%`)
            .limit(searchLimit)
            .then(({ data }) => {
              results.tasks = data ?? [];
            }),
        types.includes("notes") &&
          Promise.all([
            supabase
              .from("notes")
              .select("id, title, content")
              .eq("user_id", userId)
              .is("deleted_at", null)
              .ilike("title", `%${query}%`)
              .limit(searchLimit),
            supabase
              .from("notes")
              .select("id, title, content")
              .eq("user_id", userId)
              .is("deleted_at", null)
              .ilike("content", `%${query}%`)
              .limit(searchLimit),
          ]).then(([byTitle, byContent]) => {
            const seen = new Set<string>();
            const combined = [
              ...(byTitle.data ?? []),
              ...(byContent.data ?? []),
            ];
            results.notes = combined
              .filter((n) => !seen.has(n.id) && seen.add(n.id) !== undefined)
              .slice(0, searchLimit);
          }),
        types.includes("contacts") &&
          supabase
            .from("contacts")
            .select("id, name, company, email")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .ilike("name", `%${query}%`)
            .limit(searchLimit)
            .then(({ data }) => {
              results.contacts = data ?? [];
            }),
        types.includes("goals") &&
          supabase
            .from("goals")
            .select("id, title, progress, status")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .ilike("title", `%${query}%`)
            .limit(searchLimit)
            .then(({ data }) => {
              results.goals = data ?? [];
            }),
      ]);

      const total = Object.values(results).reduce(
        (s, arr) => s + arr.length,
        0,
      );
      return {
        success: true,
        message: `Found ${total} results for "${query}"`,
        data: results,
      };
    }

    case "get_analytics": {
      const p = GetAnalyticsInput.safeParse(input);
      const period = p.success ? (p.data.period ?? "month") : "month";
      // Both boundaries are Dubai calendar dates so they line up with the
      // date columns they are compared against.
      const startDate =
        period === "week" ? addDaysISO(today, -6) : today.slice(0, 7) + "-01";

      const [txRes, taskRes, habitRes, habitLogRes, goalRes] =
        await Promise.all([
          supabase
            .from("transactions")
            .select("type,amount,category")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .gte("date", startDate),
          supabase
            .from("tasks")
            .select("id,status")
            .eq("user_id", userId)
            .is("deleted_at", null)
            // created_at is timestamptz — anchor to the start of the Dubai day
            // rather than relying on an implicit midnight-UTC cast.
            .gte("created_at", `${startDate}T00:00:00+04:00`),
          supabase
            .from("habits")
            .select("id,name")
            .eq("user_id", userId)
            .is("deleted_at", null),
          supabase
            .from("habit_logs")
            .select("habit_id,completed")
            .eq("user_id", userId)
            .is("deleted_at", null)
            // Schema column is logged_date (001_schema.sql), not date.
            .gte("logged_date", startDate),
          supabase
            .from("goals")
            .select("id,status,progress")
            .eq("user_id", userId)
            .is("deleted_at", null),
        ]);

      // Reporting zeros for a failed query would look like a genuinely empty
      // period — surface the failure instead.
      const analyticsError =
        txRes.error ??
        taskRes.error ??
        habitRes.error ??
        habitLogRes.error ??
        goalRes.error;
      if (analyticsError) return dbErr("get_analytics", analyticsError);

      const transactions = txRes.data ?? [];
      const income = transactions
        .filter((t) => t.type === "income")
        .reduce((s: number, t) => s + (t.amount as number), 0);
      const expenses = transactions
        .filter((t) => t.type === "expense")
        .reduce((s: number, t) => s + (t.amount as number), 0);

      const tasks = taskRes.data ?? [];
      const tasksCompleted = tasks.filter((t) => t.status === "done").length;

      const habits = habitRes.data ?? [];
      const habitLogs = habitLogRes.data ?? [];
      const habitsCompleted = habitLogs.filter((l) => l.completed).length;

      const goals = goalRes.data ?? [];
      const activeGoals = goals.filter((g) => g.status === "active").length;
      const completedGoals = goals.filter(
        (g) => g.status === "completed",
      ).length;
      const avgProgress =
        goals.length > 0
          ? Math.round(
              goals.reduce(
                (s: number, g) => s + ((g.progress as number) ?? 0),
                0,
              ) / goals.length,
            )
          : 0;

      return {
        success: true,
        message: `Here's your ${period}ly analytics summary`,
        data: {
          period,
          finance: { income, expenses, net: income - expenses },
          tasks: { total: tasks.length, completed: tasksCompleted },
          habits: { tracked: habits.length, logsCompleted: habitsCompleted },
          goals: {
            active: activeGoals,
            completed: completedGoals,
            avgProgress,
          },
        },
      };
    }

    // Approval-required tools — only reach here after user confirms
    case "delete_task": {
      const p = DeleteTaskInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "task",
        p.data.task_id,
        userId,
        "delete_task",
      );
    }

    case "bulk_complete_tasks": {
      const p = BulkCompleteInput.safeParse(input);
      if (!p.success) return badInput();
      const { error } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .in("id", p.data.task_ids)
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (error) return dbErr("bulk_complete_tasks", error);
      return {
        success: true,
        message: `Completed ${p.data.task_ids.length} tasks`,
      };
    }

    case "delete_note": {
      const p = DeleteNoteInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "note",
        p.data.note_id,
        userId,
        "delete_note",
      );
    }

    // ─── TASKS ─────────────────────────────────────────────────────────────────

    case "update_task": {
      const p = UpdateTaskInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      if (
        updates.project_id &&
        !(await isOwnedBy(supabase, "projects", updates.project_id, userId))
      )
        return notOwned("Project");
      const { error, data } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select("title")
        .single();
      if (error) return dbErr("update_task", error);
      return { success: true, message: `Updated task: "${data?.title}"` };
    }

    // ─── PROJECTS ──────────────────────────────────────────────────────────────

    case "list_projects": {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, color, status")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("name");
      if (error) return dbErr("list_projects", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} projects`,
        data,
      };
    }

    case "create_project": {
      const p = CreateProjectInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("projects")
        .insert({
          user_id: userId,
          name: p.data.name,
          description: p.data.description ?? null,
          color: p.data.color ?? "#6366f1",
          status: "active",
          category: "default" as const,
        })
        .select()
        .single();
      if (error) return dbErr("create_project", error);
      return {
        success: true,
        message: `Created project: "${p.data.name}"`,
        data,
      };
    }

    case "update_project": {
      const p = UpdateProjectInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select("name")
        .single();
      if (error) return dbErr("update_project", error);
      return { success: true, message: `Updated project: "${data?.name}"` };
    }

    case "delete_project": {
      const p = DeleteProjectInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "project",
        p.data.project_id,
        userId,
        "delete_project",
      );
    }

    // ─── GOALS ─────────────────────────────────────────────────────────────────

    case "list_goals": {
      const p = ListGoalsInput.safeParse(input);
      const statusFilter = p.success ? (p.data.status ?? "active") : "active";
      let query = supabase
        .from("goals")
        .select(
          "id, title, description, category, target_date, progress, status",
        )
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return dbErr("list_goals", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} goals`,
        data,
      };
    }

    case "update_goal": {
      const p = UpdateGoalInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("goals")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select("title")
        .single();
      if (error) return dbErr("update_goal", error);
      return { success: true, message: `Updated goal: "${data?.title}"` };
    }

    case "complete_goal": {
      const p = ByIdInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("goals")
        .update({ status: "completed", progress: 100 })
        .eq("id", p.data.id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select("title")
        .single();
      if (error) return dbErr("complete_goal", error);
      return { success: true, message: `Completed goal: "${data?.title}"` };
    }

    case "delete_goal": {
      const p = DeleteGoalInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "goal",
        p.data.goal_id,
        userId,
        "delete_goal",
      );
    }

    // ─── MILESTONES ────────────────────────────────────────────────────────────

    case "create_milestone": {
      const p = CreateMilestoneInput.safeParse(input);
      if (!p.success) return badInput();
      if (!(await isOwnedBy(supabase, "goals", p.data.goal_id, userId)))
        return notOwned("Goal");
      const { error, data } = await supabase
        .from("milestones")
        .insert({
          user_id: userId,
          goal_id: p.data.goal_id,
          title: p.data.title,
          due_date: p.data.due_date ?? null,
        })
        .select()
        .single();
      if (error) return dbErr("create_milestone", error);
      return {
        success: true,
        message: `Created milestone: "${p.data.title}"`,
        data,
      };
    }

    case "list_milestones": {
      const p = ListMilestonesInput.safeParse(input);
      if (!p.success) return badInput();
      const { data, error } = await supabase
        .from("milestones")
        .select("id, title, due_date, completed_at")
        .eq("goal_id", p.data.goal_id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) return dbErr("list_milestones", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} milestones`,
        data,
      };
    }

    case "update_milestone": {
      const p = UpdateMilestoneInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("milestones")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select("title")
        .single();
      if (error) return dbErr("update_milestone", error);
      return { success: true, message: `Updated milestone: "${data?.title}"` };
    }

    case "complete_milestone": {
      const p = ByIdInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("milestones")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", p.data.id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select("title")
        .single();
      if (error) return dbErr("complete_milestone", error);
      return {
        success: true,
        message: `Completed milestone: "${data?.title}"`,
      };
    }

    case "delete_milestone": {
      const p = DeleteMilestoneInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "milestone",
        p.data.milestone_id,
        userId,
        "delete_milestone",
      );
    }

    // ─── HABITS ────────────────────────────────────────────────────────────────

    case "list_habits": {
      const [{ data: habits }, { data: todayLogs }] = await Promise.all([
        supabase
          .from("habits")
          .select("id, name, icon, color, frequency, active")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .eq("active", true)
          .order("name"),
        supabase
          .from("habit_logs")
          .select("habit_id")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .eq("logged_date", today)
          .eq("completed", true),
      ]);
      const loggedIds = new Set(
        (todayLogs ?? []).map((l: { habit_id: string }) => l.habit_id),
      );
      const result = (habits ?? []).map(
        (h: {
          id: string;
          name: string;
          icon: string;
          color: string;
          frequency: string;
          active: boolean;
        }) => ({
          ...h,
          done_today: loggedIds.has(h.id),
        }),
      );
      return {
        success: true,
        message: `Found ${result.length} active habits`,
        data: result,
      };
    }

    case "create_habit": {
      const p = CreateHabitInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("habits")
        .insert({
          user_id: userId,
          name: p.data.name,
          description: p.data.description ?? null,
          frequency: p.data.frequency ?? "daily",
          target_days: p.data.target_days ?? [0, 1, 2, 3, 4, 5, 6],
          color: p.data.color ?? "#6366f1",
          icon: "⭐",
          reminder_time: p.data.reminder_time ?? null,
          active: true,
        })
        .select()
        .single();
      if (error) return dbErr("create_habit", error);
      return {
        success: true,
        message: `Created habit: "${p.data.name}"`,
        data,
      };
    }

    case "update_habit": {
      const p = UpdateHabitInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("habits")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select("name")
        .single();
      if (error) return dbErr("update_habit", error);
      return { success: true, message: `Updated habit: "${data?.name}"` };
    }

    case "delete_habit": {
      const p = DeleteHabitInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "habit",
        p.data.habit_id,
        userId,
        "delete_habit",
      );
    }

    // Addressed by (habit_id, logged_date) rather than by row id, so it
    // resolves the row first and then hands off to the shared soft delete.
    case "delete_habit_log": {
      const p = DeleteHabitLogInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: log } = await supabase
        .from("habit_logs")
        .select("id")
        .eq("habit_id", p.data.habit_id)
        .eq("logged_date", p.data.logged_date)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!log)
        return {
          success: false,
          message: `No habit log found for ${p.data.logged_date}`,
        };
      return softDeleteRecord(
        supabase,
        "habit_log",
        log.id,
        userId,
        "delete_habit_log",
      );
    }

    // ─── TRANSACTIONS ──────────────────────────────────────────────────────────

    case "list_transactions": {
      const p = ListTransactionsInput.safeParse(input);
      const typeFilter = p.success ? p.data.type : "all";
      const startDate = p.success ? p.data.start_date : undefined;
      const limitVal =
        p.success && p.data.limit ? p.data.limit : DEFAULT_PAGE_SIZE;
      const offsetVal = (p.success && p.data.offset) || 0;
      let query = supabase
        .from("transactions")
        .select(
          "id, type, amount, category, description, date, payment_method, payment_method_id, from_payment_method_id, to_payment_method_id",
        )
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (typeFilter && typeFilter !== "all")
        query = query.eq("type", typeFilter);
      if (startDate) query = query.gte("date", startDate);
      const { data, error } = await query
        .order("date", { ascending: false })
        .range(...rangeFor(limitVal, offsetVal));
      if (error) return dbErr("list_transactions", error);
      return pagedResult("transactions", pageOf(data, limitVal, offsetVal));
    }

    case "update_transaction": {
      const p = UpdateTransactionInput.safeParse(input);
      if (!p.success) return badInput();
      const { transaction_id, summary: _ts, ...updates } = p.data;
      const { data: existing } = await supabase
        .from("transactions")
        .select("id")
        .eq("id", transaction_id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!existing)
        return { success: false, message: "Transaction not found" };
      const { error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", transaction_id)
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (error) return dbErr("update_transaction", error);
      return { success: true, message: "Transaction updated." };
    }

    case "delete_transaction": {
      const p = DeleteTransactionInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "transaction",
        p.data.transaction_id,
        userId,
        "delete_transaction",
      );
    }

    // ─── BUDGETS ───────────────────────────────────────────────────────────────

    case "list_budgets": {
      const { data, error } = await supabase
        .from("budgets")
        .select("id, category, amount, period, period_start, period_end")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("period_end", { ascending: false });
      if (error) return dbErr("list_budgets", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} budgets`,
        data,
      };
    }

    case "create_budget": {
      const p = CreateBudgetInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("budgets")
        .insert({
          user_id: userId,
          category: p.data.category,
          amount: p.data.amount,
          period: p.data.period ?? "monthly",
          period_start: p.data.period_start,
          period_end: p.data.period_end,
        })
        .select()
        .single();
      if (error) return dbErr("create_budget", error);
      return {
        success: true,
        message: `Created budget: ${p.data.category} AED ${p.data.amount}`,
        data,
      };
    }

    case "update_budget": {
      const p = UpdateBudgetInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error } = await supabase
        .from("budgets")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (error) return dbErr("update_budget", error);
      return { success: true, message: "Budget updated." };
    }

    case "delete_budget": {
      const p = DeleteBudgetInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "budget",
        p.data.budget_id,
        userId,
        "delete_budget",
      );
    }

    // ─── DEBTS ─────────────────────────────────────────────────────────────────

    case "list_debts": {
      const p = ListDebtsInput.safeParse(input);
      const filter = p.success ? (p.data.filter ?? "all") : "all";
      let query = supabase
        .from("debts")
        .select("id, creditor, type, amount, description, due_date, paid_at")
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (filter === "i_owe") query = query.eq("type", "i_owe");
      else if (filter === "they_owe") query = query.eq("type", "they_owe");
      else if (filter === "unpaid") query = query.is("paid_at", null);
      const { data, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) return dbErr("list_debts", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} debt records`,
        data,
      };
    }

    case "create_debt": {
      const p = CreateDebtInput.safeParse(input);
      if (!p.success) return badInput();
      const direction = p.data.type === "i_owe" ? "owed to" : "owed by";
      const { error, data } = await supabase
        .from("debts")
        .insert({
          user_id: userId,
          creditor: p.data.creditor,
          type: p.data.type,
          amount: p.data.amount,
          description: p.data.description ?? null,
          due_date: p.data.due_date ?? null,
        })
        .select()
        .single();
      if (error) return dbErr("create_debt", error);
      return {
        success: true,
        message: `Recorded AED ${p.data.amount} ${direction} ${p.data.creditor}`,
        data,
      };
    }

    case "update_debt": {
      const p = UpdateDebtInput.safeParse(input);
      if (!p.success) return badInput();
      const { debt_id, summary: _ds, mark_paid, ...updates } = p.data;
      const { data: existing } = await supabase
        .from("debts")
        .select("id, creditor")
        .eq("id", debt_id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!existing) return { success: false, message: "Debt not found" };
      const payload = {
        ...updates,
        ...(mark_paid ? { paid_at: new Date().toISOString() } : {}),
      };
      const { error } = await supabase
        .from("debts")
        .update(payload)
        .eq("id", debt_id)
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (error) return dbErr("update_debt", error);
      return {
        success: true,
        message: mark_paid
          ? `Marked debt to ${existing.creditor} as paid.`
          : "Debt updated.",
      };
    }

    case "delete_debt": {
      const p = DeleteDebtInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "debt",
        p.data.debt_id,
        userId,
        "delete_debt",
      );
    }

    // ─── CONTACTS ──────────────────────────────────────────────────────────────

    case "list_contacts": {
      const p = ListContactsInput.safeParse(input);
      const typeFilter = p.success ? p.data.type : "all";
      const limitVal =
        p.success && p.data.limit ? p.data.limit : DEFAULT_PAGE_SIZE;
      const offsetVal = (p.success && p.data.offset) || 0;
      let query = supabase
        .from("contacts")
        .select("id, name, email, phone, company, type, stage")
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (typeFilter && typeFilter !== "all")
        query = query.eq("type", typeFilter);
      const { data, error } = await query
        .order("name")
        .range(...rangeFor(limitVal, offsetVal));
      if (error) return dbErr("list_contacts", error);
      return pagedResult("contacts", pageOf(data, limitVal, offsetVal));
    }

    case "update_contact": {
      const p = UpdateContactInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select("name")
        .single();
      if (error) return dbErr("update_contact", error);
      return { success: true, message: `Updated contact: "${data?.name}"` };
    }

    case "delete_contact": {
      const p = DeleteContactInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "contact",
        p.data.contact_id,
        userId,
        "delete_contact",
      );
    }

    // ─── INTERACTIONS ──────────────────────────────────────────────────────────

    case "create_interaction": {
      const p = CreateInteractionInput.safeParse(input);
      if (!p.success) return badInput();
      if (!(await isOwnedBy(supabase, "contacts", p.data.contact_id, userId)))
        return notOwned("Contact");
      const { error, data } = await supabase
        .from("interactions")
        .insert({
          user_id: userId,
          contact_id: p.data.contact_id,
          type: p.data.type,
          notes: p.data.notes,
          date: p.data.date ?? today,
          follow_up_date: p.data.follow_up_date ?? null,
        })
        .select()
        .single();
      if (error) return dbErr("create_interaction", error);
      return {
        success: true,
        message: `Logged ${p.data.type} interaction`,
        data,
      };
    }

    case "list_interactions": {
      const p = ListInteractionsInput.safeParse(input);
      if (!p.success) return badInput();
      const { data, error } = await supabase
        .from("interactions")
        .select("id, type, notes, date, follow_up_date")
        .eq("contact_id", p.data.contact_id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .limit(20);
      if (error) return dbErr("list_interactions", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} interactions`,
        data,
      };
    }

    case "update_interaction": {
      const p = UpdateInteractionInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error } = await supabase
        .from("interactions")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (error) return dbErr("update_interaction", error);
      return { success: true, message: "Interaction updated." };
    }

    case "delete_interaction": {
      const p = DeleteInteractionInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "interaction",
        p.data.interaction_id,
        userId,
        "delete_interaction",
      );
    }

    // ─── NOTES ─────────────────────────────────────────────────────────────────

    case "list_notes": {
      const p = ListNotesInput.safeParse(input);
      const limitVal =
        p.success && p.data.limit ? p.data.limit : DEFAULT_PAGE_SIZE;
      const offsetVal = (p.success && p.data.offset) || 0;
      const tagFilter = p.success ? p.data.tag : undefined;
      let query = supabase
        .from("notes")
        .select("id, title, tags, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (tagFilter) query = query.contains("tags", [tagFilter]);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(...rangeFor(limitVal, offsetVal));
      if (error) return dbErr("list_notes", error);
      return pagedResult("notes", pageOf(data, limitVal, offsetVal));
    }

    case "update_note": {
      const p = UpdateNoteInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("notes")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select("title")
        .single();
      if (error) return dbErr("update_note", error);
      return { success: true, message: `Updated note: "${data?.title}"` };
    }

    // ─── DOCUMENTS ─────────────────────────────────────────────────────────────

    case "list_documents": {
      const p = z
        .object({ limit: z.number().int().positive().max(100).optional() })
        .safeParse(input);
      const limitVal = p.success && p.data.limit ? p.data.limit : 20;
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, file_type, file_size, tags, notes, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limitVal);
      if (error) return dbErr("list_documents", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} documents`,
        data,
      };
    }

    case "create_document": {
      const p = CreateDocumentInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("documents")
        .insert({
          user_id: userId,
          name: p.data.name,
          file_path: p.data.file_path,
          file_type: p.data.file_type ?? null,
          file_size: p.data.file_size ?? null,
          tags: p.data.tags ?? [],
          notes: p.data.notes ?? null,
        })
        .select()
        .single();
      if (error) return dbErr("create_document", error);
      return {
        success: true,
        message: `Saved document: "${p.data.name}"`,
        data,
      };
    }

    case "update_document": {
      const p = UpdateDocumentInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("documents")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select("name")
        .single();
      if (error) return dbErr("update_document", error);
      return { success: true, message: `Updated document: "${data?.name}"` };
    }

    case "delete_document": {
      const p = DeleteDocumentInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "document",
        p.data.document_id,
        userId,
        "delete_document",
      );
    }

    // ─── LINKS ─────────────────────────────────────────────────────────────────

    case "list_links": {
      const p = z
        .object({ limit: z.number().int().positive().max(100).optional() })
        .safeParse(input);
      const limitVal = p.success && p.data.limit ? p.data.limit : 20;
      const { data, error } = await supabase
        .from("links")
        .select("id, url, title, description, tags, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limitVal);
      if (error) return dbErr("list_links", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} links`,
        data,
      };
    }

    case "create_link": {
      const p = CreateLinkInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("links")
        .insert({
          user_id: userId,
          url: p.data.url,
          title: p.data.title ?? null,
          description: p.data.description ?? null,
          tags: p.data.tags ?? [],
        })
        .select()
        .single();
      if (error) return dbErr("create_link", error);
      return {
        success: true,
        message: `Saved link: "${p.data.title ?? p.data.url}"`,
        data,
      };
    }

    case "update_link": {
      const p = UpdateLinkInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error } = await supabase
        .from("links")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (error) return dbErr("update_link", error);
      return { success: true, message: "Link updated." };
    }

    case "delete_link": {
      const p = DeleteLinkInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "link",
        p.data.id,
        userId,
        "delete_link",
      );
    }

    // ─── JOURNAL ENTRIES ───────────────────────────────────────────────────────

    case "list_journal_entries": {
      const p = z
        .object({ limit: z.number().int().positive().max(50).optional() })
        .safeParse(input);
      const limitVal = p.success && p.data.limit ? p.data.limit : 10;
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id, date, mood, energy, tags, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .limit(limitVal);
      if (error) return dbErr("list_journal_entries", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} journal entries`,
        data,
      };
    }

    case "create_journal_entry": {
      const p = CreateJournalEntryInput.safeParse(input);
      if (!p.success) return badInput();
      // journal_entries has UNIQUE (user_id, date). A soft-deleted entry still
      // holds that day's slot, so deleted_at: null revives it — writing a new
      // entry for a date the user deleted should give them a visible entry, not
      // an invisible one.
      const { error, data } = await supabase
        .from("journal_entries")
        .upsert(
          {
            user_id: userId,
            date: p.data.date,
            content: p.data.content,
            mood: p.data.mood ?? null,
            energy: p.data.energy ?? null,
            tags: p.data.tags ?? [],
            deleted_at: null,
          },
          { onConflict: "user_id,date" },
        )
        .select()
        .single();
      if (error) return dbErr("create_journal_entry", error);
      return {
        success: true,
        message: `Journal entry saved for ${p.data.date}`,
        data,
      };
    }

    case "update_journal_entry": {
      const p = UpdateJournalEntryInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error } = await supabase
        .from("journal_entries")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (error) return dbErr("update_journal_entry", error);
      return { success: true, message: "Journal entry updated." };
    }

    case "delete_journal_entry": {
      const p = DeleteJournalEntryInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "journal_entry",
        p.data.entry_id,
        userId,
        "delete_journal_entry",
      );
    }

    // ─── REVIEWS ───────────────────────────────────────────────────────────────

    case "list_reviews": {
      const p = ListReviewsInput.safeParse(input);
      const typeFilter = p.success ? p.data.type : "all";
      const limitVal = p.success && p.data.limit ? p.data.limit : 10;
      let query = supabase
        .from("reviews")
        .select("id, type, period_start, period_end, mood, energy, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (typeFilter && typeFilter !== "all")
        query = query.eq("type", typeFilter);
      const { data, error } = await query
        .order("period_end", { ascending: false })
        .limit(limitVal);
      if (error) return dbErr("list_reviews", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} reviews`,
        data,
      };
    }

    case "create_review": {
      const p = CreateReviewInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("reviews")
        .insert({
          user_id: userId,
          type: p.data.type,
          period_start: p.data.period_start,
          period_end: p.data.period_end,
          content: p.data.content ? { text: p.data.content } : {},
          mood: p.data.mood ?? null,
          energy: p.data.energy ?? null,
        })
        .select()
        .single();
      if (error) return dbErr("create_review", error);
      return {
        success: true,
        message: `Created ${p.data.type} review for ${p.data.period_start}–${p.data.period_end}`,
        data,
      };
    }

    case "update_review": {
      const p = UpdateReviewInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, content, ...rest } = p.data;
      const { error } = await supabase
        .from("reviews")
        .update({
          ...rest,
          ...(content !== undefined ? { content: { text: content } } : {}),
        })
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (error) return dbErr("update_review", error);
      return { success: true, message: "Review updated." };
    }

    case "delete_review": {
      const p = DeleteReviewInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "review",
        p.data.review_id,
        userId,
        "delete_review",
      );
    }

    // ─── FOCUS SESSIONS ────────────────────────────────────────────────────────

    case "list_focus_sessions": {
      const p = ListFocusSessionsInput.safeParse(input);
      const limitVal = p.success && p.data.limit ? p.data.limit : 10;
      const taskFilter = p.success ? p.data.task_id : undefined;
      let query = supabase
        .from("focus_sessions")
        .select("id, duration_minutes, started_at, ended_at, notes, task_id")
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (taskFilter) query = query.eq("task_id", taskFilter);
      const { data, error } = await query
        .order("started_at", { ascending: false })
        .limit(limitVal);
      if (error) return dbErr("list_focus_sessions", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} focus sessions`,
        data,
      };
    }

    case "create_focus_session": {
      const p = CreateFocusSessionInput.safeParse(input);
      if (!p.success) return badInput();
      if (
        p.data.task_id &&
        !(await isOwnedBy(supabase, "tasks", p.data.task_id, userId))
      )
        return notOwned("Task");
      const now = new Date().toISOString();
      const { error, data } = await supabase
        .from("focus_sessions")
        .insert({
          user_id: userId,
          duration_minutes: p.data.duration_minutes,
          started_at: p.data.started_at ?? now,
          ended_at: p.data.ended_at ?? null,
          task_id: p.data.task_id ?? null,
          notes: p.data.notes ?? null,
        })
        .select()
        .single();
      if (error) return dbErr("create_focus_session", error);
      return {
        success: true,
        message: `Recorded ${p.data.duration_minutes}-minute focus session`,
        data,
      };
    }

    case "update_focus_session": {
      const p = UpdateFocusSessionInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error } = await supabase
        .from("focus_sessions")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (error) return dbErr("update_focus_session", error);
      return { success: true, message: "Focus session updated." };
    }

    case "delete_focus_session": {
      const p = ByIdInput.safeParse(input);
      if (!p.success) return badInput();
      return softDeleteRecord(
        supabase,
        "focus_session",
        p.data.id,
        userId,
        "delete_focus_session",
      );
    }

    // ─── PERSONAL MEMORY ───────────────────────────────────────────────────────

    case "remember_user_fact": {
      const p = z
        .object({
          key: z.string().min(1).max(100),
          value: z.string().min(1).max(1000),
        })
        .safeParse(input);
      if (!p.success) return badInput();

      // Merge fact into user_profile.facts (upsert-safe)
      const { data: existing } = await supabase
        .from("user_profile")
        .select("facts")
        .eq("user_id", userId)
        .maybeSingle();
      const currentFacts = (existing?.facts ?? {}) as Record<string, string>;
      const updatedFacts = { ...currentFacts, [p.data.key]: p.data.value };

      const { error } = await supabase
        .from("user_profile")
        .upsert(
          { user_id: userId, facts: updatedFacts },
          { onConflict: "user_id" },
        );
      if (error) return dbErr("remember_user_fact", error);

      // Also store in ai_memory for semantic retrieval
      storeMemory(
        userId,
        `User fact — ${p.data.key}: ${p.data.value}`,
        { role: "user" },
        "user_fact",
        supabase,
      ).catch(() => {});

      return {
        success: true,
        message: `Remembered: ${p.data.key} = ${p.data.value}`,
      };
    }

    case "recall_memories": {
      const p = z
        .object({
          query: z.string().min(1).max(500),
          limit: z.number().int().positive().max(20).optional(),
        })
        .safeParse(input);
      if (!p.success) return badInput();

      const [semantic, facts] = await Promise.all([
        retrieveMemories(userId, p.data.query, p.data.limit ?? 10, supabase),
        retrieveUserFacts(userId, supabase),
      ]);

      const results = [
        ...facts.map((f) => ({
          content: f.content,
          type: "user_fact",
          similarity: 1,
        })),
        ...semantic.map((m) => ({
          content: m.content,
          type: "conversation",
          similarity: m.similarity,
        })),
      ];

      if (!results.length)
        return {
          success: true,
          message: "No relevant memories found.",
          data: [],
        };
      return {
        success: true,
        message: `Found ${results.length} relevant memories`,
        data: results,
      };
    }

    // ─── RECYCLE BIN ───────────────────────────────────────────────────────────

    case "list_deleted": {
      const p = ListDeletedInput.safeParse(input);
      if (!p.success) return badInput();
      const limitVal = p.data.limit ?? DEFAULT_PAGE_SIZE;
      const offsetVal = p.data.offset ?? 0;

      // A single entity pages properly. Without one we sample every entity so
      // the user can see the whole bin at a glance.
      if (p.data.entity) {
        const meta = DELETABLE[p.data.entity];
        const [from, to] = rangeFor(limitVal, offsetVal);
        const { data, error } = await supabase
          .from(meta.table)
          .select("*")
          .eq("user_id", userId)
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .range(from, to);
        if (error) return dbErr("list_deleted", error);
        // Widened because the table is chosen at runtime: `data` is a union of
        // 17 row-array types, which pageOf's single type parameter cannot infer.
        const rows: unknown[] | null = data;
        return pagedResult(
          `deleted ${meta.plural}`,
          pageOf(rows, limitVal, offsetVal),
        );
      }

      const perEntity = await Promise.all(
        DELETABLE_ENTITIES.map(async (entity) => {
          const meta = DELETABLE[entity];
          const { data, error } = await supabase
            .from(meta.table)
            .select("*")
            .eq("user_id", userId)
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false })
            .limit(limitVal);
          return { entity, rows: error ? [] : (data ?? []) };
        }),
      );

      const bin = perEntity.filter((e) => e.rows.length > 0);
      const total = bin.reduce((sum, e) => sum + e.rows.length, 0);
      if (!total)
        return {
          success: true,
          message: "The recycle bin is empty.",
          data: [],
        };
      return {
        success: true,
        message: `Found ${total} deleted record(s) across ${bin.length} entity type(s)`,
        data: Object.fromEntries(bin.map((e) => [e.entity, e.rows])),
      };
    }

    case "restore_record": {
      const p = RestoreRecordInput.safeParse(input);
      if (!p.success) return badInput();
      return restoreRecord(supabase, p.data.entity, p.data.id, userId);
    }

    case "purge_record": {
      // confirm is z.literal(true) — an unconfirmed call fails validation above
      // and never reaches the database.
      const p = PurgeRecordInput.safeParse(input);
      if (!p.success)
        return {
          success: false,
          message:
            "Permanent deletion requires confirm: true and a valid entity and id.",
        };
      const meta = DELETABLE[p.data.entity];

      // Only something already in the recycle bin can be purged, so a single
      // mistaken call can never destroy live data.
      const { data: existing } = await supabase
        .from(meta.table)
        .select("*")
        .eq("id", p.data.id)
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .maybeSingle();
      if (!existing)
        return {
          success: false,
          message: `No deleted ${meta.label.toLowerCase()} found with that id. Delete it first — purge only removes what is already in the recycle bin.`,
        };

      const { error } = await supabase
        .from(meta.table)
        .delete()
        .eq("id", p.data.id)
        .eq("user_id", userId)
        .not("deleted_at", "is", null);
      if (error) return dbErr("purge_record", error);

      // Say what the FK cascade took with it — this is the one irreversible path.
      const alsoGone = meta.cascades.length
        ? ` Its ${meta.cascades.join(" and ")} were destroyed with it.`
        : "";
      return {
        success: true,
        message: `Permanently destroyed ${meta.label.toLowerCase()}: ${describeRecord(p.data.entity, existing)}.${alsoGone} This cannot be undone.`,
        data: existing,
      };
    }

    case "bulk_delete_records": {
      const p = BulkDeleteRecordsInput.safeParse(input);
      if (!p.success)
        return {
          success: false,
          message:
            "Bulk delete requires confirm: true, a valid entity, and 1–100 ids.",
        };
      const meta = DELETABLE[p.data.entity];

      const { data: matched, error: readError } = await supabase
        .from(meta.table)
        .select("*")
        .eq("user_id", userId)
        .in("id", p.data.ids)
        .is("deleted_at", null);
      if (readError) return dbErr("bulk_delete_records", readError);
      if (!matched?.length)
        return {
          success: false,
          message: `No live ${meta.plural} found for those ids`,
        };

      const matchedIds: string[] = [];
      for (const row of matched) {
        const id = displayValue(row, "id");
        if (id) matchedIds.push(id);
      }
      for (const id of matchedIds) {
        await detachChildren(supabase, p.data.entity, id, userId);
      }

      const { error } = await supabase
        .from(meta.table)
        .update({ deleted_at: new Date().toISOString() })
        .eq("user_id", userId)
        .in("id", matchedIds)
        .is("deleted_at", null);
      if (error) return dbErr("bulk_delete_records", error);

      // Report the count actually affected, not the count requested — brief
      // item 7. They differ whenever an id was already deleted or not owned.
      const skipped = p.data.ids.length - matchedIds.length;
      const note = skipped
        ? ` ${skipped} id(s) were skipped — already deleted or not found.`
        : "";
      return {
        success: true,
        message: `Deleted ${matchedIds.length} ${meta.plural}.${note} Undo with restore_record.`,
        data: { deleted_count: matchedIds.length, ids: matchedIds },
      };
    }

    case "forget_user_fact": {
      const p = ForgetUserFactInput.safeParse(input);
      if (!p.success) return badInput();

      // Facts live in two places — the JSONB map that builds profile context,
      // and the vector store behind recall_memories. Both have to forget.
      const { data: profile } = await supabase
        .from("user_profile")
        .select("facts")
        .eq("user_id", userId)
        .maybeSingle();

      const facts = profile?.facts;
      if (!facts || typeof facts !== "object" || Array.isArray(facts))
        return { success: false, message: "No stored facts to forget." };

      const remaining: Record<string, Json> = {};
      let found = false;
      for (const [key, value] of Object.entries(facts)) {
        if (key === p.data.key) {
          found = true;
          continue;
        }
        remaining[key] = value;
      }
      if (!found)
        return {
          success: false,
          message: `No stored fact called "${p.data.key}".`,
        };

      const { error } = await supabase
        .from("user_profile")
        .update({ facts: remaining })
        .eq("user_id", userId);
      if (error) return dbErr("forget_user_fact", error);

      await supabase
        .from("ai_memory")
        .delete()
        .eq("user_id", userId)
        .eq("memory_type", "user_fact")
        .ilike("content", `${p.data.key}:%`);

      return {
        success: true,
        message: `Forgot "${p.data.key}". This cannot be undone.`,
      };
    }

    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}
