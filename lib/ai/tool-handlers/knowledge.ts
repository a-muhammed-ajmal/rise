// Knowledge: notes, documents and links.
//
// Every query filters by user_id itself: the MCP path runs these handlers
// with a service-role client that bypasses RLS.
import { z } from "zod";
import { dbErr, badInput, isOwnedBy, notOwned, LINK_TABLE, DEFAULT_PAGE_SIZE, pageOf, pagedResult, rangeFor, softDeleteRecord, type ToolHandlers } from "./shared";
import { uuid, offsetInput } from "./schemas";

const linkedToType = z.enum(["task", "goal", "contact"]);

const AddNoteInput = z
  .object({
    title: z.string().min(1).max(300),
    content: z.string().max(50_000),
    tags: z.array(z.string().max(50)).max(20).optional(),
    linked_to_type: linkedToType.optional().nullable(),
    linked_to_id: z.string().uuid().optional().nullable(),
  })
  .refine((d) => (d.linked_to_type == null) === (d.linked_to_id == null), {
    message: "linked_to_type and linked_to_id must be provided together",
  });

const DeleteNoteInput = z.object({
  note_id: z.string().uuid(),
  note_title: z.string().max(300).optional(),
});

// Notes
const ListNotesInput = z.object({
  tag: z.string().max(50).optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: offsetInput,
});

const UpdateNoteInput = z
  .object({
    id: uuid,
    title: z.string().min(1).max(300).optional(),
    content: z.string().max(50_000).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    linked_to_type: linkedToType.optional().nullable(),
    linked_to_id: uuid.optional().nullable(),
  })
  .refine((d) => (d.linked_to_type == null) === (d.linked_to_id == null), {
    message: "linked_to_type and linked_to_id must be provided together",
  });

// Documents
const CreateDocumentInput = z.object({
  name: z.string().min(1).max(300),
  file_path: z.string().min(1).max(2000),
  file_type: z.string().max(100).optional().nullable(),
  file_size: z.number().int().positive().optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const UpdateDocumentInput = z.object({
  id: uuid,
  name: z.string().min(1).max(300).optional(),
  file_path: z.string().min(1).max(2000).optional(),
  file_type: z.string().max(100).optional().nullable(),
  file_size: z.number().int().positive().optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const DeleteDocumentInput = z.object({
  document_id: uuid,
  document_name: z.string().optional(),
});

// Links
const CreateLinkInput = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(300).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const UpdateLinkInput = z.object({
  id: uuid,
  url: z.string().url().max(2000).optional(),
  title: z.string().max(300).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const DeleteLinkInput = z.object({ id: uuid });

export const knowledgeHandlers = {
  add_note: async ({ input, supabase, userId }) => {
    const p = AddNoteInput.safeParse(input);
    if (!p.success) return badInput();
    if (p.data.linked_to_type && p.data.linked_to_id) {
      const link = LINK_TABLE[p.data.linked_to_type];
      if (!(await isOwnedBy(supabase, link.table, p.data.linked_to_id, userId)))
        return notOwned(link.entity);
    }
    const { error } = await supabase.from("notes").insert({
      user_id: userId,
      title: p.data.title,
      content: p.data.content,
      tags: p.data.tags ?? [],
      linked_to_type: p.data.linked_to_type ?? null,
      linked_to_id: p.data.linked_to_id ?? null,
    });
    if (error) return dbErr("add_note", error);
    return { success: true, message: `Saved note: "${p.data.title}"` };
  },

  delete_note: async ({ input, supabase, userId }) => {
    const p = DeleteNoteInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "note",
      p.data.note_id,
      userId,
      "delete_note",
    );
  },

  list_notes: async ({ input, supabase, userId }) => {
    const p = ListNotesInput.safeParse(input);
    const limitVal =
      p.success && p.data.limit ? p.data.limit : DEFAULT_PAGE_SIZE;
    const offsetVal = (p.success && p.data.offset) || 0;
    const tagFilter = p.success ? p.data.tag : undefined;
    let query = supabase
      .from("notes")
      .select("id, title, tags, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (tagFilter) query = query.contains("tags", [tagFilter]);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(...rangeFor(limitVal, offsetVal));
    if (error) return dbErr("list_notes", error);
    return pagedResult("notes", pageOf(data, limitVal, offsetVal));
  },

  update_note: async ({ input, supabase, userId }) => {
    const p = UpdateNoteInput.safeParse(input);
    if (!p.success) return badInput();
    const { id, ...updates } = p.data;
    if (updates.linked_to_type && updates.linked_to_id) {
      const link = LINK_TABLE[updates.linked_to_type];
      if (!(await isOwnedBy(supabase, link.table, updates.linked_to_id, userId)))
        return notOwned(link.entity);
    }
    const { error, data } = await supabase
      .from("notes")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("title")
      .single();
    if (error) return dbErr("update_note", error);
    return { success: true, message: `Updated note: "${data?.title}"` };
  },

  list_documents: async ({ input, supabase, userId }) => {
    const p = z
      .object({ limit: z.number().int().positive().max(100).optional() })
      .safeParse(input);
    const limitVal = p.success && p.data.limit ? p.data.limit : 20;
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, file_type, file_size, tags, notes, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limitVal);
    if (error) return dbErr("list_documents", error);
    return {
      success: true,
      message: `Found ${data?.length ?? 0} documents`,
      data,
    };
  },

  create_document: async ({ input, supabase, userId }) => {
    const p = CreateDocumentInput.safeParse(input);
    if (!p.success) return badInput();
    const { error, data } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        name: p.data.name,
        file_path: p.data.file_path,
        file_type: p.data.file_type ?? null,
        file_size: p.data.file_size ?? null,
        tags: p.data.tags ?? [],
        notes: p.data.notes ?? null,
      })
      .select()
      .single();
    if (error) return dbErr("create_document", error);
    return {
      success: true,
      message: `Saved document: "${p.data.name}"`,
      data,
    };
  },

  update_document: async ({ input, supabase, userId }) => {
    const p = UpdateDocumentInput.safeParse(input);
    if (!p.success) return badInput();
    const { id, ...updates } = p.data;
    const { error, data } = await supabase
      .from("documents")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("name")
      .single();
    if (error) return dbErr("update_document", error);
    return { success: true, message: `Updated document: "${data?.name}"` };
  },

  delete_document: async ({ input, supabase, userId }) => {
    const p = DeleteDocumentInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "document",
      p.data.document_id,
      userId,
      "delete_document",
    );
  },

  list_links: async ({ input, supabase, userId }) => {
    const p = z
      .object({ limit: z.number().int().positive().max(100).optional() })
      .safeParse(input);
    const limitVal = p.success && p.data.limit ? p.data.limit : 20;
    const { data, error } = await supabase
      .from("links")
      .select("id, url, title, description, tags, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limitVal);
    if (error) return dbErr("list_links", error);
    return {
      success: true,
      message: `Found ${data?.length ?? 0} links`,
      data,
    };
  },

  create_link: async ({ input, supabase, userId }) => {
    const p = CreateLinkInput.safeParse(input);
    if (!p.success) return badInput();
    const { error, data } = await supabase
      .from("links")
      .insert({
        user_id: userId,
        url: p.data.url,
        title: p.data.title ?? null,
        description: p.data.description ?? null,
        tags: p.data.tags ?? [],
      })
      .select()
      .single();
    if (error) return dbErr("create_link", error);
    return {
      success: true,
      message: `Saved link: "${p.data.title ?? p.data.url}"`,
      data,
    };
  },

  update_link: async ({ input, supabase, userId }) => {
    const p = UpdateLinkInput.safeParse(input);
    if (!p.success) return badInput();
    const { id, ...updates } = p.data;
    const { error } = await supabase
      .from("links")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) return dbErr("update_link", error);
    return { success: true, message: "Link updated." };
  },

  delete_link: async ({ input, supabase, userId }) => {
    const p = DeleteLinkInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "link",
      p.data.id,
      userId,
      "delete_link",
    );
  },
} satisfies ToolHandlers;
