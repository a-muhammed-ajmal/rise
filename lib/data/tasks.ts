import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Project, Task } from "@/lib/types/database";

// Task and project reads shared by the Productivity and Projects server pages
// (initial data) and the useTasks / useProjects hooks (refetch and Realtime).

export type TaskFilter = "today" | "all" | "project" | "completed";

export function hydrateTask(t: Database["public"]["Tables"]["tasks"]["Row"]): Task {
  return {
    ...t,
    is_completed: t.completed_at !== null && t.completed_at !== undefined,
    labels: Array.isArray(t.labels) ? t.labels : [],
    subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
    attachments: Array.isArray(t.attachments) ? t.attachments : [],
  };
}

/**
 * Tasks for one view. Sort: starred → due date → due time (nulls last) →
 * newest. "today" means due today or overdue; "project" without an id is every
 * open task.
 */
export async function loadTasks(
  supabase: SupabaseClient<Database>,
  filter: TaskFilter,
  today: string,
  projectId?: string,
): Promise<Task[]> {
  let query = supabase
    .from("tasks")
    .select("*")
    .is("deleted_at", null)
    .order("is_starred", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("due_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filter === "completed") {
    query = query.eq("status", "done");
  } else {
    query = query.neq("status", "done");
    if (filter === "today") {
      query = query.or(`due_date.eq.${today},due_date.lt.${today}`);
    } else if (filter === "project" && projectId) {
      query = query.eq("project_id", projectId);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(hydrateTask);
}

/** Active projects by name. */
export async function loadProjects(
  supabase: SupabaseClient<Database>,
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .is("deleted_at", null)
    .eq("status", "active")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Today's focus tasks already completed today — the focus progress bar. */
export async function countCompletedFocus(
  supabase: SupabaseClient<Database>,
  today: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "done")
    .eq("is_focus", true)
    .eq("focus_date", today)
    .gte("completed_at", `${today}T00:00:00`);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * The initial task snapshot records which view it answers, so a hook asked for
 * a different filter or project never mistakes it for its own data.
 */
export type TaskSnapshotData = {
  filter: TaskFilter;
  projectId: string | null;
  tasks: Task[];
};
