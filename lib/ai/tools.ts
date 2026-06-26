import { Type, type FunctionDeclaration } from '@google/genai'

// Low-risk tools — auto-execute without approval
export const AUTO_TOOLS: FunctionDeclaration[] = [
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
]

export const ALL_TOOLS: FunctionDeclaration[] = [...AUTO_TOOLS, ...APPROVAL_TOOLS]
export const APPROVAL_TOOL_NAMES = new Set(APPROVAL_TOOLS.map((t) => t.name))
