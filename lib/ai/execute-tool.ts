import { createClient } from "@/lib/supabase/server";
import { format, parseISO, startOfMonth } from "date-fns";
import { todayISO, todayDOW } from "@/lib/format";
import { z } from "zod";
import {
  storeMemory,
  retrieveMemories,
  retrieveUserFacts,
} from "@/lib/ai/memory";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// ─── Input schemas ────────────────────────────────────────────────────────────

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const CreateTaskInput = z.object({
  title: z.string().min(1).max(500),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  due_date: dateStr.optional().nullable(),
  status: z
    .enum(["todo", "in_progress", "blocked", "on_hold", "done"])
    .optional(),
  description: z.string().max(5000).optional().nullable(),
});

const CompleteTaskInput = z.object({
  task_id: z.string().uuid(),
});

const LogMoneyInput = z.object({
  amount: z.number().positive().max(10_000_000),
  category: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  date: dateStr.optional(),
  payment_method_id: z.string().uuid().optional().nullable(),
});

const LogHabitInput = z.object({
  habit_name: z.string().min(1).max(200),
});

const CreateGoalInput = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  category: z
    .enum(["personal", "professional", "health", "financial", "other"])
    .optional(),
  target_date: dateStr.optional().nullable(),
});

const AddNoteInput = z.object({
  title: z.string().min(1).max(300),
  content: z.string().max(50_000),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

const AddContactInput = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  type: z
    .enum(["personal", "lead", "prospect", "client", "network"])
    .optional(),
});

const SearchDataInput = z.object({
  query: z.string().min(1).max(200),
  types: z.array(z.enum(["tasks", "notes", "contacts", "goals"])).optional(),
});

const GetAnalyticsInput = z.object({
  period: z.enum(["week", "month"]).optional(),
});

const ListTasksInput = z.object({
  filter: z.enum(["all", "today"]).optional(),
});

const DeleteTaskInput = z.object({
  task_id: z.string().uuid(),
  task_title: z.string().max(500).optional(),
});

const BulkCompleteInput = z.object({
  task_ids: z.array(z.string().uuid()).min(1).max(100),
});

const DeleteNoteInput = z.object({
  note_id: z.string().uuid(),
  note_title: z.string().max(300).optional(),
});

// ─── New input schemas ────────────────────────────────────────────────────────

const uuid = z.string().uuid();
const rating1to5 = z.number().int().min(1).max(5);
const isoDatetime = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.Z+\-]+)?$/);

// Tasks
const UpdateTaskInput = z.object({
  id: uuid,
  title: z.string().min(1).max(500).optional(),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  status: z
    .enum(["todo", "in_progress", "blocked", "on_hold", "done"])
    .optional(),
  due_date: dateStr.optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  project_id: uuid.optional().nullable(),
  is_starred: z.boolean().optional(),
  labels: z.array(z.string().max(100)).optional(),
});

// Projects
const CreateProjectInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().max(20).optional(),
});

const UpdateProjectInput = z.object({
  id: uuid,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().max(20).optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
});

const DeleteProjectInput = z.object({
  project_id: uuid,
  project_name: z.string().optional(),
});

// Goals
const ListGoalsInput = z.object({
  status: z.enum(["active", "completed", "abandoned", "all"]).optional(),
});

const UpdateGoalInput = z.object({
  id: uuid,
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z
    .enum(["personal", "professional", "health", "financial", "other"])
    .optional(),
  target_date: dateStr.optional().nullable(),
  progress: z.number().int().min(0).max(100).optional(),
  status: z.enum(["active", "completed", "abandoned"]).optional(),
});

const ByIdInput = z.object({ id: uuid });

const DeleteGoalInput = z.object({
  goal_id: uuid,
  goal_title: z.string().optional(),
});

// Milestones
const CreateMilestoneInput = z.object({
  goal_id: uuid,
  title: z.string().min(1).max(300),
  due_date: dateStr.optional().nullable(),
});

const ListMilestonesInput = z.object({ goal_id: uuid });

const UpdateMilestoneInput = z.object({
  id: uuid,
  title: z.string().min(1).max(300).optional(),
  due_date: dateStr.optional().nullable(),
});

const DeleteMilestoneInput = z.object({
  milestone_id: uuid,
  milestone_title: z.string().optional(),
});

// Habits
const CreateHabitInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  frequency: z.enum(["daily", "weekly", "custom"]).optional(),
  target_days: z.array(z.number().int().min(0).max(6)).optional(),
  color: z.string().max(20).optional(),
  reminder_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
});

const UpdateHabitInput = z.object({
  id: uuid,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  frequency: z.enum(["daily", "weekly", "custom"]).optional(),
  target_days: z.array(z.number().int().min(0).max(6)).optional(),
  color: z.string().max(20).optional(),
  reminder_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  active: z.boolean().optional(),
});

const DeleteHabitInput = z.object({
  habit_id: uuid,
  habit_name: z.string().optional(),
});

const DeleteHabitLogInput = z.object({
  habit_id: uuid,
  logged_date: dateStr,
});

// Transactions
const ListTransactionsInput = z.object({
  type: z
    .enum(["income", "expense", "transfer", "adjustment", "all"])
    .optional(),
  start_date: dateStr.optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const UpdateTransactionInput = z.object({
  transaction_id: uuid,
  summary: z.string().max(500),
  amount: z.number().positive().max(10_000_000).optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  date: dateStr.optional(),
});

const DeleteTransactionInput = z.object({
  transaction_id: uuid,
  transaction_summary: z.string().optional(),
});

// Budgets
const CreateBudgetInput = z.object({
  category: z.string().min(1).max(100),
  amount: z.number().positive().max(10_000_000),
  period: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  period_start: dateStr,
  period_end: dateStr,
});

const UpdateBudgetInput = z.object({
  id: uuid,
  category: z.string().max(100).optional(),
  amount: z.number().positive().max(10_000_000).optional(),
  period: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  period_start: dateStr.optional(),
  period_end: dateStr.optional(),
});

const DeleteBudgetInput = z.object({
  budget_id: uuid,
  budget_summary: z.string().optional(),
});

// Debts
const ListDebtsInput = z.object({
  filter: z.enum(["i_owe", "they_owe", "unpaid", "all"]).optional(),
});

const CreateDebtInput = z.object({
  creditor: z.string().min(1).max(200),
  type: z.enum(["i_owe", "they_owe"]),
  amount: z.number().positive().max(10_000_000),
  description: z.string().max(500).optional().nullable(),
  due_date: dateStr.optional().nullable(),
});

const UpdateDebtInput = z.object({
  debt_id: uuid,
  summary: z.string().max(500),
  creditor: z.string().max(200).optional(),
  amount: z.number().positive().max(10_000_000).optional(),
  description: z.string().max(500).optional().nullable(),
  due_date: dateStr.optional().nullable(),
  mark_paid: z.boolean().optional(),
});

const DeleteDebtInput = z.object({
  debt_id: uuid,
  debt_summary: z.string().optional(),
});

// Contacts
const ListContactsInput = z.object({
  type: z
    .enum(["lead", "prospect", "client", "network", "personal", "all"])
    .optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const UpdateContactInput = z.object({
  id: uuid,
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  role: z.string().max(200).optional().nullable(),
  type: z
    .enum(["lead", "prospect", "client", "network", "personal"])
    .optional(),
  stage: z
    .enum(["new", "qualified", "proposal", "negotiation", "won", "lost"])
    .optional(),
  deal_value: z.number().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const DeleteContactInput = z.object({
  contact_id: uuid,
  contact_name: z.string().optional(),
});

// Interactions
const CreateInteractionInput = z.object({
  contact_id: uuid,
  type: z.enum(["call", "email", "meeting", "message", "other"]),
  notes: z.string().min(1).max(5000),
  date: dateStr.optional(),
  follow_up_date: dateStr.optional().nullable(),
});

const ListInteractionsInput = z.object({ contact_id: uuid });

const UpdateInteractionInput = z.object({
  id: uuid,
  type: z.enum(["call", "email", "meeting", "message", "other"]).optional(),
  notes: z.string().min(1).max(5000).optional(),
  date: dateStr.optional(),
  follow_up_date: dateStr.optional().nullable(),
});

const DeleteInteractionInput = z.object({
  interaction_id: uuid,
  interaction_summary: z.string().optional(),
});

// Notes
const ListNotesInput = z.object({
  tag: z.string().max(50).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const UpdateNoteInput = z.object({
  id: uuid,
  title: z.string().min(1).max(300).optional(),
  content: z.string().max(50_000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// Documents
const CreateDocumentInput = z.object({
  name: z.string().min(1).max(300),
  file_path: z.string().min(1).max(2000),
  file_type: z.string().max(100).optional().nullable(),
  file_size: z.number().int().positive().optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const UpdateDocumentInput = z.object({
  id: uuid,
  name: z.string().min(1).max(300).optional(),
  file_type: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const DeleteDocumentInput = z.object({
  document_id: uuid,
  document_name: z.string().optional(),
});

// Links
const CreateLinkInput = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(300).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const UpdateLinkInput = z.object({
  id: uuid,
  url: z.string().url().max(2000).optional(),
  title: z.string().max(300).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const DeleteLinkInput = z.object({ id: uuid });

// Journal entries
const CreateJournalEntryInput = z.object({
  date: dateStr,
  content: z.string().min(1).max(50_000),
  mood: rating1to5.optional().nullable(),
  energy: rating1to5.optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const UpdateJournalEntryInput = z.object({
  id: uuid,
  content: z.string().min(1).max(50_000).optional(),
  mood: rating1to5.optional().nullable(),
  energy: rating1to5.optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const DeleteJournalEntryInput = z.object({
  entry_id: uuid,
  entry_date: dateStr,
});

// Reviews
const CreateReviewInput = z.object({
  type: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  period_start: dateStr,
  period_end: dateStr,
  content: z.string().max(50_000).optional().nullable(),
  mood: rating1to5.optional().nullable(),
  energy: rating1to5.optional().nullable(),
});

const UpdateReviewInput = z.object({
  id: uuid,
  content: z.string().max(50_000).optional().nullable(),
  mood: rating1to5.optional().nullable(),
  energy: rating1to5.optional().nullable(),
});

const ListReviewsInput = z.object({
  type: z
    .enum(["daily", "weekly", "monthly", "quarterly", "yearly", "all"])
    .optional(),
  limit: z.number().int().positive().max(50).optional(),
});

const DeleteReviewInput = z.object({
  review_id: uuid,
  review_summary: z.string().optional(),
});

// Focus sessions
const CreateFocusSessionInput = z.object({
  duration_minutes: z.number().int().positive().max(1440),
  started_at: isoDatetime.optional(),
  ended_at: isoDatetime.optional().nullable(),
  task_id: uuid.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const UpdateFocusSessionInput = z.object({
  id: uuid,
  duration_minutes: z.number().int().positive().max(1440).optional(),
  ended_at: isoDatetime.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  task_id: uuid.optional().nullable(),
});

const ListFocusSessionsInput = z.object({
  task_id: uuid.optional(),
  limit: z.number().int().positive().max(50).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ToolResult = { success: boolean; message: string; data?: unknown };

function dbErr(toolName: string, err: unknown): ToolResult {
  console.error(`[execute-tool] ${toolName}:`, err);
  return { success: false, message: "Something went wrong. Please try again." };
}

function badInput(): ToolResult {
  return { success: false, message: "Invalid input for this action." };
}

// ─── Executor ─────────────────────────────────────────────────────────────────

// Cookieless callers (e.g. the MCP endpoint) inject their own client + user
export type ToolContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx?: ToolContext,
): Promise<ToolResult> {
  let supabase: SupabaseClient<Database>;
  let userId: string;
  if (ctx) {
    supabase = ctx.supabase;
    userId = ctx.userId;
  } else {
    const cookieClient = await createClient();
    const {
      data: { user },
    } = await cookieClient.auth.getUser();
    if (!user) return { success: false, message: "Not authenticated" };
    supabase = cookieClient;
    userId = user.id;
  }

  const today = todayISO();

  switch (toolName) {
    case "create_task": {
      const p = CreateTaskInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title: p.data.title,
          priority: p.data.priority ?? "P3",
          due_date: p.data.due_date ?? null,
          status: p.data.status ?? "todo",
          description: p.data.description ?? null,
          is_starred: false,
          is_focus: false,
          labels: [],
          subtasks: [],
          attachments: [],
          comments: [],
          activity: [],
          linked_tasks: [],
          reminders: [],
        })
        .select()
        .single();
      if (error) return dbErr("create_task", error);
      return {
        success: true,
        message: `Created task: "${p.data.title}"`,
        data,
      };
    }

    case "list_tasks": {
      const p = ListTasksInput.safeParse(input);
      const filter = p.success ? (p.data.filter ?? "all") : "all";
      let query = supabase
        .from("tasks")
        .select("id, title, priority, due_date, status")
        .neq("status", "done");
      if (filter === "today")
        query = query.or(`due_date.eq.${today},due_date.lt.${today}`);
      const { data, error } = await query
        .order("priority", { ascending: false })
        .limit(20);
      if (error) return dbErr("list_tasks", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} tasks`,
        data,
      };
    }

    case "complete_task": {
      const p = CompleteTaskInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", p.data.task_id)
        .eq("user_id", userId)
        .select("title")
        .single();
      if (error) return dbErr("complete_task", error);
      return { success: true, message: `Completed task: "${data?.title}"` };
    }

    case "list_payment_methods": {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("id, name, balance, color, is_active, display_order")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("display_order");
      if (error) return dbErr("list_payment_methods", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} payment methods`,
        data,
      };
    }

    case "log_expense": {
      const p = LogMoneyInput.safeParse(input);
      if (!p.success) return badInput();
      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        type: "expense",
        amount: p.data.amount,
        category: p.data.category,
        description: p.data.description ?? null,
        date: p.data.date ?? today,
        payment_method_id: p.data.payment_method_id ?? null,
        tags: [],
      });
      if (error) return dbErr("log_expense", error);
      return {
        success: true,
        message: `Logged expense: AED ${p.data.amount} for ${p.data.category}`,
      };
    }

    case "log_income": {
      const p = LogMoneyInput.safeParse(input);
      if (!p.success) return badInput();
      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        type: "income",
        amount: p.data.amount,
        category: p.data.category,
        description: p.data.description ?? null,
        date: p.data.date ?? today,
        payment_method_id: p.data.payment_method_id ?? null,
        tags: [],
      });
      if (error) return dbErr("log_income", error);
      return {
        success: true,
        message: `Logged income: AED ${p.data.amount} from ${p.data.category}`,
      };
    }

    case "log_habit": {
      const p = LogHabitInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: habits } = await supabase
        .from("habits")
        .select("id, name")
        .eq("active", true)
        .ilike("name", `%${p.data.habit_name}%`)
        .limit(1);
      if (!habits?.length)
        return {
          success: false,
          message: `No habit found matching "${p.data.habit_name}"`,
        };
      const habit = habits[0];
      await supabase.from("habit_logs").upsert({
        user_id: userId,
        habit_id: habit.id,
        logged_date: today,
        completed: true,
      });
      return { success: true, message: `Logged habit: "${habit.name}"` };
    }

    case "create_goal": {
      const p = CreateGoalInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("goals")
        .insert({
          user_id: userId,
          title: p.data.title,
          description: p.data.description ?? null,
          category: p.data.category ?? "personal",
          target_date: p.data.target_date ?? null,
          progress: 0,
          status: "active",
        })
        .select()
        .single();
      if (error) return dbErr("create_goal", error);
      return {
        success: true,
        message: `Created goal: "${p.data.title}"`,
        data,
      };
    }

    case "add_note": {
      const p = AddNoteInput.safeParse(input);
      if (!p.success) return badInput();
      const { error } = await supabase.from("notes").insert({
        user_id: userId,
        title: p.data.title,
        content: p.data.content,
        tags: p.data.tags ?? [],
        linked_to_type: null,
        linked_to_id: null,
      });
      if (error) return dbErr("add_note", error);
      return { success: true, message: `Saved note: "${p.data.title}"` };
    }

    case "add_contact": {
      const p = AddContactInput.safeParse(input);
      if (!p.success) return badInput();
      const { error } = await supabase.from("contacts").insert({
        user_id: userId,
        name: p.data.name,
        email: p.data.email ?? null,
        phone: p.data.phone ?? null,
        company: p.data.company ?? null,
        type: p.data.type ?? "network",
        stage: "new",
        tags: [],
      });
      if (error) return dbErr("add_contact", error);
      return { success: true, message: `Saved contact: "${p.data.name}"` };
    }

    case "get_daily_briefing": {
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
          .neq("status", "done")
          .eq("due_date", today)
          .limit(10),
        supabase
          .from("tasks")
          .select("title, due_date")
          .eq("user_id", userId)
          .neq("status", "done")
          .lt("due_date", today)
          .limit(5),
        supabase
          .from("habits")
          .select("name, icon")
          .eq("user_id", userId)
          .eq("active", true)
          .contains("target_days", [todayDOW()]),
        supabase
          .from("habit_logs")
          .select("habit_id")
          .eq("user_id", userId)
          .eq("logged_date", today)
          .eq("completed", true),
        supabase
          .from("goals")
          .select("title, progress")
          .eq("user_id", userId)
          .eq("status", "active")
          .limit(5),
        supabase
          .from("budgets")
          .select("category, amount")
          .eq("user_id", userId)
          .gte("period_end", today),
        supabase
          .from("transactions")
          .select("category, amount")
          .eq("user_id", userId)
          .eq("type", "expense")
          .gte("date", monthStart),
        supabase
          .from("interactions")
          .select("contacts(name), follow_up_date")
          .eq("user_id", userId)
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
          habits: (habits ?? []).map((h: { name: string; icon: string }) => ({
            ...h,
            done: loggedIds.has(h.name),
          })),
          goals,
          budgetWarnings,
          followUps,
        },
      };
    }

    case "search_data": {
      const p = SearchDataInput.safeParse(input);
      if (!p.success) return badInput();
      const { query, types = ["tasks", "notes", "contacts", "goals"] } = p.data;
      const results: Record<string, unknown[]> = {};

      await Promise.all([
        types.includes("tasks") &&
          supabase
            .from("tasks")
            .select("id, title, status, priority")
            .ilike("title", `%${query}%`)
            .limit(5)
            .then(({ data }) => {
              results.tasks = data ?? [];
            }),
        types.includes("notes") &&
          Promise.all([
            supabase
              .from("notes")
              .select("id, title, content")
              .ilike("title", `%${query}%`)
              .limit(5),
            supabase
              .from("notes")
              .select("id, title, content")
              .ilike("content", `%${query}%`)
              .limit(5),
          ]).then(([byTitle, byContent]) => {
            const seen = new Set<string>();
            const combined = [
              ...(byTitle.data ?? []),
              ...(byContent.data ?? []),
            ];
            results.notes = combined
              .filter((n) => !seen.has(n.id) && seen.add(n.id) !== undefined)
              .slice(0, 5);
          }),
        types.includes("contacts") &&
          supabase
            .from("contacts")
            .select("id, name, company, email")
            .ilike("name", `%${query}%`)
            .limit(5)
            .then(({ data }) => {
              results.contacts = data ?? [];
            }),
        types.includes("goals") &&
          supabase
            .from("goals")
            .select("id, title, progress, status")
            .ilike("title", `%${query}%`)
            .limit(5)
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
    }

    case "get_analytics": {
      const p = GetAnalyticsInput.safeParse(input);
      const period = p.success ? (p.data.period ?? "month") : "month";
      const startDate =
        period === "week"
          ? format(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
          : today.slice(0, 7) + "-01";

      const [txRes, taskRes, habitRes, habitLogRes, goalRes] =
        await Promise.all([
          supabase
            .from("transactions")
            .select("type,amount,category")
            .eq("user_id", userId)
            .gte("date", startDate),
          supabase
            .from("tasks")
            .select("id,status")
            .eq("user_id", userId)
            .gte("created_at", startDate),
          supabase.from("habits").select("id,name").eq("user_id", userId),
          supabase
            .from("habit_logs")
            .select("habit_id,completed")
            .eq("user_id", userId)
            .gte("date", startDate),
          supabase
            .from("goals")
            .select("id,status,progress")
            .eq("user_id", userId),
        ]);

      const transactions = txRes.data ?? [];
      const income = transactions
        .filter((t) => t.type === "income")
        .reduce((s: number, t) => s + (t.amount as number), 0);
      const expenses = transactions
        .filter((t) => t.type === "expense")
        .reduce((s: number, t) => s + (t.amount as number), 0);

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
              goals.reduce(
                (s: number, g) => s + ((g.progress as number) ?? 0),
                0,
              ) / goals.length,
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
    }

    // Approval-required tools — only reach here after user confirms
    case "delete_task": {
      const p = DeleteTaskInput.safeParse(input);
      if (!p.success) return badInput();
      // Ownership preflight — defense in depth before RLS
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("id", p.data.task_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Task not found" };
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", p.data.task_id);
      if (error) return dbErr("delete_task", error);
      return {
        success: true,
        message: `Deleted task: "${p.data.task_title ?? "task"}"`,
      };
    }

    case "bulk_complete_tasks": {
      const p = BulkCompleteInput.safeParse(input);
      if (!p.success) return badInput();
      const { error } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .in("id", p.data.task_ids)
        .eq("user_id", userId);
      if (error) return dbErr("bulk_complete_tasks", error);
      return {
        success: true,
        message: `Completed ${p.data.task_ids.length} tasks`,
      };
    }

    case "delete_note": {
      const p = DeleteNoteInput.safeParse(input);
      if (!p.success) return badInput();
      // Ownership preflight — defense in depth before RLS
      const { data: existing } = await supabase
        .from("notes")
        .select("id")
        .eq("id", p.data.note_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Note not found" };
      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", p.data.note_id);
      if (error) return dbErr("delete_note", error);
      return {
        success: true,
        message: `Deleted note: "${p.data.note_title ?? "note"}"`,
      };
    }

    // ─── TASKS ─────────────────────────────────────────────────────────────────

    case "update_task": {
      const p = UpdateTaskInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("title")
        .single();
      if (error) return dbErr("update_task", error);
      return { success: true, message: `Updated task: "${data?.title}"` };
    }

    // ─── PROJECTS ──────────────────────────────────────────────────────────────

    case "list_projects": {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, color, status")
        .eq("user_id", userId)
        .order("name");
      if (error) return dbErr("list_projects", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} projects`,
        data,
      };
    }

    case "create_project": {
      const p = CreateProjectInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("projects")
        .insert({
          user_id: userId,
          name: p.data.name,
          description: p.data.description ?? null,
          color: p.data.color ?? "#6366f1",
          status: "active",
        })
        .select()
        .single();
      if (error) return dbErr("create_project", error);
      return {
        success: true,
        message: `Created project: "${p.data.name}"`,
        data,
      };
    }

    case "update_project": {
      const p = UpdateProjectInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("name")
        .single();
      if (error) return dbErr("update_project", error);
      return { success: true, message: `Updated project: "${data?.name}"` };
    }

    case "delete_project": {
      const p = DeleteProjectInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", p.data.project_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Project not found" };
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", p.data.project_id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_project", error);
      return { success: true, message: `Deleted project: "${existing.name}"` };
    }

    // ─── GOALS ─────────────────────────────────────────────────────────────────

    case "list_goals": {
      const p = ListGoalsInput.safeParse(input);
      const statusFilter = p.success ? (p.data.status ?? "active") : "active";
      let query = supabase
        .from("goals")
        .select(
          "id, title, description, category, target_date, progress, status",
        )
        .eq("user_id", userId);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return dbErr("list_goals", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} goals`,
        data,
      };
    }

    case "update_goal": {
      const p = UpdateGoalInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("goals")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("title")
        .single();
      if (error) return dbErr("update_goal", error);
      return { success: true, message: `Updated goal: "${data?.title}"` };
    }

    case "complete_goal": {
      const p = ByIdInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("goals")
        .update({ status: "completed", progress: 100 })
        .eq("id", p.data.id)
        .eq("user_id", userId)
        .select("title")
        .single();
      if (error) return dbErr("complete_goal", error);
      return { success: true, message: `Completed goal: "${data?.title}"` };
    }

    case "delete_goal": {
      const p = DeleteGoalInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("goals")
        .select("id, title")
        .eq("id", p.data.goal_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Goal not found" };
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", p.data.goal_id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_goal", error);
      return { success: true, message: `Deleted goal: "${existing.title}"` };
    }

    // ─── MILESTONES ────────────────────────────────────────────────────────────

    case "create_milestone": {
      const p = CreateMilestoneInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("milestones")
        .insert({
          user_id: userId,
          goal_id: p.data.goal_id,
          title: p.data.title,
          due_date: p.data.due_date ?? null,
        })
        .select()
        .single();
      if (error) return dbErr("create_milestone", error);
      return {
        success: true,
        message: `Created milestone: "${p.data.title}"`,
        data,
      };
    }

    case "list_milestones": {
      const p = ListMilestonesInput.safeParse(input);
      if (!p.success) return badInput();
      const { data, error } = await supabase
        .from("milestones")
        .select("id, title, due_date, completed_at")
        .eq("goal_id", p.data.goal_id)
        .eq("user_id", userId)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) return dbErr("list_milestones", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} milestones`,
        data,
      };
    }

    case "update_milestone": {
      const p = UpdateMilestoneInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("milestones")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("title")
        .single();
      if (error) return dbErr("update_milestone", error);
      return { success: true, message: `Updated milestone: "${data?.title}"` };
    }

    case "complete_milestone": {
      const p = ByIdInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("milestones")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", p.data.id)
        .eq("user_id", userId)
        .select("title")
        .single();
      if (error) return dbErr("complete_milestone", error);
      return {
        success: true,
        message: `Completed milestone: "${data?.title}"`,
      };
    }

    case "delete_milestone": {
      const p = DeleteMilestoneInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("milestones")
        .select("id, title")
        .eq("id", p.data.milestone_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Milestone not found" };
      const { error } = await supabase
        .from("milestones")
        .delete()
        .eq("id", p.data.milestone_id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_milestone", error);
      return {
        success: true,
        message: `Deleted milestone: "${existing.title}"`,
      };
    }

    // ─── HABITS ────────────────────────────────────────────────────────────────

    case "list_habits": {
      const [{ data: habits }, { data: todayLogs }] = await Promise.all([
        supabase
          .from("habits")
          .select("id, name, icon, color, frequency, active")
          .eq("user_id", userId)
          .eq("active", true)
          .order("name"),
        supabase
          .from("habit_logs")
          .select("habit_id")
          .eq("user_id", userId)
          .eq("logged_date", today)
          .eq("completed", true),
      ]);
      const loggedIds = new Set(
        (todayLogs ?? []).map((l: { habit_id: string }) => l.habit_id),
      );
      const result = (habits ?? []).map(
        (h: {
          id: string;
          name: string;
          icon: string;
          color: string;
          frequency: string;
          active: boolean;
        }) => ({
          ...h,
          done_today: loggedIds.has(h.id),
        }),
      );
      return {
        success: true,
        message: `Found ${result.length} active habits`,
        data: result,
      };
    }

    case "create_habit": {
      const p = CreateHabitInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("habits")
        .insert({
          user_id: userId,
          name: p.data.name,
          description: p.data.description ?? null,
          frequency: p.data.frequency ?? "daily",
          target_days: p.data.target_days ?? [0, 1, 2, 3, 4, 5, 6],
          color: p.data.color ?? "#6366f1",
          icon: "⭐",
          reminder_time: p.data.reminder_time ?? null,
          active: true,
        })
        .select()
        .single();
      if (error) return dbErr("create_habit", error);
      return {
        success: true,
        message: `Created habit: "${p.data.name}"`,
        data,
      };
    }

    case "update_habit": {
      const p = UpdateHabitInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("habits")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("name")
        .single();
      if (error) return dbErr("update_habit", error);
      return { success: true, message: `Updated habit: "${data?.name}"` };
    }

    case "delete_habit": {
      const p = DeleteHabitInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("habits")
        .select("id, name")
        .eq("id", p.data.habit_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Habit not found" };
      const { error } = await supabase
        .from("habits")
        .delete()
        .eq("id", p.data.habit_id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_habit", error);
      return { success: true, message: `Deleted habit: "${existing.name}"` };
    }

    case "delete_habit_log": {
      const p = DeleteHabitLogInput.safeParse(input);
      if (!p.success) return badInput();
      const { error } = await supabase
        .from("habit_logs")
        .delete()
        .eq("habit_id", p.data.habit_id)
        .eq("logged_date", p.data.logged_date)
        .eq("user_id", userId);
      if (error) return dbErr("delete_habit_log", error);
      return {
        success: true,
        message: `Removed habit log for ${p.data.logged_date}`,
      };
    }

    // ─── TRANSACTIONS ──────────────────────────────────────────────────────────

    case "list_transactions": {
      const p = ListTransactionsInput.safeParse(input);
      const typeFilter = p.success ? p.data.type : "all";
      const startDate = p.success ? p.data.start_date : undefined;
      const limitVal = p.success && p.data.limit ? p.data.limit : 20;
      let query = supabase
        .from("transactions")
        .select(
          "id, type, amount, category, description, date, payment_method, payment_method_id, from_payment_method_id, to_payment_method_id",
        )
        .eq("user_id", userId);
      if (typeFilter && typeFilter !== "all")
        query = query.eq("type", typeFilter);
      if (startDate) query = query.gte("date", startDate);
      const { data, error } = await query
        .order("date", { ascending: false })
        .limit(limitVal);
      if (error) return dbErr("list_transactions", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} transactions`,
        data,
      };
    }

    case "update_transaction": {
      const p = UpdateTransactionInput.safeParse(input);
      if (!p.success) return badInput();
      const { transaction_id, summary: _ts, ...updates } = p.data;
      const { data: existing } = await supabase
        .from("transactions")
        .select("id")
        .eq("id", transaction_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing)
        return { success: false, message: "Transaction not found" };
      const { error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", transaction_id)
        .eq("user_id", userId);
      if (error) return dbErr("update_transaction", error);
      return { success: true, message: "Transaction updated." };
    }

    case "delete_transaction": {
      const p = DeleteTransactionInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("transactions")
        .select("id, category, amount")
        .eq("id", p.data.transaction_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing)
        return { success: false, message: "Transaction not found" };
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", p.data.transaction_id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_transaction", error);
      return { success: true, message: "Transaction deleted." };
    }

    // ─── BUDGETS ───────────────────────────────────────────────────────────────

    case "list_budgets": {
      const { data, error } = await supabase
        .from("budgets")
        .select("id, category, amount, period, period_start, period_end")
        .eq("user_id", userId)
        .order("period_end", { ascending: false });
      if (error) return dbErr("list_budgets", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} budgets`,
        data,
      };
    }

    case "create_budget": {
      const p = CreateBudgetInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("budgets")
        .insert({
          user_id: userId,
          category: p.data.category,
          amount: p.data.amount,
          period: p.data.period ?? "monthly",
          period_start: p.data.period_start,
          period_end: p.data.period_end,
        })
        .select()
        .single();
      if (error) return dbErr("create_budget", error);
      return {
        success: true,
        message: `Created budget: ${p.data.category} AED ${p.data.amount}`,
        data,
      };
    }

    case "update_budget": {
      const p = UpdateBudgetInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error } = await supabase
        .from("budgets")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return dbErr("update_budget", error);
      return { success: true, message: "Budget updated." };
    }

    case "delete_budget": {
      const p = DeleteBudgetInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("budgets")
        .select("id, category")
        .eq("id", p.data.budget_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Budget not found" };
      const { error } = await supabase
        .from("budgets")
        .delete()
        .eq("id", p.data.budget_id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_budget", error);
      return { success: true, message: `Deleted budget: ${existing.category}` };
    }

    // ─── DEBTS ─────────────────────────────────────────────────────────────────

    case "list_debts": {
      const p = ListDebtsInput.safeParse(input);
      const filter = p.success ? (p.data.filter ?? "all") : "all";
      let query = supabase
        .from("debts")
        .select("id, creditor, type, amount, description, due_date, paid_at")
        .eq("user_id", userId);
      if (filter === "i_owe") query = query.eq("type", "i_owe");
      else if (filter === "they_owe") query = query.eq("type", "they_owe");
      else if (filter === "unpaid") query = query.is("paid_at", null);
      const { data, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) return dbErr("list_debts", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} debt records`,
        data,
      };
    }

    case "create_debt": {
      const p = CreateDebtInput.safeParse(input);
      if (!p.success) return badInput();
      const direction = p.data.type === "i_owe" ? "owed to" : "owed by";
      const { error, data } = await supabase
        .from("debts")
        .insert({
          user_id: userId,
          creditor: p.data.creditor,
          type: p.data.type,
          amount: p.data.amount,
          description: p.data.description ?? null,
          due_date: p.data.due_date ?? null,
        })
        .select()
        .single();
      if (error) return dbErr("create_debt", error);
      return {
        success: true,
        message: `Recorded AED ${p.data.amount} ${direction} ${p.data.creditor}`,
        data,
      };
    }

    case "update_debt": {
      const p = UpdateDebtInput.safeParse(input);
      if (!p.success) return badInput();
      const { debt_id, summary: _ds, mark_paid, ...updates } = p.data;
      const { data: existing } = await supabase
        .from("debts")
        .select("id, creditor")
        .eq("id", debt_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Debt not found" };
      const payload = {
        ...updates,
        ...(mark_paid ? { paid_at: new Date().toISOString() } : {}),
      };
      const { error } = await supabase
        .from("debts")
        .update(payload)
        .eq("id", debt_id)
        .eq("user_id", userId);
      if (error) return dbErr("update_debt", error);
      return {
        success: true,
        message: mark_paid
          ? `Marked debt to ${existing.creditor} as paid.`
          : "Debt updated.",
      };
    }

    case "delete_debt": {
      const p = DeleteDebtInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("debts")
        .select("id, creditor")
        .eq("id", p.data.debt_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Debt not found" };
      const { error } = await supabase
        .from("debts")
        .delete()
        .eq("id", p.data.debt_id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_debt", error);
      return {
        success: true,
        message: `Deleted debt record for ${existing.creditor}`,
      };
    }

    // ─── CONTACTS ──────────────────────────────────────────────────────────────

    case "list_contacts": {
      const p = ListContactsInput.safeParse(input);
      const typeFilter = p.success ? p.data.type : "all";
      const limitVal = p.success && p.data.limit ? p.data.limit : 20;
      let query = supabase
        .from("contacts")
        .select("id, name, email, phone, company, type, stage")
        .eq("user_id", userId);
      if (typeFilter && typeFilter !== "all")
        query = query.eq("type", typeFilter);
      const { data, error } = await query.order("name").limit(limitVal);
      if (error) return dbErr("list_contacts", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} contacts`,
        data,
      };
    }

    case "update_contact": {
      const p = UpdateContactInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("name")
        .single();
      if (error) return dbErr("update_contact", error);
      return { success: true, message: `Updated contact: "${data?.name}"` };
    }

    case "delete_contact": {
      const p = DeleteContactInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("id", p.data.contact_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Contact not found" };
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", p.data.contact_id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_contact", error);
      return { success: true, message: `Deleted contact: "${existing.name}"` };
    }

    // ─── INTERACTIONS ──────────────────────────────────────────────────────────

    case "create_interaction": {
      const p = CreateInteractionInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("interactions")
        .insert({
          user_id: userId,
          contact_id: p.data.contact_id,
          type: p.data.type,
          notes: p.data.notes,
          date: p.data.date ?? today,
          follow_up_date: p.data.follow_up_date ?? null,
        })
        .select()
        .single();
      if (error) return dbErr("create_interaction", error);
      return {
        success: true,
        message: `Logged ${p.data.type} interaction`,
        data,
      };
    }

    case "list_interactions": {
      const p = ListInteractionsInput.safeParse(input);
      if (!p.success) return badInput();
      const { data, error } = await supabase
        .from("interactions")
        .select("id, type, notes, date, follow_up_date")
        .eq("contact_id", p.data.contact_id)
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(20);
      if (error) return dbErr("list_interactions", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} interactions`,
        data,
      };
    }

    case "update_interaction": {
      const p = UpdateInteractionInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error } = await supabase
        .from("interactions")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return dbErr("update_interaction", error);
      return { success: true, message: "Interaction updated." };
    }

    case "delete_interaction": {
      const p = DeleteInteractionInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("interactions")
        .select("id")
        .eq("id", p.data.interaction_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing)
        return { success: false, message: "Interaction not found" };
      const { error } = await supabase
        .from("interactions")
        .delete()
        .eq("id", p.data.interaction_id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_interaction", error);
      return { success: true, message: "Interaction deleted." };
    }

    // ─── NOTES ─────────────────────────────────────────────────────────────────

    case "list_notes": {
      const p = ListNotesInput.safeParse(input);
      const limitVal = p.success && p.data.limit ? p.data.limit : 20;
      const tagFilter = p.success ? p.data.tag : undefined;
      let query = supabase
        .from("notes")
        .select("id, title, tags, created_at")
        .eq("user_id", userId);
      if (tagFilter) query = query.contains("tags", [tagFilter]);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limitVal);
      if (error) return dbErr("list_notes", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} notes`,
        data,
      };
    }

    case "update_note": {
      const p = UpdateNoteInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("notes")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("title")
        .single();
      if (error) return dbErr("update_note", error);
      return { success: true, message: `Updated note: "${data?.title}"` };
    }

    // ─── DOCUMENTS ─────────────────────────────────────────────────────────────

    case "list_documents": {
      const p = z
        .object({ limit: z.number().int().positive().max(100).optional() })
        .safeParse(input);
      const limitVal = p.success && p.data.limit ? p.data.limit : 20;
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, file_type, file_size, tags, notes, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limitVal);
      if (error) return dbErr("list_documents", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} documents`,
        data,
      };
    }

    case "create_document": {
      const p = CreateDocumentInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("documents")
        .insert({
          user_id: userId,
          name: p.data.name,
          file_path: p.data.file_path,
          file_type: p.data.file_type ?? null,
          file_size: p.data.file_size ?? null,
          tags: p.data.tags ?? [],
          notes: p.data.notes ?? null,
        })
        .select()
        .single();
      if (error) return dbErr("create_document", error);
      return {
        success: true,
        message: `Saved document: "${p.data.name}"`,
        data,
      };
    }

    case "update_document": {
      const p = UpdateDocumentInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error, data } = await supabase
        .from("documents")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("name")
        .single();
      if (error) return dbErr("update_document", error);
      return { success: true, message: `Updated document: "${data?.name}"` };
    }

    case "delete_document": {
      const p = DeleteDocumentInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("documents")
        .select("id, name")
        .eq("id", p.data.document_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Document not found" };
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", p.data.document_id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_document", error);
      return { success: true, message: `Deleted document: "${existing.name}"` };
    }

    // ─── LINKS ─────────────────────────────────────────────────────────────────

    case "list_links": {
      const p = z
        .object({ limit: z.number().int().positive().max(100).optional() })
        .safeParse(input);
      const limitVal = p.success && p.data.limit ? p.data.limit : 20;
      const { data, error } = await supabase
        .from("links")
        .select("id, url, title, description, tags, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limitVal);
      if (error) return dbErr("list_links", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} links`,
        data,
      };
    }

    case "create_link": {
      const p = CreateLinkInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("links")
        .insert({
          user_id: userId,
          url: p.data.url,
          title: p.data.title ?? null,
          description: p.data.description ?? null,
          tags: p.data.tags ?? [],
        })
        .select()
        .single();
      if (error) return dbErr("create_link", error);
      return {
        success: true,
        message: `Saved link: "${p.data.title ?? p.data.url}"`,
        data,
      };
    }

    case "update_link": {
      const p = UpdateLinkInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error } = await supabase
        .from("links")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return dbErr("update_link", error);
      return { success: true, message: "Link updated." };
    }

    case "delete_link": {
      const p = DeleteLinkInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("links")
        .select("id")
        .eq("id", p.data.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Link not found" };
      const { error } = await supabase
        .from("links")
        .delete()
        .eq("id", p.data.id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_link", error);
      return { success: true, message: "Link deleted." };
    }

    // ─── JOURNAL ENTRIES ───────────────────────────────────────────────────────

    case "list_journal_entries": {
      const p = z
        .object({ limit: z.number().int().positive().max(50).optional() })
        .safeParse(input);
      const limitVal = p.success && p.data.limit ? p.data.limit : 10;
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id, date, mood, energy, tags, created_at")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(limitVal);
      if (error) return dbErr("list_journal_entries", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} journal entries`,
        data,
      };
    }

    case "create_journal_entry": {
      const p = CreateJournalEntryInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("journal_entries")
        .upsert(
          {
            user_id: userId,
            date: p.data.date,
            content: p.data.content,
            mood: p.data.mood ?? null,
            energy: p.data.energy ?? null,
            tags: p.data.tags ?? [],
          },
          { onConflict: "user_id,date" },
        )
        .select()
        .single();
      if (error) return dbErr("create_journal_entry", error);
      return {
        success: true,
        message: `Journal entry saved for ${p.data.date}`,
        data,
      };
    }

    case "update_journal_entry": {
      const p = UpdateJournalEntryInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error } = await supabase
        .from("journal_entries")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return dbErr("update_journal_entry", error);
      return { success: true, message: "Journal entry updated." };
    }

    case "delete_journal_entry": {
      const p = DeleteJournalEntryInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("journal_entries")
        .select("id, date")
        .eq("id", p.data.entry_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing)
        return { success: false, message: "Journal entry not found" };
      const { error } = await supabase
        .from("journal_entries")
        .delete()
        .eq("id", p.data.entry_id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_journal_entry", error);
      return {
        success: true,
        message: `Deleted journal entry for ${existing.date}`,
      };
    }

    // ─── REVIEWS ───────────────────────────────────────────────────────────────

    case "list_reviews": {
      const p = ListReviewsInput.safeParse(input);
      const typeFilter = p.success ? p.data.type : "all";
      const limitVal = p.success && p.data.limit ? p.data.limit : 10;
      let query = supabase
        .from("reviews")
        .select("id, type, period_start, period_end, mood, energy, created_at")
        .eq("user_id", userId);
      if (typeFilter && typeFilter !== "all")
        query = query.eq("type", typeFilter);
      const { data, error } = await query
        .order("period_end", { ascending: false })
        .limit(limitVal);
      if (error) return dbErr("list_reviews", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} reviews`,
        data,
      };
    }

    case "create_review": {
      const p = CreateReviewInput.safeParse(input);
      if (!p.success) return badInput();
      const { error, data } = await supabase
        .from("reviews")
        .insert({
          user_id: userId,
          type: p.data.type,
          period_start: p.data.period_start,
          period_end: p.data.period_end,
          content: p.data.content ? { text: p.data.content } : {},
          mood: p.data.mood ?? null,
          energy: p.data.energy ?? null,
        })
        .select()
        .single();
      if (error) return dbErr("create_review", error);
      return {
        success: true,
        message: `Created ${p.data.type} review for ${p.data.period_start}–${p.data.period_end}`,
        data,
      };
    }

    case "update_review": {
      const p = UpdateReviewInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, content, ...rest } = p.data;
      const { error } = await supabase
        .from("reviews")
        .update({
          ...rest,
          ...(content !== undefined ? { content: { text: content } } : {}),
        })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return dbErr("update_review", error);
      return { success: true, message: "Review updated." };
    }

    case "delete_review": {
      const p = DeleteReviewInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("reviews")
        .select("id, type, period_start")
        .eq("id", p.data.review_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { success: false, message: "Review not found" };
      const { error } = await supabase
        .from("reviews")
        .delete()
        .eq("id", p.data.review_id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_review", error);
      return {
        success: true,
        message: `Deleted ${existing.type} review for ${existing.period_start}`,
      };
    }

    // ─── FOCUS SESSIONS ────────────────────────────────────────────────────────

    case "list_focus_sessions": {
      const p = ListFocusSessionsInput.safeParse(input);
      const limitVal = p.success && p.data.limit ? p.data.limit : 10;
      const taskFilter = p.success ? p.data.task_id : undefined;
      let query = supabase
        .from("focus_sessions")
        .select("id, duration_minutes, started_at, ended_at, notes, task_id")
        .eq("user_id", userId);
      if (taskFilter) query = query.eq("task_id", taskFilter);
      const { data, error } = await query
        .order("started_at", { ascending: false })
        .limit(limitVal);
      if (error) return dbErr("list_focus_sessions", error);
      return {
        success: true,
        message: `Found ${data?.length ?? 0} focus sessions`,
        data,
      };
    }

    case "create_focus_session": {
      const p = CreateFocusSessionInput.safeParse(input);
      if (!p.success) return badInput();
      const now = new Date().toISOString();
      const { error, data } = await supabase
        .from("focus_sessions")
        .insert({
          user_id: userId,
          duration_minutes: p.data.duration_minutes,
          started_at: p.data.started_at ?? now,
          ended_at: p.data.ended_at ?? null,
          task_id: p.data.task_id ?? null,
          notes: p.data.notes ?? null,
        })
        .select()
        .single();
      if (error) return dbErr("create_focus_session", error);
      return {
        success: true,
        message: `Recorded ${p.data.duration_minutes}-minute focus session`,
        data,
      };
    }

    case "update_focus_session": {
      const p = UpdateFocusSessionInput.safeParse(input);
      if (!p.success) return badInput();
      const { id, ...updates } = p.data;
      const { error } = await supabase
        .from("focus_sessions")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return dbErr("update_focus_session", error);
      return { success: true, message: "Focus session updated." };
    }

    case "delete_focus_session": {
      const p = ByIdInput.safeParse(input);
      if (!p.success) return badInput();
      const { data: existing } = await supabase
        .from("focus_sessions")
        .select("id")
        .eq("id", p.data.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing)
        return { success: false, message: "Focus session not found" };
      const { error } = await supabase
        .from("focus_sessions")
        .delete()
        .eq("id", p.data.id)
        .eq("user_id", userId);
      if (error) return dbErr("delete_focus_session", error);
      return { success: true, message: "Focus session deleted." };
    }

    // ─── PERSONAL MEMORY ───────────────────────────────────────────────────────

    case "remember_user_fact": {
      const p = z
        .object({
          key: z.string().min(1).max(100),
          value: z.string().min(1).max(1000),
        })
        .safeParse(input);
      if (!p.success) return badInput();

      // Merge fact into user_profile.facts (upsert-safe)
      const { data: existing } = await supabase
        .from("user_profile")
        .select("facts")
        .eq("user_id", userId)
        .maybeSingle();
      const currentFacts = (existing?.facts ?? {}) as Record<string, string>;
      const updatedFacts = { ...currentFacts, [p.data.key]: p.data.value };

      const { error } = await supabase
        .from("user_profile")
        .upsert(
          { user_id: userId, facts: updatedFacts },
          { onConflict: "user_id" },
        );
      if (error) return dbErr("remember_user_fact", error);

      // Also store in ai_memory for semantic retrieval
      storeMemory(
        userId,
        `User fact — ${p.data.key}: ${p.data.value}`,
        { role: "user" },
        "user_fact",
        supabase,
      ).catch(() => {});

      return {
        success: true,
        message: `Remembered: ${p.data.key} = ${p.data.value}`,
      };
    }

    case "recall_memories": {
      const p = z
        .object({
          query: z.string().min(1).max(500),
          limit: z.number().int().positive().max(20).optional(),
        })
        .safeParse(input);
      if (!p.success) return badInput();

      const [semantic, facts] = await Promise.all([
        retrieveMemories(userId, p.data.query, p.data.limit ?? 10, supabase),
        retrieveUserFacts(userId, supabase),
      ]);

      const results = [
        ...facts.map((f) => ({
          content: f.content,
          type: "user_fact",
          similarity: 1,
        })),
        ...semantic.map((m) => ({
          content: m.content,
          type: "conversation",
          similarity: m.similarity,
        })),
      ];

      if (!results.length)
        return {
          success: true,
          message: "No relevant memories found.",
          data: [],
        };
      return {
        success: true,
        message: `Found ${results.length} relevant memories`,
        data: results,
      };
    }

    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}
