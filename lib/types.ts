// ─── Realms (formerly Life Areas) ───
export type Realm = 'Professional' | 'Personal' | 'Financial' | 'Relationship' | 'Wellness' | 'Vision';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type Recurrence = 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
export type GtdContext = 'inbox' | 'next-action' | 'waiting-for' | 'someday-maybe' | 'reference' | 'project-support';
export type Quadrant = 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important';
export type LeadStatus = 'New' | 'Qualified' | 'Appointment Booked';
export type DealStatus = 'Processing' | 'Call Verification' | 'Completed' | 'Card Activation' | 'Successful' | 'Unsuccessful';
export type TransactionType = 'Income' | 'Expense';
export type TransactionStatus = 'Received' | 'Paid' | 'Pending';
export type ConnectionType = 'Spouse' | 'Child' | 'Parent' | 'Sibling' | 'Friend' | 'Colleague' | 'Other';
export type GoalTimeline = '1yr' | '3yr' | '5yr';
export type VisionCategory = 'Personal' | 'Professional' | 'Financial' | 'Relationship' | 'Wellness' | 'Vision';
export type HabitFrequency = 'daily' | 'specific-days' | 'custom';
export type HabitProject = 'Morning Routine' | 'Business Discipline' | 'Evening Routine' | 'Custom';
export type PomodoroType = 'work' | 'short-break' | 'long-break';
export type ThemeMode = 'system' | 'light' | 'dark';
export type DebtStatus = 'Active' | 'Paid Off';
export type ExpenseType = 'Mandatory' | 'Optional';
export type PaymentMethod = 'Cash' | 'Credit Card' | 'Debit Card' | 'Bank Transfer' | 'Digital Wallet';
export type ImportantDateType = 'Birthday' | 'Anniversary' | 'Special Day' | 'Custom';
export type ReviewType = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type ReminderOption = '5-min-before' | 'at-time' | '10-min-after';
export type DateReminderOption = '1-day' | '3-days' | '7-days' | 'custom';

// Legacy aliases for backward compatibility during migration
export type LifeArea = Realm | 'Inbox';
export type GoalArea = 'health' | 'work' | 'personal' | 'financial' | 'relationship';

// ─── Action (formerly Task) ───
export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  realm: Realm;
  area?: LifeArea; // legacy compat
  targetId?: string;
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

// ─── Target (formerly Project) ───
export interface Project {
  id: string;
  userId: string;
  title: string;
  realm: Realm;
  area?: LifeArea; // legacy compat
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

// ─── Vision Goal (for Vision Timeline) ───
export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: VisionCategory;
  area?: GoalArea; // legacy compat
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

// ─── Rhythm (formerly Habit) ───
export interface Habit {
  id: string;
  userId: string;
  name: string;
  description?: string;
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
  reminder?: boolean;
  reminderOption?: ReminderOption;
  notes?: string;
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
  source?: string; // for income
  status?: TransactionStatus;
  expenseType?: ExpenseType;
  paymentMethod?: PaymentMethod;
  notes?: string;
  createdAt: string;
}

// ─── Budget ───
export interface Budget {
  id: string;
  userId: string;
  category: string;
  monthlyLimit: number;
  monthYear?: string; // empty = recurring monthly
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
  targetPayoffDate?: string;
  status: DebtStatus;
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
  birthday?: string;
  importantDate?: string;
  dateType?: ImportantDateType;
  dateReminder?: DateReminderOption;
  notes?: string;
  createdAt: string;
}

// ─── Important Date ───
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

// ─── Family Mission Statement ───
export interface FamilyMission {
  id: string;
  userId: string;
  content: string;
  updatedAt: string;
  createdAt: string;
}

// ─── Personal Mission (Vision Page) ───
export interface PersonalMission {
  id: string;
  userId: string;
  content: string;
  updatedAt: string;
  createdAt: string;
}

// ─── Core Value (Vision Page) ───
export interface CoreValue {
  id: string;
  userId: string;
  value: string;
  order: number;
  createdAt: string;
}

// ─── Review (expanded for weekly/monthly/quarterly/yearly) ───
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

// ─── Realm Configuration ───
export const REALMS: { id: Realm; name: string; emoji: string; color: string; description: string }[] = [
  { id: 'Professional', name: 'Professional', emoji: '💼', color: '#1E4AFF', description: 'Focus, clarity, execution' },
  { id: 'Personal',     name: 'Personal',     emoji: '🎯', color: '#800080', description: 'Identity, creativity, self-expression' },
  { id: 'Financial',    name: 'Financial',    emoji: '💰', color: '#00A86B', description: 'Growth, stability, wealth' },
  { id: 'Relationship', name: 'Relationship', emoji: '💖', color: '#FF4F6D', description: 'Connection, empathy, warmth' },
  { id: 'Wellness',     name: 'Wellness',     emoji: '🧘', color: '#1ABC9C', description: 'Balance, health, vitality' },
  { id: 'Vision',       name: 'Vision',       emoji: '✨', color: '#FFD700', description: 'Purpose, long-term direction, ambition' },
];

// Legacy alias
export const LIFE_AREAS = REALMS.map(r => ({ ...r, id: r.id as LifeArea }));

export const PRIORITY_CONFIG: Record<Priority, { label: string; short: string; color: string }> = {
  P1: { label: 'Urgent & Important',     short: 'P1', color: '#EF4444' },
  P2: { label: 'Not Urgent & Important', short: 'P2', color: '#F59E0B' },
  P3: { label: 'Urgent & Not Important', short: 'P3', color: '#3B82F6' },
  P4: { label: 'Not Urgent & Not Important', short: 'P4', color: '#6B7280' },
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
  'Salary', 'Commission', 'Bonus', 'Business Income',
  'Investment Returns', 'Side Income', 'Other'
] as const;

export const EXPENSE_CATEGORIES = [
  'Housing (Rent, Utilities)', 'Food (Groceries, Dining)',
  'Transport (Fuel, Taxi, Parking)', 'Healthcare (Medical, Insurance)',
  'Education (Courses, Books)', 'Entertainment (Movies, Hobbies)',
  'Shopping (Clothes, Electronics)', 'Business Expenses',
  'Savings & Investments', 'Other'
] as const;

export const DOCUMENT_CATEGORIES = [
  'Legal', 'Financial', 'Medical', 'Travel', 'Educational', 'Insurance', 'Personal', 'Other'
] as const;

export const PROJECT_COLORS = [
  '#b8255f', '#db4035', '#ff9933', '#fad000', '#7ecc49', '#299438',
  '#6accbc', '#158fad', '#14aaf5', '#96c3eb', '#4073ff', '#884dff',
  '#af38eb', '#eb96eb', '#e05194', '#ff8d85', '#808080', '#b8b8b8',
] as const;

export const HABIT_CATEGORIES = [
  'Morning Routine', 'Business Discipline', 'Evening Routine', 'Custom'
] as const;

export const HABIT_PROJECTS: HabitProject[] = [
  'Morning Routine', 'Business Discipline', 'Evening Routine', 'Custom'
];

export const VISION_CATEGORIES: { value: VisionCategory; label: string; color: string }[] = [
  { value: 'Personal', label: 'Personal', color: '#800080' },
  { value: 'Professional', label: 'Professional', color: '#1E4AFF' },
  { value: 'Financial', label: 'Financial', color: '#00A86B' },
  { value: 'Relationship', label: 'Relationship', color: '#FF4F6D' },
  { value: 'Wellness', label: 'Wellness', color: '#1ABC9C' },
  { value: 'Vision', label: 'Vision', color: '#FFD700' },
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Digital Wallet'
];
