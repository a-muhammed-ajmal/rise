// Wellness: habits, habit logs and focus sessions.
//
// Every query filters by user_id itself: the MCP path runs these handlers
// with a service-role client that bypasses RLS.
import { z } from "zod";
import { dbErr, badInput, isOwnedBy, notOwned, DEFAULT_PAGE_SIZE, pageOf, pagedResult, rangeFor, softDeleteRecord, type ToolHandlers } from "./shared";
import { dateStr, uuid, isoDatetime, ByIdInput, offsetInput } from "./schemas";

const LogHabitInput = z.object({
  habit_name: z.string().min(1).max(200),
  logged_date: dateStr.optional(),
  note: z.string().max(500).optional().nullable(),
  completed: z.boolean().optional(),
});

// Habits
const CreateHabitInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  frequency: z.enum(["daily", "weekly", "custom"]).optional(),
  target_days: z.array(z.number().int().min(0).max(6)).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(10).optional(),
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
  icon: z.string().max(10).optional(),
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

const UpdateHabitLogInput = z.object({
  id: uuid,
  logged_date: dateStr.optional(),
  note: z.string().max(500).optional().nullable(),
  completed: z.boolean().optional(),
});

const ListHabitLogsInput = z.object({
  habit_id: uuid.optional(),
  start_date: dateStr.optional(),
  end_date: dateStr.optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: offsetInput,
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
  started_at: isoDatetime.optional(),
  ended_at: isoDatetime.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  task_id: uuid.optional().nullable(),
});

const ListFocusSessionsInput = z.object({
  task_id: uuid.optional(),
  limit: z.number().int().positive().max(50).optional(),
});

export const wellnessHandlers = {
  log_habit: async ({ input, supabase, userId, today }) => {
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
        logged_date: p.data.logged_date ?? today,
        completed: p.data.completed ?? true,
        note: p.data.note ?? null,
        deleted_at: null,
      },
      { onConflict: "habit_id,logged_date" },
    );
    if (logError) return dbErr("log_habit", logError);
    return { success: true, message: `Logged habit: "${habit.name}"` };
  },

  list_habits: async ({ supabase, userId, today }) => {
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
  },

  create_habit: async ({ input, supabase, userId }) => {
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
        icon: p.data.icon ?? "⭐",
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
  },

  update_habit: async ({ input, supabase, userId }) => {
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
  },

  delete_habit: async ({ input, supabase, userId }) => {
    const p = DeleteHabitInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "habit",
      p.data.habit_id,
      userId,
      "delete_habit",
    );
  },

  // Addressed by (habit_id, logged_date) rather than by row id, so it
  // resolves the row first and then hands off to the shared soft delete.
  delete_habit_log: async ({ input, supabase, userId }) => {
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
  },

  update_habit_log: async ({ input, supabase, userId }) => {
    const p = UpdateHabitLogInput.safeParse(input);
    if (!p.success) return badInput();
    const { id, ...updates } = p.data;
    const { data: existing } = await supabase
      .from("habit_logs")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) return { success: false, message: "Habit log not found" };
    const { error } = await supabase
      .from("habit_logs")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) {
      if (error.code === "23505")
        return {
          success: false,
          message: "A log already exists for that date.",
        };
      return dbErr("update_habit_log", error);
    }
    return { success: true, message: "Habit log updated." };
  },

  list_habit_logs: async ({ input, supabase, userId }) => {
    const p = ListHabitLogsInput.safeParse(input);
    if (!p.success) return badInput();
    const limitVal = p.data.limit ?? DEFAULT_PAGE_SIZE;
    const offsetVal = p.data.offset ?? 0;
    let query = supabase
      .from("habit_logs")
      .select("id, habit_id, logged_date, completed, note")
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (p.data.habit_id) query = query.eq("habit_id", p.data.habit_id);
    if (p.data.start_date) query = query.gte("logged_date", p.data.start_date);
    if (p.data.end_date) query = query.lte("logged_date", p.data.end_date);
    const { data, error } = await query
      .order("logged_date", { ascending: false })
      .range(...rangeFor(limitVal, offsetVal));
    if (error) return dbErr("list_habit_logs", error);
    return pagedResult("habit logs", pageOf(data, limitVal, offsetVal));
  },

  list_focus_sessions: async ({ input, supabase, userId }) => {
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
  },

  create_focus_session: async ({ input, supabase, userId }) => {
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
  },

  update_focus_session: async ({ input, supabase, userId }) => {
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
  },

  delete_focus_session: async ({ input, supabase, userId }) => {
    const p = ByIdInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "focus_session",
      p.data.id,
      userId,
      "delete_focus_session",
    );
  },
} satisfies ToolHandlers;
