import { createHash } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// Production requests use an atomic Postgres fixed-window counter so every
// Vercel instance shares the same limit. The local sliding-window implementation
// remains exported for deterministic, network-free unit tests.

type Bucket = {
  // Ascending timestamps (ms) of the hits still inside the window.
  hits: number[];
  // Latest hit, used for eviction of idle buckets.
  lastSeen: number;
};

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

const buckets = new Map<string, Bucket>();

// Bounds memory when many distinct keys are seen (e.g. per-IP OAuth traffic).
const MAX_BUCKETS = 10_000;
const EVICT_IDLE_MS = 10 * 60 * 1000;

function evictIdle(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastSeen > EVICT_IDLE_MS) buckets.delete(key);
  }
  // Still oversized after idle eviction — drop the oldest entries outright.
  if (buckets.size > MAX_BUCKETS) {
    const sorted = [...buckets.entries()].sort(
      (a, b) => a[1].lastSeen - b[1].lastSeen,
    );
    for (const [key] of sorted.slice(0, buckets.size - MAX_BUCKETS)) {
      buckets.delete(key);
    }
  }
}

export function checkLocalRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  const bucket = buckets.get(key) ?? { hits: [], lastSeen: now };

  // Drop hits that have slid out of the window.
  let firstLive = 0;
  while (firstLive < bucket.hits.length && bucket.hits[firstLive] <= windowStart) {
    firstLive++;
  }
  if (firstLive > 0) bucket.hits = bucket.hits.slice(firstLive);

  if (bucket.hits.length >= limit) {
    bucket.lastSeen = now;
    buckets.set(key, bucket);
    const oldest = bucket.hits[0];
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000),
    );
    return { ok: false, retryAfterSec };
  }

  bucket.hits.push(now);
  bucket.lastSeen = now;
  buckets.set(key, bucket);

  if (buckets.size > MAX_BUCKETS) evictIdle(now);

  return { ok: true, remaining: limit - bucket.hits.length };
}

let cachedAdmin: SupabaseClient<Database> | null = null;

function getAdmin(): SupabaseClient<Database> | null {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cachedAdmin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedAdmin;
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === "test") {
    return checkLocalRateLimit(key, options);
  }

  const admin = getAdmin();
  if (!admin) {
    console.error("[rate-limit] missing Supabase service configuration");
    return { ok: false, retryAfterSec: 60 };
  }

  const keyHash = createHash("sha256").update(key).digest("hex");
  const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));

  try {
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key_hash: keyHash,
      p_limit: options.limit,
      p_window_seconds: windowSeconds,
    });
    const result = data?.[0];
    if (error || !result) {
      console.error("[rate-limit] distributed counter failed", error?.message);
      return { ok: false, retryAfterSec: windowSeconds };
    }
    return result.allowed
      ? { ok: true, remaining: result.remaining }
      : { ok: false, retryAfterSec: result.retry_after_seconds };
  } catch (error) {
    console.error("[rate-limit] distributed counter threw", error);
    return { ok: false, retryAfterSec: windowSeconds };
  }
}

export function rateLimitResponse(retryAfterSec: number): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please slow down and try again shortly.",
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfterSec),
        "cache-control": "no-store",
      },
    },
  );
}

// Best-effort client identifier for unauthenticated endpoints. Vercel sets
// x-forwarded-for; the leftmost entry is the originating client.
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

// Test-only reset so suites do not leak counters between cases.
export function __resetRateLimits(): void {
  buckets.clear();
  cachedAdmin = null;
}
