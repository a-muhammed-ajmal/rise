import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { loadCategories, loadFinanceData, loadPaymentMethods } from "@/lib/data/finance";
import { takeSnapshot } from "@/lib/data/snapshot";
import { FinanceView } from "./finance-view";

export default async function FinancePage() {
  const supabase = await createClient();
  const [finance, paymentMethods, categories] = await Promise.all([
    takeSnapshot("finance", () => loadFinanceData(supabase, todayISO())),
    takeSnapshot("finance/wallets", () => loadPaymentMethods(supabase)),
    takeSnapshot("finance/categories", () => loadCategories(supabase)),
  ]);
  return <FinanceView initial={{ finance, paymentMethods, categories }} />;
}
