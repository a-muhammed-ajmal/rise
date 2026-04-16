import { RATE_LIMIT } from './constants';

// ─── IN-MEMORY RATE LIMITER ───────────────────────────────────────────────────
// Sliding-window rate limiter for API routes.

interface WindowEntry {
  count: number;
  windowStart: number;
}

const chatStore = new Map<string, WindowEntry>();
const tipStore = new Map<string, WindowEntry>();

/**
 * Chat rate limiter: 30 requests per 60 seconds per userId.
 * Returns true if allowed, false if rate limited.
 */
export function checkRateLimit(userId: string): boolean {
  return checkWindow(userId, chatStore, RATE_LIMIT.REQUESTS_PER_MINUTE, 60_000);
}

/**
 * Tip rate limiter: 10 requests per 24 hours per userId.
 * Returns true if allowed, false if rate limited.
 */
export function checkTipRateLimit(userId: string): boolean {
  return checkWindow(userId, tipStore, 10, 86_400_000);
}

function checkWindow(
  userId: string,
  store: Map<string, WindowEntry>,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = store.get(userId);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count += 1;
  return true;
}
