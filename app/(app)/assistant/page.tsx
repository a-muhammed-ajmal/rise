import { createClient } from "@/lib/supabase/server";
import { cachedJwks } from "@/lib/supabase/jwks";
import { loadLatestConversation } from "@/lib/data/modules";
import { takeSnapshot } from "@/lib/data/snapshot";
import { AssistantView } from "./assistant-view";

export default async function AssistantPage() {
  const supabase = await createClient();
  // Same local token check as the app layout — no Auth round trip.
  const { data } = await supabase.auth.getClaims(undefined, { jwks: await cachedJwks() });
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  const initial = userId
    ? await takeSnapshot("assistant", () => loadLatestConversation(supabase, userId))
    : null;
  return <AssistantView initial={initial} />;
}
