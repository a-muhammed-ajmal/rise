export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

// ─── Standalone row types (avoids circular reference in Database generic) ────

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: "active" | "completed" | "archived";
  color: string;
  created_at: string;
  updated_at: string;
};
export type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

export type TaskAttachment = {
  name: string;
  url: string;
  type: string; // MIME type
};

export type TaskStatus = "todo" | "in_progress" | "blocked" | "on_hold" | "done";
export type TaskPriority = "P1" | "P2" | "P3" | "P4";

export type Comment = {
  id: string;
  text: string;
  created_at: string;
};

export type ActivityEntry = {
  id: string;
  action: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
};

export type LinkedTask = {
  task_id: string;
  relationship: "blocks" | "blocked_by" | "related";
};

/** iCal RRULE string, e.g. "FREQ=DAILY" */
export type RecurrenceRule = string;

type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  due_time: string | null;
  completed_at: string | null;
  is_focus: boolean;
  focus_date: string | null;
  is_starred: boolean;
  labels: string[];
  subtasks: Subtask[];
  attachments: TaskAttachment[];
  comments: Comment[];
  activity: ActivityEntry[];
  recurrence: RecurrenceRule | null;
  reminder: string | null;
  estimated_time: number | null;
  location: string | null;
  linked_tasks: LinkedTask[];
  project_id: string | null;
  created_at: string;
  updated_at: string;
};
type GoalRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: "personal" | "professional" | "health" | "financial" | "other";
  target_date: string | null;
  status: "active" | "completed" | "abandoned";
  progress: number;
  created_at: string;
  updated_at: string;
};
type MilestoneRow = {
  id: string;
  user_id: string;
  goal_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
};
type ReviewRow = {
  id: string;
  user_id: string;
  type: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  period_start: string;
  period_end: string;
  content: Json;
  mood: number | null;
  energy: number | null;
  created_at: string;
  updated_at: string;
};
type JournalEntryRow = {
  id: string;
  user_id: string;
  date: string;
  content: string;
  mood: number | null;
  energy: number | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};
type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense";
  created_at: string;
};
type PaymentMethodRow = {
  id: string;
  user_id: string;
  name: string;
  balance: number;
  color: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};
type TransactionRow = {
  id: string;
  user_id: string;
  type: "income" | "expense" | "transfer" | "adjustment";
  amount: number;
  category: string;
  description: string | null;
  date: string;
  payment_method: string | null;
  payment_method_id: string | null;
  from_payment_method_id: string | null;
  to_payment_method_id: string | null;
  tags: string[];
  created_at: string;
};
type BudgetRow = {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  period: "monthly" | "quarterly" | "yearly";
  period_start: string;
  period_end: string;
  created_at: string;
};
type DebtRow = {
  id: string;
  user_id: string;
  creditor: string;
  type: "i_owe" | "they_owe";
  amount: number;
  description: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
};
type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  frequency: "daily" | "weekly" | "custom";
  target_days: number[];
  color: string;
  icon: string;
  reminder_time: string | null; // stored as "HH:MM:SS", nullable
  active: boolean;
  created_at: string;
};
type HabitLogRow = {
  id: string;
  user_id: string;
  habit_id: string;
  logged_date: string;
  completed: boolean;
  note: string | null;
  created_at: string;
};
type FocusSessionRow = {
  id: string;
  user_id: string;
  task_id: string | null;
  duration_minutes: number;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
};
type ContactRow = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  type: "lead" | "prospect" | "client" | "network" | "personal";
  stage: "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
  deal_value: number | null;
  notes: string | null;
  tags: string[];
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
};
type InteractionRow = {
  id: string;
  user_id: string;
  contact_id: string;
  type: "call" | "email" | "meeting" | "message" | "other";
  notes: string;
  date: string;
  follow_up_date: string | null;
  created_at: string;
};
type NoteRow = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  linked_to_type: "task" | "goal" | "contact" | null;
  linked_to_id: string | null;
  created_at: string;
  updated_at: string;
};
type DocumentRow = {
  id: string;
  user_id: string;
  name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  tags: string[];
  notes: string | null;
  created_at: string;
};
type LinkRow = {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  description: string | null;
  tags: string[];
  created_at: string;
};
type AiConversationRow = {
  id: string;
  user_id: string;
  messages: Json;
  created_at: string;
  updated_at: string;
};
type AiMemoryRow = {
  id: string;
  user_id: string;
  content: string;
  metadata: Json;
  embedding: number[] | null;
  created_at: string;
};
type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  reminder_types: ("habit_nudge" | "crm_followup")[];
  created_at: string;
};

// ─── Helper to build Insert / Update from Row ─────────────────────────────────

// Makes nullable (T[K] includes null) fields optional — mirrors Supabase generated Insert types
type MakeNullableOptional<T> = {
  [K in keyof T as null extends T[K] ? never : K]: T[K];
} & {
  [K in keyof T as null extends T[K] ? K : never]?: T[K];
};

type Insertable<T extends { id: string; created_at: string }> =
  "updated_at" extends keyof T
    ? MakeNullableOptional<Omit<T, "id" | "created_at" | "updated_at">>
    : MakeNullableOptional<Omit<T, "id" | "created_at">>;

// ─── Database interface ───────────────────────────────────────────────────────
// Relationships: never[] satisfies GenericTable requirement from @supabase/supabase-js

type T<Row, Ins, Upd> = {
  Row: Row;
  Insert: Ins;
  Update: Upd;
  Relationships: never[];
};

export interface Database {
  public: {
    Tables: {
      projects: T<
        ProjectRow,
        Insertable<ProjectRow>,
        Partial<Insertable<ProjectRow>>
      >;
      tasks: T<TaskRow, Insertable<TaskRow>, Partial<Insertable<TaskRow>>>;
      goals: T<GoalRow, Insertable<GoalRow>, Partial<Insertable<GoalRow>>>;
      milestones: T<
        MilestoneRow,
        Insertable<MilestoneRow>,
        Partial<Insertable<MilestoneRow>>
      >;
      reviews: T<
        ReviewRow,
        Insertable<ReviewRow>,
        Partial<Insertable<ReviewRow>>
      >;
      journal_entries: T<
        JournalEntryRow,
        Insertable<JournalEntryRow>,
        Partial<Insertable<JournalEntryRow>>
      >;
      categories: T<
        CategoryRow,
        Insertable<CategoryRow>,
        Partial<Insertable<CategoryRow>>
      >;
      payment_methods: T<
        PaymentMethodRow,
        Insertable<PaymentMethodRow>,
        Partial<Insertable<PaymentMethodRow>>
      >;
      transactions: T<
        TransactionRow,
        Insertable<TransactionRow>,
        Partial<Insertable<TransactionRow>>
      >;
      budgets: T<
        BudgetRow,
        Insertable<BudgetRow>,
        Partial<Insertable<BudgetRow>>
      >;
      debts: T<DebtRow, Insertable<DebtRow>, Partial<Insertable<DebtRow>>>;
      habits: T<HabitRow, Insertable<HabitRow>, Partial<Insertable<HabitRow>>>;
      habit_logs: T<
        HabitLogRow,
        Insertable<HabitLogRow>,
        Partial<Insertable<HabitLogRow>>
      >;
      focus_sessions: T<
        FocusSessionRow,
        Insertable<FocusSessionRow>,
        Partial<Insertable<FocusSessionRow>>
      >;
      contacts: T<
        ContactRow,
        Insertable<ContactRow>,
        Partial<Insertable<ContactRow>>
      >;
      interactions: T<
        InteractionRow,
        Insertable<InteractionRow>,
        Partial<Insertable<InteractionRow>>
      >;
      notes: T<NoteRow, Insertable<NoteRow>, Partial<Insertable<NoteRow>>>;
      documents: T<
        DocumentRow,
        Insertable<DocumentRow>,
        Partial<Insertable<DocumentRow>>
      >;
      links: T<LinkRow, Insertable<LinkRow>, Partial<Insertable<LinkRow>>>;
      ai_conversations: T<
        AiConversationRow,
        Insertable<AiConversationRow>,
        Partial<Insertable<AiConversationRow>>
      >;
      ai_memory: T<
        AiMemoryRow,
        Insertable<AiMemoryRow>,
        Partial<Insertable<AiMemoryRow>>
      >;
      push_subscriptions: T<
        PushSubscriptionRow,
        Insertable<PushSubscriptionRow>,
        Partial<Insertable<PushSubscriptionRow>>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      match_memories: {
        Args: {
          query_embedding: number[];
          match_user_id: string;
          match_count?: number;
          match_threshold?: number;
        };
        Returns: {
          id: string;
          content: string;
          metadata: Json;
          similarity: number;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}

// ─── Convenience row type exports ─────────────────────────────────────────────

export type Project = ProjectRow;
/** Task with the derived is_completed field (computed from completed_at in the hook) */
export type Task = TaskRow & { is_completed: boolean };
export type Goal = GoalRow;
export type Milestone = MilestoneRow;
export type Review = ReviewRow;
export type JournalEntry = JournalEntryRow;
export type Category = CategoryRow;
export type PaymentMethod = PaymentMethodRow;
export type Transaction = TransactionRow;
export type Budget = BudgetRow;
export type Debt = DebtRow;
export type Habit = HabitRow;
export type HabitLog = HabitLogRow;
export type FocusSession = FocusSessionRow;
export type Contact = ContactRow;
export type Interaction = InteractionRow;
export type Note = NoteRow;
export type Document = DocumentRow;
export type Link = LinkRow;
export type AiConversation = AiConversationRow;
export type AiMemory = AiMemoryRow;
export type PushSubscription = PushSubscriptionRow;

// ─── Chat attachment types ─────────────────────────────────────────────────

export type ChatAttachmentCategory = "image" | "file" | "audio";

export type ChatAttachment = {
  /** UUID, client-assigned when the file is selected */
  id: string;
  /** Path in the chat-attachments Supabase Storage bucket */
  storage_path: string;
  /** Original filename */
  filename: string;
  /** Server-verified MIME type */
  mime_type: string;
  /** File size in bytes */
  size_bytes: number;
  /** Broad category driving server-side handling */
  category: ChatAttachmentCategory;
  /** Populated for file category: extracted plain text */
  extracted_text?: string;
  /** Populated for audio category: Gemini transcript */
  transcript?: string;
};
