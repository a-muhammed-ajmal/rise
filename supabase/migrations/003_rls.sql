-- Row Level Security: every table is locked to auth.uid()

ALTER TABLE projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE links            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memory        ENABLE ROW LEVEL SECURITY;

-- Helper macro: policy for each table (SELECT + INSERT + UPDATE + DELETE)
-- All policies: user_id = auth.uid()

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'projects','tasks','goals','milestones','reviews','journal_entries',
    'transactions','budgets','debts','habits','habit_logs','focus_sessions',
    'contacts','interactions','notes','documents','links',
    'ai_conversations','ai_memory'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('
      CREATE POLICY "%s_select" ON %I FOR SELECT USING (user_id = auth.uid());
      CREATE POLICY "%s_insert" ON %I FOR INSERT WITH CHECK (user_id = auth.uid());
      CREATE POLICY "%s_update" ON %I FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
      CREATE POLICY "%s_delete" ON %I FOR DELETE USING (user_id = auth.uid());
    ', tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;
