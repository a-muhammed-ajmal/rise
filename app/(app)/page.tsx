import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckSquare, Heart, DollarSign, Target, Users, Phone, Mail, Star } from "lucide-react";
import { RiseLogo } from "@/components/brand/rise-logo";
import Link from "next/link";
import { formatAED, formatAEDCompact } from "@/lib/format";
import { sumExpenses } from "@/lib/finance";
import { StatCard } from "@/components/dashboard/stat-card";
import { HabitDashboardSection } from "@/components/wellness/habit-dashboard-section";

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
    { data: followUps },
    { data: starredFocusTasks },
    { count: completedTodayCount },
    { count: pendingTodayCount },
    { count: overdueCount },
    { count: activeGoalsCount },
    { data: todayExpenses },
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
      .contains("target_days", [new Date().getDay()])
      .order("reminder_time", { ascending: true, nullsFirst: false }),
    supabase
      .from("habit_logs")
      .select("habit_id, completed")
      .eq("logged_date", today),
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
    supabase
      .from("contacts")
      .select("id, name, email, phone, company, stage, last_contacted_at")
      .neq("type", "personal")
      .or(`last_contacted_at.is.null,last_contacted_at.lte.${format(new Date(new Date().getTime() - 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")}`)
      .order("last_contacted_at", { ascending: true, nullsFirst: true })
      .limit(3),
    // Starred focus tasks for today
    supabase
      .from("tasks")
      .select("id, title, priority")
      .eq("is_starred", true)
      .eq("due_date", today)
      .neq("status", "done")
      .order("priority", { ascending: true })
      .limit(3),
    // Completed today count
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("due_date", today)
      .eq("status", "done"),
    // Pending today count
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("due_date", today)
      .neq("status", "done"),
    // Exact overdue count (the overdue list above is capped at 3)
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .neq("status", "done")
      .lt("due_date", today),
    // Exact active goals count (the goals list above is capped at 3)
    supabase
      .from("goals")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    // All of today's expenses for the spend total
    supabase
      .from("transactions")
      .select("amount, type")
      .eq("date", today)
      .eq("type", "expense"),
  ]);

  const dueHabits = todayHabits ?? [];
  const completedCount = dueHabits.filter((h) =>
    habitLogs?.some((l) => l.habit_id === h.id && l.completed === true),
  ).length;

  const todayTotal = (completedTodayCount ?? 0) + (pendingTodayCount ?? 0);
  const spentToday = sumExpenses(todayExpenses ?? []);
  const expenseCount = todayExpenses?.length ?? 0;

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
      <div className="slide-up stagger-1">
        <p className="text-micro text-muted-foreground tracking-wide uppercase">{dayName}</p>
        <h1 className="text-display mt-1">{greeting}</h1>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-2 md:gap-3 slide-up stagger-2">
        <StatCard
          href="/productivity"
          label="Tasks"
          icon={CheckSquare}
          accent="tasks"
          value={String(pendingTodayCount ?? 0)}
          context={
            (overdueCount ?? 0) > 0
              ? `${overdueCount} overdue`
              : `${completedTodayCount ?? 0} of ${todayTotal} done`
          }
          contextTone={(overdueCount ?? 0) > 0 ? "danger" : "muted"}
        />
        <StatCard
          href="/wellness"
          label="Habits"
          icon={Heart}
          accent="wellness"
          value={`${completedCount}/${dueHabits.length}`}
          progress={dueHabits.length > 0 ? (completedCount / dueHabits.length) * 100 : 0}
        />
        <StatCard
          href="/goals"
          label="Goals"
          icon={Target}
          accent="goals"
          value={String(activeGoalsCount ?? 0)}
          context={activeGoals?.[0] ? `Top: ${activeGoals[0].progress}%` : undefined}
        />
        <StatCard
          href="/finance"
          label="Spent"
          icon={DollarSign}
          accent="finance"
          value={formatAEDCompact(spentToday)}
          context={`${expenseCount} expense${expenseCount === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's tasks */}
        <Card className="slide-up stagger-3 border-t-4 border-t-mod-tasks">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-mod-tasks-tint flex items-center justify-center">
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
            {/* Completion progress */}
            {((completedTodayCount ?? 0) + (pendingTodayCount ?? 0)) > 0 && (
              <div className="mb-3 space-y-1">
                <Progress
                  value={
                    ((completedTodayCount ?? 0) /
                      ((completedTodayCount ?? 0) + (pendingTodayCount ?? 0))) *
                    100
                  }
                  className="h-1.5"
                />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {completedTodayCount ?? 0}/
                  {(completedTodayCount ?? 0) + (pendingTodayCount ?? 0)} done today
                </p>
              </div>
            )}

            {/* Focus: starred tasks */}
            {starredFocusTasks && starredFocusTasks.length > 0 && (
              <div className="space-y-1 mb-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-warning)]">
                  Focus
                </p>
                {starredFocusTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 py-0.5">
                    <Star
                      className="w-3 h-3 fill-[var(--color-warning)] text-[var(--color-warning)] shrink-0"
                      aria-hidden="true"
                    />
                    <p className="text-sm truncate flex-1">{task.title}</p>
                  </div>
                ))}
                {(todayTasks?.length ?? 0) > 0 && (
                  <div className="h-px bg-border my-1" aria-hidden="true" />
                )}
              </div>
            )}

            {/* Overdue indicator */}
            {overdueTasks && overdueTasks.length > 0 && (
              <div className="text-xs text-destructive font-medium mb-1">
                {overdueTasks.length} overdue
              </div>
            )}

            {/* Regular today tasks */}
            {todayTasks && todayTasks.length > 0 ? (
              todayTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 py-1">
                  <div className="w-4 h-4 rounded border border-mod-tasks/40 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{task.title}</p>
                    <Badge
                      variant={task.priority === "P1" ? "destructive" : "secondary"}
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
        <Card className="slide-up stagger-4 border-t-4 border-t-mod-wellness">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-mod-wellness-tint flex items-center justify-center">
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
                  value={(completedCount / dueHabits.length) * 100}
                  className="h-2 mb-3"
                />
                <HabitDashboardSection
                  habits={dueHabits}
                  logs={habitLogs ?? []}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No habits due today.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Active goals */}
        <Card className="slide-up stagger-4 border-t-4 border-t-mod-goals">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-mod-goals-tint flex items-center justify-center">
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
        <Card className="slide-up stagger-4 border-t-4 border-t-brand border-brand/30 bg-brand-tint/40 shadow-brand">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-brand-tint flex items-center justify-center">
                <RiseLogo className="w-4 h-4" />
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
                  className="block text-xs text-brand-text hover:underline px-2 py-1.5 rounded-md bg-brand-tint/50 hover:bg-brand-tint transition-colors"
                >
                  &ldquo;{prompt}&rdquo;
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CRM contacts needing attention */}
      {followUps && followUps.length > 0 && (
        <Card className="slide-up stagger-4 border-t-4 border-t-mod-crm">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-mod-crm-tint flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-mod-crm" />
              </div>
              Touch Base
            </CardTitle>
            <Link
              href="/crm"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {followUps.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-mod-crm-tint flex items-center justify-center shrink-0">
                    <span className="text-mod-crm text-xs font-semibold">
                      {contact.name[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{contact.name}</p>
                    {contact.company && (
                      <p className="text-xs text-muted-foreground truncate">{contact.company}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      aria-label={`Email ${contact.name}`}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-mod-crm transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      aria-label={`Call ${contact.name}`}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-mod-crm transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  )}
                  <Badge variant="secondary" className="text-xs capitalize">
                    {contact.stage}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Today's finance */}
      {recentTransactions && recentTransactions.length > 0 && (
        <Card className="slide-up stagger-4 border-t-4 border-t-mod-finance">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-mod-finance-tint flex items-center justify-center">
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
                  className={`text-sm font-medium font-mono ${
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
