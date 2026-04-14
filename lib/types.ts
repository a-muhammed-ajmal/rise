// ─── RISE TYPE DEFINITIONS ───────────────────────────────────────────────────
// Internal TS interfaces use legacy names for Firestore compat.
// UI always uses RISE terminology (Action, Target, Rhythm, Vision, Realm, Connection).

import type {
  PRIORITIES,
  VISION_CATEGORIES,
  GOAL_TIMELINES,
  RHYTHM_CATEGORIES,
  HABIT_PROJECTS,
  LEAD_STATUSES,
  DEAL_STATUSES,
  CONNECTION_TYPES,
  REVIEW_TYPES,
  MOODS,
  DOCUMENT_CATEGORIES,
} from './constants';

// ─── ENUMS / UNION TYPES ─────────────────────────────────────────────────────
export type Priority = (typeof PRIORITIES)[number];
export type VisionCategory = (typeof VISION_CATEGORIES)[number];
export type GoalTimeline = (typeof GOAL_TIMELINES)[number];
export type RhythmCategory = (typeof RHYTHM_CATEGORIES)[number];
export type HabitProject = (typeof HABIT_PROJECTS)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type DealStatus = (typeof DEAL_STATUSES)[number];
export type ConnectionType = (typeof CONNECTION_TYPES)[number];
export type ReviewType = (typeof REVIEW_TYPES)[number];
export type Mood = (typeof MOODS)[number];
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type Recurrence = 'None' | 'Daily' | 'Weekdays' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom';
export type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type HabitStatus = 'pending' | 'done' | 'failed';
export type PomodoroType = 'work' | 'short-break' | 'long-break';
export type TransactionType = 'Income' | 'Expense';
export type ExpenseType = 'Mandatory' | 'Optional';
export type TransactionStatus = 'Received' | 'Paid' | 'Pending';
export type DebtStatus = 'Active' | 'Paid Off';
export type ImportantDateType = 'Birthday' | 'Anniversary' | 'Special Day' | 'Custom';
export type DateReminderOption = '1-day' | '3-days' | '7-days' | 'custom';
export type MilestoneType = 'Checkpoint' | 'Deliverable' | 'Review';
export type GoalActionPriority = 'High' | 'Medium' | 'Low';
export type ChatRole = 'user' | 'assistant';

// ─── SUPPORTING ──────────────────────────────────────────────────────────────
export interface ProgressEntry {
  date: string;
  progress: number;
}

export interface Reminder {
  enabled: boolean;
  time: string;
}

export interface TaskStep {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskReminder {
  enabled: boolean;
  option: string;
  customDateTime?: string;
}

// ─── USER META ───────────────────────────────────────────────────────────────
export interface UserMeta {
  onboardingComplete: boolean;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  lastLoginAt: string;
}

// ─── ACTION (collection: tasks) ──────────────────────────────────────────────
export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  steps?: TaskStep[];
  realm: string;
  area?: string;
  targetId?: string;
  projectId?: string;
  goalId?: string;
  connectionId?: string;
  labelIds?: string[];
  dueDate?: string;
  dueTime?: string;
  priority: Priority;
  isMyDay: boolean;
  isStarred: boolean;
  isCompleted: boolean;
  completedAt?: string;
  recurring?: Recurrence;
  customDays?: number[];
  reminder?: TaskReminder;
  parentId?: string;
  order: number;
  createdAt: string;
}

// ─── TARGET (collection: projects) ───────────────────────────────────────────
export interface Project {
  id: string;
  userId: string;
  title: string;
  realm: string;
  area?: string;
  color: string;
  icon: string;
  goalId?: string;
  order: number;
  isFavorite: boolean;
  isCompleted: boolean;
  completedAt?: string;
  dueDate?: string;
  createdAt: string;
}

// ─── LABEL (collection: labels) ──────────────────────────────────────────────
export interface Label {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

// ─── VISION (collection: goals) ──────────────────────────────────────────────
export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: VisionCategory;
  area?: string;
  why: string;
  metric: string;
  crystal: string;
  timeline: GoalTimeline;
  targetDate?: string;
  progress: number;
  progressHistory: ProgressEntry[];
  isCompleted: boolean;
  completedAt?: string;
  createdAt: string;
}

// ─── MILESTONE (collection: milestones) ──────────────────────────────────────
export interface Milestone {
  id: string;
  userId: string;
  goalId: string;
  text: string;
  date: string;
  type: MilestoneType;
  done: boolean;
  createdAt: string;
}

// ─── GOAL ACTION (collection: goal-actions) ──────────────────────────────────
export interface GoalAction {
  id: string;
  userId: string;
  goalId: string;
  text: string;
  done: boolean;
  priority: GoalActionPriority;
  dueDate?: string;
  createdAt: string;
}

// ─── RHYTHM (collection: habits) ─────────────────────────────────────────────
export interface Habit {
  id: string;
  userId: string;
  name: string;
  description?: string;
  note?: string;
  icon: string;
  color: string;
  category: string;
  project: HabitProject;
  time?: string;
  frequency: HabitFrequency;
  customDays?: number[];
  targetCount: number;
  goalId?: string;
  trigger?: string;
  reminder: Reminder;
  completions: Record<string, number>;
  statusLog: Record<string, HabitStatus>;
  streak: number;
  bestStreak: number;
  isActive: boolean;
  order: number;
  createdAt: string;
}

// ─── POMODORO SESSION (collection: pomodoro-sessions) ────────────────────────
export interface PomodoroSession {
  id: string;
  userId: string;
  taskId?: string;
  startedAt: string;
  duration: number;
  type: PomodoroType;
  completed: boolean;
}

// ─── POMODORO SETTINGS (localStorage) ───────────────────────────────────────
export interface PomodoroSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  autoStartBreak: boolean;
  autoStartWork: boolean;
}

// ─── TRANSACTION (collection: transactions) ──────────────────────────────────
export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  description?: string;
  source?: string;
  status?: TransactionStatus;
  expenseType?: ExpenseType;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
}

// ─── BUDGET (collection: budgets) ────────────────────────────────────────────
export interface Budget {
  id: string;
  userId: string;
  category: string;
  monthlyLimit: number;
  monthYear?: string;
  createdAt: string;
}

// ─── DEBT (collection: debts) ────────────────────────────────────────────────
export interface Debt {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  remainingBalance: number;
  monthlyPayment?: number;
  interestRate?: number;
  dueDay?: number;
  targetPayoffDate?: string;
  status: DebtStatus;
  notes?: string;
  createdAt: string;
}

// ─── LEAD (collection: leads) ────────────────────────────────────────────────
export interface Lead {
  id: string;
  userId: string;
  name: string;
  company?: string;
  salary?: number;
  salaryBank?: string;
  phone?: string;
  email?: string;
  status: LeadStatus;
  source?: string;
  emirate?: string;
  bank?: string;
  product?: string;
  cardType?: string;
  notes?: string;
  createdAt: string;
}

// ─── DEAL (collection: deals) ────────────────────────────────────────────────
export interface Deal {
  id: string;
  userId: string;
  name: string;
  status: DealStatus;
  applicationNumber?: string;
  bpmId?: string;
  company?: string;
  salary?: number;
  salaryBank?: string;
  dob?: string;
  nationality?: string;
  visaStatus?: string;
  emiratesId?: string;
  passportNumber?: string;
  aecbScore?: string;
  locationEmirate?: string;
  submissionDate?: string;
  completionDate?: string;
  bank?: string;
  product?: string;
  cardType?: string;
  leadId?: string;
  notes?: string;
  createdAt: string;
}

// ─── CONNECTION (collection: connections) ────────────────────────────────────
export interface Connection {
  id: string;
  userId: string;
  name: string;
  type: ConnectionType;
  relationship?: string;
  mobile?: string;
  email?: string;
  birthday?: string;
  importantDate?: string;
  dateType?: ImportantDateType;
  dateReminder?: DateReminderOption;
  notes?: string;
  createdAt: string;
}

// ─── REVIEW (collection: reviews) ────────────────────────────────────────────
export interface Review {
  id: string;
  userId: string;
  reviewType: ReviewType;
  weekStartDate?: string;
  monthYear?: string;
  quarter?: string;
  year?: string;
  rating: number;
  answers: Record<string, string>;
  metrics?: Record<string, number | string>;
  wins: string;
  challenges?: string;
  lessons?: string;
  gps?: string;
  next?: string;
  createdAt: string;
  updatedAt?: string;
}

// ─── JOURNAL (collection: journal-entries) ───────────────────────────────────
export interface Journal {
  id: string;
  userId: string;
  date: string;
  text: string;
  energy: number;
  mood?: Mood;
  createdAt: string;
}

// ─── DOCUMENT (collection: documents) ────────────────────────────────────────
export interface RiseDocument {
  id: string;
  userId: string;
  title: string;
  url?: string;
  category: DocumentCategory;
  notes?: string;
  createdAt: string;
}

// ─── CHAT MESSAGE (collection: chat-messages) ────────────────────────────────
export interface ChatMessage {
  id: string;
  userId: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  createdAt: string;
}

// ─── IMPORTANT DATE ──────────────────────────────────────────────────────────
export interface ImportantDate {
  id: string;
  userId: string;
  eventName: string;
  date: string;
  type: ImportantDateType;
  reminder?: DateReminderOption;
  connectionId?: string;
  createdAt: string;
}
