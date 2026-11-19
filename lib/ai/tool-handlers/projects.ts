// Projects.
//
// Every query filters by user_id itself: the MCP path runs these handlers
// with a service-role client that bypasses RLS.
import { z } from "zod";
import { dbErr, badInput, isOwnedBy, notOwned, softDeleteRecord, type ToolHandlers } from "./shared";
import { taskAreas, uuid } from "./schemas";

// Projects
const projectCategory = z.enum(taskAreas);

const CreateProjectInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().max(20).optional(),
  category: projectCategory.optional(),
  goal_id: uuid.optional().nullable(),
});

const UpdateProjectInput = z.object({
  id: uuid,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().max(20).optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  category: projectCategory.optional(),
  goal_id: uuid.optional().nullable(),
});

const DeleteProjectInput = z.object({
  project_id: uuid,
  project_name: z.string().optional(),
});

export const projectHandlers = {
  list_projects: async ({ supabase, userId }) => {
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
  },

  create_project: async ({ input, supabase, userId }) => {
    const p = CreateProjectInput.safeParse(input);
    if (!p.success) return badInput();
    if (
      p.data.goal_id &&
      !(await isOwnedBy(supabase, "goals", p.data.goal_id, userId))
    )
      return notOwned("Goal");
    const { error, data } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        name: p.data.name,
        description: p.data.description ?? null,
        color: p.data.color ?? "#6366f1",
        status: "active",
        category: p.data.category ?? "default",
        goal_id: p.data.goal_id ?? null,
      })
      .select()
      .single();
    if (error) return dbErr("create_project", error);
    return {
      success: true,
      message: `Created project: "${p.data.name}"`,
      data,
    };
  },

  update_project: async ({ input, supabase, userId }) => {
    const p = UpdateProjectInput.safeParse(input);
    if (!p.success) return badInput();
    const { id, ...updates } = p.data;
    if (
      updates.goal_id &&
      !(await isOwnedBy(supabase, "goals", updates.goal_id, userId))
    )
      return notOwned("Goal");
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
  },

  delete_project: async ({ input, supabase, userId }) => {
    const p = DeleteProjectInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "project",
      p.data.project_id,
      userId,
      "delete_project",
    );
  },
} satisfies ToolHandlers;
