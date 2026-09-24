/**
 * Process-wide cache of the project's JSON Web Key Set.
 *
 * `getClaims()` verifies an access token against this key set. auth-js keeps
 * its own copy, but that cache lives on the client *instance* — and both the
 * proxy and the server client build a fresh instance per request. Left alone,
 * every request would fetch `/.well-known/jwks.json`, which just swaps one
 * network round trip for another and wins nothing.
 *
 * Holding the key set at module scope makes it survive across requests in a
 * warm serverless instance or Edge isolate, so `getClaims()` becomes pure
 * local WebCrypto work after the first request. Passing it in via the `jwks`
 * option takes precedence over auth-js's per-instance cache.
 *
 * Signing keys rotate rarely and a rotation is self-healing: a token signed
 * with a `kid` this set doesn't carry falls through to auth-js's own fetch, so
 * a stale cache degrades to the previous behaviour rather than rejecting a
 * valid session. The TTL bounds how long that lasts.
 */

type JsonWebKey = { kty: string; key_ops: string[] };
type JsonWebKeySet = { keys: JsonWebKey[] };

const TTL_MS = 10 * 60 * 1000;

let cached: JsonWebKeySet | null = null;
let cachedAt = 0;
let inFlight: Promise<JsonWebKeySet | null> | null = null;

function isJsonWebKeySet(value: unknown): value is JsonWebKeySet {
  if (typeof value !== "object" || value === null) return false;
  if (!("keys" in value)) return false;
  const { keys } = value;
  if (!Array.isArray(keys) || keys.length === 0) return false;
  return keys.every(
    (key) => typeof key === "object" && key !== null && "kty" in key,
  );
}

async function fetchJwks(supabaseUrl: string): Promise<JsonWebKeySet | null> {
  try {
    const response = await fetch(
      `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      {
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return isJsonWebKeySet(body) ? body : null;
  } catch {
    // Offline, DNS failure, a 5xx — the caller falls back to whatever it has,
    // and auth-js will fetch for itself if that turns out to be nothing.
    return null;
  }
}

/**
 * The cached key set, or `undefined` when none could be obtained — in which
 * case `getClaims()` falls back to fetching it itself.
 */
export async function cachedJwks(): Promise<JsonWebKeySet | undefined> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return undefined;

  if (cached && cachedAt + TTL_MS > Date.now()) return cached;

  // Single-flight: a cold instance handling parallel requests fetches once.
  inFlight ??= fetchJwks(supabaseUrl).finally(() => {
    inFlight = null;
  });

  const fresh = await inFlight;
  if (fresh) {
    cached = fresh;
    cachedAt = Date.now();
    return fresh;
  }
  // Serve a stale set rather than nothing — it is almost certainly still valid.
  return cached ?? undefined;
}

/** Test seam — drops the cache so a case can start from cold. */
export function resetJwksCache(): void {
  cached = null;
  cachedAt = 0;
  inFlight = null;
}
