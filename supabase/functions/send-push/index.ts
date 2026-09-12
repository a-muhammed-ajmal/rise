// Supabase Edge Function — send-push
// Hourly cron delivering payload-free Web Push signals. Payload-free delivery
// is standards-compliant without implementing RFC 8291 encryption, and it keeps
// private task/contact text out of third-party push infrastructure.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:ajmalconsults@gmail.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DEFAULT_HOUR = 8;

type ReminderType = "habit_nudge" | "crm_followup";

type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  reminder_types: string[] | null;
};

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
  const hour = Number.parseInt(time.split(":")[0] ?? "", 10);
  return Number.isFinite(hour) ? hour : null;
}

function base64UrlDecode(value: string): Uint8Array {
  const remainder = value.length % 4;
  const padded = value + "=".repeat(remainder ? 4 - remainder : 0);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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

async function signJwt(
  header: object,
  payload: object,
  privateKeyBytes: Uint8Array,
): Promise<string> {
  const encoder = new TextEncoder();
  const headerPart = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadPart = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerPart}.${payloadPart}`;
  const pkcs8 = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
    ...privateKeyBytes,
  ]);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function sendPush(endpoint: string): Promise<Response> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error("VAPID is not configured");
  }
  const endpointUrl = new URL(endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    { typ: "JWT", alg: "ES256" },
    { aud: audience, exp: now + 12 * 3600, sub: VAPID_SUBJECT },
    base64UrlDecode(VAPID_PRIVATE_KEY),
  );

  return fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${token},k=${VAPID_PUBLIC_KEY}`,
      TTL: "86400",
      Urgency: "normal",
    },
  });
}

Deno.serve(async (request) => {
  if (!CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authorization = request.headers.get("authorization");
  const expectedAuthorization = `Bearer ${CRON_SECRET}`;
  if (!authorization || !(await secureEqual(authorization, expectedAuthorization))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (
    !SUPABASE_URL ||
    !SERVICE_ROLE_KEY ||
    !VAPID_PUBLIC_KEY ||
    !VAPID_PRIVATE_KEY
  ) {
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { date: today, hour: currentHour, dow: todayDow } = dubaiNow();
  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, reminder_types");

  if (subscriptionError) {
    return new Response(JSON.stringify({ error: subscriptionError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!subscriptions?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: "no subscriptions" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: { type: ReminderType; entity: string; status: string }[] = [];

  async function claimAndSend(
    subscription: Subscription,
    type: ReminderType,
    entityId: string,
  ): Promise<void> {
    const { data: claim, error: claimError } = await supabase
      .from("push_notification_log")
      .insert({
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        reminder_type: type,
        entity_id: entityId,
        dedup_key: today,
        status: "pending",
      })
      .select("id")
      .single();

    if (claimError) {
      if (claimError.code !== "23505") {
        results.push({
          type,
          entity: entityId,
          status: `claim_error:${claimError.code}`,
        });
      }
      return;
    }

    let response: Response;
    try {
      response = await sendPush(subscription.endpoint);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Push failed";
      await supabase
        .from("push_notification_log")
        .update({
          status: "failed",
          error: message,
          sent_at: new Date().toISOString(),
        })
        .eq("id", claim.id);
      results.push({ type, entity: entityId, status: "failed" });
      return;
    }

    const succeeded = response.ok;
    await supabase
      .from("push_notification_log")
      .update({
        status: succeeded ? "sent" : "failed",
        http_status: response.status,
        error: succeeded ? null : `HTTP ${response.status}`,
        sent_at: new Date().toISOString(),
      })
      .eq("id", claim.id);

    if (response.status === 404 || response.status === 410) {
      await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
    }
    results.push({
      type,
      entity: entityId,
      status: succeeded ? "sent" : "failed",
    });
  }

  for (const subscription of subscriptions) {
    const types: string[] = subscription.reminder_types ?? [];

    if (types.includes("habit_nudge")) {
      const { data: habits, error: habitError } = await supabase
        .from("habits")
        .select("id, frequency, target_days, reminder_time")
        .eq("user_id", subscription.user_id)
        .is("deleted_at", null)
        .eq("active", true);
      if (habitError) {
        results.push({ type: "habit_nudge", entity: "-", status: "query_error" });
      }

      for (const habit of habits ?? []) {
        const dueToday =
          habit.frequency === "daily" ||
          ((habit.frequency === "weekly" || habit.frequency === "custom") &&
            (habit.target_days ?? []).includes(todayDow));
        if (!dueToday) continue;
        if (currentHour !== (hourOf(habit.reminder_time) ?? DEFAULT_HOUR)) continue;

        const { data: logged, error: logError } = await supabase
          .from("habit_logs")
          .select("id")
          .eq("user_id", subscription.user_id)
          .eq("habit_id", habit.id)
          .is("deleted_at", null)
          .eq("logged_date", today)
          .eq("completed", true)
          .maybeSingle();
        if (logError || logged) continue;
        await claimAndSend(subscription, "habit_nudge", habit.id);
      }
    }

    if (types.includes("crm_followup") && currentHour === DEFAULT_HOUR) {
      const { data: interactions, error: interactionError } = await supabase
        .from("interactions")
        .select("id, contacts!inner(id)")
        .eq("user_id", subscription.user_id)
        .is("deleted_at", null)
        .is("contacts.deleted_at", null)
        .eq("follow_up_date", today);
      if (interactionError) {
        results.push({ type: "crm_followup", entity: "-", status: "query_error" });
      }
      for (const interaction of interactions ?? []) {
        await claimAndSend(subscription, "crm_followup", interaction.id);
      }
    }
  }

  return new Response(JSON.stringify({ sent: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
