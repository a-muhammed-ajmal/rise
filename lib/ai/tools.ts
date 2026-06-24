import type { Tool } from '@anthropic-ai/sdk/resources/messages'

// Low-risk tools — auto-execute without approval
export const AUTO_TOOLS: Tool[] = [
  {
    name: 'create_task',
    description: 'Create a new task for the user',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Task title' },
        priority: { type: 'string', enum: ['low','medium','high','urgent'], description: 'Task priority' },
        due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
        status: { type: 'string', enum: ['inbox','todo','in_progress'], description: 'Task status' },
        description: { type: 'string', description: 'Optional task description' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Get the user\'s current tasks',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: { type: 'string', enum: ['inbox','today','all'], description: 'Filter tasks by view' },
      },
      required: [],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: 'The task ID to complete' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'log_expense',
    description: 'Record an expense transaction in AED',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: { type: 'number', description: 'Amount in AED' },
        category: { type: 'string', description: 'Expense category e.g. Food & Drinks, Transport, Shopping' },
        description: { type: 'string', description: 'What the expense was for' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format, defaults to today' },
      },
      required: ['amount', 'category'],
    },
  },
  {
    name: 'log_income',
    description: 'Record an income transaction in AED',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: { type: 'number', description: 'Amount in AED' },
        category: { type: 'string', description: 'Income category e.g. Salary, Freelance, Business' },
        description: { type: 'string', description: 'Income source description' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
      },
      required: ['amount', 'category'],
    },
  },
  {
    name: 'log_habit',
    description: 'Mark a habit as completed for today',
    input_schema: {
      type: 'object' as const,
      properties: {
        habit_name: { type: 'string', description: 'Name of the habit to log (partial match OK)' },
      },
      required: ['habit_name'],
    },
  },
  {
    name: 'create_goal',
    description: 'Create a new personal goal',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Goal title' },
        description: { type: 'string', description: 'Goal description and motivation' },
        category: { type: 'string', enum: ['personal','professional','health','financial','other'] },
        target_date: { type: 'string', description: 'Target date in YYYY-MM-DD format' },
      },
      required: ['title'],
    },
  },
  {
    name: 'add_note',
    description: 'Save a note to the knowledge base',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note content' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for the note' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'add_contact',
    description: 'Save a new contact',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Contact full name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
        company: { type: 'string', description: 'Company name' },
        type: { type: 'string', enum: ['lead','prospect','client','network','personal'] },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_daily_briefing',
    description: 'Get a summary of today\'s tasks, habits, goals, and finance status',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'search_data',
    description: 'Search through tasks, notes, contacts, and goals by keyword',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        types: { type: 'array', items: { type: 'string', enum: ['tasks','notes','contacts','goals'] }, description: 'Which data types to search' },
      },
      required: ['query'],
    },
  },
]

// Approval-required tools — AI proposes, user must confirm
export const APPROVAL_TOOLS: Tool[] = [
  {
    name: 'delete_task',
    description: 'Delete a task permanently (REQUIRES USER APPROVAL)',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: 'Task ID to delete' },
        task_title: { type: 'string', description: 'Task title for confirmation display' },
      },
      required: ['task_id', 'task_title'],
    },
  },
  {
    name: 'bulk_complete_tasks',
    description: 'Mark multiple tasks as complete at once (REQUIRES USER APPROVAL)',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_ids: { type: 'array', items: { type: 'string' }, description: 'Array of task IDs' },
        summary: { type: 'string', description: 'Human-readable summary of what will be completed' },
      },
      required: ['task_ids', 'summary'],
    },
  },
  {
    name: 'delete_note',
    description: 'Delete a note permanently (REQUIRES USER APPROVAL)',
    input_schema: {
      type: 'object' as const,
      properties: {
        note_id: { type: 'string', description: 'Note ID to delete' },
        note_title: { type: 'string', description: 'Note title for confirmation display' },
      },
      required: ['note_id', 'note_title'],
    },
  },
]

export const ALL_TOOLS: Tool[] = [...AUTO_TOOLS, ...APPROVAL_TOOLS]
export const APPROVAL_TOOL_NAMES = new Set(APPROVAL_TOOLS.map((t) => t.name))
