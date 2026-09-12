import { GoogleGenAI } from "@google/genai";
import { addDaysISO, formatAED, toDubaiISODate } from "@/lib/format";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export interface DailyDigestWorkflowArgs {
  userId: string;
  db: SupabaseClient<Database>;
  ai?: GoogleGenAI;
  now?: Date;
  source?: string;
}

export interface DailyDigestResult {
  success: boolean;
  date: string;
  digestText: string;
  noteTitle: string;
  source: string;
  error?: string;
}

// P1 first, P4 last — plain string sort already gives that ordering.
function byDueThenPriority(
  a: { due_date?: string | null; priority?: string },
  b: { due_date?: string | null; priority?: string },
): number {
  const dueCompare = (a.due_date ?? "9999-12-31").localeCompare(
    b.due_date ?? "9999-12-31",
  );
  if (dueCompare !== 0) return dueCompare;
  return (a.priority ?? "P4").localeCompare(b.priority ?? "P4");
}

export async function runDailyDigestWorkflow({
  userId,
  db,
  ai,
  now = new Date(),
  source = "scheduled",
}: DailyDigestWorkflowArgs): Promise<DailyDigestResult> {
  const todayStr = toDubaiISODate(now);

  const [
    completedTasksResult,
    todayHabitLogsResult,
    habitsResult,
    todayTransactionsResult,
    pendingTasksResult,
    activeGoalsResult,
  ] = await Promise.all([
    db
      .from("tasks")
      .select("title, priority, completed_at")
      .is("deleted_at", null)
      .eq("user_id", userId)
      .eq("status", "done")
      .gte("completed_at", `${todayStr}T00:00:00`)
      .order("completed_at", { ascending: false }),
    db
      .from("habit_logs")
      .select("habit_id, completed, logged_date")
      .is("deleted_at", null)
      .eq("user_id", userId)
      .eq("logged_date", todayStr),
    db
      .from("habits")
      .select("id, name, icon")
      .is("deleted_at", null)
      .eq("user_id", userId)
      .eq("active", true),
    db
      .from("transactions")
      .select("type, amount, category, description")
      .is("deleted_at", null)
      .eq("user_id", userId)
      .eq("date", todayStr),
    db
      .from("tasks")
      .select("title, priority, due_date")
      .is("deleted_at", null)
      .eq("user_id", userId)
      .neq("status", "done")
      .order("priority"),
    db
      .from("goals")
      .select("title, progress, status")
      .is("deleted_at", null)
      .eq("user_id", userId)
      .eq("status", "active")
      .order("progress", { ascending: false })
      .limit(5),
  ]);

  // A partial read would silently produce a wrong digest ("0 habits done"), so
  // fail loudly instead of reporting an empty day as if it were real.
  const readError = [
    completedTasksResult.error,
    todayHabitLogsResult.error,
    habitsResult.error,
    todayTransactionsResult.error,
    pendingTasksResult.error,
    activeGoalsResult.error,
  ].find(Boolean);
  if (readError) {
    console.error("[daily-digest] read failed:", readError);
    return {
      success: false,
      date: todayStr,
      digestText: "",
      noteTitle: `Daily Digest — ${todayStr}`,
      source,
      error: "Failed to read digest data",
    };
  }

  const completedTasks = completedTasksResult.data ?? [];
  const todayHabitLogs = todayHabitLogsResult.data ?? [];
  const habits = habitsResult.data ?? [];
  const todayTransactions = todayTransactionsResult.data ?? [];
  const pendingTasks = pendingTasksResult.data ?? [];
  const activeGoals = activeGoalsResult.data ?? [];

  const completedCount = completedTasks.length;
  // Logs carry habit_id; names come from the habits table. Compare IDs to IDs.
  const habitMap = new Map(habits.map((habit) => [habit.id, habit.name]));
  const doneHabits = todayHabitLogs.filter((log) => log.completed).map((log) => habitMap.get(log.habit_id) ?? "—");
  const missedHabits = todayHabitLogs.filter((log) => !log.completed).map((log) => habitMap.get(log.habit_id) ?? "—");
  const totalIncome = todayTransactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpense = todayTransactions.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + transaction.amount, 0);

  const tomorrow = addDaysISO(todayStr, 1);
  const dueSoon = pendingTasks
    .filter((task) => task.due_date && task.due_date <= tomorrow)
    // Sort before slicing so an overdue P4 cannot crowd out today's P1.
    .sort(byDueThenPriority)
    .slice(0, 5)
    .map((task) => `${task.priority}: ${task.title}`);

  const context = `
Today's date: ${todayStr} (Dubai time)

COMPLETED TASKS (${completedCount}):
${completedTasks.map((task) => `- [${task.priority}] ${task.title}`).join("\n") || "None"}

HABITS:
- Done: ${doneHabits.join(", ") || "None"}
- Missed: ${missedHabits.join(", ") || "None"}

FINANCE:
- Income today: ${formatAED(totalIncome)}
- Expenses today: ${formatAED(totalExpense)}
- Transactions: ${todayTransactions.map((transaction) => `${transaction.type} ${formatAED(transaction.amount)} (${transaction.category})`).join(", ") || "None"}

TASKS DUE SOON:
${dueSoon.join("\n") || "None due imminently"}

ACTIVE GOALS (top 5):
${activeGoals.map((goal) => `- ${goal.title}: ${goal.progress}%`).join("\n") || "None"}
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

  const digestText = response.text ?? "Daily digest unavailable.";

  const noteTitle = `Daily Digest — ${todayStr}`;

  // `notes` has no unique constraint on (user_id, title) and no `source`
  // column, so an upsert with onConflict cannot work here. Look the note up,
  // then update or insert. linked_to_type stays null — the column's CHECK only
  // permits 'task' | 'goal' | 'contact'.
  const writeError = await writeDigestNote({
    db,
    userId,
    noteTitle,
    digestText,
  });

  if (writeError) {
    console.error("[daily-digest] note write failed:", writeError);
    return {
      success: false,
      date: todayStr,
      digestText,
      noteTitle,
      source,
      error: "Failed to save the digest note",
    };
  }

  return { success: true, date: todayStr, digestText, noteTitle, source };
}

async function writeDigestNote({
  db,
  userId,
  noteTitle,
  digestText,
}: {
  db: DailyDigestWorkflowArgs["db"];
  userId: string;
  noteTitle: string;
  digestText: string;
}): Promise<unknown> {
  const { data: existing, error: existingError } = await db
    .from("notes")
    .select("id")
    .is("deleted_at", null)
    .eq("user_id", userId)
    .eq("title", noteTitle)
    .maybeSingle();
  if (existingError) return existingError;

  if (existing?.id) {
    const noteUpdate: Database["public"]["Tables"]["notes"]["Update"] = {
      content: digestText,
    };
    const { error } = await db
      .from("notes")
      .update(noteUpdate)
      .eq("id", existing.id)
      .eq("user_id", userId);
    return error;
  }

  const noteInsert: Database["public"]["Tables"]["notes"]["Insert"] = {
    user_id: userId,
    title: noteTitle,
    content: digestText,
    tags: ["daily-digest"],
    linked_to_type: null,
  };
  const { error } = await db.from("notes").insert(noteInsert);
  return error;
}
