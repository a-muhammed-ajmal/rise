---
name: security-audit
description: Security review for a Next.js/Supabase/Vercel stack, structured around OWASP Top 10:2025. Use before any PR or deploy that touches authentication, payments, financial or health-adjacent data, user data access, or external API calls. Triggers on "security audit", "is this secure", "check for vulnerabilities", "audit this auth flow", "review before deploy". Produces a findings report grouped by OWASP category, not a vague pass/fail.
---

# Security Audit — OWASP Top 10:2025, applied to this stack

Run this before shipping anything that touches auth, money, or user data.
Go through every category below — don't stop at the first finding. Report
back grouped by category, each finding with severity (critical/high/
medium/low) and a concrete fix, not just "this looks risky."

This is a review skill: report findings and propose fixes, don't silently
patch security-relevant code without flagging what changed and why.

---

## A01:2025 — Broken Access Control (includes SSRF)

Still the #1 risk, and the one this stack is most exposed to since
Supabase's RLS *is* the access control layer.
- Every table with user data has RLS enabled with tested policies — see
  the `db-schema` skill for the full checklist; cross-reference it here
  rather than re-deriving it.
- Every Next.js API route that takes a resource ID (`/api/habits/[id]`)
  verifies the *requesting user owns that specific ID* — not just that
  they're logged in. This is BOLA (broken object-level authorization):
  the most common real-world API failure, and `auth required` alone
  doesn't catch it.
- Any server-side fetch that takes a user-influenced URL or hostname
  (webhooks, link previews, file imports) needs an allowlist — this is
  SSRF, now filed under this category.

## A02:2025 — Security Misconfiguration

Now the #2 risk — up from #5, reflecting how much damage a bad config
does in continuous-deploy setups.
- Vercel env vars scoped correctly per environment (Preview vs
  Production) — a staging Supabase key must never be reachable from
  production and vice versa.
- No verbose error pages / stack traces served in production
  (`NODE_ENV=production`, Next.js default error boundary, not a custom
  one that echoes the raw error).
- CORS on any API route is an explicit allowlist, not `*`.
- No default credentials, no debug flags left on, no admin routes
  reachable without auth.

## A03:2025 — Software Supply Chain Failures

New category, low incidence but the highest exploit/impact severity of
any category — a compromised dependency is a worse outcome than almost
anything else on this list.
- `package-lock.json` committed and not edited by hand.
- Run a dependency audit (`npm audit`, or a supply-chain tool) before
  any release, not just when something feels off.
- No unreviewed `postinstall` scripts in new dependencies.
- Pin versions for anything security-sensitive (auth libraries, crypto)
  rather than trusting a caret range to stay safe.

## A04:2025 — Cryptographic Failures

- No secret, API key, or the Supabase `service_role` key in any file that
  ships to the client bundle — check this explicitly, not just by
  convention.
- HTTPS enforced everywhere (Vercel does this by default — verify nothing
  overrides it).
- If RISE ever stores anything beyond what Supabase Auth handles (a PIN,
  a recovery code), it's hashed, not stored or logged in plaintext.

## A05:2025 — Injection

- Supabase's client library parameterizes queries by default — the actual
  risk surface is any **raw SQL** (`rpc()` calls, `SECURITY DEFINER`
  functions) or any string built by concatenating user input.
- Every API route validates its input shape before touching the database
  — don't rely on the database constraint to be the only validation
  layer.

## A06:2025 — Insecure Design

- Specifically threat-model the AI Compose layer: can a crafted prompt
  cause it to read or act on data outside the requesting user's scope?
  RLS should make this structurally impossible even if the AI logic has a
  bug — verify that assumption rather than trusting it.
- Rate-limit or scope any AI action that can write data (the compose
  layer shouldn't be able to mass-delete or mass-edit without a
  confirmation step).

## A07:2025 — Authentication Failures

(Renamed from "Identification and Authentication Failures.")
- Supabase Auth session expiry and refresh-token rotation are configured,
  not left at an insecure default.
- Login/signup endpoints are rate-limited — unbounded auth attempts is
  the classic finding here.
- MFA available if this ever handles real financial data for more than
  one user.

## A08:2025 — Software and Data Integrity Failures

- CI/CD pipeline only deploys from verified commits on the intended
  branch — no arbitrary script execution from a PR before review.
- No third-party script loaded client-side without a subresource
  integrity check or a pinned version.

## A09:2025 — Security Logging & Alerting Failures

(Renamed from "Security Logging and Monitoring Failures" — the rename
exists specifically to emphasize that logging without alerting doesn't
help anyone notice an incident.)
- Auth failures and RLS denials are logged somewhere queryable, not just
  silently swallowed.
- At minimum one alert exists for an anomalous pattern (spike in failed
  logins, spike in 403s) — logging that nobody looks at isn't a control.

## A10:2025 — Mishandling of Exceptional Conditions

New category — improper error handling, logical errors, failing open.
- When an RLS check or an auth check errors (not just denies), the
  failure mode is **closed**, not open — an exception in an access check
  must never result in showing the data anyway.
- Errors are caught and handled explicitly at every API boundary, not
  left to bubble into a generic 500 that might leak internals.

---

## Output format

Report findings grouped by category, in this shape:

```
[A01 — Broken Access Control] HIGH
  /api/habits/[id] reads any habit by ID without checking ownership.
  Fix: add `.eq('user_id', session.user.id)` or rely on the RLS policy
  and confirm anon/authenticated role scoping is correct.
```

If a category has nothing to flag, say so explicitly — don't skip it
silently. A clean A09 (logging) is still worth stating, since it's the
category most likely to be quietly unaddressed.
