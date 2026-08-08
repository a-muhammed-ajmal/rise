import { createHash, timingSafeEqual } from "crypto";

// Authentication for the Vercel-scheduled daily-digest cron.
//
// The `x-vercel-cron` header is deliberately NOT trusted: it is a plain request
// header, so any public caller can set it and would otherwise trigger
// service-role database reads plus Gemini spend. Vercel attaches
// `Authorization: Bearer ${CRON_SECRET}` to every scheduled invocation, so the
// bearer is the only signal we accept.
//
// Fails closed: a missing or too-short CRON_SECRET disables the route entirely
// rather than leaving it open.

const MIN_SECRET_LENGTH = 16;

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; reason: string };

// Constant-time compare over fixed-length digests — mirrors isStaticMcpToken in
// lib/ai/mcp.ts (avoids leaking length and avoids timingSafeEqual throwing on
// unequal-length inputs).
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function authorizeCronRequest(headers: Headers): CronAuthResult {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    return {
      ok: false,
      status: 503,
      reason: "CRON_SECRET is not configured or is too short",
    };
  }

  const authHeader = headers.get("authorization");
  if (!authHeader) {
    return { ok: false, status: 401, reason: "Missing Authorization header" };
  }

  const [scheme, ...rest] = authHeader.split(" ");
  if (scheme.toLowerCase() !== "bearer") {
    return { ok: false, status: 401, reason: "Unsupported authorization scheme" };
  }

  const token = rest.join(" ").trim();
  if (!token || !secretMatches(token, secret)) {
    return { ok: false, status: 401, reason: "Invalid cron credentials" };
  }

  return { ok: true };
}
