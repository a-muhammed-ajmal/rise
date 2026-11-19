// WhatsApp reminder recipients and delivery status.
//
// Every query filters by user_id itself: the MCP path runs these handlers
// with a service-role client that bypasses RLS.
import { addDaysISO } from "@/lib/format";
import { z } from "zod";
import { dbErr, badInput, type ToolHandlers } from "./shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SetWhatsappRemindersInput = z.object({
  // E.164. whatsapp_recipients has a matching CHECK constraint, but failing
  // here saves a round trip and returns a message the assistant can act on.
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  reminder_types: z
    .array(z.enum(["habit_nudge", "crm_followup", "task_due"]))
    .min(1)
    .optional(),
  active: z.boolean().optional(),
});

export const whatsappHandlers = {
  set_whatsapp_reminders: async ({ input, supabase, userId }) => {
    const p = SetWhatsappRemindersInput.safeParse(input);
    if (!p.success) return badInput();
    const { data, error } = await supabase
      .from("whatsapp_recipients")
      .upsert(
        {
          user_id: userId,
          phone_e164: p.data.phone,
          reminder_types: p.data.reminder_types ?? [
            "habit_nudge",
            "crm_followup",
            "task_due",
          ],
          active: p.data.active ?? true,
        },
        { onConflict: "user_id,phone_e164" },
      )
      .select("id, phone_e164, reminder_types, active")
      .single();
    if (error) return dbErr("set_whatsapp_reminders", error);
    return {
      success: true,
      message: `WhatsApp reminders ${
        data?.active ? "enabled" : "disabled"
      } for ${data?.phone_e164} (${(data?.reminder_types ?? []).join(", ")})`,
      data,
    };
  },

  list_whatsapp_reminders: async ({ supabase, userId, today }) => {
    const { data: recipients, error } = await supabase
      .from("whatsapp_recipients")
      .select("id, phone_e164, reminder_types, active")
      .eq("user_id", userId)
      .order("created_at");
    if (error) return dbErr("list_whatsapp_reminders", error);

    // Meta answers 200 and silently drops a message whose template does not
    // match, so a recent-failure count is the only signal the user gets that
    // reminders are configured but not arriving.
    const { data: failures } = await supabase
      .from("whatsapp_log")
      .select("id, reminder_type, error, created_at")
      .eq("user_id", userId)
      .eq("status", "failed")
      .gte("created_at", addDaysISO(today, -7))
      .order("created_at", { ascending: false })
      .limit(10);

    const failCount = failures?.length ?? 0;
    return {
      success: true,
      message: `Found ${recipients?.length ?? 0} WhatsApp recipients` +
        (failCount > 0
          ? `; ${failCount} failed sends in the last 7 days`
          : ""),
      data: { recipients, recent_failures: failures ?? [] },
    };
  },
} satisfies ToolHandlers;
