import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

/**
 * Verifies the CORS behavior that index.ts relies on for the /api/auth/* routes:
 *  - the cors() middleware answers OPTIONS preflight itself (so a separate
 *    app.options() handler would be dead code), and
 *  - the cors() middleware applies its Access-Control-* headers even when the
 *    route handler returns a brand-new Response (so manually re-setting those
 *    headers on the auth handler's returned Response is redundant).
 *
 * This mirrors the exact cors() config used in index.ts. If Hono ever changed
 * so that middleware headers were lost on a handler-returned Response, this
 * test would fail and flag that the manual re-set is needed again.
 */
const FRONTEND_URL = 'http://localhost:5173';

function buildApp() {
  const app = new Hono();

  app.use(
    '/api/auth/*',
    cors({
      origin: FRONTEND_URL,
      credentials: true,
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Length', 'Set-Cookie'],
      maxAge: 600,
    })
  );

  // Mimics the auth handler: returns a fresh Response WITHOUT setting any
  // Access-Control-* headers itself (i.e. as if the manual re-set were removed).
  app.on(['GET', 'POST'], '/api/auth/*', async () => {
    const upstream = new Response('{"ok":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: new Headers(upstream.headers),
    });
  });

  return app;
}

describe('auth CORS middleware', () => {
  it('answers OPTIONS preflight itself (no separate handler needed)', async () => {
    const app = buildApp();
    const res = await app.request('/api/auth/sign-in/email', {
      method: 'OPTIONS',
      headers: { Origin: FRONTEND_URL, 'Access-Control-Request-Method': 'POST' },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(FRONTEND_URL);
  });

  it('applies Access-Control-* headers to a handler-returned new Response', async () => {
    const app = buildApp();
    const res = await app.request('/api/auth/get-session', {
      method: 'GET',
      headers: { Origin: FRONTEND_URL },
    });

    expect(res.status).toBe(200);
    // These are added by the cors() middleware, NOT by the handler — proving the
    // manual re-set in index.ts is redundant.
    expect(res.headers.get('access-control-allow-origin')).toBe(FRONTEND_URL);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });
});
