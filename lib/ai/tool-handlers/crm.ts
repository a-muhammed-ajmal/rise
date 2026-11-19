// CRM: contacts and interactions.
//
// Every query filters by user_id itself: the MCP path runs these handlers
// with a service-role client that bypasses RLS.
import { z } from "zod";
import { dbErr, badInput, isOwnedBy, notOwned, DEFAULT_PAGE_SIZE, pageOf, pagedResult, rangeFor, softDeleteRecord, type ToolHandlers } from "./shared";
import { dateStr, uuid, offsetInput } from "./schemas";

const AddContactInput = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  role: z.string().max(200).optional().nullable(),
  type: z
    .enum(["personal", "lead", "prospect", "client", "network"])
    .optional(),
  stage: z
    .enum(["new", "qualified", "proposal", "negotiation", "won", "lost"])
    .optional(),
  deal_value: z.number().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

// Contacts
const ListContactsInput = z.object({
  type: z
    .enum(["lead", "prospect", "client", "network", "personal", "all"])
    .optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: offsetInput,
});

const UpdateContactInput = z.object({
  id: uuid,
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  role: z.string().max(200).optional().nullable(),
  type: z
    .enum(["lead", "prospect", "client", "network", "personal"])
    .optional(),
  stage: z
    .enum(["new", "qualified", "proposal", "negotiation", "won", "lost"])
    .optional(),
  deal_value: z.number().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const DeleteContactInput = z.object({
  contact_id: uuid,
  contact_name: z.string().optional(),
});

// Interactions
const CreateInteractionInput = z.object({
  contact_id: uuid,
  type: z.enum(["call", "email", "meeting", "message", "other"]),
  notes: z.string().min(1).max(5000),
  date: dateStr.optional(),
  follow_up_date: dateStr.optional().nullable(),
});

const ListInteractionsInput = z.object({
  contact_id: uuid.optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: offsetInput,
});

const UpdateInteractionInput = z.object({
  id: uuid,
  type: z.enum(["call", "email", "meeting", "message", "other"]).optional(),
  notes: z.string().min(1).max(5000).optional(),
  date: dateStr.optional(),
  follow_up_date: dateStr.optional().nullable(),
  contact_id: uuid.optional(),
});

const DeleteInteractionInput = z.object({
  interaction_id: uuid,
  interaction_summary: z.string().optional(),
});

export const crmHandlers = {
  add_contact: async ({ input, supabase, userId }) => {
    const p = AddContactInput.safeParse(input);
    if (!p.success) return badInput();
    const { error } = await supabase.from("contacts").insert({
      user_id: userId,
      name: p.data.name,
      email: p.data.email ?? null,
      phone: p.data.phone ?? null,
      company: p.data.company ?? null,
      role: p.data.role ?? null,
      type: p.data.type ?? "network",
      stage: p.data.stage ?? "new",
      deal_value: p.data.deal_value ?? null,
      notes: p.data.notes ?? null,
      tags: p.data.tags ?? [],
    });
    if (error) return dbErr("add_contact", error);
    return { success: true, message: `Saved contact: "${p.data.name}"` };
  },

  list_contacts: async ({ input, supabase, userId }) => {
    const p = ListContactsInput.safeParse(input);
    const typeFilter = p.success ? p.data.type : "all";
    const limitVal =
      p.success && p.data.limit ? p.data.limit : DEFAULT_PAGE_SIZE;
    const offsetVal = (p.success && p.data.offset) || 0;
    let query = supabase
      .from("contacts")
      .select("id, name, email, phone, company, type, stage")
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (typeFilter && typeFilter !== "all")
      query = query.eq("type", typeFilter);
    const { data, error } = await query
      .order("name")
      .range(...rangeFor(limitVal, offsetVal));
    if (error) return dbErr("list_contacts", error);
    return pagedResult("contacts", pageOf(data, limitVal, offsetVal));
  },

  update_contact: async ({ input, supabase, userId }) => {
    const p = UpdateContactInput.safeParse(input);
    if (!p.success) return badInput();
    const { id, ...updates } = p.data;
    const { error, data } = await supabase
      .from("contacts")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("name")
      .single();
    if (error) return dbErr("update_contact", error);
    return { success: true, message: `Updated contact: "${data?.name}"` };
  },

  delete_contact: async ({ input, supabase, userId }) => {
    const p = DeleteContactInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "contact",
      p.data.contact_id,
      userId,
      "delete_contact",
    );
  },

  create_interaction: async ({ input, supabase, userId, today }) => {
    const p = CreateInteractionInput.safeParse(input);
    if (!p.success) return badInput();
    if (!(await isOwnedBy(supabase, "contacts", p.data.contact_id, userId)))
      return notOwned("Contact");
    const { error, data } = await supabase
      .from("interactions")
      .insert({
        user_id: userId,
        contact_id: p.data.contact_id,
        type: p.data.type,
        notes: p.data.notes,
        date: p.data.date ?? today,
        follow_up_date: p.data.follow_up_date ?? null,
      })
      .select()
      .single();
    if (error) return dbErr("create_interaction", error);
    return {
      success: true,
      message: `Logged ${p.data.type} interaction`,
      data,
    };
  },

  list_interactions: async ({ input, supabase, userId }) => {
    const p = ListInteractionsInput.safeParse(input);
    if (!p.success) return badInput();
    const limitVal = p.data.limit ?? DEFAULT_PAGE_SIZE;
    const offsetVal = p.data.offset ?? 0;
    let query = supabase
      .from("interactions")
      .select("id, contact_id, type, notes, date, follow_up_date")
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (p.data.contact_id) query = query.eq("contact_id", p.data.contact_id);
    const { data, error } = await query
      .order("date", { ascending: false })
      .range(...rangeFor(limitVal, offsetVal));
    if (error) return dbErr("list_interactions", error);
    return pagedResult("interactions", pageOf(data, limitVal, offsetVal));
  },

  update_interaction: async ({ input, supabase, userId }) => {
    const p = UpdateInteractionInput.safeParse(input);
    if (!p.success) return badInput();
    const { id, ...updates } = p.data;
    if (
      updates.contact_id &&
      !(await isOwnedBy(supabase, "contacts", updates.contact_id, userId))
    )
      return notOwned("Contact");
    const { error } = await supabase
      .from("interactions")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) return dbErr("update_interaction", error);
    return { success: true, message: "Interaction updated." };
  },

  delete_interaction: async ({ input, supabase, userId }) => {
    const p = DeleteInteractionInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "interaction",
      p.data.interaction_id,
      userId,
      "delete_interaction",
    );
  },
} satisfies ToolHandlers;
