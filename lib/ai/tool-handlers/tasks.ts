// Tasks: create, list, update, complete, duplicate, delete, and the bulk task tools.
//
// Every query filters by user_id itself: the MCP path runs these handlers
// with a service-role client that bypasses RLS.
import { z } from "zod";
import { parseRule } from "@/lib/recurrence";
import type { Database } from "@/lib/types/database";
import { dbErr, badInput, isOwnedBy, notOwned, softDeleteRecord, type ToolHandlers } from "./shared";
import { dateStr, taskAreas, uuid, isoDatetime } from "./schemas";

const SubtaskInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  done: z.boolean().optional(),
});

const dueTime = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .optional()
  .nullable();

const recurrenceRule = z
  .string()
  .max(200)
  .refine((v) => parseRule(v) !== null, { message: "Invalid recurrence rule" })
  .optional()
  .nullable();

const CreateTaskInput = z.object({
  title: z.string().min(1).max(500),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  due_date: dateStr.optional().nullable(),
  due_time: dueTime,
  status: z
    .enum(["todo", "in_progress", "blocked", "on_hold", "done"])
    .optional(),
  description: z.string().max(5000).optional().nullable(),
  estimated_time: z.number().int().min(0).max(1440).optional().nullable(),
  recurrence: recurrenceRule,
  reminder: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T[\d:.Z+\-]+)?$/)
    .optional()
    .nullable(),
  area: z.enum(taskAreas).optional(),
  project_id: z.string().uuid().optional().nullable(),
  subtasks: z.array(SubtaskInput).max(50).optional(),
});

const CompleteTaskInput = z.object({
  task_id: z.string().uuid(),
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

// Tasks
const UpdateTaskInput = z.object({
  id: uuid,
  title: z.string().min(1).max(500).optional(),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  status: z
    .enum(["todo", "in_progress", "blocked", "on_hold", "done"])
    .optional(),
  due_date: dateStr.optional().nullable(),
  due_time: dueTime,
  description: z.string().max(5000).optional().nullable(),
  estimated_time: z.number().int().min(0).max(1440).optional().nullable(),
  recurrence: recurrenceRule,
  reminder: isoDatetime.optional().nullable(),
  area: z.enum(taskAreas).optional(),
  project_id: uuid.optional().nullable(),
  is_focus: z.boolean().optional(),
  labels: z.array(z.string().max(100)).optional(),
  subtasks: z.array(SubtaskInput).max(50).optional(),
});

const DuplicateTaskInput = z.object({ task_id: uuid });

const BulkUpdatePriorityInput = z.object({
  task_ids: z.array(uuid).min(1).max(100),
  priority: z.enum(["P1", "P2", "P3", "P4"]),
});

export const taskHandlers = {
  create_task: async ({ input, supabase, userId }) => {
    const p = CreateTaskInput.safeParse(input);
    if (!p.success) return badInput();
    if (
      p.data.project_id &&
      !(await isOwnedBy(supabase, "projects", p.data.project_id, userId))
    )
      return notOwned("Project");
    const { error, data } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: p.data.title,
        priority: p.data.priority ?? "P3",
        due_date: p.data.due_date ?? null,
        due_time: p.data.due_time ?? null,
        status: p.data.status ?? "todo",
        description: p.data.description ?? null,
        estimated_time: p.data.estimated_time ?? null,
        recurrence: p.data.recurrence ?? null,
        reminder: p.data.reminder ?? null,
        project_id: p.data.project_id ?? null,
        is_starred: false,
        is_focus: false,
        labels: [],
        subtasks: (p.data.subtasks ?? []).map((s) => ({
          id: s.id ?? crypto.randomUUID(),
          title: s.title,
          done: s.done ?? false,
        })),
        attachments: [],
        area: p.data.area ?? "default",
      })
      .select()
      .single();
    if (error) return dbErr("create_task", error);
    return {
      success: true,
      message: `Created task: "${p.data.title}"`,
      data,
    };
  },

  list_tasks: async ({ input, supabase, userId, today }) => {
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
  },

  complete_task: async ({ input, supabase, userId }) => {
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
  },

  duplicate_task: async ({ input, supabase, userId }) => {
    const p = DuplicateTaskInput.safeParse(input);
    if (!p.success) return badInput();
    const { data: existing } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", p.data.task_id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) return { success: false, message: "Task not found" };
    const { error, data } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: `${existing.title} (copy)`,
        description: existing.description,
        status: existing.status === "done" ? "todo" : existing.status,
        priority: existing.priority,
        due_date: existing.due_date,
        due_time: existing.due_time,
        project_id: existing.project_id,
        area: existing.area ?? "default",
        recurrence: null,
        reminder: null,
        is_starred: false,
        is_focus: false,
        focus_date: null,
        labels: existing.labels,
        subtasks: [],
        estimated_time: existing.estimated_time,
        attachments: [],
      })
      .select("id, title")
      .single();
    if (error) return dbErr("duplicate_task", error);
    return {
      success: true,
      message: `Duplicated task: "${existing.title}" as "${data?.title}"`,
      data,
    };
  },

  delete_task: async ({ input, supabase, userId }) => {
    const p = DeleteTaskInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "task",
      p.data.task_id,
      userId,
      "delete_task",
    );
  },

  bulk_complete_tasks: async ({ input, supabase, userId }) => {
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
  },

  bulk_update_task_priority: async ({ input, supabase, userId }) => {
    const p = BulkUpdatePriorityInput.safeParse(input);
    if (!p.success) return badInput();
    const { error, data } = await supabase
      .from("tasks")
      .update({ priority: p.data.priority })
      .in("id", p.data.task_ids)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("id");
    if (error) return dbErr("bulk_update_task_priority", error);
    return {
      success: true,
      message: `Updated priority to ${p.data.priority} for ${data?.length ?? 0} task(s)`,
    };
  },

  update_task: async ({ input, supabase, userId, today }) => {
    const p = UpdateTaskInput.safeParse(input);
    if (!p.success) return badInput();
    const { id, is_focus, subtasks, ...rest } = p.data;
    const updates: Database["public"]["Tables"]["tasks"]["Update"] = {
      ...rest,
    };
    if (subtasks) {
      updates.subtasks = subtasks.map((s) => ({
        id: s.id ?? crypto.randomUUID(),
        title: s.title,
        done: s.done ?? false,
      }));
    }
    if (
      rest.project_id &&
      !(await isOwnedBy(supabase, "projects", rest.project_id, userId))
    )
      return notOwned("Project");

    if (is_focus === true) {
      const { data: current } = await supabase
        .from("tasks")
        .select("due_date")
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!current) return { success: false, message: "Task not found" };
      const effectiveDueDate =
        rest.due_date !== undefined ? rest.due_date : current.due_date;
      if (effectiveDueDate && effectiveDueDate > today)
        return {
          success: false,
          message: "Can only focus on tasks due today or with no due date",
        };
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_focus", true)
        .eq("focus_date", today)
        .is("deleted_at", null);
      if ((count ?? 0) >= 3)
        return {
          success: false,
          message: "You can only focus on 3 tasks a day",
        };
      updates.is_focus = true;
      updates.focus_date = today;
    } else if (is_focus === false) {
      updates.is_focus = false;
      updates.focus_date = null;
    }

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
  },
} satisfies ToolHandlers;
