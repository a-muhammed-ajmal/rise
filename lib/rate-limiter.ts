import { RATE_LIMIT } from './constants';

// ─── IN-MEMORY RATE LIMITER ───────────────────────────────────────────────────
// Simple sliding-window rate limiter for API routes.
// 30 requests per minute per userId.

interface WindowEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, WindowEntry>();

/**
 * Check if the userId is within the rate limit.
 * Returns true if allowed, false if rate limited.
 */
export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute

  const entry = store.get(userId);

  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    store.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT.REQUESTS_PER_MINUTE) {
    return false;
  }

  entry.count += 1;
  return true;
}
