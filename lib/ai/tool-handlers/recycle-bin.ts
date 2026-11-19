// Recycle bin: list, restore, purge and bulk-delete soft-deleted records.
//
// Every query filters by user_id itself: the MCP path runs these handlers
// with a service-role client that bypasses RLS.
import { z } from "zod";
import { DELETABLE, DELETABLE_ENTITIES } from "@/lib/ai/deletable";
import { dbErr, badInput, DEFAULT_PAGE_SIZE, pageOf, pagedResult, rangeFor, displayValue, describeRecord, detachChildren, restoreRecord, type ToolHandlers } from "./shared";
import { uuid, offsetInput } from "./schemas";

// ─── Recycle bin ──────────────────────────────────────────────────────────────
const deletableEntity = z.enum(DELETABLE_ENTITIES);

const ListDeletedInput = z.object({
  entity: deletableEntity.optional(),
  limit: z.number().int().positive().max(50).optional(),
  offset: offsetInput,
});

const RestoreRecordInput = z.object({
  entity: deletableEntity,
  id: uuid,
  record_label: z.string().optional(),
});

// `confirm` is z.literal(true), so an omitted or false flag fails validation and
// the handler never reaches the database. Brief item 7.
const PurgeRecordInput = z.object({
  entity: deletableEntity,
  id: uuid,
  record_label: z.string().optional(),
  confirm: z.literal(true),
});

const BulkDeleteRecordsInput = z.object({
  entity: deletableEntity,
  ids: z.array(uuid).min(1).max(100),
  summary: z.string().optional(),
  confirm: z.literal(true),
});

export const recycleBinHandlers = {
  list_deleted: async ({ input, supabase, userId }) => {
    const p = ListDeletedInput.safeParse(input);
    if (!p.success) return badInput();
    const limitVal = p.data.limit ?? DEFAULT_PAGE_SIZE;
    const offsetVal = p.data.offset ?? 0;

    // A single entity pages properly. Without one we sample every entity so
    // the user can see the whole bin at a glance.
    if (p.data.entity) {
      const meta = DELETABLE[p.data.entity];
      const [from, to] = rangeFor(limitVal, offsetVal);
      const { data, error } = await supabase
        .from(meta.table)
        .select("*")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .range(from, to);
      if (error) return dbErr("list_deleted", error);
      // Widened because the table is chosen at runtime: `data` is a union of
      // 17 row-array types, which pageOf's single type parameter cannot infer.
      const rows: unknown[] | null = data;
      return pagedResult(
        `deleted ${meta.plural}`,
        pageOf(rows, limitVal, offsetVal),
      );
    }

    const perEntity = await Promise.all(
      DELETABLE_ENTITIES.map(async (entity) => {
        const meta = DELETABLE[entity];
        const { data, error } = await supabase
          .from(meta.table)
          .select("*")
          .eq("user_id", userId)
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(limitVal);
        return { entity, rows: error ? [] : (data ?? []) };
      }),
    );

    const bin = perEntity.filter((e) => e.rows.length > 0);
    const total = bin.reduce((sum, e) => sum + e.rows.length, 0);
    if (!total)
      return {
        success: true,
        message: "The recycle bin is empty.",
        data: [],
      };
    return {
      success: true,
      message: `Found ${total} deleted record(s) across ${bin.length} entity type(s)`,
      data: Object.fromEntries(bin.map((e) => [e.entity, e.rows])),
    };
  },

  restore_record: async ({ input, supabase, userId }) => {
    const p = RestoreRecordInput.safeParse(input);
    if (!p.success) return badInput();
    return restoreRecord(supabase, p.data.entity, p.data.id, userId);
  },

  purge_record: async ({ input, supabase, userId }) => {
    // confirm is z.literal(true) — an unconfirmed call fails validation above
    // and never reaches the database.
    const p = PurgeRecordInput.safeParse(input);
    if (!p.success)
      return {
        success: false,
        message:
          "Permanent deletion requires confirm: true and a valid entity and id.",
      };
    const meta = DELETABLE[p.data.entity];

    // Only something already in the recycle bin can be purged, so a single
    // mistaken call can never destroy live data.
    const { data: existing } = await supabase
      .from(meta.table)
      .select("*")
      .eq("id", p.data.id)
      .eq("user_id", userId)
      .not("deleted_at", "is", null)
      .maybeSingle();
    if (!existing)
      return {
        success: false,
        message: `No deleted ${meta.label.toLowerCase()} found with that id. Delete it first — purge only removes what is already in the recycle bin.`,
      };

    const { error } = await supabase
      .from(meta.table)
      .delete()
      .eq("id", p.data.id)
      .eq("user_id", userId)
      .not("deleted_at", "is", null);
    if (error) return dbErr("purge_record", error);

    // Say what the FK cascade took with it — this is the one irreversible path.
    const alsoGone = meta.cascades.length
      ? ` Its ${meta.cascades.join(" and ")} were destroyed with it.`
      : "";
    return {
      success: true,
      message: `Permanently destroyed ${meta.label.toLowerCase()}: ${describeRecord(p.data.entity, existing)}.${alsoGone} This cannot be undone.`,
      data: existing,
    };
  },

  bulk_delete_records: async ({ input, supabase, userId }) => {
    const p = BulkDeleteRecordsInput.safeParse(input);
    if (!p.success)
      return {
        success: false,
        message:
          "Bulk delete requires confirm: true, a valid entity, and 1–100 ids.",
      };
    const meta = DELETABLE[p.data.entity];

    const { data: matched, error: readError } = await supabase
      .from(meta.table)
      .select("*")
      .eq("user_id", userId)
      .in("id", p.data.ids)
      .is("deleted_at", null);
    if (readError) return dbErr("bulk_delete_records", readError);
    if (!matched?.length)
      return {
        success: false,
        message: `No live ${meta.plural} found for those ids`,
      };

    const matchedIds: string[] = [];
    for (const row of matched) {
      const id = displayValue(row, "id");
      if (id) matchedIds.push(id);
    }
    for (const id of matchedIds) {
      await detachChildren(supabase, p.data.entity, id, userId);
    }

    const { error } = await supabase
      .from(meta.table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", matchedIds)
      .is("deleted_at", null);
    if (error) return dbErr("bulk_delete_records", error);

    // Report the count actually affected, not the count requested — brief
    // item 7. They differ whenever an id was already deleted or not owned.
    const skipped = p.data.ids.length - matchedIds.length;
    const note = skipped
      ? ` ${skipped} id(s) were skipped — already deleted or not found.`
      : "";
    return {
      success: true,
      message: `Deleted ${matchedIds.length} ${meta.plural}.${note} Undo with restore_record.`,
      data: { deleted_count: matchedIds.length, ids: matchedIds },
    };
  },
} satisfies ToolHandlers;
