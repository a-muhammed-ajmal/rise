import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";
type MemoryMetadata = {
  role: "user" | "assistant";
  turn_index?: number;
  summary?: boolean;
  [key: string]: Json | undefined;
};

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: [text],
      input_type: "document",
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    data: { embedding: number[] }[];
  };
  return data.data[0]?.embedding ?? null;
}

export async function storeMemory(
  userId: string,
  content: string,
  metadata: MemoryMetadata,
  memoryType: "conversation" | "user_fact" | "insight" | "summary" = "conversation",
): Promise<void> {
  const supabase = await createClient();
  const embedding = await embedText(content);

  await supabase.from("ai_memory").insert({
    user_id: userId,
    content,
    metadata: metadata as unknown as Json,
    memory_type: memoryType,
    embedding: embedding ?? null,
  });
}

// Always-loaded personal facts — retrieved by type, not by similarity
export async function retrieveUserFacts(
  userId: string,
): Promise<{ content: string; metadata: Json }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_memory")
    .select("content, metadata")
    .eq("user_id", userId)
    .eq("memory_type", "user_fact")
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function retrieveMemories(
  userId: string,
  queryText: string,
  count: number = 8,
): Promise<{ content: string; metadata: Json; similarity: number }[]> {
  const supabase = await createClient();
  const queryEmbedding = await embedText(queryText);

  if (queryEmbedding) {
    const { data } = await supabase.rpc("match_memories", {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_count: count,
      match_threshold: 0.7,
    });
    if (data?.length) {
      // Filter out user_fact type — those are loaded separately via retrieveUserFacts
      const filtered = (data as { content: string; metadata: Json; similarity: number; memory_type?: string }[])
        .filter((m) => m.memory_type !== "user_fact");
      if (filtered.length) return filtered;
    }
  }

  // Keyword fallback when embeddings are unavailable or returned no results
  const { data: keywordResults } = await supabase
    .from("ai_memory")
    .select("content, metadata")
    .eq("user_id", userId)
    .neq("memory_type", "user_fact")
    .ilike("content", `%${queryText.slice(0, 100)}%`)
    .order("created_at", { ascending: false })
    .limit(count);

  return (keywordResults ?? []).map((r) => ({
    content: r.content,
    metadata: r.metadata,
    similarity: 0,
  }));
}

export async function compactMessages(
  userId: string,
  messages: { role: string; content: string }[],
  threshold: number = 20,
): Promise<void> {
  if (messages.length < threshold) return;

  const oldMessages = messages.slice(0, threshold - 10);
  const summaryText = oldMessages
    .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
    .join("\n");

  await storeMemory(
    userId,
    `Conversation summary:\n${summaryText}`,
    { role: "assistant", summary: true, turn_count: oldMessages.length },
    "summary",
  );
}

export function formatMemoriesForPrompt(
  memories: { content: string; similarity: number }[],
): string {
  if (!memories.length) return "";

  const lines = memories.map((m) => `- ${m.content.slice(0, 300)}`);
  return `\nRelevant memories from past conversations:\n${lines.join("\n")}`;
}

export function formatUserFactsForPrompt(
  facts: { content: string }[],
): string {
  if (!facts.length) return "";

  const lines = facts.map((f) => `- ${f.content.slice(0, 200)}`);
  return `\nThings you know about this user:\n${lines.join("\n")}`;
}
