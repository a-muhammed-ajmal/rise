-- Enable pgvector extension for AI semantic memory
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to ai_memory
ALTER TABLE ai_memory ADD COLUMN embedding vector(1536);

-- IVFFlat index for fast approximate nearest-neighbor search
-- Lists: sqrt(row count) is a good starting point; 100 is fine for <1M rows
CREATE INDEX idx_ai_memory_embedding ON ai_memory
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function: match_memories
-- Returns top-k memory rows closest to a query embedding
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1536),
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
