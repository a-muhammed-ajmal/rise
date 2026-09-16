import { createClient } from "./client";

/**
 * The signed-in user's id, taken from the locally verified access token.
 *
 * Every client-side insert needs a `user_id`, and the hooks used to read it
 * with `auth.getUser()` — which always POSTs to the Auth server. That put a
 * full network round trip in front of the write itself, so adding a task or
 * ticking a habit cost two sequential hops instead of one.
 *
 * `getClaims()` reads the session from local storage and verifies the token's
 * signature against the project's cached JWKS, so after the first call it is
 * local work. On a project still signing with a symmetric secret it falls back
 * to `getUser()` internally — same guarantee, same behaviour, just no saving.
 *
 * Returns `null` when there is no valid session, so callers keep the existing
 * "bail out quietly" shape.
 */
export async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}
