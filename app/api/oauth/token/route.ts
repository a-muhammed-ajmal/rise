import {
  consumeAuthorizationCode,
  issueTokens,
  rotateRefreshToken,
  verifyClientSecret,
  verifyPkceS256,
  type IssuedTokens,
} from "@/lib/ai/mcp-oauth";

export const runtime = "nodejs";

const NO_STORE = {
  "content-type": "application/json",
  "cache-control": "no-store",
  pragma: "no-cache",
} as const;

function oauthError(
  error: string,
  status: number,
  description?: string,
): Response {
  return new Response(
    JSON.stringify(
      description ? { error, error_description: description } : { error },
    ),
    { status, headers: NO_STORE },
  );
}

function tokenResponse(t: IssuedTokens): Response {
  return new Response(
    JSON.stringify({
      access_token: t.accessToken,
      token_type: "Bearer",
      expires_in: t.expiresIn,
      refresh_token: t.refreshToken,
      scope: t.scope,
    }),
    { status: 200, headers: NO_STORE },
  );
}

// Client auth via client_secret_basic (Authorization: Basic) or client_secret_post (body).
function readClientCredentials(
  req: Request,
  form: FormData,
): { clientId?: string; clientSecret?: string } {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
      const idx = decoded.indexOf(":");
      if (idx !== -1) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, idx)),
          clientSecret: decodeURIComponent(decoded.slice(idx + 1)),
        };
      }
    } catch {
      // fall through to body credentials
    }
  }
  const clientId = form.get("client_id");
  const clientSecret = form.get("client_secret");
  return {
    clientId: typeof clientId === "string" ? clientId : undefined,
    clientSecret: typeof clientSecret === "string" ? clientSecret : undefined,
  };
}

export async function POST(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return oauthError("invalid_request", 400, "Expected a form-encoded body");
  }

  const { clientId, clientSecret } = readClientCredentials(req, form);
  if (!clientId || !verifyClientSecret(clientId, clientSecret)) {
    console.warn("[oauth/token] client authentication failed");
    return oauthError("invalid_client", 401, "Client authentication failed");
  }

  const grantType = form.get("grant_type");

  if (grantType === "authorization_code") {
    const code = form.get("code");
    const redirectUri = form.get("redirect_uri");
    const codeVerifier = form.get("code_verifier");
    if (
      typeof code !== "string" ||
      typeof redirectUri !== "string" ||
      typeof codeVerifier !== "string"
    ) {
      return oauthError(
        "invalid_request",
        400,
        "Missing code, redirect_uri, or code_verifier",
      );
    }
    const authCode = await consumeAuthorizationCode(code);
    if (!authCode) {
      return oauthError("invalid_grant", 400, "Code is invalid or expired");
    }
    if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
      return oauthError("invalid_grant", 400, "Code does not match this client");
    }
    if (!verifyPkceS256(codeVerifier, authCode.codeChallenge)) {
      return oauthError("invalid_grant", 400, "PKCE verification failed");
    }
    const tokens = await issueTokens({
      userId: authCode.userId,
      clientId: authCode.clientId,
      scope: authCode.scope,
      resource: authCode.resource,
    });
    return tokenResponse(tokens);
  }

  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token");
    if (typeof refreshToken !== "string") {
      return oauthError("invalid_request", 400, "Missing refresh_token");
    }
    const tokens = await rotateRefreshToken(refreshToken, clientId);
    if (!tokens) {
      return oauthError(
        "invalid_grant",
        400,
        "Refresh token is invalid or expired",
      );
    }
    return tokenResponse(tokens);
  }

  return oauthError("unsupported_grant_type", 400);
}
