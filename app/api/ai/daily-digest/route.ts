import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { runDailyDigestWorkflow } from "../../../../lib/ai/automation";

// Cron fires at 59 19 * * * UTC = 11:59 PM Dubai (UTC+4)
// Secured with CRON_SECRET or Vercel's x-vercel-cron header
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-vercel-cron");
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = cronHeader === "1";
  const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !hasValidSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const allowedEmail = process.env.ALLOWED_USER_EMAIL;

  if (!supabaseUrl || !serviceRoleKey || !geminiKey || !allowedEmail) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const adminDb = createSupabaseServerClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find the user by email
  const { data: usersData } = await adminDb.auth.admin.listUsers();
  const user = usersData?.users?.find((u) => u.email === allowedEmail);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userId = user.id;

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const result = await runDailyDigestWorkflow({
    userId,
    db: adminDb as never,
    ai: ai as never,
    now: new Date(),
    source: "cron",
  });

  return NextResponse.json({ success: result.success, date: result.date, length: result.digestText.length });
}

// Also support GET for testing
export async function GET(request: Request) {
  return POST(request);
}
