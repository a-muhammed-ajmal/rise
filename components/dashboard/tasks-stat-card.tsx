"use client";

import { useMemo } from "react";
import { CheckSquare } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { useTodayData } from "@/components/dashboard/today-data-provider";
import { todayISO } from "@/lib/format";
import { splitTodayTasks } from "@/lib/home";

/**
 * The Tasks summary tile. It reads the same live list as Today's Focus and
 * Today's Tasks (due today or overdue, not done), so its number is always the
 * number of rows below it, and completing a task updates it at once.
 */
export function TasksStatCard() {
  const {
    tasks: { tasks, loading },
  } = useTodayData();

  const { total, overdue } = useMemo(() => {
    const split = splitTodayTasks(tasks, todayISO());
    return { total: tasks.length, overdue: split.overdue.length };
  }, [tasks]);

  return (
    <StatCard
      href="/productivity"
      label="Tasks"
      icon={CheckSquare}
      accent="tasks"
      value={loading ? "—" : String(total)}
      context={
        loading ? "Loading" : overdue > 0 ? `${overdue} overdue` : "all clear"
      }
      contextTone={!loading && overdue > 0 ? "danger" : "muted"}
    />
  );
}
