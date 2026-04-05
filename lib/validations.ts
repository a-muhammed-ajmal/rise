import { z } from 'zod';

// ─── Type Definitions ─────────────────────────────────────────────────────────

export const LifeArea = z.enum(['Inbox', 'Personal', 'Professional', 'Financial', 'Wellness', 'Relationship', 'Vision']);
export const Priority = z.enum(['P1', 'P2', 'P3', 'P4']);
export const Recurrence = z.enum(['None', 'Daily', 'Weekly', 'Monthly', 'Yearly']);
export const GtdContext = z.enum(['inbox', 'next-action', 'waiting-for', 'someday-maybe', 'reference', 'project-support']);
export const Quadrant = z.enum(['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important']);
export const LeadStatus = z.enum(['New', 'Qualified', 'Appointment Booked']);
export const DealStatus = z.enum(['Processing', 'Call Verification', 'Completed', 'Card Activation', 'Successful', 'Unsuccessful']);
export const TransactionType = z.enum(['Income', 'Expense']);
export const TransactionStatus = z.enum(['Received', 'Paid', 'Pending']);
export const ConnectionType = z.enum(['Father', 'Mother', 'Spouse', 'Sibling', 'Child', 'Extended Family', 'Close Friend', 'Colleague', 'Mentor', 'Other']);
export const GoalTimeline = z.enum(['1yr', '3yr', '5yr']);
export const GoalArea = z.enum(['health', 'work', 'personal', 'financial', 'relationship']);
export const HabitFrequency = z.enum(['daily', 'weekly', 'monthly', 'yearly']);
export const PomodoroType = z.enum(['work', 'short-break', 'long-break']);
export const ThemeMode = z.enum(['system', 'light', 'dark']);

// ─── Task Schema ─────────────────────────────────────────────────────────────

export const TaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  area: LifeArea,
  projectId: z.string().optional().nullable(),
  goalId: z.string().optional().nullable(),
  connectionId: z.string().optional().nullable(),
  labelIds: z.array(z.string()).optional().default([]),
  dueDate: z.string().optional().nullable(),
  dueTime: z.string().optional().nullable(),
  priority: Priority,
  gtdContext: GtdContext.optional().nullable(),
  quadrant: Quadrant.optional().nullable(),
  isMyDay: z.boolean().default(false),
  isStarred: z.boolean().default(false),
  isCompleted: z.boolean().default(false),
  completedAt: z.string().optional().nullable(),
  recurring: Recurrence.default('None'),
  parentId: z.string().optional().nullable(),
  order: z.number().default(0),
});

// ─── Project Schema ──────────────────────────────────────────────────────────

export const ProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  area: LifeArea,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  icon: z.string().min(1, 'Icon is required'),
  goalId: z.string().optional().nullable(),
  order: z.number().default(0),
  isFavorite: z.boolean().default(false),
  dueDate: z.string().optional().nullable(),
});

// ─── Label Schema ────────────────────────────────────────────────────────────

export const LabelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
});

// ─── Goal Schema ─────────────────────────────────────────────────────────────

export const GoalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  area: GoalArea,
  why: z.string().min(1, 'Why is required'),
  metric: z.string().min(1, 'Metric is required'),
  crystal: z.string().min(1, 'Crystal is required'),
  timeline: GoalTimeline,
  targetDate: z.string().optional().nullable(),
  progress: z.number().min(0).max(100).default(0),
  progressHistory: z.array(z.object({
    date: z.string(),
    progress: z.number().min(0).max(100),
  })).default([]),
  isCompleted: z.boolean().default(false),
});

// ─── Milestone Schema ────────────────────────────────────────────────────────

export const MilestoneSchema = z.object({
  goalId: z.string().min(1, 'Goal ID is required'),
  text: z.string().min(1, 'Text is required'),
  date: z.string().min(1, 'Date is required'),
  type: z.string().min(1, 'Type is required'),
  done: z.boolean().default(false),
});

// ─── Goal Action Schema ──────────────────────────────────────────────────────

export const GoalActionSchema = z.object({
  goalId: z.string().min(1, 'Goal ID is required'),
  text: z.string().min(1, 'Text is required'),
  priority: z.enum(['High', 'Medium', 'Low']),
  dueDate: z.string().optional().nullable(),
});

// ─── Habit Schema ────────────────────────────────────────────────────────────

export const HabitSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  note: z.string().optional().nullable(),
  icon: z.string().min(1, 'Icon is required'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  category: z.string().optional().nullable(),
  project: z.string().optional().nullable(),
  frequency: HabitFrequency,
  customDays: z.array(z.number().min(1).max(7)).optional(),
  targetCount: z.number().int().positive().default(1),
  goalId: z.string().optional().nullable(),
  time: z.string().optional().nullable(),
  trigger: z.string().optional().nullable(),
  reminder: z.object({ enabled: z.boolean(), time: z.string() }).optional().default({ enabled: false, time: '' }),
  completions: z.record(z.string(), z.number()).default({}),
  statusLog: z.record(z.string(), z.enum(['pending', 'done', 'failed'])).optional().default({}),
  streak: z.number().int().nonnegative().default(0),
  bestStreak: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  order: z.number().default(0),
});

// ─── Pomodoro Session Schema ─────────────────────────────────────────────────

export const PomodoroSessionSchema = z.object({
  taskId: z.string().optional().nullable(),
  startedAt: z.string().min(1, 'Start time is required'),
  duration: z.number().int().positive(),
  type: PomodoroType,
  completed: z.boolean().default(false),
});

export const PomodoroSettingsSchema = z.object({
  workDuration: z.number().int().positive().default(25),
  shortBreakDuration: z.number().int().positive().default(5),
  longBreakDuration: z.number().int().positive().default(15),
  sessionsBeforeLongBreak: z.number().int().positive().default(4),
  autoStartBreak: z.boolean().default(false),
  autoStartWork: z.boolean().default(false),
});

// ─── Lead Schema ─────────────────────────────────────────────────────────────

export const LeadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  company: z.string().optional().nullable(),
  salary: z.number().positive().optional().nullable(),
  salaryBank: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  status: LeadStatus,
  source: z.string().optional().nullable(),
  emirate: z.string().optional().nullable(),
  bank: z.string().optional().nullable(),
  product: z.string().optional().nullable(),
  cardType: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── Deal Schema ─────────────────────────────────────────────────────────────

export const DealSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  status: DealStatus,
  applicationNumber: z.string().optional().nullable(),
  bpmId: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  salary: z.number().positive().optional().nullable(),
  salaryBank: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  visaStatus: z.string().optional().nullable(),
  emiratesId: z.string().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  aecbScore: z.string().optional().nullable(),
  locationEmirate: z.string().optional().nullable(),
  submissionDate: z.string().optional().nullable(),
  completionDate: z.string().optional().nullable(),
  bank: z.string().optional().nullable(),
  product: z.string().optional().nullable(),
  cardType: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── Transaction Schema ──────────────────────────────────────────────────────

export const TransactionSchema = z.object({
  type: TransactionType,
  amount: z.number().positive('Amount must be positive'),
  category: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  description: z.string().optional().nullable(),
  status: TransactionStatus.optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── Budget Schema ───────────────────────────────────────────────────────────

export const BudgetSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  monthlyLimit: z.number().positive('Monthly limit must be positive'),
  monthYear: z.string().optional().nullable(),
});

// ─── Debt Schema ─────────────────────────────────────────────────────────────

export const DebtSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  totalAmount: z.number().positive('Total amount must be positive'),
  remainingBalance: z.number().min(0, 'Remaining balance cannot be negative'),
  monthlyPayment: z.number().positive().optional().nullable(),
  interestRate: z.number().min(0).max(100).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── Connection Schema ───────────────────────────────────────────────────────

export const ConnectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: ConnectionType,
  relationship: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  importantDate: z.string().optional().nullable(),
  dateType: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── Review Schema ───────────────────────────────────────────────────────────

export const ReviewSchema = z.object({
  weekStartDate: z.string().min(1, 'Week start date is required'),
  rating: z.number().min(1).max(10, 'Rating must be 1-10'),
  wins: z.string().min(1, 'Wins are required'),
  challenges: z.string().optional().nullable(),
  lessons: z.string().optional().nullable(),
  gps: z.string().optional().nullable(),
  next: z.string().optional().nullable(),
});

// ─── Journal Schema ──────────────────────────────────────────────────────────

export const JournalSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  text: z.string().min(1, 'Text is required'),
  energy: z.number().min(1).max(5, 'Energy must be 1-5'),
  mood: z.string().optional().nullable(),
});

// ─── Document Schema ────────────────────────────────────────────────────────

export const DocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  url: z.string().url().optional().or(z.literal('')).nullable(),
  category: z.string().min(1, 'Category is required'),
  notes: z.string().optional().nullable(),
});

// ─── Chat Message Schema ─────────────────────────────────────────────────────

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1, 'Content is required'),
});

// ─── Progress Entry Schema ───────────────────────────────────────────────────

export const ProgressEntrySchema = z.object({
  date: z.string().min(1, 'Date is required'),
  progress: z.number().min(0).max(100, 'Progress must be 0-100'),
});

// ─── Partial schemas for updates ───────────────────────────────────────────────
// For updates, we allow any subset of fields to be provided. System fields (id, userId, createdAt)
// are not part of these schemas, so no need to omit them. Just make everything optional.

export const TaskUpdateSchema = TaskSchema.partial();
export const ProjectUpdateSchema = ProjectSchema.partial();
export const LabelUpdateSchema = LabelSchema.partial();
export const GoalUpdateSchema = GoalSchema.partial();
export const MilestoneUpdateSchema = MilestoneSchema.partial();
export const GoalActionUpdateSchema = GoalActionSchema.partial();
export const HabitUpdateSchema = HabitSchema.partial();
export const PomodoroSessionUpdateSchema = PomodoroSessionSchema.partial();
export const LeadUpdateSchema = LeadSchema.partial();
export const DealUpdateSchema = DealSchema.partial();
export const TransactionUpdateSchema = TransactionSchema.partial();
export const BudgetUpdateSchema = BudgetSchema.partial();
export const DebtUpdateSchema = DebtSchema.partial();
export const ConnectionUpdateSchema = ConnectionSchema.partial();
export const ReviewUpdateSchema = ReviewSchema.partial();
export const JournalUpdateSchema = JournalSchema.partial();
export const DocumentUpdateSchema = DocumentSchema.partial();

// ─── Map collection names to schemas ─────────────────────────────────────────

export const CollectionSchemas: Record<string, z.ZodObject<any>> = {
  tasks: TaskSchema,
  projects: ProjectSchema,
  labels: LabelSchema,
  goals: GoalSchema,
  milestones: MilestoneSchema,
  'goal-actions': GoalActionSchema,
  habits: HabitSchema,
  'pomodoro-sessions': PomodoroSessionSchema,
  leads: LeadSchema,
  deals: DealSchema,
  transactions: TransactionSchema,
  budgets: BudgetSchema,
  debts: DebtSchema,
  connections: ConnectionSchema,
  reviews: ReviewSchema,
  'journal-entries': JournalSchema,
  documents: DocumentSchema,
  chatMessages: ChatMessageSchema,
};

// ─── Map collection names to update schemas ───────────────────────────────────

export const CollectionUpdateSchemas: Record<string, z.ZodObject<any>> = {
  tasks: TaskUpdateSchema,
  projects: ProjectUpdateSchema,
  labels: LabelUpdateSchema,
  goals: GoalUpdateSchema,
  milestones: MilestoneUpdateSchema,
  'goal-actions': GoalActionUpdateSchema,
  habits: HabitUpdateSchema,
  'pomodoro-sessions': PomodoroSessionUpdateSchema,
  leads: LeadUpdateSchema,
  deals: DealUpdateSchema,
  transactions: TransactionUpdateSchema,
  budgets: BudgetUpdateSchema,
  debts: DebtUpdateSchema,
  connections: ConnectionUpdateSchema,
  reviews: ReviewUpdateSchema,
  'journal-entries': JournalUpdateSchema,
  documents: DocumentUpdateSchema,
  chatMessages: ChatMessageSchema, // No update for chat messages typically
};

// ─── Helper function ─────────────────────────────────────────────────────────

export function validateDocument(collectionName: string, data: unknown, isUpdate: boolean = false) {
  const schemas = isUpdate ? CollectionUpdateSchemas : CollectionSchemas;
  const schema = schemas[collectionName];
  if (!schema) {
    return { valid: false, error: `Unknown collection: ${collectionName}` };
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    // ZodError has .issues array with path and message
    const issues = result.error.issues.map(issue => ({
      path: issue.path,
      message: issue.message,
    }));
    return { valid: false, error: issues };
  }
  return { valid: true, data: result.data };
}
