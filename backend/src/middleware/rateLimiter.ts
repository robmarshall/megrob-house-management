import type { Context, Next } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limiter middleware for single-process deployments.
 * Tracks request counts per IP within a sliding window.
 *
 * Uses the socket remote address (via @hono/node-server getConnInfo) as the
 * primary IP source. This is not spoofable by clients, unlike X-Forwarded-For
 * or X-Real-IP headers which should only be trusted behind a configured
 * reverse proxy.
 *
 * @param maxRequests - Maximum requests allowed within the window
 * @param windowMs - Time window in milliseconds
 */
export function rateLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, RateLimitEntry>();

  // Periodically clean up expired entries to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, windowMs * 2).unref();

  return async (c: Context, next: Next) => {
    const connInfo = getConnInfo(c);
    const ip = connInfo.remote.address;

    if (!ip) {
      // Reject requests where no IP can be determined rather than
      // creating a shared rate-limit bucket for unidentifiable clients
      return c.json(
        { error: 'Unable to determine client address.' },
        400
      );
    }

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now >= entry.resetAt) {
      // First request or window expired — start fresh
      store.set(ip, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    if (entry.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', retryAfterSeconds.toString());
      return c.json(
        { error: 'Too many requests. Please try again later.' },
        429
      );
    }

    entry.count++;
    await next();
  };
}
