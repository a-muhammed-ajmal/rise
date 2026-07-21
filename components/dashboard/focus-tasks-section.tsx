"use client";

import { useCallback, useMemo, useState } from "react";
import { Target, Loader2 } from "lucide-react";

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
  const { tasks, loading, createTask, completeTask } = useTasks("today");
  const { projects } = useProjects();
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);

  const focusTasks = useMemo(() => {
    const today = todayISO();
    return safeTasks
      .filter((task) => task.is_focus && task.focus_date === today)
      .slice(0, MAX_FOCUS_TASKS);
  }, [safeTasks]);

  const detailTask = useMemo(
    () =>
      detailTaskId
        ? safeTasks.find((task) => task.id === detailTaskId) ?? null
        : null,
    [detailTaskId, safeTasks],
  );

  const openDetail = useCallback((task: Task) => {
    setDetailTaskId(task.id);
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
    <Card className="slide-up stagger-1 border-t-4 border-t-mod-tasks" aria-label="Today's focus">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md bg-mod-tasks-tint"
            aria-hidden="true"
          >
            <Target className="h-3.5 w-3.5 text-mod-tasks" aria-hidden="true" />
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
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              No focus tasks yet. Open a task and tap the star to focus up to 3 for today.
            </p>
          </div>
        ) : (
          focusTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={completeTask}
              onOpenDetail={openDetail}
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
          onClose={() => setDetailTaskId(null)}
          onCreate={handleCreateTask}
        />
      )}
    </Card>
  );
}

export default FocusTasksSection;
