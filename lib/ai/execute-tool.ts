import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { z } from 'zod'

// ─── Input schemas ────────────────────────────────────────────────────────────

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const CreateTaskInput = z.object({
  title: z.string().min(1).max(500),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: dateStr.optional().nullable(),
  status: z.enum(['inbox', 'todo', 'in_progress', 'done']).optional(),
  description: z.string().max(5000).optional().nullable(),
})

const CompleteTaskInput = z.object({
  task_id: z.string().uuid(),
})

const LogMoneyInput = z.object({
  amount: z.number().positive().max(10_000_000),
  category: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  date: dateStr.optional(),
})

const LogHabitInput = z.object({
  habit_name: z.string().min(1).max(200),
})

const CreateGoalInput = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(['personal', 'professional', 'health', 'financial', 'other']).optional(),
  target_date: dateStr.optional().nullable(),
})

const AddNoteInput = z.object({
  title: z.string().min(1).max(300),
  content: z.string().max(50_000),
  tags: z.array(z.string().max(50)).max(20).optional(),
})

const AddContactInput = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  type: z.enum(['personal', 'lead', 'prospect', 'client', 'network']).optional(),
})

const SearchDataInput = z.object({
  query: z.string().min(1).max(200),
  types: z.array(z.enum(['tasks', 'notes', 'contacts', 'goals'])).optional(),
})

const GetAnalyticsInput = z.object({
  period: z.enum(['week', 'month']).optional(),
})

const ListTasksInput = z.object({
  filter: z.enum(['all', 'inbox', 'today']).optional(),
})

const DeleteTaskInput = z.object({
  task_id: z.string().uuid(),
  task_title: z.string().max(500).optional(),
})

const BulkCompleteInput = z.object({
  task_ids: z.array(z.string().uuid()).min(1).max(100),
})

const DeleteNoteInput = z.object({
  note_id: z.string().uuid(),
  note_title: z.string().max(300).optional(),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ToolResult = { success: boolean; message: string; data?: unknown }

function dbErr(toolName: string, err: unknown): ToolResult {
  console.error(`[execute-tool] ${toolName}:`, err)
  return { success: false, message: 'Something went wrong. Please try again.' }
}

function badInput(): ToolResult {
  return { success: false, message: 'Invalid input for this action.' }
}

// ─── Executor ─────────────────────────────────────────────────────────────────

export async function executeTool(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const today = format(new Date(), 'yyyy-MM-dd')

  switch (toolName) {
    case 'create_task': {
      const p = CreateTaskInput.safeParse(input)
      if (!p.success) return badInput()
      const { error, data } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: p.data.title,
        priority: p.data.priority ?? 'medium',
        due_date: p.data.due_date ?? null,
        status: p.data.status ?? 'inbox',
        description: p.data.description ?? null,
        is_recurring: false,
        is_starred: false,
        tags: [],
        subtasks: [] as unknown as never,
        attachments: [] as unknown as never,
      }).select().single()
      if (error) return dbErr('create_task', error)
      return { success: true, message: `Created task: "${p.data.title}"`, data }
    }

    case 'list_tasks': {
      const p = ListTasksInput.safeParse(input)
      const filter = p.success ? (p.data.filter ?? 'all') : 'all'
      let query = supabase.from('tasks').select('id, title, priority, due_date, status').neq('status', 'done')
      if (filter === 'inbox') query = query.eq('status', 'inbox')
      else if (filter === 'today') query = query.or(`due_date.eq.${today},due_date.lt.${today}`)
      const { data, error } = await query.order('priority', { ascending: false }).limit(20)
      if (error) return dbErr('list_tasks', error)
      return { success: true, message: `Found ${data?.length ?? 0} tasks`, data }
    }

    case 'complete_task': {
      const p = CompleteTaskInput.safeParse(input)
      if (!p.success) return badInput()
      const { error, data } = await supabase.from('tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', p.data.task_id)
        .select('title').single()
      if (error) return dbErr('complete_task', error)
      return { success: true, message: `Completed task: "${data?.title}"` }
    }

    case 'log_expense': {
      const p = LogMoneyInput.safeParse(input)
      if (!p.success) return badInput()
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'expense',
        amount: p.data.amount,
        category: p.data.category,
        description: p.data.description ?? null,
        date: p.data.date ?? today,
        tags: [],
      })
      if (error) return dbErr('log_expense', error)
      return { success: true, message: `Logged expense: AED ${p.data.amount} for ${p.data.category}` }
    }

    case 'log_income': {
      const p = LogMoneyInput.safeParse(input)
      if (!p.success) return badInput()
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'income',
        amount: p.data.amount,
        category: p.data.category,
        description: p.data.description ?? null,
        date: p.data.date ?? today,
        tags: [],
      })
      if (error) return dbErr('log_income', error)
      return { success: true, message: `Logged income: AED ${p.data.amount} from ${p.data.category}` }
    }

    case 'log_habit': {
      const p = LogHabitInput.safeParse(input)
      if (!p.success) return badInput()
      const { data: habits } = await supabase.from('habits')
        .select('id, name').eq('active', true).ilike('name', `%${p.data.habit_name}%`).limit(1)
      if (!habits?.length) return { success: false, message: `No habit found matching "${p.data.habit_name}"` }
      const habit = habits[0]
      await supabase.from('habit_logs').upsert({
        user_id: user.id,
        habit_id: habit.id,
        logged_date: today,
        completed: true,
      })
      return { success: true, message: `Logged habit: "${habit.name}"` }
    }

    case 'create_goal': {
      const p = CreateGoalInput.safeParse(input)
      if (!p.success) return badInput()
      const { error, data } = await supabase.from('goals').insert({
        user_id: user.id,
        title: p.data.title,
        description: p.data.description ?? null,
        category: p.data.category ?? 'personal',
        target_date: p.data.target_date ?? null,
        progress: 0,
        status: 'active',
      }).select().single()
      if (error) return dbErr('create_goal', error)
      return { success: true, message: `Created goal: "${p.data.title}"`, data }
    }

    case 'add_note': {
      const p = AddNoteInput.safeParse(input)
      if (!p.success) return badInput()
      const { error } = await supabase.from('notes').insert({
        user_id: user.id,
        title: p.data.title,
        content: p.data.content,
        tags: p.data.tags ?? [],
        linked_to_type: null,
        linked_to_id: null,
      })
      if (error) return dbErr('add_note', error)
      return { success: true, message: `Saved note: "${p.data.title}"` }
    }

    case 'add_contact': {
      const p = AddContactInput.safeParse(input)
      if (!p.success) return badInput()
      const { error } = await supabase.from('contacts').insert({
        user_id: user.id,
        name: p.data.name,
        email: p.data.email ?? null,
        phone: p.data.phone ?? null,
        company: p.data.company ?? null,
        type: p.data.type ?? 'network',
        stage: 'new',
        tags: [],
      })
      if (error) return dbErr('add_contact', error)
      return { success: true, message: `Saved contact: "${p.data.name}"` }
    }

    case 'get_daily_briefing': {
      const [
        { data: todayTasks },
        { data: overdue },
        { data: habits },
        { data: todayLogs },
        { data: goals },
        { data: budgets },
        { data: monthExpenses },
        { data: followUps },
      ] = await Promise.all([
        supabase.from('tasks').select('title, priority').neq('status','done').eq('due_date', today).limit(10),
        supabase.from('tasks').select('title, due_date').neq('status','done').lt('due_date', today).limit(5),
        supabase.from('habits').select('name, icon').eq('active', true).contains('target_days', [new Date().getDay()]),
        supabase.from('habit_logs').select('habit_id').eq('logged_date', today).eq('completed', true),
        supabase.from('goals').select('title, progress').eq('status', 'active').limit(5),
        supabase.from('budgets').select('category, amount').gte('period_end', today),
        supabase.from('transactions').select('category, amount').eq('type', 'expense').gte('date', format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')),
        supabase.from('interactions').select('contacts(name), follow_up_date').lte('follow_up_date', today).not('follow_up_date', 'is', null).limit(5),
      ])

      const loggedIds = new Set((todayLogs ?? []).map((l: { habit_id: string }) => l.habit_id))
      const spendByCategory: Record<string, number> = {}
      for (const t of (monthExpenses ?? [])) spendByCategory[t.category] = (spendByCategory[t.category] ?? 0) + t.amount
      const budgetWarnings = (budgets ?? []).filter((b) => (spendByCategory[b.category] ?? 0) / b.amount >= 0.9)

      return {
        success: true,
        message: 'Daily briefing retrieved',
        data: {
          todayTasks,
          overdueTasks: overdue,
          habits: (habits ?? []).map((h: { name: string; icon: string }) => ({ ...h, done: loggedIds.has(h.name) })),
          goals,
          budgetWarnings,
          followUps,
        },
      }
    }

    case 'search_data': {
      const p = SearchDataInput.safeParse(input)
      if (!p.success) return badInput()
      const { query, types = ['tasks', 'notes', 'contacts', 'goals'] } = p.data
      const results: Record<string, unknown[]> = {}

      await Promise.all([
        types.includes('tasks') && supabase.from('tasks').select('id, title, status, priority').ilike('title', `%${query}%`).limit(5)
          .then(({ data }) => { results.tasks = data ?? [] }),
        types.includes('notes') && supabase.from('notes').select('id, title, content').or(`title.ilike.%${query}%,content.ilike.%${query}%`).limit(5)
          .then(({ data }) => { results.notes = data ?? [] }),
        types.includes('contacts') && supabase.from('contacts').select('id, name, company, email').ilike('name', `%${query}%`).limit(5)
          .then(({ data }) => { results.contacts = data ?? [] }),
        types.includes('goals') && supabase.from('goals').select('id, title, progress, status').ilike('title', `%${query}%`).limit(5)
          .then(({ data }) => { results.goals = data ?? [] }),
      ])

      const total = Object.values(results).reduce((s, arr) => s + arr.length, 0)
      return { success: true, message: `Found ${total} results for "${query}"`, data: results }
    }

    case 'get_analytics': {
      const p = GetAnalyticsInput.safeParse(input)
      const period = p.success ? (p.data.period ?? 'month') : 'month'
      const startDate = period === 'week'
        ? format(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
        : today.slice(0, 7) + '-01'

      const [txRes, taskRes, habitRes, habitLogRes, goalRes] = await Promise.all([
        supabase.from('transactions').select('type,amount,category').eq('user_id', user.id).gte('date', startDate),
        supabase.from('tasks').select('id,status').eq('user_id', user.id).gte('created_at', startDate),
        supabase.from('habits').select('id,name').eq('user_id', user.id),
        supabase.from('habit_logs').select('habit_id,completed').eq('user_id', user.id).gte('date', startDate),
        supabase.from('goals').select('id,status,progress').eq('user_id', user.id),
      ])

      const transactions = txRes.data ?? []
      const income = transactions.filter((t) => t.type === 'income').reduce((s: number, t) => s + (t.amount as number), 0)
      const expenses = transactions.filter((t) => t.type === 'expense').reduce((s: number, t) => s + (t.amount as number), 0)

      const tasks = taskRes.data ?? []
      const tasksCompleted = tasks.filter((t) => t.status === 'done').length

      const habits = habitRes.data ?? []
      const habitLogs = habitLogRes.data ?? []
      const habitsCompleted = habitLogs.filter((l) => l.completed).length

      const goals = goalRes.data ?? []
      const activeGoals = goals.filter((g) => g.status === 'active').length
      const completedGoals = goals.filter((g) => g.status === 'completed').length
      const avgProgress = goals.length > 0
        ? Math.round(goals.reduce((s: number, g) => s + ((g.progress as number) ?? 0), 0) / goals.length)
        : 0

      return {
        success: true,
        message: `Here's your ${period}ly analytics summary`,
        data: {
          period,
          finance: { income, expenses, net: income - expenses },
          tasks: { total: tasks.length, completed: tasksCompleted },
          habits: { tracked: habits.length, logsCompleted: habitsCompleted },
          goals: { active: activeGoals, completed: completedGoals, avgProgress },
        },
      }
    }

    // Approval-required tools — only reach here after user confirms
    case 'delete_task': {
      const p = DeleteTaskInput.safeParse(input)
      if (!p.success) return badInput()
      // Ownership preflight — defense in depth before RLS
      const { data: existing } = await supabase.from('tasks')
        .select('id').eq('id', p.data.task_id).eq('user_id', user.id).maybeSingle()
      if (!existing) return { success: false, message: 'Task not found' }
      const { error } = await supabase.from('tasks').delete().eq('id', p.data.task_id)
      if (error) return dbErr('delete_task', error)
      return { success: true, message: `Deleted task: "${p.data.task_title ?? 'task'}"` }
    }

    case 'bulk_complete_tasks': {
      const p = BulkCompleteInput.safeParse(input)
      if (!p.success) return badInput()
      const { error } = await supabase.from('tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .in('id', p.data.task_ids)
      if (error) return dbErr('bulk_complete_tasks', error)
      return { success: true, message: `Completed ${p.data.task_ids.length} tasks` }
    }

    case 'delete_note': {
      const p = DeleteNoteInput.safeParse(input)
      if (!p.success) return badInput()
      // Ownership preflight — defense in depth before RLS
      const { data: existing } = await supabase.from('notes')
        .select('id').eq('id', p.data.note_id).eq('user_id', user.id).maybeSingle()
      if (!existing) return { success: false, message: 'Note not found' }
      const { error } = await supabase.from('notes').delete().eq('id', p.data.note_id)
      if (error) return dbErr('delete_note', error)
      return { success: true, message: `Deleted note: "${p.data.note_title ?? 'note'}"` }
    }

    default:
      return { success: false, message: `Unknown tool: ${toolName}` }
  }
}
