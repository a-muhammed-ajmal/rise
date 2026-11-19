// Goals and their milestones.
//
// Every query filters by user_id itself: the MCP path runs these handlers
// with a service-role client that bypasses RLS.
import { z } from "zod";
import { dbErr, badInput, isOwnedBy, notOwned, softDeleteRecord, type ToolHandlers } from "./shared";
import { dateStr, uuid, ByIdInput } from "./schemas";

const CreateGoalInput = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  category: z
    .enum(["personal", "professional", "health", "financial", "other"])
    .optional(),
  target_date: dateStr.optional().nullable(),
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
  goal_id: uuid.optional(),
});

const DeleteMilestoneInput = z.object({
  milestone_id: uuid,
  milestone_title: z.string().optional(),
});

export const goalHandlers = {
  create_goal: async ({ input, supabase, userId }) => {
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
  },

  list_goals: async ({ input, supabase, userId }) => {
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
  },

  update_goal: async ({ input, supabase, userId }) => {
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
  },

  complete_goal: async ({ input, supabase, userId }) => {
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
  },

  delete_goal: async ({ input, supabase, userId }) => {
    const p = DeleteGoalInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "goal",
      p.data.goal_id,
      userId,
      "delete_goal",
    );
  },

  create_milestone: async ({ input, supabase, userId }) => {
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
  },

  list_milestones: async ({ input, supabase, userId }) => {
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
  },

  update_milestone: async ({ input, supabase, userId }) => {
    const p = UpdateMilestoneInput.safeParse(input);
    if (!p.success) return badInput();
    const { id, ...updates } = p.data;
    if (
      updates.goal_id &&
      !(await isOwnedBy(supabase, "goals", updates.goal_id, userId))
    )
      return notOwned("Goal");
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
  },

  complete_milestone: async ({ input, supabase, userId }) => {
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
  },

  reopen_milestone: async ({ input, supabase, userId }) => {
    const p = ByIdInput.safeParse(input);
    if (!p.success) return badInput();
    const { error, data } = await supabase
      .from("milestones")
      .update({ completed_at: null })
      .eq("id", p.data.id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("title")
      .single();
    if (error) return dbErr("reopen_milestone", error);
    return { success: true, message: `Reopened milestone: "${data?.title}"` };
  },

  delete_milestone: async ({ input, supabase, userId }) => {
    const p = DeleteMilestoneInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "milestone",
      p.data.milestone_id,
      userId,
      "delete_milestone",
    );
  },
} satisfies ToolHandlers;
