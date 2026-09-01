import { describe, it, expect, vi, beforeAll } from 'vitest';

/**
 * HTTP-level wiring for the analytics routes.
 *
 * The services and their SQL are covered in
 * `services/snozoneAnalyticsService.test.ts`; what is only checked here is the
 * seam between them and Hono — that each path is actually registered at the
 * URL the frontend asks for, that a bad range is a 400 rather than a 500, and
 * that the caching header is set. A mistyped route path type-checks perfectly
 * and fails only in the browser.
 *
 * Auth is stubbed because Better Auth signs its session cookie, so a real
 * request cannot be forged without the signing secret; the middleware itself
 * is not what these tests are about.
 */

vi.mock('../lib/auth.js', () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: 'test-user', email: 'test@example.com' },
        session: { id: 'test-session' },
      })),
    },
  },
}));

let app: typeof import('./snozone.js').default;

beforeAll(async () => {
  app = (await import('./snozone.js')).default;
});

const ANALYTICS_PATHS = [
  '/analytics/collected-dates',
  '/analytics/busyness',
  '/analytics/booking-times',
  '/analytics/lead-times',
  '/analytics/trend',
];

describe('analytics routes', () => {
  it.each(ANALYTICS_PATHS)('%s is registered and returns JSON', async (path) => {
    const res = await app.request(path);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    await expect(res.json()).resolves.toBeTypeOf('object');
  });

  it.each(ANALYTICS_PATHS)('%s sets a cache header', async (path) => {
    const res = await app.request(path);
    expect(res.headers.get('cache-control')).toMatch(/max-age=\d+/);
  });

  const RANGED_PATHS = ANALYTICS_PATHS.filter((p) => p !== '/analytics/collected-dates');

  it.each(RANGED_PATHS)('%s echoes the range it actually used', async (path) => {
    const res = await app.request(`${path}?from=2026-08-01&to=2026-08-31`);
    const body = (await res.json()) as { range: { from: string; to: string } };
    expect(body.range).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it.each(RANGED_PATHS)('%s rejects a malformed range with 400, not 500', async (path) => {
    for (const query of ['?from=2026-8-1', '?to=yesterday', '?from=2026-09-01&to=2026-08-01']) {
      const res = await app.request(`${path}${query}`);
      expect(res.status, `${path}${query}`).toBe(400);
    }
  });

  it('carries a maturity verdict on every analytic the page gates on', async () => {
    for (const path of RANGED_PATHS) {
      const res = await app.request(path);
      const body = (await res.json()) as { maturity?: { needs: number; ready: boolean } };
      expect(body.maturity, path).toBeDefined();
      expect(typeof body.maturity!.ready, path).toBe('boolean');
    }
  });
});
