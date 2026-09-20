"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Star, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskCard } from "@/components/productivity/task-card";
import { TaskPopup } from "@/components/productivity/task-popup";

import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { todayISO } from "@/lib/format";

import { toast } from "sonner";
import type { Task } from "@/lib/types/database";

const MAX_FOCUS_TASKS = 3;

export function FocusTasksSection() {
  const { tasks, loading, createTask, completeTask, refresh } = useTasks("today");
  const { projects } = useProjects();
  // Snapshot, not an id looked up in `tasks`: unfocusing or rescheduling a task
  // would drop it out of this section's list and unmount the popup mid-save.
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);

  const focusTasks = useMemo(() => {
    const today = todayISO();
    return safeTasks
      .filter((task) => task.is_focus && task.focus_date === today)
      .slice(0, MAX_FOCUS_TASKS);
  }, [safeTasks]);

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const openDetail = useCallback((task: Task) => {
    setDetailTask(task);
  }, []);

  const handleCreateTask = useCallback(
    async (data: Parameters<typeof createTask>[0]) => {
      try {
        await createTask(data);
        toast.success("Task added");
      } catch {
        toast.error("Failed to create task");
      }
    },
    [createTask],
  );

  return (
    <Card className="slide-up stagger-1" aria-label="Today's focus">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md bg-mod-tasks-tint"
            aria-hidden="true"
          >
            <Star className="h-3.5 w-3.5 text-mod-tasks" aria-hidden="true" />
          </div>
          Today&apos;s Focus
        </CardTitle>

        <span className="text-xs font-medium text-muted-foreground">
          {focusTasks.length}/{MAX_FOCUS_TASKS}
        </span>
      </CardHeader>

      <CardContent className="space-y-2">
        {loading ? (
          <div className="space-y-2" role="status" aria-live="polite" aria-busy="true">
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-mod-tasks" aria-hidden="true" />
              <span className="sr-only">Loading focus tasks</span>
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : focusTasks.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Choose up to 3 tasks to focus on today.
            </p>
            <Link href="/productivity" className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-input px-3 text-sm font-medium text-brand-text hover:bg-brand-tint active:scale-95">
              <Star className="size-4" aria-hidden="true" /> Choose focus tasks
            </Link>
          </div>
        ) : (
          focusTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={completeTask}
              onOpenDetail={openDetail}
              projectName={task.project_id ? projectNameById.get(task.project_id) ?? null : null}
              view="list"
            />
          ))
        )}
      </CardContent>

      {detailTask && (
        <TaskPopup
          task={detailTask}
          projects={projects}
          defaultProjectId={null}
          onClose={() => setDetailTask(null)}
          onCreate={handleCreateTask}
          refresh={refresh}
        />
      )}
    </Card>
  );
}

export default FocusTasksSection;
