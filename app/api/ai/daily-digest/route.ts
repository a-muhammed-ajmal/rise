import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { format, subDays } from "date-fns";

// Cron fires at 59 19 * * * UTC = 11:59 PM Dubai (UTC+4)
// Secured with CRON_SECRET or Vercel's x-vercel-cron header
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-vercel-cron");
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = cronHeader === "1";
  const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !hasValidSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const allowedEmail = process.env.ALLOWED_USER_EMAIL;

  if (!supabaseUrl || !serviceRoleKey || !geminiKey || !allowedEmail) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const adminDb = createSupabaseServerClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find the user by email
  const { data: usersData } = await adminDb.auth.admin.listUsers();
  const user = usersData?.users?.find((u) => u.email === allowedEmail);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userId = user.id;
  // Dubai is UTC+4; shift now to get the local date string
  const dubaiNow = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const todayStr = format(dubaiNow, "yyyy-MM-dd");

  // Fetch today's data in parallel
  const [
    { data: completedTasks },
    { data: todayHabitLogs },
    { data: habits },
    { data: todayTransactions },
    { data: pendingTasks },
    { data: activeGoals },
  ] = await Promise.all([
    adminDb.from("tasks")
      .select("title, priority, completed_at")
      .eq("user_id", userId)
      .eq("status", "done")
      .gte("completed_at", `${todayStr}T00:00:00`)
      .order("completed_at", { ascending: false }),
    adminDb.from("habit_logs")
      .select("habit_id, completed, logged_date")
      .eq("user_id", userId)
      .eq("logged_date", todayStr),
    adminDb.from("habits")
      .select("id, name, icon")
      .eq("user_id", userId)
      .eq("active", true),
    adminDb.from("transactions")
      .select("type, amount, category, description")
      .eq("user_id", userId)
      .eq("date", todayStr),
    adminDb.from("tasks")
      .select("title, priority, due_date")
      .eq("user_id", userId)
      .neq("status", "done")
      .order("priority"),
    adminDb.from("goals")
      .select("title, progress, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("progress", { ascending: false })
      .limit(5),
  ]);

  // Build summary context for Gemini
  const completedCount = completedTasks?.length ?? 0;
  const habitMap = new Map((habits ?? []).map((h) => [h.id, h.name]));
  const doneHabits = (todayHabitLogs ?? []).filter((l) => l.completed).map((l) => habitMap.get(l.habit_id) ?? "—");
  const missedHabits = (todayHabitLogs ?? []).filter((l) => !l.completed).map((l) => habitMap.get(l.habit_id) ?? "—");
  const totalIncome = (todayTransactions ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = (todayTransactions ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const todayTomorrow = format(subDays(dubaiNow, -1), "yyyy-MM-dd");
  const dueSoon = (pendingTasks ?? [])
    .filter((t) => t.due_date && t.due_date <= todayTomorrow)
    .slice(0, 5)
    .map((t) => `${t.priority}: ${t.title}`);

  const context = `
Today's date: ${todayStr} (Dubai time)

COMPLETED TASKS (${completedCount}):
${completedTasks?.map((t) => `- [${t.priority}] ${t.title}`).join("\n") || "None"}

HABITS:
- Done: ${doneHabits.join(", ") || "None"}
- Missed: ${missedHabits.join(", ") || "None"}

FINANCE:
- Income today: AED ${totalIncome.toFixed(2)}
- Expenses today: AED ${totalExpense.toFixed(2)}
- Transactions: ${todayTransactions?.map((t) => `${t.type} AED ${t.amount} (${t.category})`).join(", ") || "None"}

TASKS DUE SOON:
${dueSoon.join("\n") || "None due imminently"}

ACTIVE GOALS (top 5):
${activeGoals?.map((g) => `- ${g.title}: ${g.progress}%`).join("\n") || "None"}
`.trim();

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const response = await ai.models.generateContent({
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

  const digestText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "Daily digest unavailable.";

  // Save as a note tagged "daily-digest"
  const noteTitle = `Daily Digest — ${todayStr}`;
  await adminDb.from("notes").upsert(
    {
      user_id: userId,
      title: noteTitle,
      content: digestText,
      tags: ["daily-digest"],
      linked_to_type: "daily-digest",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,title" }
  );

  return NextResponse.json({ success: true, date: todayStr, length: digestText.length });
}

// Also support GET for testing
export async function GET(request: Request) {
  return POST(request);
}
