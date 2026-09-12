-- Keep semantic retrieval from duplicating always-loaded user facts.
-- Returning memory_type lets the application exclude user_fact rows while
-- preserving the existing similarity query and row-level user boundary.

DROP FUNCTION IF EXISTS public.match_memories(vector, uuid, int, float);

CREATE FUNCTION public.match_memories(
  query_embedding vector(1024),
  match_user_id uuid,
  match_count int DEFAULT 10,
  match_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float,
  memory_type text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    memory.id,
    memory.content,
    memory.metadata,
    1 - (memory.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity,
    memory.memory_type
  FROM public.ai_memory AS memory
  WHERE memory.user_id = match_user_id
    AND 1 - (memory.embedding OPERATOR(extensions.<=>) query_embedding) > match_threshold
  ORDER BY memory.embedding OPERATOR(extensions.<=>) query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_memories(vector, uuid, int, float) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_memories(vector, uuid, int, float) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_memories(vector, uuid, int, float) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_memories(vector, uuid, int, float) TO service_role;
