import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { loadGoalsData } from "@/lib/data/modules";
import { takeSnapshot } from "@/lib/data/snapshot";
import { GoalsView } from "./goals-view";

export default async function GoalsPage() {
  const supabase = await createClient();
  const initial = await takeSnapshot("goals", () => loadGoalsData(supabase, todayISO()));
  return <GoalsView initial={initial} />;
}
