import { format, parseISO, subDays } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { addDaysISO, currentHourDubai, todayDOW, todayISO } from "@/lib/format";
import { STREAK_WINDOW_DAYS } from "@/lib/wellness/streak";
import { takeSnapshot } from "@/lib/data/snapshot";
import { loadProjects, loadTasks } from "@/lib/data/tasks";
import { loadHomeMoney } from "@/lib/data/home";
import { HomeView } from "./home-view";

// Loads the first screen of Home and hands it to HomeView. Six reads run in
// parallel: habits (then their logs), goals, contacts to follow up, today's
// tasks and the active projects (shared by Focus, Today's Tasks and the Tasks
// tile), and the money figures (net worth + needs attention).
export default async function HomePage() {
  const supabase = await createClient();
  const today = todayISO();

  // Habits first, then only their logs: today's marks plus enough history for
  // the streaks (lib/wellness/streak.ts).
  const loadHabits = async () => {
    const { data: habits } = await supabase
      .from("habits")
      .select("*")
      .is("deleted_at", null)
      .eq("active", true)
      .contains("target_days", [todayDOW()])
      .order("reminder_time", { ascending: true, nullsFirst: false });
    const due = habits ?? [];
    if (due.length === 0) return { habits: due, logs: [] };
    const { data: logs } = await supabase
      .from("habit_logs")
      .select("habit_id, completed, logged_date")
      .is("deleted_at", null)
      .in(
        "habit_id",
        due.map((h) => h.id),
      )
      .gte("logged_date", addDaysISO(today, -STREAK_WINDOW_DAYS))
      .lte("logged_date", today);
    return { habits: due, logs: logs ?? [] };
  };

  const [
    { habits, logs },
    { data: goals },
    { data: followUps },
    tasks,
    projects,
    money,
  ] = await Promise.all([
    loadHabits(),
    // Nearest target date first: the goals that need attention soonest.
    supabase
      .from("goals")
      .select("*")
      .is("deleted_at", null)
      .eq("status", "active")
      .order("target_date", { ascending: true, nullsFirst: false })
      .order("progress", { ascending: false })
      .limit(3),
    supabase
      .from("contacts")
      .select("id, name, email, phone, company, stage, last_contacted_at")
      .is("deleted_at", null)
      .neq("type", "personal")
      .or(
        `last_contacted_at.is.null,last_contacted_at.lte.${format(subDays(parseISO(today), 14), "yyyy-MM-dd")}`,
      )
      .order("last_contacted_at", { ascending: true, nullsFirst: true })
      .limit(3),
    takeSnapshot("home/tasks", async () => ({
      filter: "today" as const,
      projectId: null,
      tasks: await loadTasks(supabase, "today", today),
    })),
    takeSnapshot("home/projects", () => loadProjects(supabase)),
    takeSnapshot("home/money", () => loadHomeMoney(supabase, today)),
  ]);

  const hour = currentHourDubai();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <HomeView
      today={today}
      greeting={greeting}
      dayName={format(parseISO(today), "EEEE, dd MMMM yyyy")}
      habits={habits}
      habitLogs={logs}
      goals={goals ?? []}
      followUps={followUps ?? []}
      tasks={tasks}
      projects={projects}
      money={money}
    />
  );
}
