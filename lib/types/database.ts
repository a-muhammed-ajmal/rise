export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ─── Standalone row types (avoids circular reference in Database generic) ────

type ProjectRow = {
  id: string; user_id: string; name: string; description: string | null
  status: 'active' | 'completed' | 'archived'; color: string
  created_at: string; updated_at: string
}
type TaskRow = {
  id: string; user_id: string; title: string; description: string | null
  status: 'inbox' | 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null; completed_at: string | null
  is_recurring: boolean; recurrence_rule: string | null
  project_id: string | null; created_at: string; updated_at: string
}
type GoalRow = {
  id: string; user_id: string; title: string; description: string | null
  category: 'personal' | 'professional' | 'health' | 'financial' | 'other'
  target_date: string | null; status: 'active' | 'completed' | 'abandoned'
  progress: number; created_at: string; updated_at: string
}
type MilestoneRow = {
  id: string; user_id: string; goal_id: string; title: string
  due_date: string | null; completed_at: string | null; created_at: string
}
type ReviewRow = {
  id: string; user_id: string
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  period_start: string; period_end: string; content: Json
  mood: number | null; energy: number | null; created_at: string; updated_at: string
}
type JournalEntryRow = {
  id: string; user_id: string; date: string; content: string
  mood: number | null; energy: number | null; tags: string[]
  created_at: string; updated_at: string
}
type TransactionRow = {
  id: string; user_id: string; type: 'income' | 'expense'
  amount: number; category: string; description: string | null
  date: string; payment_method: string | null; tags: string[]; created_at: string
}
type BudgetRow = {
  id: string; user_id: string; category: string; amount: number
  period: 'monthly' | 'quarterly' | 'yearly'
  period_start: string; period_end: string; created_at: string
}
type DebtRow = {
  id: string; user_id: string; creditor: string
  type: 'i_owe' | 'they_owe'; amount: number
  description: string | null; due_date: string | null; paid_at: string | null; created_at: string
}
type HabitRow = {
  id: string; user_id: string; name: string; description: string | null
  frequency: 'daily' | 'weekly' | 'custom'; target_days: number[]
  color: string; icon: string; active: boolean; created_at: string
}
type HabitLogRow = {
  id: string; user_id: string; habit_id: string; logged_date: string
  completed: boolean; note: string | null; created_at: string
}
type FocusSessionRow = {
  id: string; user_id: string; task_id: string | null; duration_minutes: number
  started_at: string; ended_at: string | null; notes: string | null; created_at: string
}
type ContactRow = {
  id: string; user_id: string; name: string; email: string | null; phone: string | null
  company: string | null; role: string | null
  type: 'lead' | 'prospect' | 'client' | 'network' | 'personal'
  stage: 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
  deal_value: number | null; notes: string | null; tags: string[]
  last_contacted_at: string | null; created_at: string; updated_at: string
}
type InteractionRow = {
  id: string; user_id: string; contact_id: string
  type: 'call' | 'email' | 'meeting' | 'message' | 'other'
  notes: string; date: string; follow_up_date: string | null; created_at: string
}
type NoteRow = {
  id: string; user_id: string; title: string; content: string; tags: string[]
  linked_to_type: 'task' | 'goal' | 'contact' | null; linked_to_id: string | null
  created_at: string; updated_at: string
}
type DocumentRow = {
  id: string; user_id: string; name: string; file_path: string
  file_type: string | null; file_size: number | null; tags: string[]
  notes: string | null; created_at: string
}
type LinkRow = {
  id: string; user_id: string; url: string; title: string | null
  description: string | null; tags: string[]; created_at: string
}
type AiConversationRow = {
  id: string; user_id: string; messages: Json; created_at: string; updated_at: string
}
type AiMemoryRow = {
  id: string; user_id: string; content: string; metadata: Json; created_at: string
}

// ─── Helper to build Insert / Update from Row ─────────────────────────────────

// Makes nullable (T[K] includes null) fields optional — mirrors Supabase generated Insert types
type MakeNullableOptional<T> = {
  [K in keyof T as null extends T[K] ? never : K]: T[K]
} & {
  [K in keyof T as null extends T[K] ? K : never]?: T[K]
}

type Insertable<T extends { id: string; created_at: string }> =
  'updated_at' extends keyof T
    ? MakeNullableOptional<Omit<T, 'id' | 'created_at' | 'updated_at'>>
    : MakeNullableOptional<Omit<T, 'id' | 'created_at'>>

// ─── Database interface ───────────────────────────────────────────────────────
// Relationships: never[] satisfies GenericTable requirement from @supabase/supabase-js

type T<Row, Ins, Upd> = { Row: Row; Insert: Ins; Update: Upd; Relationships: never[] }

export interface Database {
  public: {
    Tables: {
      projects:        T<ProjectRow,        Insertable<ProjectRow>,        Partial<Insertable<ProjectRow>>>
      tasks:           T<TaskRow,           Insertable<TaskRow>,           Partial<Insertable<TaskRow>>>
      goals:           T<GoalRow,           Insertable<GoalRow>,           Partial<Insertable<GoalRow>>>
      milestones:      T<MilestoneRow,      Insertable<MilestoneRow>,      Partial<Insertable<MilestoneRow>>>
      reviews:         T<ReviewRow,         Insertable<ReviewRow>,         Partial<Insertable<ReviewRow>>>
      journal_entries: T<JournalEntryRow,   Insertable<JournalEntryRow>,   Partial<Insertable<JournalEntryRow>>>
      transactions:    T<TransactionRow,    Insertable<TransactionRow>,    Partial<Insertable<TransactionRow>>>
      budgets:         T<BudgetRow,         Insertable<BudgetRow>,         Partial<Insertable<BudgetRow>>>
      debts:           T<DebtRow,           Insertable<DebtRow>,           Partial<Insertable<DebtRow>>>
      habits:          T<HabitRow,          Insertable<HabitRow>,          Partial<Insertable<HabitRow>>>
      habit_logs:      T<HabitLogRow,       Insertable<HabitLogRow>,       Partial<Insertable<HabitLogRow>>>
      focus_sessions:  T<FocusSessionRow,   Insertable<FocusSessionRow>,   Partial<Insertable<FocusSessionRow>>>
      contacts:        T<ContactRow,        Insertable<ContactRow>,        Partial<Insertable<ContactRow>>>
      interactions:    T<InteractionRow,    Insertable<InteractionRow>,    Partial<Insertable<InteractionRow>>>
      notes:           T<NoteRow,           Insertable<NoteRow>,           Partial<Insertable<NoteRow>>>
      documents:       T<DocumentRow,       Insertable<DocumentRow>,       Partial<Insertable<DocumentRow>>>
      links:           T<LinkRow,           Insertable<LinkRow>,           Partial<Insertable<LinkRow>>>
      ai_conversations:T<AiConversationRow, Insertable<AiConversationRow>, Partial<Insertable<AiConversationRow>>>
      ai_memory:       T<AiMemoryRow,       Insertable<AiMemoryRow>,       Partial<Insertable<AiMemoryRow>>>
    }
    Views: Record<string, never>
    Functions: {
      match_memories: {
        Args: { query_embedding: number[]; match_user_id: string; match_count?: number; match_threshold?: number }
        Returns: { id: string; content: string; metadata: Json; similarity: number }[]
      }
    }
    Enums: Record<string, never>
  }
}

// ─── Convenience row type exports ─────────────────────────────────────────────

export type Project      = ProjectRow
export type Task         = TaskRow
export type Goal         = GoalRow
export type Milestone    = MilestoneRow
export type Review       = ReviewRow
export type JournalEntry = JournalEntryRow
export type Transaction  = TransactionRow
export type Budget       = BudgetRow
export type Debt         = DebtRow
export type Habit        = HabitRow
export type HabitLog     = HabitLogRow
export type FocusSession = FocusSessionRow
export type Contact      = ContactRow
export type Interaction  = InteractionRow
export type Note         = NoteRow
export type Document     = DocumentRow
export type Link         = LinkRow
export type AiConversation = AiConversationRow
export type AiMemory     = AiMemoryRow
