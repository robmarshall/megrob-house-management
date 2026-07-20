import type { Context, Next } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Resolve the real client IP for rate-limiting purposes.
 *
 * X-Forwarded-For (XFF) is only trusted when the operator has declared how many
 * trusted proxies sit in front of the app via `trustedHops`. Each well-behaved
 * proxy APPENDS the address it received the request from, so the trustworthy
 * client entry is counted from the RIGHT of the list. A client that forges an
 * XFF header only pushes their fake value to the LEFT of the entry the nearest
 * trusted proxy appended, so it cannot be mistaken for the real client.
 *
 * @param forwardedFor - Raw X-Forwarded-For header value (may be undefined)
 * @param socketAddr - TCP socket peer address (from getConnInfo)
 * @param trustedHops - Number of trusted proxies in front of the app
 * @returns The resolved client IP, or undefined if none can be determined
 */
export function resolveClientIp(
  forwardedFor: string | undefined,
  socketAddr: string | undefined,
  trustedHops: number
): string | undefined {
  // No trusted proxies configured -> ignore XFF entirely (safe default).
  if (trustedHops <= 0) {
    return socketAddr;
  }

  // XFF absent -> fall back to the socket peer address.
  if (!forwardedFor) {
    return socketAddr;
  }

  const parts = forwardedFor
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  // Count the client entry from the right: the nearest trusted proxy appended
  // the address it saw, so `trustedHops` back from the end is the real client.
  const index = parts.length - trustedHops;
  if (index < 0 || !parts[index]) {
    return socketAddr;
  }

  return parts[index];
}

/**
 * In-memory rate limiter middleware for single-process deployments.
 * Tracks request counts per IP within a sliding window.
 *
 * By default the socket remote address (via @hono/node-server getConnInfo) is
 * used as the IP source. This is not spoofable by clients, unlike
 * X-Forwarded-For which should only be trusted behind a configured reverse
 * proxy.
 *
 * When the app runs behind a reverse proxy / load balancer, the socket peer is
 * the PROXY's address for every request, collapsing all clients into one
 * bucket. To handle this, set the `TRUST_PROXY_HOPS` environment variable to
 * the number of trusted proxies in front of the app (e.g. `1` behind a single
 * load balancer). When set to a positive integer, the client IP is extracted
 * from X-Forwarded-For, counting `TRUST_PROXY_HOPS` entries from the right.
 * Unset/invalid/negative values disable XFF trust (default, socket address).
 *
 * @param maxRequests - Maximum requests allowed within the window
 * @param windowMs - Time window in milliseconds
 */
export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * In-memory rate limiter keyed by an arbitrary string (e.g. a userId) instead
 * of the client IP. Used for the MCP endpoint, where all traffic arrives from
 * Anthropic's shared egress IPs and per-IP limiting would throttle every
 * connected user as one client.
 */
export function createKeyedRateLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, RateLimitEntry>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, windowMs * 2).unref();

  return function check(key: string): RateLimitDecision {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    }

    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
      };
    }

    entry.count++;
    return { allowed: true };
  };
}

export function rateLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, RateLimitEntry>();

  // Read the trusted-proxy hop count once. Default 0 (ignore XFF) when the
  // env var is unset, non-numeric, or negative.
  const parsedHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '', 10);
  const trustedHops = Number.isNaN(parsedHops) || parsedHops < 0 ? 0 : parsedHops;

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
    const ip = resolveClientIp(
      c.req.header('x-forwarded-for'),
      getConnInfo(c).remote.address,
      trustedHops
    );

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
