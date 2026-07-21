'use client'

import { useState, useEffect, useCallback, useId } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, Subtask, TaskAttachment, Comment, ActivityEntry, LinkedTask, Reminder } from '@/lib/types/database'
import { todayISO } from '@/lib/format'

export type TaskFilter = 'today' | 'all' | 'project' | 'completed'

function coerceTask(t: Record<string, unknown>): Task {
  return {
    ...(t as Task),
    is_completed: t.completed_at !== null && t.completed_at !== undefined,
    labels: Array.isArray(t.labels) ? (t.labels as string[]) : [],
    subtasks: Array.isArray(t.subtasks) ? (t.subtasks as Subtask[]) : [],
    attachments: Array.isArray(t.attachments) ? (t.attachments as TaskAttachment[]) : [],
    comments: Array.isArray(t.comments) ? (t.comments as Comment[]) : [],
    activity: Array.isArray(t.activity) ? (t.activity as ActivityEntry[]) : [],
    linked_tasks: Array.isArray(t.linked_tasks) ? (t.linked_tasks as LinkedTask[]) : [],
    reminders: Array.isArray(t.reminders) ? (t.reminders as Reminder[]) : [],
  }
}

export function useTasks(filter: TaskFilter = 'today', projectId?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const channelName = `tasks-${useId().replace(/:/g, '')}`

  const fetchTasks = useCallback(async () => {
    const supabase = createClient()
    let query = supabase
      .from('tasks')
      .select('*')
      .order('is_starred', { ascending: false })
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (filter === 'completed') {
      query = query.eq('status', 'done')
    } else {
      query = query.neq('status', 'done')
      if (filter === 'today') {
        const today = todayISO()
        query = query.or(`due_date.eq.${today},due_date.lt.${today}`)
      } else if (filter === 'project' && projectId) {
        query = query.eq('project_id', projectId)
      }
    }

    const { data } = await query
    setTasks((data ?? []).map(coerceTask))
    setLoading(false)
  }, [filter, projectId])

  useEffect(() => {
    fetchTasks()

    const supabase = createClient()
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchTasks, channelName])

  async function createTask(data: Partial<Task>): Promise<string | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: row } = await supabase.from('tasks').insert({
      user_id: user.id,
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
      reminders: (data.reminders ?? []) as unknown as never,
      is_starred: data.is_starred ?? false,
      is_focus: data.is_focus ?? false,
      labels: data.labels ?? [],
      subtasks: (data.subtasks ?? []) as unknown as never,
      estimated_time: data.estimated_time ?? null,
      attachments: (data.attachments ?? []) as unknown as never,
      comments: [] as unknown as never,
      activity: [] as unknown as never,
      linked_tasks: [] as unknown as never,
      location: data.location ?? null,
    }).select('id').single()
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
    await supabase.from('tasks').update(safeUpdates as never).eq('id', id)
    await fetchTasks()
  }

  async function completeTask(id: string) {
    const supabase = createClient()
    await supabase
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  async function reopenTask(id: string) {
    const supabase = createClient()
    await supabase
      .from('tasks')
      .update({ status: 'todo', completed_at: null })
      .eq('id', id)
    await fetchTasks()
  }

  async function toggleFocus(id: string) {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const newFocus = !task.is_focus
    const supabase = createClient()
    await supabase
      .from('tasks')
      .update({ is_focus: newFocus, focus_date: newFocus ? todayISO() : null })
      .eq('id', id)
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, is_focus: newFocus, focus_date: newFocus ? todayISO() : null } : t
      )
    )
  }

  async function addComment(id: string, text: string) {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const newComment: Comment = {
      id: crypto.randomUUID(),
      text: text.trim(),
      created_at: new Date().toISOString(),
    }
    const updated = [...task.comments, newComment]
    const supabase = createClient()
    await supabase.from('tasks').update({ comments: updated as unknown as never }).eq('id', id)
    setTasks((prev) =>
      prev.map((t) => t.id === id ? { ...t, comments: updated } : t)
    )
  }

  async function deleteTask(id: string) {
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  async function bulkComplete(ids: string[]) {
    const supabase = createClient()
    await supabase
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .in('id', ids)
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)))
  }

  async function bulkDelete(ids: string[]) {
    const supabase = createClient()
    await supabase.from('tasks').delete().in('id', ids)
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)))
  }

  async function bulkUpdatePriority(ids: string[], priority: Task['priority']) {
    const supabase = createClient()
    await supabase.from('tasks').update({ priority }).in('id', ids)
    await fetchTasks()
  }

  async function starTask(id: string) {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const newVal = !task.is_starred
    const supabase = createClient()
    await supabase.from('tasks').update({ is_starred: newVal }).eq('id', id)
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, is_starred: newVal } : t))
  }

  async function duplicateTask(id: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    await supabase.from('tasks').insert({
      user_id: user.id,
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
      reminders: [] as unknown as never,
      is_starred: false,
      is_focus: false,
      labels: task.labels,
      subtasks: [] as unknown as never,
      estimated_time: task.estimated_time,
      attachments: [] as unknown as never,
      comments: [] as unknown as never,
      activity: [] as unknown as never,
      linked_tasks: [] as unknown as never,
      location: task.location,
    })
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
    addComment,
    deleteTask,
    duplicateTask,
    bulkComplete,
    bulkDelete,
    bulkUpdatePriority,
    starTask,
    refresh: fetchTasks,
  }
}
