-- User identity & personal knowledge base for AI context
CREATE TABLE user_profile (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE UNIQUE,
  display_name text,
  occupation   text,
  location     text,
  bio          text,
  facts        jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile" ON user_profile
  FOR ALL USING (user_id = auth.uid());

CREATE TRIGGER user_profile_updated_at
  BEFORE UPDATE ON user_profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add memory_type so memories are categorised: conversation, user_fact, insight, summary
ALTER TABLE ai_memory
  ADD COLUMN IF NOT EXISTS memory_type text NOT NULL DEFAULT 'conversation'
  CHECK (memory_type IN ('conversation', 'user_fact', 'insight', 'summary'));

-- Faster lookup of user_fact memories (always loaded regardless of semantic search)
CREATE INDEX idx_ai_memory_user_type ON ai_memory (user_id, memory_type, created_at DESC);
