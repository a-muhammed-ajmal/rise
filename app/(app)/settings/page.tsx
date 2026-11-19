import { createClient } from "@/lib/supabase/server";
import { loadProfile } from "@/lib/data/modules";
import { takeSnapshot } from "@/lib/data/snapshot";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const supabase = await createClient();
  const initial = await takeSnapshot("settings", () => loadProfile(supabase));
  return <SettingsView initial={initial} />;
}
