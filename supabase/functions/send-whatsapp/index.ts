// Supabase Edge Function — send-whatsapp
// Hourly cron. Delivers habit nudges, CRM follow-ups and task-due reminders
// over the WhatsApp Cloud API.
//
// Deploy:   supabase functions deploy send-whatsapp
// Schedule: Supabase dashboard → Edge Functions → send-whatsapp → Schedule (hourly)
//
// Required secrets:
//   WHATSAPP_TOKEN            permanent system-user token
//   WHATSAPP_PHONE_NUMBER_ID  from the Meta app WhatsApp → API setup panel
//   WHATSAPP_TEMPLATE_NAME    an APPROVED template with exactly one body variable
//
// Two things this deliberately does NOT copy from send-push:
//
//   1. Timezone. send-push compares habit.reminder_time against getUTCHours(),
//      but reminder_time is entered in Dubai local time (CLAUDE.md fixes the app
//      at Asia/Dubai, UTC+4, no DST) — so an 08:00 reminder fires at 12:00 local.
//      It also derives "today" from toISOString(), which is the wrong date
//      between 20:00 and 24:00 UTC, i.e. 00:00-04:00 in Dubai. Both are
//      computed in Dubai time here.
//
//   2. Fire-and-forget. Meta accepts a malformed template with a 200 and
//      silently drops the message, so every attempt is claimed and recorded in
//      whatsapp_log first. That claim is also what stops an hourly cron from
//      sending the same task-due reminder 24 times in a day.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_TEMPLATE_NAME = Deno.env.get("WHATSAPP_TEMPLATE_NAME") ?? "rise_reminder";
// Meta creates templates under a specific locale; rise_reminder is en_US.
// "en" is a different language entry and returns a template-not-found error.
const WHATSAPP_TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_LANG") ?? "en_US";
const GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v21.0";
const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Dubai is UTC+4 year round — no DST — so a fixed offset is correct here and
// avoids pulling a tz database into the Deno runtime.
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

// Hour at which an item with a date but no time is announced (Dubai local).
const DEFAULT_HOUR = 8;

type ReminderType = "habit_nudge" | "crm_followup" | "task_due";

type Recipient = {
  id: string;
  user_id: string;
  phone_e164: string;
  reminder_types: string[] | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseRecipient(value: unknown): Recipient | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.user_id !== "string" ||
    typeof value.phone_e164 !== "string"
  ) {
    return null;
  }
  const reminderTypes = Array.isArray(value.reminder_types)
    ? value.reminder_types.filter(
      (item): item is string => typeof item === "string",
    )
    : null;
  return {
    id: value.id,
    user_id: value.user_id,
    phone_e164: value.phone_e164,
    reminder_types: reminderTypes,
  };
}

function metaMessageId(payload: unknown): string | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) return undefined;
  const first = payload.messages[0];
  return isRecord(first) ? optionalString(first.id) : undefined;
}

function metaError(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) return undefined;
  return optionalString(payload.error.message);
}

function contactName(value: unknown): string | undefined {
  const contact = Array.isArray(value) ? value[0] : value;
  return isRecord(contact) ? optionalString(contact.name) : undefined;
}

function dubaiNow(): { date: string; hour: number; dow: number } {
  const shifted = new Date(Date.now() + DUBAI_OFFSET_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    dow: shifted.getUTCDay(),
  };
}

function hourOf(time: string | null): number | null {
  if (!time) return null;
  const h = Number.parseInt(time.split(":")[0], 10);
  return Number.isFinite(h) ? h : null;
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function sendTemplate(
  phone: string,
  body: string,
): Promise<{ ok: boolean; status: number; messageId?: string; error?: string }> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: WHATSAPP_TEMPLATE_NAME,
          language: { code: WHATSAPP_TEMPLATE_LANG },
          components: [
            { type: "body", parameters: [{ type: "text", text: body }] },
          ],
        },
      }),
    },
  );

  const payload: unknown = await res.json().catch(() => null);

  return res.ok
    ? { ok: true, status: res.status, messageId: metaMessageId(payload) }
    : {
      ok: false,
      status: res.status,
      error: metaError(payload) ?? `HTTP ${res.status}`,
    };
}

Deno.serve(async (request) => {
  if (!CRON_SECRET) {
    // Fail closed and loudly — a missing credential must not be reported the
    // same way as a quiet "nothing was due" run.
    return new Response(
      JSON.stringify({ error: "Required server configuration is missing" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const authorization = request.headers.get("authorization");
  if (
    !authorization ||
    !(await secureEqual(authorization, `Bearer ${CRON_SECRET}`))
  ) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (
    !SUPABASE_URL ||
    !SERVICE_ROLE_KEY ||
    !WHATSAPP_TOKEN ||
    !WHATSAPP_PHONE_NUMBER_ID
  ) {
    return new Response(
      JSON.stringify({ error: "Required server configuration is missing" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { date: today, hour: currentHour, dow: todayDow } = dubaiNow();

  const { data: recipients, error: recipientErr } = await supabase
    .from("whatsapp_recipients")
    .select("id, user_id, phone_e164, reminder_types")
    .eq("active", true);

  if (recipientErr) {
    return new Response(JSON.stringify({ error: recipientErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!recipients?.length) {
    return new Response(
      JSON.stringify({ sent: 0, reason: "no active recipients" }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const results: { type: ReminderType; entity: string; status: string }[] = [];

  // Claim a send slot, then send. The unique index on
  // (user_id, reminder_type, coalesce(entity_id, sentinel), dedup_key) makes
  // this atomic: a 23505 means another run already took this window.
  async function claimAndSend(
    recipient: Recipient,
    type: ReminderType,
    entityId: string | null,
    body: string,
  ): Promise<void> {
    const { data: claim, error: claimErr } = await supabase
      .from("whatsapp_log")
      .insert({
        user_id: recipient.user_id,
        recipient_id: recipient.id,
        phone_e164: recipient.phone_e164,
        reminder_type: type,
        entity_id: entityId,
        dedup_key: today,
        body,
        status: "pending",
      })
      .select("id")
      .single();

    if (claimErr) {
      // 23505 = unique violation = already sent for this window. Expected on
      // every run after the first, so it is not an error worth reporting.
      if (claimErr.code !== "23505") {
        results.push({
          type,
          entity: entityId ?? "-",
          status: `claim_error:${claimErr.code}`,
        });
      }
      return;
    }

    const sent = await sendTemplate(recipient.phone_e164, body);

    const { error: logUpdateError } = await supabase
      .from("whatsapp_log")
      .update({
        status: sent.ok ? "sent" : "failed",
        http_status: sent.status,
        wa_message_id: sent.messageId ?? null,
        error: sent.error ?? null,
        sent_at: new Date().toISOString(),
      })
      .eq("id", claim.id);

    if (logUpdateError) {
      console.error("[send-whatsapp] delivery log update failed", {
        claimId: claim.id,
        code: logUpdateError.code,
      });
    }

    results.push({
      type,
      entity: entityId ?? "-",
      status: sent.ok ? "sent" : "failed",
    });
  }

  for (const rawRecipient of recipients) {
    const recipient = parseRecipient(rawRecipient);
    if (!recipient) {
      results.push({ type: "task_due", entity: "-", status: "invalid_recipient" });
      continue;
    }
    const types: string[] = recipient.reminder_types ?? [];

    // ── Habit nudges ────────────────────────────────────────────────────────
    // Service role bypasses RLS, so the soft-delete predicate has to be written
    // out by hand on every query here — nothing upstream applies it.
    if (types.includes("habit_nudge")) {
      const { data: habits, error: habitsError } = await supabase
        .from("habits")
        .select("id, name, frequency, target_days, reminder_time")
        .eq("user_id", recipient.user_id)
        .is("deleted_at", null)
        .eq("active", true);

      if (habitsError) {
        results.push({
          type: "habit_nudge",
          entity: "-",
          status: `query_error:${habitsError.code}`,
        });
      }

      for (const habit of habitsError ? [] : (habits ?? [])) {
        const dueToday = habit.frequency === "daily" ||
          ((habit.frequency === "weekly" || habit.frequency === "custom") &&
            (habit.target_days ?? []).includes(todayDow));
        if (!dueToday) continue;

        // An unset reminder_time means "no particular hour" — fall back to the
        // default rather than firing on all 24 runs.
        if (currentHour !== (hourOf(habit.reminder_time) ?? DEFAULT_HOUR)) continue;

        // A soft-deleted log must not count as logged, or a habit the user has
        // not actually done goes un-nudged.
        const { data: logged, error: loggedError } = await supabase
          .from("habit_logs")
          .select("id")
          .eq("habit_id", habit.id)
          .is("deleted_at", null)
          .eq("logged_date", today)
          .eq("completed", true)
          .maybeSingle();
        if (loggedError) {
          results.push({
            type: "habit_nudge",
            entity: habit.id,
            status: `query_error:${loggedError.code}`,
          });
          continue;
        }
        if (logged) continue;

        await claimAndSend(
          recipient,
          "habit_nudge",
          habit.id,
          `Habit due today — ${habit.name}`,
        );
      }
    }

    // ── CRM follow-ups ──────────────────────────────────────────────────────
    if (types.includes("crm_followup") && currentHour === DEFAULT_HOUR) {
      // !inner makes the contact a join filter, so a follow-up whose contact
      // was deleted stops nudging instead of nudging about a deleted person.
      const { data: interactions, error: interactionsError } = await supabase
        .from("interactions")
        .select("id, contacts!inner(name)")
        .eq("user_id", recipient.user_id)
        .is("deleted_at", null)
        .is("contacts.deleted_at", null)
        .eq("follow_up_date", today);

      if (interactionsError) {
        results.push({
          type: "crm_followup",
          entity: "-",
          status: `query_error:${interactionsError.code}`,
        });
      }

      for (const interaction of interactionsError ? [] : (interactions ?? [])) {
        const name = contactName(interaction.contacts) ?? "a contact";
        await claimAndSend(
          recipient,
          "crm_followup",
          interaction.id,
          `Follow up with ${name} today`,
        );
      }
    }

    // ── Tasks due ───────────────────────────────────────────────────────────
    if (types.includes("task_due")) {
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("id, title, due_time")
        .eq("user_id", recipient.user_id)
        .is("deleted_at", null)
        .is("completed_at", null)
        .neq("status", "done")
        .eq("due_date", today);

      if (tasksError) {
        results.push({
          type: "task_due",
          entity: "-",
          status: `query_error:${tasksError.code}`,
        });
      }

      for (const task of tasksError ? [] : (tasks ?? [])) {
        if (currentHour !== (hourOf(task.due_time) ?? DEFAULT_HOUR)) continue;
        await claimAndSend(
          recipient,
          "task_due",
          task.id,
          `Task due today — ${task.title}`,
        );
      }
    }
  }

  return new Response(
    JSON.stringify({
      sent: results.filter((r) => r.status === "sent").length,
      dubai_date: today,
      dubai_hour: currentHour,
      results,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
