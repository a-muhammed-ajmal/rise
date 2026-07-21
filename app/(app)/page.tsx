import { createClient } from "@/lib/supabase/server";
import { format, parseISO, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckSquare, Heart, DollarSign, Target, Users, Phone, Mail, AlertTriangle, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { RiseLogo } from "@/components/brand/rise-logo";
import Link from "next/link";
import { formatAED, formatDate, todayISO, todayDOW, currentHourDubai } from "@/lib/format";
import { StatCard } from "@/components/dashboard/stat-card";
import { TasksDashboardSection } from "@/components/dashboard/tasks-dashboard-section";
import { FocusTasksSection } from "@/components/dashboard/focus-tasks-section";
import { QuickAddFab } from "@/components/dashboard/quick-add-fab";
import { HabitDashboardSection } from "@/components/wellness/habit-dashboard-section";

const STAGE_COLORS: Record<string, string> = {
  new: "stage-new",
  qualified: "stage-qualified",
  proposal: "stage-proposal",
  negotiation: "stage-negotiation",
  won: "stage-won",
  lost: "stage-lost",
};

export default async function HomePage() {
  const supabase = await createClient();
  const today = todayISO();

  const last30 = format(subDays(parseISO(today), 30), "yyyy-MM-dd");

  const [
    { data: todayHabits },
    { data: habitLogs },
    { data: activeGoals },
    { data: recentTransactions },
    { data: followUps },
    { count: completedTodayCount },
    { count: pendingTodayCount },
    { count: overdueCount },
  ] = await Promise.all([
    supabase
      .from("habits")
      .select("*")
      .eq("active", true)
      .contains("target_days", [todayDOW()])
      .order("reminder_time", { ascending: true, nullsFirst: false }),
    supabase
      .from("habit_logs")
      .select("habit_id, completed, logged_date")
      .gte("logged_date", last30),
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
      .or(`last_contacted_at.is.null,last_contacted_at.lte.${format(subDays(parseISO(today), 14), "yyyy-MM-dd")}`)
      .order("last_contacted_at", { ascending: true, nullsFirst: true })
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
    // Exact overdue count
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .neq("status", "done")
      .lt("due_date", today),
  ]);

  const dueHabits = todayHabits ?? [];
  const todayHabitLogs = (habitLogs ?? []).filter((l) => l.logged_date === today);
  const completedCount = dueHabits.filter((h) =>
    todayHabitLogs.some((l) => l.habit_id === h.id && l.completed === true),
  ).length;

  const todayTotal = (completedTodayCount ?? 0) + (pendingTodayCount ?? 0);

  const greeting = (() => {
    const hour = currentHourDubai();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  const dayName = format(parseISO(today), "EEEE, dd MMMM yyyy");

  return (
    <div className="p-3 md:p-5 space-y-5 max-w-4xl">
      {/* Header */}
      <div className="slide-up stagger-1">
        <p className="text-micro text-muted-foreground tracking-wide uppercase">{dayName}</p>
        <h1 className="text-display mt-1">{greeting}</h1>
      </div>

      {/* Quick stats — max 3 per line on mobile; extra cards scroll horizontally */}
      <div className="grid grid-flow-col auto-cols-[calc((100%-1rem)/3)] gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory md:grid-flow-row md:grid-cols-3 md:auto-cols-auto md:gap-3 md:overflow-visible slide-up stagger-2">
        <StatCard
          href="/productivity"
          label="Tasks"
          icon={CheckSquare}
          accent="tasks"
          value={String(pendingTodayCount ?? 0)}
          context={`${completedTodayCount ?? 0} of ${todayTotal} done`}
          className="snap-start"
        />
        <StatCard
          href="/wellness"
          label="Habits"
          icon={Heart}
          accent="wellness"
          value={`${completedCount}/${dueHabits.length}`}
          progress={dueHabits.length > 0 ? (completedCount / dueHabits.length) * 100 : 0}
          className="snap-start"
        />
        <StatCard
          href="/productivity"
          label="Overdue"
          icon={AlertTriangle}
          accent="danger"
          value={String(overdueCount ?? 0)}
          context={(overdueCount ?? 0) > 0 ? "needs attention" : "all clear"}
          contextTone={(overdueCount ?? 0) > 0 ? "danger" : "muted"}
          className="snap-start"
        />
      </div>

      {/* Primary daily sections — Focus → Habits → Tasks */}
      <div className="space-y-4">
        {/* Today's focus */}
        <FocusTasksSection />

        {/* Today's habits */}
        <Card className="slide-up stagger-2 border-t-4 border-t-mod-wellness">
          <CardHeader className="pb-2 flex-row items-center justify-between">
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

        {/* Today's tasks */}
        <TasksDashboardSection />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Active goals */}
        <Card className="slide-up stagger-4 border-t-4 border-t-mod-goals">
          <CardHeader className="pb-2 flex-row items-center justify-between">
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
          <CardContent className="space-y-2">
            {activeGoals && activeGoals.length > 0 ? (
              activeGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="rounded-lg border border-border bg-card p-3 space-y-2 card-hover"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm min-w-0 truncate">{goal.title}</p>
                    {goal.category && (
                      <Badge variant="secondary" className="text-xs shrink-0 capitalize">
                        {goal.category}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                  </div>
                  {goal.target_date && (
                    <p className="text-xs text-muted-foreground">
                      Target: {formatDate(goal.target_date)}
                    </p>
                  )}
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
          <CardHeader className="pb-2">
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
          <CardHeader className="pb-2 flex-row items-center justify-between">
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
              <div
                key={contact.id}
                className="rounded-lg border border-border bg-card p-3 flex items-center gap-3 border-l-4 border-l-mod-crm card-hover"
              >
                <div className="w-10 h-10 rounded-full bg-mod-crm-tint flex items-center justify-center shrink-0">
                  <span className="text-mod-crm font-semibold">
                    {contact.name[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{contact.name}</p>
                  {contact.company && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {contact.company}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <Badge
                    variant="secondary"
                    className={`text-xs capitalize ${STAGE_COLORS[contact.stage] ?? ""}`}
                  >
                    {contact.stage}
                  </Badge>
                  <div className="flex gap-1">
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        aria-label={`Email ${contact.name}`}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-mod-crm transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        aria-label={`Call ${contact.name}`}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-mod-crm transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Today's finance */}
      {recentTransactions && recentTransactions.length > 0 && (
        <Card className="slide-up stagger-4 border-t-4 border-t-mod-finance">
          <CardHeader className="pb-2 flex-row items-center justify-between">
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
                className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-mod-finance-tint shrink-0">
                    {txn.type === "income" ? (
                      <ArrowUpRight className="w-4 h-4 text-mod-finance" aria-hidden="true" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 text-destructive" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {txn.description ?? txn.category}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{txn.category}</p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold font-mono shrink-0 ${
                    txn.type === "income" ? "text-mod-finance" : "text-destructive"
                  }`}
                >
                  {txn.type === "income" ? "+" : "−"}
                  {formatAED(txn.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <QuickAddFab />
    </div>
  );
}
