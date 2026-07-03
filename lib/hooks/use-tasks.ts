'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, Subtask, TaskAttachment } from '@/lib/types/database'
import { todayISO } from '@/lib/format'

type TaskFilter = 'inbox' | 'today' | 'all' | 'project' | 'completed'

export function useTasks(filter: TaskFilter = 'today', projectId?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    const supabase = createClient()
    let query = supabase
      .from('tasks')
      .select('*')
      .order('is_starred', { ascending: false })
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (filter === 'completed') {
      query = query.eq('status', 'done')
    } else {
      query = query.neq('status', 'done')
      if (filter === 'inbox') {
        query = query.eq('status', 'inbox')
      } else if (filter === 'today') {
        const today = todayISO()
        query = query.or(`due_date.eq.${today},due_date.lt.${today}`)
      } else if (filter === 'project' && projectId) {
        query = query.eq('project_id', projectId)
      }
    }

    const { data } = await query
    // Safely coerce JSON columns back to their typed forms
    const rows = (data ?? []).map((t) => ({
      ...t,
      subtasks: Array.isArray(t.subtasks) ? (t.subtasks as Subtask[]) : [],
      attachments: Array.isArray(t.attachments) ? (t.attachments as TaskAttachment[]) : [],
      tags: Array.isArray(t.tags) ? t.tags : [],
    }))
    setTasks(rows)
    setLoading(false)
  }, [filter, projectId])

  useEffect(() => {
    fetchTasks()

    const supabase = createClient()
    const channel = supabase
      .channel('tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchTasks])

  async function createTask(data: Partial<Task>): Promise<string | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: row } = await supabase.from('tasks').insert({
      user_id: user.id,
      title: data.title ?? '',
      description: data.description ?? null,
      status: data.status ?? 'inbox',
      priority: data.priority ?? 'medium',
      due_date: data.due_date ?? null,
      due_time: data.due_time ?? null,
      project_id: data.project_id ?? null,
      is_recurring: data.is_recurring ?? false,
      recurrence_rule: data.recurrence_rule ?? null,
      reminder_at: data.reminder_at ?? null,
      is_starred: data.is_starred ?? false,
      tags: data.tags ?? [],
      subtasks: (data.subtasks ?? []) as unknown as never,
      estimated_minutes: data.estimated_minutes ?? null,
      attachments: (data.attachments ?? []) as unknown as never,
    }).select('id').single()
    await fetchTasks()
    return row?.id ?? null
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const supabase = createClient()
    // Strip DB-managed fields that Supabase rejects in Update payloads
    const { id: _id, created_at: _c, updated_at: _u, user_id: _uid, ...safeUpdates } = updates
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
    const supabase = createClient()
    const newVal = !task.is_starred
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
      status: task.status === 'done' ? 'inbox' : task.status,
      priority: task.priority,
      due_date: task.due_date,
      due_time: task.due_time,
      project_id: task.project_id,
      is_recurring: false,
      recurrence_rule: null,
      reminder_at: null,
      is_starred: false,
      tags: task.tags,
      subtasks: [] as unknown as never,
      estimated_minutes: task.estimated_minutes,
      attachments: [] as unknown as never,
    })
    await fetchTasks()
  }

  return {
    tasks,
    loading,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    duplicateTask,
    bulkComplete,
    bulkDelete,
    bulkUpdatePriority,
    starTask,
    refresh: fetchTasks,
  }
}
