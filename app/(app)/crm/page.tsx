import { createClient } from "@/lib/supabase/server";
import { loadContacts } from "@/lib/data/modules";
import { takeSnapshot } from "@/lib/data/snapshot";
import { CRMView } from "./crm-view";

export default async function CRMPage() {
  const supabase = await createClient();
  const initial = await takeSnapshot("crm", () => loadContacts(supabase));
  return <CRMView initial={initial} />;
}
