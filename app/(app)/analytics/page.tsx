import { createClient } from "@/lib/supabase/server"
import { format, subDays, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns"
import { DollarSign, Heart, Target, CheckSquare } from "lucide-react"
import Link from "next/link"
import { FinanceCharts } from "@/components/analytics/finance-charts"
import { WellnessCharts } from "@/components/analytics/wellness-charts"
import { GoalsCharts } from "@/components/analytics/goals-charts"
import { TasksCharts } from "@/components/analytics/tasks-charts"
import type { Transaction, Budget, Habit, HabitLog, JournalEntry, FocusSession, Goal, Task } from "@/lib/types/database"

// ── Aggregation helpers ───────────────────────────────────────────────────────

function buildMonthlyFlow(txns: Transaction[], today: Date) {
  const map = new Map<string, { income: number; expense: number }>()
  for (let i = 5; i >= 0; i--) {
    map.set(format(subMonths(today, i), "yyyy-MM"), { income: 0, expense: 0 })
  }
  for (const t of txns) {
    const key = t.date.slice(0, 7)
    const entry = map.get(key)
    if (entry) {
      if (t.type === "income") entry.income += t.amount
      else entry.expense += t.amount
    }
  }
  return Array.from(map.entries()).map(([month, v]) => ({
    month: format(parseISO(month + "-01"), "MMM yy"),
    income: Math.round(v.income),
    expense: Math.round(v.expense),
  }))
}

function buildCategorySpend(txns: Transaction[]) {
  const map = new Map<string, number>()
  for (const t of txns.filter((t) => t.type === "expense")) {
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
  }
  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  const top5 = sorted.slice(0, 5)
  const otherAmount = sorted.slice(5).reduce((sum, [, v]) => sum + v, 0)
  return [
    ...top5.map(([category, amount]) => ({ category, amount: Math.round(amount) })),
    ...(otherAmount > 0 ? [{ category: "Other", amount: Math.round(otherAmount) }] : []),
  ]
}

function buildBudgetActual(budgets: Pick<Budget, "category" | "amount">[], txns: Transaction[], monthStart: string, monthEnd: string) {
  const actualMap = new Map<string, number>()
  for (const t of txns.filter((t) => t.type === "expense" && t.date >= monthStart && t.date <= monthEnd)) {
    actualMap.set(t.category, (actualMap.get(t.category) ?? 0) + t.amount)
  }
  return budgets
    .filter((b) => b.amount > 0)
    .map((b) => ({ category: b.category, budget: b.amount, actual: Math.round(actualMap.get(b.category) ?? 0) }))
}

function buildHabitRates(habits: Habit[], logs: HabitLog[], today: Date) {
  const last30 = Array.from({ length: 30 }, (_, i) => format(subDays(today, i), "yyyy-MM-dd"))
  return habits.map((habit) => {
    const expectedDays = last30.filter((d) => habit.target_days.includes(parseISO(d).getDay()))
    const completedCount = logs.filter(
      (l) => l.habit_id === habit.id && l.completed && last30.includes(l.logged_date)
    ).length
    const rate = expectedDays.length > 0 ? Math.round((completedCount / expectedDays.length) * 100) : 0
    return { name: habit.name, icon: habit.icon, rate }
  })
}

function buildFocusMinutes(sessions: FocusSession[], today: Date) {
  const map = new Map<string, number>()
  for (let i = 13; i >= 0; i--) {
    map.set(format(subDays(today, i), "yyyy-MM-dd"), 0)
  }
  for (const s of sessions) {
    const day = s.started_at.slice(0, 10)
    if (map.has(day)) map.set(day, (map.get(day) ?? 0) + s.duration_minutes)
  }
  return Array.from(map.entries()).map(([d, minutes]) => ({
    date: format(parseISO(d), "dd/MM"),
    minutes,
  }))
}

function buildGoalByStatus(goals: Goal[]) {
  const map = new Map<string, number>()
  for (const g of goals) map.set(g.status, (map.get(g.status) ?? 0) + 1)
  return Array.from(map.entries()).map(([status, count]) => ({ status, count }))
}

function buildGoalByCategory(goals: Goal[]) {
  const map = new Map<string, number>()
  for (const g of goals) map.set(g.category, (map.get(g.category) ?? 0) + 1)
  return Array.from(map.entries()).map(([category, count]) => ({ category, count }))
}

function buildTaskByStatus(tasks: Task[]) {
  const map = new Map<string, number>()
  for (const t of tasks) map.set(t.status, (map.get(t.status) ?? 0) + 1)
  return Array.from(map.entries()).map(([status, count]) => ({ status, count }))
}

function buildCompletedPerDay(tasks: Task[], today: Date) {
  const map = new Map<string, number>()
  for (let i = 13; i >= 0; i--) {
    map.set(format(subDays(today, i), "yyyy-MM-dd"), 0)
  }
  for (const t of tasks) {
    if (t.completed_at) {
      const day = t.completed_at.slice(0, 10)
      if (map.has(day)) map.set(day, (map.get(day) ?? 0) + 1)
    }
  }
  return Array.from(map.entries()).map(([d, count]) => ({
    date: format(parseISO(d), "dd/MM"),
    count,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const today = new Date()

  const sixMonthsAgo = format(subMonths(today, 6), "yyyy-MM-dd")
  const thirtyDaysAgo = format(subDays(today, 30), "yyyy-MM-dd")
  const fourteenDaysAgo = format(subDays(today, 14), "yyyy-MM-dd")
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd")
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd")

  const [
    { data: transactions },
    { data: budgets },
    { data: habits },
    { data: habitLogs },
    { data: journalEntries },
    { data: focusSessions },
    { data: goals },
    { data: tasks },
  ] = await Promise.all([
    supabase.from("transactions").select("type,amount,category,date").gte("date", sixMonthsAgo).order("date"),
    supabase.from("budgets").select("category,amount").eq("period", "monthly").gte("period_start", monthStart).lte("period_end", monthEnd),
    supabase.from("habits").select("id,name,icon,target_days").eq("active", true),
    supabase.from("habit_logs").select("habit_id,logged_date,completed").gte("logged_date", thirtyDaysAgo),
    supabase.from("journal_entries").select("date,mood").gte("date", thirtyDaysAgo).not("mood", "is", null).order("date"),
    supabase.from("focus_sessions").select("duration_minutes,started_at").gte("started_at", fourteenDaysAgo + "T00:00:00"),
    supabase.from("goals").select("title,status,category,progress"),
    supabase.from("tasks").select("status,priority,completed_at"),
  ])

  // Finance aggregations
  const txns = transactions ?? []
  const monthlyFlow = buildMonthlyFlow(txns as Transaction[], today)
  const categorySpend = buildCategorySpend(txns as Transaction[])
  const budgetActual = buildBudgetActual(
    (budgets ?? []) as Pick<Budget, "category" | "amount">[],
    txns as Transaction[],
    monthStart,
    monthEnd,
  )

  // Wellness aggregations
  const habitRates = buildHabitRates((habits ?? []) as Habit[], (habitLogs ?? []) as HabitLog[], today)
  const moodTrend = ((journalEntries ?? []) as Pick<JournalEntry, "date" | "mood">[])
    .filter((e) => typeof e.mood === "number" && e.mood > 0)
    .map((e) => ({ date: format(parseISO(e.date), "dd/MM"), mood: e.mood as number }))
  const focusMinutes = buildFocusMinutes((focusSessions ?? []) as FocusSession[], today)

  // Goals aggregations
  const goalList = (goals ?? []) as Goal[]
  const goalByStatus = buildGoalByStatus(goalList)
  const goalByCategory = buildGoalByCategory(goalList)
  const activeGoals = goalList
    .filter((g) => g.status === "active")
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 8)
    .map((g) => ({
      title: g.title.length > 22 ? g.title.slice(0, 22) + "…" : g.title,
      progress: g.progress,
    }))

  // Tasks aggregations
  const taskList = (tasks ?? []) as Task[]
  const taskByStatus = buildTaskByStatus(taskList)
  const taskByPriority = (["low", "medium", "high", "urgent"] as const).map((p) => ({
    priority: p,
    count: taskList.filter((t) => t.priority === p).length,
  }))
  const completedPerDay = buildCompletedPerDay(taskList, today)

  return (
    <div className="p-4 md:p-6 space-y-10 max-w-6xl">
      {/* Page header */}
      <div className="animate-rise-in stagger-1">
        <h1 className="text-step-2">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Your RISE data at a glance</p>
      </div>

      {/* Finance section */}
      <section className="space-y-4 animate-rise-in stagger-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-mod-finance-soft flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-mod-finance" />
            </div>
            <h2 className="text-base font-semibold">Finance</h2>
          </div>
          <Link href="/finance" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View module →
          </Link>
        </div>
        <FinanceCharts monthlyFlow={monthlyFlow} categorySpend={categorySpend} budgetActual={budgetActual} />
      </section>

      {/* Wellness section */}
      <section className="space-y-4 animate-rise-in stagger-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-mod-wellness-soft flex items-center justify-center">
              <Heart className="w-4 h-4 text-mod-wellness" />
            </div>
            <h2 className="text-base font-semibold">Wellness</h2>
          </div>
          <Link href="/wellness" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View module →
          </Link>
        </div>
        <WellnessCharts habitRates={habitRates} moodTrend={moodTrend} focusMinutes={focusMinutes} />
      </section>

      {/* Goals section */}
      <section className="space-y-4 animate-rise-in stagger-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-mod-goals-soft flex items-center justify-center">
              <Target className="w-4 h-4 text-mod-goals" />
            </div>
            <h2 className="text-base font-semibold">Goals</h2>
          </div>
          <Link href="/goals" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View module →
          </Link>
        </div>
        <GoalsCharts byStatus={goalByStatus} byCategory={goalByCategory} activeGoals={activeGoals} />
      </section>

      {/* Productivity section */}
      <section className="space-y-4 animate-rise-in stagger-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-mod-tasks-soft flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-mod-tasks" />
            </div>
            <h2 className="text-base font-semibold">Productivity</h2>
          </div>
          <Link href="/productivity" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View module →
          </Link>
        </div>
        <TasksCharts byStatus={taskByStatus} byPriority={taskByPriority} completedPerDay={completedPerDay} />
      </section>
    </div>
  )
}
