// Personal memory: remembered user facts and semantic recall.
//
// Every query filters by user_id itself: the MCP path runs these handlers
// with a service-role client that bypasses RLS.
import { z } from "zod";
import { storeMemory, retrieveMemories, retrieveUserFacts } from "@/lib/ai/memory";
import type { Json } from "@/lib/types/database";
import { dbErr, badInput, type ToolHandlers } from "./shared";

const ForgetUserFactInput = z.object({
  key: z.string().min(1).max(100),
  fact_summary: z.string().optional(),
});

export const personalMemoryHandlers = {
  remember_user_fact: async ({ input, supabase, userId }) => {
    const p = z
      .object({
        key: z.string().min(1).max(100),
        value: z.string().min(1).max(1000),
      })
      .safeParse(input);
    if (!p.success) return badInput();

    // Merge fact into user_profile.facts (upsert-safe)
    const { data: existing, error: existingError } = await supabase
      .from("user_profile")
      .select("facts")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingError) return dbErr("remember_user_fact", existingError);
    const parsedFacts = z.record(z.string(), z.string()).safeParse(existing?.facts);
    const currentFacts = parsedFacts.success ? parsedFacts.data : {};
    const updatedFacts = { ...currentFacts, [p.data.key]: p.data.value };

    const { error } = await supabase
      .from("user_profile")
      .upsert(
        { user_id: userId, facts: updatedFacts },
        { onConflict: "user_id" },
      );
    if (error) return dbErr("remember_user_fact", error);

    // Also store in ai_memory for semantic retrieval
    storeMemory(
      userId,
      `User fact — ${p.data.key}: ${p.data.value}`,
      { role: "user" },
      "user_fact",
      supabase,
    ).catch(() => {});

    return {
      success: true,
      message: `Remembered: ${p.data.key} = ${p.data.value}`,
    };
  },

  recall_memories: async ({ input, supabase, userId }) => {
    const p = z
      .object({
        query: z.string().min(1).max(500),
        limit: z.number().int().positive().max(20).optional(),
      })
      .safeParse(input);
    if (!p.success) return badInput();

    const [semantic, facts] = await Promise.all([
      retrieveMemories(userId, p.data.query, p.data.limit ?? 10, supabase),
      retrieveUserFacts(userId, supabase),
    ]);

    const results = [
      ...facts.map((f) => ({
        content: f.content,
        type: "user_fact",
        similarity: 1,
      })),
      ...semantic.map((m) => ({
        content: m.content,
        type: "conversation",
        similarity: m.similarity,
      })),
    ];

    if (!results.length)
      return {
        success: true,
        message: "No relevant memories found.",
        data: [],
      };
    return {
      success: true,
      message: `Found ${results.length} relevant memories`,
      data: results,
    };
  },

  forget_user_fact: async ({ input, supabase, userId }) => {
    const p = ForgetUserFactInput.safeParse(input);
    if (!p.success) return badInput();

    // Facts live in two places — the JSONB map that builds profile context,
    // and the vector store behind recall_memories. Both have to forget.
    const { data: profile, error: profileError } = await supabase
      .from("user_profile")
      .select("facts")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) return dbErr("forget_user_fact", profileError);

    const facts = profile?.facts;
    if (!facts || typeof facts !== "object" || Array.isArray(facts))
      return { success: false, message: "No stored facts to forget." };

    const remaining: Record<string, Json> = {};
    let found = false;
    let forgottenValue: string | null = null;
    for (const [key, value] of Object.entries(facts)) {
      if (key === p.data.key) {
        found = true;
        if (typeof value === "string") forgottenValue = value;
        continue;
      }
      remaining[key] = value;
    }
    if (!found)
      return {
        success: false,
        message: `No stored fact called "${p.data.key}".`,
      };

    const { error } = await supabase
      .from("user_profile")
      .update({ facts: remaining })
      .eq("user_id", userId);
    if (error) return dbErr("forget_user_fact", error);

    if (forgottenValue !== null) {
      const { error: memoryDeleteError } = await supabase
        .from("ai_memory")
        .delete()
        .eq("user_id", userId)
        .eq("memory_type", "user_fact")
        .eq("content", `User fact — ${p.data.key}: ${forgottenValue}`);
      if (memoryDeleteError)
        return dbErr("forget_user_fact", memoryDeleteError);
    }

    return {
      success: true,
      message: `Forgot "${p.data.key}". This cannot be undone.`,
    };
  },
} satisfies ToolHandlers;
