import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { loadProjects, loadTasks } from "@/lib/data/tasks";
import { takeSnapshot } from "@/lib/data/snapshot";
import { ProjectsView } from "./projects-view";

// The view opens with no project selected, which lists every open task.
export default async function ProjectsPage() {
  const supabase = await createClient();
  const [projects, tasks] = await Promise.all([
    takeSnapshot("projects", () => loadProjects(supabase)),
    takeSnapshot("projects/tasks", async () => ({
      filter: "all" as const,
      projectId: null,
      tasks: await loadTasks(supabase, "all", todayISO()),
    })),
  ]);
  return <ProjectsView initial={{ projects, tasks }} />;
}
