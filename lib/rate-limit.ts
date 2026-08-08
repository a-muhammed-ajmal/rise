// Lightweight in-process sliding-window rate limiter.
//
// Scope and honest limitations: state lives in this Node process only. On
// Vercel that means per-lambda-instance — a cold start resets counters and two
// concurrent instances do not coordinate. For a single-user app the purpose is
// cost containment (runaway Gemini / transcription spend, credential
// brute-force), not distributed fairness, and for that this is sufficient
// without adding a dependency or an external store.

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

export function checkRateLimit(
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
}
