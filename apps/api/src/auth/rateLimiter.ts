interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class InMemoryRateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number
  ) {}

  /** Returns whether the request is allowed. Increments the counter. */
  check(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: this.maxAttempts - 1 };
    }

    entry.count++;
    const remaining = Math.max(0, this.maxAttempts - entry.count);
    return { allowed: entry.count <= this.maxAttempts, remaining };
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}
