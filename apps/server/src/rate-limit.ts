/**
 * Simple fixed-window rate limiter (per client key).
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Returns null if allowed, or retry-after seconds if limited. */
  check(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
    if (this.limit <= 0) return { ok: true };
    const now = Date.now();
    const row = this.hits.get(key);
    if (!row || now >= row.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { ok: true };
    }
    if (row.count >= this.limit) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((row.resetAt - now) / 1000)),
      };
    }
    row.count += 1;
    return { ok: true };
  }
}
