import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database";
import { z } from "zod";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";
type MemoryMetadata = {
  role: "user" | "assistant";
  turn_index?: number;
  summary?: boolean;
  [key: string]: Json | undefined;
};

const VoyageResponseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })),
});

function metadataToJson(metadata: MemoryMetadata): Json {
  const result: { [key: string]: Json } = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

// Voyage scores a search query against stored documents asymmetrically, so the
// two sides must be embedded with different input_type values. Embedding a
// query as a "document" measurably degrades retrieval.
export async function embedText(
  text: string,
  inputType: "document" | "query" = "document",
): Promise<number[] | null> {
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
      input_type: inputType,
    }),
  });

  if (!res.ok) return null;

  const data = VoyageResponseSchema.safeParse(await res.json());
  return data.success ? (data.data.data[0]?.embedding ?? null) : null;
}

export async function storeMemory(
  userId: string,
  content: string,
  metadata: MemoryMetadata,
  memoryType:
    "conversation" | "user_fact" | "insight" | "summary" = "conversation",
  client?: SupabaseClient<Database>,
): Promise<void> {
  const supabase = client ?? (await createClient());
  const embedding = await embedText(content);

  const { error } = await supabase.from("ai_memory").insert({
    user_id: userId,
    content,
    metadata: metadataToJson(metadata),
    memory_type: memoryType,
    embedding: embedding ?? null,
  });
  if (error) throw new Error(`Could not store memory: ${error.message}`);
}

// Always-loaded personal facts — retrieved by type, not by similarity
export async function retrieveUserFacts(
  userId: string,
  client?: SupabaseClient<Database>,
): Promise<{ content: string; metadata: Json }[]> {
  const supabase = client ?? (await createClient());
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
  client?: SupabaseClient<Database>,
): Promise<{ content: string; metadata: Json; similarity: number }[]> {
  const supabase = client ?? (await createClient());
  const queryEmbedding = await embedText(queryText, "query");

  if (queryEmbedding) {
    const { data, error } = await supabase.rpc("match_memories", {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_count: count,
      match_threshold: 0.7,
    });
    if (!error && data?.length) {
      // Filter out user_fact type — those are loaded separately via retrieveUserFacts
      const filtered = data.filter((memory) => memory.memory_type !== "user_fact");
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

// Older turns are saved to long-term memory in fixed blocks so the assistant can
// still recall them once they fall out of the history window the client sends.
export const COMPACT_BLOCK_SIZE = 10;
// The most recent messages are always in the request itself; never save those.
export const COMPACT_KEEP_RECENT = 10;

/**
 * Saves at most one block of older conversation turns per request, and never
 * the same block twice.
 *
 * Blocks are numbered by absolute position in the conversation, not position in
 * the window, because the client sends a sliding window (the last 40
 * messages). `historyOffset` is how many earlier messages the client left out.
 * Without it every request saw a different "first 10 messages" and stored
 * another overlapping copy, which then crowded real memories out of retrieval.
 *
 * Only the oldest complete block still in the window is considered: it is the
 * next to fall out, and the window moves by about two messages per turn, so
 * every block gets its turn before it leaves.
 */
export async function compactMessages(
  userId: string,
  messages: { role: string; content: string }[],
  historyOffset: number = 0,
  client?: SupabaseClient<Database>,
): Promise<void> {
  const offset = Math.max(0, Math.floor(historyOffset));
  const firstBlock = Math.ceil(offset / COMPACT_BLOCK_SIZE);
  const start = firstBlock * COMPACT_BLOCK_SIZE - offset;
  const end = start + COMPACT_BLOCK_SIZE;
  if (end > messages.length - COMPACT_KEEP_RECENT) return;

  const block = messages.slice(start, end);
  const content = `Earlier conversation:\n${block
    .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
    .join("\n")}`;

  const supabase = client ?? (await createClient());
  const { data: existing, error } = await supabase
    .from("ai_memory")
    .select("id")
    .eq("user_id", userId)
    .eq("memory_type", "summary")
    .eq("content", content)
    .limit(1);
  if (error) throw new Error(`Could not check stored memory: ${error.message}`);
  if (existing?.length) return;

  await storeMemory(
    userId,
    content,
    {
      role: "assistant",
      summary: true,
      turn_count: block.length,
      block_index: firstBlock,
    },
    "summary",
    supabase,
  );
}

export function formatMemoriesForPrompt(
  memories: { content: string; similarity: number }[],
): string {
  if (!memories.length) return "";

  const lines = memories.map((m) => `- ${m.content.slice(0, 300)}`);
  return `\nRelevant memories from past conversations:\n${lines.join("\n")}`;
}

export function formatUserFactsForPrompt(facts: { content: string }[]): string {
  if (!facts.length) return "";

  const lines = facts.map((f) => `- ${f.content.slice(0, 200)}`);
  return `\nThings you know about this user:\n${lines.join("\n")}`;
}
