import { GoogleGenAI } from "@google/genai";
import { format, subDays } from "date-fns";

type QueryBuilder = {
  select: (...args: string[]) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  neq: (column: string, value: unknown) => QueryBuilder;
  gte: (column: string, value: string) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  limit: (value: number) => QueryBuilder;
  upsert?: (payload: Record<string, unknown>, options?: { onConflict?: string }) => Promise<{ data?: unknown; error?: unknown }>;
};

export interface DailyDigestWorkflowArgs {
  userId: string;
  db: {
    from: (table: string) => QueryBuilder;
  };
  ai?: {
    models: {
      generateContent: (input: unknown) => Promise<unknown>;
    };
  };
  now?: Date;
  source?: string;
}

export async function runDailyDigestWorkflow({
  userId,
  db,
  ai,
  now = new Date(),
  source = "scheduled",
}: DailyDigestWorkflowArgs) {
  const dubaiNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const todayStr = format(dubaiNow, "yyyy-MM-dd");

  const completedTasksQuery = db.from("tasks").select("title, priority, completed_at");
  const todayHabitLogsQuery = db.from("habit_logs").select("habit_id, completed, logged_date");
  const habitsQuery = db.from("habits").select("id, name, icon");
  const todayTransactionsQuery = db.from("transactions").select("type, amount, category, description");
  const pendingTasksQuery = db.from("tasks").select("title, priority, due_date");
  const activeGoalsQuery = db.from("goals").select("title, progress, status");

  const [completedTasksResult, todayHabitLogsResult, habitsResult, todayTransactionsResult, pendingTasksResult, activeGoalsResult] = await Promise.all([
    completedTasksQuery.eq?.("user_id", userId).eq?.("status", "done").gte?.("completed_at", `${todayStr}T00:00:00`).order?.("completed_at", { ascending: false }),
    todayHabitLogsQuery.eq?.("user_id", userId).eq?.("logged_date", todayStr),
    habitsQuery.eq?.("user_id", userId).eq?.("active", true),
    todayTransactionsQuery.eq?.("user_id", userId).eq?.("date", todayStr),
    pendingTasksQuery.eq?.("user_id", userId).neq?.("status", "done").order?.("priority"),
    activeGoalsQuery.eq?.("user_id", userId).eq?.("status", "active").order?.("progress", { ascending: false }).limit?.(5),
  ]);

  const completedTasks = (completedTasksResult as { data?: Array<Record<string, unknown>>; error?: unknown }).data ?? [];
  const todayHabitLogs = (todayHabitLogsResult as { data?: Array<Record<string, unknown>>; error?: unknown }).data ?? [];
  const habits = (habitsResult as { data?: Array<Record<string, unknown>>; error?: unknown }).data ?? [];
  const todayTransactions = (todayTransactionsResult as { data?: Array<Record<string, unknown>>; error?: unknown }).data ?? [];
  const pendingTasks = (pendingTasksResult as { data?: Array<Record<string, unknown>>; error?: unknown }).data ?? [];
  const activeGoals = (activeGoalsResult as { data?: Array<Record<string, unknown>>; error?: unknown }).data ?? [];

  const completedCount = completedTasks.length;
  const habitMap = new Map((habits as Array<{ id: string; name: string }>).map((habit) => [habit.id, habit.name]));
  const doneHabits = (todayHabitLogs as Array<{ habit_id: string; completed: boolean }>).filter((log) => log.completed).map((log) => habitMap.get(log.habit_id) ?? "—");
  const missedHabits = (todayHabitLogs as Array<{ habit_id: string; completed: boolean }>).filter((log) => !log.completed).map((log) => habitMap.get(log.habit_id) ?? "—");
  const totalIncome = (todayTransactions as Array<{ type: string; amount: number }>).filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpense = (todayTransactions as Array<{ type: string; amount: number }>).filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + transaction.amount, 0);

  const todayTomorrow = format(subDays(dubaiNow, -1), "yyyy-MM-dd");
  const dueSoon = (pendingTasks as Array<{ due_date?: string; priority?: string; title?: string }>).filter((task) => task.due_date && task.due_date <= todayTomorrow).slice(0, 5).map((task) => `${task.priority}: ${task.title}`);

  const context = `
Today's date: ${todayStr} (Dubai time)

COMPLETED TASKS (${completedCount}):
${(completedTasks as Array<{ priority?: string; title?: string }>).map((task) => `- [${task.priority}] ${task.title}`).join("\n") || "None"}

HABITS:
- Done: ${doneHabits.join(", ") || "None"}
- Missed: ${missedHabits.join(", ") || "None"}

FINANCE:
- Income today: AED ${totalIncome.toFixed(2)}
- Expenses today: AED ${totalExpense.toFixed(2)}
- Transactions: ${(todayTransactions as Array<{ type: string; amount: number; category?: string }>).map((transaction) => `${transaction.type} AED ${transaction.amount} (${transaction.category})`).join(", ") || "None"}

TASKS DUE SOON:
${dueSoon.join("\n") || "None due imminently"}

ACTIVE GOALS (top 5):
${(activeGoals as Array<{ title?: string; progress?: number }>).map((goal) => `- ${goal.title}: ${goal.progress}%`).join("\n") || "None"}
`.trim();

  const genAI = ai ?? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are RISE, a personal AI operating system. Generate a concise, encouraging daily digest for ${todayStr}. Use markdown. Keep it under 300 words. Structure:

## Daily Digest — ${todayStr}

### ✅ Wins Today
(completed tasks, done habits)

### 💰 Finance
(today's income/expense summary)

### 🎯 Goals Pulse
(brief progress note on active goals)

### 📋 Coming Up
(tasks due soon)

### 💬 One Insight
(one motivational or actionable observation based on the data)

Data:
${context}`,
          },
        ],
      },
    ],
  });

  const digestText = (response as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts?.[0]?.text ?? "Daily digest unavailable.";

  const noteTitle = `Daily Digest — ${todayStr}`;
  const notePayload = {
    user_id: userId,
    title: noteTitle,
    content: digestText,
    tags: ["daily-digest"],
    linked_to_type: "daily-digest",
    updated_at: new Date().toISOString(),
    source,
  };

  await db.from("notes").upsert?.(notePayload, { onConflict: "user_id,title" });

  return { success: true, date: todayStr, digestText, noteTitle, source };
}
