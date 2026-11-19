'use client'

import { useState, useEffect, useCallback, useId, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { currentUserId } from '@/lib/supabase/current-user'
import type { Task } from '@/lib/types/database'
import { todayISO } from '@/lib/format'
import { loadTasks, type TaskFilter, type TaskSnapshotData } from '@/lib/data/tasks'
import { isFreshSnapshot, type ServerSnapshot } from '@/lib/data/snapshot'

export type { TaskFilter } from '@/lib/data/tasks'

/**
 * `initial` is a server-loaded snapshot. It stands in for the first fetch only
 * — for the view it was loaded for, while fresh. Every later run fetches: by
 * then `tasks` may hold another filter's rows (Today → All → Today), so
 * trusting the snapshot again would show the wrong list.
 */
export function useTasks(
  filter: TaskFilter = 'today',
  projectId?: string,
  initial?: ServerSnapshot<TaskSnapshotData> | null,
) {
  // Captured once: the snapshot only ever describes the first render, and a
  // caller passing a new object each render must not re-trigger the effect.
  const [snapshot] = useState(initial)
  const [tasks, setTasks] = useState<Task[]>(snapshot?.data.tasks ?? [])
  const [loading, setLoading] = useState(!snapshot)
  const snapshotConsumed = useRef(false)
  const channelName = `tasks-${useId().replace(/:/g, '')}`

  const fetchTasks = useCallback(async () => {
    try {
      setTasks(await loadTasks(createClient(), filter, todayISO(), projectId))
    } catch (error) {
      console.error('[use-tasks] fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [filter, projectId])

  useEffect(() => {
    const useSnapshot =
      !snapshotConsumed.current &&
      snapshot?.data.filter === filter &&
      snapshot.data.projectId === (projectId ?? null) &&
      isFreshSnapshot(snapshot)
    snapshotConsumed.current = true
    if (!useSnapshot) fetchTasks()

    const supabase = createClient()
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchTasks, channelName, snapshot, filter, projectId])

  async function createTask(data: Partial<Task>): Promise<string | null> {
    const supabase = createClient()
    const userId = await currentUserId()
    if (!userId) return null

    const { data: row, error } = await supabase.from('tasks').insert({
      user_id: userId,
      title: data.title ?? '',
      description: data.description ?? null,
      status: data.status ?? 'todo',
      priority: data.priority ?? 'P4',
      due_date: data.due_date ?? null,
      due_time: data.due_time ?? null,
      project_id: data.project_id ?? null,
      area: data.area ?? 'default',
      recurrence: data.recurrence ?? null,
      reminder: data.reminder ?? null,
      is_starred: data.is_starred ?? false,
      is_focus: data.is_focus ?? false,
      labels: data.labels ?? [],
      subtasks: data.subtasks ?? [],
      estimated_time: data.estimated_time ?? null,
      attachments: data.attachments ?? [],
    }).select('id').single()
    if (error) throw new Error(error.message)
    await fetchTasks()
    return row?.id ?? null
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const supabase = createClient()
    // Strip computed/server-managed fields before sending to Supabase
    const {
      id: _id, created_at: _c, updated_at: _u, user_id: _uid,
      is_completed: _ic,
      ...safeUpdates
    } = updates
    const { error } = await supabase.from('tasks').update(safeUpdates).eq('id', id)
    if (error) {
      console.error('[use-tasks] update error:', error.message)
      throw new Error(error.message)
    }
    await fetchTasks()
  }

  async function completeTask(id: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  async function reopenTask(id: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'todo', completed_at: null })
      .eq('id', id)
    if (error) throw new Error(error.message)
    await fetchTasks()
  }

  async function toggleFocus(id: string) {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const newFocus = !task.is_focus
    const supabase = createClient()
    const { error } = await supabase
      .from('tasks')
      .update({ is_focus: newFocus, focus_date: newFocus ? todayISO() : null })
      .eq('id', id)
    if (error) throw new Error(error.message)
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, is_focus: newFocus, focus_date: newFocus ? todayISO() : null } : t
      )
    )
  }

  async function deleteTask(id: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  async function bulkComplete(ids: string[]) {
    const supabase = createClient()
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .in('id', ids)
    if (error) throw new Error(error.message)
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)))
  }

  async function bulkDelete(ids: string[]) {
    const supabase = createClient()
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids)
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)))
  }

  async function bulkUpdatePriority(ids: string[], priority: Task['priority']) {
    const supabase = createClient()
    const { error } = await supabase.from('tasks').update({ priority }).in('id', ids)
    if (error) throw new Error(error.message)
    await fetchTasks()
  }

  async function starTask(id: string) {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const newVal = !task.is_starred
    const supabase = createClient()
    const { error } = await supabase.from('tasks').update({ is_starred: newVal }).eq('id', id)
    if (error) throw new Error(error.message)
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, is_starred: newVal } : t))
  }

  async function duplicateTask(id: string) {
    const supabase = createClient()
    const userId = await currentUserId()
    if (!userId) return
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const { error } = await supabase.from('tasks').insert({
      user_id: userId,
      title: `${task.title} (copy)`,
      description: task.description,
      status: task.status === 'done' ? 'todo' : task.status,
      priority: task.priority,
      due_date: task.due_date,
      due_time: task.due_time,
      project_id: task.project_id,
      area: task.area ?? 'default',
      recurrence: null,
      reminder: null,
      is_starred: false,
      is_focus: false,
      labels: task.labels,
      subtasks: [],
      estimated_time: task.estimated_time,
      attachments: [],
    })
    if (error) throw new Error(error.message)
    await fetchTasks()
  }

  return {
    tasks,
    loading,
    createTask,
    updateTask,
    completeTask,
    reopenTask,
    toggleFocus,
    deleteTask,
    duplicateTask,
    bulkComplete,
    bulkDelete,
    bulkUpdatePriority,
    starTask,
    refresh: fetchTasks,
  }
}
