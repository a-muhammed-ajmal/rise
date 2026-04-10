// ─── RISE TERMINOLOGY ────────────────────────────────────────────────────────
export const TERMINOLOGY = {
  REALM: 'Realm',
  TARGET: 'Target',
  ACTION: 'Action',
  RHYTHM: 'Rhythm',
  VISION: 'Vision',
  CONNECTION: 'Connection',
} as const;

// ─── FIRESTORE COLLECTION NAMES (FROZEN) ─────────────────────────────────────
export const COLLECTIONS = {
  TASKS: 'tasks',
  PROJECTS: 'projects',
  LABELS: 'labels',
  GOALS: 'goals',
  MILESTONES: 'milestones',
  GOAL_ACTIONS: 'goal-actions',
  HABITS: 'habits',
  POMODORO_SESSIONS: 'pomodoro-sessions',
  LEADS: 'leads',
  DEALS: 'deals',
  TRANSACTIONS: 'transactions',
  BUDGETS: 'budgets',
  DEBTS: 'debts',
  CONNECTIONS: 'connections',
  REVIEWS: 'reviews',
  JOURNAL_ENTRIES: 'journal-entries',
  DOCUMENTS: 'documents',
  CHAT_MESSAGES: 'chat-messages',
  USERS: 'users',
} as const;

// ─── REALMS (6 fixed realms) ─────────────────────────────────────────────────
export const REALMS = [
  'Professional',
  'Personal',
  'Financial',
  'Relationship',
  'Wellness',
  'Vision',
] as const;

export const REALM_CONFIG: Record<string, { emoji: string; color: string; description: string }> = {
  Professional: { emoji: '💼', color: '#1E4AFF', description: 'Focus, clarity, execution' },
  Personal:     { emoji: '🎯', color: '#FF6B35', description: 'Identity, creativity, self-expression' },
  Financial:    { emoji: '💰', color: '#FFD700', description: 'Growth, stability, wealth' },
  Relationship: { emoji: '❤️', color: '#FF4F6D', description: 'Connection, empathy, warmth' },
  Wellness:     { emoji: '🧘', color: '#1ABC9C', description: 'Balance, health, vitality' },
  Vision:       { emoji: '✨', color: '#800080', description: 'Purpose, long-term direction, ambition' },
} as const;

// ─── PRIORITY ────────────────────────────────────────────────────────────────
export const PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;
export const PRIORITY_COLORS: Record<string, string> = {
  P1: '#FF4F6D',
  P2: '#FF9933',
  P3: '#1E4AFF',
  P4: '#8A8A8A',
};
export const PRIORITY_LABELS: Record<string, string> = {
  P1: 'Do Now',
  P2: 'Important',
  P3: 'Get Done',
  P4: 'Default',
};

// ─── VISION CATEGORIES ───────────────────────────────────────────────────────
export const VISION_CATEGORIES = [
  'Personal',
  'Professional',
  'Financial',
  'Relationships',
  'Health',
  'Learning',
] as const;

// ─── GOAL TIMELINES ──────────────────────────────────────────────────────────
export const GOAL_TIMELINES = ['1yr', '3yr', '5yr'] as const;

// ─── RHYTHM CATEGORIES ───────────────────────────────────────────────────────
export const RHYTHM_CATEGORIES = [
  'Affirmation',
  'Meditation',
  'Dedication',
  'Discipline',
  'Fitness',
  'Learning',
  'Spiritual',
  'Personal Growth',
  'Health',
  'Work',
  'Productivity',
  'Morning Routine',
  'Evening Routine',
  'Finance',
  'Social',
  'Creativity',
  'Mindfulness',
  'Nutrition',
  'Self-Care',
  'Other',
] as const;

// ─── HABIT PROJECTS ──────────────────────────────────────────────────────────
export const HABIT_PROJECTS = [
  'Morning Routine',
  'Business Discipline',
  'Evening Routine',
  'Health',
  'Learning',
  'Custom',
] as const;

// ─── TRANSACTION CATEGORIES ──────────────────────────────────────────────────
export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Commission',
  'Bonus',
  'Investment',
  'Rental',
  'Business',
  'Other Income',
] as const;

export const EXPENSE_CATEGORIES = [
  'Housing',
  'Food & Dining',
  'Transport',
  'Healthcare',
  'Education',
  'Entertainment',
  'Shopping',
  'Utilities',
  'Insurance',
  'Travel',
  'Fitness',
  'Subscriptions',
  'Loans & Debt',
  'Charity',
  'Family',
  'Personal Care',
  'Other',
] as const;

// ─── PAYMENT METHODS ─────────────────────────────────────────────────────────
export const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'Debit Card',
  'Bank Transfer',
  'Cheque',
  'Apple Pay',
  'Other',
] as const;

// ─── UAE BANKS ───────────────────────────────────────────────────────────────
export const UAE_BANKS = [
  'Emirates NBD',
  'Abu Dhabi Commercial Bank (ADCB)',
  'First Abu Dhabi Bank (FAB)',
  'Dubai Islamic Bank (DIB)',
  'Mashreq Bank',
  'RAKBANK',
  'Commercial Bank of Dubai (CBD)',
  'Sharjah Islamic Bank',
  'National Bank of Fujairah',
  'United Arab Bank',
  'Standard Chartered',
  'HSBC',
  'Citibank',
  'Other',
] as const;

// ─── UAE EMIRATES ────────────────────────────────────────────────────────────
export const UAE_EMIRATES = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
] as const;

// ─── LEAD STATUSES ───────────────────────────────────────────────────────────
export const LEAD_STATUSES = [
  'New',
  'Qualified',
  'Appointment Booked',
  'Submitted',
  'Follow-up',
  'Closed',
] as const;

export const LEAD_STATUS_COLORS: Record<string, string> = {
  New: '#1E4AFF',
  Qualified: '#1ABC9C',
  'Appointment Booked': '#FFD700',
  Submitted: '#FF9933',
  'Follow-up': '#800080',
  Closed: '#8A8A8A',
};

// ─── DEAL STATUSES ───────────────────────────────────────────────────────────
export const DEAL_STATUSES = [
  'Processing',
  'Call Verification',
  'Completed',
  'Card Delivered',
  'Rejected',
  'On Hold',
] as const;

export const DEAL_STATUS_COLORS: Record<string, string> = {
  Processing: '#1E4AFF',
  'Call Verification': '#FFD700',
  Completed: '#1ABC9C',
  'Card Delivered': '#1ABC9C',
  Rejected: '#FF4F6D',
  'On Hold': '#8A8A8A',
};

// ─── LEAD SOURCES ────────────────────────────────────────────────────────────
export const LEAD_SOURCES = [
  'LinkedIn',
  'Cold Calling',
  'Referrals',
  'Follow-up',
  'Walk-in',
] as const;

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
export const PRODUCTS = [
  'Credit Card',
  'Personal Loan',
  'Auto Loan',
  'Account Opening',
] as const;

// ─── CONNECTION TYPES ────────────────────────────────────────────────────────
export const CONNECTION_TYPES = [
  'Spouse',
  'Child',
  'Parent',
  'Sibling',
  'Friend',
  'Colleague',
  'Mentor',
  'Client',
  'Other',
] as const;

// ─── REVIEW TYPES ────────────────────────────────────────────────────────────
export const REVIEW_TYPES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;

// ─── MOODS ───────────────────────────────────────────────────────────────────
export const MOODS = [
  'Happy',
  'Calm',
  'Focused',
  'Grateful',
  'Energetic',
  'Anxious',
  'Tired',
  'Reflective',
] as const;

export const MOOD_EMOJIS: Record<string, string> = {
  Happy: '😊',
  Calm: '😌',
  Focused: '🎯',
  Grateful: '🙏',
  Energetic: '⚡',
  Anxious: '😰',
  Tired: '😴',
  Reflective: '🤔',
};

// ─── DOCUMENT CATEGORIES ─────────────────────────────────────────────────────
export const DOCUMENT_CATEGORIES = [
  'Legal',
  'Financial',
  'Medical',
  'Travel',
  'Educational',
  'Personal',
  'Work',
  'Other',
] as const;

// ─── ONBOARDING REALM OPTIONS ────────────────────────────────────────────────
export const DEFAULT_REALM_OPTIONS = [
  'Health',
  'Career',
  'Finance',
  'Family',
  'Learning',
  'Relationships',
  'Business',
  'Personal Growth',
  'Faith',
  'Travel',
] as const;

// ─── WINNER'S MINDSET AFFIRMATIONS ───────────────────────────────────────────
export const AFFIRMATIONS = [
  "Every action I take today compounds into the life I'm building.",
  "I don't wait for motivation — I build discipline that creates motion.",
  "My consistency today is my competitive advantage tomorrow.",
  "Small steps, taken daily, move mountains.",
  "I am the architect of my own reality. Every choice matters.",
  "Progress over perfection. Done beats perfect every time.",
  "I show up for myself even when no one is watching.",
  "My habits define my future. I choose them with intention.",
  "Focus is a superpower. I protect my attention fiercely.",
  "I am not behind. I am exactly where I need to be to grow.",
  "Discipline is the bridge between goals and accomplishment.",
  "Every no I say to distraction is a yes to my purpose.",
  "I invest in myself daily — mind, body, and spirit.",
  "The version of me I'm becoming is worth every sacrifice.",
  "I pursue excellence not to impress others, but to honor my potential.",
  "Clarity comes from action, not from thinking alone.",
  "I embrace hard work because I know it transforms me.",
  "My morning shapes my day. My days shape my life.",
  "I am resilient. Setbacks are setups for my next breakthrough.",
  "I lead my life with intention and finish what I start.",
  "Wealth, health, and wisdom — I build all three, every day.",
  "I don't chase success — I build systems that attract it.",
  "Energy flows where attention goes. I direct mine wisely.",
  "I am grateful for where I am and hungry for where I'm going.",
  "The best version of me is not a destination — it's a daily practice.",
  "I don't have a time problem. I have a priority problem — and I fix it.",
  "I am relentless in pursuing what matters and ruthless in cutting what doesn't.",
  "Every review, every reflection, every rhythm — they all add up.",
  "I am building a life I am proud of, one decision at a time.",
  "My vision is clear. My plan is ready. My execution is deliberate.",
  "I honor my commitments to myself first.",
  "Success is not about speed — it is about sustainability.",
  "I rise every day with purpose. That is my edge.",
  "The compound effect is real. I trust the process.",
  "I am not ordinary. I am RISE.",
  "Clarity. Action. Discipline. Repeat.",
  "I am playing a long game — and I am winning it slowly.",
] as const;

// ─── LOCAL STORAGE KEYS ──────────────────────────────────────────────────────
export const LS_KEYS = {
  POMODORO_SETTINGS: 'rise_pomodoro_settings',
  DAILY_TIP_PREFIX: 'rise_daily_tip_',
  PWA_INSTALL_DISMISSED: 'rise_pwa_install_dismissed',
  VISIT_COUNT: 'rise_visit_count',
} as const;

// ─── TARGET PRESET COLORS (18) ───────────────────────────────────────────────
export const TARGET_COLORS = [
  '#b8255f', '#db4035', '#ff9933', '#fad000', '#7ecc49',
  '#299438', '#6accbc', '#158fad', '#14aaf5', '#96c3eb',
  '#4073ff', '#884dff', '#af38eb', '#eb96eb', '#e05194',
  '#ff8d85', '#808080', '#b8b8b8',
] as const;

// ─── RHYTHM PRESET COLORS (10) ────────────────────────────────────────────────
export const RHYTHM_COLORS = [
  '#FF9933', '#DC4C3E', '#4073FF', '#2D7C3E', '#7B4B9E',
  '#E8849B', '#4A9B8E', '#F49C18', '#10B981', '#EF4444',
] as const;

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
export const COLORS = {
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1C1C1C',
  border: '#2A2A2A',
  textPrimary: '#F0F0F0',
  textSecondary: '#8A8A8A',
  textPlaceholder: '#505050',
  orange: '#FF6B35',
  orangePressed: '#E55A25',
  green: '#1ABC9C',
  red: '#FF4F6D',
  blue: '#1E4AFF',
  yellow: '#FFD700',
  purple: '#800080',
} as const;

// ─── MODULE ACCENT COLORS ────────────────────────────────────────────────────
export const MODULE_COLORS: Record<string, string> = {
  '/': '#FF6B35',
  '/tasks': '#FF6B35',
  '/goals': '#FF6B35',
  '/finance': '#FF6B35',
  '/wellness': '#1ABC9C',
  '/professional': '#1E4AFF',
  '/relationships': '#FF4F6D',
  '/reviews': '#FFD700',
  '/journal': '#800080',
  '/documents': '#8E95A9',
  '/chat': '#FF9933',
};

// ─── RATE LIMITS ─────────────────────────────────────────────────────────────
export const RATE_LIMIT = {
  REQUESTS_PER_MINUTE: 30,
} as const;
