import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckSquare, Heart, DollarSign, Target, Sparkles } from "lucide-react";
import Link from "next/link";
import { formatAED } from "@/lib/format";

export default async function HomePage() {
  const supabase = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const [
    { data: todayTasks },
    { data: overdueTasks },
    { data: todayHabits },
    { data: habitLogs },
    { data: activeGoals },
    { data: recentTransactions },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .neq("status", "done")
      .eq("due_date", today)
      .order("priority", { ascending: false })
      .limit(5),
    supabase
      .from("tasks")
      .select("*")
      .neq("status", "done")
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(3),
    supabase
      .from("habits")
      .select("*")
      .eq("active", true)
      .contains("target_days", [new Date().getDay()]),
    supabase
      .from("habit_logs")
      .select("habit_id")
      .eq("logged_date", today)
      .eq("completed", true),
    supabase
      .from("goals")
      .select("*")
      .eq("status", "active")
      .order("progress", { ascending: false })
      .limit(3),
    supabase
      .from("transactions")
      .select("*")
      .eq("date", today)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const loggedHabitIds = new Set((habitLogs ?? []).map((l) => l.habit_id));
  const dueHabits = todayHabits ?? [];
  const completedCount = dueHabits.filter((h) =>
    loggedHabitIds.has(h.id),
  ).length;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  const dayName = format(new Date(), "EEEE, dd MMMM yyyy");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="animate-rise-in stagger-1">
        <p className="text-micro text-muted-foreground tracking-wide uppercase">{dayName}</p>
        <h1 className="text-display mt-1">{greeting}</h1>
      </div>

      {/* Quick stats */}
      <div className="grid [grid-template-columns:repeat(2,minmax(0,1fr))] md:grid-cols-4 gap-3 animate-rise-in stagger-2">
        <Link href="/productivity">
          <Card className="card-interactive cursor-pointer border-t-4 border-mod-tasks hover:border-mod-tasks/80">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-mod-tasks-soft flex items-center justify-center shrink-0">
                <CheckSquare className="w-5 h-5 text-mod-tasks" />
              </div>
              <div>
                <p className="text-metric font-mono font-medium">{todayTasks?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground truncate">Tasks today</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/wellness">
          <Card className="card-interactive cursor-pointer border-t-4 border-mod-wellness hover:border-mod-wellness/80">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-mod-wellness-soft flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5 text-mod-wellness" />
              </div>
              <div>
                <p className="text-metric font-mono font-medium">
                  {completedCount}/{dueHabits.length}
                </p>
                <p className="text-xs text-muted-foreground truncate">Habits done</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/goals">
          <Card className="card-interactive cursor-pointer border-t-4 border-mod-goals hover:border-mod-goals/80">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-mod-goals-soft flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-mod-goals" />
              </div>
              <div>
                <p className="text-metric font-mono font-medium">{activeGoals?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground truncate">Active goals</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/finance">
          <Card className="card-interactive cursor-pointer border-t-4 border-mod-finance hover:border-mod-finance/80">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-mod-finance-soft flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5 text-mod-finance" />
              </div>
              <div>
                <p className="text-metric font-mono font-medium">
                  {recentTransactions?.length ?? 0}
                </p>
                <p className="text-xs text-muted-foreground truncate">Txns today</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's tasks */}
        <Card className="animate-rise-in stagger-3">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-mod-tasks-soft flex items-center justify-center">
                <CheckSquare className="w-3.5 h-3.5 text-mod-tasks" />
              </div>
              Today&apos;s Tasks
            </CardTitle>
            <Link
              href="/productivity"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
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
                  <div className="w-4 h-4 rounded border border-mod-tasks/40 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{task.title}</p>
                    <Badge
                      variant={
                        task.priority === "urgent" ? "destructive" : "secondary"
                      }
                      className="text-xs mt-0.5"
                    >
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No tasks due today.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Today's habits */}
        <Card className="animate-rise-in stagger-4">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-mod-wellness-soft flex items-center justify-center">
                <Heart className="w-3.5 h-3.5 text-mod-wellness" />
              </div>
              Habits
            </CardTitle>
            <Link
              href="/wellness"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueHabits.length > 0 ? (
              <>
                <Progress
                  value={
                    dueHabits.length > 0
                      ? (completedCount / dueHabits.length) * 100
                      : 0
                  }
                  className="h-2 mb-3"
                />
                {dueHabits.map((habit) => {
                  const done = loggedHabitIds.has(habit.id);
                  return (
                    <div
                      key={habit.id}
                      className="flex items-center gap-2 py-1"
                    >
                      <span className={done ? "opacity-100" : "opacity-40"}>
                        {habit.icon}
                      </span>
                      <span
                        className={`text-sm flex-1 ${done ? "line-through text-muted-foreground" : ""}`}
                      >
                        {habit.name}
                      </span>
                      {done && (
                        <span className="text-xs text-mod-finance">✓</span>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No habits due today.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Active goals */}
        <Card className="animate-rise-in stagger-5">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-mod-goals-soft flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-mod-goals" />
              </div>
              Goals
            </CardTitle>
            <Link
              href="/goals"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeGoals && activeGoals.length > 0 ? (
              activeGoals.map((goal) => (
                <div key={goal.id} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm truncate flex-1 mr-2">
                      {goal.title}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {goal.progress}%
                    </span>
                  </div>
                  <Progress value={goal.progress} className="h-1.5" />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No active goals yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI Assistant CTA */}
        <Card className="animate-rise-in stagger-6 border-mod-ai/30 bg-gradient-to-br from-mod-ai-soft to-transparent shadow-[0_0_24px_rgba(109,40,217,0.08)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-mod-ai-soft flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-mod-ai" />
              </div>
              AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask me anything about your tasks, goals, finances, or habits.
            </p>
            <div className="space-y-1.5">
              {[
                "What should I focus on today?",
                "How am I doing on my goals?",
                "Log AED 50 expense for coffee",
              ].map((prompt) => (
                <Link
                  key={prompt}
                  href={`/assistant?q=${encodeURIComponent(prompt)}`}
                  className="block text-xs text-mod-ai hover:underline px-2 py-1.5 rounded-md bg-mod-ai-soft/50 hover:bg-mod-ai-soft transition-colors"
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
        <Card className="animate-rise-in stagger-6">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-mod-finance-soft flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-mod-finance" />
              </div>
              Today&apos;s Transactions
            </CardTitle>
            <Link
              href="/finance"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentTransactions.map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between py-1"
              >
                <div>
                  <p className="text-sm">{txn.description ?? txn.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {txn.category}
                  </p>
                </div>
                <span
                  className={`text-sm font-medium ${
                    txn.type === "income"
                      ? "text-mod-finance"
                      : "text-destructive"
                  }`}
                >
                  {txn.type === "income" ? "+" : "-"}
                  {formatAED(txn.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
