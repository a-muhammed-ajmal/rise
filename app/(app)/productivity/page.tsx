import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { countCompletedFocus, loadProjects, loadTasks } from "@/lib/data/tasks";
import { takeSnapshot } from "@/lib/data/snapshot";
import { ProductivityView } from "./productivity-view";

// The view opens on the Today tab, so that is the task list loaded here.
export default async function ProductivityPage() {
  const supabase = await createClient();
  const today = todayISO();
  const [tasks, projects, completedFocus] = await Promise.all([
    takeSnapshot("productivity/tasks", async () => ({
      filter: "today" as const,
      projectId: null,
      tasks: await loadTasks(supabase, "today", today),
    })),
    takeSnapshot("productivity/projects", () => loadProjects(supabase)),
    takeSnapshot("productivity/focus", () => countCompletedFocus(supabase, today)),
  ]);
  return <ProductivityView initial={{ tasks, projects, completedFocus }} />;
}
