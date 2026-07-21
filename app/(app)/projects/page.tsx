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
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Project, ProjectCategory, Task } from "@/lib/types/database";

export default function ProjectsPage() {
  const [addProjectCategory, setAddProjectCategory] = useState<ProjectCategory>("default");
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

  // Kanban columns: group by category, hide empty, sort projects by created_at desc
  const kanbanColumns = useMemo(
    () =>
      PROJECT_CATEGORIES.map((cat) => ({
        meta: cat,
        projects: projects
          .filter((p) => (p.category ?? "default") === cat.value)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      })).filter((col) => col.projects.length > 0),
    [projects],
  );

  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null),
    [detailTaskId, tasks],
  );

  const selectedProjectMeta = selectedProject
    ? PROJECT_CATEGORIES.find((c) => c.value === (selectedProject.category ?? "default"))
    : null;

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

  function openAddProject(cat: ProjectCategory) {
    setAddProjectCategory(cat);
    setAddProjectOpen(true);
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-3 md:px-5 pt-3 md:pt-5 pb-3 flex items-center justify-between slide-up stagger-1 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {selectedProject && (
            <button
              type="button"
              onClick={() => { setSelectedProject(null); setDetailTaskId(null); setCreatingTask(false); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Projects
            </button>
          )}
          <h1 className="text-h1 font-heading tracking-tight flex items-center gap-2 truncate">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: selectedProjectMeta?.bg ?? "rgba(107,114,128,0.12)" }}
            >
              <FolderOpen
                className="w-4 h-4"
                style={{ color: selectedProjectMeta?.color ?? "#6B7280" }}
              />
            </div>
            {selectedProject ? selectedProject.name : "Projects"}
          </h1>
        </div>
        <Button
          onClick={() =>
            selectedProject ? setCreatingTask(true) : openAddProject("default")
          }
          size="sm"
          className="gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {selectedProject ? "Add Task" : "New Project"}
        </Button>
      </div>

      {/* Kanban board */}
      {!selectedProject && (
        <div className="flex-1 overflow-x-auto px-3 md:px-5 pb-8 slide-up stagger-2">
          {projectsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : kanbanColumns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">No projects yet.</p>
              <Button variant="outline" size="sm" onClick={() => openAddProject("default")}>
                <FolderPlus className="w-4 h-4 mr-1.5" />
                Create your first project
              </Button>
            </div>
          ) : (
            <div className="flex gap-3 min-w-min pb-2 pt-1">
              {kanbanColumns.map(({ meta, projects: colProjects }) => (
                <div key={meta.value} className="flex flex-col gap-2 w-[272px] shrink-0">
                  {/* Column header */}
                  <div
                    className="flex items-center justify-between px-3 py-2 rounded-xl border"
                    style={{
                      backgroundColor: meta.bg,
                      borderColor: `${meta.color}33`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-sm font-semibold" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                    </div>
                    <span
                      className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
                    >
                      {colProjects.length}
                    </span>
                  </div>

                  {/* Project cards */}
                  {colProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setSelectedProject(project)}
                      className="group text-left rounded-xl border border-border bg-card p-3 space-y-1.5 transition-all hover:shadow-card card-hover"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={cn(
                              "w-2.5 h-2.5 rounded-full shrink-0",
                              PROJECT_COLOR_CLASS[project.color] ?? "bg-muted",
                            )}
                          />
                          <p className="font-medium text-sm truncate">{project.name}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-accent shrink-0 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-3.5 h-3.5" aria-hidden="true" />
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
                        <p className="text-xs text-muted-foreground line-clamp-2 pl-[18px]">
                          {project.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 pl-[18px]">
                        <Badge variant="outline" className="text-[10px] capitalize py-0 h-4">
                          {project.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(project.created_at)}
                        </span>
                      </div>
                    </button>
                  ))}

                  {/* Add project to this column */}
                  <button
                    type="button"
                    onClick={() => openAddProject(meta.value)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-all text-xs font-medium"
                    aria-label={`Add project to ${meta.label}`}
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    Add Project
                  </button>
                </div>
              ))}

              {/* Trailing "New Project" ghost column */}
              <button
                type="button"
                onClick={() => openAddProject("default")}
                className="flex flex-col items-center justify-start gap-2 w-[200px] shrink-0 rounded-xl border-2 border-dashed border-border/40 text-muted-foreground hover:border-brand hover:text-brand transition-all self-start py-5 min-h-[80px]"
                aria-label="Add new project"
              >
                <FolderPlus className="w-5 h-5" />
                <span className="text-xs font-medium">New Project</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Task list for selected project */}
      {selectedProject && (
        <div className="flex-1 px-3 md:px-5 pb-8 space-y-2 slide-up stagger-3">
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
        onClick={() =>
          selectedProject ? setCreatingTask(true) : openAddProject("default")
        }
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
        defaultCategory={addProjectCategory}
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
