import { GoogleGenAI } from "@google/genai";
import { addDaysISO, toDubaiISODate } from "@/lib/format";

type QueryResult = { data?: unknown; error?: unknown };

// Only `select` and `eq` are invoked unconditionally; every other step in the
// chain is called with `?.`, so the contract marks them optional. Keeping this
// honest lets a caller supply a table-specific builder (the notes path needs
// no ordering or filtering) without stubbing methods it never reaches.
type QueryBuilder = {
  select: (...args: string[]) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  // Required, not optional: every digest query must exclude soft-deleted rows,
  // so a test double that omits it should fail to compile rather than silently
  // report deleted tasks in the evening digest.
  is: (column: string, value: unknown) => QueryBuilder;
  neq?: (column: string, value: unknown) => QueryBuilder;
  gte?: (column: string, value: string) => QueryBuilder;
  order?: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  limit?: (value: number) => QueryBuilder;
  maybeSingle?: () => Promise<QueryResult>;
  insert?: (payload: Record<string, unknown>) => Promise<QueryResult>;
  update?: (payload: Record<string, unknown>) => QueryBuilder;
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
  a: { due_date?: string; priority?: string },
  b: { due_date?: string; priority?: string },
): number {
  const dueCompare = (a.due_date ?? "9999-12-31").localeCompare(
    b.due_date ?? "9999-12-31",
  );
  if (dueCompare !== 0) return dueCompare;
  return (a.priority ?? "P4").localeCompare(b.priority ?? "P4");
}

function rowsOf(result: unknown): {
  rows: Array<Record<string, unknown>>;
  error: unknown;
} {
  const r = (result ?? {}) as {
    data?: Array<Record<string, unknown>>;
    error?: unknown;
  };
  return { rows: r.data ?? [], error: r.error ?? null };
}

export async function runDailyDigestWorkflow({
  userId,
  db,
  ai,
  now = new Date(),
  source = "scheduled",
}: DailyDigestWorkflowArgs): Promise<DailyDigestResult> {
  const todayStr = toDubaiISODate(now);

  const completedTasksQuery = db.from("tasks").select("title, priority, completed_at")
    .is("deleted_at", null);
  const todayHabitLogsQuery = db.from("habit_logs").select("habit_id, completed, logged_date")
    .is("deleted_at", null);
  const habitsQuery = db.from("habits").select("id, name, icon")
    .is("deleted_at", null);
  const todayTransactionsQuery = db.from("transactions").select("type, amount, category, description")
    .is("deleted_at", null);
  const pendingTasksQuery = db.from("tasks").select("title, priority, due_date")
    .is("deleted_at", null);
  const activeGoalsQuery = db.from("goals").select("title, progress, status")
    .is("deleted_at", null);

  const [completedTasksResult, todayHabitLogsResult, habitsResult, todayTransactionsResult, pendingTasksResult, activeGoalsResult] = await Promise.all([
    completedTasksQuery.eq?.("user_id", userId).eq?.("status", "done").gte?.("completed_at", `${todayStr}T00:00:00`).order?.("completed_at", { ascending: false }),
    todayHabitLogsQuery.eq?.("user_id", userId).eq?.("logged_date", todayStr),
    habitsQuery.eq?.("user_id", userId).eq?.("active", true),
    todayTransactionsQuery.eq?.("user_id", userId).eq?.("date", todayStr),
    pendingTasksQuery.eq?.("user_id", userId).neq?.("status", "done").order?.("priority"),
    activeGoalsQuery.eq?.("user_id", userId).eq?.("status", "active").order?.("progress", { ascending: false }).limit?.(5),
  ]);

  const completed = rowsOf(completedTasksResult);
  const habitLogs = rowsOf(todayHabitLogsResult);
  const habitRows = rowsOf(habitsResult);
  const transactions = rowsOf(todayTransactionsResult);
  const pending = rowsOf(pendingTasksResult);
  const goalRows = rowsOf(activeGoalsResult);

  // A partial read would silently produce a wrong digest ("0 habits done"), so
  // fail loudly instead of reporting an empty day as if it were real.
  const readError = [completed, habitLogs, habitRows, transactions, pending, goalRows].find(
    (r) => r.error,
  );
  if (readError) {
    console.error("[daily-digest] read failed:", readError.error);
    return {
      success: false,
      date: todayStr,
      digestText: "",
      noteTitle: `Daily Digest — ${todayStr}`,
      source,
      error: "Failed to read digest data",
    };
  }

  const completedTasks = completed.rows as Array<{ priority?: string; title?: string }>;
  const todayHabitLogs = habitLogs.rows as Array<{ habit_id: string; completed: boolean }>;
  const habits = habitRows.rows as Array<{ id: string; name: string }>;
  const todayTransactions = transactions.rows as Array<{ type: string; amount: number; category?: string }>;
  const pendingTasks = pending.rows as Array<{ due_date?: string; priority?: string; title?: string }>;
  const activeGoals = goalRows.rows as Array<{ title?: string; progress?: number }>;

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
- Income today: AED ${totalIncome.toFixed(2)}
- Expenses today: AED ${totalExpense.toFixed(2)}
- Transactions: ${todayTransactions.map((transaction) => `${transaction.type} AED ${transaction.amount} (${transaction.category})`).join(", ") || "None"}

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

  const digestText = (response as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts?.[0]?.text ?? "Daily digest unavailable.";

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
  const existingResult = await db
    .from("notes")
    .select("id")
    .is("deleted_at", null)
    .eq("user_id", userId)
    .eq("title", noteTitle)
    .maybeSingle?.();

  const existing = (existingResult ?? {}) as {
    data?: { id?: string } | null;
    error?: unknown;
  };
  if (existing.error) return existing.error;

  const nowIso = new Date().toISOString();

  if (existing.data?.id) {
    const updateResult = await db
      .from("notes")
      .update?.({ content: digestText, updated_at: nowIso })
      .eq("id", existing.data.id)
      .eq("user_id", userId);
    return (updateResult as QueryResult | undefined)?.error ?? null;
  }

  const insertResult = await db.from("notes").insert?.({
    user_id: userId,
    title: noteTitle,
    content: digestText,
    tags: ["daily-digest"],
    linked_to_type: null,
    updated_at: nowIso,
  });
  return (insertResult as QueryResult | undefined)?.error ?? null;
}
