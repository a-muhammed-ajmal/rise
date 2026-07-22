"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { CheckSquare, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskCard } from "@/components/productivity/task-card";
import { TaskPopup } from "@/components/productivity/task-popup";

import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { todayISO } from "@/lib/format";

import { toast } from "sonner";
import type { Task } from "@/lib/types/database";

const VISIBLE_COUNT = 5;

export function TasksDashboardSection() {
  const {
    tasks,
    loading,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    duplicateTask,
    refresh,
  } = useTasks("today");

  const { projects } = useProjects();
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);

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

  const getTaskCardProps = useCallback(
    (task: Task) => ({
      task,
      onComplete: completeTask,
      onUpdate: updateTask,
      onDelete: deleteTask,
      onDuplicate: duplicateTask,
      onOpenDetail: openDetail,
      showMenu: false,
    }),
    [completeTask, updateTask, deleteTask, duplicateTask, openDetail],
  );

  const regularTasks = useMemo(() => {
    const today = todayISO();
    return safeTasks.filter((task) => !(task.is_focus && task.focus_date === today));
  }, [safeTasks]);

  const visibleRegularTasks = regularTasks.slice(0, VISIBLE_COUNT);
  const remainingTasks = Math.max(0, regularTasks.length - visibleRegularTasks.length);

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
    <Card className="slide-up stagger-3 border-t-4 border-t-mod-tasks" aria-label="Today's tasks">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md bg-mod-tasks-tint"
            aria-hidden="true"
          >
            <CheckSquare className="h-3.5 w-3.5 text-mod-tasks" aria-hidden="true" />
          </div>
          Today&apos;s Tasks
        </CardTitle>

        <Link
          href="/productivity"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          View all
        </Link>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-mod-tasks" aria-hidden="true" />
              <span className="sr-only">Loading tasks</span>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          </div>
        ) : regularTasks.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">No tasks due today.</p>
          </div>
        ) : (
          <section className="space-y-2">
            {visibleRegularTasks.map((task) => (
              <TaskCard key={task.id} {...getTaskCardProps(task)} view="list" />
            ))}

            {remainingTasks > 0 && (
              <Link
                href="/productivity"
                className="block pt-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                +{remainingTasks} more task{remainingTasks === 1 ? "" : "s"}
              </Link>
            )}
          </section>
        )}
      </CardContent>

      {detailTask && (
        <TaskPopup
          task={detailTask}
          projects={projects}
          defaultProjectId={null}
          onClose={() => setDetailTaskId(null)}
          onCreate={handleCreateTask}
          refresh={refresh}
        />
      )}
    </Card>
  );
}

export default TasksDashboardSection;
