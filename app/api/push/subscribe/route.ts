import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const SubscribeBody = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const parsed = SubscribeBody.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid subscription data" }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      reminder_types: ["habit_nudge", "crm_followup"],
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[push/subscribe]", error);
    return Response.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  return Response.json({ success: true });
}
