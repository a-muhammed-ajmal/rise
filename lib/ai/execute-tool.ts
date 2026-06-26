import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

type ToolResult = { success: boolean; message: string; data?: unknown }

export async function executeTool(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const today = format(new Date(), 'yyyy-MM-dd')

  switch (toolName) {
    case 'create_task': {
      const { error, data } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: input.title as string,
        priority: ((input.priority ?? 'medium') as 'low' | 'medium' | 'high' | 'urgent'),
        due_date: (input.due_date as string) ?? null,
        status: ((input.status ?? 'inbox') as 'inbox' | 'todo' | 'in_progress' | 'done'),
        description: (input.description as string) ?? null,
        is_recurring: false,
      }).select().single()
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Created task: "${input.title}"`, data }
    }

    case 'list_tasks': {
      const filter = input.filter as string ?? 'all'
      let query = supabase.from('tasks').select('id, title, priority, due_date, status').neq('status', 'done')
      if (filter === 'inbox') query = query.eq('status', 'inbox')
      else if (filter === 'today') query = query.or(`due_date.eq.${today},due_date.lt.${today}`)
      const { data, error } = await query.order('priority', { ascending: false }).limit(20)
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Found ${data?.length ?? 0} tasks`, data }
    }

    case 'complete_task': {
      const { error, data } = await supabase.from('tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', input.task_id as string)
        .select('title').single()
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Completed task: "${data?.title}"` }
    }

    case 'log_expense': {
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'expense',
        amount: input.amount as number,
        category: input.category as string,
        description: (input.description as string) ?? null,
        date: (input.date as string) ?? today,
        tags: [],
      })
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Logged expense: AED ${input.amount} for ${input.category}` }
    }

    case 'log_income': {
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'income',
        amount: input.amount as number,
        category: input.category as string,
        description: (input.description as string) ?? null,
        date: (input.date as string) ?? today,
        tags: [],
      })
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Logged income: AED ${input.amount} from ${input.category}` }
    }

    case 'log_habit': {
      const { data: habits } = await supabase.from('habits')
        .select('id, name').eq('active', true).ilike('name', `%${input.habit_name}%`).limit(1)
      if (!habits?.length) return { success: false, message: `No habit found matching "${input.habit_name}"` }
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
      const { error, data } = await supabase.from('goals').insert({
        user_id: user.id,
        title: input.title as string,
        description: (input.description as string) ?? null,
        category: ((input.category ?? 'personal') as 'personal' | 'professional' | 'health' | 'financial' | 'other'),
        target_date: (input.target_date as string) ?? null,
        progress: 0,
        status: 'active',
      }).select().single()
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Created goal: "${input.title}"`, data }
    }

    case 'add_note': {
      const { error } = await supabase.from('notes').insert({
        user_id: user.id,
        title: input.title as string,
        content: input.content as string,
        tags: (input.tags as string[]) ?? [],
        linked_to_type: null,
        linked_to_id: null,
      })
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Saved note: "${input.title}"` }
    }

    case 'add_contact': {
      const { error } = await supabase.from('contacts').insert({
        user_id: user.id,
        name: input.name as string,
        email: (input.email as string) ?? null,
        phone: (input.phone as string) ?? null,
        company: (input.company as string) ?? null,
        type: ((input.type ?? 'network') as 'personal' | 'lead' | 'prospect' | 'client' | 'network'),
        stage: 'new',
        tags: [],
      })
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Saved contact: "${input.name}"` }
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
      const query = input.query as string
      const types = (input.types as string[]) ?? ['tasks','notes','contacts','goals']
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
      const period = (input.period as string | undefined) ?? 'month'
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

      const data = {
        period,
        finance: { income, expenses, net: income - expenses },
        tasks: { total: tasks.length, completed: tasksCompleted },
        habits: { tracked: habits.length, logsCompleted: habitsCompleted },
        goals: { active: activeGoals, completed: completedGoals, avgProgress },
      }
      return { success: true, message: `Here's your ${period}ly analytics summary`, data }
    }

    // Approval-required tools executed after user confirms
    case 'delete_task': {
      const { error } = await supabase.from('tasks').delete().eq('id', input.task_id as string)
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Deleted task: "${input.task_title}"` }
    }

    case 'bulk_complete_tasks': {
      const ids = input.task_ids as string[]
      const { error } = await supabase.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).in('id', ids)
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Completed ${ids.length} tasks` }
    }

    case 'delete_note': {
      const { error } = await supabase.from('notes').delete().eq('id', input.note_id as string)
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Deleted note: "${input.note_title}"` }
    }

    default:
      return { success: false, message: `Unknown tool: ${toolName}` }
  }
}
