"use client";

import { useState } from "react";
import { useTasks } from "@/lib/hooks/use-tasks";
import { TaskCard } from "@/components/productivity/task-card";
import { TaskForm } from "@/components/productivity/task-form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Inbox, CalendarDays, List, Loader2 } from "lucide-react";

type Filter = "inbox" | "today" | "all";

export default function ProductivityPage() {
  const [filter, setFilter] = useState<Filter>("inbox");
  const [newOpen, setNewOpen] = useState(false);
  const { tasks, loading, createTask, updateTask, completeTask, deleteTask } =
    useTasks(filter);

  return (
    <div
      className="p-4 md:p-6 max-w-2xl space-y-4 page-glow"
      style={{ "--glow-color": "var(--mod-tasks)" } as React.CSSProperties}
    >
      <div className="flex items-center justify-between animate-rise-in stagger-1">
        <h1 className="text-step-2 font-heading font-bold tracking-tight flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-mod-tasks-soft flex items-center justify-center">
            <Inbox className="w-4 h-4 text-mod-tasks" />
          </div>
          Tasks
        </h1>
        <Button
          onClick={() => setNewOpen(true)}
          size="sm"
          className="gap-1.5 bg-mod-tasks hover:bg-mod-tasks/90 text-white"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </div>

      <div className="animate-rise-in stagger-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="w-full">
            <TabsTrigger value="inbox" className="flex-1 gap-1.5">
              <Inbox className="w-3.5 h-3.5" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="today" className="flex-1 gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              Today
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1 gap-1.5">
              <List className="w-3.5 h-3.5" />
              All
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-mod-tasks" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 space-y-2 animate-rise-in">
          <div className="w-16 h-16 rounded-2xl bg-mod-tasks-soft flex items-center justify-center mx-auto mb-3">
            <Inbox className="w-8 h-8 text-mod-tasks" />
          </div>
          <p className="text-muted-foreground text-sm">
            {filter === "inbox"
              ? "Your inbox is empty."
              : filter === "today"
                ? "Nothing due today!"
                : "No active tasks."}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setNewOpen(true)}>
            + Add a task
          </Button>
        </div>
      ) : (
        <div className="space-y-2 animate-rise-in stagger-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={completeTask}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          ))}
          <p className="text-xs text-center text-muted-foreground pt-2">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      <TaskForm
        open={newOpen}
        onOpenChange={setNewOpen}
        onSubmit={createTask}
      />

      {/* FAB for mobile */}
      <button
        onClick={() => setNewOpen(true)}
        className="fab fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-mod-tasks text-white flex items-center justify-center z-40"
        aria-label="Add task"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
