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
  const authFreePath = request.nextUrl.pathname;
  if (
    authFreePath.startsWith("/api/mcp") ||
    authFreePath.startsWith("/.well-known/oauth-") ||
    authFreePath.startsWith("/api/oauth/")
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const allowedEmail = process.env.ALLOWED_USER_EMAIL;

  // Redirect unauthenticated users to login
  if (
    !user &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/auth")
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Block wrong accounts that somehow have a session
  if (user && allowedEmail && user.email !== allowedEmail) {
    await supabase.auth.signOut();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "?error=unauthorized";
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login
  if (user && pathname.startsWith("/login")) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}
