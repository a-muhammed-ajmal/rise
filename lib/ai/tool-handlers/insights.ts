// Cross-module reads: the daily briefing, analytics and search.
//
// Every query filters by user_id itself: the MCP path runs these handlers
// with a service-role client that bypasses RLS.
import { format, parseISO, startOfMonth } from "date-fns";
import { todayDOW, addDaysISO } from "@/lib/format";
import { z } from "zod";
import { dbErr, badInput, type ToolHandlers } from "./shared";

const SearchDataInput = z.object({
  query: z.string().min(1).max(200),
  types: z.array(z.enum(["tasks", "notes", "contacts", "goals"])).optional(),
  limit: z.number().int().positive().max(50).optional(),
});

const GetAnalyticsInput = z.object({
  period: z.enum(["week", "month"]).optional(),
});

export const insightHandlers = {
  get_daily_briefing: async ({ supabase, userId, today }) => {
    const monthStart = format(startOfMonth(parseISO(today)), "yyyy-MM-dd");
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
      supabase
        .from("tasks")
        .select("title, priority")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .neq("status", "done")
        .eq("due_date", today)
        .limit(10),
      supabase
        .from("tasks")
        .select("title, due_date")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .neq("status", "done")
        .lt("due_date", today)
        .limit(5),
      supabase
        .from("habits")
        .select("id, name, icon")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("active", true)
        .contains("target_days", [todayDOW()]),
      supabase
        .from("habit_logs")
        .select("habit_id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("logged_date", today)
        .eq("completed", true),
      supabase
        .from("goals")
        .select("title, progress")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .limit(5),
      // Budgets are standing settings that repeat every month, so a live
      // budget counts whatever its period dates say.
      supabase
        .from("budgets")
        .select("category, amount")
        .eq("user_id", userId)
        .is("deleted_at", null),
      supabase
        .from("transactions")
        .select("category, amount")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("type", "expense")
        .gte("date", monthStart),
      // !inner turns the embedded contact into a join filter, so a follow-up
      // whose contact has been deleted drops out of the briefing entirely
      // rather than surfacing with the deleted contact's name attached.
      supabase
        .from("interactions")
        .select("contacts!inner(name), follow_up_date")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .is("contacts.deleted_at", null)
        .lte("follow_up_date", today)
        .not("follow_up_date", "is", null)
        .limit(5),
    ]);

    const loggedIds = new Set(
      (todayLogs ?? []).map((l: { habit_id: string }) => l.habit_id),
    );
    const spendByCategory: Record<string, number> = {};
    for (const t of monthExpenses ?? [])
      spendByCategory[t.category] =
        (spendByCategory[t.category] ?? 0) + t.amount;
    const budgetWarnings = (budgets ?? []).filter(
      (b) => (spendByCategory[b.category] ?? 0) / b.amount >= 0.9,
    );

    return {
      success: true,
      message: "Daily briefing retrieved",
      data: {
        todayTasks,
        overdueTasks: overdue,
        // loggedIds holds habit_id — match on id, not name.
        habits: (habits ?? []).map(
          (h: { id: string; name: string; icon: string }) => ({
            ...h,
            done: loggedIds.has(h.id),
          }),
        ),
        goals,
        budgetWarnings,
        followUps,
      },
    };
  },

  search_data: async ({ input, supabase, userId }) => {
    const p = SearchDataInput.safeParse(input);
    if (!p.success) return badInput();
    const {
      query,
      types = ["tasks", "notes", "contacts", "goals"],
      limit: searchLimit = 5,
    } = p.data;
    const results: Record<string, unknown[]> = {};

    await Promise.all([
      types.includes("tasks") &&
        supabase
          .from("tasks")
          .select("id, title, status, priority")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .ilike("title", `%${query}%`)
          .limit(searchLimit)
          .then(({ data }) => {
            results.tasks = data ?? [];
          }),
      types.includes("notes") &&
        Promise.all([
          supabase
            .from("notes")
            .select("id, title, content")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .ilike("title", `%${query}%`)
            .limit(searchLimit),
          supabase
            .from("notes")
            .select("id, title, content")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .ilike("content", `%${query}%`)
            .limit(searchLimit),
        ]).then(([byTitle, byContent]) => {
          const seen = new Set<string>();
          const combined = [
            ...(byTitle.data ?? []),
            ...(byContent.data ?? []),
          ];
          results.notes = combined
            .filter((n) => !seen.has(n.id) && seen.add(n.id) !== undefined)
            .slice(0, searchLimit);
        }),
      types.includes("contacts") &&
        supabase
          .from("contacts")
          .select("id, name, company, email")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .ilike("name", `%${query}%`)
          .limit(searchLimit)
          .then(({ data }) => {
            results.contacts = data ?? [];
          }),
      types.includes("goals") &&
        supabase
          .from("goals")
          .select("id, title, progress, status")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .ilike("title", `%${query}%`)
          .limit(searchLimit)
          .then(({ data }) => {
            results.goals = data ?? [];
          }),
    ]);

    const total = Object.values(results).reduce(
      (s, arr) => s + arr.length,
      0,
    );
    return {
      success: true,
      message: `Found ${total} results for "${query}"`,
      data: results,
    };
  },

  get_analytics: async ({ input, supabase, userId, today }) => {
    const p = GetAnalyticsInput.safeParse(input);
    const period = p.success ? (p.data.period ?? "month") : "month";
    // Both boundaries are Dubai calendar dates so they line up with the
    // date columns they are compared against.
    const startDate =
      period === "week" ? addDaysISO(today, -6) : today.slice(0, 7) + "-01";

    const [txRes, taskRes, habitRes, habitLogRes, goalRes] =
      await Promise.all([
        supabase
          .from("transactions")
          .select("type,amount,category")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .gte("date", startDate),
        supabase
          .from("tasks")
          .select("id,status")
          .eq("user_id", userId)
          .is("deleted_at", null)
          // created_at is timestamptz — anchor to the start of the Dubai day
          // rather than relying on an implicit midnight-UTC cast.
          .gte("created_at", `${startDate}T00:00:00+04:00`),
        supabase
          .from("habits")
          .select("id,name")
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabase
          .from("habit_logs")
          .select("habit_id,completed")
          .eq("user_id", userId)
          .is("deleted_at", null)
          // Schema column is logged_date (001_schema.sql), not date.
          .gte("logged_date", startDate),
        supabase
          .from("goals")
          .select("id,status,progress")
          .eq("user_id", userId)
          .is("deleted_at", null),
      ]);

    // Reporting zeros for a failed query would look like a genuinely empty
    // period — surface the failure instead.
    const analyticsError =
      txRes.error ??
      taskRes.error ??
      habitRes.error ??
      habitLogRes.error ??
      goalRes.error;
    if (analyticsError) return dbErr("get_analytics", analyticsError);

    const transactions = txRes.data ?? [];
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const tasks = taskRes.data ?? [];
    const tasksCompleted = tasks.filter((t) => t.status === "done").length;

    const habits = habitRes.data ?? [];
    const habitLogs = habitLogRes.data ?? [];
    const habitsCompleted = habitLogs.filter((l) => l.completed).length;

    const goals = goalRes.data ?? [];
    const activeGoals = goals.filter((g) => g.status === "active").length;
    const completedGoals = goals.filter(
      (g) => g.status === "completed",
    ).length;
    const avgProgress =
      goals.length > 0
        ? Math.round(
            goals.reduce((sum, goal) => sum + goal.progress, 0) /
              goals.length,
          )
        : 0;

    return {
      success: true,
      message: `Here's your ${period}ly analytics summary`,
      data: {
        period,
        finance: { income, expenses, net: income - expenses },
        tasks: { total: tasks.length, completed: tasksCompleted },
        habits: { tracked: habits.length, logsCompleted: habitsCompleted },
        goals: {
          active: activeGoals,
          completed: completedGoals,
          avgProgress,
        },
      },
    };
  },
} satisfies ToolHandlers;
