import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";

export async function updateSession(request: NextRequest) {
  // MCP + OAuth endpoints are hit by Claude without an app session and enforce
  // their own auth:
  //   /api/mcp              — static bearer or OAuth access token (lib/ai/mcp.ts)
  //   /.well-known/oauth-*  — public OAuth discovery metadata (RFC 9728 / 8414)
  //   /api/oauth/token      — OAuth token endpoint (client secret + PKCE)
  //   /api/oauth/authorize  — runs its own Supabase session check + returnTo
  //   /api/ai/daily-digest  — cron POST carrying CRON_SECRET, never a session.
  //     Without this the scheduled run is redirected to /login and the digest
  //     silently never executes: Vercel records a 307, not a failure. The route
  //     rate-limits, requires `Authorization: Bearer $CRON_SECRET`, fails closed
  //     with 503 when the secret is unset, and exposes no GET handler.
  const authFreePath = request.nextUrl.pathname;
  if (
    authFreePath.startsWith("/api/mcp") ||
    authFreePath.startsWith("/.well-known/oauth-") ||
    authFreePath.startsWith("/api/oauth/") ||
    authFreePath.startsWith("/api/ai/daily-digest")
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const allowedEmail = process.env.ALLOWED_USER_EMAIL;
  if (!supabaseUrl || !publishableKey || !allowedEmail) {
    console.error("[auth] required single-user configuration is missing");
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 },
    );
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() verifies the access token's signature locally against the
  // project's cached JWKS, so an authenticated navigation costs no network
  // round trip to the Auth server. getUser() cost one on *every* request —
  // sequentially ahead of the layout's own auth call and the page's queries,
  // which is what made a cold app open feel slow. The session is still loaded
  // (and refreshed when expired) first, and on a project using legacy
  // symmetric JWT secrets getClaims() falls back to getUser() internally, so
  // the security properties are unchanged either way.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;
  const email = typeof claims?.email === "string" ? claims.email : undefined;

  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users to login
  if (
    !claims &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/auth")
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Block wrong accounts that somehow have a session
  if (claims && email !== allowedEmail) {
    await supabase.auth.signOut();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "?error=unauthorized";
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login
  if (claims && pathname.startsWith("/login")) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}
