"use client";

import { useState } from "react";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { TaskCard } from "@/components/productivity/task-card";
import { TaskForm } from "@/components/productivity/task-form";
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
} from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/types/database";

type Filter = "inbox" | "today" | "all" | "projects";

const PROJECT_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#f43f5e",
];

export default function ProductivityPage() {
  const [filter, setFilter] = useState<Filter>("inbox");
  const [newOpen, setNewOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const { tasks, loading, createTask, updateTask, completeTask, deleteTask, duplicateTask } =
    useTasks(filter === "projects" ? (selectedProject ? "project" : "all") : filter, selectedProject?.id);

  const {
    projects,
    loading: projectsLoading,
    createProject,
    updateProject,
    deleteProject,
  } = useProjects();

  // Project dialogs
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  async function handleDeleteProject() {
    if (!deleteProjectId) return;
    await deleteProject(deleteProjectId);
    if (selectedProject?.id === deleteProjectId) setSelectedProject(null);
    toast.success("Project deleted");
  }

  const showTaskList = filter !== "projects" || selectedProject !== null;

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

      <div className="animate-rise-in stagger-2">
        <Tabs value={filter} onValueChange={(v) => { setFilter(v as Filter); setSelectedProject(null); }}>
          <TabsList className="w-full">
            <TabsTrigger value="inbox" className="flex-1 gap-1.5">
              <Inbox className="w-3.5 h-3.5" /> Inbox
            </TabsTrigger>
            <TabsTrigger value="today" className="flex-1 gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Today
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1 gap-1.5">
              <List className="w-3.5 h-3.5" /> All
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex-1 gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" /> Projects
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

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
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground">{project.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {project.status}
                  </Badge>
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

      {/* Task list */}
      {showTaskList && (
        loading ? (
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
                  : filter === "projects" && selectedProject
                    ? "No tasks in this project."
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
                onDuplicate={duplicateTask}
              />
            ))}
            <p className="text-xs text-center text-muted-foreground pt-2">
              {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            </p>
          </div>
        )
      )}

      <TaskForm
        open={newOpen}
        onOpenChange={setNewOpen}
        onSubmit={async (data) => {
          await createTask({ ...data, project_id: selectedProject?.id ?? null });
          toast.success("Task added");
        }}
      />

      {/* FAB for mobile */}
      <button
        type="button"
        onClick={() => filter === "projects" && !selectedProject
          ? setProjectFormOpen(true)
          : setNewOpen(true)
        }
        className="fab fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-mod-tasks text-white flex items-center justify-center z-40"
        aria-label="Add task"
      >
        <Plus className="w-6 h-6" />
      </button>

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

  useState(() => {
    if (initial) { setName(initial.name); setColor(initial.color); }
    else { setName(""); setColor(PROJECT_COLORS[0]); }
  });

  // sync when initial changes
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
