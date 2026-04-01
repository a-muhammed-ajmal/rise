// ─── Life Areas ───
export type LifeArea = 'Inbox' | 'Personal' | 'Professional' | 'Financial' | 'Wellness' | 'Relationship' | 'Vision';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type Recurrence = 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
export type GtdContext = 'inbox' | 'next-action' | 'waiting-for' | 'someday-maybe' | 'reference' | 'project-support';
export type Quadrant = 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important';
export type LeadStatus = 'New' | 'Qualified' | 'Appointment Booked';
export type DealStatus = 'Processing' | 'Call Verification' | 'Completed' | 'Card Activation' | 'Successful' | 'Unsuccessful';
export type TransactionType = 'Income' | 'Expense';
export type TransactionStatus = 'Received' | 'Paid' | 'Pending';
export type ConnectionType = 'Father' | 'Mother' | 'Spouse' | 'Sibling' | 'Child' | 'Extended Family' | 'Close Friend' | 'Colleague' | 'Mentor' | 'Other';
export type GoalTimeline = '1yr' | '3yr' | '5yr';
export type GoalArea = 'health' | 'work' | 'personal' | 'financial' | 'relationship';
export type HabitFrequency = 'daily' | 'weekly' | 'custom';
export type PomodoroType = 'work' | 'short-break' | 'long-break';
export type ThemeMode = 'system' | 'light' | 'dark';

// ─── Task ───
export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  area: LifeArea;
  projectId?: string;
  goalId?: string;
  connectionId?: string;
  labelIds?: string[];
  dueDate?: string;
  dueTime?: string;
  priority: Priority;
  gtdContext?: GtdContext;
  quadrant?: Quadrant;
  isMyDay: boolean;
  isStarred: boolean;
  isCompleted: boolean;
  completedAt?: string;
  recurring?: Recurrence;
  parentId?: string;
  order: number;
  createdAt: string;
}

// ─── Project ───
export interface Project {
  id: string;
  userId: string;
  title: string;
  area: LifeArea;
  color: string;
  icon: string;
  goalId?: string;
  order: number;
  isFavorite: boolean;
  dueDate?: string;
  createdAt: string;
}

// ─── Label ───
export interface Label {
  id: string;
  userId: string;
  name: string;
  color: string;
}

// ─── Goal (NICE Framework + Timeline) ───
export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  area: GoalArea;
  why: string;
  metric: string;
  crystal: string;
  timeline: GoalTimeline;
  targetDate?: string;
  progress: number;
  progressHistory: ProgressEntry[];
  isCompleted: boolean;
  createdAt: string;
}

export interface ProgressEntry {
  date: string;
  progress: number;
}

// ─── Milestone ───
export interface Milestone {
  id: string;
  userId: string;
  goalId: string;
  text: string;
  date: string;
  type: string;
  done: boolean;
  createdAt: string;
}

// ─── Goal Action ───
export interface GoalAction {
  id: string;
  userId: string;
  goalId: string;
  text: string;
  done: boolean;
  priority: 'High' | 'Medium' | 'Low';
  dueDate?: string;
  createdAt: string;
}

// ─── Habit ───
export interface Habit {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  customDays?: number[];
  targetCount: number;
  goalId?: string;
  time?: string;
  trigger?: string;
  completions: Record<string, number>; // date -> count
  streak: number;
  bestStreak: number;
  isActive: boolean;
  order: number;
  createdAt: string;
}

// ─── Pomodoro ───
export interface PomodoroSession {
  id: string;
  userId: string;
  taskId?: string;
  startedAt: string;
  duration: number;
  type: PomodoroType;
  completed: boolean;
}

export interface PomodoroSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  autoStartBreak: boolean;
  autoStartWork: boolean;
}

// ─── Lead (UAE Banking CRM) ───
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

// ─── Deal (UAE Banking) ───
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

// ─── Transaction ───
export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  description?: string;
  status?: TransactionStatus;
  notes?: string;
  createdAt: string;
}

// ─── Budget ───
export interface Budget {
  id: string;
  userId: string;
  category: string;
  monthlyLimit: number;
  monthYear?: string;
  createdAt: string;
}

// ─── Debt ───
export interface Debt {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  remainingBalance: number;
  monthlyPayment?: number;
  interestRate?: number;
  dueDay?: number;
  notes?: string;
  createdAt: string;
}

// ─── Connection (Relationship) ───
export interface Connection {
  id: string;
  userId: string;
  name: string;
  type: ConnectionType;
  relationship?: string;
  mobile?: string;
  email?: string;
  importantDate?: string;
  dateType?: string;
  notes?: string;
  createdAt: string;
}

// ─── Review ───
export interface Review {
  id: string;
  userId: string;
  weekStartDate: string;
  rating: number;
  wins: string;
  challenges?: string;
  lessons?: string;
  gps?: string;
  next?: string;
  createdAt: string;
}

// ─── Journal ───
export interface Journal {
  id: string;
  userId: string;
  date: string;
  text: string;
  energy: number;
  mood?: string;
  createdAt: string;
}

// ─── Document ───
export interface RiseDocument {
  id: string;
  userId: string;
  title: string;
  url?: string;
  category: string;
  notes?: string;
  createdAt: string;
}

// ─── Chat Message ───
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ─── Constants ───
export const LIFE_AREAS: { id: LifeArea; name: string; emoji: string; color: string; description: string }[] = [
  { id: 'Inbox',        name: 'Inbox',        emoji: '📥', color: '#6B7280', description: 'Unsorted items' },
  { id: 'Personal',     name: 'Personal',     emoji: '🎯', color: '#6B7280', description: 'Personal life & self' },
  { id: 'Professional', name: 'Professional', emoji: '💼', color: '#3B82F6', description: 'Work & career' },
  { id: 'Financial',    name: 'Financial',    emoji: '💰', color: '#10B981', description: 'Money & finance' },
  { id: 'Wellness',     name: 'Wellness',     emoji: '❤️', color: '#EF4444', description: 'Health & habits' },
  { id: 'Relationship', name: 'Relationship', emoji: '👥', color: '#EC4899', description: 'Family & friends' },
  { id: 'Vision',       name: 'Vision',       emoji: '✨', color: '#6B7280', description: 'Goals & aspirations' },
];

export const PRIORITY_CONFIG: Record<Priority, { label: string; short: string; color: string }> = {
  P1: { label: 'Urgent & Important',     short: 'P1 Urgent',    color: '#EF4444' },
  P2: { label: 'Not Urgent & Important', short: 'P2 Important', color: '#10B981' },
  P3: { label: 'Urgent & Not Important', short: 'P3 Delegate',  color: '#3B82F6' },
  P4: { label: 'Not Urgent & Not Important', short: 'P4 Later', color: '#6B7280' },
};

export const GTD_CONFIG: Record<GtdContext, { title: string; icon: string; color: string }> = {
  'inbox': { title: 'Inbox', icon: 'inbox', color: '#4073FF' },
  'next-action': { title: 'Next Actions', icon: 'zap', color: '#DC4C3E' },
  'waiting-for': { title: 'Waiting For', icon: 'clock', color: '#F49C18' },
  'someday-maybe': { title: 'Someday/Maybe', icon: 'cloud', color: '#6B7280' },
  'reference': { title: 'Reference', icon: 'bookmark', color: '#2D7C3E' },
  'project-support': { title: 'Project Support', icon: 'folder', color: '#7B4B9E' },
};

export const QUADRANT_CONFIG: Record<Quadrant, { title: string; subtitle: string; color: string }> = {
  'urgent-important': { title: 'Do First', subtitle: 'Urgent & Important', color: '#DC4C3E' },
  'not-urgent-important': { title: 'Schedule', subtitle: 'Not Urgent & Important', color: '#4073FF' },
  'urgent-not-important': { title: 'Delegate', subtitle: 'Urgent & Not Important', color: '#F49C18' },
  'not-urgent-not-important': { title: 'Eliminate', subtitle: 'Not Urgent & Not Important', color: '#6B7280' },
};

export const UAE_BANKS = [
  'ADCB', 'ENBD', 'DIB', 'FAB', 'Mashreq Bank', 'CBD',
  'RAKBANK', 'ADIB', 'Emirates Islamic Bank', 'Sharjah Islamic Bank',
  'HSBC UAE', 'Citi Bank', 'Standard Chartered'
] as const;

export const UAE_EMIRATES = [
  'Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman',
  'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'
] as const;

export const LEAD_SOURCES = ['LinkedIn', 'Cold Calling', 'Referrals', 'Follow-up', 'Other'] as const;
export const PRODUCTS = ['Credit Card', 'Personal Loan', 'Auto Loan', 'Account Opening', 'Other'] as const;

export const INCOME_CATEGORIES = [
  'Salary', 'Commission', 'Incentive', 'Bonus', 'Gift', 'Side Income', 'Other'
] as const;

export const EXPENSE_CATEGORIES = [
  'Housing/Rent', 'Food & Groceries', 'Transport/Fuel', 'Utilities',
  'Telecommunications', 'Healthcare', 'Education', 'Entertainment', 'Shopping',
  'Personal Care', 'Debt Repayment', 'Insurance', 'Savings/Investment',
  'Business Expenses', 'Others'
] as const;

export const DOCUMENT_CATEGORIES = [
  'Legal', 'Financial', 'Medical', 'Travel', 'Educational', 'Insurance', 'Personal', 'Other'
] as const;

export const PROJECT_COLORS = [
  '#b8255f', '#db4035', '#ff9933', '#fad000', '#7ecc49', '#299438',
  '#6accbc', '#158fad', '#14aaf5', '#96c3eb', '#4073ff', '#884dff',
  '#af38eb', '#eb96eb', '#e05194', '#ff8d85', '#808080', '#b8b8b8',
] as const;
