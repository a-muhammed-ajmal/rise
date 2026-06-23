import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckSquare, Heart, DollarSign, Target, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { formatAED } from '@/lib/format'

export default async function HomePage() {
  const supabase = await createClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [
    { data: todayTasks },
    { data: overdueTasks },
    { data: todayHabits },
    { data: habitLogs },
    { data: activeGoals },
    { data: recentTransactions },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .neq('status', 'done')
      .eq('due_date', today)
      .order('priority', { ascending: false })
      .limit(5),
    supabase
      .from('tasks')
      .select('*')
      .neq('status', 'done')
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(3),
    supabase
      .from('habits')
      .select('*')
      .eq('active', true)
      .contains('target_days', [new Date().getDay()]),
    supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('logged_date', today)
      .eq('completed', true),
    supabase
      .from('goals')
      .select('*')
      .eq('status', 'active')
      .order('progress', { ascending: false })
      .limit(3),
    supabase
      .from('transactions')
      .select('*')
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const loggedHabitIds = new Set((habitLogs ?? []).map((l) => l.habit_id))
  const dueHabits = todayHabits ?? []
  const completedCount = dueHabits.filter((h) => loggedHabitIds.has(h.id)).length

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const dayName = format(new Date(), 'EEEE, dd MMMM yyyy')

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">{dayName}</p>
        <h1 className="text-2xl font-bold mt-0.5">{greeting} 👋</h1>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/productivity">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckSquare className="w-8 h-8 text-blue-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold">{todayTasks?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Tasks today</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/wellness">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Heart className="w-8 h-8 text-rose-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold">
                  {completedCount}/{dueHabits.length}
                </p>
                <p className="text-xs text-muted-foreground">Habits done</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/goals">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Target className="w-8 h-8 text-purple-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold">{activeGoals?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active goals</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/finance">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-emerald-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold">{recentTransactions?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Txns today</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's tasks */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-500" />
              Today&apos;s Tasks
            </CardTitle>
            <Link href="/productivity" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueTasks && overdueTasks.length > 0 && (
              <div className="text-xs text-destructive font-medium mb-1">
                {overdueTasks.length} overdue
              </div>
            )}
            {todayTasks && todayTasks.length > 0 ? (
              todayTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 py-1">
                  <div className="w-4 h-4 rounded border border-muted-foreground/30 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{task.title}</p>
                    <Badge
                      variant={task.priority === 'urgent' ? 'destructive' : 'secondary'}
                      className="text-xs mt-0.5"
                    >
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No tasks due today. 🎉</p>
            )}
          </CardContent>
        </Card>

        {/* Today's habits */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" />
              Habits
            </CardTitle>
            <Link href="/wellness" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueHabits.length > 0 ? (
              <>
                <Progress
                  value={dueHabits.length > 0 ? (completedCount / dueHabits.length) * 100 : 0}
                  className="h-2 mb-3"
                />
                {dueHabits.map((habit) => {
                  const done = loggedHabitIds.has(habit.id)
                  return (
                    <div key={habit.id} className="flex items-center gap-2 py-1">
                      <span className={done ? 'opacity-100' : 'opacity-40'}>{habit.icon}</span>
                      <span className={`text-sm flex-1 ${done ? 'line-through text-muted-foreground' : ''}`}>
                        {habit.name}
                      </span>
                      {done && <span className="text-xs text-emerald-500">✓</span>}
                    </div>
                  )
                })}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No habits due today.</p>
            )}
          </CardContent>
        </Card>

        {/* Active goals */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-500" />
              Goals
            </CardTitle>
            <Link href="/goals" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeGoals && activeGoals.length > 0 ? (
              activeGoals.map((goal) => (
                <div key={goal.id} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm truncate flex-1 mr-2">{goal.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-1.5" />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No active goals yet.</p>
            )}
          </CardContent>
        </Card>

        {/* AI Assistant CTA */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask me anything about your tasks, goals, finances, or habits.
            </p>
            <div className="space-y-1.5">
              {[
                'What should I focus on today?',
                'How am I doing on my goals?',
                'Log AED 50 expense for coffee',
              ].map((prompt) => (
                <Link
                  key={prompt}
                  href={`/assistant?q=${encodeURIComponent(prompt)}`}
                  className="block text-xs text-primary hover:underline px-2 py-1 rounded bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                  &ldquo;{prompt}&rdquo;
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's finance */}
      {recentTransactions && recentTransactions.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              Today&apos;s Transactions
            </CardTitle>
            <Link href="/finance" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentTransactions.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm">{txn.description ?? txn.category}</p>
                  <p className="text-xs text-muted-foreground">{txn.category}</p>
                </div>
                <span
                  className={`text-sm font-medium ${
                    txn.type === 'income' ? 'text-emerald-500' : 'text-destructive'
                  }`}
                >
                  {txn.type === 'income' ? '+' : '-'}{formatAED(txn.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
