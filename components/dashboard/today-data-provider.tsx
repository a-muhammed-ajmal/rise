"use client";

import { createContext, useContext } from "react";

import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import type { ServerSnapshot } from "@/lib/data/snapshot";
import type { TaskSnapshotData } from "@/lib/data/tasks";
import type { Project } from "@/lib/types/database";

/**
 * One tasks fetch and one projects fetch for the whole dashboard.
 *
 * The Tasks stat tile, `FocusTasksSection` and `TasksDashboardSection` all
 * render the same two datasets — today's tasks and the active projects. Sharing
 * a single hook instance here means one query and one Supabase Realtime channel
 * each, and keeps the three showing the same rows at the same moment, so the
 * tile's count always matches the list under it.
 *
 * The server page passes its own snapshot of both, so the sections arrive
 * filled in instead of showing a spinner while the browser fetches.
 *
 * Scope is deliberately the dashboard only — this is hook composition for one
 * page, not app-wide state.
 */
type TodayData = {
  tasks: ReturnType<typeof useTasks>;
  projects: ReturnType<typeof useProjects>;
};

const TodayDataContext = createContext<TodayData | null>(null);

export type TodayDataInitial = {
  tasks?: ServerSnapshot<TaskSnapshotData> | null;
  projects?: ServerSnapshot<Project[]> | null;
};

export function TodayDataProvider({
  initial,
  children,
}: {
  initial?: TodayDataInitial;
  children: React.ReactNode;
}) {
  const tasks = useTasks("today", undefined, initial?.tasks);
  const projects = useProjects(initial?.projects);

  return (
    <TodayDataContext.Provider value={{ tasks, projects }}>
      {children}
    </TodayDataContext.Provider>
  );
}

export function useTodayData(): TodayData {
  const ctx = useContext(TodayDataContext);
  if (!ctx)
    throw new Error("useTodayData must be used inside TodayDataProvider");
  return ctx;
}
