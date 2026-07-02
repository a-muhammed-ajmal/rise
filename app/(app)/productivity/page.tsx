"use client";

import { useState, useMemo } from "react";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { TaskCard } from "@/components/productivity/task-card";
import { TaskForm } from "@/components/productivity/task-form";
import { TaskToolbar } from "@/components/productivity/task-toolbar";
import { TaskCalendar } from "@/components/productivity/task-calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Plus,
  Inbox,
  CalendarDays,
  List,
  Loader2,
  FolderOpen,
  MoreVertical,
  Pencil,
  Trash2,
  FolderPlus,
  Star,
  CheckCircle2,
  LayoutGrid,
  Calendar,
  ArrowUpDown,
  Layers,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Project, Task } from "@/lib/types/database";

type Filter = "today" | "inbox" | "all" | "completed" | "projects";
type ViewMode = "list" | "grid" | "calendar";
type SortBy = "priority" | "due_date" | "created_at" | "title" | "estimated";
type GroupBy = "none" | "priority" | "project" | "status" | "tag";

const PROJECT_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#f43f5e",
];

const PRIORITY_ORDER: Record<Task["priority"], number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
};
const PRIORITY_LABEL: Record<Task["priority"], string> = {
  urgent: "P1", high: "P2", medium: "P3", low: "P4",
};
const STATUS_LABEL: Record<string, string> = {
  inbox: "Inbox", todo: "To Do", in_progress: "In Progress", done: "Done",
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
        const ae = a.estimated_minutes ?? Infinity;
        const be = b.estimated_minutes ?? Infinity;
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
      case "tag":      key = task.tags?.[0] ?? "__none__"; break;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(task);
  });

  return Array.from(groups.entries())
    .map(([key, tasks]) => {
      let label = key;
      if (groupBy === "priority") label = `${PRIORITY_LABEL[key as Task["priority"]]} – ${key.charAt(0).toUpperCase() + key.slice(1)}`;
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
  const [newOpen, setNewOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  async function handleDeleteProject() {
    if (!deleteProjectId) return;
    await deleteProject(deleteProjectId);
    if (selectedProject?.id === deleteProjectId) setSelectedProject(null);
    toast.success("Project deleted");
  }

  // ── Sorting + grouping ──────────────────────────────────────────────────────

  const processedTasks = useMemo(() => sortTasks(tasks, sortBy), [tasks, sortBy]);

  const groups = useMemo(
    () => groupTasks(processedTasks, groupBy, projects),
    [processedTasks, groupBy, projects]
  );

  // ── Today: starred focus tasks ──────────────────────────────────────────────

  const starredTodayTasks = useMemo(
    () => filter === "today" ? tasks.filter((t) => t.is_starred).slice(0, 3) : [],
    [tasks, filter]
  );
  const starredIds = new Set(starredTodayTasks.map((t) => t.id));
  const regularTodayTasks = useMemo(
    () => filter === "today" ? processedTasks.filter((t) => !starredIds.has(t.id)) : processedTasks,
    [processedTasks, starredIds, filter]
  );

  // ── Bulk helpers ────────────────────────────────────────────────────────────

  function toggleBulkMode() {
    setBulkMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelectTask(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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
    toast.success(`Priority updated`);
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
      projects,
      bulkMode,
      selected: selectedIds.has(task.id),
      onToggleSelect: toggleSelectTask,
    };
  }

  // ── Toolbar strip (view + sort + group + bulk toggle) ───────────────────────

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
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          {([
            { val: "priority",  label: "Priority" },
            { val: "due_date",  label: "Due Date" },
            { val: "created_at",label: "Created" },
            { val: "title",     label: "Title (A–Z)" },
            { val: "estimated", label: "Duration" },
          ] as { val: SortBy; label: string }[]).map(({ val, label }) => (
            <DropdownMenuItem
              key={val}
              onClick={() => setSortBy(val)}
              className={sortBy === val ? "font-semibold" : ""}
            >
              {label}
              {sortBy === val && <span className="ml-auto text-primary">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border border-border bg-background hover:bg-accent transition-colors font-medium">
          <Layers className="w-3.5 h-3.5" />
          Group
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Group by</DropdownMenuLabel>
          {([
            { val: "none",     label: "None" },
            { val: "priority", label: "Priority" },
            { val: "project",  label: "Project" },
            { val: "status",   label: "Status" },
            { val: "tag",      label: "Tag" },
          ] as { val: GroupBy; label: string }[]).map(({ val, label }) => (
            <DropdownMenuItem
              key={val}
              onClick={() => setGroupBy(val)}
              className={groupBy === val ? "font-semibold" : ""}
            >
              {label}
              {groupBy === val && <span className="ml-auto text-primary">✓</span>}
            </DropdownMenuItem>
          ))}
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

      {/* Select all (bulk mode only) */}
      {bulkMode && tasks.length > 0 && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={selectAll}>
          All
        </Button>
      )}
    </div>
  );

  // ── Task list renderer ─────────────────────────────────────────────────────

  function renderTaskGroup(groupTasks: Task[]) {
    if (view === "grid") {
      return (
        <div className="grid grid-cols-2 gap-2">
          {groupTasks.map((task) => (
            <TaskCard key={task.id} {...commonCardProps(task)} view="grid" />
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {groupTasks.map((task) => (
          <TaskCard key={task.id} {...commonCardProps(task)} view="list" />
        ))}
      </div>
    );
  }

  return (
    <div
      className="p-4 md:p-6 max-w-2xl space-y-4 page-glow"
      style={{ "--glow-color": "var(--mod-tasks)" } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex items-center justify-between animate-rise-in stagger-1">
        <h1 className="text-h1 font-heading tracking-tight flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-mod-tasks-soft flex items-center justify-center">
            <Inbox className="w-4 h-4 text-mod-tasks" />
          </div>
          Tasks
        </h1>
        {filter === "projects" && !selectedProject ? (
          <Button
            onClick={() => { setEditProject(null); setProjectFormOpen(true); }}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            <FolderPlus className="w-4 h-4" /> New Project
          </Button>
        ) : (
          <Button
            onClick={() => setNewOpen(true)}
            size="sm"
            className="gap-1.5 bg-mod-tasks hover:bg-mod-tasks/90 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        )}
      </div>

      {/* Tabs — Today first */}
      <div className="animate-rise-in stagger-2">
        <Tabs value={filter} onValueChange={(v) => { setFilter(v as Filter); setSelectedProject(null); setBulkMode(false); setSelectedIds(new Set()); }}>
          <TabsList className="w-full">
            <TabsTrigger value="today" className="flex-1 gap-1.5">
              <Star className="w-3.5 h-3.5" /> Today
            </TabsTrigger>
            <TabsTrigger value="inbox" className="flex-1 gap-1.5">
              <Inbox className="w-3.5 h-3.5" /> Inbox
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

      {/* Toolbar strip */}
      {showTaskList && !loading && tasks.length > 0 && (
        <div className="animate-rise-in stagger-2">{toolbarStrip}</div>
      )}

      {/* Projects list */}
      {filter === "projects" && !selectedProject && (
        <div className="space-y-2 animate-rise-in stagger-3">
          {projectsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-mod-tasks" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-mod-tasks-soft flex items-center justify-center mx-auto mb-3">
                <FolderOpen className="w-8 h-8 text-mod-tasks" />
              </div>
              <p className="text-muted-foreground text-sm">No projects yet.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEditProject(null); setProjectFormOpen(true); }}
              >
                + Create a project
              </Button>
            </div>
          ) : (
            projects.map((project) => (
              <Card
                key={project.id}
                className="card-interactive cursor-pointer"
                onClick={() => setSelectedProject(project)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground">{project.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{project.status}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); setEditProject(project); setProjectFormOpen(true); }}
                      >
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteProjectId(project.id); }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Project drill-down header */}
      {filter === "projects" && selectedProject && (
        <div className="flex items-center gap-2 animate-rise-in">
          <button
            type="button"
            onClick={() => setSelectedProject(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Projects
          </button>
          <span className="text-xs text-muted-foreground">/</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedProject.color }} />
            <span className="text-sm font-medium">{selectedProject.name}</span>
          </div>
          <Button
            size="sm"
            onClick={() => setNewOpen(true)}
            className="ml-auto gap-1.5 bg-mod-tasks hover:bg-mod-tasks/90 text-white"
          >
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
          <div className="text-center py-16 space-y-2 animate-rise-in">
            <div className="w-16 h-16 rounded-2xl bg-mod-tasks-soft flex items-center justify-center mx-auto mb-3">
              {filter === "completed" ? (
                <CheckCircle2 className="w-8 h-8 text-mod-tasks" />
              ) : (
                <Inbox className="w-8 h-8 text-mod-tasks" />
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {filter === "inbox" ? "Your inbox is empty." :
               filter === "today" ? "Nothing due today! 🎉" :
               filter === "completed" ? "No completed tasks yet." :
               filter === "projects" && selectedProject ? "No tasks in this project." :
               "No active tasks."}
            </p>
            {filter !== "completed" && (
              <Button variant="ghost" size="sm" onClick={() => setNewOpen(true)}>
                + Add a task
              </Button>
            )}
          </div>
        ) : view === "calendar" ? (
          <div className="animate-rise-in stagger-3">
            <TaskCalendar
              tasks={processedTasks}
              onComplete={completeTask}
              onUpdate={updateTask}
              onDelete={deleteTask}
              onDuplicate={duplicateTask}
              onStar={starTask}
              projects={projects}
            />
          </div>
        ) : (
          <div className="animate-rise-in stagger-3 space-y-4">
            {/* Today Focus section (starred) */}
            {filter === "today" && starredTodayTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 fill-[var(--color-warning)] text-[var(--color-warning)]" />
                  <span className="text-xs font-semibold text-[var(--color-warning)] uppercase tracking-wide">
                    Focus — Top {starredTodayTasks.length}
                  </span>
                </div>
                {view === "grid" ? (
                  <div className="grid grid-cols-2 gap-2">
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
            {(filter === "today" ? groups.map((g) => ({ ...g, tasks: g.tasks.filter((t) => !starredIds.has(t.id)) })).filter((g) => g.tasks.length > 0) : groups).map((group) => (
              <div key={group.key} className="space-y-2">
                {groupBy !== "none" && (
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </h3>
                    <Badge variant="outline" className="text-xs h-4 px-1.5">{group.tasks.length}</Badge>
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

      {/* Task form */}
      <TaskForm
        open={newOpen}
        onOpenChange={setNewOpen}
        projects={projects}
        defaultProjectId={selectedProject?.id ?? null}
        onSubmit={async (data) => {
          await createTask({ ...data, project_id: data.project_id ?? selectedProject?.id ?? null });
          toast.success("Task added");
        }}
      />

      {/* FAB for mobile */}
      <button
        type="button"
        onClick={() =>
          filter === "projects" && !selectedProject
            ? setProjectFormOpen(true)
            : setNewOpen(true)
        }
        className="fab fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-mod-tasks text-white flex items-center justify-center z-40"
        aria-label="Add task"
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

      {/* Project form */}
      <ProjectForm
        open={projectFormOpen}
        onOpenChange={(v) => { setProjectFormOpen(v); if (!v) setEditProject(null); }}
        initial={editProject}
        onSaved={async (name, color) => {
          if (editProject) {
            await updateProject(editProject.id, { name, color });
            toast.success("Project updated");
          } else {
            await createProject(name, color);
            toast.success("Project created");
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

// ─── Project Form ─────────────────────────────────────────────────────────────

function ProjectForm({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Project | null;
  onSaved: (name: string, color: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const [lastInitialId, setLastInitialId] = useState<string | null>(null);
  if ((initial?.id ?? null) !== lastInitialId) {
    setLastInitialId(initial?.id ?? null);
    if (initial) { setName(initial.name); setColor(initial.color); }
    else { setName(""); setColor(PROJECT_COLORS[0]); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSaved(name.trim(), color);
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-offset-2 ring-current" : "hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : initial ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
