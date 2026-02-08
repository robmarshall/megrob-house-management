import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { validateBody, validateQuery, getValidatedBody, getValidatedQuery } from './validation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonResponse = Record<string, any>;

// Helper to make requests against a Hono app
async function makeRequest(app: Hono, method: string, path: string, body?: unknown) {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const req = new Request(`http://localhost${path}`, init);
  return app.fetch(req);
}

describe('validateBody', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  function createApp() {
    const app = new Hono();
    app.post('/test', validateBody(schema), (c) => {
      const data = getValidatedBody<z.infer<typeof schema>>(c);
      return c.json({ received: data });
    });
    return app;
  }

  it('passes valid body through and stores in context', async () => {
    const app = createApp();
    const res = await makeRequest(app, 'POST', '/test', { name: 'Alice', age: 30 });
    expect(res.status).toBe(200);
    const json = await res.json() as JsonResponse;
    expect(json.received).toEqual({ name: 'Alice', age: 30 });
  });

  it('returns 400 for invalid body', async () => {
    const app = createApp();
    const res = await makeRequest(app, 'POST', '/test', { name: '', age: -5 });
    expect(res.status).toBe(400);
    const json = await res.json() as JsonResponse;
    expect(json.error).toBe('Validation failed');
    expect(json.details).toBeInstanceOf(Array);
    expect(json.details.length).toBeGreaterThan(0);
  });

  it('returns 400 for missing fields', async () => {
    const app = createApp();
    const res = await makeRequest(app, 'POST', '/test', {});
    expect(res.status).toBe(400);
    const json = await res.json() as JsonResponse;
    expect(json.error).toBe('Validation failed');
  });

  it('returns 400 for malformed JSON', async () => {
    const app = new Hono();
    app.post('/test', validateBody(schema), (c) => c.json({ ok: true }));

    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
    const json = await res.json() as JsonResponse;
    expect(json.error).toBe('Invalid JSON body');
  });

  it('includes field names in error details', async () => {
    const app = createApp();
    const res = await makeRequest(app, 'POST', '/test', { name: 123, age: 'old' });
    expect(res.status).toBe(400);
    const json = await res.json() as JsonResponse;
    const fields = json.details.map((d: { field: string }) => d.field);
    expect(fields).toContain('name');
    expect(fields).toContain('age');
  });
});

describe('validateQuery', () => {
  const schema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number),
    search: z.string().optional(),
  });

  function createApp() {
    const app = new Hono();
    app.get('/test', validateQuery(schema), (c) => {
      const data = getValidatedQuery<z.infer<typeof schema>>(c);
      return c.json({ received: data });
    });
    return app;
  }

  it('passes valid query params', async () => {
    const app = createApp();
    const res = await makeRequest(app, 'GET', '/test?page=1&search=hello');
    expect(res.status).toBe(200);
    const json = await res.json() as JsonResponse;
    expect(json.received.page).toBe(1);
    expect(json.received.search).toBe('hello');
  });

  it('returns 400 for invalid query params', async () => {
    const app = createApp();
    const res = await makeRequest(app, 'GET', '/test?page=abc');
    expect(res.status).toBe(400);
    const json = await res.json() as JsonResponse;
    expect(json.error).toBe('Invalid query parameters');
    expect(json.details).toBeInstanceOf(Array);
  });

  it('returns 400 for missing required params', async () => {
    const app = createApp();
    const res = await makeRequest(app, 'GET', '/test');
    expect(res.status).toBe(400);
    const json = await res.json() as JsonResponse;
    expect(json.error).toBe('Invalid query parameters');
  });
});
