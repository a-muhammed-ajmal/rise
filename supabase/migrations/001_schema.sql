-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PRODUCTIVITY ────────────────────────────────────────────────────────────

CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  color       text DEFAULT '#6366f1',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox','todo','in_progress','done')),
  priority        text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  due_date        date,
  completed_at    timestamptz,
  is_recurring    boolean NOT NULL DEFAULT false,
  recurrence_rule text,
  project_id      uuid REFERENCES projects ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── GOALS & REFLECTION ──────────────────────────────────────────────────────

CREATE TABLE goals (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'personal' CHECK (category IN ('personal','professional','health','financial','other')),
  target_date date,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  progress    int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE milestones (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  goal_id      uuid NOT NULL REFERENCES goals ON DELETE CASCADE,
  title        text NOT NULL,
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reviews (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('daily','weekly','monthly','quarterly','yearly')),
  period_start date NOT NULL,
  period_end   date NOT NULL,
  content      jsonb NOT NULL DEFAULT '{}',
  mood         int CHECK (mood BETWEEN 1 AND 5),
  energy       int CHECK (energy BETWEEN 1 AND 5),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE journal_entries (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date       date NOT NULL,
  content    text NOT NULL DEFAULT '',
  mood       int CHECK (mood BETWEEN 1 AND 5),
  energy     int CHECK (energy BETWEEN 1 AND 5),
  tags       text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- ─── FINANCE ─────────────────────────────────────────────────────────────────

CREATE TABLE transactions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('income','expense')),
  amount         numeric(12,2) NOT NULL CHECK (amount > 0),
  category       text NOT NULL,
  description    text,
  date           date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  tags           text[] NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE budgets (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category     text NOT NULL,
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  period       text NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','quarterly','yearly')),
  period_start date NOT NULL,
  period_end   date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE debts (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  creditor    text NOT NULL,
  type        text NOT NULL CHECK (type IN ('i_owe','they_owe')),
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  description text,
  due_date    date,
  paid_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── WELLNESS ────────────────────────────────────────────────────────────────

CREATE TABLE habits (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  frequency   text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly','custom')),
  target_days int[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  color       text DEFAULT '#6366f1',
  icon        text DEFAULT '⭐',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE habit_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  habit_id    uuid NOT NULL REFERENCES habits ON DELETE CASCADE,
  logged_date date NOT NULL DEFAULT CURRENT_DATE,
  completed   boolean NOT NULL DEFAULT true,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, logged_date)
);

CREATE TABLE focus_sessions (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  task_id          uuid REFERENCES tasks ON DELETE SET NULL,
  duration_minutes int NOT NULL CHECK (duration_minutes > 0),
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── CRM + KNOWLEDGE ─────────────────────────────────────────────────────────

CREATE TABLE contacts (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name             text NOT NULL,
  email            text,
  phone            text,
  company          text,
  role             text,
  type             text NOT NULL DEFAULT 'network' CHECK (type IN ('lead','prospect','client','network','personal')),
  stage            text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','qualified','proposal','negotiation','won','lost')),
  deal_value       numeric(12,2),
  notes            text,
  tags             text[] NOT NULL DEFAULT '{}',
  last_contacted_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interactions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  contact_id     uuid NOT NULL REFERENCES contacts ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('call','email','meeting','message','other')),
  notes          text NOT NULL DEFAULT '',
  date           date NOT NULL DEFAULT CURRENT_DATE,
  follow_up_date date,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title          text NOT NULL,
  content        text NOT NULL DEFAULT '',
  tags           text[] NOT NULL DEFAULT '{}',
  linked_to_type text CHECK (linked_to_type IN ('task','goal','contact')),
  linked_to_id   uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name       text NOT NULL,
  file_path  text NOT NULL,
  file_type  text,
  file_size  bigint,
  tags       text[] NOT NULL DEFAULT '{}',
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE links (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  url         text NOT NULL,
  title       text,
  description text,
  tags        text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── AI ──────────────────────────────────────────────────────────────────────

CREATE TABLE ai_conversations (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  messages   jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_memory (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content    text NOT NULL,
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_tasks_user_status ON tasks (user_id, status);
CREATE INDEX idx_tasks_user_due ON tasks (user_id, due_date);
CREATE INDEX idx_tasks_project ON tasks (project_id);
CREATE INDEX idx_habits_user ON habits (user_id, active);
CREATE INDEX idx_habit_logs_user_date ON habit_logs (user_id, logged_date);
CREATE INDEX idx_transactions_user_date ON transactions (user_id, date);
CREATE INDEX idx_contacts_user_type ON contacts (user_id, type);
CREATE INDEX idx_journal_user_date ON journal_entries (user_id, date);
CREATE INDEX idx_notes_user ON notes (user_id, created_at DESC);
CREATE INDEX idx_ai_memory_user ON ai_memory (user_id, created_at DESC);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER journal_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER ai_conversations_updated_at BEFORE UPDATE ON ai_conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
