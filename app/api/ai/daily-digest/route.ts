import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@supabase/supabase-js";
import { runDailyDigestWorkflow } from "@/lib/ai/automation";
import { authorizeCronRequest } from "@/lib/ai/cron-auth";
import { checkRateLimit, clientIpFrom, rateLimitResponse } from "@/lib/rate-limit";

// Cron fires at 59 19 * * * UTC = 11:59 PM Dubai (UTC+4).
//
// Authentication is the CRON_SECRET bearer only — Vercel attaches it to every
// scheduled invocation. The caller-controlled `x-vercel-cron` header is never
// treated as proof of anything (see lib/ai/cron-auth.ts). There is deliberately
// no GET handler: an unauthenticated test door on a route that spends money on
// the Claude API and reads with the service-role key is not worth the
// convenience.

const RATE_LIMIT = { limit: 2, windowMs: 60_000 };

export async function POST(request: Request) {
  // Throttle ahead of auth so credential guessing cannot be run at speed.
  const rl = checkRateLimit(
    `digest:${clientIpFrom(request.headers)}`,
    RATE_LIMIT,
  );
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const auth = authorizeCronRequest(request.headers);
  if (!auth.ok) {
    console.warn("[ai/daily-digest] rejected:", auth.reason);
    return NextResponse.json(
      { error: auth.status === 503 ? "Service unavailable" : "Unauthorized" },
      { status: auth.status },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // The digest runs on Claude (lib/ai/digest-model.ts); chat and audio
  // transcription still use GEMINI_API_KEY elsewhere.
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const allowedEmail = process.env.ALLOWED_USER_EMAIL;

  if (!supabaseUrl || !serviceRoleKey || !anthropicKey || !allowedEmail) {
    // Name the gap in the server log only — never in the response body.
    const missing = [
      !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
      !anthropicKey && "ANTHROPIC_API_KEY",
      !allowedEmail && "ALLOWED_USER_EMAIL",
    ].filter(Boolean);
    console.error("[ai/daily-digest] missing configuration:", missing.join(", "));
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  try {
    const adminDb = createSupabaseServerClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find the user by email
    const { data: usersData } = await adminDb.auth.admin.listUsers();
    const user = usersData?.users?.find((u) => u.email === allowedEmail);
    if (!user) {
      console.error("[ai/daily-digest] allowed user not found");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await runDailyDigestWorkflow({
      userId: user.id,
      db: adminDb as never,
      now: new Date(),
      source: "cron",
    });

    if (!result.success) {
      console.error("[ai/daily-digest] workflow failed:", result.error);
      return NextResponse.json({ error: "Digest failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      date: result.date,
      length: result.digestText.length,
    });
  } catch (err) {
    console.error("[ai/daily-digest] unhandled error:", err);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
}
