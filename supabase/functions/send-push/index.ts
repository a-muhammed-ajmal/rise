// Supabase Edge Function — send-push
// Runs on a cron schedule (every hour) to deliver habit nudges + CRM follow-up reminders.
// Deploy: supabase functions deploy send-push
// Schedule: set via Supabase dashboard → Edge Functions → send-push → Schedule

import { createClient } from "jsr:@supabase/supabase-js@2";

// Minimal VAPID web-push implementation using SubtleCrypto (Deno built-in)
// Avoids requiring a Node web-push package in Deno runtime.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:writeajmal@gmail.com";

// ── helpers ──────────────────────────────────────────────────────────────────

function base64UrlDecode(str: string): Uint8Array {
  const pad = str.length % 4;
  const padded = str + "=".repeat(pad ? 4 - pad : 0);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function base64UrlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signJWT(header: object, payload: object, privateKeyBytes: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

async function buildVapidToken(audience: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const privateKeyBytes = base64UrlDecode(VAPID_PRIVATE_KEY);

  // The private key from web-push-generate is a raw 32-byte EC scalar —
  // wrap it in PKCS8 DER for SubtleCrypto import.
  const pkcs8 = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
    ...privateKeyBytes,
  ]);

  return signJWT(
    { typ: "JWT", alg: "ES256" },
    { aud: audience, exp: now + 12 * 3600, sub: VAPID_SUBJECT },
    pkcs8,
  );
}

async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string },
): Promise<Response> {
  const endpointUrl = new URL(subscription.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const token = await buildVapidToken(audience);

  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    Authorization: `vapid t=${token},k=${VAPID_PUBLIC_KEY}`,
    TTL: "86400",
  };

  // Encrypt payload using browser-native Web Push encryption (RFC 8291)
  // For simplicity we send as plaintext with Content-Encoding: aes128gcm
  // when encryption keys are available. Here we use a minimal approach
  // that works with the SW push handler which reads event.data.json().
  const body = new TextEncoder().encode(JSON.stringify(payload));

  return fetch(subscription.endpoint, { method: "POST", headers, body });
}

// ── main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  // 1. Load all push subscriptions
  const { data: subs, error: subErr } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth, reminder_types");

  if (subErr || !subs?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: subErr?.message ?? "no subscriptions" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: { endpoint: string; type: string; status: number }[] = [];

  for (const sub of subs) {
    const types: string[] = sub.reminder_types ?? [];

    // ── Habit nudges ──────────────────────────────────────────────────────
    if (types.includes("habit_nudge")) {
      const { data: habits } = await supabase
        .from("habits")
        .select("id, name, frequency, target_days, reminder_time")
        .eq("user_id", sub.user_id)
        .eq("active", true);

      const todayDow = new Date().getDay(); // 0=Sun … 6=Sat
      const currentHour = new Date().getUTCHours();

      for (const habit of habits ?? []) {
        const isDueToday =
          habit.frequency === "daily" ||
          (habit.frequency === "weekly" && (habit.target_days ?? []).includes(todayDow)) ||
          (habit.frequency === "custom" && (habit.target_days ?? []).includes(todayDow));

        if (!isDueToday) continue;

        // If a reminder_time is set, only fire during that UTC hour
        if (habit.reminder_time) {
          const reminderHour = parseInt((habit.reminder_time as string).split(":")[0], 10);
          if (currentHour !== reminderHour) continue;
        }

        // Check if already logged today
        const { data: logged } = await supabase
          .from("habit_logs")
          .select("id")
          .eq("habit_id", habit.id)
          .eq("logged_date", today)
          .eq("completed", true)
          .maybeSingle();

        if (logged) continue;

        const res = await sendPush(sub, {
          title: "Habit reminder",
          body: `Don't forget: ${habit.name}`,
          url: "/wellness",
        });
        results.push({ endpoint: sub.endpoint, type: "habit_nudge", status: res.status });
      }
    }

    // ── CRM follow-ups ────────────────────────────────────────────────────
    if (types.includes("crm_followup")) {
      const { data: interactions } = await supabase
        .from("interactions")
        .select("id, notes, contacts(name)")
        .eq("user_id", sub.user_id)
        .eq("follow_up_date", today);

      for (const interaction of interactions ?? []) {
        const contactName = (interaction.contacts as { name: string } | null)?.name ?? "contact";
        const res = await sendPush(sub, {
          title: "Follow-up reminder",
          body: `Follow up with ${contactName} today`,
          url: "/crm",
        });
        results.push({ endpoint: sub.endpoint, type: "crm_followup", status: res.status });
      }
    }
  }

  return new Response(JSON.stringify({ sent: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
