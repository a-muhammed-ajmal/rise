// Reflection: journal entries and reviews.
//
// Every query filters by user_id itself: the MCP path runs these handlers
// with a service-role client that bypasses RLS.
import { z } from "zod";
import { dbErr, badInput, softDeleteRecord, type ToolHandlers } from "./shared";
import { dateStr, uuid } from "./schemas";

const rating1to5 = z.number().int().min(1).max(5);

// Journal entries
const CreateJournalEntryInput = z.object({
  date: dateStr,
  content: z.string().min(1).max(50_000),
  mood: rating1to5.optional().nullable(),
  energy: rating1to5.optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const UpdateJournalEntryInput = z.object({
  id: uuid,
  content: z.string().min(1).max(50_000).optional(),
  mood: rating1to5.optional().nullable(),
  energy: rating1to5.optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const DeleteJournalEntryInput = z.object({
  entry_id: uuid,
  entry_date: dateStr,
});

// Reviews
const CreateReviewInput = z.object({
  type: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  period_start: dateStr,
  period_end: dateStr,
  content: z.string().max(50_000).optional().nullable(),
  mood: rating1to5.optional().nullable(),
  energy: rating1to5.optional().nullable(),
});

const UpdateReviewInput = z.object({
  id: uuid,
  content: z.string().max(50_000).optional().nullable(),
  mood: rating1to5.optional().nullable(),
  energy: rating1to5.optional().nullable(),
  type: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).optional(),
  period_start: dateStr.optional(),
  period_end: dateStr.optional(),
});

const ListReviewsInput = z.object({
  type: z
    .enum(["daily", "weekly", "monthly", "quarterly", "yearly", "all"])
    .optional(),
  limit: z.number().int().positive().max(50).optional(),
});

const DeleteReviewInput = z.object({
  review_id: uuid,
  review_summary: z.string().optional(),
});

export const reflectionHandlers = {
  list_journal_entries: async ({ input, supabase, userId }) => {
    const p = z
      .object({ limit: z.number().int().positive().max(50).optional() })
      .safeParse(input);
    const limitVal = p.success && p.data.limit ? p.data.limit : 10;
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, date, mood, energy, tags, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(limitVal);
    if (error) return dbErr("list_journal_entries", error);
    return {
      success: true,
      message: `Found ${data?.length ?? 0} journal entries`,
      data,
    };
  },

  create_journal_entry: async ({ input, supabase, userId }) => {
    const p = CreateJournalEntryInput.safeParse(input);
    if (!p.success) return badInput();
    // journal_entries has UNIQUE (user_id, date). A soft-deleted entry still
    // holds that day's slot, so deleted_at: null revives it — writing a new
    // entry for a date the user deleted should give them a visible entry, not
    // an invisible one.
    const { error, data } = await supabase
      .from("journal_entries")
      .upsert(
        {
          user_id: userId,
          date: p.data.date,
          content: p.data.content,
          mood: p.data.mood ?? null,
          energy: p.data.energy ?? null,
          tags: p.data.tags ?? [],
          deleted_at: null,
        },
        { onConflict: "user_id,date" },
      )
      .select()
      .single();
    if (error) return dbErr("create_journal_entry", error);
    return {
      success: true,
      message: `Journal entry saved for ${p.data.date}`,
      data,
    };
  },

  update_journal_entry: async ({ input, supabase, userId }) => {
    const p = UpdateJournalEntryInput.safeParse(input);
    if (!p.success) return badInput();
    const { id, ...updates } = p.data;
    const { error } = await supabase
      .from("journal_entries")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) return dbErr("update_journal_entry", error);
    return { success: true, message: "Journal entry updated." };
  },

  delete_journal_entry: async ({ input, supabase, userId }) => {
    const p = DeleteJournalEntryInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "journal_entry",
      p.data.entry_id,
      userId,
      "delete_journal_entry",
    );
  },

  list_reviews: async ({ input, supabase, userId }) => {
    const p = ListReviewsInput.safeParse(input);
    const typeFilter = p.success ? p.data.type : "all";
    const limitVal = p.success && p.data.limit ? p.data.limit : 10;
    let query = supabase
      .from("reviews")
      .select("id, type, period_start, period_end, mood, energy, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (typeFilter && typeFilter !== "all")
      query = query.eq("type", typeFilter);
    const { data, error } = await query
      .order("period_end", { ascending: false })
      .limit(limitVal);
    if (error) return dbErr("list_reviews", error);
    return {
      success: true,
      message: `Found ${data?.length ?? 0} reviews`,
      data,
    };
  },

  create_review: async ({ input, supabase, userId }) => {
    const p = CreateReviewInput.safeParse(input);
    if (!p.success) return badInput();
    const { error, data } = await supabase
      .from("reviews")
      .insert({
        user_id: userId,
        type: p.data.type,
        period_start: p.data.period_start,
        period_end: p.data.period_end,
        content: p.data.content ? { text: p.data.content } : {},
        mood: p.data.mood ?? null,
        energy: p.data.energy ?? null,
      })
      .select()
      .single();
    if (error) return dbErr("create_review", error);
    return {
      success: true,
      message: `Created ${p.data.type} review for ${p.data.period_start}–${p.data.period_end}`,
      data,
    };
  },

  update_review: async ({ input, supabase, userId }) => {
    const p = UpdateReviewInput.safeParse(input);
    if (!p.success) return badInput();
    const { id, content, ...rest } = p.data;
    const { error } = await supabase
      .from("reviews")
      .update({
        ...rest,
        ...(content !== undefined ? { content: { text: content } } : {}),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) return dbErr("update_review", error);
    return { success: true, message: "Review updated." };
  },

  delete_review: async ({ input, supabase, userId }) => {
    const p = DeleteReviewInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "review",
      p.data.review_id,
      userId,
      "delete_review",
    );
  },
} satisfies ToolHandlers;
