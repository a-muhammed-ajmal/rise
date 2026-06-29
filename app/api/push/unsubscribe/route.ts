import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json()) as { endpoint?: string };

  if (!body.endpoint) {
    return Response.json({ error: "Missing endpoint" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", body.endpoint);

  if (error) {
    console.error("[push/unsubscribe]", error);
    return Response.json({ error: "Failed to remove subscription" }, { status: 500 });
  }

  return Response.json({ success: true });
}
