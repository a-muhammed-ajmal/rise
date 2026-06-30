import { Type, type FunctionDeclaration } from '@google/genai'

// Low-risk tools — auto-execute without approval
export const AUTO_TOOLS: FunctionDeclaration[] = [

  // ─── TASKS ───────────────────────────────────────────────────────────────────
  {
    name: 'create_task',
    description: 'Create a new task for the user',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Task title' },
        priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'urgent'], description: 'Task priority' },
        due_date: { type: Type.STRING, description: 'Due date in YYYY-MM-DD format' },
        status: { type: Type.STRING, enum: ['inbox', 'todo', 'in_progress'], description: 'Task status' },
        description: { type: Type.STRING, description: 'Optional task description' },
        project_id: { type: Type.STRING, description: 'Project UUID to assign this task to' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Tags for the task' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: "Get the user's current tasks",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filter: { type: Type.STRING, enum: ['inbox', 'today', 'all'], description: 'Filter tasks by view' },
      },
      required: [],
    },
  },
  {
    name: 'update_task',
    description: 'Update fields on an existing task. Requires the task id — call list_tasks or search_data first if you only have a name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'UUID of the task to update' },
        title: { type: Type.STRING, description: 'New task title' },
        priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'urgent'] },
        status: { type: Type.STRING, enum: ['inbox', 'todo', 'in_progress', 'done'] },
        due_date: { type: Type.STRING, description: 'Due date in YYYY-MM-DD format, or null to clear' },
        description: { type: Type.STRING, description: 'Task description' },
        project_id: { type: Type.STRING, description: 'Project UUID to assign, or null to unassign' },
        is_starred: { type: Type.BOOLEAN, description: 'Star or unstar the task' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Tag list (replaces existing tags)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed',
    parameters: {
      type: Type.OBJECT,
      properties: {
        task_id: { type: Type.STRING, description: 'The task ID to complete' },
      },
      required: ['task_id'],
    },
  },

  // ─── PROJECTS ─────────────────────────────────────────────────────────────────
  {
    name: 'list_projects',
    description: "Get the user's projects",
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
  },
  {
    name: 'create_project',
    description: 'Create a new project',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Project name' },
        description: { type: Type.STRING, description: 'Project description' },
        color: { type: Type.STRING, description: 'Hex color e.g. #6366f1' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_project',
    description: 'Update an existing project. Requires the project id — call list_projects first if you only have a name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Project UUID' },
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        color: { type: Type.STRING, description: 'Hex color' },
        status: { type: Type.STRING, enum: ['active', 'completed', 'archived'] },
      },
      required: ['id'],
    },
  },

  // ─── GOALS ────────────────────────────────────────────────────────────────────
  {
    name: 'list_goals',
    description: "Get the user's goals",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, enum: ['active', 'completed', 'abandoned', 'all'], description: 'Filter by status, defaults to active' },
      },
      required: [],
    },
  },
  {
    name: 'create_goal',
    description: 'Create a new personal goal',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Goal title' },
        description: { type: Type.STRING, description: 'Goal description and motivation' },
        category: { type: Type.STRING, enum: ['personal', 'professional', 'health', 'financial', 'other'] },
        target_date: { type: Type.STRING, description: 'Target date in YYYY-MM-DD format' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_goal',
    description: 'Update an existing goal. Requires the goal id — call list_goals first if you only have a name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Goal UUID' },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        category: { type: Type.STRING, enum: ['personal', 'professional', 'health', 'financial', 'other'] },
        target_date: { type: Type.STRING, description: 'YYYY-MM-DD' },
        progress: { type: Type.NUMBER, description: 'Progress percentage 0–100' },
        status: { type: Type.STRING, enum: ['active', 'completed', 'abandoned'] },
      },
      required: ['id'],
    },
  },
  {
    name: 'complete_goal',
    description: 'Mark a goal as completed (sets status=completed and progress=100). Requires the goal id.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Goal UUID' },
      },
      required: ['id'],
    },
  },

  // ─── MILESTONES ───────────────────────────────────────────────────────────────
  {
    name: 'create_milestone',
    description: 'Create a milestone for a goal',
    parameters: {
      type: Type.OBJECT,
      properties: {
        goal_id: { type: Type.STRING, description: 'Parent goal UUID' },
        title: { type: Type.STRING, description: 'Milestone title' },
        due_date: { type: Type.STRING, description: 'Due date in YYYY-MM-DD format' },
      },
      required: ['goal_id', 'title'],
    },
  },
  {
    name: 'list_milestones',
    description: 'List milestones for a specific goal',
    parameters: {
      type: Type.OBJECT,
      properties: {
        goal_id: { type: Type.STRING, description: 'Parent goal UUID' },
      },
      required: ['goal_id'],
    },
  },
  {
    name: 'update_milestone',
    description: 'Update a milestone. Requires the milestone id — call list_milestones first if needed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Milestone UUID' },
        title: { type: Type.STRING },
        due_date: { type: Type.STRING, description: 'YYYY-MM-DD' },
      },
      required: ['id'],
    },
  },
  {
    name: 'complete_milestone',
    description: 'Mark a milestone as completed. Requires the milestone id.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Milestone UUID' },
      },
      required: ['id'],
    },
  },

  // ─── HABITS ───────────────────────────────────────────────────────────────────
  {
    name: 'log_habit',
    description: 'Mark a habit as completed for today',
    parameters: {
      type: Type.OBJECT,
      properties: {
        habit_name: { type: Type.STRING, description: 'Name of the habit to log (partial match OK)' },
      },
      required: ['habit_name'],
    },
  },
  {
    name: 'list_habits',
    description: "Get the user's habits with today's completion status",
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
  },
  {
    name: 'create_habit',
    description: 'Create a new habit to track',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Habit name' },
        description: { type: Type.STRING },
        frequency: { type: Type.STRING, enum: ['daily', 'weekly', 'custom'], description: 'How often the habit repeats' },
        target_days: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: 'Days of week 0=Sun…6=Sat (default: all 7)' },
        color: { type: Type.STRING, description: 'Hex color e.g. #6366f1' },
        reminder_time: { type: Type.STRING, description: 'Daily reminder time in HH:MM 24-hour format e.g. 07:30 (optional)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_habit',
    description: 'Update an existing habit. Requires the habit id — call list_habits first if needed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Habit UUID' },
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        frequency: { type: Type.STRING, enum: ['daily', 'weekly', 'custom'] },
        target_days: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        color: { type: Type.STRING },
        reminder_time: { type: Type.STRING, description: 'Daily reminder time in HH:MM 24-hour format, or empty string to clear' },
        active: { type: Type.BOOLEAN, description: 'Set false to archive the habit' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_habit_log',
    description: 'Undo / remove a habit log entry for a specific date',
    parameters: {
      type: Type.OBJECT,
      properties: {
        habit_id: { type: Type.STRING, description: 'Habit UUID' },
        logged_date: { type: Type.STRING, description: 'Date to undo in YYYY-MM-DD format' },
      },
      required: ['habit_id', 'logged_date'],
    },
  },

  // ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
  {
    name: 'log_expense',
    description: 'Record an expense transaction in AED',
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: 'Amount in AED' },
        category: { type: Type.STRING, description: 'Expense category e.g. Food & Drinks, Transport, Shopping' },
        description: { type: Type.STRING, description: 'What the expense was for' },
        date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format, defaults to today' },
      },
      required: ['amount', 'category'],
    },
  },
  {
    name: 'log_income',
    description: 'Record an income transaction in AED',
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: 'Amount in AED' },
        category: { type: Type.STRING, description: 'Income category e.g. Salary, Freelance, Business' },
        description: { type: Type.STRING, description: 'Income source description' },
        date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' },
      },
      required: ['amount', 'category'],
    },
  },
  {
    name: 'list_transactions',
    description: 'List recent transactions (income and/or expenses)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ['income', 'expense', 'all'], description: 'Filter by transaction type' },
        start_date: { type: Type.STRING, description: 'Only return transactions on or after this date (YYYY-MM-DD)' },
        limit: { type: Type.NUMBER, description: 'Max results, default 20' },
      },
      required: [],
    },
  },

  // ─── BUDGETS ──────────────────────────────────────────────────────────────────
  {
    name: 'list_budgets',
    description: "Get the user's budgets",
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
  },
  {
    name: 'create_budget',
    description: 'Create a spending budget for a category',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: 'Budget category e.g. Food, Transport' },
        amount: { type: Type.NUMBER, description: 'Budget limit in AED' },
        period: { type: Type.STRING, enum: ['monthly', 'quarterly', 'yearly'], description: 'Budget period' },
        period_start: { type: Type.STRING, description: 'Period start date YYYY-MM-DD' },
        period_end: { type: Type.STRING, description: 'Period end date YYYY-MM-DD' },
      },
      required: ['category', 'amount', 'period_start', 'period_end'],
    },
  },
  {
    name: 'update_budget',
    description: 'Update a budget. Requires the budget id — call list_budgets first if needed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Budget UUID' },
        category: { type: Type.STRING },
        amount: { type: Type.NUMBER, description: 'New budget limit in AED' },
        period: { type: Type.STRING, enum: ['monthly', 'quarterly', 'yearly'] },
        period_start: { type: Type.STRING, description: 'YYYY-MM-DD' },
        period_end: { type: Type.STRING, description: 'YYYY-MM-DD' },
      },
      required: ['id'],
    },
  },

  // ─── DEBTS ────────────────────────────────────────────────────────────────────
  {
    name: 'list_debts',
    description: "Get the user's debt records",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filter: { type: Type.STRING, enum: ['i_owe', 'they_owe', 'unpaid', 'all'], description: 'Filter by type or paid status' },
      },
      required: [],
    },
  },
  {
    name: 'create_debt',
    description: 'Record a debt — either money you owe or money owed to you',
    parameters: {
      type: Type.OBJECT,
      properties: {
        creditor: { type: Type.STRING, description: 'Name of the person or entity' },
        type: { type: Type.STRING, enum: ['i_owe', 'they_owe'], description: 'Direction of debt' },
        amount: { type: Type.NUMBER, description: 'Amount in AED' },
        description: { type: Type.STRING },
        due_date: { type: Type.STRING, description: 'YYYY-MM-DD' },
      },
      required: ['creditor', 'type', 'amount'],
    },
  },

  // ─── CONTACTS ─────────────────────────────────────────────────────────────────
  {
    name: 'list_contacts',
    description: "Get the user's contacts",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ['lead', 'prospect', 'client', 'network', 'personal', 'all'] },
        limit: { type: Type.NUMBER, description: 'Max results, default 20' },
      },
      required: [],
    },
  },
  {
    name: 'add_contact',
    description: 'Save a new contact',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Contact full name' },
        email: { type: Type.STRING, description: 'Email address' },
        phone: { type: Type.STRING, description: 'Phone number' },
        company: { type: Type.STRING, description: 'Company name' },
        type: { type: Type.STRING, enum: ['lead', 'prospect', 'client', 'network', 'personal'] },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_contact',
    description: 'Update a contact. Requires the contact id — call list_contacts or search_data first if needed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Contact UUID' },
        name: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        company: { type: Type.STRING },
        role: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['lead', 'prospect', 'client', 'network', 'personal'] },
        stage: { type: Type.STRING, enum: ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] },
        deal_value: { type: Type.NUMBER, description: 'Deal value in AED' },
        notes: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['id'],
    },
  },

  // ─── INTERACTIONS ─────────────────────────────────────────────────────────────
  {
    name: 'create_interaction',
    description: 'Log an interaction (call, email, meeting, etc.) with a contact',
    parameters: {
      type: Type.OBJECT,
      properties: {
        contact_id: { type: Type.STRING, description: 'Contact UUID' },
        type: { type: Type.STRING, enum: ['call', 'email', 'meeting', 'message', 'other'] },
        notes: { type: Type.STRING, description: 'Notes about the interaction' },
        date: { type: Type.STRING, description: 'Date of interaction YYYY-MM-DD, defaults to today' },
        follow_up_date: { type: Type.STRING, description: 'Follow-up reminder date YYYY-MM-DD' },
      },
      required: ['contact_id', 'type', 'notes'],
    },
  },
  {
    name: 'list_interactions',
    description: 'List interaction history for a contact',
    parameters: {
      type: Type.OBJECT,
      properties: {
        contact_id: { type: Type.STRING, description: 'Contact UUID' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'update_interaction',
    description: 'Update an interaction record. Requires the interaction id — call list_interactions first if needed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Interaction UUID' },
        type: { type: Type.STRING, enum: ['call', 'email', 'meeting', 'message', 'other'] },
        notes: { type: Type.STRING },
        date: { type: Type.STRING, description: 'YYYY-MM-DD' },
        follow_up_date: { type: Type.STRING, description: 'YYYY-MM-DD or null to clear' },
      },
      required: ['id'],
    },
  },

  // ─── NOTES ────────────────────────────────────────────────────────────────────
  {
    name: 'add_note',
    description: 'Save a note to the knowledge base',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Note title' },
        content: { type: Type.STRING, description: 'Note content' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Tags for the note' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'list_notes',
    description: "List the user's notes",
    parameters: {
      type: Type.OBJECT,
      properties: {
        tag: { type: Type.STRING, description: 'Filter by tag' },
        limit: { type: Type.NUMBER, description: 'Max results, default 20' },
      },
      required: [],
    },
  },
  {
    name: 'update_note',
    description: 'Update an existing note. Requires the note id — call list_notes or search_data first if needed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Note UUID' },
        title: { type: Type.STRING },
        content: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['id'],
    },
  },

  // ─── DOCUMENTS ────────────────────────────────────────────────────────────────
  {
    name: 'list_documents',
    description: "List the user's document metadata entries",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER, description: 'Max results, default 20' },
      },
      required: [],
    },
  },
  {
    name: 'create_document',
    description: 'Save document metadata to the knowledge base (does not upload the file itself)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Document name' },
        file_path: { type: Type.STRING, description: 'File path or URL' },
        file_type: { type: Type.STRING, description: 'MIME type or extension e.g. application/pdf' },
        file_size: { type: Type.NUMBER, description: 'File size in bytes' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        notes: { type: Type.STRING, description: 'Notes about this document' },
      },
      required: ['name', 'file_path'],
    },
  },
  {
    name: 'update_document',
    description: 'Update document metadata. Requires the document id — call list_documents first if needed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Document UUID' },
        name: { type: Type.STRING },
        file_type: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        notes: { type: Type.STRING },
      },
      required: ['id'],
    },
  },

  // ─── LINKS ────────────────────────────────────────────────────────────────────
  {
    name: 'list_links',
    description: "List the user's saved links",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER, description: 'Max results, default 20' },
      },
      required: [],
    },
  },
  {
    name: 'create_link',
    description: 'Save a link to the knowledge base',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'Full URL' },
        title: { type: Type.STRING, description: 'Link title' },
        description: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['url'],
    },
  },
  {
    name: 'update_link',
    description: 'Update a saved link. Requires the link id — call list_links first if needed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Link UUID' },
        url: { type: Type.STRING },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_link',
    description: 'Delete a saved link',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Link UUID' },
      },
      required: ['id'],
    },
  },

  // ─── JOURNAL ENTRIES ──────────────────────────────────────────────────────────
  {
    name: 'list_journal_entries',
    description: 'List recent journal entries',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER, description: 'Max results, default 10' },
      },
      required: [],
    },
  },
  {
    name: 'create_journal_entry',
    description: 'Create or update the journal entry for a given date (one entry per day)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: { type: Type.STRING, description: 'Entry date in YYYY-MM-DD format' },
        content: { type: Type.STRING, description: 'Journal content' },
        mood: { type: Type.NUMBER, description: 'Mood rating 1–5' },
        energy: { type: Type.NUMBER, description: 'Energy rating 1–5' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['date', 'content'],
    },
  },
  {
    name: 'update_journal_entry',
    description: 'Update an existing journal entry. Requires the entry id — call list_journal_entries first if needed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Journal entry UUID' },
        content: { type: Type.STRING },
        mood: { type: Type.NUMBER, description: '1–5' },
        energy: { type: Type.NUMBER, description: '1–5' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['id'],
    },
  },

  // ─── REVIEWS ──────────────────────────────────────────────────────────────────
  {
    name: 'list_reviews',
    description: "List the user's periodic reviews",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'all'] },
        limit: { type: Type.NUMBER, description: 'Max results, default 10' },
      },
      required: [],
    },
  },
  {
    name: 'create_review',
    description: 'Create a periodic review entry',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] },
        period_start: { type: Type.STRING, description: 'Start date YYYY-MM-DD' },
        period_end: { type: Type.STRING, description: 'End date YYYY-MM-DD' },
        content: { type: Type.STRING, description: 'Review content / notes' },
        mood: { type: Type.NUMBER, description: '1–5' },
        energy: { type: Type.NUMBER, description: '1–5' },
      },
      required: ['type', 'period_start', 'period_end'],
    },
  },
  {
    name: 'update_review',
    description: 'Update a review entry. Requires the review id — call list_reviews first if needed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Review UUID' },
        content: { type: Type.STRING },
        mood: { type: Type.NUMBER, description: '1–5' },
        energy: { type: Type.NUMBER, description: '1–5' },
      },
      required: ['id'],
    },
  },

  // ─── FOCUS SESSIONS ───────────────────────────────────────────────────────────
  {
    name: 'list_focus_sessions',
    description: "List the user's focus sessions",
    parameters: {
      type: Type.OBJECT,
      properties: {
        task_id: { type: Type.STRING, description: 'Filter by task UUID' },
        limit: { type: Type.NUMBER, description: 'Max results, default 10' },
      },
      required: [],
    },
  },
  {
    name: 'create_focus_session',
    description: 'Record a focus / deep work session',
    parameters: {
      type: Type.OBJECT,
      properties: {
        duration_minutes: { type: Type.NUMBER, description: 'Session duration in minutes' },
        started_at: { type: Type.STRING, description: 'ISO 8601 datetime, defaults to now' },
        ended_at: { type: Type.STRING, description: 'ISO 8601 datetime when session ended' },
        task_id: { type: Type.STRING, description: 'Associated task UUID' },
        notes: { type: Type.STRING, description: 'Session notes' },
      },
      required: ['duration_minutes'],
    },
  },
  {
    name: 'update_focus_session',
    description: 'Update a focus session. Requires the session id — call list_focus_sessions first if needed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Session UUID' },
        duration_minutes: { type: Type.NUMBER },
        ended_at: { type: Type.STRING, description: 'ISO 8601 datetime' },
        notes: { type: Type.STRING },
        task_id: { type: Type.STRING, description: 'Associated task UUID or null to unlink' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_focus_session',
    description: 'Delete a focus session record',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Session UUID' },
      },
      required: ['id'],
    },
  },

  // ─── ANALYTICS & SEARCH ───────────────────────────────────────────────────────
  {
    name: 'get_daily_briefing',
    description: "Get a summary of today's tasks, habits, goals, and finance status",
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
  },
  {
    name: 'get_analytics',
    description: "Get a summary of the user's productivity, finance, habit, and goal progress for a given period (week or month)",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: { type: Type.STRING, enum: ['week', 'month'], description: 'Time period to summarise — "week" (last 7 days) or "month" (current calendar month). Defaults to "month".' },
      },
      required: [],
    },
  },
  {
    name: 'search_data',
    description: 'Search through tasks, notes, contacts, and goals by keyword',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search query' },
        types: { type: Type.ARRAY, items: { type: Type.STRING, enum: ['tasks', 'notes', 'contacts', 'goals'] }, description: 'Which data types to search' },
      },
      required: ['query'],
    },
  },
]

// Approval-required tools — AI proposes, user must confirm
export const APPROVAL_TOOLS: FunctionDeclaration[] = [

  // ─── TASKS ───────────────────────────────────────────────────────────────────
  {
    name: 'delete_task',
    description: 'Delete a task permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        task_id: { type: Type.STRING, description: 'Task ID to delete' },
        task_title: { type: Type.STRING, description: 'Task title for confirmation display' },
      },
      required: ['task_id', 'task_title'],
    },
  },
  {
    name: 'bulk_complete_tasks',
    description: 'Mark multiple tasks as complete at once (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        task_ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array of task IDs' },
        summary: { type: Type.STRING, description: 'Human-readable summary of what will be completed' },
      },
      required: ['task_ids', 'summary'],
    },
  },

  // ─── PROJECTS ─────────────────────────────────────────────────────────────────
  {
    name: 'delete_project',
    description: 'Delete a project permanently (REQUIRES USER APPROVAL). Tasks in the project will have their project unlinked.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        project_id: { type: Type.STRING, description: 'Project UUID' },
        project_name: { type: Type.STRING, description: 'Project name for confirmation display' },
      },
      required: ['project_id', 'project_name'],
    },
  },

  // ─── GOALS ────────────────────────────────────────────────────────────────────
  {
    name: 'delete_goal',
    description: 'Delete a goal and its milestones permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        goal_id: { type: Type.STRING, description: 'Goal UUID' },
        goal_title: { type: Type.STRING, description: 'Goal title for confirmation display' },
      },
      required: ['goal_id', 'goal_title'],
    },
  },

  // ─── MILESTONES ───────────────────────────────────────────────────────────────
  {
    name: 'delete_milestone',
    description: 'Delete a milestone permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        milestone_id: { type: Type.STRING, description: 'Milestone UUID' },
        milestone_title: { type: Type.STRING, description: 'Milestone title for confirmation display' },
      },
      required: ['milestone_id', 'milestone_title'],
    },
  },

  // ─── HABITS ───────────────────────────────────────────────────────────────────
  {
    name: 'delete_habit',
    description: 'Delete a habit and all its logs permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        habit_id: { type: Type.STRING, description: 'Habit UUID' },
        habit_name: { type: Type.STRING, description: 'Habit name for confirmation display' },
      },
      required: ['habit_id', 'habit_name'],
    },
  },

  // ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
  {
    name: 'update_transaction',
    description: 'Update a transaction record — amount changes are high-risk (REQUIRES USER APPROVAL). Call list_transactions first to resolve the id.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        transaction_id: { type: Type.STRING, description: 'Transaction UUID' },
        summary: { type: Type.STRING, description: 'Human-readable description of the change for confirmation display' },
        amount: { type: Type.NUMBER, description: 'New amount in AED' },
        category: { type: Type.STRING },
        description: { type: Type.STRING },
        date: { type: Type.STRING, description: 'YYYY-MM-DD' },
      },
      required: ['transaction_id', 'summary'],
    },
  },
  {
    name: 'delete_transaction',
    description: 'Delete a transaction permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        transaction_id: { type: Type.STRING, description: 'Transaction UUID' },
        transaction_summary: { type: Type.STRING, description: 'Transaction description for confirmation display' },
      },
      required: ['transaction_id', 'transaction_summary'],
    },
  },

  // ─── BUDGETS ──────────────────────────────────────────────────────────────────
  {
    name: 'delete_budget',
    description: 'Delete a budget permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        budget_id: { type: Type.STRING, description: 'Budget UUID' },
        budget_summary: { type: Type.STRING, description: 'Budget description for confirmation e.g. "Food AED 2000/month"' },
      },
      required: ['budget_id', 'budget_summary'],
    },
  },

  // ─── DEBTS ────────────────────────────────────────────────────────────────────
  {
    name: 'update_debt',
    description: 'Update a debt record — amount changes require approval (REQUIRES USER APPROVAL). Includes marking a debt as paid. Call list_debts first to resolve the id.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        debt_id: { type: Type.STRING, description: 'Debt UUID' },
        summary: { type: Type.STRING, description: 'Human-readable description of the change for confirmation display' },
        creditor: { type: Type.STRING },
        amount: { type: Type.NUMBER, description: 'New amount in AED' },
        description: { type: Type.STRING },
        due_date: { type: Type.STRING, description: 'YYYY-MM-DD' },
        mark_paid: { type: Type.BOOLEAN, description: 'Set to true to mark the debt as paid now' },
      },
      required: ['debt_id', 'summary'],
    },
  },
  {
    name: 'delete_debt',
    description: 'Delete a debt record permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        debt_id: { type: Type.STRING, description: 'Debt UUID' },
        debt_summary: { type: Type.STRING, description: 'Debt description for confirmation' },
      },
      required: ['debt_id', 'debt_summary'],
    },
  },

  // ─── CONTACTS ─────────────────────────────────────────────────────────────────
  {
    name: 'delete_contact',
    description: 'Delete a contact and all their interactions permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        contact_id: { type: Type.STRING, description: 'Contact UUID' },
        contact_name: { type: Type.STRING, description: 'Contact name for confirmation display' },
      },
      required: ['contact_id', 'contact_name'],
    },
  },

  // ─── INTERACTIONS ─────────────────────────────────────────────────────────────
  {
    name: 'delete_interaction',
    description: 'Delete an interaction record permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        interaction_id: { type: Type.STRING, description: 'Interaction UUID' },
        interaction_summary: { type: Type.STRING, description: 'Brief description for confirmation display' },
      },
      required: ['interaction_id', 'interaction_summary'],
    },
  },

  // ─── NOTES ────────────────────────────────────────────────────────────────────
  {
    name: 'delete_note',
    description: 'Delete a note permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        note_id: { type: Type.STRING, description: 'Note ID to delete' },
        note_title: { type: Type.STRING, description: 'Note title for confirmation display' },
      },
      required: ['note_id', 'note_title'],
    },
  },

  // ─── DOCUMENTS ────────────────────────────────────────────────────────────────
  {
    name: 'delete_document',
    description: 'Delete a document metadata record permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        document_id: { type: Type.STRING, description: 'Document UUID' },
        document_name: { type: Type.STRING, description: 'Document name for confirmation display' },
      },
      required: ['document_id', 'document_name'],
    },
  },

  // ─── JOURNAL ENTRIES ──────────────────────────────────────────────────────────
  {
    name: 'delete_journal_entry',
    description: 'Delete a journal entry permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        entry_id: { type: Type.STRING, description: 'Journal entry UUID' },
        entry_date: { type: Type.STRING, description: 'Entry date YYYY-MM-DD for confirmation display' },
      },
      required: ['entry_id', 'entry_date'],
    },
  },

  // ─── REVIEWS ──────────────────────────────────────────────────────────────────
  {
    name: 'delete_review',
    description: 'Delete a review entry permanently (REQUIRES USER APPROVAL)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        review_id: { type: Type.STRING, description: 'Review UUID' },
        review_summary: { type: Type.STRING, description: 'Brief description for confirmation display e.g. "Weekly review 2026-06-23"' },
      },
      required: ['review_id', 'review_summary'],
    },
  },
]

export const ALL_TOOLS: FunctionDeclaration[] = [...AUTO_TOOLS, ...APPROVAL_TOOLS]
export const APPROVAL_TOOL_NAMES = new Set(APPROVAL_TOOLS.map((t) => t.name))
