"use client";

import { useState, useMemo, useEffect } from "react";
import { todayISO } from "@/lib/format";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { TaskCard } from "@/components/productivity/task-card";
import { TaskPopup } from "@/components/productivity/task-popup";
import { TaskToolbar } from "@/components/productivity/task-toolbar";
import { TaskCalendar } from "@/components/productivity/task-calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Inbox,
  List,
  Loader2,
  Star,
  CheckCircle2,
  LayoutGrid,
  Calendar,
  SlidersHorizontal,
  CheckSquare,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Project, Task } from "@/lib/types/database";

type Filter = "today" | "all" | "completed";
type ViewMode = "list" | "grid" | "calendar";
type SortBy = "priority" | "due_date" | "created_at" | "title" | "estimated";
type GroupBy = "none" | "priority" | "project" | "status" | "tag";

const PRIORITY_ORDER: Record<Task["priority"], number> = {
  P1: 0, P2: 1, P3: 2, P4: 3,
};
const STATUS_LABEL: Record<string, string> = {
  todo: "To Do", in_progress: "In Progress", blocked: "Blocked", on_hold: "On Hold", done: "Done",
};

const SORT_LABELS: Record<SortBy, string> = {
  priority: "Priority",
  due_date: "Due Time",
  created_at: "Created",
  title: "Title A–Z",
  estimated: "Duration",
};
const GROUP_LABELS: Record<GroupBy, string> = {
  none: "None",
  priority: "Priority",
  project: "Project",
  status: "Status",
  tag: "Tag",
};

function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  return [...tasks].sort((a, b) => {
    switch (sortBy) {
      case "priority":
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      case "due_date": {
        // Group 0: has date + time  →  sort chronologically ascending
        // Group 1: has date only    →  sort by created_at desc (newest first)
        // Group 2: no date          →  sort by created_at desc (newest first, shown last)
        const aGroup = a.due_date && a.due_time ? 0 : a.due_date ? 1 : 2;
        const bGroup = b.due_date && b.due_time ? 0 : b.due_date ? 1 : 2;
        if (aGroup !== bGroup) return aGroup - bGroup;
        if (aGroup === 0) return `${a.due_date}T${a.due_time}`.localeCompare(`${b.due_date}T${b.due_time}`);
        return b.created_at.localeCompare(a.created_at);
      }
      case "created_at":
        return b.created_at.localeCompare(a.created_at);
      case "title":
        return a.title.localeCompare(b.title);
      case "estimated": {
        const ae = a.estimated_time ?? Infinity;
        const be = b.estimated_time ?? Infinity;
        return ae - be;
      }
      default: return 0;
    }
  });
}

function groupTasks(
  tasks: Task[],
  groupBy: GroupBy,
  projects: Project[]
): Array<{ key: string; label: string; tasks: Task[] }> {
  if (groupBy === "none") return [{ key: "all", label: "", tasks }];

  const groups = new Map<string, Task[]>();
  tasks.forEach((task) => {
    let key = "";
    switch (groupBy) {
      case "priority": key = task.priority; break;
      case "status":   key = task.status;   break;
      case "project":  key = task.project_id ?? "__none__"; break;
      case "tag":      key = task.labels?.[0] ?? "__none__"; break;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(task);
  });

  return Array.from(groups.entries())
    .map(([key, tasks]) => {
      let label = key;
      if (groupBy === "priority") label = `${key} – ${key === "P1" ? "Urgent" : key === "P2" ? "High" : key === "P3" ? "Medium" : "Low"}`;
      if (groupBy === "status") label = STATUS_LABEL[key] ?? key;
      if (groupBy === "project") {
        label = key === "__none__" ? "No Project" : (projects.find((p) => p.id === key)?.name ?? "Unknown Project");
      }
      if (groupBy === "tag") label = key === "__none__" ? "No Tag" : `#${key}`;
      return { key, label, tasks };
    })
    .sort((a, b) => {
      if (groupBy === "priority") return PRIORITY_ORDER[a.key as Task["priority"]] - PRIORITY_ORDER[b.key as Task["priority"]];
      return a.label.localeCompare(b.label);
    });
}

export default function ProductivityPage() {
  const [filter, setFilter] = useState<Filter>("today");
  const [view, setView] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortBy>("due_date");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const [creatingTask, setCreatingTask] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [completedFocusCount, setCompletedFocusCount] = useState(0);

  const {
    tasks, loading, createTask, updateTask, completeTask, deleteTask,
    duplicateTask, bulkComplete, bulkDelete, bulkUpdatePriority, starTask, refresh,
  } = useTasks(filter === "completed" ? "completed" : filter);

  const { projects } = useProjects();

  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null),
    [detailTaskId, tasks]
  );

  const processedTasks = useMemo(() => sortTasks(tasks, sortBy), [tasks, sortBy]);

  const groups = useMemo(
    () => groupTasks(processedTasks, groupBy, projects),
    [processedTasks, groupBy, projects]
  );

  // Today's focus section
  const starredTodayTasks = useMemo(
    () => filter === "today"
      ? tasks.filter((t) => t.is_focus && t.focus_date === todayISO()).slice(0, 3)
      : [],
    [tasks, filter]
  );
  const starredIds = useMemo(() => new Set(starredTodayTasks.map((t) => t.id)), [starredTodayTasks]);
  const regularTodayTasks = useMemo(
    () => filter === "today" ? processedTasks.filter((t) => !starredIds.has(t.id)) : processedTasks,
    [processedTasks, starredIds, filter]
  );

  // Completed focus count (for progress bar)
  useEffect(() => {
    if (filter !== "today") return;
    const supabase = createClient();
    const today = todayISO();
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "done")
      .eq("is_focus", true)
      .eq("focus_date", today)
      .gte("completed_at", `${today}T00:00:00`)
      .then(({ count }) => setCompletedFocusCount(count ?? 0));
  }, [filter, tasks]);

  // ── Bulk helpers ───────────────────────────────────────────────────────────
  function toggleBulkMode() {
    setBulkMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelectTask(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkComplete() {
    const count = selectedIds.size;
    await bulkComplete(Array.from(selectedIds));
    setSelectedIds(new Set());
    toast.success(`${count} task${count !== 1 ? "s" : ""} completed`);
  }

  async function handleBulkDelete() {
    const count = selectedIds.size;
    await bulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    toast.success(`${count} task${count !== 1 ? "s" : ""} deleted`);
  }

  async function handleBulkPriority(p: Task["priority"]) {
    await bulkUpdatePriority(Array.from(selectedIds), p);
    setSelectedIds(new Set());
    toast.success("Priority updated");
  }

  function commonCardProps(task: Task) {
    return {
      task,
      onComplete: completeTask,
      onUpdate: updateTask,
      onDelete: deleteTask,
      onDuplicate: duplicateTask,
      onStar: starTask,
      onOpenDetail: (t: Task) => setDetailTaskId(t.id),
      bulkMode,
      selected: selectedIds.has(task.id),
      onToggleSelect: toggleSelectTask,
    };
  }

  // ── Derived state for toolbar ──────────────────────────────────────────────
  const hasActiveFilters = sortBy !== "priority" || groupBy !== "none";

  // ── Task list renderer ─────────────────────────────────────────────────────
  function renderTaskGroup(groupedTasks: Task[]) {
    if (view === "grid") {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {groupedTasks.map((task) => (
            <TaskCard key={task.id} {...commonCardProps(task)} view="grid" />
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {groupedTasks.map((task) => (
          <TaskCard key={task.id} {...commonCardProps(task)} view="list" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-3 md:p-5 max-w-2xl space-y-3">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between slide-up stagger-1">
        <h1 className="text-h1 font-heading tracking-tight flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-mod-tasks-tint flex items-center justify-center">
            <Inbox className="w-4 h-4 text-mod-tasks" />
          </div>
          Tasks
        </h1>
        <Button onClick={() => setCreatingTask(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" aria-hidden="true" />
          New
        </Button>
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────── */}
      <div className="slide-up stagger-2">
        <Tabs
          value={filter}
          onValueChange={(v) => {
            setFilter(v as Filter);
            setBulkMode(false);
            setSelectedIds(new Set());
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="today" className="flex-1 gap-1.5">
              <Star className="w-3.5 h-3.5" aria-hidden="true" /> Today
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1 gap-1.5">
              <List className="w-3.5 h-3.5" aria-hidden="true" /> All
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1 gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Done
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Compact toolbar ────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center gap-2 slide-up stagger-2">
          {/* View mode — 3 icon buttons */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden shrink-0">
            {([
              { mode: "list" as ViewMode,     icon: <List className="w-3.5 h-3.5" />,       label: "List view" },
              { mode: "grid" as ViewMode,     icon: <LayoutGrid className="w-3.5 h-3.5" />, label: "Grid view" },
              { mode: "calendar" as ViewMode, icon: <Calendar className="w-3.5 h-3.5" />,   label: "Calendar view" },
            ]).map(({ mode, icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={cn(
                  "p-2 transition-colors",
                  view === mode ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
                )}
                aria-label={label}
                aria-pressed={view === mode}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Sort + Group combined dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border transition-colors font-medium",
                hasActiveFilters
                  ? "border-[var(--brand)]/50 bg-[var(--brand-tint)] text-[var(--brand-text)]"
                  : "border-border bg-background hover:bg-accent text-foreground"
              )}
              aria-label="Sort and group options"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden md:inline">Sort</span>
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] md:hidden" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
                {(Object.entries(SORT_LABELS) as [SortBy, string][]).map(([val, label]) => (
                  <DropdownMenuItem
                    key={val}
                    onClick={() => setSortBy(val)}
                    className={cn("text-xs", sortBy === val && "font-semibold")}
                  >
                    {label}
                    {sortBy === val && <span className="ml-auto text-[var(--brand)]">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs">Group by</DropdownMenuLabel>
                {(Object.entries(GROUP_LABELS) as [GroupBy, string][]).map(([val, label]) => (
                  <DropdownMenuItem
                    key={val}
                    onClick={() => setGroupBy(val)}
                    className={cn("text-xs", groupBy === val && "font-semibold")}
                  >
                    {label}
                    {groupBy === val && <span className="ml-auto text-[var(--brand)]">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bulk select toggle — pushed to the right */}
          <button
            type="button"
            onClick={toggleBulkMode}
            className={cn(
              "ml-auto inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border transition-colors font-medium",
              bulkMode
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-accent text-foreground"
            )}
            aria-pressed={bulkMode}
          >
            <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden md:inline">{bulkMode ? "Done" : "Select"}</span>
          </button>
        </div>
      )}

      {/* ── Active filter chips ─────────────────────────────────────── */}
      {!loading && hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 slide-up">
          {sortBy !== "priority" && (
            <button
              type="button"
              onClick={() => setSortBy("priority")}
              className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold
                         bg-[var(--mod-tasks-tint)] text-[var(--mod-tasks)]
                         border border-[var(--mod-tasks)]/20 hover:opacity-80 transition-opacity"
              aria-label={`Clear sort: ${SORT_LABELS[sortBy]}`}
            >
              Sort: {SORT_LABELS[sortBy]}
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
          {groupBy !== "none" && (
            <button
              type="button"
              onClick={() => setGroupBy("none")}
              className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold
                         bg-[var(--mod-tasks-tint)] text-[var(--mod-tasks)]
                         border border-[var(--mod-tasks)]/20 hover:opacity-80 transition-opacity"
              aria-label={`Clear group: ${GROUP_LABELS[groupBy]}`}
            >
              Group: {GROUP_LABELS[groupBy]}
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* ── Task content ────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-mod-tasks" aria-hidden="true" />
          <span className="sr-only">Loading tasks</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 space-y-2 slide-up">
          <div className="w-16 h-16 rounded-2xl bg-mod-tasks-tint flex items-center justify-center mx-auto mb-3">
            {filter === "completed" ? (
              <CheckCircle2 className="w-8 h-8 text-mod-tasks" />
            ) : (
              <Inbox className="w-8 h-8 text-mod-tasks" />
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {filter === "today" ? "Nothing due today — all clear!" :
             filter === "completed" ? "No completed tasks yet." :
             "No active tasks."}
          </p>
          {filter !== "completed" && (
            <Button variant="ghost" size="sm" onClick={() => setCreatingTask(true)}>
              Add a task
            </Button>
          )}
        </div>
      ) : view === "calendar" ? (
        <div className="slide-up stagger-3">
          <TaskCalendar
            tasks={processedTasks}
            onComplete={completeTask}
            onUpdate={updateTask}
            onDelete={deleteTask}
            onDuplicate={duplicateTask}
            onStar={starTask}
            onOpenDetail={(t) => setDetailTaskId(t.id)}
          />
        </div>
      ) : (
        <div className="slide-up stagger-3 space-y-4">
          {/* Today's Focus section */}
          {filter === "today" && starredTodayTasks.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 fill-[var(--color-warning)] text-[var(--color-warning)]" aria-hidden="true" />
                    <span className="text-xs font-semibold text-[var(--color-warning)] uppercase tracking-wide">Focus</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {completedFocusCount}/{starredTodayTasks.length + completedFocusCount} done
                  </span>
                </div>
                <Progress
                  value={starredTodayTasks.length + completedFocusCount > 0
                    ? (completedFocusCount / (starredTodayTasks.length + completedFocusCount)) * 100
                    : 0}
                  className="h-1.5"
                />
              </div>

              {view === "grid" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {starredTodayTasks.map((task) => (
                    <TaskCard key={task.id} {...commonCardProps(task)} view="grid" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {starredTodayTasks.map((task) => (
                    <TaskCard key={task.id} {...commonCardProps(task)} view="list" />
                  ))}
                </div>
              )}

              {regularTodayTasks.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">Other tasks</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
            </div>
          )}

          {/* Grouped tasks */}
          {(filter === "today"
            ? groups.map((g) => ({ ...g, tasks: g.tasks.filter((t) => !starredIds.has(t.id)) })).filter((g) => g.tasks.length > 0)
            : groups
          ).map((group) => (
            <div key={group.key} className="space-y-2">
              {groupBy !== "none" && (
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </h3>
                  <Badge variant="outline" className="text-xs h-4 px-1.5">
                    {group.tasks.length}
                  </Badge>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              {renderTaskGroup(group.tasks)}
            </div>
          ))}

          <p className="text-xs text-center text-muted-foreground pt-2">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* ── Mobile FAB — hidden during bulk mode ────────────────────── */}
      {!bulkMode && (
        <button
          type="button"
          onClick={() => setCreatingTask(true)}
          className="fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-brand text-white shadow-brand transition-all hover:bg-brand-hover active:scale-95 flex items-center justify-center z-40"
          aria-label="Add task"
        >
          <Plus className="w-6 h-6" aria-hidden="true" />
        </button>
      )}

      {/* ── Bulk action floating toolbar ────────────────────────────── */}
      <TaskToolbar
        selectedCount={selectedIds.size}
        totalCount={tasks.length}
        onSelectAll={() => setSelectedIds(new Set(tasks.map((t) => t.id)))}
        onComplete={handleBulkComplete}
        onDelete={handleBulkDelete}
        onSetPriority={handleBulkPriority}
        onClearSelection={() => { setSelectedIds(new Set()); setBulkMode(false); }}
      />

      {/* ── Task popup ──────────────────────────────────────────────── */}
      {(detailTask || creatingTask) && (
        <TaskPopup
          task={detailTask}
          projects={projects}
          defaultProjectId={null}
          onClose={() => { setDetailTaskId(null); setCreatingTask(false); }}
          onCreate={async (data) => {
            await createTask({ ...data, project_id: data.project_id ?? null });
            toast.success("Task added");
          }}
          refresh={refresh}
        />
      )}
    </div>
  );
}
