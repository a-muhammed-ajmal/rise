import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { loadWellnessData } from "@/lib/data/modules";
import { takeSnapshot } from "@/lib/data/snapshot";
import { WellnessView } from "./wellness-view";

export default async function WellnessPage() {
  const supabase = await createClient();
  const initial = await takeSnapshot("wellness", () =>
    loadWellnessData(supabase, todayISO()),
  );
  return <WellnessView initial={initial} />;
}
