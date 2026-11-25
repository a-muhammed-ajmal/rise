import Link from "next/link";
import { Heart, Mail, Phone, Target, Users, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RiseLogo } from "@/components/brand/rise-logo";
import { formatAmount } from "@/lib/format";
import { goalTargetLabel, lastContactLabel } from "@/lib/home";
import type { ServerSnapshot } from "@/lib/data/snapshot";
import type { TaskSnapshotData } from "@/lib/data/tasks";
import type { HomeMoney } from "@/lib/data/home";
import type { Contact, Goal, Habit, HabitLog, Project } from "@/lib/types/database";
import { PageShell, PageHeader } from "@/components/layout/page-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { TasksStatCard } from "@/components/dashboard/tasks-stat-card";
import { TodayDataProvider } from "@/components/dashboard/today-data-provider";
import { TasksDashboardSection } from "@/components/dashboard/tasks-dashboard-section";
import { FocusTasksSection } from "@/components/dashboard/focus-tasks-section";
import { MoneyAttentionCard } from "@/components/dashboard/money-attention-card";
import { QuickAddFab } from "@/components/dashboard/quick-add-fab";
import { HabitDashboardSection } from "@/components/wellness/habit-dashboard-section";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";

const STAGE_COLORS: Record<string, string> = {
  new: "stage-new",
  qualified: "stage-qualified",
  proposal: "stage-proposal",
  negotiation: "stage-negotiation",
  won: "stage-won",
  lost: "stage-lost",
};

const AI_PROMPTS = [
  "What should I focus on today?",
  "How am I doing on my goals?",
  "Log AED 50 expense for coffee",
];

export type HomeFollowUp = Pick<
  Contact,
  "id" | "name" | "email" | "phone" | "company" | "stage" | "last_contacted_at"
>;

export type HomeData = {
  /** Today's Dubai date, "yyyy-MM-dd". */
  today: string;
  greeting: string;
  /** "Tuesday, 24 November 2026" */
  dayName: string;
  /** Active habits scheduled for today. */
  habits: Habit[];
  /** Their logs over the streak window, today included. */
  habitLogs: Pick<HabitLog, "habit_id" | "completed" | "logged_date">[];
  goals: Goal[];
  followUps: HomeFollowUp[];
  tasks: ServerSnapshot<TaskSnapshotData> | null;
  projects: ServerSnapshot<Project[]> | null;
  /** Null when the money queries failed: the tile reads "Unavailable". */
  money: ServerSnapshot<HomeMoney> | null;
};

// Home: greeting and the day's quote, three summaries (Tasks, Habits, Net
// worth), then today's work — Focus and Tasks beside Habits and money that
// needs attention — then people to contact and goals, and the assistant last.
// Rendered on the server from page.tsx's data; the interactive sections are
// their own client components.
export function HomeView({
  today,
  greeting,
  dayName,
  habits,
  habitLogs,
  goals,
  followUps,
  tasks,
  projects,
  money,
}: HomeData) {
  const completedHabits = habits.filter((h) =>
    habitLogs.some((l) => l.habit_id === h.id && l.logged_date === today && l.completed === true),
  ).length;

  const netWorth = money?.data.netWorth ?? null;

  return (
    <PageShell>
      <div className="space-y-3">
        <PageHeader title={greeting} eyebrow={dayName} />
        <MotivationalQuote date={today} />
      </div>

      <TodayDataProvider initial={{ tasks, projects }}>
        {/* Quick stats — three readable summaries on every screen */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 slide-up stagger-2">
          <TasksStatCard />
          <StatCard
            href="/wellness"
            label="Habits"
            icon={Heart}
            accent="wellness"
            value={`${completedHabits}/${habits.length}`}
            progress={
              habits.length > 0
                ? (completedHabits / habits.length) * 100
                : 0
            }
          />
          <StatCard
            href="/finance"
            label="Net worth"
            icon={Wallet}
            accent="finance"
            prefix={netWorth ? "AED" : undefined}
            value={netWorth ? formatAmount(netWorth.netWorth) : "—"}
            valueSize="amount"
          />
        </div>

        {/* Today's work. Tasks on the left; habits and money beside them on
            desktop, below them on a phone. */}
        <div className="grid items-start gap-6 md:grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
          <div className="min-w-0 space-y-6">
            <FocusTasksSection />
            <TasksDashboardSection />
          </div>
          <div className="min-w-0 space-y-6">
            <HabitDashboardSection habits={habits} logs={habitLogs} />
            {money && <MoneyAttentionCard items={money.data.attention} />}
          </div>
        </div>
      </TodayDataProvider>

      {/* People to contact, then goals. Either fills the row on its own. */}
      <div className="grid items-start gap-6 md:grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
        {followUps.length > 0 && (
          <Card className="home-card tone-crm slide-up stagger-4" aria-label="Touch base">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-md bg-mod-crm-tint flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Users className="w-3.5 h-3.5 text-mod-crm" />
                </div>
                Touch Base
              </CardTitle>
              <Link
                href="/crm"
                className="inline-flex min-h-11 items-center text-label text-brand-text hover:underline active:opacity-80"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {followUps.map((contact) => (
                <div
                  key={contact.id}
                  className="rounded-lg border border-border bg-card p-3 flex items-center gap-3"
                >
                  <div
                    className="home-avatar w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <span className="font-semibold">
                      {contact.name[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {contact.name}
                    </p>
                    {contact.company && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {contact.company}
                      </p>
                    )}
                    <p className="text-xs font-medium text-[var(--color-warning)] mt-0.5">
                      {lastContactLabel(contact.last_contacted_at, today)}
                    </p>
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
                          className="h-11 w-11 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-mod-crm transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                        </a>
                      )}
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          aria-label={`Call ${contact.name}`}
                          className="h-11 w-11 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-mod-crm transition-colors"
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

        <Card className="home-card tone-goals slide-up stagger-4" aria-label="Goals">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md bg-mod-goals-tint flex items-center justify-center"
                aria-hidden="true"
              >
                <Target className="w-3.5 h-3.5 text-mod-goals" />
              </div>
              Goals
            </CardTitle>
            <Link
              href="/goals"
              className="inline-flex min-h-11 items-center text-label text-brand-text hover:underline active:opacity-80"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {goals.length > 0 ? (
              goals.map((goal) => {
                const target = goalTargetLabel(goal.target_date, today);
                return (
                  <div
                    key={goal.id}
                    className="border-b border-border pb-4 space-y-2 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm min-w-0 break-words">
                        {goal.title}
                      </p>
                      {goal.category && (
                        <Badge
                          variant="secondary"
                          className="text-xs shrink-0 capitalize"
                        >
                          {goal.category}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span className="tabular-nums">{goal.progress}%</span>
                      </div>
                      <Progress
                        value={goal.progress}
                        className="h-2"
                        aria-label={`${goal.title} progress`}
                      />
                    </div>
                    {target && (
                      <p className="text-xs text-muted-foreground">{target}</p>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                No active goals yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Assistant — a slim strip at the end; the bottom bar's AI button
          is the main way in on a phone. */}
      <Card className="home-card tone-brand slide-up stagger-4" aria-label="AI Assistant">
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md bg-brand-tint flex items-center justify-center"
                aria-hidden="true"
              >
                <RiseLogo className="w-4 h-4" />
              </div>
              AI Assistant
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Ask about your tasks, goals, money or habits.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:justify-end">
            {AI_PROMPTS.map((prompt) => (
              <Link
                key={prompt}
                href={`/assistant?q=${encodeURIComponent(prompt)}`}
                className="home-prompt flex min-h-11 items-center text-sm text-brand-text px-3 py-2 rounded-md active:opacity-80"
              >
                &ldquo;{prompt}&rdquo;
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <QuickAddFab />
    </PageShell>
  );
}
