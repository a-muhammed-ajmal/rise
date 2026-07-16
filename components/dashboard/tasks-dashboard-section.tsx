"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckSquare, Star, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskCard } from "@/components/productivity/task-card";
import { TaskPopup } from "@/components/productivity/task-popup";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
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
  } = useTasks("today");
  const { projects } = useProjects();

  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null),
    [detailTaskId, tasks],
  );

  const commonCardProps = (task: Task) => ({
    task,
    onComplete: completeTask,
    onUpdate: updateTask,
    onDelete: deleteTask,
    onDuplicate: duplicateTask,
    onOpenDetail: (t: Task) => setDetailTaskId(t.id),
    showMenu: false,
  });

  const starredTasks = tasks.filter((t) => t.is_starred);
  const regularTasks = tasks
    .filter((t) => !t.is_starred)
    .slice(0, VISIBLE_COUNT);

  return (
    <Card className="slide-up stagger-3 border-t-4 border-t-mod-tasks">
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-mod-tasks-tint flex items-center justify-center">
            <CheckSquare className="w-3.5 h-3.5 text-mod-tasks" />
          </div>
          Today&apos;s Tasks
        </CardTitle>
        <Link
          href="/productivity"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-mod-tasks" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks due today.</p>
        ) : (
          <>
            {/* Focus: starred tasks */}
            {starredTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star
                    className="w-3.5 h-3.5 fill-[var(--color-warning)] text-[var(--color-warning)]"
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold text-[var(--color-warning)] uppercase tracking-wide">
                    Focus
                  </span>
                </div>
                {starredTasks.map((task) => (
                  <TaskCard key={task.id} {...commonCardProps(task)} view="list" />
                ))}
                {regularTasks.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">Other tasks</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
              </div>
            )}

            {/* Regular tasks */}
            {regularTasks.map((task) => (
              <TaskCard key={task.id} {...commonCardProps(task)} view="list" />
            ))}
          </>
        )}
      </CardContent>

      {detailTask && (
        <TaskPopup
          task={detailTask}
          projects={projects}
          defaultProjectId={null}
          onClose={() => setDetailTaskId(null)}
          onCreate={async (data) => {
            await createTask(data);
            toast.success("Task added");
          }}
        />
      )}
    </Card>
  );
}
