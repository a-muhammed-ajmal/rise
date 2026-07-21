"use client";

import { useState, useMemo, useEffect } from "react";
import { todayISO } from "@/lib/format";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { TaskCard } from "@/components/productivity/task-card";
import { TaskPopup } from "@/components/productivity/task-popup";
import { TaskToolbar } from "@/components/productivity/task-toolbar";
import { TaskCalendar } from "@/components/productivity/task-calendar";
import { AddProjectDialog } from "@/components/productivity/add-project-dialog";
import { ProjectForm } from "@/components/productivity/project-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Plus,
  Inbox,
  List,
  Loader2,
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Pencil,
  Trash2,
  Star,
  CheckCircle2,
  LayoutGrid,
  Calendar,
  ArrowUpDown,
  Layers,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_COLOR_CLASS } from "@/components/productivity/task-constants";
import type { Project, Task } from "@/lib/types/database";

type Filter = "today" | "all" | "completed" | "projects";
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
  due_date: "Due Date",
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
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
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
        if (key === "__none__") label = "No Project";
        else label = projects.find((p) => p.id === key)?.name ?? "Unknown Project";
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
  const [sortBy, setSortBy] = useState<SortBy>("priority");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  // New project dialog
  const [addProjectOpen, setAddProjectOpen] = useState(false);

  // Single shared task popup — creatingTask = create mode, detailTaskId = edit/detail mode
  const [creatingTask, setCreatingTask] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Project edit / delete
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  // Today's Focus completed count
  const [completedFocusCount, setCompletedFocusCount] = useState(0);

  const hookFilter =
    filter === "projects" ? (selectedProject ? "project" : "all") :
    filter === "completed" ? "completed" : filter;

  const {
    tasks, loading, createTask, updateTask, completeTask, deleteTask,
    duplicateTask, bulkComplete, bulkDelete, bulkUpdatePriority, starTask,
  } = useTasks(hookFilter as Parameters<typeof useTasks>[0], selectedProject?.id);

  const {
    projects, loading: projectsLoading, createProject, updateProject, deleteProject,
  } = useProjects();

  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null),
    [detailTaskId, tasks]
  );

  // ── Sorting + grouping ──────────────────────────────────────────────────────

  const processedTasks = useMemo(() => sortTasks(tasks, sortBy), [tasks, sortBy]);

  const groups = useMemo(
    () => groupTasks(processedTasks, groupBy, projects),
    [processedTasks, groupBy, projects]
  );

  // ── Today: starred focus tasks ──────────────────────────────────────────────

  const starredTodayTasks = useMemo(
    () => filter === "today"
      ? tasks.filter((t) => t.is_focus && t.focus_date === todayISO()).slice(0, 3)
      : [],
    [tasks, filter]
  );
  const starredIds = useMemo(
    () => new Set(starredTodayTasks.map((t) => t.id)),
    [starredTodayTasks]
  );
  const regularTodayTasks = useMemo(
    () => filter === "today" ? processedTasks.filter((t) => !starredIds.has(t.id)) : processedTasks,
    [processedTasks, starredIds, filter]
  );

  // Refresh completed focus count when tasks change (realtime-driven)
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

  // ── Bulk helpers ────────────────────────────────────────────────────────────

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

  function selectAll() {
    setSelectedIds(new Set(tasks.map((t) => t.id)));
  }

  async function handleBulkComplete() {
    await bulkComplete(Array.from(selectedIds));
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} task(s) completed`);
  }

  async function handleBulkDelete() {
    await bulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} task(s) deleted`);
  }

  async function handleBulkPriority(p: Task["priority"]) {
    await bulkUpdatePriority(Array.from(selectedIds), p);
    setSelectedIds(new Set());
    toast.success("Priority updated");
  }

  async function handleDeleteProject() {
    if (!deleteProjectId) return;
    await deleteProject(deleteProjectId);
    if (selectedProject?.id === deleteProjectId) setSelectedProject(null);
    toast.success("Project deleted");
  }

  const showTaskList = filter !== "projects" || selectedProject !== null;

  // ── Shared card props ───────────────────────────────────────────────────────

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

  function openNewTask() {
    setCreatingTask(true);
  }

  function openNewProject() {
    setAddProjectOpen(true);
  }

  // ── Toolbar strip ───────────────────────────────────────────────────────────

  const toolbarStrip = showTaskList && (
    <div className="flex items-center gap-2 flex-wrap">
      {/* View mode */}
      <div className="flex items-center rounded-lg border border-border overflow-hidden">
        {([
          { mode: "list",     icon: <List className="w-3.5 h-3.5" /> },
          { mode: "grid",     icon: <LayoutGrid className="w-3.5 h-3.5" /> },
          { mode: "calendar", icon: <Calendar className="w-3.5 h-3.5" /> },
        ] as { mode: ViewMode; icon: React.ReactNode }[]).map(({ mode, icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => setView(mode)}
            className={cn(
              "p-1.5 transition-colors",
              view === mode ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
            )}
            aria-label={`${mode} view`}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border border-border bg-background hover:bg-accent transition-colors font-medium">
          <ArrowUpDown className="w-3.5 h-3.5" />
          Sort
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            {(Object.entries(SORT_LABELS) as [SortBy, string][]).map(([val, label]) => (
              <DropdownMenuItem
                key={val}
                onClick={() => setSortBy(val)}
                className={sortBy === val ? "font-semibold" : ""}
              >
                {label}
                {sortBy === val && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border border-border bg-background hover:bg-accent transition-colors font-medium">
          <Layers className="w-3.5 h-3.5" />
          Group
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Group by</DropdownMenuLabel>
            {(Object.entries(GROUP_LABELS) as [GroupBy, string][]).map(([val, label]) => (
              <DropdownMenuItem
                key={val}
                onClick={() => setGroupBy(val)}
                className={groupBy === val ? "font-semibold" : ""}
              >
                {label}
                {groupBy === val && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Bulk toggle */}
      <Button
        variant={bulkMode ? "default" : "outline"}
        size="sm"
        className="gap-1.5 h-8 text-xs ml-auto"
        onClick={toggleBulkMode}
      >
        {bulkMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        {bulkMode ? "Done" : "Select"}
      </Button>

      {bulkMode && tasks.length > 0 && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={selectAll}>
          All
        </Button>
      )}
    </div>
  );

  // ── Task list renderer ──────────────────────────────────────────────────────

  function renderTaskGroup(groupedTasks: Task[]) {
    if (view === "grid") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
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
      {/* Header */}
      <div className="flex items-center justify-between slide-up stagger-1">
        <h1 className="text-h1 font-heading tracking-tight flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-mod-tasks-tint flex items-center justify-center">
            <Inbox className="w-4 h-4 text-mod-tasks" />
          </div>
          Tasks
        </h1>
        <Button
          onClick={() =>
            filter === "projects" && !selectedProject ? openNewProject() : openNewTask()
          }
          size="sm"
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          + New
        </Button>
      </div>

      {/* Tabs */}
      <div className="slide-up stagger-2">
        <Tabs
          value={filter}
          onValueChange={(v) => {
            setFilter(v as Filter);
            setSelectedProject(null);
            setBulkMode(false);
            setSelectedIds(new Set());
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="today" className="flex-1 gap-1.5">
              <Star className="w-3.5 h-3.5" /> Today
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1 gap-1.5">
              <List className="w-3.5 h-3.5" /> All
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1 gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Done
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex-1 gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" /> Projects
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Toolbar strip — always visible when task list is shown */}
      {showTaskList && !loading && (
        <div className="slide-up stagger-2">{toolbarStrip}</div>
      )}

      {/* Active filter chips */}
      {showTaskList && !loading && (sortBy !== "priority" || groupBy !== "none") && (
        <div className="flex flex-wrap gap-1.5 slide-up">
          {sortBy !== "priority" && (
            <button
              type="button"
              onClick={() => setSortBy("priority")}
              className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold
                         bg-[var(--mod-tasks-tint)] text-[var(--mod-tasks)]
                         border border-[var(--mod-tasks)]/20
                         hover:opacity-80 transition-opacity"
              aria-label={`Remove sort: ${SORT_LABELS[sortBy]}`}
            >
              Sort: {SORT_LABELS[sortBy]}
              <X className="w-3 h-3 ml-0.5" aria-hidden="true" />
            </button>
          )}
          {groupBy !== "none" && (
            <button
              type="button"
              onClick={() => setGroupBy("none")}
              className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold
                         bg-[var(--mod-tasks-tint)] text-[var(--mod-tasks)]
                         border border-[var(--mod-tasks)]/20
                         hover:opacity-80 transition-opacity"
              aria-label={`Remove group: ${GROUP_LABELS[groupBy]}`}
            >
              Group: {GROUP_LABELS[groupBy]}
              <X className="w-3 h-3 ml-0.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Projects grid */}
      {filter === "projects" && !selectedProject && (
        <div className="slide-up stagger-3">
          {projectsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-mod-tasks" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="card-hover cursor-pointer"
                  onClick={() => setSelectedProject(project)}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full shrink-0",
                            PROJECT_COLOR_CLASS[project.color] ?? "bg-muted"
                          )}
                        />
                        <p className="font-medium text-sm truncate">{project.name}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditProject(project);
                              setProjectFormOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-2" aria-hidden="true" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteProjectId(project.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">
                      {project.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}

              {/* Dashed "Add Project" card */}
              <button
                type="button"
                onClick={() => openNewProject()}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl
                           border-2 border-dashed border-border/60
                           hover:border-[var(--mod-tasks)] hover:bg-[var(--mod-tasks-tint)]/30
                           transition-all min-h-[100px]
                           text-muted-foreground hover:text-[var(--mod-tasks)]"
                aria-label="Add new project"
              >
                <FolderPlus className="w-5 h-5" aria-hidden="true" />
                <span className="text-xs font-medium">Add Project</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Project drill-down header */}
      {filter === "projects" && selectedProject && (
        <div className="flex items-center gap-2 slide-up">
          <button
            type="button"
            onClick={() => setSelectedProject(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Projects
          </button>
          <span className="text-xs text-muted-foreground">/</span>
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full",
                PROJECT_COLOR_CLASS[selectedProject.color] ?? "bg-muted"
              )}
            />
            <span className="text-sm font-medium">{selectedProject.name}</span>
          </div>
          <Button size="sm" onClick={() => openNewTask()} className="ml-auto gap-1.5">
            <Plus className="w-4 h-4" /> Add Task
          </Button>
        </div>
      )}

      {/* Task content */}
      {showTaskList && (
        loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-mod-tasks" />
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
              {filter === "today" ? "Nothing due today! 🎉" :
               filter === "completed" ? "No completed tasks yet." :
               filter === "projects" && selectedProject ? "No tasks in this project." :
               "No active tasks."}
            </p>
            {filter !== "completed" && (
              <Button variant="ghost" size="sm" onClick={() => openNewTask()}>
                + Add a task
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
                      <Star
                        className="w-3.5 h-3.5 fill-[var(--color-warning)] text-[var(--color-warning)]"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-[var(--color-warning)] uppercase tracking-wide">
                        Focus
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {completedFocusCount}/
                      {starredTodayTasks.length + completedFocusCount} done
                    </span>
                  </div>
                  <Progress
                    value={
                      starredTodayTasks.length + completedFocusCount > 0
                        ? (completedFocusCount /
                            (starredTodayTasks.length + completedFocusCount)) *
                          100
                        : 0
                    }
                    className="h-1.5"
                  />
                </div>

                {view === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
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
              ? groups
                  .map((g) => ({ ...g, tasks: g.tasks.filter((t) => !starredIds.has(t.id)) }))
                  .filter((g) => g.tasks.length > 0)
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
        )
      )}

      {/* FAB for mobile */}
      <button
        type="button"
        onClick={() => {
          if (filter === "projects" && !selectedProject) {
            openNewProject();
          } else {
            openNewTask();
          }
        }}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-brand text-white shadow-brand transition-all hover:bg-brand-hover active:scale-95 flex items-center justify-center z-40"
        aria-label="Add new"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Bulk action toolbar */}
      <TaskToolbar
        selectedCount={selectedIds.size}
        onComplete={handleBulkComplete}
        onDelete={handleBulkDelete}
        onSetPriority={handleBulkPriority}
        onClearSelection={() => { setSelectedIds(new Set()); setBulkMode(false); }}
      />

      {/* Single shared task popup — create mode when creatingTask, edit/detail mode when detailTask is set */}
      {(detailTask || creatingTask) && (
        <TaskPopup
          task={detailTask}
          projects={projects}
          defaultProjectId={selectedProject?.id ?? null}
          onClose={() => {
            setDetailTaskId(null);
            setCreatingTask(false);
          }}
          onCreate={async (data) => {
            await createTask({
              ...data,
              project_id: data.project_id ?? selectedProject?.id ?? null,
            });
            toast.success("Task added");
          }}
        />
      )}

      {/* Add Project Dialog */}
      <AddProjectDialog
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
        onProjectCreate={async (name, color, description) => {
          await createProject(name, color, description);
          toast.success("Project created");
        }}
      />

      {/* Project Edit Form */}
      <ProjectForm
        open={projectFormOpen}
        onOpenChange={(v) => {
          setProjectFormOpen(v);
          if (!v) setEditProject(null);
        }}
        initial={editProject}
        onSaved={async (name, color, description, status) => {
          if (editProject) {
            await updateProject(editProject.id, { name, color, description, status });
            toast.success("Project updated");
          }
        }}
      />

      <ConfirmDialog
        open={!!deleteProjectId}
        onOpenChange={(v) => { if (!v) setDeleteProjectId(null); }}
        title="Delete project?"
        description="The project will be deleted. Tasks inside will remain but lose their project assignment."
        onConfirm={handleDeleteProject}
      />
    </div>
  );
}
