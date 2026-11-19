import { createClient } from "@/lib/supabase/server";
import { loadKnowledgeData } from "@/lib/data/modules";
import { takeSnapshot } from "@/lib/data/snapshot";
import { KnowledgeView } from "./knowledge-view";

export default async function KnowledgePage() {
  const supabase = await createClient();
  const initial = await takeSnapshot("knowledge", () => loadKnowledgeData(supabase));
  return <KnowledgeView initial={initial} />;
}
