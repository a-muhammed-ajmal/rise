"use client";

import { createContext, useContext } from "react";

import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";

/**
 * One tasks fetch and one projects fetch for the whole dashboard.
 *
 * `FocusTasksSection` and `TasksDashboardSection` render the same two datasets
 * — today's tasks and the active projects — and each used to call `useTasks`
 * and `useProjects` for itself. That meant four identical queries and four
 * Supabase Realtime channels on the landing route, and every `tasks` change
 * fanned out into two full refetches instead of one. Sharing a single hook
 * instance here halves both, and keeps the two sections showing the same rows
 * at the same moment rather than converging a network hop apart.
 *
 * Scope is deliberately the dashboard only — this is hook composition for one
 * page, not app-wide state.
 */
type TodayData = {
  tasks: ReturnType<typeof useTasks>;
  projects: ReturnType<typeof useProjects>;
};

const TodayDataContext = createContext<TodayData | null>(null);

export function TodayDataProvider({ children }: { children: React.ReactNode }) {
  const tasks = useTasks("today");
  const projects = useProjects();

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
