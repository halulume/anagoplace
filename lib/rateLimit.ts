/**
 * Simple in-memory rate limiter (per-IP, per-route).
 * Good enough for a single-region Vercel deployment.
 * For multi-region scale, swap with Upstash Redis.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const buckets: Record<string, Map<string, Entry>> = {};

export interface RateLimitOptions {
  /** Unique key per route, e.g. "relay-quote" */
  bucket: string;
  /** Max requests allowed inside the window */
  max: number;
  /** Window length in milliseconds */
  windowMs: number;
}

export function rateLimit(ip: string, opts: RateLimitOptions): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const bucket = (buckets[opts.bucket] ??= new Map());
  const now = Date.now();
  const entry = bucket.get(ip);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + opts.windowMs;
    bucket.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: opts.max - 1, resetAt };
  }

  if (entry.count >= opts.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: opts.max - entry.count,
    resetAt: entry.resetAt,
  };
}

/** Extract client IP from common proxy headers (Vercel uses x-forwarded-for) */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
