'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, deleteDocument } from '@/lib/firestore';
import { Task, Project, LIFE_AREAS, LifeArea, GTD_CONFIG, QUADRANT_CONFIG, GtdContext, Quadrant } from '@/lib/types';
import TaskCard from '@/components/tasks/TaskCard';
import TaskModal from '@/components/tasks/TaskModal';
import ProjectModal from '@/components/tasks/ProjectModal';
import EmptyState from '@/components/ui/EmptyState';
import { cn, isOverdue } from '@/lib/utils';
import {
  Plus, ListTodo, FolderOpen, Calendar, Inbox,
  FolderPlus, Zap, LayoutGrid,
} from 'lucide-react';
import { format } from 'date-fns';

type MainTab = 'today' | 'inbox' | 'upcoming' | 'projects' | 'gtd' | 'quadrant';

interface TaskInit {
  area?: LifeArea;
  projectId?: string;
}

export default function TasksPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: tasks, loading } = useCollection<Task>('tasks', uid);
  const { data: projects } = useCollection<Project>('projects', uid);

  const [tab, setTab] = useState<MainTab>('today');
  const [areaTab, setAreaTab] = useState<LifeArea>('Inbox');

  // Task modal
  const [taskModal, setTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | undefined>();
  const [taskInit, setTaskInit] = useState<TaskInit>({});

  // Project modal
  const [projectModal, setProjectModal] = useState(false);
  const [editProject, setEditProject] = useState<Project | undefined>();
  const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Selection mode (long-press)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const today = format(new Date(), 'yyyy-MM-dd');

  const openTaskModal = useCallback((task?: Task, init?: TaskInit) => {
    setEditTask(task);
    setTaskInit(init ?? {});
    setTaskModal(true);
  }, []);
  const closeTaskModal = () => { setTaskModal(false); setEditTask(undefined); setTaskInit({}); };

  const openProjectModal = (project?: Project) => {
    setEditProject(project);
    setProjectModal(true);
  };
  const closeProjectModal = () => { setProjectModal(false); setEditProject(undefined); };

  const handleTaskSaved = () => {
    // Toast is handled in TaskModal now
  };

  const handleSelect = useCallback((id: string) => {
    setSelectionMode(true);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const cancelSelection = () => { setSelectionMode(false); setSelected(new Set()); };

  const deleteSelected = async () => {
    await Promise.all(Array.from(selected).map(id => deleteDocument('tasks', id)));
    cancelSelection();
  };

  // ── Tab data ─────────────────────────────────────────
  const today_overdue = tasks.filter(t =>
    !t.isCompleted && t.dueDate && t.dueDate < today && isOverdue(t.dueDate),
  ).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  const today_due = tasks.filter(t =>
    !t.isCompleted && t.dueDate === today,
  ).sort((a, b) => (a.dueTime ?? '').localeCompare(b.dueTime ?? ''));

  const inboxTasks = tasks.filter(t => !t.isCompleted && !t.projectId);

  const upcomingTasks = tasks
    .filter(t => !t.isCompleted && t.dueDate && t.dueDate > today)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  const areaProjects = projects.filter(p => p.area === areaTab);

  // ── Project task index ───────────────────────────────
  // Build once per tasks change: O(n) instead of O(n * projects) on every render.
  const tasksByProject = useMemo(() => {
    const map = new Map<string, { active: Task[]; done: Task[] }>();
    for (const t of tasks) {
      if (!t.projectId) continue;
      if (!map.has(t.projectId)) map.set(t.projectId, { active: [], done: [] });
      const bucket = map.get(t.projectId)!;
      (t.isCompleted ? bucket.done : bucket.active).push(t);
    }
    return map;
  }, [tasks]);

  // ── Tab config ───────────────────────────────────────
  const todayCount = today_overdue.length + today_due.length;
  const tabs = [
    { key: 'today' as MainTab,    label: 'Today',    icon: Calendar,   count: todayCount },
    { key: 'inbox' as MainTab,    label: 'Inbox',    icon: Inbox,      count: inboxTasks.length },
    { key: 'upcoming' as MainTab, label: 'Upcoming', icon: ListTodo,   count: upcomingTasks.length },
    { key: 'projects' as MainTab, label: 'Projects', icon: FolderOpen, count: projects.length },
    { key: 'gtd' as MainTab,      label: 'GTD',      icon: Zap,        count: 0 },
    { key: 'quadrant' as MainTab,  label: 'Quadrant', icon: LayoutGrid, count: 0 },
  ];

  const sharedCardProps = useMemo(() => ({
    projects,
    userId: uid ?? '',
    onEdit: openTaskModal,
    selectionMode,
    onSelect: handleSelect,
  }), [projects, uid, openTaskModal, selectionMode, handleSelect]);

  return (
    <div className="px-4 py-5 lg:px-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {selectionMode ? (
          <>
            <span className="text-sm font-semibold text-text">{selected.size} selected</span>
            <div className="flex gap-2">
              <button
                onClick={deleteSelected}
                className="text-xs px-3 py-2 bg-red-500 text-white rounded-xl font-semibold"
              >
                Delete
              </button>
              <button
                onClick={cancelSelection}
                className="text-xs px-3 py-2 bg-surface-2 text-text-2 rounded-xl border border-border font-semibold"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-text">Tasks</h1>
            <button
              onClick={() => openTaskModal()}
              className="flex items-center gap-1.5 px-3 py-2 bg-rise text-white rounded-xl text-sm font-semibold"
            >
              <Plus size={15} /> New Task
            </button>
          </>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 bg-surface-2 rounded-xl p-1 mb-4 border border-border overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors',
              tab === t.key ? 'bg-surface text-text shadow-sm' : 'text-text-3',
            )}
          >
            <t.icon size={12} />
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                'text-[9px] px-1 rounded-full leading-tight',
                tab === t.key ? 'bg-rise/10 text-rise' : 'bg-surface-3 text-text-3',
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TODAY ── */}
      {tab === 'today' && (
        <div className="space-y-4">
          {loading ? <Skeleton /> : (
            <>
              {today_overdue.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">
                    Overdue · {today_overdue.length}
                  </p>
                  <div className="space-y-2">
                    {today_overdue.map(t => (
                      <TaskCard key={t.id} task={t} selected={selected.has(t.id)} {...sharedCardProps} />
                    ))}
                  </div>
                </section>
              )}

              {today_due.length > 0 && (
                <section>
                  {today_overdue.length > 0 && (
                    <p className="text-xs font-semibold text-text-3 uppercase tracking-wide mb-2">
                      Today · {today_due.length}
                    </p>
                  )}
                  <div className="space-y-2">
                    {today_due.map(t => (
                      <TaskCard key={t.id} task={t} selected={selected.has(t.id)} {...sharedCardProps} />
                    ))}
                  </div>
                </section>
              )}

              {todayCount === 0 && (
                <EmptyState icon={Calendar} title="All clear!" description="No tasks due today." />
              )}
            </>
          )}
        </div>
      )}

      {/* ── INBOX ── */}
      {tab === 'inbox' && (
        <div className="space-y-2">
          {inboxTasks.length === 0
            ? <EmptyState icon={Inbox} title="Inbox is empty" description="Tasks without a project appear here." />
            : inboxTasks.map(t => (
              <TaskCard key={t.id} task={t} selected={selected.has(t.id)} {...sharedCardProps} />
            ))
          }
        </div>
      )}

      {/* ── UPCOMING ── */}
      {tab === 'upcoming' && (
        <div className="space-y-2">
          {upcomingTasks.length === 0
            ? <EmptyState icon={ListTodo} title="Nothing upcoming" description="No tasks scheduled for future dates." />
            : upcomingTasks.map(t => (
              <TaskCard key={t.id} task={t} selected={selected.has(t.id)} {...sharedCardProps} />
            ))
          }
        </div>
      )}

      {/* ── GTD ── */}
      {tab === 'gtd' && (
        <div className="space-y-4">
          {(Object.keys(GTD_CONFIG) as GtdContext[]).map(ctx => {
            const cfg = GTD_CONFIG[ctx];
            const ctxTasks = tasks.filter(t => !t.isCompleted && t.gtdContext === ctx);
            return (
              <section key={ctx}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: cfg.color }}>
                    {cfg.title} · {ctxTasks.length}
                  </p>
                </div>
                {ctxTasks.length === 0 ? (
                  <p className="text-xs text-text-3 pl-5 mb-2">No tasks</p>
                ) : (
                  <div className="space-y-2">
                    {ctxTasks.map(t => (
                      <TaskCard key={t.id} task={t} selected={selected.has(t.id)} {...sharedCardProps} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── QUADRANT ── */}
      {tab === 'quadrant' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(Object.keys(QUADRANT_CONFIG) as Quadrant[]).map(q => {
            const cfg = QUADRANT_CONFIG[q];
            const qTasks = tasks.filter(t => !t.isCompleted && t.quadrant === q);
            return (
              <div
                key={q}
                className="rounded-xl border p-3"
                style={{ borderColor: cfg.color + '40' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: cfg.color }}>
                      {cfg.title}
                    </p>
                    <p className="text-[10px] text-text-3">{cfg.subtitle}</p>
                  </div>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: cfg.color + '15', color: cfg.color }}>
                    {qTasks.length}
                  </span>
                </div>
                {qTasks.length === 0 ? (
                  <p className="text-xs text-text-3">No tasks</p>
                ) : (
                  <div className="space-y-2">
                    {qTasks.map(t => (
                      <TaskCard key={t.id} task={t} selected={selected.has(t.id)} {...sharedCardProps} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── PROJECTS ── */}
      {tab === 'projects' && (
        <div>
          {/* Life area sub-tabs */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
            {LIFE_AREAS.map(a => (
              <button
                key={a.id}
                onClick={() => setAreaTab(a.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors',
                  areaTab === a.id ? 'text-white border-transparent' : 'bg-surface-2 text-text-3 border-border',
                )}
                style={areaTab === a.id ? { backgroundColor: a.color } : undefined}
              >
                {a.emoji} {a.name}
              </button>
            ))}
          </div>

          {areaProjects.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No projects" description={`Create your first ${areaTab} project.`} />
          ) : (
            <div className="space-y-3 mb-4">
              {areaProjects.map(project => {
                const area = LIFE_AREAS.find(a => a.id === project.area);
                const { active: projectTasks = [], done: doneTasks = [] } =
                  tasksByProject.get(project.id) ?? { active: [], done: [] };
                const total = projectTasks.length + doneTasks.length;
                const pct = total > 0 ? Math.round((doneTasks.length / total) * 100) : 0;

                return (
                  <div key={project.id} className="bg-surface rounded-xl border border-border overflow-visible">
                    {/* Project header */}
                    <div
                      className="flex items-center gap-3 p-4"
                      style={{ borderLeftColor: area?.color, borderLeftWidth: 4 }}
                    >
                      <span className="text-xl">{area?.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text">{project.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: area?.color }}
                            />
                          </div>
                          <span className="text-xs text-text-3 shrink-0">
                            {doneTasks.length}/{total}
                          </span>
                        </div>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setProjectMenuOpen(projectMenuOpen === project.id ? null : project.id)}
                          className="p-2 text-text hover:bg-surface-2 rounded-lg transition-colors"
                          aria-label="Project menu"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="19" r="1.5" />
                          </svg>
                        </button>

                        {/* Dropdown menu */}
                        {projectMenuOpen === project.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setProjectMenuOpen(null)} />
                            <div className="absolute right-0 top-10 z-20 w-40 bg-surface rounded-lg border border-border shadow-lg py-1">
                              <button
                                onClick={() => { setProjectMenuOpen(null); openTaskModal(undefined, { area: project.area, projectId: project.id }); }}
                                className="w-full px-3 py-2 text-left text-xs text-text hover:bg-surface-2 transition-colors"
                              >
                                Add Task
                              </button>
                              <button
                                onClick={() => { setProjectMenuOpen(null); openProjectModal(project); }}
                                className="w-full px-3 py-2 text-left text-xs text-text hover:bg-surface-2 transition-colors"
                              >
                                Edit Project
                              </button>
                              <button
                                onClick={() => { setProjectMenuOpen(null); setProjectToDelete(project); setShowDeleteProjectConfirm(true); }}
                                className="w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 transition-colors"
                              >
                                Delete Project
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Project tasks (first 3) */}
                    {projectTasks.length > 0 && (
                      <div className="border-t border-border px-3 py-2 space-y-1 bg-surface-2/50">
                        {projectTasks.slice(0, 3).map(t => (
                          <TaskCard key={t.id} task={t} selected={selected.has(t.id)} {...sharedCardProps} />
                        ))}
                        {projectTasks.length > 3 && (
                          <button
                            onClick={() => openTaskModal(undefined, { area: project.area, projectId: project.id })}
                            className="text-xs text-rise font-medium py-1 px-1"
                          >
                            +{projectTasks.length - 3} more tasks
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add project button - below all cards */}
          <button
            onClick={() => { setEditProject(undefined); openProjectModal(); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-sm text-text-3 hover:border-rise/50 hover:text-rise transition-colors"
          >
            <FolderPlus size={15} />
            New project in {LIFE_AREAS.find(a => a.id === areaTab)?.name}
          </button>
        </div>
      )}

      {/* Project Delete Confirmation Modal */}
      {showDeleteProjectConfirm && projectToDelete && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setShowDeleteProjectConfirm(false); setProjectToDelete(null); }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-surface rounded-xl border border-border p-4 max-w-[280px] w-[90%] animate-in fade-in zoom-in duration-150">
              <p className="text-sm text-text mb-4">Are you sure you want to delete this project?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeleteProjectConfirm(false); setProjectToDelete(null); }}
                  className="flex-1 py-2 px-3 rounded-lg border border-border text-xs font-medium text-text-3 hover:bg-surface-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => { await deleteDocument('projects', projectToDelete.id); setShowDeleteProjectConfirm(false); setProjectToDelete(null); }}
                  className="flex-1 py-2 px-3 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <TaskModal
        open={taskModal}
        onClose={closeTaskModal}
        task={editTask}
        projects={projects}
        initArea={taskInit.area}
        initProjectId={taskInit.projectId}
        onSaved={handleTaskSaved}
      />
      <ProjectModal
        open={projectModal}
        onClose={closeProjectModal}
        project={editProject}
        defaultArea={areaTab}
        onSaved={handleTaskSaved}
      />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-2 animate-pulse" />)}
    </div>
  );
}
