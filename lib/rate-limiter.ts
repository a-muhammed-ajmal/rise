// In-memory rate limiter to protect API endpoints
// Uses a sliding window algorithm

import { NextRequest, NextResponse } from 'next/server';

interface RequestRecord {
  timestamp: number;
}

class RateLimiter {
  private requests: Map<string, RequestRecord[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60_000, maxRequests: number = 30) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if a request from the given key is allowed
   * @param key - Identifier (e.g., IP address, user ID)
   * @returns {allowed: boolean, remaining: number, resetAt: number}
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or initialize request history for this key
    const history = this.requests.get(key) || [];

    // Filter requests within the current window
    const recentRequests = history.filter((req) => req.timestamp > windowStart);

    // Check if limit exceeded
    if (recentRequests.length >= this.maxRequests) {
      // Calculate when the oldest request will expire
      const oldest = recentRequests[0];
      const resetAt = oldest ? oldest.timestamp + this.windowMs : now;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Record this request
    recentRequests.push({ timestamp: now });
    this.requests.set(key, recentRequests);

    // Cleanup old entries periodically to prevent memory growth
    this.cleanup(now);

    return {
      allowed: true,
      remaining: this.maxRequests - recentRequests.length - 1,
      resetAt: now + this.windowMs,
    };
  }

  /**
   * Reset rate limit for a key (useful for admin operations or testing)
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Get current request count for a key (for debugging)
   */
  getCount(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const history = this.requests.get(key) || [];
    return history.filter((req) => req.timestamp > windowStart).length;
  }

  /**
   * Clean up old request records to prevent memory leaks
   */
  private cleanup(now: number): void {
    const windowStart = now - this.windowMs;
    for (const [key, history] of this.requests.entries()) {
      const recent = history.filter((req) => req.timestamp > windowStart);
      if (recent.length === 0) {
        this.requests.delete(key);
      } else if (recent.length < history.length) {
        this.requests.set(key, recent);
      }
    }
  }

  /**
   * Clear all records (for development/testing)
   */
  clear(): void {
    this.requests.clear();
  }
}

// Create rate limiters for different endpoints
export const chatRateLimiter = new RateLimiter(60_000, 30); // 30 requests per minute per user
export const tipRateLimiter = new RateLimiter(86_400_000, 10); // 10 requests per day (24 hours) per user

// Middleware factory for use in API routes
export function createRateLimitMiddleware(limiter: RateLimiter, keySelector: (req: NextRequest) => string | null) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const key = keySelector(req);
    if (!key) {
      return NextResponse.json({ error: 'Unable to identify client' }, { status: 400 });
    }

    const result = limiter.check(key);
    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)) } }
      );
    }

    // Attach rate limit info to request for logging/debugging
    (req as any).__rateLimitInfo = result;
    return null; // Continue to handler
  };
}
