"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertTriangle, CheckSquare, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskCard } from "@/components/productivity/task-card";

import { useTodayData } from "@/components/dashboard/today-data-provider";
import { todayISO } from "@/lib/format";
import { splitTodayTasks } from "@/lib/home";

import { toast } from "sonner";
import type { Task } from "@/lib/types/database";

// The detail popup is the single heaviest client component in the app and
// nothing on the dashboard shows it until a card is tapped, so it is fetched
// on demand instead of riding in the landing route's first-load JS.
const TaskPopup = dynamic(
  () => import("@/components/productivity/task-popup").then((m) => m.TaskPopup),
  { ssr: false },
);

const VISIBLE_COUNT = 5;

export function TasksDashboardSection() {
  const {
    tasks: {
      tasks,
      loading,
      createTask,
      updateTask,
      completeTask,
      deleteTask,
      duplicateTask,
      refresh,
    },
    projects: { projects },
  } = useTodayData();
  // Snapshot, not an id looked up in `tasks`: this section only queries today's
  // tasks, so rescheduling one would unmount the popup mid-save.
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const openDetail = useCallback((task: Task) => {
    setDetailTask(task);
  }, []);

  const getTaskCardProps = useCallback(
    (task: Task) => ({
      task,
      onComplete: completeTask,
      onUpdate: updateTask,
      onDelete: deleteTask,
      onDuplicate: duplicateTask,
      onOpenDetail: openDetail,
      projectName: task.project_id ? projectNameById.get(task.project_id) ?? null : null,
      showMenu: false,
    }),
    [completeTask, updateTask, deleteTask, duplicateTask, openDetail, projectNameById],
  );

  // Focus tasks have their own card; the rest split into Overdue, then Due
  // today. The visible cap spans both groups, overdue first.
  const { overdue, dueToday } = useMemo(() => {
    const today = todayISO();
    return splitTodayTasks(
      safeTasks.filter((task) => !(task.is_focus && task.focus_date === today)),
      today,
    );
  }, [safeTasks]);

  const visibleOverdue = overdue.slice(0, VISIBLE_COUNT);
  const visibleDueToday = dueToday.slice(0, VISIBLE_COUNT - visibleOverdue.length);
  const totalRegular = overdue.length + dueToday.length;
  const remainingTasks = totalRegular - visibleOverdue.length - visibleDueToday.length;

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
    <Card className="slide-up stagger-2" aria-label="Today's tasks">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
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
          className="inline-flex min-h-11 items-center text-label text-brand-text hover:underline active:opacity-80"
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
        ) : totalRegular === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">No tasks due today.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {overdue.length > 0 && (
              <section aria-labelledby="today-tasks-overdue" className="space-y-2">
                <h3
                  id="today-tasks-overdue"
                  className="flex items-center gap-1.5 text-label font-semibold text-destructive"
                >
                  <AlertTriangle className="size-3.5" aria-hidden="true" />
                  Overdue · {overdue.length}
                </h3>
                {visibleOverdue.map((task) => (
                  <TaskCard key={task.id} {...getTaskCardProps(task)} view="list" />
                ))}
              </section>
            )}

            {dueToday.length > 0 && visibleDueToday.length > 0 && (
              <section aria-labelledby="today-tasks-due" className="space-y-2">
                <h3 id="today-tasks-due" className="text-label font-semibold text-muted-foreground">
                  Due today · {dueToday.length}
                </h3>
                {visibleDueToday.map((task) => (
                  <TaskCard key={task.id} {...getTaskCardProps(task)} view="list" />
                ))}
              </section>
            )}

            {remainingTasks > 0 && (
              <Link
                href="/productivity"
                className="block pt-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                +{remainingTasks} more task{remainingTasks === 1 ? "" : "s"}
              </Link>
            )}
          </div>
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

export default TasksDashboardSection;
