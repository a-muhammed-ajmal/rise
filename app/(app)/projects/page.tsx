"use client";

import { useState, useMemo } from "react";
import { useProjects } from "@/lib/hooks/use-projects";
import { useTasks } from "@/lib/hooks/use-tasks";
import { TaskCard } from "@/components/productivity/task-card";
import { TaskPopup } from "@/components/productivity/task-popup";
import { AddProjectDialog } from "@/components/productivity/add-project-dialog";
import { ProjectForm } from "@/components/productivity/project-form";
import { PROJECT_CATEGORIES, PROJECT_COLOR_CLASS } from "@/components/productivity/task-constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen,
  FolderPlus,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  MoreVertical,
  Inbox,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Project, ProjectCategory, Task } from "@/lib/types/database";

export default function ProjectsPage() {
  const [activeCategory, setActiveCategory] = useState<ProjectCategory>("default");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  const [creatingTask, setCreatingTask] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const { projects, loading: projectsLoading, createProject, updateProject, deleteProject } = useProjects();

  const { tasks, loading: tasksLoading, createTask, updateTask, completeTask, deleteTask, duplicateTask, starTask } =
    useTasks(selectedProject ? "project" : "all", selectedProject?.id);

  const categoryProjects = useMemo(
    () => projects.filter((p) => (p.category ?? "default") === activeCategory),
    [projects, activeCategory],
  );

  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null),
    [detailTaskId, tasks],
  );

  const activeCatMeta = PROJECT_CATEGORIES.find((c) => c.value === activeCategory)!;

  function handleSelectCategory(cat: ProjectCategory) {
    setActiveCategory(cat);
    setSelectedProject(null);
    setCreatingTask(false);
    setDetailTaskId(null);
  }

  async function handleDeleteProject() {
    if (!deleteProjectId) return;
    await deleteProject(deleteProjectId);
    if (selectedProject?.id === deleteProjectId) setSelectedProject(null);
    toast.success("Project deleted");
    setDeleteProjectId(null);
  }

  function cardProps(task: Task) {
    return {
      task,
      onComplete: completeTask,
      onUpdate: updateTask,
      onDelete: deleteTask,
      onDuplicate: duplicateTask,
      onStar: starTask,
      onOpenDetail: (t: Task) => setDetailTaskId(t.id),
      bulkMode: false as const,
      selected: false,
      onToggleSelect: () => {},
    };
  }

  return (
    <div className="p-3 md:p-5 max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between slide-up stagger-1">
        <h1 className="text-h1 font-heading tracking-tight flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: activeCatMeta.bg }}>
            <FolderOpen className="w-4 h-4" style={{ color: activeCatMeta.color }} />
          </div>
          Projects
        </h1>
        <Button
          onClick={() => (selectedProject ? setCreatingTask(true) : setAddProjectOpen(true))}
          size="sm"
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {selectedProject ? "Add Task" : "New Project"}
        </Button>
      </div>

      {/* Category tabs */}
      <div className="slide-up stagger-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {PROJECT_CATEGORIES.map((cat) => {
          const active = cat.value === activeCategory;
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => handleSelectCategory(cat.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-all shrink-0",
                active
                  ? "border-current shadow-sm"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              style={
                active
                  ? { backgroundColor: cat.bg, color: cat.color, borderColor: cat.color }
                  : {}
              }
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              {cat.label}
              {!active && (
                <span className="text-[11px] text-muted-foreground ml-0.5">
                  {projects.filter((p) => (p.category ?? "default") === cat.value).length || ""}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Project drill-down breadcrumb */}
      {selectedProject && (
        <div className="flex items-center gap-2 slide-up">
          <button
            type="button"
            onClick={() => { setSelectedProject(null); setDetailTaskId(null); setCreatingTask(false); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {activeCatMeta.label}
          </button>
          <span className="text-xs text-muted-foreground">/</span>
          <div className="flex items-center gap-1.5">
            <div
              className={cn("w-2.5 h-2.5 rounded-full shrink-0", PROJECT_COLOR_CLASS[selectedProject.color] ?? "bg-muted")}
            />
            <span className="text-sm font-medium">{selectedProject.name}</span>
          </div>
        </div>
      )}

      {/* Project grid */}
      {!selectedProject && (
        <div className="slide-up stagger-3">
          {projectsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categoryProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProject(project)}
                  className="group text-left card-hover rounded-xl border border-border bg-card p-4 space-y-2 transition-all hover:shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn("w-3 h-3 rounded-full shrink-0", PROJECT_COLOR_CLASS[project.color] ?? "bg-muted")}
                      />
                      <p className="font-medium text-sm truncate">{project.name}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="opacity-0 group-hover:opacity-100 h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent shrink-0 transition-opacity"
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
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteProjectId(project.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">{project.status}</Badge>
                  </div>
                </button>
              ))}

              {/* Add project card */}
              <button
                type="button"
                onClick={() => setAddProjectOpen(true)}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl
                           border-2 border-dashed border-border/60
                           hover:border-current transition-all min-h-[100px]
                           text-muted-foreground"
                style={
                  categoryProjects.length === 0
                    ? { borderColor: activeCatMeta.color, color: activeCatMeta.color, backgroundColor: activeCatMeta.bg }
                    : {}
                }
                aria-label="Add new project"
              >
                <FolderPlus className="w-5 h-5" />
                <span className="text-xs font-medium">Add Project</span>
              </button>
            </div>
          )}

          {!projectsLoading && categoryProjects.length === 0 && (
            <p className="text-center text-xs text-muted-foreground pt-2">
              No projects in <span className="font-medium" style={{ color: activeCatMeta.color }}>{activeCatMeta.label}</span> yet
            </p>
          )}
        </div>
      )}

      {/* Task list for selected project */}
      {selectedProject && (
        <div className="space-y-2 slide-up stagger-3">
          {tasksLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-3">
                <Inbox className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">No tasks in this project yet.</p>
              <Button variant="ghost" size="sm" onClick={() => setCreatingTask(true)}>
                + Add a task
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskCard key={task.id} {...cardProps(task)} view="list" />
                ))}
              </div>
              <p className="text-xs text-center text-muted-foreground pt-1">
                {tasks.length} task{tasks.length !== 1 ? "s" : ""}
              </p>
            </>
          )}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => (selectedProject ? setCreatingTask(true) : setAddProjectOpen(true))}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-brand text-white shadow-brand transition-all hover:bg-brand-hover active:scale-95 flex items-center justify-center z-40"
        aria-label={selectedProject ? "Add task" : "Add project"}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Task popup */}
      {(detailTask || creatingTask) && (
        <TaskPopup
          task={detailTask}
          projects={projects}
          defaultProjectId={selectedProject?.id ?? null}
          onClose={() => { setDetailTaskId(null); setCreatingTask(false); }}
          onCreate={async (data) => {
            await createTask({ ...data, project_id: data.project_id ?? selectedProject?.id ?? null });
            toast.success("Task added");
          }}
        />
      )}

      {/* Add Project dialog */}
      <AddProjectDialog
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
        defaultCategory={activeCategory}
        onProjectCreate={async (name, color, description, category) => {
          await createProject(name, color, description, category);
          toast.success("Project created");
        }}
      />

      {/* Edit Project form */}
      <ProjectForm
        open={projectFormOpen}
        onOpenChange={(v) => { setProjectFormOpen(v); if (!v) setEditProject(null); }}
        initial={editProject}
        onSaved={async (name, color, description, status, category) => {
          if (editProject) {
            await updateProject(editProject.id, { name, color, description, status, category });
            toast.success("Project updated");
          }
        }}
      />

      {/* Delete project confirm */}
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
