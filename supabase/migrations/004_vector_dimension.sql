-- Update vector dimension from 1536 to 1024 for Voyage AI (voyage-3) embeddings
-- Drop dependent objects first
DROP INDEX IF EXISTS idx_ai_memory_embedding;
DROP FUNCTION IF EXISTS match_memories;

-- Alter the column dimension
ALTER TABLE ai_memory DROP COLUMN IF EXISTS embedding;
ALTER TABLE ai_memory ADD COLUMN embedding vector(1024);

-- Recreate IVFFlat index
CREATE INDEX idx_ai_memory_embedding ON ai_memory
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Recreate match_memories for 1024-dimensional vectors
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1024),
  match_user_id   uuid,
  match_count     int DEFAULT 10,
  match_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  id         uuid,
  content    text,
  metadata   jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    m.id,
    m.content,
    m.metadata,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM ai_memory m
  WHERE m.user_id = match_user_id
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;
