import { NextResponse } from "next/server";
import { getPublicOrigin } from "mcp-handler";
import { createClient } from "@/lib/supabase/server";
import {
  OAUTH_SCOPE,
  canonicalResource,
  isAllowedRedirectUri,
  isValidClientId,
  issueAuthorizationCode,
  resourceMatches,
} from "@/lib/ai/mcp-oauth";

export const runtime = "nodejs";

type Validated = {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scope: string;
  resource: string;
};

function htmlError(message: string, status: number): Response {
  return new Response(consentShell("Cannot connect", `<p>${escapeHtml(message)}</p>`), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] ?? c,
  );
}

// Redirect an OAuth error back to the (already-validated) redirect_uri.
function errorRedirect(
  redirectUri: string,
  error: string,
  state: string | null,
  origin: string,
): Response {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  if (state) u.searchParams.set("state", state);
  u.searchParams.set("iss", origin);
  return NextResponse.redirect(u.toString(), 302);
}

// Validate params. client_id + redirect_uri must be valid before we trust
// redirect_uri enough to bounce errors to it; other errors redirect.
function validate(
  url: URL,
  origin: string,
):
  | { kind: "ok"; params: Validated }
  | { kind: "html"; message: string }
  | { kind: "redirect"; redirectUri: string; error: string; state: string | null } {
  const p = url.searchParams;
  const clientId = p.get("client_id");
  const redirectUri = p.get("redirect_uri");
  const state = p.get("state");

  if (!clientId || !isValidClientId(clientId)) {
    return { kind: "html", message: "Invalid client_id." };
  }
  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
    return { kind: "html", message: "Invalid or disallowed redirect_uri." };
  }
  if (p.get("response_type") !== "code") {
    return { kind: "redirect", redirectUri, error: "unsupported_response_type", state };
  }
  const codeChallenge = p.get("code_challenge");
  if (!codeChallenge || p.get("code_challenge_method") !== "S256") {
    return { kind: "redirect", redirectUri, error: "invalid_request", state };
  }
  const resource = p.get("resource") ?? canonicalResource(origin);
  if (!resourceMatches(resource, origin)) {
    return { kind: "redirect", redirectUri, error: "invalid_target", state };
  }
  const scope = p.get("scope") ?? OAUTH_SCOPE;
  return {
    kind: "ok",
    params: { clientId, redirectUri, state, codeChallenge, scope, resource },
  };
}

// Resolves the signed-in, allowed user; otherwise returns a redirect/error action.
async function requireAllowedUser(
  url: URL,
  origin: string,
): Promise<{ userId: string } | { redirect: Response }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("next", url.pathname + url.search);
    return { redirect: NextResponse.redirect(loginUrl.toString(), 302) };
  }
  const allowedEmail = process.env.ALLOWED_USER_EMAIL;
  if (!allowedEmail || user.email !== allowedEmail) {
    console.warn("[oauth/authorize] rejected non-allowed user:", user.email);
    return { redirect: htmlError("This account is not authorised for RISE.", 403) };
  }
  return { userId: user.id };
}

export async function GET(req: Request): Promise<Response> {
  const origin = getPublicOrigin(req);
  const url = new URL(req.url);
  const v = validate(url, origin);
  if (v.kind === "html") return htmlError(v.message, 400);
  if (v.kind === "redirect") {
    return errorRedirect(v.redirectUri, v.error, v.state, origin);
  }

  const auth = await requireAllowedUser(url, origin);
  if ("redirect" in auth) return auth.redirect;

  // Render the consent screen. Approving POSTs back to this same URL (query
  // preserved in the form action), which mints the code.
  const action = `${origin}${url.pathname}${url.search}`;
  const denyUrl = new URL(v.params.redirectUri);
  denyUrl.searchParams.set("error", "access_denied");
  if (v.params.state) denyUrl.searchParams.set("state", v.params.state);
  denyUrl.searchParams.set("iss", origin);
  const host = new URL(v.params.redirectUri).host;

  const body = `
    <p class="lead">Claude wants to connect to your RISE data.</p>
    <p class="muted">It will be able to read and update your tasks, finances, habits,
    goals, notes and more (the same non-destructive tools available in chat).</p>
    <p class="muted">Redirects to <strong>${escapeHtml(host)}</strong></p>
    <form method="post" action="${escapeHtml(action)}">
      <button type="submit" class="approve">Approve</button>
    </form>
    <a class="deny" href="${escapeHtml(denyUrl.toString())}">Cancel</a>
  `;
  return new Response(consentShell("Connect RISE to Claude", body), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const origin = getPublicOrigin(req);

  // Lenient same-origin (CSRF) check: reject only a present-and-mismatched Origin.
  const reqOrigin = req.headers.get("origin");
  if (reqOrigin && reqOrigin !== origin) {
    return htmlError("Cross-origin request rejected.", 403);
  }

  const url = new URL(req.url);
  const v = validate(url, origin);
  if (v.kind === "html") return htmlError(v.message, 400);
  if (v.kind === "redirect") {
    return errorRedirect(v.redirectUri, v.error, v.state, origin);
  }

  const auth = await requireAllowedUser(url, origin);
  if ("redirect" in auth) return auth.redirect;

  const code = await issueAuthorizationCode({
    userId: auth.userId,
    clientId: v.params.clientId,
    redirectUri: v.params.redirectUri,
    codeChallenge: v.params.codeChallenge,
    scope: v.params.scope,
    resource: v.params.resource,
  });

  const redirect = new URL(v.params.redirectUri);
  redirect.searchParams.set("code", code);
  if (v.params.state) redirect.searchParams.set("state", v.params.state);
  redirect.searchParams.set("iss", origin);
  return NextResponse.redirect(redirect.toString(), 302);
}

// Minimal branded consent shell (raw HTML — this route runs outside the app shell).
function consentShell(title: string, inner: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(title)} — RISE</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center;
    background:#F9FAFB; font-family: Inter, system-ui, -apple-system, sans-serif; color:#1A1A2E; padding:24px; }
  .card { width:100%; max-width:400px; background:#fff; border:1.5px solid rgba(26,26,46,0.16);
    border-radius:16px; padding:28px; box-shadow:0 8px 30px rgba(26,26,46,0.08); }
  h1 { font-size:20px; font-weight:600; margin:0 0 16px; color:#D6450F; }
  .lead { font-size:15px; font-weight:600; margin:0 0 8px; }
  .muted { font-size:13px; color:#5b5b6b; margin:0 0 12px; line-height:1.5; }
  form { margin:20px 0 8px; }
  .approve { width:100%; min-height:44px; border:none; border-radius:10px; background:#FF6535;
    color:#fff; font-size:15px; font-weight:600; cursor:pointer; font-family:inherit; }
  .approve:hover { background:#e8551f; }
  .deny { display:block; text-align:center; margin-top:12px; font-size:13px; color:#5b5b6b; text-decoration:none; }
  .deny:hover { text-decoration:underline; }
</style></head>
<body><main class="card"><h1>${escapeHtml(title)}</h1>${inner}</main></body></html>`;
}
